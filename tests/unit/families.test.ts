import EXAMPLE_TEXT from '../../examples/recu-exemple.json?raw';
import FORMAT_DOC from '../../IMPORT_FORMAT.md?raw';
import { describe, expect, it } from 'vitest';
import { allocateStock, convertBetween, familyStock, relation } from '../../src/domain/families';
import { aggregateRequirements, mealRequirements, type Diner } from '../../src/domain/portions';
import { matchItem, normalizeMeasure, parseReceipt, receiptFingerprint, stockQuantityFor } from '../../src/domain/receipt';
import { buildReceiptPrompt, RECEIPT_EXAMPLE } from '../../src/domain/receiptPrompt';
import { proposeShoppingLines } from '../../src/domain/shopping';
import { mealFeasibility } from '../../src/domain/suggestions';
import type { DietProfile, Product, ProductFamily, Recipe } from '../../src/domain/types';

const now = '2026-11-02T00:00:00.000Z';
const on = '2026-11-02';
const product = (p: Partial<Product> & { id: string; unit: Product['unit'] }): Product => ({
  name: p.id, categoryId: 'cat-fruits', quantity: 0, currency: 'CAD', essential: true, perishable: false, tags: [], createdAt: now, updatedAt: now, ...p,
});
const family = (f: Partial<ProductFamily> & { id: string; substitution: ProductFamily['substitution'] }): ProductFamily => ({
  name: f.id, categoryId: 'cat-fruits', createdAt: now, updatedAt: now, ...f,
});
const profile = (p: Partial<DietProfile> & { id: string }): DietProfile => ({
  name: p.id, rules: [], portionRules: [], portionFactors: {}, plateAdditions: [], createdAt: now, updatedAt: now, ...p,
});
const recipe = (r: Partial<Recipe> & { id: string; ingredients: Recipe['ingredients'] }): Recipe => ({
  name: r.id, category: 'Desserts', servings: 1, prepMinutes: 5, cookMinutes: 0, difficulty: 'facile', steps: [], cookingMethods: ['cru'], tags: [],
  quantitySource: 'indicatif', createdAt: now, updatedAt: now, ...r,
});
const map = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
const need = (productId: string, quantity: number, unit: Product['unit'] = 'unité', extra = {}) => ({ productId, quantity, unit, optional: false, sources: ['repas'], ...extra });

const raisins = family({ id: 'fam-raisins', name: 'Raisins', substitution: 'interchangeable' });
const yaourts = family({ id: 'fam-yaourts', name: 'Yaourts', categoryId: 'cat-laitiers', substitution: 'à confirmer' });
const tomates = family({ id: 'fam-tomates', name: 'Tomates', categoryId: 'cat-legumes', substitution: 'non' });
const families = map([raisins, yaourts, tomates]);

const rouges = product({ id: 'rouges', name: 'Raisins rouges', unit: 'grappe', familyId: 'fam-raisins', variant: 'rouges', quantity: 0 });
const verts = product({ id: 'verts', name: 'Raisins verts', unit: 'grappe', familyId: 'fam-raisins', variant: 'verts', quantity: 3 });
const secs = product({ id: 'secs', name: 'Raisins secs', unit: 'sac', familyId: 'fam-raisins', variant: 'secs', quantity: 2, tags: ['raisin-sec'] });
const nature = product({ id: 'nature', name: 'Yaourt nature 0 %', unit: 'pot', familyId: 'fam-yaourts', variant: 'nature 0 %', quantity: 0, tags: ['laitage-maigre'] });
const natureB = product({ id: 'natureB', name: 'Yaourt nature 0 % (autre marque)', unit: 'pot', familyId: 'fam-yaourts', variant: 'Nature 0 %', brand: 'B', quantity: 2 });
const fruits = product({ id: 'fruits', name: 'Yaourt aux fruits', unit: 'pot', familyId: 'fam-yaourts', variant: 'aux fruits', quantity: 4, tags: ['sucre'] });
const fraiches = product({ id: 'fraiches', name: 'Tomates fraîches', unit: 'unité', familyId: 'fam-tomates', variant: 'fraîches', quantity: 0 });
const conserve = product({ id: 'conserve', name: 'Tomates en conserve', unit: 'boîte', familyId: 'fam-tomates', variant: 'en conserve', quantity: 5, tags: ['conserve'] });

const gm = profile({ id: 'gm', rules: [
  { id: 'r1', kind: 'éviter', label: 'Raisins secs', tags: ['raisin-sec'] },
  { id: 'r2', kind: 'éviter', label: 'Sucre', tags: ['sucre'] },
  { id: 'r3', kind: 'éviter', label: 'Conserves', tags: ['conserve'] },
] });

describe('Familles et variantes (regroupement)', () => {
  it('distingue variantes équivalentes, à confirmer et non interchangeables', () => {
    expect(relation(rouges, verts, families)).toBe('équivalent');
    expect(relation(nature, natureB, families)).toBe('équivalent'); // même variante, autre marque
    expect(relation(nature, fruits, families)).toBe('à confirmer');
    expect(relation(fraiches, conserve, families)).toBeNull();
    expect(relation(rouges, verts, families, true)).toBe('à confirmer'); // la recette exige la variante
    expect(relation(rouges, nature, families)).toBeNull();
  });
  it('donne le stock global de la famille et le détail des variantes, sans conversion inventée', () => {
    const s = familyStock(yaourts, [nature, natureB, fruits, product({ id: 'pack', unit: 'pack', familyId: 'fam-yaourts', quantity: 1 }), product({ id: 'x', unit: 'pot', familyId: 'fam-yaourts', quantity: null })]);
    expect(s.variants).toHaveLength(5);
    expect(s.totals).toEqual([{ unit: 'pot', quantity: 6 }, { unit: 'pack', quantity: 1 }]);
    expect(s.text).toBe('6 pots + 1 pack · 1 inconnue');
    // Avec une unité de famille et des conversions connues, les formats sont additionnés.
    const withUnit = familyStock({ ...yaourts, unit: 'g' }, [
      product({ id: 'a', unit: 'pot', familyId: 'fam-yaourts', quantity: 2, conversions: [{ unit: 'pot', amount: 750, to: 'g' }] }),
      product({ id: 'b', unit: 'pack', familyId: 'fam-yaourts', quantity: 1, conversions: [{ unit: 'pack', amount: 400, to: 'g' }] }),
      product({ id: 'c', unit: 'pot', familyId: 'fam-yaourts', quantity: 1 }),
    ]);
    expect(withUnit.totals).toEqual([{ unit: 'g', quantity: 1900 }, { unit: 'pot', quantity: 1 }]);
  });
});

describe('Conversions de formats (seulement si elles sont fiables)', () => {
  it('convertit entre produits via les conversions connues, sinon refuse', () => {
    const barquette = product({ id: 'b', unit: 'barquette', conversions: [{ unit: 'barquette', amount: 500, to: 'g' }] });
    const grappe = product({ id: 'g', unit: 'grappe', conversions: [{ unit: 'grappe', amount: 250, to: 'g' }] });
    const kilo = product({ id: 'k', unit: 'kg' });
    expect(convertBetween(1, barquette, grappe)).toBe(2);
    expect(convertBetween(2, barquette, kilo)).toBe(1);
    expect(convertBetween(1, product({ id: 'b2', unit: 'barquette' }), product({ id: 'g2', unit: 'grappe' }))).toBeNull();
  });
  it('calcule la quantité à ajouter au stock depuis le format du reçu', () => {
    const { receipt } = parseReceipt(EXAMPLE_TEXT, on);
    const [raisin, yaourt, pack, riz, plantain] = receipt.items;
    expect(stockQuantityFor(riz, { unit: 'kg' })).toBe(2); // sac de 2 kg
    expect(stockQuantityFor(pack, { unit: 'pot' })).toBe(4); // pack de 4 pots
    expect(stockQuantityFor(yaourt, { unit: 'pot' })).toBe(2);
    expect(stockQuantityFor(yaourt, { unit: 'g' })).toBe(1500); // 2 × 750 g imprimés sur le format
    expect(stockQuantityFor(raisin, { unit: 'kg' })).toBe(0.907);
    expect(stockQuantityFor(raisin, { unit: 'grappe' })).toBeNull(); // barquette ≠ grappe : à préciser
    expect(stockQuantityFor(plantain, { unit: 'unité' })).toBe(4);
    expect(stockQuantityFor(plantain, { unit: 'kg' })).toBe(1.315); // poids pesé : 2,9 lb
    expect(normalizeMeasure(2, 'lb')).toEqual({ quantity: 0.907, unit: 'kg' });
    expect(normalizeMeasure(3, 'barquettes')).toEqual({ quantity: 3, unit: 'barquette' });
    expect(normalizeMeasure(1, 'casseau')).toEqual({ quantity: 1, unit: 'barquette' });
  });
});

describe('Équivalences dans les besoins (pas de faux manque)', () => {
  const products = map([rouges, verts, secs, nature, natureB, fruits, fraiches, conserve]);
  it('les raisins verts couvrent un besoin de raisins rouges : aucun achat proposé', () => {
    const needs = new Map([['rouges', need('rouges', 2, 'grappe')]]);
    const opts = { includeLowStock: false, includeOptional: false, on };
    expect(proposeShoppingLines([...products.values()], needs, opts).map((l) => l.productId)).toEqual(['rouges']); // sans familles
    expect(proposeShoppingLines([...products.values()], needs, { ...opts, families })).toEqual([]);
    const c = allocateStock([...needs.values()], products, families, new Map(), on).coverage.get('rouges')!;
    expect(c.shortfall).toBe(0);
    expect(c.uses).toEqual([{ productId: 'verts', name: 'Raisins verts', quantity: 2, sourceQuantity: 2, sourceUnit: 'grappe' }]);
  });
  it('ne compte pas deux fois le même stock pour deux besoins', () => {
    const needs = [need('rouges', 2, 'grappe'), need('verts', 2, 'grappe')];
    const alloc = allocateStock(needs, products, families, new Map(), on);
    expect(alloc.coverage.get('verts')!.fromOwn).toBe(2);
    expect(alloc.coverage.get('rouges')!.covered).toBe(1);
    expect(alloc.coverage.get('rouges')!.shortfall).toBe(1);
    const lines = proposeShoppingLines([...products.values()], new Map(needs.map((n) => [n.productId, n])), { includeLowStock: false, includeOptional: false, on, families });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ productId: 'rouges', quantity: 1 });
    expect(lines[0].reasons.some((r) => r.includes('Couvert par Raisins verts'))).toBe(true);
  });
  it('propose sans l’appliquer une variante à confirmer', () => {
    const needs = new Map([['nature', need('nature', 3, 'pot')]]);
    const alloc = allocateStock([...needs.values()], products, families, new Map(), on).coverage.get('nature')!;
    expect(alloc.uses.map((u) => u.productId)).toEqual(['natureB']); // même variante, autre marque : compté
    expect(alloc.shortfall).toBe(1);
    expect(alloc.proposals.map((p) => [p.productId, p.why])).toEqual([['fruits', 'à confirmer']]);
    const [line] = proposeShoppingLines([...products.values()], needs, { includeLowStock: false, includeOptional: false, on, families });
    expect(line.quantity).toBe(1);
    expect(line.reasons.some((r) => r.startsWith('À confirmer : Yaourt aux fruits'))).toBe(true);
  });
  it('tomates fraîches et en conserve ne se remplacent pas', () => {
    const c = allocateStock([need('fraiches', 4)], products, families, new Map(), on).coverage.get('fraiches')!;
    expect(c.uses).toEqual([]);
    expect(c.proposals).toEqual([]);
    expect(c.shortfall).toBe(4);
  });
  it('un stock inconnu couvert par une référence équivalente ne déclenche pas d’achat', () => {
    const unknownRed = { ...rouges, quantity: null };
    const lines = proposeShoppingLines([unknownRed, verts], new Map([['rouges', need('rouges', 2, 'grappe')]]), { includeLowStock: false, includeOptional: false, on, families });
    expect(lines).toEqual([]);
  });
  it('le seuil s’apprécie sur les références équivalentes et un seul produit est réapprovisionné', () => {
    const fam = family({ id: 'fam-pq', substitution: 'interchangeable' });
    const a = product({ id: 'pq-a', unit: 'rouleau', familyId: 'fam-pq', quantity: 1, minQuantity: 4, targetQuantity: 12, purchaseDate: '2026-10-01' });
    const b = product({ id: 'pq-b', unit: 'rouleau', familyId: 'fam-pq', quantity: 10, minQuantity: 4, targetQuantity: 12 });
    const opts = { includeLowStock: true, includeOptional: false, on, families: map([fam]) };
    expect(proposeShoppingLines([a, b], new Map(), opts)).toEqual([]); // 11 rouleaux en tout : pas sous le seuil
    const lowA = { ...a, quantity: 1 };
    const lowB = { ...b, quantity: 2 };
    const lines = proposeShoppingLines([lowA, lowB], new Map(), opts);
    expect(lines.map((l) => [l.productId, l.quantity])).toEqual([['pq-a', 9]]); // 12 − 3, une seule ligne
  });
});

describe('Restrictions alimentaires et remplacements', () => {
  const products = map([rouges, verts, secs, nature, natureB, fruits, fraiches, conserve]);
  const diners: Diner[] = [{ personId: 'gm', name: 'GM', profiles: [gm] }];
  it('n’utilise jamais une variante interdite pour un profil (raisins secs, yaourt sucré, conserve)', () => {
    const p = new Map([['gm', gm]]);
    const noGreen = new Map(products);
    noGreen.set('verts', { ...verts, quantity: 0 });
    const r = allocateStock([need('rouges', 1, 'grappe', { profileIds: ['gm'] })], noGreen, families, p, on).coverage.get('rouges')!;
    expect(r.uses).toEqual([]); // les raisins secs (même famille interchangeable) sont exclus pour GM
    expect(r.proposals).toEqual([]);
    const y = allocateStock([need('nature', 3, 'pot', { profileIds: ['gm'] })], products, families, p, on).coverage.get('nature')!;
    expect(y.proposals.map((x) => x.productId)).not.toContain('fruits');
    // Sans profil restrictif, les raisins secs couvriraient le besoin (même famille interchangeable)… s'ils étaient convertibles.
    const free = allocateStock([need('rouges', 1, 'grappe')], noGreen, families, new Map(), on).coverage.get('rouges')!;
    expect(free.proposals.map((x) => [x.productId, x.why])).toEqual([['secs', 'conversion inconnue']]);
  });
  it('les suggestions de recettes utilisent les variantes autorisées et gardent le détail', () => {
    const dessert = recipe({ id: 'dessert', ingredients: [{ productId: 'rouges', quantity: 1, unit: 'grappe', role: 'fruit', scaling: 'linéaire' }] });
    const f = mealFeasibility('Dessert', [dessert], diners, 'collation-matin', products, on, 3, families);
    expect(f.missing).toEqual([]);
    expect(f.available[0].via).toEqual(['Raisins verts']);
    expect(f.violations).toEqual([]);
    const reqs = mealRequirements([dessert], diners, 'collation-matin', 'x');
    expect(reqs[0].profileIds).toEqual(['gm']);
    expect(aggregateRequirements(reqs, products).needs.get('rouges')!.profileIds).toEqual(['gm']);
  });
});

describe('Lecture du fichier de reçu', () => {
  it('lit l’exemple documenté (examples/recu-exemple.json)', () => {
    const text = EXAMPLE_TEXT;
    const { receipt, warnings } = parseReceipt(text, on);
    expect(warnings).toEqual([]);
    expect(receipt.store).toBe('Maxi');
    expect(receipt.items).toHaveLength(6);
    expect(receipt.items[0]).toMatchObject({ receiptName: 'RAISIN VERT S/PEP', quantity: 1, unit: 'barquette', discount: 1.5, paid: 4.49 });
    expect(receipt.items[4].weight).toEqual({ quantity: 1.315, unit: 'kg' });
  });
  it('l’exemple minimal de IMPORT_FORMAT.md est valide', () => {
    const block = FORMAT_DOC.split('```json').pop()!;
    const { receipt, warnings } = parseReceipt(block, on);
    expect(warnings).toEqual([]);
    expect(receipt.items[0]).toMatchObject({ receiptName: 'RIZ BASMATI 2KG', paid: 7.99, discount: 1 });
    expect(stockQuantityFor(receipt.items[0], { unit: 'kg' })).toBe(2);
  });
  it('tolère un bloc ```json, des nombres à virgule et signale ce qui manque', () => {
    const text = '```json\n{"format":"maison-courses-recu","version":1,"recu":{"date":"28/10/2026"},"articles":[{"nomRecu":"LAIT 2L","prixPaye":"4,99","rabais":-0.5}, {"nomRecu":"RETOUR","quantite":-1,"unite":"u","prixPaye":-3}]}\n```';
    const { receipt, warnings } = parseReceipt(text, on);
    expect(receipt.date).toBe(on);
    expect(warnings.join(' ')).toContain('Date « 28/10/2026 » illisible');
    expect(receipt.items[0]).toMatchObject({ paid: 4.99, discount: 0.5, quantity: 1, uncertain: ['quantite'] });
    expect(receipt.items[1].isReturn).toBe(true);
    expect(() => parseReceipt('{"format":"maison-courses-recu","version":9,"articles":[{}]}', on)).toThrow(/version plus récente/);
    expect(() => parseReceipt('pas du json', on)).toThrow();
  });
  it('l’empreinte ne dépend pas de la mise en forme du fichier', () => {
    const a = parseReceipt(RECEIPT_EXAMPLE, on).receipt;
    const b = parseReceipt(JSON.stringify(JSON.parse(JSON.stringify(RECEIPT_EXAMPLE)), null, 4), on).receipt;
    expect(receiptFingerprint(a)).toBe(receiptFingerprint(b));
    const changed = parseReceipt({ ...RECEIPT_EXAMPLE, recu: { ...RECEIPT_EXAMPLE.recu, total: 99 } }, on).receipt;
    expect(receiptFingerprint(changed)).not.toBe(receiptFingerprint(a));
  });
  it('reconnaît les produits : identifiant, nom appris, nom, famille, variante', () => {
    const cats = [{ id: 'cat-fruits', name: 'Fruits', icon: '', kind: 'alimentaire' as const, order: 0, createdAt: now, updatedAt: now }];
    const items = parseReceipt({ format: 'maison-courses-recu', version: 1, recu: { date: on }, articles: [
      { nomRecu: 'X', produit: { id: 'verts' } },
      { nomRecu: 'RSN RGE', produit: { nom: 'Quelque chose' } },
      { nomRecu: 'RAISINS VERTS', produit: { nom: 'raisins verts' } },
      { nomRecu: 'RAISIN NOIR', produit: { famille: 'raisin', variante: 'noirs', categorie: 'Fruits' } },
      { nomRecu: 'YOGOURT', produit: { famille: 'Yaourts', variante: 'nature 0 %' } },
    ] }, on).receipt.items;
    const prods = [verts, { ...rouges, receiptNames: ['rsn rge'] }, natureB, nature];
    const m = items.map((i) => matchItem(i, prods, [...families.values()], cats));
    expect(m[0]).toMatchObject({ productId: 'verts', confidence: 'sûre' });
    expect(m[1]).toMatchObject({ productId: 'rouges', confidence: 'sûre' });
    expect(m[2]).toMatchObject({ productId: 'verts', confidence: 'sûre' });
    expect(m[3]).toMatchObject({ confidence: 'aucune', familyId: 'fam-raisins', categoryId: 'cat-fruits' }); // nouvelle variante
    expect(m[3].productId).toBeUndefined();
    expect(m[4]).toMatchObject({ productId: 'natureB', confidence: 'probable' });
  });
  it('les consignes pour ChatGPT contiennent le format et la liste des produits', () => {
    const text = buildReceiptPrompt([verts, nature], [...families.values()], []);
    expect(text).toContain('"format": "maison-courses-recu"');
    expect(text).toContain('- verts | Raisins verts | famille Raisins | variante verts | unité grappe');
  });
});
