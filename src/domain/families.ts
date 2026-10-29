import { productForbiddenFor } from './restrictions';
import { usableQuantity } from './stock';
import type { DietProfile, ID, ISODate, Product, ProductFamily, Unit } from './types';
import { convert, formatQty, roundNice } from './units';

/**
 * Familles, variantes et équivalences.
 *
 * Un besoin porte toujours sur un produit précis (la variante demandée par la recette). Le stock d'une autre
 * référence de la même famille ne le couvre automatiquement que si elle est « équivalente » :
 * - même variante (autre marque, autre format) ;
 * - ou famille déclarée « interchangeable » (sauf si la recette exige la variante).
 * Dans une famille « à confirmer », les autres variantes sont seulement proposées. Un remplacement interdit
 * par le profil d'une personne qui mange le plat n'est jamais compté ni proposé.
 */

export type Relation = 'même produit' | 'équivalent' | 'à confirmer';

export function normVariant(v?: string): string {
  return (v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Relation entre le produit demandé et un candidat ; `null` : aucun remplacement possible. */
export function relation(wanted: Product, candidate: Product, families: Map<ID, ProductFamily>, exactVariant = false): Relation | null {
  if (wanted.id === candidate.id) return 'même produit';
  if (!wanted.familyId || wanted.familyId !== candidate.familyId) return null;
  const fam = families.get(wanted.familyId);
  if (!fam) return null;
  const a = normVariant(wanted.variant);
  if (a && a === normVariant(candidate.variant)) return 'équivalent';
  if (fam.substitution === 'non') return null;
  if (fam.substitution === 'interchangeable' && !exactVariant) return 'équivalent';
  return 'à confirmer';
}

/** Clé de la classe d'équivalence d'un produit (références qui se remplacent sans confirmation). */
export function equivalenceKey(p: Product, families: Map<ID, ProductFamily>): string {
  const fam = p.familyId ? families.get(p.familyId) : undefined;
  if (!fam) return p.id;
  if (fam.substitution === 'interchangeable') return `f:${fam.id}`;
  const v = normVariant(p.variant);
  return v ? `f:${fam.id}:${v}` : p.id;
}

/**
 * Un remplacement est permis s'il n'est interdit par aucun profil concerné et s'il n'introduit pas
 * une étiquette soumise à une limite (ex. huile) que le produit demandé n'avait pas.
 */
export function substituteAllowed(wanted: Product, candidate: Product, profiles: DietProfile[]): boolean {
  if (productForbiddenFor(candidate, profiles)) return false;
  for (const pr of profiles) {
    for (const r of pr.rules) {
      if (r.kind === 'limite' && r.limitTag && candidate.tags.includes(r.limitTag) && !wanted.tags.includes(r.limitTag)) return false;
    }
  }
  return true;
}

/**
 * Convertit une quantité exprimée dans l'unité d'un produit vers l'unité d'un autre produit.
 * Passe par les unités standard et par les conversions propres à chaque produit (1 barquette = 500 g).
 * Retourne `null` si aucune conversion fiable n'est connue : rien n'est jamais deviné.
 */
export function convertBetween(qty: number, from: Product, to: Product): number | null {
  if (from.unit === to.unit) return qty;
  const direct = convert(qty, from.unit, to.unit, to) ?? convert(qty, from.unit, to.unit, from);
  if (direct !== null) return direct;
  for (const base of ['g', 'ml', 'unité'] as Unit[]) {
    const a = convert(qty, from.unit, base, from);
    if (a === null) continue;
    const b = convert(a, base, to.unit, to);
    if (b !== null) return b;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Répartition du stock entre les besoins
// ---------------------------------------------------------------------------

export interface NeedInput {
  productId: ID;
  /** Quantité dans l'unité du produit demandé. */
  quantity: number;
  optional?: boolean;
  profileIds?: ID[];
  exactVariant?: boolean;
}

/** Stock d'une référence équivalente utilisé pour couvrir le besoin. */
export interface CoverUse {
  productId: ID;
  name: string;
  /** Quantité couverte, dans l'unité du produit demandé. */
  quantity: number;
  /** Quantité prélevée, dans l'unité de la référence utilisée. */
  sourceQuantity: number;
  sourceUnit: Unit;
}

/** Remplacement possible mais non compté : à confirmer par l'utilisateur. */
export interface CoverProposal {
  productId: ID;
  name: string;
  available: number | null;
  unit: Unit;
  why: 'à confirmer' | 'conversion inconnue' | 'stock inconnu';
}

export interface Coverage {
  productId: ID;
  need: number;
  unit: Unit;
  /** Stock utilisable du produit demandé (`null` : inconnu). */
  own: number | null;
  fromOwn: number;
  uses: CoverUse[];
  covered: number;
  shortfall: number;
  /** Stock du produit inconnu et besoin non couvert par une référence équivalente. */
  unknown: boolean;
  proposals: CoverProposal[];
}

export interface Allocation {
  coverage: Map<ID, Coverage>;
  /** Stock restant de chaque produit après les besoins (unité du produit, `null` : inconnu). */
  remaining: Map<ID, number | null>;
}

/**
 * Répartit le stock entre les besoins : chaque besoin utilise d'abord son propre produit, puis les références
 * équivalentes autorisées (celles qui expirent le plus tôt d'abord). Un même stock n'est jamais compté deux fois.
 */
export function allocateStock(
  needs: NeedInput[],
  products: Map<ID, Product>,
  families: Map<ID, ProductFamily>,
  profiles: Map<ID, DietProfile>,
  on: ISODate,
): Allocation {
  const pool = new Map<ID, number | null>();
  for (const p of products.values()) pool.set(p.id, usableQuantity(p, on));
  const coverage = new Map<ID, Coverage>();
  const ordered = [...needs]
    .filter((n) => n.quantity > 0 && products.has(n.productId))
    .sort((a, b) => Number(!!a.optional) - Number(!!b.optional) || a.productId.localeCompare(b.productId));

  // 1. Le produit demandé lui-même.
  for (const n of ordered) {
    const p = products.get(n.productId)!;
    const own = pool.get(p.id) ?? null;
    const fromOwn = own === null ? 0 : Math.min(own, n.quantity);
    if (own !== null) pool.set(p.id, roundNice(own - fromOwn));
    coverage.set(p.id, {
      productId: p.id, need: n.quantity, unit: p.unit, own, fromOwn, uses: [], covered: fromOwn,
      shortfall: roundNice(n.quantity - fromOwn), unknown: false, proposals: [],
    });
  }

  const profilesOf = (n: NeedInput) => (n.profileIds ?? []).map((id) => profiles.get(id)).filter((x): x is DietProfile => !!x);
  const candidates = (wanted: Product) =>
    [...products.values()].filter((c) => c.id !== wanted.id && !c.archived && c.familyId && c.familyId === wanted.familyId);

  // 2. Les références équivalentes.
  for (const n of ordered) {
    const c = coverage.get(n.productId)!;
    if (c.shortfall <= 1e-9) continue;
    const wanted = products.get(n.productId)!;
    const prof = profilesOf(n);
    const eq = candidates(wanted)
      .filter((x) => relation(wanted, x, families, n.exactVariant) === 'équivalent' && substituteAllowed(wanted, x, prof))
      .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999') || (pool.get(b.id) ?? 0) - (pool.get(a.id) ?? 0));
    for (const x of eq) {
      if (c.shortfall <= 1e-9) break;
      const avail = pool.get(x.id) ?? null;
      if (avail === null) {
        c.proposals.push({ productId: x.id, name: x.name, available: null, unit: x.unit, why: 'stock inconnu' });
        continue;
      }
      if (avail <= 0) continue;
      const needInX = convertBetween(c.shortfall, wanted, x);
      if (needInX === null) {
        c.proposals.push({ productId: x.id, name: x.name, available: avail, unit: x.unit, why: 'conversion inconnue' });
        continue;
      }
      const take = roundNice(Math.min(needInX, avail));
      const gained = roundNice(convertBetween(take, x, wanted) ?? (take / needInX) * c.shortfall);
      pool.set(x.id, roundNice(avail - take));
      c.uses.push({ productId: x.id, name: x.name, quantity: gained, sourceQuantity: take, sourceUnit: x.unit });
      c.covered = roundNice(c.covered + gained);
      c.shortfall = roundNice(Math.max(0, c.shortfall - gained));
    }
  }

  // 3. Les variantes à confirmer (proposées, jamais comptées).
  for (const n of ordered) {
    const c = coverage.get(n.productId)!;
    if (c.shortfall <= 1e-9) {
      c.proposals = [];
      continue;
    }
    const wanted = products.get(n.productId)!;
    const prof = profilesOf(n);
    for (const x of candidates(wanted)) {
      if (relation(wanted, x, families, n.exactVariant) !== 'à confirmer' || !substituteAllowed(wanted, x, prof)) continue;
      const avail = pool.get(x.id) ?? null;
      if (avail !== null && avail <= 0) continue;
      c.proposals.push({ productId: x.id, name: x.name, available: avail, unit: x.unit, why: 'à confirmer' });
    }
    c.unknown = c.own === null;
  }
  return { coverage, remaining: pool };
}

export function coverUseText(u: CoverUse): string {
  return `Couvert par ${u.name} : ${formatQty(u.sourceQuantity, u.sourceUnit)} (référence équivalente)`;
}

export function proposalText(p: CoverProposal): string {
  const stock = p.available === null ? 'quantité inconnue' : `${formatQty(p.available, p.unit)} en stock`;
  switch (p.why) {
    case 'conversion inconnue':
      return `${p.name} (${stock}) pourrait convenir, mais la correspondance des quantités n’est pas connue : à vérifier`;
    case 'stock inconnu':
      return `${p.name} pourrait couvrir ce besoin (quantité inconnue) : à vérifier`;
    default:
      return `À confirmer : ${p.name} (${stock}) pourrait remplacer ce produit`;
  }
}

// ---------------------------------------------------------------------------
// Stock global d'une famille
// ---------------------------------------------------------------------------

export interface FamilyStock {
  /** Totaux par unité (dans l'unité de la famille quand la conversion est connue). */
  totals: { quantity: number; unit: Unit }[];
  unknown: Product[];
  variants: Product[];
  text: string;
}

export function familyStock(family: ProductFamily, products: Product[]): FamilyStock {
  const variants = products.filter((p) => p.familyId === family.id && !p.archived);
  const buckets = new Map<Unit, number>();
  const unknown: Product[] = [];
  for (const p of variants) {
    if (p.quantity === null) {
      unknown.push(p);
      continue;
    }
    const inFamily = family.unit ? convert(p.quantity, p.unit, family.unit, p) : null;
    const unit = inFamily !== null && family.unit ? family.unit : p.unit;
    buckets.set(unit, roundNice((buckets.get(unit) ?? 0) + (inFamily ?? p.quantity)));
  }
  const totals = [...buckets.entries()].map(([unit, quantity]) => ({ unit, quantity }));
  const parts = totals.map((t) => formatQty(t.quantity, t.unit));
  let text = parts.join(' + ');
  if (unknown.length) text = text ? `${text} · ${unknown.length} inconnue${unknown.length > 1 ? 's' : ''}` : 'quantité inconnue';
  if (!text) text = 'aucune référence';
  return { totals, unknown, variants, text };
}
