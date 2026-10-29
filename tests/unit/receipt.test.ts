import EXAMPLE_TEXT from '../../examples/recu-exemple.json?raw';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportAll, restoreBackup } from '../../src/db/backup';
import { loadDashboard } from '../../src/db/dashboard';
import { db } from '../../src/db/db';
import { createRecipe } from '../../src/db/entityOps';
import { createFamily } from '../../src/db/familyOps';
import { createMeal, previewCooking } from '../../src/db/mealOps';
import { importReceipt, previewReceipt, type ReceiptLinePlan } from '../../src/db/receiptOps';
import { ensureSeed } from '../../src/db/seedOps';
import { addLine, createList, markBought } from '../../src/db/shoppingOps';
import { createProduct, setQuantity } from '../../src/db/stockOps';
import { freshDb, fixClock } from './helpers';

beforeEach(() => {
  freshDb();
  fixClock();
});

const EXAMPLE = EXAMPLE_TEXT;

/** Reçu minimal : une ligne par article { nomRecu, id, quantite, unite, prixPaye… }. */
function receipt(articles: Record<string, unknown>[], recu: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: 'maison-courses-recu', version: 1,
    recu: { date: '2026-11-01', magasin: 'Maxi', devise: 'CAD', ...recu },
    articles: articles.map(({ id, ...a }) => ({ produit: id ? { id } : {}, ...a })),
  });
}

async function riz(quantity: number | null = 1.2) {
  return createProduct({ name: 'Riz basmati', categoryId: 'cat-feculents', unit: 'kg', quantity, essential: true, perishable: false, unitPrice: 5 });
}

async function run(text: string, opts: { listId?: string; edit?: (plans: ReceiptLinePlan[]) => ReceiptLinePlan[] } = {}) {
  const pv = await previewReceipt(text, 'recu.json');
  const plans = opts.edit ? opts.edit(pv.plans) : pv.plans;
  return importReceipt(pv, plans, { listId: opts.listId });
}

const qty = async (id: string) => (await db.products.get(id))!.quantity;

describe('Importation additive des achats', () => {
  it('ajoute la quantité achetée au stock existant sans le remplacer', async () => {
    const p = await riz(1.2);
    const rec = await run(receipt([{ nomRecu: 'RIZ BASMATI 2KG', id: p.id, quantite: 1, unite: 'sac', format: { libelle: 'sac 2 kg', contenance: { quantite: 2, unite: 'kg' } }, prixPaye: 7.99 }]));
    expect(await qty(p.id)).toBe(3.2);
    expect(rec.lines[0]).toMatchObject({ action: 'ajouté', quantityAdded: 2, productId: p.id });
    const mv = (await db.movements.where('productId').equals(p.id).toArray()).find((m) => m.type === 'achat')!;
    expect(mv).toMatchObject({ delta: 2, before: 1.2, after: 3.2, sourceType: 'reçu', sourceId: rec.id });
  });
  it('ne diminue jamais un stock (retour, quantité nulle) et refuse une quantité négative', async () => {
    const p = await riz(5);
    await run(receipt([{ nomRecu: 'RETOUR RIZ', id: p.id, quantite: -1, unite: 'kg', prixPaye: -5 }]));
    expect(await qty(p.id)).toBe(5);
    const pv = await previewReceipt(receipt([{ nomRecu: 'RIZ', id: p.id, quantite: 1, unite: 'kg', prixPaye: 5 }], { numero: 'B' }));
    await expect(importReceipt(pv, pv.plans.map((x) => ({ ...x, stockQuantity: -2 })))).rejects.toThrow(/ne peut pas diminuer/);
    expect(await qty(p.id)).toBe(5);
  });
  it('un stock inconnu reçoit au moins la quantité achetée', async () => {
    const p = await riz(null);
    await run(receipt([{ nomRecu: 'RIZ', id: p.id, quantite: 2, unite: 'kg', prixPaye: 9 }]));
    expect(await qty(p.id)).toBe(2);
  });
  it('exige une quantité quand la correspondance des formats est inconnue', async () => {
    const p = await createProduct({ name: 'Raisins verts', categoryId: 'cat-fruits', unit: 'grappe', quantity: 1, essential: true, perishable: true });
    const pv = await previewReceipt(receipt([{ nomRecu: 'RAISIN VERT', id: p.id, quantite: 1, unite: 'barquette', prixPaye: 4 }]));
    expect(pv.plans[0].stockQuantity).toBeNull();
    await expect(importReceipt(pv, pv.plans)).rejects.toThrow(/indiquez la quantité/);
    await importReceipt(pv, pv.plans.map((x) => ({ ...x, stockQuantity: 2 })));
    expect(await qty(p.id)).toBe(3);
  });
});

describe('Protection contre les doublons', () => {
  it('refuse d’importer deux fois le même reçu, même remis en forme', async () => {
    const p = await riz(1);
    const text = receipt([{ nomRecu: 'RIZ', id: p.id, quantite: 1, unite: 'kg', prixPaye: 5 }], { numero: '123', total: 5 });
    await run(text);
    const again = await previewReceipt(JSON.stringify(JSON.parse(text), null, 2));
    expect(again.duplicateOf).toBeDefined();
    await expect(importReceipt(again, again.plans)).rejects.toThrow(/déjà été importé/);
    expect(await qty(p.id)).toBe(2);
    expect(await db.receipts.count()).toBe(1);
    expect(await db.prices.count()).toBe(1);
  });
  it('signale un reçu semblable (même magasin, jour et total) sans le bloquer', async () => {
    const p = await riz(1);
    await run(receipt([{ nomRecu: 'RIZ', id: p.id, quantite: 1, unite: 'kg', prixPaye: 5 }], { total: 5 }));
    const other = await previewReceipt(receipt([{ nomRecu: 'RIZ JASMIN', id: p.id, quantite: 1, unite: 'kg', prixPaye: 5 }], { total: 5 }));
    expect(other.duplicateOf).toBeUndefined();
    expect(other.similar).toHaveLength(1);
  });
});

describe('Prix', () => {
  it('met à jour le dernier prix connu et conserve l’historique', async () => {
    const p = await riz(0);
    await run(receipt([{ nomRecu: 'RIZ 2KG', id: p.id, quantite: 1, unite: 'sac', format: { contenance: { quantite: 2, unite: 'kg' } }, prixTotal: 8.99, rabais: 1, prixPaye: 7.99 }], { date: '2026-10-20' }));
    let after = (await db.products.get(p.id))!;
    expect(after.unitPrice).toBe(3.995);
    expect(after.priceStatus).toBe('vérifié');
    expect(after.priceSource).toBe('Reçu Maxi du 2026-10-20');
    expect(after.lastPrice).toMatchObject({ amount: 7.99, quantity: 1, unit: 'sac', unitPrice: 3.995, date: '2026-10-20', store: 'Maxi' });
    // Un reçu plus ancien enrichit l'historique sans remplacer le dernier prix.
    await run(receipt([{ nomRecu: 'RIZ 1KG', id: p.id, quantite: 1, unite: 'kg', prixPaye: 6 }], { date: '2026-09-01' }));
    after = (await db.products.get(p.id))!;
    expect(after.lastPrice!.date).toBe('2026-10-20');
    expect(after.unitPrice).toBe(3.995);
    const history = await db.prices.where('productId').equals(p.id).sortBy('date');
    expect(history.map((h) => [h.date, h.paid, h.discount, h.unitPrice])).toEqual([['2026-09-01', 6, undefined, 6], ['2026-10-20', 7.99, 1, 3.995]]);
    expect(after.quantity).toBe(3);
  });
  it('enregistre aussi le prix d’un achat coché en magasin', async () => {
    const p = await riz(0);
    const list = await createList({ name: 'Semaine' });
    const line = await addLine(list.id, { productId: p.id, quantity: 2 });
    await markBought(line.id, { quantity: 2, price: 9, updateStock: true, savePrice: false });
    const [rec] = await db.prices.toArray();
    expect(rec).toMatchObject({ productId: p.id, paid: 9, unitPrice: 4.5, source: 'liste' });
    expect((await db.products.get(p.id))!.unitPrice).toBe(5); // prix de référence inchangé sans demande
  });
});

describe('Création et reconnaissance des produits', () => {
  it('crée les produits inconnus dans la bonne famille et retient le nom du reçu', async () => {
    await ensureSeed();
    const rec = await run(EXAMPLE);
    const byName = new Map(rec.lines.map((l) => [l.receiptName, l]));
    const grapes = (await db.products.get(byName.get('RAISIN VERT S/PEP')!.productId!))!;
    expect(byName.get('RAISIN VERT S/PEP')!.action).toBe('créé');
    expect(grapes).toMatchObject({ name: 'Raisins verts', familyId: 'fam-raisins', variant: 'verts sans pépins', unit: 'barquette', quantity: 1, format: 'barquette 907 g' });
    expect(grapes.conversions).toEqual([{ unit: 'barquette', amount: 907, to: 'g' }]);
    const fruitYog = (await db.products.get(byName.get('YOG FRAISE 4X100G')!.productId!))!;
    // « Pack de 4 pots » : le stock est compté en pots, l'unité pratique de la famille.
    expect(fruitYog).toMatchObject({ familyId: 'fam-yaourts', variant: 'aux fraises', brand: 'Liberté', unit: 'pot', quantity: 4, format: 'pack de 4 pots de 100 g' });
    // Produits existants : quantité ajoutée dans l'unité du produit (stock inconnu → au moins l'achat).
    expect(await qty('p-yaourt')).toBe(2);
    expect(await qty('p-riz')).toBe(2);
    expect(await qty('p-plantain')).toBe(4);
    expect(await qty('p-papier-toilette')).toBe(12);
    expect((await db.products.get('p-riz'))!.receiptNames).toEqual(['riz basmati 2kg']);
    // Le même nom est reconnu automatiquement au reçu suivant, sans identifiant.
    const next = await previewReceipt(receipt([{ nomRecu: 'RIZ BASMATI 2KG', quantite: 1, unite: 'kg', prixPaye: 4 }], { date: '2026-11-05' }));
    expect(next.plans[0]).toMatchObject({ choice: 'existant', productId: 'p-riz', match: { confidence: 'sûre' } });
  });
  it('crée une nouvelle famille si nécessaire', async () => {
    await run(receipt([{ nomRecu: 'KOMBUCHA', quantite: 2, unite: 'bouteille', prixPaye: 7, produit: { nom: 'Kombucha gingembre', famille: 'Kombucha', variante: 'gingembre', categorie: 'Boissons' } }]));
    const fam = (await db.families.toArray()).find((f) => f.name === 'Kombucha')!;
    expect(fam).toMatchObject({ substitution: 'à confirmer' });
    const p = (await db.products.where('familyId').equals(fam.id).first())!;
    expect(p).toMatchObject({ name: 'Kombucha gingembre', quantity: 2, unit: 'bouteille' });
  });
});

describe('Association à une liste de courses (pas de double ajout)', () => {
  it('coche la ligne prévue et n’ajoute le stock qu’une fois', async () => {
    const p = await riz(0);
    const list = await createList({ name: 'Semaine' });
    const line = await addLine(list.id, { productId: p.id, quantity: 2 });
    const pv = await previewReceipt(receipt([{ nomRecu: 'RIZ', id: p.id, quantite: 2, unite: 'kg', prixPaye: 10 }]));
    expect(pv.suggestedListId).toBe(list.id);
    const rec = await importReceipt(pv, pv.plans, { listId: list.id });
    expect(await qty(p.id)).toBe(2);
    expect((await db.lines.get(line.id))!).toMatchObject({ status: 'acheté', actualQuantity: 2, actualPrice: 10 });
    expect(rec.lines[0].listLineId).toBe(line.id);
    expect(await db.purchases.where('lineId').equals(line.id).count()).toBe(1);
  });
  it('un achat déjà coché en magasin n’est pas ajouté une seconde fois ; seul le surplus est ajouté', async () => {
    const p = await riz(0);
    const list = await createList({ name: 'Semaine' });
    const line = await addLine(list.id, { productId: p.id, quantity: 2 });
    await markBought(line.id, { quantity: 2, updateStock: true });
    expect(await qty(p.id)).toBe(2);
    const rec = await run(receipt([{ nomRecu: 'RIZ', id: p.id, quantite: 2, unite: 'kg', prixPaye: 10 }]), { listId: list.id });
    expect(await qty(p.id)).toBe(2);
    expect(rec.lines[0]).toMatchObject({ action: 'déjà compté', quantityAdded: 0 });
    expect((await db.lines.get(line.id))!.actualPrice).toBe(10);
    // Le reçu indique plus que ce qui a été coché : seule la différence est ajoutée.
    const line2 = await addLine(list.id, { productId: p.id, quantity: 1 });
    await markBought(line2.id, { quantity: 1, updateStock: true });
    await run(receipt([{ nomRecu: 'RIZ', id: p.id, quantite: 3, unite: 'kg', prixPaye: 15 }], { numero: 'autre' }), { listId: list.id });
    expect(await qty(p.id)).toBe(5); // 2 + 1 coché + 2 de surplus
  });
  it('une variante équivalente achetée à la place coche la ligne sans recompter', async () => {
    await createFamily({ name: 'Raisins', categoryId: 'cat-fruits', substitution: 'interchangeable' });
    const fam = (await db.families.toArray())[0];
    const red = await createProduct({ name: 'Raisins rouges', categoryId: 'cat-fruits', unit: 'grappe', quantity: 0, essential: true, perishable: true, familyId: fam.id, variant: 'rouges' });
    const green = await createProduct({ name: 'Raisins verts', categoryId: 'cat-fruits', unit: 'grappe', quantity: 0, essential: true, perishable: true, familyId: fam.id, variant: 'verts' });
    const list = await createList({ name: 'Semaine' });
    const line = await addLine(list.id, { productId: red.id, quantity: 2 });
    await run(receipt([{ nomRecu: 'RAISIN VERT', id: green.id, quantite: 2, unite: 'grappe', prixPaye: 6 }]), { listId: list.id });
    expect(await qty(green.id)).toBe(2);
    expect(await qty(red.id)).toBe(0);
    expect((await db.lines.get(line.id))!).toMatchObject({ status: 'acheté', note: 'Acheté : Raisins verts' });
  });
});

describe('Familles dans les calculs de l’application', () => {
  it('pas de faux manque au tableau de bord quand une autre marque de la même variante est en stock', async () => {
    await ensureSeed();
    const other = await createProduct({ name: 'Yaourt nature 0 % (marque B)', categoryId: 'cat-laitiers', unit: 'pot', quantity: 3, essential: true, perishable: true, familyId: 'fam-yaourts', variant: 'nature 0 %', tags: ['laitage', 'laitage-maigre'] });
    await setQuantity('p-yaourt', 0);
    const r = await createRecipe({ name: 'Collation yaourt', servings: 1, ingredients: [{ productId: 'p-yaourt', quantity: 1, unit: 'pot', role: 'laitage', scaling: 'linéaire' }] });
    const meal = await createMeal({ date: '2026-11-02', slot: 'collation-matin', recipeIds: [r.id], personIds: ['person-gm'] });
    const dash = await loadDashboard('2026-11-02', 3);
    expect(dash.shortagesToday.map((s) => s.productId)).not.toContain('p-yaourt');
    expect(dash.alerts.filter((a) => a.productId === 'p-yaourt' && a.kind === 'consommation prévue')).toEqual([]);
    // La préparation déduit la référence réellement disponible.
    const cook = await previewCooking(meal.id);
    expect(cook.lines).toEqual([expect.objectContaining({ productId: other.id, quantity: 1, replaces: ['Yaourt nature 0 % (pot 750 g)'] })]);
  });
  it('un yaourt sucré ne couvre jamais le besoin de GM (restriction respectée)', async () => {
    await ensureSeed();
    await createProduct({ name: 'Yaourt aux fruits', categoryId: 'cat-laitiers', unit: 'pot', quantity: 6, essential: false, perishable: true, familyId: 'fam-yaourts', variant: 'aux fruits', tags: ['laitage', 'sucre'] });
    await setQuantity('p-yaourt', 0);
    const r = await createRecipe({ name: 'Collation yaourt', servings: 1, ingredients: [{ productId: 'p-yaourt', quantity: 1, unit: 'pot', role: 'laitage', scaling: 'linéaire' }] });
    await createMeal({ date: '2026-11-02', slot: 'collation-matin', recipeIds: [r.id], personIds: ['person-gm'] });
    const dash = await loadDashboard('2026-11-02', 3);
    expect(dash.shortagesToday.map((s) => s.productId)).toContain('p-yaourt');
  });
});

describe('Migration des données existantes (schéma v2, données initiales v2)', () => {
  it('ajoute les familles sans écraser les données de l’utilisateur', async () => {
    await ensureSeed();
    // Simule une installation v1 : pas de familles, produits sans famille, une fiche modifiée par l'utilisateur.
    await db.families.clear();
    for (const p of await db.products.toArray()) await db.products.update(p.id, { familyId: undefined, variant: undefined, format: undefined });
    await db.products.update('p-riz', { name: 'Mon riz', userModified: true, quantity: 4 });
    await db.meta.put({ key: 'seedVersion', value: 1 });
    await db.meta.put({ key: 'seedKeys', value: ((await db.meta.get('seedKeys'))!.value as string[]).filter((k) => !k.startsWith('family:')) });
    expect(await ensureSeed()).toBe('mis à jour');
    expect(await db.families.count()).toBeGreaterThan(50);
    expect((await db.products.get('p-riz'))!).toMatchObject({ name: 'Mon riz', quantity: 4, familyId: 'fam-riz', variant: 'basmati' });
    expect((await db.products.get('p-yaourt'))!).toMatchObject({ familyId: 'fam-yaourts', variant: 'nature 0 %' });
  });
  it('restaure une sauvegarde v1 et complète les familles', async () => {
    await ensureSeed();
    const backup = await exportAll();
    const v1 = { ...backup, schemaVersion: 1, tables: { ...backup.tables, families: undefined, prices: undefined, receipts: undefined, meta: [{ key: 'seedVersion', value: 1 }] } };
    freshDb();
    await restoreBackup(JSON.parse(JSON.stringify(v1)));
    expect(await db.families.count()).toBeGreaterThan(50);
    expect((await db.meta.get('seedVersion'))!.value).toBe(2);
  });
});
