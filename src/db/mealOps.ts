import { addDays, daysBetween } from '../domain/dates';
import { aggregateRequirements } from '../domain/portions';
import type { ID, ISODate, MealLog, MealSlot, PlannedMeal, Unit } from '../domain/types';
import { db } from './db';
import { coverageFor, dinersOn, loadContext, plansOn, requirementsForMeal } from './queries';
import { applyStockChange, reverseMovement } from './stockOps';
import { nowISO, uid, ValidationError } from './util';

export interface MealInput {
  date: ISODate;
  slot: MealSlot;
  title?: string;
  recipeIds: ID[];
  personIds?: ID[];
  planId?: ID;
  notes?: string;
}

export async function createMeal(input: MealInput): Promise<PlannedMeal> {
  const ctx = await loadContext();
  const recipes = input.recipeIds.map((id) => ctx.recipes.get(id));
  if (recipes.some((r) => !r)) throw new ValidationError('Recette introuvable.');
  const title = input.title?.trim() || recipes.map((r) => r!.name).join(' · ');
  if (!title) throw new ValidationError('Indiquez un titre ou au moins une recette.');
  const now = nowISO();
  const meal: PlannedMeal = {
    id: uid('meal'),
    date: input.date,
    slot: input.slot,
    title,
    recipeIds: input.recipeIds,
    personIds: input.personIds ?? dinersOn(input.date, ctx).map((d) => d.personId),
    planId: input.planId ?? plansOn(input.date, ctx.plans)[0]?.id,
    status: 'prévu',
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  await db.meals.add(meal);
  return meal;
}

export async function updateMeal(id: ID, patch: Partial<PlannedMeal>) {
  const m = await db.meals.get(id);
  if (!m) throw new ValidationError('Repas introuvable.');
  if (m.status === 'préparé' && (patch.recipeIds || patch.personIds || patch.date || patch.slot)) {
    throw new ValidationError('Ce repas est déjà préparé : annulez la préparation avant de le modifier.');
  }
  await db.meals.update(id, { ...patch, updatedAt: nowISO(), userModified: m.seedKey ? true : m.userModified });
}

export async function deleteMeal(id: ID) {
  const m = await db.meals.get(id);
  if (!m) return;
  if (m.status === 'préparé') throw new ValidationError('Ce repas est déjà préparé : annulez la préparation avant de le supprimer.');
  await db.meals.delete(id);
}

/** Copie les repas d'une semaine vers une autre. Les créneaux déjà occupés sont conservés sauf demande explicite. */
export async function duplicateWeek(fromMonday: ISODate, toMonday: ISODate, overwrite = false) {
  const source = await db.meals.where('date').between(fromMonday, addDays(fromMonday, 6), true, true).filter((m) => m.status !== 'archivé').toArray();
  const target = await db.meals.where('date').between(toMonday, addDays(toMonday, 6), true, true).filter((m) => m.status !== 'archivé').toArray();
  const shift = daysBetween(fromMonday, toMonday);
  let created = 0;
  let skipped = 0;
  await db.transaction('rw', db.meals, async () => {
    for (const m of source) {
      const date = addDays(m.date, shift);
      const conflicts = target.filter((t) => t.date === date && t.slot === m.slot);
      if (conflicts.length && !overwrite) {
        skipped++;
        continue;
      }
      for (const c of conflicts) if (c.status !== 'préparé') await db.meals.delete(c.id);
      const now = nowISO();
      await db.meals.add({ ...m, id: uid('meal'), date, status: 'prévu', cookedAt: undefined, seedKey: undefined, userModified: undefined, createdAt: now, updatedAt: now });
      created++;
    }
  });
  return { created, skipped };
}

export interface ConsumptionLine {
  productId: ID;
  name: string;
  quantity: number;
  unit: Unit;
  stock: number | null;
  /** Produits demandés par la recette que cette référence remplace (même famille). */
  replaces?: string[];
}

/** Quantités qui seront déduites si la préparation est confirmée (modifiables avant confirmation). */
export async function previewCooking(mealId: ID): Promise<{ lines: ConsumptionLine[]; unconverted: string[] }> {
  const m = await db.meals.get(mealId);
  if (!m) throw new ValidationError('Repas introuvable.');
  const ctx = await loadContext();
  const { needs, unconverted } = aggregateRequirements(requirementsForMeal(m, ctx), ctx.products);
  // La variante réellement disponible est déduite : stock propre d'abord, puis références équivalentes.
  const required = new Map([...needs].filter(([, n]) => !n.optional));
  const cover = coverageFor(required, ctx, m.date);
  const byProduct = new Map<ID, ConsumptionLine>();
  const add = (productId: ID, quantity: number, replaces?: string) => {
    const p = ctx.products.get(productId)!;
    const line = byProduct.get(productId) ?? { productId, name: p.name, quantity: 0, unit: p.unit, stock: p.quantity };
    line.quantity = Math.round((line.quantity + quantity) * 1000) / 1000;
    if (replaces) line.replaces = [...(line.replaces ?? []), replaces];
    byProduct.set(productId, line);
  };
  for (const n of required.values()) {
    const c = cover.get(n.productId);
    const viaEq = c?.uses.reduce((s, u) => s + u.quantity, 0) ?? 0;
    if (n.quantity - viaEq > 1e-9) add(n.productId, n.quantity - viaEq);
    for (const u of c?.uses ?? []) add(u.productId, u.sourceQuantity, ctx.products.get(n.productId)!.name);
  }
  const lines = [...byProduct.values()].filter((l) => l.quantity > 0).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return { lines, unconverted: unconverted.map((u) => `${ctx.products.get(u.productId)?.name ?? u.productId} (${u.quantity} ${u.unit})`) };
}

export interface CookResult {
  log: MealLog;
  /** Produits devenus insuffisants (épuisés ou sous le seuil). */
  warnings: string[];
  alreadyDone: boolean;
}

/**
 * Confirme la préparation d'un repas et déduit les quantités réellement consommées.
 * Idempotent : un repas déjà préparé n'est jamais déduit une seconde fois.
 */
export async function confirmCooked(mealId: ID, consumed: { productId: ID; quantity: number; unit: Unit }[]): Promise<CookResult> {
  return db.transaction('rw', [db.meals, db.mealLogs, db.products, db.movements], async () => {
    const meal = await db.meals.get(mealId);
    if (!meal) throw new ValidationError('Repas introuvable.');
    const existing = await db.mealLogs.where('plannedMealId').equals(mealId).filter((l) => !l.reversed).first();
    if (existing) return { log: existing, warnings: [], alreadyDone: true };
    const attempt = await db.mealLogs.where('plannedMealId').equals(mealId).count();
    const key = `meal:${mealId}:${attempt + 1}`;
    const movementIds: ID[] = [];
    const warnings: string[] = [];
    for (const c of consumed) {
      if (!(c.quantity > 0)) continue;
      const p = await db.products.get(c.productId);
      if (!p) continue;
      const mv = await applyStockChange({
        productId: c.productId, type: 'consommation', delta: -c.quantity, key: `${key}:${c.productId}`,
        sourceType: 'repas', sourceId: mealId, note: meal.title,
      });
      movementIds.push(mv.id);
      if (p.quantity !== null && p.quantity < c.quantity) warnings.push(`${p.name} : stock insuffisant (${p.quantity} ${p.unit} pour ${c.quantity} ${p.unit} utilisés)`);
      else if (mv.after !== null && mv.after <= 0) warnings.push(`${p.name} : épuisé`);
      else if (mv.after !== null && p.minQuantity !== undefined && mv.after < p.minQuantity) warnings.push(`${p.name} : sous le seuil (${mv.after} ${p.unit})`);
    }
    const log: MealLog = { id: uid('log'), plannedMealId: mealId, title: meal.title, at: nowISO(), consumed, movementIds, key };
    await db.mealLogs.add(log);
    await db.meals.update(mealId, { status: 'préparé', cookedAt: log.at, updatedAt: nowISO() });
    return { log, warnings, alreadyDone: false };
  });
}

/** Annule une préparation confirmée par erreur : les quantités sont remises en stock. */
export async function undoCooked(mealId: ID) {
  return db.transaction('rw', [db.meals, db.mealLogs, db.products, db.movements], async () => {
    const log = await db.mealLogs.where('plannedMealId').equals(mealId).filter((l) => !l.reversed).first();
    if (!log) return false;
    for (const id of log.movementIds) await reverseMovement(id, 'Préparation annulée');
    await db.mealLogs.update(log.id, { reversed: true });
    await db.meals.update(mealId, { status: 'prévu', cookedAt: undefined, updatedAt: nowISO() });
    return true;
  });
}
