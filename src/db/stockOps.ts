import type { ID, MovementType, Product, StockMovement, Unit } from '../domain/types';
import { roundNice } from '../domain/units';
import { db } from './db';
import { nowISO, uid, ValidationError } from './util';

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'currency' | 'tags'> & {
  currency?: string;
  tags?: string[];
};

function validateProduct(p: Partial<Product>) {
  if (p.name !== undefined && !p.name.trim()) throw new ValidationError('Le nom du produit est obligatoire.');
  if (p.categoryId !== undefined && !p.categoryId) throw new ValidationError('La catégorie est obligatoire.');
  for (const k of ['quantity', 'minQuantity', 'targetQuantity', 'unitPrice', 'purchaseStep', 'usualWeeklyConsumption'] as const) {
    const v = p[k];
    if (v !== undefined && v !== null && (!Number.isFinite(v) || v < 0)) throw new ValidationError('Les quantités et les prix doivent être des nombres positifs.');
  }
  if (p.minQuantity !== undefined && p.targetQuantity !== undefined && p.targetQuantity < p.minQuantity) {
    throw new ValidationError('La quantité cible doit être supérieure ou égale au seuil minimal.');
  }
}

interface ChangeInput {
  productId: ID;
  type: MovementType;
  /** Variation relative… */
  delta?: number;
  /** …ou nouvelle valeur absolue (`null` = inconnue). */
  setTo?: number | null;
  key?: string;
  note?: string;
  sourceType?: StockMovement['sourceType'];
  sourceId?: ID;
  unit?: Unit;
  extra?: Partial<StockMovement>;
}

/**
 * Applique un changement de stock et l'enregistre dans l'historique, dans la transaction en cours.
 * Idempotent : si un mouvement porte déjà la même clé, rien n'est appliqué et ce mouvement est renvoyé.
 */
export async function applyStockChange(input: ChangeInput): Promise<StockMovement> {
  const key = input.key ?? uid('mv');
  const existing = await db.movements.where('key').equals(key).first();
  if (existing) return existing;
  const p = await db.products.get(input.productId);
  if (!p) throw new ValidationError('Produit introuvable.');
  const before = p.quantity;
  let after: number | null;
  let delta: number | null;
  if (input.setTo !== undefined) {
    after = input.setTo === null ? null : roundNice(Math.max(0, input.setTo));
    delta = after === null || before === null ? null : roundNice(after - before);
  } else {
    const d = input.delta ?? 0;
    if (before === null) {
      // Stock précédent inconnu : un ajout donne au moins la quantité ajoutée ; un retrait reste inconnu.
      after = d > 0 ? roundNice(d) : null;
    } else {
      after = roundNice(Math.max(0, before + d));
    }
    delta = before === null ? d : roundNice((after ?? 0) - before);
  }
  const mv: StockMovement = {
    id: uid('mv'),
    productId: p.id,
    type: input.type,
    delta,
    before,
    after,
    unit: input.unit ?? p.unit,
    at: nowISO(),
    note: input.note,
    sourceType: input.sourceType ?? 'manuel',
    sourceId: input.sourceId,
    key,
    ...input.extra,
  };
  await db.movements.add(mv);
  await db.products.update(p.id, { quantity: after, updatedAt: nowISO() });
  return mv;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  validateProduct(input);
  const now = nowISO();
  const product: Product = {
    ...input,
    id: uid('p'),
    name: input.name.trim(),
    currency: input.currency ?? 'CAD',
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction('rw', db.products, db.movements, async () => {
    await db.products.add(product);
    await db.movements.add({
      id: uid('mv'), productId: product.id, type: 'création', delta: product.quantity, before: null, after: product.quantity,
      unit: product.unit, at: now, sourceType: 'manuel', key: `create:${product.id}`,
    });
  });
  return product;
}

/** Modifie les informations d'un produit. Un changement de quantité passe par l'historique. */
export async function updateProduct(id: ID, patch: Partial<Product>): Promise<void> {
  validateProduct(patch);
  await db.transaction('rw', db.products, db.movements, async () => {
    const p = await db.products.get(id);
    if (!p) throw new ValidationError('Produit introuvable.');
    const { quantity, ...rest } = patch;
    if ('quantity' in patch && quantity !== p.quantity) {
      await applyStockChange({ productId: id, type: quantity === null ? 'inconnu' : 'ajustement', setTo: quantity ?? null, note: 'Modification de la fiche' });
    }
    if (rest.locationId !== undefined && rest.locationId !== p.locationId) {
      await db.movements.add({
        id: uid('mv'), productId: id, type: 'déplacement', delta: 0, before: p.quantity, after: p.quantity, unit: p.unit, at: nowISO(),
        key: uid('move'), fromLocationId: p.locationId, toLocationId: rest.locationId, sourceType: 'manuel',
      });
    }
    await db.products.update(id, { ...rest, updatedAt: nowISO(), userModified: p.seedKey ? true : p.userModified });
  });
}

export function adjustQuantity(productId: ID, delta: number, note?: string) {
  return db.transaction('rw', db.products, db.movements, () =>
    applyStockChange({ productId, type: delta < 0 ? 'consommation' : 'ajustement', delta, note }),
  );
}

export function setQuantity(productId: ID, quantity: number | null, note?: string) {
  const type: MovementType = quantity === null ? 'inconnu' : quantity === 0 ? 'épuisé' : 'ajustement';
  return db.transaction('rw', db.products, db.movements, () => applyStockChange({ productId, type, setTo: quantity, note }));
}

export function markEmpty(productId: ID) {
  return setQuantity(productId, 0, 'Tout épuisé');
}

export function markUnknown(productId: ID) {
  return setQuantity(productId, null, 'Quantité inconnue');
}

/** Produit périmé ou jeté : la quantité perdue est retirée et l'historique indique la raison. */
export function recordLoss(productId: ID, quantity: number | 'tout', reason: 'perte' | 'périmé', note?: string) {
  return db.transaction('rw', db.products, db.movements, async () => {
    const p = await db.products.get(productId);
    if (!p) throw new ValidationError('Produit introuvable.');
    if (quantity === 'tout') {
      const mv = await applyStockChange({ productId, type: reason, setTo: 0, note });
      if (reason === 'périmé') await db.products.update(productId, { expiryDate: undefined });
      return mv;
    }
    return applyStockChange({ productId, type: reason, delta: -Math.abs(quantity), note });
  });
}

export function moveProduct(productId: ID, toLocationId: ID) {
  return updateProduct(productId, { locationId: toLocationId });
}

/**
 * Annule un mouvement en créant un mouvement inverse (l'historique n'est jamais réécrit).
 * Un mouvement déjà annulé n'est pas annulé une seconde fois.
 */
export async function reverseMovement(movementId: ID, note = 'Correction'): Promise<StockMovement | undefined> {
  return db.transaction('rw', db.products, db.movements, async () => {
    const mv = await db.movements.get(movementId);
    if (!mv || mv.reversedBy || mv.type === 'annulation' || mv.type === 'création' || mv.type === 'déplacement') return undefined;
    let rev: StockMovement;
    if (mv.delta === null) {
      rev = await applyStockChange({ productId: mv.productId, type: 'annulation', setTo: mv.before, key: `reverse:${mv.id}`, note, extra: { reverses: mv.id } });
    } else {
      rev = await applyStockChange({ productId: mv.productId, type: 'annulation', delta: -mv.delta, key: `reverse:${mv.id}`, note, extra: { reverses: mv.id } });
    }
    await db.movements.update(mv.id, { reversedBy: rev.id });
    return rev;
  });
}

export async function archiveProduct(productId: ID, archived = true) {
  await db.products.update(productId, { archived, updatedAt: nowISO() });
}

export async function deleteProduct(productId: ID) {
  // Les produits utilisés par des recettes ou des listes sont archivés plutôt que supprimés.
  const usedInRecipes = (await db.recipes.toArray()).some((r) => r.ingredients.some((i) => i.productId === productId));
  const usedInLines = (await db.lines.where('productId').equals(productId).count()) > 0;
  if (usedInRecipes || usedInLines) {
    await archiveProduct(productId);
    return 'archivé' as const;
  }
  await db.transaction('rw', db.products, db.movements, async () => {
    await db.movements.where('productId').equals(productId).delete();
    await db.products.delete(productId);
  });
  return 'supprimé' as const;
}
