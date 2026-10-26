import { expiryLevel, usableQuantity } from './stock';
import { aggregateRequirements, mealRequirements, type Diner } from './portions';
import { checkMealForProfiles, type Violation } from './restrictions';
import type { ID, ISODate, MealSlot, Product, Recipe, Unit } from './types';
import { round2, roundUpToStep, saleStep } from './units';

export interface FeasibilityItem {
  productId: ID;
  name: string;
  need: number;
  have: number | null;
  missing: number;
  unit: Unit;
  optional: boolean;
  extraCost?: number;
}

export interface Feasibility {
  title: string;
  recipeIds: ID[];
  available: FeasibilityItem[];
  missing: FeasibilityItem[];
  unknown: FeasibilityItem[];
  /** Part des ingrédients non facultatifs entièrement disponibles (0 à 1). */
  coverage: number;
  extraCost: number;
  minutes: number;
  violations: Violation[];
  /** Produits à consommer en priorité (péremption proche) utilisés par ce repas. */
  priorityProducts: string[];
  /** Explication lisible de la suggestion. */
  why: string[];
  unconvertible: number;
}

export function mealFeasibility(
  title: string,
  recipes: Recipe[],
  diners: Diner[],
  slot: MealSlot,
  products: Map<ID, Product>,
  on: ISODate,
  warningDays: number,
): Feasibility {
  const reqs = mealRequirements(recipes, diners, slot, title);
  const { needs, unconverted } = aggregateRequirements(reqs, products);
  const available: FeasibilityItem[] = [];
  const missing: FeasibilityItem[] = [];
  const unknown: FeasibilityItem[] = [];
  const priorityProducts: string[] = [];
  let extraCost = 0;
  let required = 0;
  let okRequired = 0;
  for (const n of needs.values()) {
    const p = products.get(n.productId)!;
    const have = usableQuantity(p, on);
    const item: FeasibilityItem = { productId: p.id, name: p.name, need: n.quantity, have, missing: 0, unit: p.unit, optional: n.optional };
    if (!n.optional) required++;
    if (expiryLevel(p, on, warningDays) === 'bientôt' && (have ?? 0) > 0) priorityProducts.push(p.name);
    if (have === null) {
      unknown.push(item);
    } else if (have + 1e-9 >= n.quantity) {
      available.push(item);
      if (!n.optional) okRequired++;
    } else {
      item.missing = round2(n.quantity - have);
      if (p.unitPrice !== undefined) {
        item.extraCost = round2(roundUpToStep(item.missing, saleStep(p)) * p.unitPrice);
        if (!n.optional) extraCost += item.extraCost;
      }
      missing.push(item);
    }
  }
  const profiles = uniqueProfiles(diners);
  const violations = checkMealForProfiles(recipes, profiles, products);
  const coverage = required === 0 ? 1 : okRequired / required;
  const why: string[] = [];
  if (missing.filter((m) => !m.optional).length === 0 && unknown.length === 0) why.push('Tout est disponible dans les stocks');
  else if (coverage >= 0.5) why.push(`${okRequired} ingrédient(s) sur ${required} déjà disponibles`);
  if (priorityProducts.length) why.push(`Utilise des produits à consommer vite : ${priorityProducts.join(', ')}`);
  if (unknown.length) why.push(`Stock inconnu pour : ${unknown.map((u) => u.name).join(', ')}`);
  return {
    title,
    recipeIds: recipes.map((r) => r.id),
    available,
    missing,
    unknown,
    coverage,
    extraCost: round2(extraCost),
    minutes: maxMinutes(recipes),
    violations,
    priorityProducts,
    why,
    unconvertible: unconverted.length,
  };
}

/** Les éléments d'un repas se préparent en parallèle : on retient la recette la plus longue. */
function maxMinutes(recipes: Recipe[]): number {
  return recipes.reduce((m, r) => Math.max(m, r.prepMinutes + r.cookMinutes), 0);
}

export function uniqueProfiles(diners: Diner[]) {
  const seen = new Map<ID, Diner['profiles'][number]>();
  for (const d of diners) for (const p of d.profiles) seen.set(p.id, p);
  return [...seen.values()];
}

export type SuggestionFilter = 'rapide' | 'économique' | 'priorité' | 'stock seul' | 'famille' | 'tous';

/** Classe les suggestions : compatibles d'abord, puis meilleure couverture du stock, produits prioritaires, coût. */
export function rankSuggestions(list: Feasibility[], filter: SuggestionFilter = 'tous'): Feasibility[] {
  let res = list.filter((f) => f.violations.length === 0);
  switch (filter) {
    case 'rapide':
      res = res.filter((f) => f.minutes > 0 && f.minutes <= 20);
      break;
    case 'économique':
      res = res.filter((f) => f.extraCost <= 5);
      break;
    case 'priorité':
      res = res.filter((f) => f.priorityProducts.length > 0);
      break;
    case 'stock seul':
      res = res.filter((f) => f.missing.every((m) => m.optional) && f.unknown.length === 0);
      break;
    default:
      break;
  }
  return res.sort(
    (a, b) =>
      b.coverage - a.coverage ||
      b.priorityProducts.length - a.priorityProducts.length ||
      a.extraCost - b.extraCost ||
      a.minutes - b.minutes,
  );
}
