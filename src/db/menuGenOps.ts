import { addDays } from '../domain/dates';
import { proposeMenus, type Combo, type MenuProposal } from '../domain/menuGen';
import { mealFeasibility } from '../domain/suggestions';
import type { ISODate, MealSlot, Recipe } from '../domain/types';
import { knownCombos } from './dashboard';
import { db } from './db';
import { createMeal } from './mealOps';
import { dinersOn, loadContext } from './queries';

export interface WeekGenOptions {
  slots: MealSlot[];
  economy: boolean;
  maxMinutes?: number;
  warningDays: number;
}

/** Proposition de menus pour les créneaux libres d'une semaine (rien n'est enregistré). */
export async function proposeWeek(monday: ISODate, opts: WeekGenOptions): Promise<MenuProposal[]> {
  const ctx = await loadContext();
  const end = addDays(monday, 6);
  const existing = (await db.meals.where('date').between(monday, end, true, true).toArray()).filter((m) => m.status !== 'archivé');
  const recent = (await db.meals.where('date').between(addDays(monday, -7), addDays(monday, -1), true, true).toArray()).map((m) => m.title);
  const combos: Combo[] = knownCombos(ctx);
  const diners = dinersOn(monday, ctx);
  const recipes = (ids: string[]) => ids.map((id) => ctx.recipes.get(id)).filter((r): r is Recipe => !!r);
  const starch = new Set([...ctx.recipes.values()].filter((r) => r.category === 'Féculents').map((r) => r.id));
  return proposeMenus(combos, (c) => mealFeasibility(c.title, recipes(c.recipeIds), diners, c.slot, ctx.products, monday, opts.warningDays), {
    start: monday,
    days: 7,
    slots: opts.slots,
    occupied: new Set(existing.map((m) => `${m.date}|${m.slot}`)),
    recentTitles: recent,
    economy: opts.economy,
    maxMinutes: opts.maxMinutes,
    starchRecipeIds: starch,
  });
}

export async function applyProposals(proposals: MenuProposal[]) {
  for (const p of proposals) await createMeal({ date: p.date, slot: p.slot, title: p.title, recipeIds: p.recipeIds, notes: `Proposé automatiquement : ${p.why.join(' · ')}` });
  return proposals.length;
}
