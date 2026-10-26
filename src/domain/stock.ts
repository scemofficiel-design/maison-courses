import { daysBetween } from './dates';
import type { ISODate, Product } from './types';
import { formatQty } from './units';

export type StockLevel = 'inconnu' | 'épuisé' | 'bas' | 'ok';
export type ExpiryLevel = 'périmé' | 'bientôt' | 'ok' | 'sans date';

export function stockLevel(p: Pick<Product, 'quantity' | 'minQuantity'>): StockLevel {
  if (p.quantity === null || p.quantity === undefined) return 'inconnu';
  if (p.quantity <= 0) return 'épuisé';
  if (p.minQuantity !== undefined && p.quantity < p.minQuantity) return 'bas';
  return 'ok';
}

export function expiryLevel(p: Pick<Product, 'expiryDate'>, on: ISODate, warningDays: number): ExpiryLevel {
  if (!p.expiryDate) return 'sans date';
  const d = daysBetween(on, p.expiryDate);
  if (d < 0) return 'périmé';
  if (d <= warningDays) return 'bientôt';
  return 'ok';
}

export type AlertKind = 'absent' | 'sous le seuil' | 'péremption proche' | 'périmé' | 'consommation prévue' | 'stock inconnu';

export interface StockAlert {
  productId: string;
  kind: AlertKind;
  message: string;
  severity: 1 | 2 | 3;
}

/**
 * Calcule les alertes d'un produit.
 * `plannedNeed` : besoin des repas à venir, déjà converti dans l'unité du produit.
 */
export function productAlerts(p: Product, on: ISODate, warningDays: number, plannedNeed = 0): StockAlert[] {
  const out: StockAlert[] = [];
  if (p.archived) return out;
  const level = stockLevel(p);
  if (level === 'épuisé') out.push({ productId: p.id, kind: 'absent', message: 'Il n’en reste plus', severity: 3 });
  if (level === 'bas') {
    out.push({
      productId: p.id,
      kind: 'sous le seuil',
      message: `${formatQty(p.quantity, p.unit)} (seuil ${formatQty(p.minQuantity ?? 0, p.unit)})`,
      severity: 2,
    });
  }
  if (level === 'inconnu' && plannedNeed > 0) {
    out.push({ productId: p.id, kind: 'stock inconnu', message: 'Quantité inconnue alors que des repas en ont besoin', severity: 1 });
  }
  const exp = expiryLevel(p, on, warningDays);
  if (exp === 'périmé') out.push({ productId: p.id, kind: 'périmé', message: `Date dépassée (${p.expiryDate})`, severity: 3 });
  if (exp === 'bientôt') {
    const d = daysBetween(on, p.expiryDate!);
    out.push({
      productId: p.id,
      kind: 'péremption proche',
      message: d === 0 ? 'À consommer aujourd’hui' : `À consommer d’ici ${d} jour${d > 1 ? 's' : ''}`,
      severity: 2,
    });
  }
  if (plannedNeed > 0 && p.quantity !== null && p.quantity < plannedNeed && level !== 'épuisé') {
    out.push({
      productId: p.id,
      kind: 'consommation prévue',
      message: `Repas prévus : ${formatQty(plannedNeed, p.unit)} nécessaires, ${formatQty(p.quantity, p.unit)} en stock`,
      severity: 2,
    });
  }
  return out;
}

/** Quantité utilisable à une date : un produit périmé n'est pas compté ; une quantité inconnue reste inconnue. */
export function usableQuantity(p: Product, on: ISODate): number | null {
  if (p.archived) return 0;
  if (p.quantity === null) return null;
  if (p.expiryDate && p.expiryDate < on) return 0;
  return Math.max(0, p.quantity);
}
