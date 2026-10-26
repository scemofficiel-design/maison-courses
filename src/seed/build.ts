import type {
  Budget, Category, DietProfile, Location, MealPlan, Person, Product, Recipe, ShoppingLine, ShoppingList, Substitution, TemplateMeal,
} from '../domain/types';
import { CATEGORIES, LOCATIONS, PRODUCTS, ROW_PRODUCT, parseDocQuantity } from './catalog';
import {
  BREAKFASTS, BUDGET_ECONOMY, BUDGET_ECONOMY_TOTAL, BUDGET_TARGET, BUDGET_TARGET_TOTAL, DOCUMENT_NAME, ECONOMY_DEFINITION, HYPOTHESES,
  MENU_WEEKS, OPTIMIZATION_PRINCIPLES, PAGE1_FOOTNOTE, PAGE1_PRINCIPLE, SHOPPING_ROWS, SNACKS_TEXT, WATER_TEXT,
} from './planDocument';
import { PERSONS, PROFILES } from './profiles';
import { BREAKFAST_RECIPE, MENU_ITEM_RECIPE, PROFILE_GM, PROFILE_MOI, PROFILE_NOUS, RECIPES } from './recipes';

/** Version des données initiales. L'augmenter lorsque les données de démonstration changent. */
export const SEED_VERSION = 1;

export const FAMILY_PLAN_ID = 'plan-famille-gm';
export const FAMILY_PLAN_NAME = 'Plan familial — 8 semaines avec grand-mère';

export interface SeedData {
  categories: Category[];
  locations: Location[];
  products: Product[];
  recipes: Recipe[];
  profiles: DietProfile[];
  persons: Person[];
  plans: MealPlan[];
  lists: ShoppingList[];
  lines: ShoppingLine[];
  budgets: Budget[];
  substitutions: Substitution[];
}

/** Découpe « Riz · sauce claire · tilapia au four » et relie chaque élément à une recette. */
export function menuItemsToRecipes(title: string): { recipeIds: string[]; unmapped: string[] } {
  const recipeIds: string[] = [];
  const unmapped: string[] = [];
  for (const raw of title.split('·')) {
    const key = raw.trim().toLowerCase();
    const id = MENU_ITEM_RECIPE[key];
    if (id) recipeIds.push(id);
    else unmapped.push(raw.trim());
  }
  return { recipeIds, unmapped };
}

function buildTemplate(): TemplateMeal[] {
  const out: TemplateMeal[] = [];
  MENU_WEEKS.forEach((week, w) => {
    week.forEach(([midi, soir], d) => {
      const b = BREAKFASTS.find((x) => x.days.includes(d))!;
      out.push({ week: w + 1, weekday: d, slot: 'petit-déjeuner', title: b.common, recipeIds: [BREAKFAST_RECIPE[b.common]], notes: `+ 1 fruit pour tous. GM : ${b.gm}. Nous : ${b.nous}` });
      out.push({ week: w + 1, weekday: d, slot: 'collation-matin', title: 'Collation de 10 h', recipeIds: [], notes: SNACKS_TEXT });
      out.push({ week: w + 1, weekday: d, slot: 'déjeuner', title: midi, recipeIds: menuItemsToRecipes(midi).recipeIds, notes: 'Repas commun : même plat, portions adaptées.' });
      out.push({ week: w + 1, weekday: d, slot: 'collation-après-midi', title: 'Collation de 16 h', recipeIds: [], notes: SNACKS_TEXT });
      out.push({ week: w + 1, weekday: d, slot: 'dîner', title: soir, recipeIds: menuItemsToRecipes(soir).recipeIds, notes: 'GM : mêmes légumes et même protéine avec 1/3 de pain complet. Nous : reste de féculent du midi ou une patate douce.' });
    });
  });
  return out;
}

export function buildSeed(now: string): SeedData {
  const stamp = { createdAt: now, updatedAt: now };
  const categories: Category[] = CATEGORIES.map((c, order) => ({ ...c, ...stamp, order, seedKey: `category:${c.id}` }));
  const locations: Location[] = LOCATIONS.map((l, order) => ({ ...l, ...stamp, order, seedKey: `location:${l.id}` }));
  const products: Product[] = PRODUCTS.map((p) => ({
    ...p,
    ...stamp,
    seedKey: `product:${p.id}`,
    // Le document ne contient aucun inventaire : la quantité est inconnue, et non nulle.
    quantity: null,
    currency: 'CAD',
    priceStatus: p.unitPrice !== undefined ? 'document' : undefined,
  }));
  const recipes: Recipe[] = RECIPES.map((r) => ({ ...r, ...stamp }));
  const profiles: DietProfile[] = PROFILES.map((p) => ({ ...p, ...stamp }));
  const persons: Person[] = PERSONS.map((p) => ({ ...p, ...stamp }));

  const plan: MealPlan = {
    id: FAMILY_PLAN_ID,
    seedKey: `plan:${FAMILY_PLAN_ID}`,
    ...stamp,
    name: FAMILY_PLAN_NAME,
    description: `Configuration importée du document « ${DOCUMENT_NAME} » : 3 personnes, 8 semaines, courses toutes les 2 semaines.`,
    active: true,
    temporary: true,
    durationWeeks: 8,
    members: [
      { personId: 'person-gm', profileIds: [PROFILE_GM] },
      { personId: 'person-moi', profileIds: [PROFILE_NOUS, PROFILE_MOI] },
      { personId: 'person-mere', profileIds: [PROFILE_NOUS] },
    ],
    principles: [PAGE1_PRINCIPLE, PAGE1_FOOTNOTE, `${SNACKS_TEXT} ${WATER_TEXT}`, ...OPTIMIZATION_PRINCIPLES, `Hypothèses du document : ${HYPOTHESES}`],
    templateMeals: buildTemplate(),
    periods: [
      { index: 1, label: 'P1', weeks: [1, 2] },
      { index: 2, label: 'P2', weeks: [3, 4] },
      { index: 3, label: 'P3', weeks: [5, 6] },
      { index: 4, label: 'P4', weeks: [7, 8] },
    ],
    materialized: false,
  };

  const productById = new Map(products.map((p) => [p.id, p]));
  const lists: ShoppingList[] = [];
  const lines: ShoppingLine[] = [];
  for (let k = 0; k < 4; k++) {
    const listId = `list-p${k + 1}`;
    lists.push({
      id: listId,
      seedKey: `list:${listId}`,
      ...stamp,
      name: `P${k + 1} — semaines ${2 * k + 1} et ${2 * k + 2}`,
      budget: BUDGET_TARGET[k],
      currency: 'CAD',
      status: 'à préparer',
      planId: FAMILY_PLAN_ID,
      periodIndex: k + 1,
      notes: 'Liste importée du document (3 personnes, 2 semaines). Prix : estimations historiques du document, non vérifiées en magasin. Vérifiez vos placards avant de partir : ne rien racheter s’il en reste.',
    });
    SHOPPING_ROWS.forEach((row, order) => {
      const qty = parseDocQuantity(row.qty[k]);
      if (qty === null) return;
      const productId = ROW_PRODUCT[row.label];
      const p = productById.get(productId)!;
      lines.push({
        id: `line-p${k + 1}-${productId}`,
        seedKey: `line:p${k + 1}:${productId}`,
        ...stamp,
        listId,
        productId,
        name: row.label,
        categoryId: p.categoryId,
        quantity: qty,
        unit: p.unit,
        quantityLabel: row.qty[k],
        estUnitPrice: p.unitPrice,
        estTotal: row.price[k] ?? undefined,
        priceStatus: 'document',
        status: 'à acheter',
        priority: row.prio === 'E' ? 'essentiel' : 'optionnel',
        source: 'document',
        reasons: [`Liste du document, période P${k + 1}${row.estimatedStar ? ' (prix estimé : produit absent de la liste de référence)' : ''}`],
        order,
      });
    });
  }

  const budgets: Budget[] = [];
  for (let k = 0; k < 4; k++) {
    budgets.push({ id: `budget-p${k + 1}-cible`, seedKey: `budget:p${k + 1}:cible`, ...stamp, name: `P${k + 1} — budget cible (liste complète)`, amount: BUDGET_TARGET[k], currency: 'CAD', kind: 'cible', planId: FAMILY_PLAN_ID, periodIndex: k + 1, source: 'Plan PDF p. 2' });
    budgets.push({ id: `budget-p${k + 1}-eco`, seedKey: `budget:p${k + 1}:eco`, ...stamp, name: `P${k + 1} — version économique`, amount: BUDGET_ECONOMY[k], currency: 'CAD', kind: 'économique', planId: FAMILY_PLAN_ID, periodIndex: k + 1, source: `Plan PDF p. 2 — ${ECONOMY_DEFINITION}` });
  }
  budgets.push({ id: 'budget-total-cible', seedKey: 'budget:total:cible', ...stamp, name: 'Total 8 semaines — budget cible', amount: BUDGET_TARGET_TOTAL, currency: 'CAD', kind: 'cible', planId: FAMILY_PLAN_ID, source: 'Plan PDF p. 2 et 3' });
  budgets.push({ id: 'budget-total-eco', seedKey: 'budget:total:eco', ...stamp, name: 'Total 8 semaines — version économique', amount: BUDGET_ECONOMY_TOTAL, currency: 'CAD', kind: 'économique', planId: FAMILY_PLAN_ID, source: 'Plan PDF p. 2 et 3' });

  const S = 'Plan PDF p. 3';
  const substitutions: Substitution[] = [
    { id: 'sub-maquereau', fromLabel: 'Maquereau (poisson gras)', toLabel: 'Tilapia', toProductId: 'p-tilapia', reason: 'Retiré du plat commun pour GM', source: S },
    { id: 'sub-conserves', fromLabel: 'Thon, champignons, haricots rouges en boîte', toLabel: 'Haricots secs cuits à la maison', fromProductId: 'p-thon', toProductId: 'p-haricots-secs', reason: 'Conserves à éviter pour GM', source: S },
    { id: 'sub-lentilles', fromLabel: 'Lentilles (vendredi soir du menu du diététicien)', toLabel: 'Haricots secs', fromProductId: 'p-lentilles', toProductId: 'p-haricots-secs', reason: 'Lentilles absentes des aliments autorisés : à confirmer', source: S },
    { id: 'sub-eco-oeufs', fromLabel: 'Poulet des lundis et samedis soir', toLabel: 'Œufs durs', fromProductId: 'p-poulet', toProductId: 'p-oeufs', reason: 'Version économique', economy: true, source: S },
    { id: 'sub-eco-optionnels', fromLabel: 'Optionnels (poires, mangues, fromage blanc, noix, graines, thon, lentilles, épices extra, piment, soya, vinaigre)', toLabel: 'Supprimer', reason: '30,02 $ par période en moyenne ; 40,52 $ en P1 ; 120,08 $ sur 8 semaines', economy: true, source: S },
    { id: 'sub-eco-surgeles', fromLabel: 'Haricots verts et brocoli frais', toLabel: 'Légumes surgelés', fromProductId: 'p-haricots-verts', reason: 'Levier d’économie non chiffré tant que les prix ne sont pas vérifiés', economy: true, source: S },
    { id: 'sub-eco-poulet', fromLabel: 'Poulet en petit format', toLabel: 'Cuisses de poulet en format familial', fromProductId: 'p-poulet', reason: 'Si le prix au kilo est inférieur à 8,50 $ (non chiffré)', economy: true, source: S },
    { id: 'sub-eco-yaourt', fromLabel: 'Petits pots de yaourt', toLabel: 'Yaourt nature en pot de 750 g', toProductId: 'p-yaourt', reason: 'Levier d’économie non chiffré', economy: true, source: S },
  ].map((s) => ({ ...s, ...stamp, seedKey: `substitution:${s.id}` }));

  return { categories, locations, products, recipes, profiles, persons, plans: [plan], lists, lines, budgets, substitutions };
}
