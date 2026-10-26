import { beforeEach, describe, expect, it } from 'vitest';
import { db, MaisonDB } from '../../src/db/db';
import { exportAll, restoreBackup, validateBackup } from '../../src/db/backup';
import { confirmCooked, createMeal, previewCooking, undoCooked } from '../../src/db/mealOps';
import { deactivatePlan, previewDeactivation, reactivatePlan, startPlan } from '../../src/db/planOps';
import { ensureSeed, resetDemoData } from '../../src/db/seedOps';
import { addLine, createList, markBought, previewGeneration, unmarkBought, commitGeneration } from '../../src/db/shoppingOps';
import { adjustQuantity, createProduct, markEmpty, markUnknown, recordLoss, reverseMovement, setQuantity, updateProduct } from '../../src/db/stockOps';
import { createRecipe } from '../../src/db/entityOps';
import { FAMILY_PLAN_ID } from '../../src/seed/build';
import { BUDGET_TARGET } from '../../src/seed/planDocument';
import { freshDb, fixClock } from './helpers';

beforeEach(() => {
  freshDb();
  fixClock();
});

async function makeProduct(extra: Partial<Parameters<typeof createProduct>[0]> = {}) {
  return createProduct({ name: 'Riz basmati', categoryId: 'cat-feculents', unit: 'kg', quantity: 1.2, minQuantity: 0.5, targetQuantity: 3, essential: true, perishable: false, unitPrice: 5, ...extra });
}

describe('Produits (test 1)', () => {
  it('crée et modifie un produit avec historique', async () => {
    const p = await makeProduct();
    expect((await db.products.get(p.id))!.quantity).toBe(1.2);
    await updateProduct(p.id, { name: 'Riz parfumé', quantity: 2, locationId: 'loc-placard' });
    const after = (await db.products.get(p.id))!;
    expect(after.name).toBe('Riz parfumé');
    expect(after.quantity).toBe(2);
    const types = (await db.movements.where('productId').equals(p.id).toArray()).map((m) => m.type);
    expect(types).toEqual(expect.arrayContaining(['création', 'ajustement', 'déplacement']));
  });
  it('refuse les données invalides', async () => {
    await expect(createProduct({ name: ' ', categoryId: 'c', unit: 'kg', quantity: 1, essential: true, perishable: false })).rejects.toThrow();
    await expect(makeProduct({ quantity: -1 })).rejects.toThrow();
    await expect(makeProduct({ minQuantity: 5, targetQuantity: 2 })).rejects.toThrow();
  });
  it('gère +/−, épuisé, inconnu, perte et correction', async () => {
    const p = await makeProduct();
    await adjustQuantity(p.id, 0.5);
    await adjustQuantity(p.id, -0.2);
    expect((await db.products.get(p.id))!.quantity).toBe(1.5);
    await markEmpty(p.id);
    expect((await db.products.get(p.id))!.quantity).toBe(0);
    await markUnknown(p.id);
    expect((await db.products.get(p.id))!.quantity).toBeNull();
    await setQuantity(p.id, 2);
    const loss = await recordLoss(p.id, 0.5, 'périmé');
    expect((await db.products.get(p.id))!.quantity).toBe(1.5);
    await reverseMovement(loss.id);
    expect((await db.products.get(p.id))!.quantity).toBe(2);
    // Une correction ne s'applique qu'une fois
    await reverseMovement(loss.id);
    expect((await db.products.get(p.id))!.quantity).toBe(2);
  });
});

describe('Achats (tests 9 et 11)', () => {
  it('met à jour le stock avec la quantité réellement achetée, une seule fois', async () => {
    const p = await makeProduct({ quantity: 0.2 });
    const list = await createList({ name: 'Courses' });
    const line = await addLine(list.id, { productId: p.id, quantity: 2 });
    await markBought(line.id, { quantity: 3, price: 14.5, updateStock: true, savePrice: true });
    await markBought(line.id, { quantity: 3, price: 14.5, updateStock: true });
    const after = (await db.products.get(p.id))!;
    expect(after.quantity).toBeCloseTo(3.2);
    expect(after.priceStatus).toBe('vérifié');
    expect(await db.purchases.count()).toBe(1);
    expect((await db.lists.get(list.id))!.status).toBe('en cours');
    // Correction d'une erreur : décocher annule l'entrée en stock, recocher la refait une fois.
    await unmarkBought(line.id);
    expect((await db.products.get(p.id))!.quantity).toBeCloseTo(0.2);
    await markBought(line.id, { quantity: 2, updateStock: true });
    expect((await db.products.get(p.id))!.quantity).toBeCloseTo(2.2);
  });
  it('regroupe un produit ajouté deux fois sur la même liste', async () => {
    const p = await makeProduct();
    const list = await createList({ name: 'Courses' });
    await addLine(list.id, { productId: p.id, quantity: 1 });
    await addLine(list.id, { productId: p.id, quantity: 500, unit: 'g' });
    const lines = await db.lines.where('listId').equals(list.id).toArray();
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(1.5);
  });
});

describe('Repas préparés (tests 10 et 11)', () => {
  it('ne déduit rien à la planification, déduit à la confirmation, une seule fois', async () => {
    await ensureSeed();
    await setQuantity('p-poulet', 5);
    await setQuantity('p-citron', 10);
    const meal = await createMeal({ date: '2026-11-02', slot: 'déjeuner', recipeIds: ['r-poulet-four'], personIds: ['person-gm', 'person-moi', 'person-mere'] });
    expect((await db.products.get('p-poulet'))!.quantity).toBe(5);
    const { lines } = await previewCooking(meal.id);
    const poulet = lines.find((l) => l.productId === 'p-poulet')!;
    expect(poulet.quantity).toBeCloseTo(0.8);
    const res = await confirmCooked(meal.id, lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unit: l.unit })));
    expect(res.alreadyDone).toBe(false);
    expect((await db.products.get('p-poulet'))!.quantity).toBeCloseTo(4.2);
    const again = await confirmCooked(meal.id, lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unit: l.unit })));
    expect(again.alreadyDone).toBe(true);
    expect((await db.products.get('p-poulet'))!.quantity).toBeCloseTo(4.2);
    await undoCooked(meal.id);
    expect((await db.products.get('p-poulet'))!.quantity).toBeCloseTo(5);
    expect((await db.meals.get(meal.id))!.status).toBe('prévu');
  });
  it('avertit quand un ingrédient devient insuffisant', async () => {
    await ensureSeed();
    await setQuantity('p-tilapia', 0.1);
    const meal = await createMeal({ date: '2026-11-02', slot: 'dîner', recipeIds: ['r-tilapia-four'], personIds: ['person-gm'] });
    const res = await confirmCooked(meal.id, [{ productId: 'p-tilapia', quantity: 0.18, unit: 'kg' }]);
    expect(res.warnings.join(' ')).toMatch(/Tilapia/);
  });
});

describe('Plan familial importé (tests 13, 17 et 18)', () => {
  it('importe 8 semaines, 4 listes, budgets de référence exacts', async () => {
    expect(await ensureSeed()).toBe('installé');
    const plan = (await db.plans.get(FAMILY_PLAN_ID))!;
    expect(plan.name).toBe('Plan familial — 8 semaines avec grand-mère');
    expect(new Set(plan.templateMeals.map((t) => t.week)).size).toBe(8);
    expect(plan.templateMeals.filter((t) => t.slot === 'déjeuner')).toHaveLength(56);
    expect(plan.templateMeals.filter((t) => t.slot === 'dîner')).toHaveLength(56);
    const lists = await db.lists.where('planId').equals(FAMILY_PLAN_ID).sortBy('periodIndex');
    expect(lists).toHaveLength(4);
    for (const [k, l] of lists.entries()) {
      const sum = (await db.lines.where('listId').equals(l.id).toArray()).reduce((s, x) => s + (x.estTotal ?? 0), 0);
      expect(Math.round(sum * 100) / 100).toBe(BUDGET_TARGET[k]);
      expect(l.budget).toBe(BUDGET_TARGET[k]);
    }
    const persons = await db.persons.toArray();
    expect(persons.map((p) => p.name).sort()).toEqual(['Grand-mère', 'Ma mère', 'Moi']);
    // Aucun inventaire inventé
    expect((await db.products.toArray()).every((p) => p.quantity === null)).toBe(true);
  });
  it('démarre le plan à une date choisie, puis le désactive sans rien supprimer', async () => {
    await ensureSeed();
    const res = await startPlan(FAMILY_PLAN_ID, '2026-11-02');
    expect(res.created).toBe(280);
    const p1 = (await db.lists.get('list-p1'))!;
    expect(p1.periodStart).toBe('2026-11-02');
    expect(p1.periodEnd).toBe('2026-11-15');
    expect((await db.lists.get('list-p4'))!.periodEnd).toBe('2026-12-27');
    const firstLunch = await db.meals.where('[date+slot]').equals(['2026-11-02', 'déjeuner']).first();
    expect(firstLunch!.title).toBe('Riz · sauce claire · tilapia au four');
    const preview = await previewDeactivation(FAMILY_PLAN_ID, '2026-12-01');
    expect(preview.futureMeals).toBeGreaterThan(0);
    const before = await db.meals.count();
    const d = await deactivatePlan(FAMILY_PLAN_ID, '2026-12-01');
    expect(d.archivedMeals).toBe(preview.futureMeals);
    expect(await db.meals.count()).toBe(before);
    expect((await db.plans.get(FAMILY_PLAN_ID))!.active).toBe(false);
    expect(await db.recipes.count()).toBeGreaterThan(40);
    await reactivatePlan(FAMILY_PLAN_ID, '2026-12-01');
    expect((await db.plans.get(FAMILY_PLAN_ID))!.active).toBe(true);
  });
  it('génère une liste à partir des menus et du stock (scénario A)', async () => {
    await ensureSeed();
    await startPlan(FAMILY_PLAN_ID, '2026-11-02');
    await setQuantity('p-riz', 10);
    // La liste P1 du document couvre déjà cette semaine : ses quantités sont déduites.
    const withP1 = await previewGeneration({ start: '2026-11-02', end: '2026-11-08', includeLowStock: false, includeOptional: false });
    expect(withP1.lines.map((l) => l.productId)).not.toContain('p-tilapia');
    await db.lists.update('list-p1', { status: 'archivée' });
    const preview = await previewGeneration({ start: '2026-11-02', end: '2026-11-08', includeLowStock: false, includeOptional: false });
    expect(preview.mealCount).toBeGreaterThan(0);
    const ids = preview.lines.map((l) => l.productId);
    expect(ids).toContain('p-tilapia');
    expect(ids).not.toContain('p-riz');
    expect(new Set(ids).size).toBe(ids.length);
    const tilapia = preview.lines.find((l) => l.productId === 'p-tilapia')!;
    // Semaine 1 : 5 repas de tilapia (4 midis + jeudi soir) × 540 g = 2,7 kg (stock inconnu → à vérifier)
    expect(tilapia.rawQuantity).toBeCloseTo(2.7);
    expect(tilapia.stockUnknown).toBe(true);
    const list = await createList({ name: 'Semaine 1' });
    await commitGeneration(list.id, preview.lines);
    expect(await db.lines.where('listId').equals(list.id).count()).toBe(preview.lines.length);
  });
});

describe('Données initiales versionnées', () => {
  it('ne réécrase pas une donnée modifiée par l’utilisateur et la réinitialisation conserve le stock', async () => {
    await ensureSeed();
    await updateProduct('p-riz', { minQuantity: 2, quantity: 4 });
    await db.meta.put({ key: 'seedVersion', value: 0 });
    expect(await ensureSeed()).toBe('mis à jour');
    expect((await db.products.get('p-riz'))!.minQuantity).toBe(2);
    await resetDemoData(['catalog']);
    const riz = (await db.products.get('p-riz'))!;
    expect(riz.minQuantity).toBeUndefined();
    expect(riz.quantity).toBe(4);
    const mine = await createRecipe({ name: 'Ma recette', ingredients: [] });
    await resetDemoData(['recipes']);
    expect(await db.recipes.get(mine.id)).toBeDefined();
  });
});

describe('Persistance et sauvegarde (tests 14 et 15)', () => {
  it('conserve les données après fermeture et réouverture de la base', async () => {
    const name = 'persist-test';
    const first = freshDb(name);
    await ensureSeed();
    await setQuantity('p-riz', 2.5);
    first.close();
    const reopened = new MaisonDB(name);
    expect((await reopened.products.get('p-riz'))!.quantity).toBe(2.5);
    expect(await reopened.plans.count()).toBe(1);
    reopened.close();
  });
  it('exporte puis restaure toutes les données', async () => {
    await ensureSeed();
    await setQuantity('p-riz', 2.5);
    const backup = JSON.parse(JSON.stringify(await exportAll()));
    freshDb();
    expect(await db.products.count()).toBe(0);
    const summary = await restoreBackup(backup);
    expect(summary.counts.products).toBeGreaterThan(50);
    expect((await db.products.get('p-riz'))!.quantity).toBe(2.5);
    expect((await db.movements.toArray()).some((m) => m.productId === 'p-riz')).toBe(true);
  });
  it('refuse un fichier qui n’est pas une sauvegarde valide, sans rien modifier', async () => {
    await ensureSeed();
    const count = await db.products.count();
    expect(() => validateBackup({ hello: 'world' })).toThrow();
    await expect(restoreBackup({ app: 'maison-courses', schemaVersion: 1, exportedAt: '', tables: { products: [{ nope: 1 }] } })).rejects.toThrow();
    expect(await db.products.count()).toBe(count);
  });
});
