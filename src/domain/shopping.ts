import { allocateStock, convertBetween, coverUseText, equivalenceKey, proposalText, type Coverage } from './families';
import { usableQuantity } from './stock';
import type { AggregatedNeed } from './portions';
import type { DietProfile, ID, ISODate, Priority, Product, ProductFamily, ShoppingLine, Unit } from './types';
import { formatQty, round2, roundNice, roundUpToStep, saleStep } from './units';

export interface GenerationOptions {
  /** Ajouter les produits actuellement absents ou sous leur seuil minimal. */
  includeLowStock: boolean;
  /** Inclure les ingrédients facultatifs des recettes. */
  includeOptional: boolean;
  /** Date à laquelle le stock doit être utilisable (début de la période). */
  on: ISODate;
  /** Quantités déjà prévues sur d'autres listes ouvertes, par produit (unité du produit). */
  alreadyListed?: Map<ID, number>;
  /** Familles de produits : si fournies, le stock des références équivalentes est pris en compte. */
  families?: Map<ID, ProductFamily>;
  /** Profils alimentaires (pour n'utiliser que des remplacements autorisés). */
  profiles?: Map<ID, DietProfile>;
}

/** Prise en compte des références équivalentes pour un produit (voir `families.ts`). */
export interface FamilyCover {
  /** Besoin couvert par le stock de références équivalentes, dans l'unité du produit. */
  fromEquivalents: number;
  /** Explications : références utilisées, remplacements à confirmer. */
  reasons: string[];
  /** Stock utilisable aujourd'hui de ce produit et de ses références équivalentes (unité du produit). */
  classUsable: number | null;
  /** Stock de la classe d'équivalence restant après les menus (unité du produit). */
  classRemaining: number;
  /** Une seule référence par classe d'équivalence est réapprovisionnée au titre du seuil minimal. */
  restockAllowed: boolean;
}

export interface ProposedLine {
  productId: ID;
  name: string;
  categoryId: ID;
  /** Besoin brut avant arrondi, dans l'unité du produit. */
  rawQuantity: number;
  /** Quantité proposée, arrondie au format de vente. */
  quantity: number;
  unit: Unit;
  estUnitPrice?: number;
  estTotal?: number;
  priority: Priority;
  source: 'menus' | 'stock bas';
  reasons: string[];
  stockUnknown: boolean;
}

/**
 * Calcule la quantité à acheter pour un produit.
 *
 * Règles :
 * 1. Besoin des menus couvert par le stock utilisable → rien à acheter pour les menus.
 * 2. Le stock projeté après les menus qui passe sous le seuil ne déclenche PAS d'achat
 *    (un ingrédient suffisant pour les menus n'est pas racheté pour un seuil théorique).
 * 3. Un produit déjà sous son seuil aujourd'hui (option « stock bas ») est réapprovisionné :
 *    achat = besoin des menus + quantité cible − stock utilisable.
 * 4. Stock inconnu : on propose le besoin des menus, signalé « à vérifier », sans supposer l'absence.
 * 5. Avec `fam`, le stock des références équivalentes (même famille) couvre aussi le besoin, et le seuil
 *    s'apprécie sur l'ensemble des références équivalentes.
 */
export function quantityToBuy(
  p: Product,
  need: number,
  opts: Pick<GenerationOptions, 'includeLowStock' | 'on'>,
  alreadyListed = 0,
  fam?: FamilyCover,
): { raw: number; reasons: string[]; source: 'menus' | 'stock bas'; stockUnknown: boolean } | null {
  const usable = usableQuantity(p, opts.on);
  const reasons: string[] = [];
  const fromEq = fam?.fromEquivalents ?? 0;
  if (usable === null) {
    if (need <= 0) return null;
    const raw = roundNice(Math.max(0, need - fromEq - alreadyListed));
    if (raw <= 0) return null;
    reasons.push(`Menus : ${formatQty(need, p.unit)} nécessaires`, 'Stock inconnu : vérifiez avant d’acheter', ...(fam?.reasons ?? []));
    if (alreadyListed > 0) reasons.push(`${formatQty(alreadyListed, p.unit)} déjà sur une autre liste`);
    return { raw, reasons, source: 'menus', stockUnknown: true };
  }
  if (p.expiryDate && p.expiryDate < opts.on && (p.quantity ?? 0) > 0) {
    reasons.push(`${formatQty(p.quantity, p.unit)} en stock mais date dépassée : non compté`);
  }
  const shortfall = Math.max(0, need - usable - fromEq);
  const classUsable = fam?.classUsable ?? usable;
  // Stock restant après les menus : achat de seuil = besoin non couvert + retour à la quantité cible.
  const remaining = fam ? fam.classRemaining : Math.max(0, usable - need);
  const belowMin = opts.includeLowStock && p.minQuantity !== undefined && (fam?.restockAllowed ?? true) && classUsable < p.minQuantity;
  let raw = shortfall;
  let source: 'menus' | 'stock bas' = 'menus';
  if (belowMin) {
    const target = p.targetQuantity ?? p.minQuantity!;
    raw = shortfall + Math.max(0, target - remaining);
    if (shortfall <= 0) source = 'stock bas';
  }
  raw = roundNice(raw - alreadyListed);
  if (raw <= 0) return null;
  if (need > 0) reasons.push(`Menus : ${formatQty(need, p.unit)} nécessaires, ${formatQty(usable, p.unit)} utilisables`);
  reasons.push(...(fam?.reasons ?? []));
  if (belowMin) {
    const what = classUsable !== usable ? `${formatQty(classUsable, p.unit)} avec les références équivalentes` : formatQty(usable, p.unit);
    reasons.push(`Sous le seuil (${what} < ${formatQty(p.minQuantity!, p.unit)}) : retour à ${formatQty(p.targetQuantity ?? p.minQuantity!, p.unit)}`);
  }
  if (alreadyListed > 0) reasons.push(`${formatQty(alreadyListed, p.unit)} déjà sur une autre liste`);
  return { raw, reasons, source, stockUnknown: false };
}

/**
 * Propose les lignes d'une liste de courses à partir des besoins regroupés des menus
 * et, si demandé, des produits sous leur seuil. Chaque produit n'apparaît qu'une fois.
 */
export function proposeShoppingLines(
  products: Product[],
  needs: Map<ID, AggregatedNeed>,
  opts: GenerationOptions,
): ProposedLine[] {
  const out: ProposedLine[] = [];
  const covers = opts.families ? familyCovers(products, needs, opts).covers : undefined;
  for (const p of products) {
    if (p.archived) continue;
    const n = needs.get(p.id);
    if (n && n.optional && !opts.includeOptional) continue;
    const need = n?.quantity ?? 0;
    if (need <= 0 && !opts.includeLowStock) continue;
    const res = quantityToBuy(p, need, opts, opts.alreadyListed?.get(p.id) ?? 0, covers?.get(p.id));
    if (!res) continue;
    const step = saleStep(p);
    const quantity = roundUpToStep(res.raw, step);
    if (quantity > res.raw + 1e-9) res.reasons.push(`Arrondi au format de vente (${formatQty(step ?? 0, p.unit)})`);
    out.push({
      productId: p.id,
      name: p.name,
      categoryId: p.categoryId,
      rawQuantity: res.raw,
      quantity,
      unit: p.unit,
      estUnitPrice: p.unitPrice,
      estTotal: p.unitPrice !== undefined ? round2(p.unitPrice * quantity) : undefined,
      priority: p.essential && !(n?.optional ?? false) ? 'essentiel' : 'optionnel',
      source: res.source,
      reasons: [...(n?.sources.length ? [`Utilisé dans ${n.sources.length} préparation(s)`] : []), ...res.reasons],
      stockUnknown: res.stockUnknown,
    });
  }
  return out.sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.name.localeCompare(b.name, 'fr'));
}

/**
 * Répartit le stock entre les besoins en tenant compte des familles et prépare, pour chaque produit,
 * la part couverte par des références équivalentes et le stock de sa classe d'équivalence.
 */
export function familyCovers(
  products: Product[],
  needs: Map<ID, AggregatedNeed>,
  opts: Pick<GenerationOptions, 'includeOptional' | 'on' | 'families' | 'profiles'>,
): { covers: Map<ID, FamilyCover>; coverage: Map<ID, Coverage> } {
  const families = opts.families ?? new Map();
  const byId = new Map(products.map((p) => [p.id, p]));
  const inputs = [...needs.values()].filter((n) => !(n.optional && !opts.includeOptional));
  const { coverage, remaining } = allocateStock(inputs, byId, families, opts.profiles ?? new Map(), opts.on);
  const classes = new Map<string, Product[]>();
  for (const p of products) {
    if (p.archived) continue;
    const k = equivalenceKey(p, families);
    classes.set(k, [...(classes.get(k) ?? []), p]);
  }
  // Référence réapprovisionnée au titre du seuil : celle qui a un seuil et a été achetée le plus récemment.
  const representative = new Map<string, ID>();
  for (const [k, members] of classes) {
    const withMin = members.filter((m) => m.minQuantity !== undefined);
    withMin.sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? '') || a.name.localeCompare(b.name, 'fr'));
    if (withMin[0]) representative.set(k, withMin[0].id);
  }
  const covers = new Map<ID, FamilyCover>();
  for (const p of products) {
    if (p.archived) continue;
    const k = equivalenceKey(p, families);
    const members = classes.get(k) ?? [p];
    const own = usableQuantity(p, opts.on);
    let classUsable = own;
    let classRemaining = 0;
    for (const m of members) {
      const r = remaining.get(m.id);
      const inP = r === null || r === undefined ? null : m.id === p.id ? r : convertBetween(r, m, p);
      if (inP !== null) classRemaining += inP;
      if (m.id !== p.id && classUsable !== null) {
        const u = usableQuantity(m, opts.on);
        const uP = u === null ? null : convertBetween(u, m, p);
        if (uP !== null) classUsable += uP;
      }
    }
    const c = coverage.get(p.id);
    covers.set(p.id, {
      fromEquivalents: roundNice(c?.uses.reduce((s, u) => s + u.quantity, 0) ?? 0),
      reasons: [...(c?.uses.map(coverUseText) ?? []), ...(c?.proposals.map(proposalText) ?? [])],
      classUsable: classUsable === null ? null : roundNice(classUsable),
      classRemaining: roundNice(classRemaining),
      restockAllowed: (representative.get(k) ?? p.id) === p.id,
    });
  }
  return { covers, coverage };
}

// ---------------------------------------------------------------------------
// Budget d'une liste
// ---------------------------------------------------------------------------

export interface ListTotals {
  /** Coût estimé des lignes encore prévues ou achetées (hors retirées et indisponibles). */
  estimated: number;
  /** Montant réellement payé (lignes achetées avec un prix saisi). */
  spent: number;
  /** Estimation des lignes achetées, pour calculer l'écart. */
  estimatedOfBought: number;
  /** Écart entre le payé et l'estimé, sur les lignes achetées avec prix. */
  variance: number;
  remainingEstimate: number;
  optionalEstimate: number;
  counts: { total: number; todo: number; bought: number; unavailable: number };
}

export function listTotals(lines: Pick<ShoppingLine, 'status' | 'estTotal' | 'actualPrice' | 'priority'>[]): ListTotals {
  let estimated = 0;
  let spent = 0;
  let estimatedOfBought = 0;
  let remaining = 0;
  let optional = 0;
  const counts = { total: 0, todo: 0, bought: 0, unavailable: 0 };
  for (const l of lines) {
    if (l.status === 'retiré') continue;
    counts.total++;
    if (l.status === 'indisponible') {
      counts.unavailable++;
      continue;
    }
    const est = l.estTotal ?? 0;
    estimated += est;
    if (l.priority === 'optionnel' && l.status === 'à acheter') optional += est;
    if (l.status === 'acheté') {
      counts.bought++;
      if (l.actualPrice !== undefined) {
        spent += l.actualPrice;
        estimatedOfBought += est;
      }
    } else {
      counts.todo++;
      remaining += est;
    }
  }
  return {
    estimated: round2(estimated),
    spent: round2(spent),
    estimatedOfBought: round2(estimatedOfBought),
    variance: round2(spent - estimatedOfBought),
    remainingEstimate: round2(remaining),
    optionalEstimate: round2(optional),
    counts,
  };
}
