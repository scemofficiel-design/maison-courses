import { checkMeal } from '../domain/restrictions';
import type { Product } from '../domain/types';
import { round2 } from '../domain/units';
import { ROW_PRODUCT } from './catalog';
import { menuItemsToRecipes, type SeedData } from './build';
import {
  BUDGET_ECONOMY, BUDGET_ECONOMY_TOTAL, BUDGET_SUMMARY, BUDGET_TARGET, BUDGET_TARGET_TOTAL, GROUP_SUBTOTALS, MENU_WEEKS, SHOPPING_ROWS, type DocGroup,
} from './planDocument';
import { PROFILE_GM } from './recipes';

export interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

export interface VerificationReport {
  checks: Check[];
  /** Données ambiguës, interprétées ou non importées : affichées telles quelles à l'utilisateur. */
  notes: string[];
}

const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** Vérifie que les données initiales reproduisent fidèlement le document. */
export function verifySeed(seed: SeedData): VerificationReport {
  const checks: Check[] = [];
  const notes: string[] = [];
  const plan = seed.plans[0];
  const tm = plan.templateMeals;

  // 1. Huit semaines de menus
  const weeks = new Set(tm.map((m) => m.week));
  const mains = tm.filter((m) => m.slot === 'déjeuner' || m.slot === 'dîner');
  const breakfasts = tm.filter((m) => m.slot === 'petit-déjeuner');
  const snacks = tm.filter((m) => m.slot.startsWith('collation'));
  checks.push({ label: 'Huit semaines de menus', ok: weeks.size === 8 && MENU_WEEKS.length === 8, detail: `${weeks.size} semaines` });
  checks.push({ label: 'Déjeuners et dîners (8 × 7 × 2)', ok: mains.length === 112, detail: `${mains.length} repas` });
  checks.push({ label: 'Petits-déjeuners (8 × 7)', ok: breakfasts.length === 56, detail: `${breakfasts.length} petits-déjeuners` });
  checks.push({ label: 'Collations de 10 h et 16 h', ok: snacks.length === 112, detail: `${snacks.length} collations` });
  const titlesMatch = MENU_WEEKS.every((w, wi) => w.every(([m, s], d) =>
    tm.some((x) => x.week === wi + 1 && x.weekday === d && x.slot === 'déjeuner' && x.title === m) &&
    tm.some((x) => x.week === wi + 1 && x.weekday === d && x.slot === 'dîner' && x.title === s)));
  checks.push({ label: 'Libellés des menus identiques au document', ok: titlesMatch, detail: titlesMatch ? 'Tous les libellés sont repris tels quels' : 'Écart détecté' });

  // 2. Périodes de courses
  checks.push({ label: 'Quatre périodes de courses (P1 à P4)', ok: plan.periods.length === 4 && seed.lists.length === 4, detail: `${plan.periods.length} périodes, ${seed.lists.length} listes` });

  // 3. Quantités et budgets
  for (let k = 0; k < 4; k++) {
    const lines = seed.lines.filter((l) => l.listId === `list-p${k + 1}`);
    const sum = round2(lines.reduce((s, l) => s + (l.estTotal ?? 0), 0));
    checks.push({ label: `Budget P${k + 1} = ${BUDGET_TARGET[k].toFixed(2)} $`, ok: eq(sum, BUDGET_TARGET[k]), detail: `Somme des lignes : ${sum.toFixed(2)} $ (${lines.length} lignes)` });
    for (const [g, sub] of Object.entries(GROUP_SUBTOTALS) as [DocGroup, number[]][]) {
      const s = round2(SHOPPING_ROWS.filter((r) => r.group === g).reduce((acc, r) => acc + (r.price[k] ?? 0), 0));
      if (!eq(s, sub[k])) checks.push({ label: `Sous-total ${g} P${k + 1}`, ok: false, detail: `${s} au lieu de ${sub[k]}` });
    }
    const docLines = SHOPPING_ROWS.filter((r) => r.qty[k] !== '-').length;
    if (docLines !== lines.length) checks.push({ label: `Lignes P${k + 1}`, ok: false, detail: `${lines.length} importées sur ${docLines}` });
  }
  checks.push({ label: 'Sous-totaux par catégorie conformes au document', ok: !checks.some((c) => c.label.startsWith('Sous-total')), detail: '7 catégories × 4 périodes' });
  const total = round2(seed.lines.reduce((s, l) => s + (l.estTotal ?? 0), 0));
  checks.push({ label: `Total cible 8 semaines = ${BUDGET_TARGET_TOTAL.toFixed(2)} $`, ok: eq(total, BUDGET_TARGET_TOTAL), detail: `${total.toFixed(2)} $` });
  const ecoSum = round2(BUDGET_ECONOMY.reduce((a, b) => a + b, 0));
  checks.push({ label: `Version économique = ${BUDGET_ECONOMY_TOTAL.toFixed(2)} $`, ok: eq(ecoSum, BUDGET_ECONOMY_TOTAL), detail: `Somme P1–P4 : ${ecoSum.toFixed(2)} $` });
  const optP1 = round2(seed.lines.filter((l) => l.listId === 'list-p1' && l.priority === 'optionnel').reduce((s, l) => s + (l.estTotal ?? 0), 0));
  checks.push({ label: 'Optionnels P1 = 40,52 $', ok: eq(optP1, BUDGET_SUMMARY.optionalRemovable.p1), detail: `${optP1.toFixed(2)} $` });
  const optAll = round2(seed.lines.filter((l) => l.priority === 'optionnel').reduce((s, l) => s + (l.estTotal ?? 0), 0));
  checks.push({ label: 'Optionnels 8 semaines = 120,08 $', ok: eq(optAll, BUDGET_SUMMARY.optionalRemovable.total), detail: `${optAll.toFixed(2)} $` });
  checks.push({ label: 'Moyenne par période = 466,74 $', ok: eq(round2(total / 4), BUDGET_SUMMARY.target.perPeriod), detail: `${(total / 4).toFixed(3)} $` });
  checks.push({ label: 'Économie de la version économique = 177,78 $', ok: eq(round2(BUDGET_TARGET_TOTAL - BUDGET_ECONOMY_TOTAL), BUDGET_SUMMARY.economySaving), detail: `${(BUDGET_TARGET_TOTAL - BUDGET_ECONOMY_TOTAL).toFixed(2)} $` });

  // 4. Unités et catégories
  const products = new Map<string, Product>(seed.products.map((p) => [p.id, p]));
  const catIds = new Set(seed.categories.map((c) => c.id));
  const badLines = seed.lines.filter((l) => !l.productId || !products.has(l.productId) || !catIds.has(l.categoryId ?? '') || !(l.quantity > 0));
  checks.push({ label: 'Unités, quantités et catégories des lignes', ok: badLines.length === 0, detail: badLines.length ? badLines.map((l) => l.name).join(', ') : `${seed.lines.length} lignes valides` });
  const unmappedRows = SHOPPING_ROWS.filter((r) => !ROW_PRODUCT[r.label]);
  checks.push({ label: 'Chaque produit du document est relié au catalogue', ok: unmappedRows.length === 0, detail: unmappedRows.length ? unmappedRows.map((r) => r.label).join(', ') : `${SHOPPING_ROWS.length} produits` });

  // 5. Correspondance menus ↔ recettes ↔ ingrédients
  const recipeIds = new Set(seed.recipes.map((r) => r.id));
  const unmapped = new Set<string>();
  for (const w of MENU_WEEKS) for (const day of w) for (const t of day) menuItemsToRecipes(t).unmapped.forEach((u) => unmapped.add(u));
  checks.push({ label: 'Chaque élément des menus est relié à une recette', ok: unmapped.size === 0, detail: unmapped.size ? [...unmapped].join(', ') : 'Tous les éléments sont reliés' });
  const missingRecipe = tm.flatMap((m) => m.recipeIds).filter((id) => !recipeIds.has(id));
  const missingProduct = seed.recipes.flatMap((r) => r.ingredients.filter((i) => !products.has(i.productId)).map((i) => `${r.name} → ${i.productId}`));
  checks.push({ label: 'Recettes et ingrédients existants', ok: missingRecipe.length === 0 && missingProduct.length === 0, detail: [...missingRecipe, ...missingProduct].join(', ') || 'OK' });
  const listed = new Set(seed.lines.map((l) => l.productId));
  const usedInPlan = new Set<string>();
  for (const m of tm) for (const id of m.recipeIds) seed.recipes.find((r) => r.id === id)?.ingredients.forEach((i) => usedInPlan.add(i.productId));
  const notListed = [...usedInPlan].filter((p) => !listed.has(p));
  checks.push({ label: 'Ingrédients des menus présents dans les listes du document', ok: notListed.length === 0, detail: notListed.length ? notListed.map((p) => products.get(p)?.name).join(', ') : 'Tous présents' });

  // 6. Règles et portions
  const gm = seed.profiles.find((p) => p.id === PROFILE_GM)!;
  const avoid = gm.rules.filter((r) => r.kind === 'éviter').length;
  const portions = gm.portionRules.length;
  checks.push({ label: 'Règles de GM importées', ok: avoid >= 12 && portions >= 4, detail: `${gm.rules.length} règles dont ${avoid} « à éviter », ${portions} règles de portion` });
  const recipeById = new Map(seed.recipes.map((r) => [r.id, r]));
  const violations = new Set<string>();
  for (const m of tm) {
    const rs = m.recipeIds.map((id) => recipeById.get(id)!).filter(Boolean);
    for (const v of checkMeal(rs, gm, products)) violations.add(`${m.title} : ${v.message}`);
  }
  checks.push({ label: 'Aucun repas du plan n’enfreint les règles de GM', ok: violations.size === 0, detail: violations.size ? [...violations].slice(0, 5).join(' ; ') : `${tm.length} repas contrôlés` });

  // Notes : interprétations et éléments non importés
  notes.push(
    'Le document ne contient pas d’inventaire : tous les produits démarrent avec une quantité « inconnue » (et non nulle).',
    'Le document ne donne pas de date de début : le calendrier est créé quand vous choisissez la date de démarrage du plan.',
    'Le document ne contient pas de recettes chiffrées par plat : les quantités des recettes sont indicatives, sauf le poulet (800 g cru pour 3 portions), le tilapia (540 g par repas, déduit de 5,4 kg pour 10 repas) et les haricots secs (250 g par repas, déduit de 0,5 kg pour 2 repas).',
    'Les quantités des listes P1 à P4 et leurs montants sont repris tels quels du document ; une liste générée par l’application à partir des menus peut différer.',
    'Le détail ligne par ligne de la version économique n’est pas fourni : seuls les montants par période (429,10 / 421,99 / 423,35 / 414,74 $) sont importés comme budgets.',
    'Interprétations : « foutou banane » = banane plantain ; « sauce feuilles » = épinards ; « tilapia » et « poulet » sans mode de cuisson = cuits dans la sauce ou à l’eau ; « tomates » = tomates en salade ; « 2 œufs durs » et « œufs durs » = même recette.',
    'Pain complet : le nombre de tranches par pain n’est pas indiqué ; renseignez-le dans la fiche produit pour que les petits-déjeuners soient comptés.',
    'Huile d’olive : la contenance de la bouteille n’est pas indiquée ; l’huile est traitée comme produit de garde-manger (réapprovisionnement par seuil).',
  );
  return { checks, notes };
}
