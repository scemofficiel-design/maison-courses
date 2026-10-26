import type { DietProfile, DietRule, ID, Product, Recipe } from './types';
import { convert } from './units';

export interface Violation {
  profileId: ID;
  profileName: string;
  rule: DietRule;
  message: string;
}

/** Ingrédients qui finissent dans l'assiette des personnes ayant ce profil. */
function ingredientsForProfile(recipe: Recipe, profileId: ID) {
  return recipe.ingredients.filter((i) => !i.onlyForProfileIds?.length || i.onlyForProfileIds.includes(profileId));
}

/**
 * Vérifie un repas (une ou plusieurs recettes servies ensemble) au regard d'un profil.
 * Un repas est incompatible dès qu'une règle « éviter », « cuisson » ou « limite » par repas est enfreinte.
 * Les ingrédients facultatifs sont ignorés : ils peuvent être retirés de l'assiette.
 */
export function checkMeal(recipes: Recipe[], profile: DietProfile, products: Map<ID, Product>): Violation[] {
  const out: Violation[] = [];
  for (const rule of profile.rules) {
    if (rule.kind === 'éviter' && rule.tags?.length) {
      for (const r of recipes) {
        for (const ing of ingredientsForProfile(r, profile.id)) {
          if (ing.optional) continue;
          const p = products.get(ing.productId);
          const hit = p?.tags.find((t) => rule.tags!.includes(t));
          if (p && hit) {
            out.push({ profileId: profile.id, profileName: profile.name, rule, message: `${r.name} contient ${p.name} (${rule.label})` });
          }
        }
      }
    }
    if (rule.kind === 'cuisson' && rule.allowedMethods?.length) {
      for (const r of recipes) {
        const bad = r.cookingMethods.filter((m) => !rule.allowedMethods!.includes(m));
        if (bad.length) {
          out.push({ profileId: profile.id, profileName: profile.name, rule, message: `${r.name} : cuisson « ${bad.join(', ')} » non prévue (${rule.label})` });
        }
      }
    }
    if (rule.kind === 'limite' && rule.per === 'repas' && rule.limitTag && rule.max !== undefined && rule.unit) {
      let total = 0;
      for (const r of recipes) {
        for (const ing of ingredientsForProfile(r, profile.id)) {
          if (ing.optional) continue;
          const p = products.get(ing.productId);
          if (!p?.tags.includes(rule.limitTag)) continue;
          // Ramené aux portions de référence de la recette : le plafond s'applique au plat commun.
          total += convert(ing.quantity, ing.unit, rule.unit, p) ?? 0;
        }
      }
      if (total > rule.max + 1e-9) {
        out.push({ profileId: profile.id, profileName: profile.name, rule, message: `${total} ${rule.unit} prévus pour ce repas, plafond ${rule.max} ${rule.unit} (${rule.label})` });
      }
    }
  }
  return out;
}

export function checkMealForProfiles(recipes: Recipe[], profiles: DietProfile[], products: Map<ID, Product>): Violation[] {
  return profiles.flatMap((p) => checkMeal(recipes, p, products));
}

/** Vrai si un produit est interdit par au moins une règle « éviter » des profils donnés. */
export function productForbiddenFor(product: Product, profiles: DietProfile[]): DietRule | undefined {
  for (const pr of profiles) {
    for (const rule of pr.rules) {
      if (rule.kind === 'éviter' && rule.tags?.some((t) => product.tags.includes(t))) return rule;
    }
  }
  return undefined;
}
