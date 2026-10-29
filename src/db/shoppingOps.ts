import { familyCovers, proposeShoppingLines, type ProposedLine } from '../domain/shopping';
import type { ID, ISODate, Priority, ShoppingLine, ShoppingList, Unit } from '../domain/types';
import { convert, formatQty, round2, roundNice, roundUpToStep, saleStep } from '../domain/units';
import { db } from './db';
import { loadContext, needsBetween } from './queries';
import { recordPrice } from './priceOps';
import { applyStockChange, reverseMovement } from './stockOps';
import { nowISO, uid, ValidationError } from './util';

export async function createList(input: Partial<ShoppingList> & { name: string }): Promise<ShoppingList> {
  if (!input.name.trim()) throw new ValidationError('Le nom de la liste est obligatoire.');
  if (input.budget !== undefined && (!Number.isFinite(input.budget) || input.budget < 0)) throw new ValidationError('Budget invalide.');
  const now = nowISO();
  const list: ShoppingList = { currency: 'CAD', status: 'à préparer', ...input, name: input.name.trim(), id: uid('list'), createdAt: now, updatedAt: now };
  await db.lists.add(list);
  return list;
}

export async function updateList(id: ID, patch: Partial<ShoppingList>) {
  const l = await db.lists.get(id);
  if (!l) throw new ValidationError('Liste introuvable.');
  await db.lists.update(id, { ...patch, updatedAt: nowISO(), userModified: l.seedKey ? true : l.userModified });
}

/** Supprime une liste sans achat ; une liste avec des achats enregistrés est archivée pour garder l'historique. */
export async function deleteList(id: ID): Promise<'supprimée' | 'archivée'> {
  return db.transaction('rw', db.lists, db.lines, db.purchases, async () => {
    const purchases = await db.purchases.where('listId').equals(id).filter((p) => !p.reversed).count();
    if (purchases > 0) {
      await db.lists.update(id, { status: 'archivée', updatedAt: nowISO() });
      return 'archivée' as const;
    }
    await db.lines.where('listId').equals(id).delete();
    await db.lists.delete(id);
    return 'supprimée' as const;
  });
}

async function nextOrder(listId: ID) {
  const lines = await db.lines.where('listId').equals(listId).toArray();
  return lines.reduce((m, l) => Math.max(m, l.order), -1) + 1;
}

export interface LineInput {
  productId?: ID;
  name?: string;
  quantity: number;
  unit?: Unit;
  priority?: Priority;
  estUnitPrice?: number;
  note?: string;
  source?: ShoppingLine['source'];
  reasons?: string[];
  substituteForLineId?: ID;
  stockUnknown?: boolean;
}

/** Ajoute un produit à une liste ; si le même produit y est déjà prévu, les quantités sont regroupées. */
export async function addLine(listId: ID, input: LineInput): Promise<ShoppingLine> {
  if (!(input.quantity > 0)) throw new ValidationError('La quantité doit être positive.');
  return db.transaction('rw', db.lines, db.products, db.lists, async () => {
    const product = input.productId ? await db.products.get(input.productId) : undefined;
    if (input.productId && !product) throw new ValidationError('Produit introuvable.');
    const name = product?.name ?? input.name?.trim();
    if (!name) throw new ValidationError('Le nom du produit est obligatoire.');
    const unit = input.unit ?? product?.unit ?? 'unité';
    if (product && !input.substituteForLineId) {
      const existing = await db.lines.where('listId').equals(listId).filter((l) => l.productId === product.id && l.status === 'à acheter').first();
      if (existing) {
        const add = convert(input.quantity, unit, existing.unit, product);
        if (add !== null) {
          const quantity = roundNice(existing.quantity + add);
          await db.lines.update(existing.id, {
            quantity,
            quantityLabel: undefined,
            estTotal: existing.estUnitPrice !== undefined ? round2(existing.estUnitPrice * quantity) : existing.estTotal,
            reasons: [...existing.reasons, ...(input.reasons ?? ['Ajout manuel'])],
            updatedAt: nowISO(),
          });
          return (await db.lines.get(existing.id))!;
        }
      }
    }
    const estUnitPrice = input.estUnitPrice ?? product?.unitPrice;
    const now = nowISO();
    const line: ShoppingLine = {
      id: uid('line'),
      listId,
      productId: product?.id,
      name,
      categoryId: product?.categoryId,
      quantity: input.quantity,
      unit,
      estUnitPrice,
      estTotal: estUnitPrice !== undefined ? round2(estUnitPrice * input.quantity) : undefined,
      priceStatus: product?.priceStatus,
      status: 'à acheter',
      priority: input.priority ?? (product && !product.essential ? 'optionnel' : 'essentiel'),
      source: input.source ?? 'manuel',
      reasons: input.reasons ?? ['Ajout manuel'],
      note: input.note,
      substituteForLineId: input.substituteForLineId,
      stockUnknown: input.stockUnknown,
      order: await nextOrder(listId),
      createdAt: now,
      updatedAt: now,
    };
    await db.lines.add(line);
    return line;
  });
}

export async function updateLine(id: ID, patch: Partial<ShoppingLine>) {
  const l = await db.lines.get(id);
  if (!l) throw new ValidationError('Ligne introuvable.');
  if (patch.quantity !== undefined && !(patch.quantity > 0)) throw new ValidationError('La quantité doit être positive.');
  const next = { ...l, ...patch };
  if (patch.quantity !== undefined || patch.estUnitPrice !== undefined) {
    next.quantityLabel = patch.quantity !== undefined ? undefined : l.quantityLabel;
    if (next.estUnitPrice !== undefined) next.estTotal = round2(next.estUnitPrice * next.quantity);
  }
  await db.lines.put({ ...next, updatedAt: nowISO(), userModified: l.seedKey ? true : l.userModified });
}

export function removeLine(id: ID) {
  return updateLine(id, { status: 'retiré' });
}

export function markUnavailable(id: ID) {
  return updateLine(id, { status: 'indisponible' });
}

export function restoreLine(id: ID) {
  return updateLine(id, { status: 'à acheter' });
}

/** Remplace un produit par un substitut : la ligne d'origine devient indisponible, une ligne substitut est ajoutée. */
export async function substituteLine(lineId: ID, productId: ID, quantity?: number) {
  return db.transaction('rw', db.lines, db.products, db.lists, async () => {
    const l = await db.lines.get(lineId);
    if (!l) throw new ValidationError('Ligne introuvable.');
    const p = await db.products.get(productId);
    if (!p) throw new ValidationError('Produit introuvable.');
    await db.lines.update(lineId, { status: 'indisponible', updatedAt: nowISO() });
    return addLine(l.listId, {
      productId,
      quantity: quantity ?? (convert(l.quantity, l.unit, p.unit, p) ?? 1),
      priority: l.priority,
      source: 'substitution',
      reasons: [`Remplace « ${l.name} »`],
      substituteForLineId: lineId,
    });
  });
}

export interface BuyInput {
  quantity?: number;
  price?: number;
  updateStock: boolean;
  /** Enregistrer le prix payé comme prix de référence vérifié du produit. */
  savePrice?: boolean;
}

/**
 * Coche un article comme acheté. Idempotent : cocher à nouveau un article déjà acheté
 * ne crée ni un second achat ni une seconde entrée en stock.
 */
export async function markBought(lineId: ID, input: BuyInput) {
  return db.transaction('rw', [db.lines, db.purchases, db.products, db.movements, db.lists, db.prices], async () => {
    const line = await db.lines.get(lineId);
    if (!line) throw new ValidationError('Ligne introuvable.');
    if (line.purchaseId) {
      const active = await db.purchases.get(line.purchaseId);
      if (active && !active.reversed) return active;
    }
    const quantity = input.quantity ?? line.quantity;
    if (!(quantity > 0)) throw new ValidationError('La quantité achetée doit être positive.');
    if (input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0)) throw new ValidationError('Prix invalide.');
    const attempt = await db.purchases.where('lineId').equals(lineId).count();
    const key = `purchase:${lineId}:${attempt + 1}`;
    const list = await db.lists.get(line.listId);
    const purchaseId = uid('pur');
    let movementId: ID | undefined;
    if (input.updateStock && line.productId) {
      const p = await db.products.get(line.productId);
      if (p) {
        const inProductUnit = convert(quantity, line.unit, p.unit, p);
        if (inProductUnit === null) throw new ValidationError(`Impossible de convertir ${line.unit} en ${p.unit} pour ${p.name}. Ajoutez une conversion dans la fiche du produit.`);
        const mv = await applyStockChange({
          productId: p.id, type: 'achat', delta: inProductUnit, key: `${key}:stock`, sourceType: 'achat', sourceId: purchaseId,
          note: `Achat — ${list?.name ?? 'liste'}`,
        });
        movementId = mv.id;
        const today = nowISO().slice(0, 10);
        await db.products.update(p.id, { purchaseDate: today, updatedAt: nowISO() });
      }
    }
    if (line.productId && input.price !== undefined) {
      // Historique des prix ; le prix de référence n'est remplacé que si l'utilisateur le demande.
      await recordPrice({
        productId: line.productId, date: nowISO().slice(0, 10), quantity, unit: line.unit, paid: input.price, store: list?.store,
        currency: list?.currency ?? 'CAD', source: 'liste', purchaseId, key: `purchase:${purchaseId}:price`,
      }, { updateReference: !!input.savePrice });
    }
    const purchase = {
      id: purchaseId, listId: line.listId, lineId, productId: line.productId, quantity, unit: line.unit, price: input.price,
      currency: list?.currency ?? 'CAD', at: nowISO(), movementId, key,
    };
    await db.purchases.add(purchase);
    await db.lines.update(lineId, { status: 'acheté', actualQuantity: quantity, actualPrice: input.price, purchaseId, updatedAt: nowISO() });
    if (list && list.status === 'à préparer') await db.lists.update(list.id, { status: 'en cours', updatedAt: nowISO() });
    return purchase;
  });
}

/** Décoche un article acheté : l'achat est annulé et, s'il avait alimenté le stock, un mouvement inverse est créé. */
export async function unmarkBought(lineId: ID) {
  return db.transaction('rw', [db.lines, db.purchases, db.products, db.movements], async () => {
    const line = await db.lines.get(lineId);
    if (!line?.purchaseId) return;
    const purchase = await db.purchases.get(line.purchaseId);
    if (purchase && !purchase.reversed) {
      if (purchase.movementId) await reverseMovement(purchase.movementId, 'Achat annulé');
      await db.purchases.update(purchase.id, { reversed: true });
    }
    await db.lines.update(lineId, { status: 'à acheter', purchaseId: undefined, actualQuantity: undefined, actualPrice: undefined, updatedAt: nowISO() });
  });
}

/** Corrige le prix payé d'un achat déjà enregistré (sans toucher au stock). */
export async function setActualPrice(lineId: ID, price: number | undefined) {
  return db.transaction('rw', db.lines, db.purchases, async () => {
    const line = await db.lines.get(lineId);
    if (!line) return;
    await db.lines.update(lineId, { actualPrice: price, updatedAt: nowISO() });
    if (line.purchaseId) await db.purchases.update(line.purchaseId, { price });
  });
}

export async function removeOptionalLines(listId: ID): Promise<number> {
  const lines = await db.lines.where('listId').equals(listId).filter((l) => l.priority === 'optionnel' && l.status === 'à acheter').toArray();
  await db.lines.bulkUpdate(lines.map((l) => ({ key: l.id, changes: { status: 'retiré' as const, updatedAt: nowISO() } })));
  return lines.length;
}

// ---------------------------------------------------------------------------
// Génération automatique
// ---------------------------------------------------------------------------

export interface GenerationRequest {
  start: ISODate;
  end: ISODate;
  includeLowStock: boolean;
  includeOptional: boolean;
  /** Liste cible (exclue du calcul « déjà sur une autre liste »). */
  targetListId?: ID;
}

export interface GenerationPreview {
  lines: ProposedLine[];
  mealCount: number;
  unconverted: { name: string; quantity: number; unit: Unit; sources: string[] }[];
  estimatedTotal: number;
  /** Besoins entièrement couverts par une référence équivalente de la même famille (rien à acheter). */
  coveredByEquivalents: { name: string; by: string }[];
}

/** Calcule une proposition de liste (aperçu, rien n'est enregistré). */
export async function previewGeneration(req: GenerationRequest): Promise<GenerationPreview> {
  const ctx = await loadContext();
  const { needs, unconverted, meals } = await needsBetween(req.start, req.end, ctx);
  const openLists = (await db.lists.toArray()).filter((l) => (l.status === 'à préparer' || l.status === 'en cours') && l.id !== req.targetListId);
  const alreadyListed = new Map<ID, number>();
  for (const l of openLists) {
    // Les listes de référence importées couvrent leur propre période : elles ne comptent que si elles la chevauchent.
    if (l.periodStart && l.periodEnd && (l.periodEnd < req.start || l.periodStart > req.end)) continue;
    if (l.planId && !l.periodStart) continue;
    for (const line of await db.lines.where('listId').equals(l.id).toArray()) {
      if (line.status !== 'à acheter' || !line.productId) continue;
      const p = ctx.products.get(line.productId);
      const q = p ? convert(line.quantity, line.unit, p.unit, p) : null;
      if (q !== null) alreadyListed.set(line.productId, (alreadyListed.get(line.productId) ?? 0) + q);
    }
  }
  const opts = {
    includeLowStock: req.includeLowStock,
    includeOptional: req.includeOptional,
    on: req.start,
    alreadyListed,
    families: ctx.families,
    profiles: ctx.profiles,
  };
  const lines = proposeShoppingLines([...ctx.products.values()], needs, opts);
  const listed = new Set(lines.map((l) => l.productId));
  const coveredByEquivalents: GenerationPreview['coveredByEquivalents'] = [];
  for (const c of familyCovers([...ctx.products.values()], needs, opts).coverage.values()) {
    if (!c.uses.length || listed.has(c.productId) || c.shortfall > 1e-9) continue;
    coveredByEquivalents.push({ name: ctx.products.get(c.productId)!.name, by: c.uses.map((u) => `${u.name} (${formatQty(u.sourceQuantity, u.sourceUnit)})`).join(', ') });
  }
  const merged = new Map<string, GenerationPreview['unconverted'][number]>();
  for (const u of unconverted) {
    const p = ctx.products.get(u.productId);
    const k = `${u.productId}|${u.unit}`;
    const prev = merged.get(k);
    if (prev) {
      prev.quantity = roundNice(prev.quantity + u.quantity);
      prev.sources.push(...u.sources);
    } else merged.set(k, { name: p?.name ?? u.productId, quantity: roundNice(u.quantity), unit: u.unit, sources: [...u.sources] });
  }
  return {
    lines,
    mealCount: meals.length,
    unconverted: [...merged.values()],
    estimatedTotal: round2(lines.reduce((s, l) => s + (l.estTotal ?? 0), 0)),
    coveredByEquivalents,
  };
}

/** Enregistre les lignes proposées (éventuellement corrigées) dans une liste nouvelle ou existante. */
export async function commitGeneration(listId: ID, lines: ProposedLine[]) {
  for (const l of lines) {
    await addLine(listId, {
      productId: l.productId,
      quantity: l.quantity,
      unit: l.unit,
      priority: l.priority,
      source: l.source,
      reasons: l.reasons,
      stockUnknown: l.stockUnknown,
    });
  }
  await db.lists.update(listId, { updatedAt: nowISO() });
}

/**
 * Ajoute des produits manquants à la liste la plus pertinente : liste ouverte couvrant la date,
 * sinon liste « Courses urgentes » (créée au besoin). Les quantités sont arrondies au format de vente.
 */
export async function addMissingToList(items: { productId: ID; quantity: number; reason: string }[], on: ISODate): Promise<{ listId: ID; listName: string; added: number }> {
  const open = (await db.lists.toArray()).filter((l) => l.status === 'à préparer' || l.status === 'en cours');
  let list =
    open.find((l) => l.periodStart && l.periodEnd && l.periodStart <= on && on <= l.periodEnd) ??
    open.find((l) => l.name === 'Courses urgentes');
  if (!list) list = await createList({ name: 'Courses urgentes', plannedDate: on });
  let added = 0;
  for (const it of items) {
    const p = await db.products.get(it.productId);
    if (!p || !(it.quantity > 0)) continue;
    await addLine(list.id, { productId: p.id, quantity: roundUpToStep(it.quantity, saleStep(p)), source: 'menus', reasons: [it.reason] });
    added++;
  }
  return { listId: list.id, listName: list.name, added };
}
