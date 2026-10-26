import { addDays } from '../domain/dates';
import { batchCookingIdeas } from '../domain/insights';
import { listTotals } from '../domain/shopping';
import { expiryLevel, productAlerts, stockLevel, usableQuantity, type StockAlert } from '../domain/stock';
import { mealFeasibility, rankSuggestions, type Feasibility } from '../domain/suggestions';
import type { ID, ISODate, MealPlan, PlannedMeal, Product, Recipe, ShoppingList } from '../domain/types';
import { round2 } from '../domain/units';
import { db } from './db';
import { dinersOn, isPending, loadContext, needsBetween, personsOn, plansOn, type Context } from './queries';

export interface Shortage {
  productId: ID;
  name: string;
  need: number;
  have: number | null;
  missing: number;
  unit: Product['unit'];
}

export interface DashboardData {
  counts: { available: number; low: number; missing: number; expiring: number; unknown: number; total: number };
  todayMeals: PlannedMeal[];
  shortagesToday: Shortage[];
  shortagesWeek: Shortage[];
  alerts: (StockAlert & { name: string })[];
  nextList?: { list: ShoppingList; todo: number; estimated: number; remaining: number; spent: number };
  feasible: Feasibility[];
  priority: Product[];
  batch: ReturnType<typeof batchCookingIdeas>;
  persons: { id: ID; name: string; profiles: string[] }[];
  activePlans: MealPlan[];
  familyPlan?: MealPlan;
}

function shortages(needs: Awaited<ReturnType<typeof needsBetween>>['needs'], ctx: Context, on: ISODate): Shortage[] {
  const out: Shortage[] = [];
  for (const n of needs.values()) {
    if (n.optional) continue;
    const p = ctx.products.get(n.productId);
    if (!p) continue;
    const have = usableQuantity(p, on);
    if (have === null || have + 1e-9 < n.quantity) {
      out.push({ productId: p.id, name: p.name, need: round2(n.quantity), have, missing: have === null ? round2(n.quantity) : round2(n.quantity - have), unit: p.unit });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Combinaisons de plats connues : celles des modèles de plans, puis chaque recette « plat » seule. */
export function knownCombos(ctx: Context): { title: string; recipeIds: ID[]; slot: PlannedMeal['slot'] }[] {
  const seen = new Map<string, { title: string; recipeIds: ID[]; slot: PlannedMeal['slot'] }>();
  for (const plan of ctx.plans) {
    for (const t of plan.templateMeals) {
      if (!t.recipeIds.length || (t.slot !== 'déjeuner' && t.slot !== 'dîner')) continue;
      const k = `${t.slot}|${t.title}`;
      if (!seen.has(k)) seen.set(k, { title: t.title, recipeIds: t.recipeIds, slot: t.slot });
    }
  }
  const all = [...ctx.recipes.values()];
  // Plats complets créés par l'utilisateur : utilisables midi et soir.
  for (const r of all.filter((x) => x.category === 'Plats')) {
    for (const slot of ['déjeuner', 'dîner'] as const) seen.set(`${slot}|${r.name}`, { title: r.name, recipeIds: [r.id], slot });
  }
  // Associations simples à partir de la bibliothèque : féculent + protéine le midi, légume + protéine le soir.
  const by = (cats: string[]) => all.filter((r) => cats.includes(r.category));
  const proteins = by(['Poissons', 'Volailles', 'Œufs', 'Viandes']);
  for (const s of by(['Féculents'])) for (const p of proteins) {
    const title = `${s.name} · ${p.name}`;
    if (!seen.has(`déjeuner|${title}`)) seen.set(`déjeuner|${title}`, { title, recipeIds: [s.id, p.id], slot: 'déjeuner' });
  }
  for (const v of by(['Légumes', 'Légumineuses'])) for (const p of proteins) {
    const title = `${v.name} · ${p.name}`;
    if (!seen.has(`dîner|${title}`)) seen.set(`dîner|${title}`, { title, recipeIds: [v.id, p.id], slot: 'dîner' });
  }
  return [...seen.values()];
}

export async function loadDashboard(on: ISODate, warningDays: number): Promise<DashboardData> {
  const ctx = await loadContext();
  const products = [...ctx.products.values()].filter((p) => !p.archived);
  const week = await needsBetween(on, addDays(on, 6), ctx);
  const todayNeeds = await needsBetween(on, on, ctx);
  const counts = { available: 0, low: 0, missing: 0, expiring: 0, unknown: 0, total: products.length };
  const alerts: DashboardData['alerts'] = [];
  for (const p of products) {
    const lvl = stockLevel(p);
    if (lvl === 'ok' || lvl === 'bas') counts.available++;
    if (lvl === 'bas') counts.low++;
    if (lvl === 'épuisé') counts.missing++;
    if (lvl === 'inconnu') counts.unknown++;
    const exp = expiryLevel(p, on, warningDays);
    if (exp === 'bientôt' || exp === 'périmé') counts.expiring++;
    for (const a of productAlerts(p, on, warningDays, week.needs.get(p.id)?.quantity ?? 0)) {
      if (a.kind === 'stock inconnu') continue;
      alerts.push({ ...a, name: p.name });
    }
  }
  alerts.sort((a, b) => b.severity - a.severity || a.name.localeCompare(b.name, 'fr'));

  const todayMeals = (await db.meals.where('date').equals(on).toArray()).filter((m) => m.status !== 'archivé');

  const lists = (await db.lists.toArray()).filter((l) => l.status === 'à préparer' || l.status === 'en cours');
  lists.sort((a, b) => {
    const cover = (l: ShoppingList) => (l.periodStart && l.periodEnd && l.periodStart <= on && on <= l.periodEnd ? 0 : 1);
    return cover(a) - cover(b) || (a.status === 'en cours' ? -1 : 0) - (b.status === 'en cours' ? -1 : 0) || (a.plannedDate ?? '9999').localeCompare(b.plannedDate ?? '9999');
  });
  // Une liste de plan dont la période n'est pas encore datée n'est pas « la prochaine ».
  const next = lists.find((l) => !l.planId || l.periodStart) ?? lists.find((l) => !l.planId);
  let nextList: DashboardData['nextList'];
  if (next) {
    const lines = await db.lines.where('listId').equals(next.id).toArray();
    const tt = listTotals(lines);
    nextList = { list: next, todo: tt.counts.todo, estimated: tt.estimated, remaining: tt.remainingEstimate, spent: tt.spent };
  }

  const diners = dinersOn(on, ctx);
  const recipes = (ids: ID[]) => ids.map((id) => ctx.recipes.get(id)).filter((r): r is Recipe => !!r);
  const combos = knownCombos(ctx);
  const feasible = rankSuggestions(
    combos.map((c) => mealFeasibility(c.title, recipes(c.recipeIds), diners, c.slot, ctx.products, on, warningDays)),
  ).filter((f) => f.missing.filter((m) => !m.optional).length === 0 && f.unknown.length === 0).slice(0, 3);

  const priority = products
    .filter((p) => expiryLevel(p, on, warningDays) === 'bientôt' && (p.quantity ?? 0) > 0)
    .sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''));
  const batch = batchCookingIdeas(week.meals.filter(isPending), ctx.recipes, on, 7).slice(0, 3);
  const persons = personsOn(on, ctx).map((p) => ({ id: p.id, name: p.name, profiles: diners.find((d) => d.personId === p.id)?.profiles.map((x) => x.name) ?? [] }));

  return {
    counts,
    todayMeals,
    shortagesToday: shortages(todayNeeds.needs, ctx, on),
    shortagesWeek: shortages(week.needs, ctx, on),
    alerts: alerts.slice(0, 8),
    nextList,
    feasible,
    priority,
    batch,
    persons,
    activePlans: plansOn(on, ctx.plans),
    familyPlan: ctx.plans.find((p) => p.seedKey === 'plan:plan-famille-gm'),
  };
}
