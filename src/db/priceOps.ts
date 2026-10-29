import type { ID, ISODate, PriceRecord, Product, Unit } from '../domain/types';
import { convert } from '../domain/units';
import { db } from './db';
import { nowISO, uid } from './util';

export interface PriceInput {
  productId: ID;
  date: ISODate;
  quantity: number;
  unit: Unit;
  /** Montant payé, rabais déduits. */
  paid: number;
  discount?: number;
  /** Quantité achetée exprimée dans l'unité du produit, si elle est connue (sinon conversion standard). */
  productQuantity?: number | null;
  store?: string;
  format?: string;
  currency: string;
  source: PriceRecord['source'];
  receiptId?: ID;
  purchaseId?: ID;
  key: string;
}

/**
 * Enregistre un prix payé dans l'historique (idempotent par clé) et met à jour le dernier prix connu du produit.
 * Un prix plus ancien que le dernier prix connu est conservé dans l'historique sans remplacer le dernier prix.
 * À appeler dans une transaction qui inclut `products` et `prices`.
 */
export async function recordPrice(input: PriceInput, opts: { updateReference: boolean }): Promise<PriceRecord | undefined> {
  const existing = await db.prices.where('key').equals(input.key).first();
  if (existing) return existing;
  const p = await db.products.get(input.productId);
  if (!p || !Number.isFinite(input.paid) || input.paid < 0) return undefined;
  const q = input.productQuantity !== undefined ? input.productQuantity : convert(input.quantity, input.unit, p.unit, p);
  const unitPrice = q !== null && q > 0 ? Math.round((input.paid / q) * 10000) / 10000 : undefined;
  const rec: PriceRecord = {
    id: uid('price'), productId: p.id, familyId: p.familyId, date: input.date, at: nowISO(), store: input.store, quantity: input.quantity,
    unit: input.unit, format: input.format, paid: input.paid, discount: input.discount, unitPrice, currency: input.currency,
    source: input.source, receiptId: input.receiptId, purchaseId: input.purchaseId, key: input.key,
  };
  await db.prices.add(rec);
  if (!p.lastPrice || input.date >= p.lastPrice.date) {
    const patch: Partial<Product> = {
      lastPrice: { amount: input.paid, quantity: input.quantity, unit: input.unit, unitPrice, date: input.date, store: input.store, format: input.format },
      updatedAt: nowISO(),
    };
    if (opts.updateReference && unitPrice !== undefined) {
      patch.unitPrice = unitPrice;
      patch.priceStatus = 'vérifié';
      patch.priceSource = input.source === 'reçu' ? `Reçu${input.store ? ` ${input.store}` : ''} du ${input.date}` : `Prix payé le ${input.date}`;
    }
    await db.products.update(p.id, patch);
  }
  return rec;
}
