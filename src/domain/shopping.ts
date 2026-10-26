import { usableQuantity } from './stock';
import type { AggregatedNeed } from './portions';
import type { ID, ISODate, Priority, Product, ShoppingLine, Unit } from './types';
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
 */
export function quantityToBuy(
  p: Product,
  need: number,
  opts: Pick<GenerationOptions, 'includeLowStock' | 'on'>,
  alreadyListed = 0,
): { raw: number; reasons: string[]; source: 'menus' | 'stock bas'; stockUnknown: boolean } | null {
  const usable = usableQuantity(p, opts.on);
  const reasons: string[] = [];
  if (usable === null) {
    if (need <= 0) return null;
    const raw = Math.max(0, need - alreadyListed);
    if (raw <= 0) return null;
    reasons.push(`Menus : ${formatQty(need, p.unit)} nécessaires`, 'Stock inconnu : vérifiez avant d’acheter');
    if (alreadyListed > 0) reasons.push(`${formatQty(alreadyListed, p.unit)} déjà sur une autre liste`);
    return { raw, reasons, source: 'menus', stockUnknown: true };
  }
  if (p.expiryDate && p.expiryDate < opts.on && (p.quantity ?? 0) > 0) {
    reasons.push(`${formatQty(p.quantity, p.unit)} en stock mais date dépassée : non compté`);
  }
  const shortfall = Math.max(0, need - usable);
  const belowMin = opts.includeLowStock && p.minQuantity !== undefined && usable < p.minQuantity;
  let raw = shortfall;
  let source: 'menus' | 'stock bas' = 'menus';
  if (belowMin) {
    const target = p.targetQuantity ?? p.minQuantity!;
    raw = Math.max(shortfall, need + target - usable);
    if (shortfall <= 0) source = 'stock bas';
  }
  raw = roundNice(raw - alreadyListed);
  if (raw <= 0) return null;
  if (need > 0) reasons.push(`Menus : ${formatQty(need, p.unit)} nécessaires, ${formatQty(usable, p.unit)} utilisables`);
  if (belowMin) reasons.push(`Sous le seuil (${formatQty(usable, p.unit)} < ${formatQty(p.minQuantity!, p.unit)}) : retour à ${formatQty(p.targetQuantity ?? p.minQuantity!, p.unit)}`);
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
  for (const p of products) {
    if (p.archived) continue;
    const n = needs.get(p.id);
    if (n && n.optional && !opts.includeOptional) continue;
    const need = n?.quantity ?? 0;
    if (need <= 0 && !opts.includeLowStock) continue;
    const res = quantityToBuy(p, need, opts, opts.alreadyListed?.get(p.id) ?? 0);
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
