import { addDays, daysBetween } from '../domain/dates';
import type { ID, ISODate, MealPlan, PlannedMeal } from '../domain/types';
import { db } from './db';
import { nowISO, uid, ValidationError } from './util';

export function planMealDate(start: ISODate, week: number, weekday: number): ISODate {
  return addDays(start, (week - 1) * 7 + weekday);
}

export function periodRange(plan: MealPlan, index: number): { start: ISODate; end: ISODate } | undefined {
  const p = plan.periods.find((x) => x.index === index);
  if (!p || !plan.startDate) return undefined;
  return { start: addDays(plan.startDate, (Math.min(...p.weeks) - 1) * 7), end: addDays(plan.startDate, Math.max(...p.weeks) * 7 - 1) };
}

export interface StartPreview {
  meals: number;
  conflicts: number;
  start: ISODate;
  end: ISODate;
}

export async function previewPlanStart(planId: ID, start: ISODate): Promise<StartPreview> {
  const plan = await db.plans.get(planId);
  if (!plan) throw new ValidationError('Plan introuvable.');
  const weeks = plan.durationWeeks ?? Math.max(1, ...plan.templateMeals.map((t) => t.week));
  const end = addDays(start, weeks * 7 - 1);
  const existing = await db.meals.where('date').between(start, end, true, true).filter((m) => m.planId !== planId && m.status !== 'archivé').toArray();
  const occupied = new Set(existing.map((m) => `${m.date}|${m.slot}`));
  const conflicts = plan.templateMeals.filter((t) => occupied.has(`${planMealDate(start, t.week, t.weekday)}|${t.slot}`)).length;
  return { meals: plan.templateMeals.length, conflicts, start, end };
}

/**
 * Démarre (ou redémarre) un plan à une date : crée les repas du calendrier à partir du modèle et
 * date les périodes de courses. Les repas déjà préparés sont conservés ; les créneaux occupés par
 * d'autres repas ne sont pas écrasés.
 */
export async function startPlan(planId: ID, start: ISODate) {
  return db.transaction('rw', [db.plans, db.meals, db.lists, db.budgets], async () => {
    const plan = await db.plans.get(planId);
    if (!plan) throw new ValidationError('Plan introuvable.');
    const weeks = plan.durationWeeks ?? Math.max(1, ...plan.templateMeals.map((t) => t.week));
    const end = addDays(start, weeks * 7 - 1);
    // Retirer les repas encore prévus d'un démarrage précédent (jamais les repas préparés).
    const previous = await db.meals.where('planId').equals(planId).toArray();
    const removable = previous.filter((m) => m.status === 'prévu' || m.status === 'validé' || m.status === 'archivé');
    await db.meals.bulkDelete(removable.map((m) => m.id));
    const kept = previous.filter((m) => m.status === 'préparé');
    const others = await db.meals.where('date').between(start, end, true, true).filter((m) => m.planId !== planId && m.status !== 'archivé').toArray();
    const occupied = new Set([...others, ...kept].map((m) => `${m.date}|${m.slot}`));
    const now = nowISO();
    const meals: PlannedMeal[] = [];
    let skipped = 0;
    for (const t of plan.templateMeals) {
      const date = planMealDate(start, t.week, t.weekday);
      if (occupied.has(`${date}|${t.slot}`)) {
        skipped++;
        continue;
      }
      meals.push({
        id: uid('meal'),
        seedKey: plan.seedKey ? `meal:${planId}:w${t.week}:d${t.weekday}:${t.slot}` : undefined,
        date,
        slot: t.slot,
        title: t.title,
        recipeIds: t.recipeIds,
        personIds: plan.members.map((m) => m.personId),
        planId,
        status: 'prévu',
        notes: t.notes,
        createdAt: now,
        updatedAt: now,
      });
    }
    await db.meals.bulkAdd(meals);
    await db.plans.update(planId, { startDate: start, endDate: end, materialized: true, active: true, updatedAt: now });
    const updated = { ...plan, startDate: start, endDate: end };
    for (const list of await db.lists.where('planId').equals(planId).toArray()) {
      const r = list.periodIndex ? periodRange(updated, list.periodIndex) : undefined;
      if (r) await db.lists.update(list.id, { periodStart: r.start, periodEnd: r.end, plannedDate: addDays(r.start, -1), updatedAt: now });
    }
    for (const b of await db.budgets.where('planId').equals(planId).toArray()) {
      const r = b.periodIndex ? periodRange(updated, b.periodIndex) : { start, end };
      if (r) await db.budgets.update(b.id, { periodStart: r.start, periodEnd: r.end, updatedAt: now });
    }
    return { created: meals.length, skipped, kept: kept.length, start, end };
  });
}

export interface DeactivationPreview {
  futureMeals: number;
  cookedKept: number;
  openLists: string[];
  members: ID[];
}

export async function previewDeactivation(planId: ID, from: ISODate): Promise<DeactivationPreview> {
  const plan = await db.plans.get(planId);
  if (!plan) throw new ValidationError('Plan introuvable.');
  const meals = await db.meals.where('planId').equals(planId).toArray();
  const lists = await db.lists.where('planId').equals(planId).toArray();
  return {
    futureMeals: meals.filter((m) => m.date >= from && (m.status === 'prévu' || m.status === 'validé')).length,
    cookedKept: meals.filter((m) => m.status === 'préparé').length,
    openLists: lists.filter((l) => (l.status === 'à préparer' || l.status === 'en cours') && (!l.periodStart || l.periodStart >= from)).map((l) => l.name),
    members: plan.members.map((m) => m.personId),
  };
}

/**
 * Désactive un plan à partir d'une date. Rien n'est supprimé : les repas futurs sont archivés,
 * les listes non commencées des périodes futures aussi ; l'historique, les recettes et les stocks restent.
 */
export async function deactivatePlan(planId: ID, from: ISODate) {
  return db.transaction('rw', [db.plans, db.meals, db.lists], async () => {
    const plan = await db.plans.get(planId);
    if (!plan) throw new ValidationError('Plan introuvable.');
    const now = nowISO();
    const meals = await db.meals.where('planId').equals(planId).filter((m) => m.date >= from && (m.status === 'prévu' || m.status === 'validé')).toArray();
    await db.meals.bulkUpdate(meals.map((m) => ({ key: m.id, changes: { status: 'archivé' as const, updatedAt: now } })));
    const lists = await db.lists.where('planId').equals(planId).filter((l) => l.status === 'à préparer' && (!l.periodStart || l.periodStart >= from)).toArray();
    await db.lists.bulkUpdate(lists.map((l) => ({ key: l.id, changes: { status: 'archivée' as const, updatedAt: now } })));
    const endDate = plan.startDate && plan.startDate < from ? addDays(from, -1) : plan.endDate;
    await db.plans.update(planId, { active: false, endDate, archivedAt: now, updatedAt: now, userModified: plan.seedKey ? true : plan.userModified });
    return { archivedMeals: meals.length, archivedLists: lists.length };
  });
}

/** Réactive un plan : les repas archivés à venir redeviennent prévus. */
export async function reactivatePlan(planId: ID, from: ISODate) {
  return db.transaction('rw', [db.plans, db.meals, db.lists], async () => {
    const now = nowISO();
    const meals = await db.meals.where('planId').equals(planId).filter((m) => m.date >= from && m.status === 'archivé').toArray();
    await db.meals.bulkUpdate(meals.map((m) => ({ key: m.id, changes: { status: 'prévu' as const, updatedAt: now } })));
    const lists = await db.lists.where('planId').equals(planId).filter((l) => l.status === 'archivée' && (!l.periodEnd || l.periodEnd >= from)).toArray();
    await db.lists.bulkUpdate(lists.map((l) => ({ key: l.id, changes: { status: 'à préparer' as const, updatedAt: now } })));
    await db.plans.update(planId, { active: true, archivedAt: undefined, updatedAt: now });
    return { restoredMeals: meals.length };
  });
}

export async function createPlan(input: Partial<MealPlan> & { name: string }): Promise<MealPlan> {
  if (!input.name.trim()) throw new ValidationError('Le nom du plan est obligatoire.');
  const now = nowISO();
  const plan: MealPlan = {
    active: false, members: [], principles: [], templateMeals: [], periods: [], ...input,
    name: input.name.trim(), id: uid('plan'), createdAt: now, updatedAt: now, seedKey: undefined, materialized: false,
  };
  await db.plans.add(plan);
  return plan;
}

export async function duplicatePlan(planId: ID, name?: string) {
  const plan = await db.plans.get(planId);
  if (!plan) throw new ValidationError('Plan introuvable.');
  const { id: _id, seedKey: _s, userModified: _u, startDate: _st, endDate: _e, archivedAt: _a, ...rest } = plan;
  return createPlan({ ...rest, name: name ?? `${plan.name} (copie)`, active: false });
}

export async function updatePlan(planId: ID, patch: Partial<MealPlan>) {
  const p = await db.plans.get(planId);
  if (!p) throw new ValidationError('Plan introuvable.');
  await db.plans.update(planId, { ...patch, updatedAt: nowISO(), userModified: p.seedKey ? true : p.userModified });
}

/** Semaine du plan (1-indexée) correspondant à une date, ou undefined hors plan. */
export function planWeekOf(plan: MealPlan, date: ISODate): number | undefined {
  if (!plan.startDate) return undefined;
  const d = daysBetween(plan.startDate, date);
  if (d < 0) return undefined;
  const w = Math.floor(d / 7) + 1;
  return w <= (plan.durationWeeks ?? Infinity) ? w : undefined;
}
