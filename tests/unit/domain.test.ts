import { describe, expect, it } from 'vitest';
import { aggregateRequirements, mealRequirements, scaleRecipe, type Diner } from '../../src/domain/portions';
import { checkMeal } from '../../src/domain/restrictions';
import { listTotals, proposeShoppingLines, quantityToBuy } from '../../src/domain/shopping';
import { productAlerts, stockLevel, usableQuantity } from '../../src/domain/stock';
import type { DietProfile, Product, Recipe } from '../../src/domain/types';
import { convert, roundUpToStep } from '../../src/domain/units';

const now = '2026-11-02T00:00:00.000Z';
const product = (p: Partial<Product> & { id: string; unit: Product['unit'] }): Product => ({
  name: p.id, categoryId: 'cat', quantity: 0, currency: 'CAD', essential: true, perishable: false, tags: [], createdAt: now, updatedAt: now, ...p,
});
const profile = (p: Partial<DietProfile> & { id: string }): DietProfile => ({
  name: p.id, rules: [], portionRules: [], portionFactors: {}, plateAdditions: [], createdAt: now, updatedAt: now, ...p,
});
const recipe = (r: Partial<Recipe> & { id: string; ingredients: Recipe['ingredients'] }): Recipe => ({
  name: r.id, category: 'Plats', servings: 3, prepMinutes: 10, cookMinutes: 10, difficulty: 'facile', steps: [], cookingMethods: ['eau'], tags: [],
  quantitySource: 'indicatif', createdAt: now, updatedAt: now, ...r,
});

describe('Unités', () => {
  it('convertit dans une même famille et via les conversions du produit', () => {
    expect(convert(1500, 'g', 'kg')).toBe(1.5);
    expect(convert(2, 'douzaine', 'unité')).toBe(24);
    expect(convert(600, 'g', 'paquet', { conversions: [{ unit: 'paquet', amount: 300, to: 'g' }] })).toBe(2);
    expect(convert(1, 'paquet', 'kg', { conversions: [{ unit: 'paquet', amount: 300, to: 'g' }] })).toBe(0.3);
    expect(convert(2, 'tranche', 'pain')).toBeNull();
  });
  it('arrondit aux formats de vente', () => {
    expect(roundUpToStep(1.2, 0.5)).toBe(1.5);
    expect(roundUpToStep(1.5, 0.5)).toBe(1.5);
    expect(roundUpToStep(0.46, 0.45)).toBe(0.9);
    expect(roundUpToStep(2.3)).toBe(2.3);
  });
});

describe('Stock inconnu versus stock nul (test 2)', () => {
  it('distingue inconnu, épuisé, bas et suffisant', () => {
    expect(stockLevel({ quantity: null, minQuantity: 1 })).toBe('inconnu');
    expect(stockLevel({ quantity: 0, minQuantity: 1 })).toBe('épuisé');
    expect(stockLevel({ quantity: 0.4, minQuantity: 0.5 })).toBe('bas');
    expect(stockLevel({ quantity: 1.2, minQuantity: 0.5 })).toBe('ok');
  });
  it('un stock inconnu ne génère pas d’alerte « absent »', () => {
    const p = product({ id: 'riz', unit: 'kg', quantity: null, minQuantity: 0.5 });
    const kinds = productAlerts(p, '2026-11-02', 3).map((a) => a.kind);
    expect(kinds).not.toContain('absent');
    expect(kinds).not.toContain('sous le seuil');
  });
});

describe('Détection d’un stock insuffisant (test 3)', () => {
  it('signale absent, sous le seuil, péremption proche et consommation prévue', () => {
    expect(productAlerts(product({ id: 'a', unit: 'kg', quantity: 0 }), '2026-11-02', 3).map((a) => a.kind)).toContain('absent');
    expect(productAlerts(product({ id: 'b', unit: 'kg', quantity: 0.2, minQuantity: 0.5 }), '2026-11-02', 3).map((a) => a.kind)).toContain('sous le seuil');
    expect(productAlerts(product({ id: 'c', unit: 'unité', quantity: 3, expiryDate: '2026-11-04' }), '2026-11-02', 3).map((a) => a.kind)).toContain('péremption proche');
    expect(productAlerts(product({ id: 'd', unit: 'kg', quantity: 1 }), '2026-11-02', 3, 2).map((a) => a.kind)).toContain('consommation prévue');
  });
  it('un produit périmé n’est pas compté comme utilisable', () => {
    expect(usableQuantity(product({ id: 'x', unit: 'unité', quantity: 4, expiryDate: '2026-11-01' }), '2026-11-02')).toBe(0);
  });
});

describe('Recettes et portions (tests 4 et 5)', () => {
  const r = recipe({
    id: 'riz-sauce', servings: 3,
    ingredients: [
      { productId: 'riz', quantity: 300, unit: 'g', role: 'féculent', scaling: 'linéaire' },
      { productId: 'epices', quantity: 4, unit: 'g', role: 'assaisonnement', scaling: 'modéré' },
      { productId: 'laurier', quantity: 1, unit: 'unité', role: 'assaisonnement', scaling: 'fixe' },
    ],
  });
  it('recalcule linéairement de 3 à 5 portions, sans multiplier les épices linéairement', () => {
    const scaled = scaleRecipe(r, 5);
    expect(scaled.find((i) => i.productId === 'riz')!.quantity).toBe(500);
    const spice = scaled.find((i) => i.productId === 'epices')!.quantity;
    expect(spice).toBeGreaterThan(4);
    expect(spice).toBeLessThan(4 * 5 / 3);
    expect(scaled.find((i) => i.productId === 'laurier')!.quantity).toBe(1);
  });
  it('applique des portions individuelles différentes à un plat commun', () => {
    const gm = profile({ id: 'gm' });
    const nous = profile({ id: 'nous', portionFactors: { féculent: 1.5 } });
    const diners: Diner[] = [
      { personId: 'a', name: 'GM', profiles: [gm] },
      { personId: 'b', name: 'Moi', profiles: [nous] },
      { personId: 'c', name: 'Mère', profiles: [nous] },
    ];
    const reqs = mealRequirements([r], diners, 'déjeuner', 'Test');
    // 1 + 1,5 + 1,5 = 4 portions de féculent → 300 × 4/3 = 400 g
    expect(reqs.find((x) => x.productId === 'riz')!.quantity).toBeCloseTo(400);
  });
  it('compte les ajouts réservés à un profil, par personne', () => {
    const nous = profile({ id: 'nous' });
    const gm = profile({ id: 'gm', plateAdditions: [{ slot: 'dîner', productId: 'pain', quantity: 1 / 3, unit: 'pain', label: 'pain' }] });
    const rr = recipe({ id: 'pdj', ingredients: [{ productId: 'avocat', quantity: 1, unit: 'unité', role: 'fruit', scaling: 'linéaire', onlyForProfileIds: ['nous'] }] });
    const diners: Diner[] = [
      { personId: 'a', name: 'GM', profiles: [gm] },
      { personId: 'b', name: 'Moi', profiles: [nous] },
      { personId: 'c', name: 'Mère', profiles: [nous] },
    ];
    const reqs = mealRequirements([rr], diners, 'dîner', 'Soir');
    expect(reqs.find((x) => x.productId === 'avocat')!.quantity).toBe(2);
    expect(reqs.find((x) => x.productId === 'pain')!.quantity).toBeCloseTo(1 / 3);
  });
});

describe('Regroupement des ingrédients communs (test 8)', () => {
  it('additionne les tomates de trois recettes en une seule ligne, avec conversion', () => {
    const products = new Map([['tomate', product({ id: 'tomate', unit: 'kg' })]]);
    const { needs } = aggregateRequirements(
      [
        { productId: 'tomate', quantity: 500, unit: 'g', optional: false, sources: ['A'] },
        { productId: 'tomate', quantity: 0.3, unit: 'kg', optional: false, sources: ['B'] },
        { productId: 'tomate', quantity: 200, unit: 'g', optional: false, sources: ['C'] },
      ],
      products,
    );
    expect(needs.size).toBe(1);
    expect(needs.get('tomate')!.quantity).toBe(1);
    expect(needs.get('tomate')!.sources).toEqual(['A', 'B', 'C']);
  });
});

describe('Génération de la liste et déduction des stocks (tests 6 et 7)', () => {
  const on = '2026-11-02';
  it('n’achète rien si le stock suffit, même si le stock projeté passe sous le seuil', () => {
    const p = product({ id: 'riz', unit: 'kg', quantity: 1.2, minQuantity: 0.5, targetQuantity: 3 });
    expect(quantityToBuy(p, 1, { includeLowStock: true, on })).toBeNull();
  });
  it('achète uniquement le manque des menus', () => {
    const p = product({ id: 'tilapia', unit: 'kg', quantity: 1, minQuantity: 0.5 });
    expect(quantityToBuy(p, 2.6, { includeLowStock: true, on })!.raw).toBeCloseTo(1.6);
  });
  it('réapprovisionne jusqu’à la cible un produit déjà sous le seuil : besoin + cible − stock', () => {
    const p = product({ id: 'riz', unit: 'kg', quantity: 0.2, minQuantity: 0.5, targetQuantity: 3 });
    expect(quantityToBuy(p, 1, { includeLowStock: true, on })!.raw).toBeCloseTo(3.8);
    expect(quantityToBuy(p, 1, { includeLowStock: false, on })!.raw).toBeCloseTo(0.8);
  });
  it('stock inconnu : propose le besoin, signalé à vérifier', () => {
    const p = product({ id: 'x', unit: 'kg', quantity: null });
    const res = quantityToBuy(p, 1, { includeLowStock: true, on })!;
    expect(res.stockUnknown).toBe(true);
    expect(res.raw).toBe(1);
    expect(quantityToBuy(p, 0, { includeLowStock: true, on })).toBeNull();
  });
  it('propose une ligne par produit, arrondie au format de vente, avec le coût estimé', () => {
    const gombo = product({ id: 'gombo', unit: 'paquet', quantity: 0, unitPrice: 3.5, purchaseStep: 1 });
    const riz = product({ id: 'riz', unit: 'kg', quantity: 5, unitPrice: 5 });
    const needs = new Map([
      ['gombo', { productId: 'gombo', quantity: 1.3, unit: 'paquet' as const, optional: false, sources: ['a', 'b'] }],
      ['riz', { productId: 'riz', quantity: 1, unit: 'kg' as const, optional: false, sources: ['c'] }],
    ]);
    const lines = proposeShoppingLines([gombo, riz], needs, { includeLowStock: true, includeOptional: true, on });
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
    expect(lines[0].estTotal).toBe(7);
  });
  it('achète des unités entières pour les produits vendus à la pièce', () => {
    const plantain = product({ id: 'plantain', unit: 'unité', quantity: null, unitPrice: 1.25 });
    const needs = new Map([['plantain', { productId: 'plantain', quantity: 13.33, unit: 'unité' as const, optional: false, sources: ['a'] }]]);
    const [line] = proposeShoppingLines([plantain], needs, { includeLowStock: false, includeOptional: false, on, alreadyListed: new Map([['plantain', 12]]) });
    expect(line.quantity).toBe(2);
    expect(line.reasons.join(' ')).toMatch(/déjà sur une autre liste/);
  });
  it('déduit ce qui est déjà prévu sur une autre liste', () => {
    const p = product({ id: 'oeufs', unit: 'douzaine', quantity: 0 });
    expect(quantityToBuy(p, 2, { includeLowStock: false, on }, 2)).toBeNull();
  });
  it('totalise le budget : estimé, dépensé, écart', () => {
    const t = listTotals([
      { status: 'acheté', estTotal: 10, actualPrice: 12, priority: 'essentiel' },
      { status: 'à acheter', estTotal: 5, priority: 'optionnel' },
      { status: 'retiré', estTotal: 100, priority: 'essentiel' },
      { status: 'indisponible', estTotal: 7, priority: 'essentiel' },
    ]);
    expect(t.estimated).toBe(15);
    expect(t.spent).toBe(12);
    expect(t.variance).toBe(2);
    expect(t.optionalEstimate).toBe(5);
    expect(t.counts).toEqual({ total: 3, todo: 1, bought: 1, unavailable: 1 });
  });
});

describe('Restrictions alimentaires actives (test 12)', () => {
  const products = new Map<string, Product>([
    ['avocat', product({ id: 'avocat', unit: 'unité', tags: ['avocat'] })],
    ['plantain', product({ id: 'plantain', unit: 'unité', tags: ['plantain'] })],
    ['huile', product({ id: 'huile', unit: 'bouteille', tags: ['huile'] })],
  ]);
  const gm = profile({
    id: 'gm',
    rules: [
      { id: 'r1', kind: 'éviter', label: 'Avocat', tags: ['avocat'] },
      { id: 'r2', kind: 'cuisson', label: 'Cuissons', allowedMethods: ['eau', 'four'] },
      { id: 'r3', kind: 'limite', label: 'Huile', limitTag: 'huile', max: 15, unit: 'ml', per: 'repas' },
    ],
  });
  it('refuse un ingrédient interdit dans le plat commun', () => {
    const r = recipe({ id: 'salade', ingredients: [{ productId: 'avocat', quantity: 1, unit: 'unité', role: 'fruit', scaling: 'linéaire' }] });
    expect(checkMeal([r], gm, products)).toHaveLength(1);
  });
  it('accepte l’ingrédient s’il est réservé à l’assiette d’un autre profil', () => {
    const r = recipe({ id: 'pdj', ingredients: [{ productId: 'avocat', quantity: 1, unit: 'unité', role: 'fruit', scaling: 'linéaire', onlyForProfileIds: ['nous'] }] });
    expect(checkMeal([r], gm, products)).toHaveLength(0);
  });
  it('refuse une friture et un excès d’huile par repas', () => {
    const alloco = recipe({ id: 'alloco', cookingMethods: ['friture'], ingredients: [{ productId: 'plantain', quantity: 3, unit: 'unité', role: 'féculent', scaling: 'linéaire' }] });
    expect(checkMeal([alloco], gm, products).map((v) => v.rule.kind)).toContain('cuisson');
    const a = recipe({ id: 'a', ingredients: [{ productId: 'huile', quantity: 1, unit: 'c. à soupe', role: 'matière grasse', scaling: 'fixe', toTaste: true }] });
    const b = recipe({ id: 'b', ingredients: [{ productId: 'huile', quantity: 1, unit: 'c. à café', role: 'matière grasse', scaling: 'fixe', toTaste: true }] });
    expect(checkMeal([a], gm, products)).toHaveLength(0);
    expect(checkMeal([a, b], gm, products).map((v) => v.rule.kind)).toContain('limite');
  });
});
