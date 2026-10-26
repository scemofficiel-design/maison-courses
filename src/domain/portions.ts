import type { DietProfile, ID, IngredientRole, MealSlot, Product, Recipe, RecipeIngredient, Unit } from './types';
import { convert, roundNice } from './units';

/** Une personne attablée et ses profils alimentaires actifs. */
export interface Diner {
  personId: ID;
  name: string;
  profiles: DietProfile[];
}

export interface Requirement {
  productId: ID;
  quantity: number;
  unit: Unit;
  optional: boolean;
  /** Repas ou recettes à l'origine du besoin. */
  sources: string[];
}

/** Multiplicateur de portion d'une personne pour un rôle (le plus élevé de ses profils, 1 par défaut). */
export function portionFactor(diner: Diner, role: IngredientRole): number {
  let f: number | undefined;
  for (const p of diner.profiles) {
    const v = p.portionFactors?.[role];
    if (v !== undefined) f = f === undefined ? v : Math.max(f, v);
  }
  return f ?? 1;
}

/**
 * Mise à l'échelle d'une quantité.
 * - linéaire : proportionnelle au nombre de portions ;
 * - fixe : ne change pas (ex. 1 feuille de laurier) ;
 * - modéré : pour le sel, les épices et assaisonnements, croissance en racine carrée
 *   (doubler les portions multiplie l'assaisonnement par ≈1,4), à ajuster au goût.
 */
export function scaleQuantity(qty: number, mode: RecipeIngredient['scaling'], ratio: number): number {
  if (ratio <= 0) return 0;
  switch (mode) {
    case 'fixe':
      return qty;
    case 'modéré':
      return qty * Math.sqrt(ratio);
    default:
      return qty * ratio;
  }
}

/** Ingrédients d'une recette mise à l'échelle pour un nombre de portions donné (calculateur simple). */
export function scaleRecipe(recipe: Recipe, servings: number): RecipeIngredient[] {
  const ratio = servings / recipe.servings;
  return recipe.ingredients
    .filter((i) => !i.onlyForProfileIds?.length)
    .map((i) => ({ ...i, quantity: roundNice(scaleQuantity(i.quantity, i.scaling, ratio), 2) }));
}

function dinerHasProfile(d: Diner, ids: ID[]): boolean {
  return d.profiles.some((p) => ids.includes(p.id));
}

/**
 * Besoins en ingrédients d'un repas pour les personnes attablées.
 * Le plat commun est calculé à partir des multiplicateurs de portion de chacun ;
 * les ajouts individuels (ingrédients réservés à un profil, ajouts à l'assiette) sont comptés par personne.
 */
export function mealRequirements(
  recipes: Recipe[],
  diners: Diner[],
  slot: MealSlot,
  label: string,
): Requirement[] {
  const out: Requirement[] = [];
  if (diners.length === 0) return out;
  for (const r of recipes) {
    for (const ing of r.ingredients) {
      if (ing.toTaste) continue;
      let qty: number;
      if (ing.onlyForProfileIds?.length) {
        const n = diners.filter((d) => dinerHasProfile(d, ing.onlyForProfileIds!)).length;
        if (n === 0) continue;
        qty = ing.quantity * n;
      } else {
        const servings = diners.reduce((s, d) => s + portionFactor(d, ing.role), 0);
        qty = scaleQuantity(ing.quantity, ing.scaling, servings / r.servings);
      }
      out.push({ productId: ing.productId, quantity: qty, unit: ing.unit, optional: !!ing.optional, sources: [`${label} — ${r.name}`] });
    }
  }
  for (const d of diners) {
    for (const p of d.profiles) {
      for (const a of p.plateAdditions ?? []) {
        if (a.slot !== slot) continue;
        out.push({ productId: a.productId, quantity: a.quantity, unit: a.unit, optional: false, sources: [`${label} — ${a.label} (${d.name})`] });
      }
    }
  }
  return out;
}

export interface AggregatedNeed {
  productId: ID;
  /** Quantité dans l'unité du produit. */
  quantity: number;
  unit: Unit;
  optional: boolean;
  sources: string[];
}

export interface AggregationResult {
  needs: Map<ID, AggregatedNeed>;
  /** Besoins impossibles à convertir dans l'unité du produit (signalés, jamais ignorés silencieusement). */
  unconverted: Requirement[];
}

/** Regroupe les besoins par produit (un seul total par ingrédient) en les convertissant dans l'unité du produit. */
export function aggregateRequirements(reqs: Requirement[], products: Map<ID, Product>): AggregationResult {
  const needs = new Map<ID, AggregatedNeed>();
  const unconverted: Requirement[] = [];
  for (const r of reqs) {
    const p = products.get(r.productId);
    if (!p) {
      unconverted.push(r);
      continue;
    }
    const q = convert(r.quantity, r.unit, p.unit, p);
    if (q === null) {
      unconverted.push(r);
      continue;
    }
    const prev = needs.get(p.id);
    if (prev) {
      prev.quantity += q;
      prev.optional = prev.optional && r.optional;
      for (const s of r.sources) if (!prev.sources.includes(s)) prev.sources.push(s);
    } else {
      needs.set(p.id, { productId: p.id, quantity: q, unit: p.unit, optional: r.optional, sources: [...r.sources] });
    }
  }
  for (const n of needs.values()) n.quantity = roundNice(n.quantity);
  return { needs, unconverted };
}
