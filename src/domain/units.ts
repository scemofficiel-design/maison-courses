import type { Product, Unit } from './types';

export const ALL_UNITS: Unit[] = [
  'unité', 'g', 'kg', 'ml', 'L', 'paquet', 'bouteille', 'boîte', 'pot', 'sac', 'douzaine',
  'botte', 'tête', 'tranche', 'rouleau', 'pain', 'morceau', 'c. à soupe', 'c. à café', 'pincée', 'bol',
];

/** Unités converties entre elles via une unité de base commune. */
const BASE: Partial<Record<Unit, { family: 'masse' | 'volume' | 'nombre'; factor: number }>> = {
  g: { family: 'masse', factor: 1 },
  kg: { family: 'masse', factor: 1000 },
  ml: { family: 'volume', factor: 1 },
  L: { family: 'volume', factor: 1000 },
  'c. à soupe': { family: 'volume', factor: 15 },
  'c. à café': { family: 'volume', factor: 5 },
  unité: { family: 'nombre', factor: 1 },
  douzaine: { family: 'nombre', factor: 12 },
};

export function unitFamily(unit: Unit): string {
  return BASE[unit]?.family ?? unit;
}

/**
 * Convertit une quantité d'une unité vers une autre.
 * Utilise d'abord les familles standard (g↔kg, ml↔L, unité↔douzaine),
 * puis les conversions propres au produit (ex. 1 paquet = 300 g).
 * Retourne `null` si aucune conversion fiable n'existe.
 */
export function convert(quantity: number, from: Unit, to: Unit, product?: Pick<Product, 'conversions'>): number | null {
  if (from === to) return quantity;
  const a = BASE[from];
  const b = BASE[to];
  if (a && b && a.family === b.family) return (quantity * a.factor) / b.factor;

  for (const c of product?.conversions ?? []) {
    // 1 c.unit = c.amount c.to
    if (c.unit === to) {
      const inTarget = convert(quantity, from, c.to);
      if (inTarget !== null) return inTarget / c.amount;
    }
    if (c.unit === from) {
      const inC = quantity * c.amount;
      const res = convert(inC, c.to, to);
      if (res !== null) return res;
    }
  }
  return null;
}

/** Unités vendues à la pièce : sans format de vente précisé, on achète des unités entières. */
const COUNT_UNITS: Unit[] = ['unité', 'douzaine', 'paquet', 'bouteille', 'boîte', 'pot', 'sac', 'botte', 'tête', 'tranche', 'rouleau', 'pain', 'morceau'];
export function saleStep(p: Pick<Product, 'unit' | 'purchaseStep'>): number | undefined {
  return p.purchaseStep ?? (COUNT_UNITS.includes(p.unit) ? 1 : undefined);
}

/** Arrondit vers le haut au multiple du format de vente (avec tolérance numérique). */
export function roundUpToStep(quantity: number, step?: number): number {
  if (quantity <= 0) return 0;
  if (!step || step <= 0) return roundNice(quantity);
  const n = Math.ceil(quantity / step - 1e-9);
  return roundNice(n * step);
}

export function roundNice(n: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

const nf = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 });

export function formatQty(quantity: number | null | undefined, unit: Unit): string {
  if (quantity === null || quantity === undefined) return 'quantité inconnue';
  // Présentation lisible : 1200 g → 1,2 kg ; 1500 ml → 1,5 L
  if (unit === 'g' && quantity >= 1000) return `${nf.format(quantity / 1000)} kg`;
  if (unit === 'ml' && quantity >= 1000) return `${nf.format(quantity / 1000)} L`;
  return `${nf.format(quantity)} ${unitLabel(unit, quantity)}`;
}

export function unitLabel(unit: Unit, quantity = 1): string {
  const plural = Math.abs(quantity) >= 2;
  if (!plural) return unit;
  switch (unit) {
    case 'unité': return 'unités';
    case 'paquet': return 'paquets';
    case 'bouteille': return 'bouteilles';
    case 'boîte': return 'boîtes';
    case 'pot': return 'pots';
    case 'sac': return 'sacs';
    case 'douzaine': return 'douzaines';
    case 'botte': return 'bottes';
    case 'tête': return 'têtes';
    case 'tranche': return 'tranches';
    case 'rouleau': return 'rouleaux';
    case 'pain': return 'pains';
    case 'morceau': return 'morceaux';
    case 'bol': return 'bols';
    case 'pincée': return 'pincées';
    default: return unit;
  }
}

/** Boutons rapides adaptés à l'unité du produit. */
export function quickSteps(unit: Unit): number[] {
  switch (unit) {
    case 'g': return [100, 500];
    case 'kg': return [0.1, 0.5];
    case 'ml': return [100, 250];
    case 'L': return [0.25, 1];
    default: return [1];
  }
}

const money = new Map<string, Intl.NumberFormat>();
export function formatMoney(amount: number | null | undefined, currency = 'CAD'): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  let f = money.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('fr-CA', { style: 'currency', currency });
    money.set(currency, f);
  }
  return f.format(amount);
}

/** Lit un nombre saisi en français (virgule ou point). Retourne null si vide ou invalide. */
export function parseNumber(input: string): number | null {
  const s = input.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
