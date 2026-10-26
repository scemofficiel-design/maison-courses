import type { Category, DietProfile, ID, Location, Person, Recipe, Settings } from '../domain/types';
import { db } from './db';
import { nowISO, uid, ValidationError } from './util';

// ---------------------------------------------------------------------------
// Personnes et profils
// ---------------------------------------------------------------------------

export async function createPerson(input: Partial<Person> & { name: string }): Promise<Person> {
  if (!input.name.trim()) throw new ValidationError('Le nom ou pseudonyme est obligatoire.');
  const now = nowISO();
  const p: Person = { active: true, profileIds: [], likes: [], dislikes: [], allergies: [], ...input, name: input.name.trim(), id: uid('person'), createdAt: now, updatedAt: now };
  await db.persons.add(p);
  return p;
}

export async function updatePerson(id: ID, patch: Partial<Person>) {
  const p = await db.persons.get(id);
  if (!p) throw new ValidationError('Personne introuvable.');
  if (patch.name !== undefined && !patch.name.trim()) throw new ValidationError('Le nom ou pseudonyme est obligatoire.');
  await db.persons.update(id, { ...patch, updatedAt: nowISO(), userModified: p.seedKey ? true : p.userModified });
}

export async function createProfile(input: Partial<DietProfile> & { name: string }): Promise<DietProfile> {
  if (!input.name.trim()) throw new ValidationError('Le nom du profil est obligatoire.');
  const now = nowISO();
  const p: DietProfile = { rules: [], portionRules: [], portionFactors: {}, plateAdditions: [], ...input, name: input.name.trim(), id: uid('profile'), createdAt: now, updatedAt: now, seedKey: undefined };
  await db.profiles.add(p);
  return p;
}

export async function updateProfile(id: ID, patch: Partial<DietProfile>) {
  const p = await db.profiles.get(id);
  if (!p) throw new ValidationError('Profil introuvable.');
  for (const [role, f] of Object.entries(patch.portionFactors ?? {})) {
    if (f !== undefined && (!Number.isFinite(f) || f <= 0 || f > 5)) throw new ValidationError(`Multiplicateur de portion invalide pour « ${role} ».`);
  }
  await db.profiles.update(id, { ...patch, updatedAt: nowISO(), userModified: p.seedKey ? true : p.userModified });
}

export async function duplicateProfile(id: ID) {
  const p = await db.profiles.get(id);
  if (!p) throw new ValidationError('Profil introuvable.');
  const { id: _i, seedKey: _s, userModified: _u, createdAt: _c, updatedAt: _up, ...rest } = p;
  return createProfile({ ...rest, name: `${p.name} (copie)`, rules: rest.rules.map((r) => ({ ...r, id: uid('rule') })) });
}

/** Un profil utilisé par une personne ou un plan ne peut pas être supprimé. */
export async function deleteProfile(id: ID) {
  const persons = await db.persons.filter((p) => p.profileIds.includes(id)).count();
  const plans = await db.plans.filter((p) => p.members.some((m) => m.profileIds.includes(id))).count();
  if (persons || plans) throw new ValidationError('Ce profil est utilisé par une personne ou un plan : retirez-le d’abord.');
  await db.profiles.delete(id);
}

// ---------------------------------------------------------------------------
// Recettes
// ---------------------------------------------------------------------------

function validateRecipe(r: Partial<Recipe>) {
  if (r.name !== undefined && !r.name.trim()) throw new ValidationError('Le nom de la recette est obligatoire.');
  if (r.servings !== undefined && !(r.servings > 0)) throw new ValidationError('Le nombre de portions doit être positif.');
  for (const i of r.ingredients ?? []) {
    if (!i.productId) throw new ValidationError('Chaque ingrédient doit être relié à un produit.');
    if (!(i.quantity > 0)) throw new ValidationError('Chaque ingrédient doit avoir une quantité positive.');
  }
}

export async function createRecipe(input: Partial<Recipe> & { name: string }): Promise<Recipe> {
  validateRecipe(input);
  const now = nowISO();
  const r: Recipe = {
    category: 'Plats', servings: 3, prepMinutes: 10, cookMinutes: 20, difficulty: 'facile', ingredients: [], steps: [], cookingMethods: [], tags: [],
    quantitySource: 'indicatif', ...input, name: input.name.trim(), id: uid('recipe'), createdAt: now, updatedAt: now, seedKey: undefined,
  };
  await db.recipes.add(r);
  return r;
}

export async function updateRecipe(id: ID, patch: Partial<Recipe>) {
  validateRecipe(patch);
  const r = await db.recipes.get(id);
  if (!r) throw new ValidationError('Recette introuvable.');
  await db.recipes.update(id, { ...patch, updatedAt: nowISO(), userModified: r.seedKey ? true : r.userModified });
}

export async function duplicateRecipe(id: ID) {
  const r = await db.recipes.get(id);
  if (!r) throw new ValidationError('Recette introuvable.');
  const { id: _i, seedKey: _s, userModified: _u, createdAt: _c, updatedAt: _up, ...rest } = r;
  return createRecipe({ ...rest, name: `${r.name} (copie)` });
}

export async function deleteRecipe(id: ID) {
  const used = await db.meals.filter((m) => m.recipeIds.includes(id) && m.status !== 'archivé').count();
  if (used) throw new ValidationError(`Cette recette est prévue dans ${used} repas : retirez-la des menus d’abord.`);
  await db.recipes.delete(id);
}

// ---------------------------------------------------------------------------
// Catégories, emplacements, préférences
// ---------------------------------------------------------------------------

export async function createCategory(name: string, kind: Category['kind'], icon = '📦') {
  if (!name.trim()) throw new ValidationError('Nom obligatoire.');
  const now = nowISO();
  const order = (await db.categories.count()) + 1;
  const c: Category = { id: uid('cat'), name: name.trim(), kind, icon, order, createdAt: now, updatedAt: now };
  await db.categories.add(c);
  return c;
}

export async function createLocation(name: string, icon = '📍') {
  if (!name.trim()) throw new ValidationError('Nom obligatoire.');
  const now = nowISO();
  const order = (await db.locations.count()) + 1;
  const l: Location = { id: uid('loc'), name: name.trim(), icon, order, createdAt: now, updatedAt: now };
  await db.locations.add(l);
  return l;
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  currency: 'CAD',
  locale: 'fr',
  expiryWarningDays: 3,
  dashboardWidgets: ['plan', 'today', 'alerts', 'shopping', 'budget', 'priority', 'feasible', 'profiles'],
  exportReminderDays: 7,
  aiEnabled: false,
};

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<Settings>) {
  const s = await getSettings();
  if (patch.expiryWarningDays !== undefined && !(patch.expiryWarningDays >= 0 && patch.expiryWarningDays <= 60)) throw new ValidationError('Délai d’alerte invalide (0 à 60 jours).');
  await db.settings.put({ ...s, ...patch, id: 'app', aiEnabled: false });
}

/** Effets de la désactivation d'une personne : repas futurs où elle est comptée. */
export async function previewPersonDeactivation(personId: ID, from: string) {
  const meals = await db.meals.where('date').aboveOrEqual(from).filter((m) => m.personIds.includes(personId) && (m.status === 'prévu' || m.status === 'validé')).toArray();
  const plans = await db.plans.filter((p) => p.active && p.members.some((m) => m.personId === personId)).toArray();
  return { futureMeals: meals.length, plans: plans.map((p) => p.name) };
}

/** Désactive une personne et la retire des repas à venir (les repas passés et l'historique sont conservés). */
export async function deactivatePerson(personId: ID, from: string) {
  return db.transaction('rw', db.persons, db.meals, async () => {
    const meals = await db.meals.where('date').aboveOrEqual(from).filter((m) => m.personIds.includes(personId) && (m.status === 'prévu' || m.status === 'validé')).toArray();
    for (const m of meals) await db.meals.update(m.id, { personIds: m.personIds.filter((x) => x !== personId), updatedAt: nowISO() });
    await updatePerson(personId, { active: false });
    return meals.length;
  });
}
