import { convertBetween, equivalenceKey } from '../domain/families';
import {
  matchItem, normText, parseReceipt, receiptFingerprint, ReceiptFormatError, stockQuantityFor, suggestedUnit,
  type ItemMatch, type NormalizedReceipt, type ReceiptItem,
} from '../domain/receipt';
import type { ID, Product, ProductFamily, ReceiptImport, ReceiptImportLine, ShoppingLine, Unit, UnitConversion } from '../domain/types';
import { convert, roundNice } from '../domain/units';
import { db } from './db';
import { createFamily } from './familyOps';
import { recordPrice } from './priceOps';
import { applyStockChange } from './stockOps';
import { nowISO, uid, ValidationError } from './util';

/** Nouveau produit à créer depuis une ligne du reçu. */
export interface NewProductDraft {
  name: string;
  categoryId: ID;
  unit: Unit;
  familyId?: ID;
  /** Nom d'une nouvelle famille à créer (si `familyId` est vide). */
  newFamilyName?: string;
  variant?: string;
  brand?: string;
  format?: string;
  conversions?: UnitConversion[];
}

export type LineChoice = 'existant' | 'créer' | 'ignorer';

/** Décision pour une ligne du reçu, modifiable dans l'aperçu avant validation. */
export interface ReceiptLinePlan {
  item: ReceiptItem;
  match: ItemMatch;
  choice: LineChoice;
  productId?: ID;
  create?: NewProductDraft;
  /** Quantité achetée dans l'unité du produit ; `null` : correspondance inconnue, à préciser. */
  stockQuantity: number | null;
  /** Retenir le nom du reçu pour reconnaître ce produit aux prochains imports. */
  rememberName: boolean;
}

export interface ReceiptPreview {
  receipt: NormalizedReceipt;
  fingerprint: string;
  fileName?: string;
  raw: unknown;
  warnings: string[];
  /** Reçu identique déjà importé : l'import est refusé. */
  duplicateOf?: ReceiptImport;
  /** Reçus du même magasin, du même jour et du même total, au contenu différent (avertissement). */
  similar: ReceiptImport[];
  plans: ReceiptLinePlan[];
  /** Liste de courses qui correspond le mieux au reçu. */
  suggestedListId?: ID;
}

const OPEN = ['à préparer', 'en cours'];

/** Lit le fichier, détecte les doublons et propose une correspondance pour chaque ligne (rien n'est enregistré). */
export async function previewReceipt(input: string | unknown, fileName?: string): Promise<ReceiptPreview> {
  let parsed;
  const raw = typeof input === 'string' ? input : JSON.stringify(input);
  try {
    parsed = parseReceipt(input, nowISO().slice(0, 10));
  } catch (e) {
    if (e instanceof ReceiptFormatError) throw new ValidationError(e.message);
    throw e;
  }
  const { receipt, warnings } = parsed;
  const fingerprint = receiptFingerprint(receipt);
  const [products, families, categories, receipts] = await Promise.all([db.products.toArray(), db.families.toArray(), db.categories.toArray(), db.receipts.toArray()]);
  const duplicateOf = receipts.find((r) => r.fingerprint === fingerprint);
  const similar = receipts.filter(
    (r) => r.fingerprint !== fingerprint && r.date === receipt.date && normText(r.store) === normText(receipt.store) && r.total !== undefined && r.total === receipt.total,
  );
  const byId = new Map(products.map((p) => [p.id, p]));
  const plans: ReceiptLinePlan[] = receipt.items.map((item) => {
    const match = matchItem(item, products, families, categories);
    const p = match.productId ? byId.get(match.productId) : undefined;
    const skip = item.isReturn || item.illegible;
    if (p) {
      return { item, match, choice: skip ? 'ignorer' : 'existant', productId: p.id, stockQuantity: stockQuantityFor(item, p), rememberName: !p.receiptNames?.includes(normText(item.receiptName)) };
    }
    const create = draftFor(item, match, families, categories[0]?.id ?? 'cat-menager');
    return { item, match, choice: skip ? 'ignorer' : 'créer', create, stockQuantity: stockQuantityFor(item, create), rememberName: true };
  });
  const suggestedListId = await suggestList(plans, receipt.date);
  return { receipt, fingerprint, fileName, raw: safeJson(raw), warnings, duplicateOf, similar, plans, suggestedListId };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function draftFor(item: ReceiptItem, match: ItemMatch, families: ProductFamily[], fallbackCategory: ID): NewProductDraft {
  const fam = match.familyId ? families.find((f) => f.id === match.familyId) : undefined;
  const c = item.format?.content;
  // Contenance en pièces (pack de 4 pots, paquet de 12 rouleaux) : le stock se compte dans cette unité pratique.
  const countContent = !!c && !['g', 'kg', 'ml', 'L'].includes(c.unit);
  const unit = countContent ? c!.unit : suggestedUnit(item);
  // Contenance en poids ou volume imprimée sur l'emballage : conversion fiable (1 barquette = 907 g), sauf si elle est marquée incertaine.
  const conversions = c && !countContent && c.unit !== unit && !item.uncertain.includes('format') ? [{ unit, amount: c.quantity, to: c.unit }] : undefined;
  const ref = item.productRef;
  return {
    name: ref.name ?? titleCase(item.receiptName),
    categoryId: match.categoryId ?? fam?.categoryId ?? fallbackCategory,
    unit,
    familyId: fam?.id,
    newFamilyName: fam ? undefined : ref.family,
    variant: ref.variant,
    brand: ref.brand,
    format: item.format?.label,
    conversions,
  };
}

function titleCase(s: string) {
  const l = s.toLowerCase();
  return l.charAt(0).toUpperCase() + l.slice(1);
}

/** Liste ouverte (ou achetée le jour du reçu) qui contient le plus de produits du reçu. */
async function suggestList(plans: ReceiptLinePlan[], date: string): Promise<ID | undefined> {
  const ids = new Set(plans.map((p) => p.productId).filter(Boolean));
  if (!ids.size) return undefined;
  const lists = await db.lists.toArray();
  let best: { id: ID; n: number } | undefined;
  for (const l of lists) {
    if (!OPEN.includes(l.status) && !(l.status === 'terminée' && l.updatedAt.slice(0, 10) >= date)) continue;
    const lines = await db.lines.where('listId').equals(l.id).toArray();
    const n = lines.filter((x) => x.productId && ids.has(x.productId) && (x.status === 'à acheter' || x.status === 'acheté')).length;
    if (n > 0 && (!best || n > best.n)) best = { id: l.id, n };
  }
  return best?.id;
}

// ---------------------------------------------------------------------------
// Association à une liste de courses
// ---------------------------------------------------------------------------

export interface ListLink {
  line: ShoppingLine;
  /** Quantité déjà ajoutée au stock par l'achat coché sur la liste (unité du produit du reçu). */
  alreadyCounted: number;
  /** Quantité qui sera ajoutée au stock par l'import. */
  toAdd: number;
}

/**
 * Pour chaque ligne du reçu, retrouve la ligne de la liste qui correspond (même produit, puis référence
 * équivalente) et calcule ce qui a déjà été compté en stock, pour ne jamais ajouter deux fois le même achat.
 */
export async function linkToList(listId: ID | undefined, plans: ReceiptLinePlan[]): Promise<Map<number, ListLink>> {
  const out = new Map<number, ListLink>();
  if (!listId) return out;
  const [lines, products, families] = await Promise.all([
    db.lines.where('listId').equals(listId).toArray(),
    db.products.toArray(),
    db.families.toArray(),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const fams = new Map(families.map((f) => [f.id, f]));
  const used = new Set<ID>();
  const purchases = new Map((await db.purchases.where('listId').equals(listId).toArray()).map((p) => [p.id, p]));
  // Une ligne déjà rapprochée d'un reçu précédent n'est plus candidate.
  const candidates = lines
    .filter((l) => l.productId && (l.status === 'à acheter' || (l.status === 'acheté' && !(l.purchaseId && purchases.get(l.purchaseId)?.receiptId))))
    .sort((a, b) => a.order - b.order);
  const pick = (plan: ReceiptLinePlan, sameClass: boolean) => {
    const p = byId.get(plan.productId!)!;
    const key = equivalenceKey(p, fams);
    return candidates.find((l) => !used.has(l.id) && (sameClass ? l.productId !== p.id && byId.get(l.productId!) && equivalenceKey(byId.get(l.productId!)!, fams) === key : l.productId === p.id));
  };
  const active = plans.filter((pl) => pl.choice === 'existant' && pl.productId && byId.has(pl.productId));
  // Même produit d'abord pour toutes les lignes, puis références équivalentes.
  for (const sameClass of [false, true]) {
    for (const plan of active) {
      if (out.has(plan.item.index)) continue;
      const line = pick(plan, sameClass);
      if (!line) continue;
      used.add(line.id);
      const p = byId.get(plan.productId!)!;
      const lineProduct = byId.get(line.productId!)!;
      let alreadyCounted = 0;
      if (line.status === 'acheté' && line.purchaseId) {
        const pur = purchases.get(line.purchaseId);
        if (pur && !pur.reversed && pur.movementId) {
          const inLineProduct = convert(pur.quantity, pur.unit, lineProduct.unit, lineProduct);
          alreadyCounted = inLineProduct === null ? 0 : convertBetween(inLineProduct, lineProduct, p) ?? 0;
          // L'achat coché a alimenté le stock d'un autre produit (variante équivalente) : tout est déjà compté.
          if (lineProduct.id !== p.id) alreadyCounted = Math.max(alreadyCounted, plan.stockQuantity ?? 0);
        }
      }
      const qty = plan.stockQuantity ?? 0;
      out.set(plan.item.index, { line, alreadyCounted: roundNice(alreadyCounted), toAdd: roundNice(Math.max(0, qty - alreadyCounted)) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Importation
// ---------------------------------------------------------------------------

export interface ImportOptions {
  listId?: ID;
}

/**
 * Enregistre le reçu : ajoute les quantités achetées au stock (jamais de remplacement ni de diminution),
 * crée les produits nouveaux, met à jour le dernier prix connu, garde l'historique des prix et la transaction.
 * Un reçu déjà importé est refusé ; si une liste est associée, les achats déjà cochés ne sont pas recomptés.
 */
export async function importReceipt(preview: ReceiptPreview, plans: ReceiptLinePlan[], opts: ImportOptions = {}): Promise<ReceiptImport> {
  for (const pl of plans) {
    if (pl.choice === 'ignorer') continue;
    if (pl.stockQuantity === null || !Number.isFinite(pl.stockQuantity)) throw new ValidationError(`« ${pl.item.receiptName} » : indiquez la quantité à ajouter au stock, ou choisissez « Ne pas ajouter ».`);
    if (pl.stockQuantity < 0) throw new ValidationError(`« ${pl.item.receiptName} » : une importation ne peut pas diminuer le stock.`);
    if (pl.choice === 'existant' && !pl.productId) throw new ValidationError(`« ${pl.item.receiptName} » : choisissez le produit correspondant.`);
    if (pl.choice === 'créer' && (!pl.create?.name.trim() || !pl.create.categoryId)) throw new ValidationError(`« ${pl.item.receiptName} » : nom et catégorie du nouveau produit obligatoires.`);
  }
  const r = preview.receipt;
  const fp = preview.fingerprint;
  const tables = [db.receipts, db.products, db.families, db.movements, db.prices, db.lines, db.purchases, db.lists];
  return db.transaction('rw', tables, async () => {
    const dup = await db.receipts.where('fingerprint').equals(fp).first();
    if (dup) throw new ValidationError(`Ce reçu a déjà été importé le ${new Date(dup.importedAt).toLocaleDateString('fr-CA')} : rien n’a été ajouté une seconde fois.`);
    const receiptId = uid('rcpt');
    const label = `Reçu${r.store ? ` ${r.store}` : ''} du ${r.date}`;
    const now = nowISO();
    const lines: ReceiptImportLine[] = [];

    // 1. Produits à créer.
    const resolved = new Map<number, ID>();
    for (const pl of plans) {
      if (pl.choice === 'existant' && pl.productId) {
        if (!(await db.products.get(pl.productId))) throw new ValidationError(`« ${pl.item.receiptName} » : produit introuvable.`);
        resolved.set(pl.item.index, pl.productId);
      }
      if (pl.choice !== 'créer' || !pl.create) continue;
      const c = pl.create;
      const familyId = c.familyId || (c.newFamilyName?.trim() ? (await createFamily({ name: c.newFamilyName, categoryId: c.categoryId })).id : undefined);
      const product: Product = {
        id: uid('p'), name: c.name.trim(), categoryId: c.categoryId, unit: c.unit, quantity: 0, currency: r.currency, essential: true, perishable: false,
        tags: [], familyId, variant: c.variant?.trim() || undefined, brand: c.brand?.trim() || undefined, format: c.format?.trim() || undefined,
        conversions: c.conversions, store: r.store, createdAt: now, updatedAt: now,
        notes: `Créé depuis le ${label.toLowerCase()}.`,
      };
      await db.products.add(product);
      await db.movements.add({ id: uid('mv'), productId: product.id, type: 'création', delta: 0, before: null, after: 0, unit: product.unit, at: now, sourceType: 'reçu', sourceId: receiptId, key: `create:${product.id}` });
      resolved.set(pl.item.index, product.id);
    }

    // 2. Association à la liste (après création : seuls les produits existants peuvent figurer sur la liste).
    const links = await linkToList(opts.listId, plans.map((pl) => ({ ...pl, productId: resolved.get(pl.item.index) ?? pl.productId })));
    const list = opts.listId ? await db.lists.get(opts.listId) : undefined;

    // 3. Stock, prix, liste.
    for (const pl of plans) {
      const it = pl.item;
      const base = { index: it.index, receiptName: it.receiptName, paid: it.paid, discount: it.discount, uncertain: it.uncertain };
      const productId = resolved.get(it.index);
      if (pl.choice === 'ignorer' || !productId) {
        lines.push({ ...base, action: 'ignoré', quantityAdded: 0, note: it.isReturn ? 'Retour : stock non diminué' : undefined });
        continue;
      }
      const p = (await db.products.get(productId))!;
      const qty = pl.stockQuantity!;
      const link = links.get(it.index);
      const toAdd = link ? link.toAdd : qty;
      let movementId: ID | undefined;
      if (toAdd > 0) {
        const mv = await applyStockChange({
          productId, type: 'achat', delta: toAdd, key: `receipt:${fp}:${it.index}:stock`, sourceType: 'reçu', sourceId: receiptId,
          note: link?.alreadyCounted ? `${label} (complément : ${link.alreadyCounted} ${p.unit} déjà compté via la liste)` : label,
        });
        movementId = mv.id;
      }
      const patch: Partial<Product> = { updatedAt: nowISO() };
      if (!p.purchaseDate || r.date >= p.purchaseDate) patch.purchaseDate = r.date;
      const rn = normText(it.receiptName);
      if (pl.rememberName && rn && !p.receiptNames?.includes(rn)) patch.receiptNames = [...(p.receiptNames ?? []), rn];
      await db.products.update(productId, patch);

      if (it.paid !== undefined && it.paid >= 0) {
        await recordPrice({
          productId, date: r.date, quantity: it.quantity ?? qty, unit: it.unit ?? p.unit, paid: it.paid, discount: it.discount, productQuantity: qty,
          store: r.store, format: it.format?.label, currency: r.currency, source: 'reçu', receiptId, key: `receipt:${fp}:${it.index}:price`,
        }, { updateReference: true });
      }

      let listLineId: ID | undefined;
      if (link && list) {
        listLineId = link.line.id;
        const l = link.line;
        if (l.status === 'à acheter') {
          const lineQty = convert(qty, p.unit, l.unit, p) ?? (l.productId === productId ? qty : l.quantity);
          const purchaseId = uid('pur');
          await db.purchases.add({
            id: purchaseId, listId: list.id, lineId: l.id, productId: l.productId, quantity: lineQty, unit: l.unit, price: it.paid, currency: list.currency,
            at: nowISO(), movementId, key: `receipt:${fp}:${it.index}:purchase`, receiptId,
          });
          await db.lines.update(l.id, {
            status: 'acheté', actualQuantity: lineQty, actualPrice: it.paid, purchaseId, updatedAt: nowISO(),
            note: l.productId !== productId ? `Acheté : ${p.name}` : l.note,
          });
        } else {
          if (l.actualPrice === undefined && it.paid !== undefined) await db.lines.update(l.id, { actualPrice: it.paid, updatedAt: nowISO() });
          if (l.purchaseId) await db.purchases.update(l.purchaseId, { receiptId });
        }
      }
      const action: ReceiptImportLine['action'] = pl.choice === 'créer' ? 'créé' : toAdd > 0 ? 'ajouté' : 'déjà compté';
      const note = link?.alreadyCounted ? `${link.alreadyCounted} ${p.unit} déjà compté(s) via la liste « ${list?.name ?? ''} »` : undefined;
      lines.push({ ...base, productId, action, quantityAdded: toAdd, unit: p.unit, movementId, listLineId, note });
    }
    if (list && list.status === 'à préparer' && lines.some((l) => l.listLineId)) await db.lists.update(list.id, { status: 'en cours', updatedAt: nowISO() });

    const rec: ReceiptImport = {
      id: receiptId, fingerprint: fp, importedAt: now, date: r.date, time: r.time, store: r.store, total: r.total, currency: r.currency,
      listId: opts.listId, fileName: preview.fileName, lines, warnings: preview.warnings, raw: preview.raw,
    };
    await db.receipts.add(rec);
    return rec;
  });
}

/**
 * Achats déjà cochés sur une autre liste, le jour du reçu ou la veille, pour les produits du reçu :
 * signalés dans l'aperçu pour éviter d'ajouter deux fois le même achat sans associer la liste.
 */
export async function purchasesElsewhere(plans: ReceiptLinePlan[], date: string, listId?: ID): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const ids = new Set(plans.filter((p) => p.choice === 'existant' && p.productId).map((p) => p.productId!));
  if (!ids.size) return out;
  const prev = new Date(`${date}T12:00:00`);
  prev.setDate(prev.getDate() - 1);
  const from = prev.toISOString().slice(0, 10);
  const recent = (await db.purchases.toArray()).filter((p) => !p.reversed && p.movementId && p.productId && ids.has(p.productId) && p.listId !== listId && p.at.slice(0, 10) >= from && p.at.slice(0, 10) <= date);
  const lists = new Map((await db.lists.toArray()).map((l) => [l.id, l.name]));
  for (const pl of plans) {
    const hit = recent.find((p) => p.productId === pl.productId);
    if (hit && pl.choice === 'existant') out.set(pl.item.index, lists.get(hit.listId) ?? 'une liste');
  }
  return out;
}
