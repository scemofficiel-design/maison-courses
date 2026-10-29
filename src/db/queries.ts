import { addDays, isWithin } from '../domain/dates';
import { allocateStock, type Coverage } from '../domain/families';
import { aggregateRequirements, mealRequirements, type AggregatedNeed, type AggregationResult, type Diner, type Requirement } from '../domain/portions';
import type { DietProfile, ID, ISODate, MealPlan, Person, PlannedMeal, Product, ProductFamily, Recipe } from '../domain/types';
import { db } from './db';

export interface Context {
  products: Map<ID, Product>;
  recipes: Map<ID, Recipe>;
  profiles: Map<ID, DietProfile>;
  persons: Map<ID, Person>;
  plans: MealPlan[];
  families: Map<ID, ProductFamily>;
}

export async function loadContext(): Promise<Context> {
  const [products, recipes, profiles, persons, plans, families] = await Promise.all([
    db.products.toArray(), db.recipes.toArray(), db.profiles.toArray(), db.persons.toArray(), db.plans.toArray(), db.families.toArray(),
  ]);
  return {
    families: new Map(families.map((f) => [f.id, f])),
    products: new Map(products.map((p) => [p.id, p])),
    recipes: new Map(recipes.map((r) => [r.id, r])),
    profiles: new Map(profiles.map((p) => [p.id, p])),
    persons: new Map(persons.map((p) => [p.id, p])),
    plans,
  };
}

/** Plan actif couvrant une date (un plan actif sans dates couvre toutes les dates). */
export function plansOn(date: ISODate, plans: MealPlan[]): MealPlan[] {
  return plans.filter((p) => p.active && isWithin(date, p.startDate, p.endDate));
}

/** Profils effectifs d'une personne : ceux du plan du repas s'il y en a un, sinon ceux de sa fiche. */
export function profilesFor(personId: ID, ctx: Context, planId?: ID): DietProfile[] {
  const plan = planId ? ctx.plans.find((p) => p.id === planId) : undefined;
  const ids = plan?.members.find((m) => m.personId === personId)?.profileIds ?? ctx.persons.get(personId)?.profileIds ?? [];
  return ids.map((id) => ctx.profiles.get(id)).filter((p): p is DietProfile => !!p);
}

/** Personnes présentes à une date : membres des plans actifs, sinon personnes actives. */
export function personsOn(date: ISODate, ctx: Context): Person[] {
  const ids = new Set<ID>();
  for (const plan of plansOn(date, ctx.plans)) for (const m of plan.members) ids.add(m.personId);
  const list = ids.size
    ? [...ids].map((id) => ctx.persons.get(id)).filter((p): p is Person => !!p)
    : [...ctx.persons.values()];
  return list.filter((p) => p.active && isWithin(date, p.startDate, p.endDate));
}

export function dinersForMeal(meal: Pick<PlannedMeal, 'personIds' | 'planId'>, ctx: Context): Diner[] {
  return meal.personIds
    .map((id) => ctx.persons.get(id))
    .filter((p): p is Person => !!p)
    .map((p) => ({ personId: p.id, name: p.name, profiles: profilesFor(p.id, ctx, meal.planId) }));
}

export function dinersOn(date: ISODate, ctx: Context): Diner[] {
  const plan = plansOn(date, ctx.plans)[0];
  return personsOn(date, ctx).map((p) => ({ personId: p.id, name: p.name, profiles: profilesFor(p.id, ctx, plan?.id) }));
}

export function requirementsForMeal(meal: PlannedMeal, ctx: Context): Requirement[] {
  const recipes = meal.recipeIds.map((id) => ctx.recipes.get(id)).filter((r): r is Recipe => !!r);
  return mealRequirements(recipes, dinersForMeal(meal, ctx), meal.slot, meal.title);
}

/** Repas à venir qui comptent pour les besoins (ni préparés, ni archivés). */
export function isPending(m: PlannedMeal) {
  return m.status === 'prévu' || m.status === 'validé';
}

export async function mealsBetween(start: ISODate, end: ISODate): Promise<PlannedMeal[]> {
  return db.meals.where('date').between(start, end, true, true).toArray();
}

/** Besoins regroupés de tous les repas en attente d'une période. */
export async function needsBetween(start: ISODate, end: ISODate, ctx?: Context): Promise<AggregationResult & { meals: PlannedMeal[] }> {
  const c = ctx ?? (await loadContext());
  const meals = (await mealsBetween(start, end)).filter(isPending);
  const reqs = meals.flatMap((m) => requirementsForMeal(m, c));
  return { ...aggregateRequirements(reqs, c.products), meals };
}

export async function upcomingNeeds(from: ISODate, days: number, ctx?: Context) {
  return needsBetween(from, addDays(from, days - 1), ctx);
}

/** Couverture des besoins par le stock, références équivalentes des familles comprises. */
export function coverageFor(needs: Map<ID, AggregatedNeed>, ctx: Context, on: ISODate): Map<ID, Coverage> {
  return allocateStock([...needs.values()], ctx.products, ctx.families, ctx.profiles, on).coverage;
}
