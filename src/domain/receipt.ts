import type { Category, ID, ISODate, Product, ProductFamily, Unit } from './types';
import { ALL_UNITS, convert, roundNice } from './units';

/**
 * Format d'échange des reçus de caisse (voir IMPORT_FORMAT.md).
 * Le fichier est produit par un assistant (ex. ChatGPT) à partir d'une photo de reçu, puis importé ici.
 * La lecture est tolérante (nombres « 4,99 », unités au pluriel, bloc ```json), mais rien n'est deviné :
 * une valeur absente ou douteuse est signalée.
 */
export const RECEIPT_FORMAT = 'maison-courses-recu';
export const RECEIPT_FORMAT_VERSION = 1;

export interface ReceiptItem {
  /** Position de l'article sur le reçu (1, 2, 3…). */
  index: number;
  receiptName: string;
  productRef: { id?: string; name?: string; family?: string; variant?: string; brand?: string; category?: string };
  /** Nombre d'articles ou quantité vendue ; `null` si absente. */
  quantity: number | null;
  unit: Unit | null;
  unitRaw?: string;
  format?: { label?: string; content?: { quantity: number; unit: Unit } };
  /** Poids ou volume pesé à la caisse (ex. 0,912 kg). */
  weight?: { quantity: number; unit: Unit };
  unitPrice?: number;
  /** Prix avant rabais. */
  totalPrice?: number;
  /** Rabais, toujours positif. */
  discount?: number;
  /** Montant payé, rabais déduits. */
  paid?: number;
  uncertain: string[];
  illegible: boolean;
  confidence?: 'haute' | 'moyenne' | 'faible';
  note?: string;
  /** Problèmes relevés à la lecture de cette ligne. */
  problems: string[];
  /** Ligne de retour ou de remboursement (quantité ou montant négatif) : jamais retirée du stock. */
  isReturn: boolean;
}

export interface NormalizedReceipt {
  date: ISODate;
  dateMissing: boolean;
  time?: string;
  store?: string;
  branch?: string;
  number?: string;
  currency: string;
  subtotal?: number;
  taxes?: number;
  total?: number;
  totalDiscount?: number;
  items: ReceiptItem[];
  uncertainties: string[];
}

export interface ParseResult {
  receipt: NormalizedReceipt;
  warnings: string[];
}

export class ReceiptFormatError extends Error {}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

export function normText(s: string | undefined | null): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

/** Mots normalisés au singulier (« raisins verts » → « raisin vert »). */
export function words(s: string | undefined | null): string[] {
  return normText(s)
    .split(' ')
    .filter((w) => w.length > 1 || /\d/.test(w))
    .map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w));
}

const UNIT_ALIASES: Record<string, Unit> = {
  u: 'unité', un: 'unité', unite: 'unité', unit: 'unité', pc: 'unité', pce: 'unité', piece: 'unité', ea: 'unité', each: 'unité', x: 'unité', item: 'unité', article: 'unité',
  g: 'g', gr: 'g', gramme: 'g', kg: 'kg', kilo: 'kg', kilogramme: 'kg', ml: 'ml', millilitre: 'ml', l: 'L', litre: 'L', lt: 'L',
  dz: 'douzaine', douzaine: 'douzaine', paquet: 'paquet', pqt: 'paquet', paq: 'paquet', pkg: 'paquet', emballage: 'paquet',
  bouteille: 'bouteille', btl: 'bouteille', boite: 'boîte', bte: 'boîte', canne: 'boîte', conserve: 'boîte', pot: 'pot', sac: 'sac',
  botte: 'botte', tete: 'tête', tranche: 'tranche', rouleau: 'rouleau', pain: 'pain', morceau: 'morceau', grappe: 'grappe',
  barquette: 'barquette', casseau: 'barquette', pack: 'pack', sachet: 'sachet', filet: 'filet', bocal: 'bocal', bocaux: 'bocal',
};

/** Unité reconnue, ou `null` si inconnue. Les livres et onces ne sont pas des unités de l'application : voir `normalizeMeasure`. */
export function normalizeUnit(raw: unknown): Unit | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  if ((ALL_UNITS as string[]).includes(raw.trim())) return raw.trim() as Unit;
  const n = normText(raw).replace(/ /g, '');
  if (UNIT_ALIASES[n]) return UNIT_ALIASES[n];
  const singular = n.replace(/(s|x)$/, '');
  return UNIT_ALIASES[singular] ?? null;
}

/** Quantité et unité, avec conversion exacte des livres (0,45359237 kg) et des onces (28,349523 g). */
export function normalizeMeasure(quantity: number, rawUnit: unknown): { quantity: number; unit: Unit } | null {
  const n = typeof rawUnit === 'string' ? normText(rawUnit).replace(/ /g, '') : '';
  if (['lb', 'lbs', 'livre', 'livres'].includes(n)) return { quantity: roundNice(quantity * 0.45359237), unit: 'kg' };
  if (['oz', 'once', 'onces'].includes(n)) return { quantity: roundNice(quantity * 28.349523), unit: 'g' };
  const unit = normalizeUnit(rawUnit);
  return unit ? { quantity, unit } : null;
}

/** Nombre lu en français ou en anglais (« 4,99 », « 4.99 $ », « -1,00 »). */
export function readNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/[\s$€]|CAD/gi, '').replace(',', '.');
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined;
}

/** Extrait l'objet JSON d'un texte (accepte un bloc ```json … ``` ou du texte autour). */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^﻿/, '');
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : t;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new ReceiptFormatError('Aucun objet JSON trouvé dans le fichier.');
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw new ReceiptFormatError('Le fichier n’est pas un JSON valide (vérifiez qu’il n’a pas été tronqué au copier-coller).');
  }
}

// ---------------------------------------------------------------------------
// Lecture et validation
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseReceipt(input: unknown, today: ISODate): ParseResult {
  const data = typeof input === 'string' ? extractJson(input) : input;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ReceiptFormatError('Le fichier doit contenir un objet JSON.');
  const o = data as Record<string, unknown>;
  const warnings: string[] = [];
  if (o.format !== RECEIPT_FORMAT) {
    if (!Array.isArray(o.articles)) throw new ReceiptFormatError(`Ce fichier n’est pas un reçu au format « ${RECEIPT_FORMAT} ».`);
    warnings.push(`Le champ « format » ne vaut pas « ${RECEIPT_FORMAT} » : fichier lu comme un reçu, vérifiez l’aperçu.`);
  }
  const version = readNumber(o.version) ?? RECEIPT_FORMAT_VERSION;
  if (version > RECEIPT_FORMAT_VERSION) throw new ReceiptFormatError('Ce fichier utilise une version plus récente du format : mettez l’application à jour.');
  const r = (o.recu && typeof o.recu === 'object' ? o.recu : {}) as Record<string, unknown>;
  let date = str(r.date);
  let dateMissing = false;
  if (!date || !DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    warnings.push(date ? `Date « ${date} » illisible (format attendu AAAA-MM-JJ) : date du jour utilisée.` : 'Date du reçu absente : date du jour utilisée.');
    date = today;
    dateMissing = true;
  }
  if (!Array.isArray(o.articles) || o.articles.length === 0) throw new ReceiptFormatError('Le reçu ne contient aucun article (champ « articles »).');

  const items: ReceiptItem[] = o.articles.map((raw, i) => readItem(raw, i + 1));
  const uncertainties = Array.isArray(o.incertitudes) ? o.incertitudes.map(str).filter((x): x is string => !!x) : [];
  const receipt: NormalizedReceipt = {
    date,
    dateMissing,
    time: str(r.heure),
    store: str(r.magasin),
    branch: str(r.succursale),
    number: str(r.numero),
    currency: str(r.devise)?.toUpperCase() ?? 'CAD',
    subtotal: readNumber(r.sousTotal),
    taxes: readNumber(r.taxes),
    total: readNumber(r.total),
    totalDiscount: readNumber(r.rabaisTotal) !== undefined ? Math.abs(readNumber(r.rabaisTotal)!) : undefined,
    items,
    uncertainties,
  };
  if (!receipt.store) warnings.push('Magasin non indiqué.');
  const sumPaid = items.filter((x) => !x.isReturn && x.paid !== undefined).reduce((s, x) => s + x.paid!, 0);
  if (receipt.subtotal !== undefined && items.every((x) => x.paid !== undefined) && Math.abs(sumPaid - receipt.subtotal) > 0.05) {
    warnings.push(`La somme des articles (${roundNice(sumPaid, 2)}) ne correspond pas au sous-total du reçu (${receipt.subtotal}) : un article est peut-être manquant ou mal lu.`);
  }
  return { receipt, warnings };
}

function readItem(raw: unknown, index: number): ReceiptItem {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const problems: string[] = [];
  const pr = (a.produit && typeof a.produit === 'object' ? a.produit : {}) as Record<string, unknown>;
  const productRef = { id: str(pr.id), name: str(pr.nom), family: str(pr.famille), variant: str(pr.variante), brand: str(pr.marque), category: str(pr.categorie) };
  const receiptName = str(a.nomRecu) ?? productRef.name ?? `Article ${index}`;
  if (!str(a.nomRecu)) problems.push('Nom du reçu absent');
  const uncertain = Array.isArray(a.incertain) ? a.incertain.map(str).filter((x): x is string => !!x) : [];

  let quantity = readNumber(a.quantite) ?? null;
  let unit: Unit | null = null;
  const unitRaw = str(a.unite);
  if (quantity !== null && unitRaw) {
    const m = normalizeMeasure(quantity, unitRaw);
    if (m) {
      quantity = m.quantity;
      unit = m.unit;
    } else problems.push(`Unité « ${unitRaw} » non reconnue`);
  } else if (unitRaw) {
    unit = normalizeUnit(unitRaw);
  }

  let weight: ReceiptItem['weight'];
  const w = a.poids && typeof a.poids === 'object' ? (a.poids as Record<string, unknown>) : undefined;
  const wq = readNumber(w?.quantite);
  if (w && wq !== undefined) {
    const m = normalizeMeasure(wq, w.unite);
    if (m && ['g', 'kg', 'ml', 'L'].includes(m.unit)) weight = m;
    else problems.push('Poids illisible');
  }
  if (quantity === null && !weight) {
    quantity = 1;
    unit = unit ?? 'unité';
    uncertain.push('quantite');
    problems.push('Quantité non indiquée : 1 article supposé');
  }

  let format: ReceiptItem['format'];
  const f = a.format && typeof a.format === 'object' ? (a.format as Record<string, unknown>) : undefined;
  if (f) {
    const c = f.contenance && typeof f.contenance === 'object' ? (f.contenance as Record<string, unknown>) : undefined;
    const cq = readNumber(c?.quantite);
    const content = cq !== undefined && cq > 0 ? normalizeMeasure(cq, c?.unite) ?? undefined : undefined;
    format = { label: str(f.libelle), content };
    if (c && !content) problems.push('Contenance du format illisible');
  } else if (typeof a.format === 'string' && a.format.trim()) {
    format = { label: a.format.trim() };
  }

  const unitPrice = readNumber(a.prixUnitaire);
  const totalPrice = readNumber(a.prixTotal);
  const d = readNumber(a.rabais);
  const discount = d !== undefined && d !== 0 ? Math.abs(d) : undefined;
  let paid = readNumber(a.prixPaye);
  if (paid === undefined && totalPrice !== undefined) paid = roundNice(totalPrice - (discount ?? 0), 2);
  if (paid === undefined && unitPrice !== undefined && quantity !== null && !weight) paid = roundNice(unitPrice * quantity - (discount ?? 0), 2);

  const isReturn = (quantity !== null && quantity < 0) || (paid !== undefined && paid < 0 && (totalPrice ?? paid) < 0);
  if (isReturn) problems.push('Retour ou remboursement : le stock n’est jamais diminué par une importation');
  const illegible = a.illisible === true;
  const confidence = a.confiance === 'haute' || a.confiance === 'moyenne' || a.confiance === 'faible' ? a.confiance : undefined;
  return {
    index, receiptName, productRef, quantity, unit, unitRaw, format, weight, unitPrice, totalPrice, discount,
    paid: paid !== undefined ? roundNice(paid, 2) : undefined, uncertain, illegible, confidence, note: str(a.note), problems, isReturn,
  };
}

// ---------------------------------------------------------------------------
// Empreinte (détection des doublons)
// ---------------------------------------------------------------------------

/** Hachage 53 bits rapide et stable (cyrb53). */
function hash(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/**
 * Empreinte du contenu du reçu : indépendante de la mise en forme du fichier, de l'ordre des clés et
 * des correspondances choisies. Le même reçu donne la même empreinte même s'il est régénéré.
 */
export function receiptFingerprint(r: NormalizedReceipt): string {
  const items = r.items.map((i) => [normText(i.receiptName), i.quantity ?? '', i.weight?.quantity ?? '', i.paid ?? i.totalPrice ?? ''].join('|')).sort();
  const head = [r.dateMissing ? '' : r.date, r.time ?? '', normText(r.store), normText(r.number), r.total ?? ''].join('|');
  return `rcpt-${hash(`${head}#${items.join('#')}`)}`;
}

// ---------------------------------------------------------------------------
// Quantités et correspondances
// ---------------------------------------------------------------------------

/**
 * Quantité à ajouter au stock, dans l'unité du produit. Conversions fiables seulement :
 * unités standard, conversions du produit, contenance indiquée du format, poids pesé.
 * `null` : la correspondance n'est pas connue, l'utilisateur doit la préciser.
 */
export function stockQuantityFor(item: ReceiptItem, product: Pick<Product, 'unit' | 'conversions'>): number | null {
  if (item.isReturn) return 0;
  const q = item.quantity;
  if (q !== null && item.unit) {
    const direct = convert(q, item.unit, product.unit, product);
    if (direct !== null) return roundNice(direct);
  }
  if (q !== null && item.format?.content) {
    const c = item.format.content;
    const viaFormat = convert(q * c.quantity, c.unit, product.unit, product);
    if (viaFormat !== null) return roundNice(viaFormat);
  }
  if (item.weight) {
    const viaWeight = convert(item.weight.quantity, item.weight.unit, product.unit, product);
    if (viaWeight !== null) return roundNice(viaWeight);
  }
  return null;
}

export type MatchConfidence = 'sûre' | 'probable' | 'à vérifier' | 'aucune';

export interface ItemMatch {
  productId?: ID;
  confidence: MatchConfidence;
  reason: string;
  /** Famille reconnue (pour créer une nouvelle variante dans la bonne famille). */
  familyId?: ID;
  categoryId?: ID;
}

function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function findCategory(name: string | undefined, categories: Category[]): Category | undefined {
  const n = normText(name);
  if (!n) return undefined;
  return categories.find((c) => normText(c.name) === n) ?? categories.find((c) => normText(c.name).includes(n) || n.includes(normText(c.name)));
}

export function findFamily(name: string | undefined, families: ProductFamily[]): ProductFamily | undefined {
  const w = words(name).join(' ');
  if (!w) return undefined;
  return families.find((f) => words(f.name).join(' ') === w);
}

/**
 * Reconnaît le produit de l'application qui correspond à un article du reçu :
 * identifiant fourni → nom déjà associé lors d'un import précédent → nom exact → famille et variante →
 * ressemblance des mots (à vérifier). Les produits archivés ne sont proposés que par identifiant.
 */
export function matchItem(item: ReceiptItem, products: Product[], families: ProductFamily[], categories: Category[]): ItemMatch {
  const active = products.filter((p) => !p.archived);
  const fam = findFamily(item.productRef.family, families);
  const categoryId = findCategory(item.productRef.category, categories)?.id ?? fam?.categoryId;
  const base = { familyId: fam?.id, categoryId };
  if (item.productRef.id) {
    const p = products.find((x) => x.id === item.productRef.id);
    if (p) return { ...base, productId: p.id, confidence: 'sûre', reason: 'Identifiant fourni dans le fichier', familyId: p.familyId ?? fam?.id };
  }
  const rn = normText(item.receiptName);
  const learned = active.find((p) => p.receiptNames?.includes(rn));
  if (learned) return { ...base, productId: learned.id, confidence: 'sûre', reason: 'Nom déjà associé lors d’un import précédent', familyId: learned.familyId };
  const name = words(item.productRef.name).join(' ');
  if (name) {
    const exact = active.find((p) => words(p.name).join(' ') === name);
    if (exact) return { ...base, productId: exact.id, confidence: 'sûre', reason: 'Même nom de produit', familyId: exact.familyId };
  }
  if (fam) {
    const members = active.filter((p) => p.familyId === fam.id);
    const v = words(item.productRef.variant).join(' ');
    const sameVariant = v ? members.find((p) => words(p.variant).join(' ') === v) : undefined;
    if (sameVariant) return { ...base, productId: sameVariant.id, confidence: 'probable', reason: `Famille « ${fam.name} », même variante` };
    if (!v && members.length === 1) return { ...base, productId: members[0].id, confidence: 'probable', reason: `Seul produit de la famille « ${fam.name} »` };
    if (members.length && fam.substitution !== 'non' && !v) {
      const recent = [...members].sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? ''))[0];
      return { ...base, productId: recent.id, confidence: 'à vérifier', reason: `Famille « ${fam.name} » : variante non précisée` };
    }
    return { ...base, confidence: 'aucune', reason: `Nouvelle variante de la famille « ${fam.name} »` };
  }
  const target = words(item.productRef.name ?? item.receiptName);
  let best: { p: Product; s: number } | undefined;
  for (const p of active) {
    const s = Math.max(similarity(target, words(p.name)), similarity(words(item.receiptName), words(p.name)));
    if (!best || s > best.s) best = { p, s };
  }
  if (best && best.s >= 0.5) return { ...base, productId: best.p.id, confidence: 'à vérifier', reason: 'Nom ressemblant', familyId: best.p.familyId };
  return { ...base, confidence: 'aucune', reason: 'Aucun produit correspondant' };
}

/** Unité proposée pour un nouveau produit créé depuis le reçu (unité pratique d'abord). */
export function suggestedUnit(item: ReceiptItem): Unit {
  if (item.unit && !(item.weight && item.unit === 'unité')) return item.unit;
  if (item.weight) return item.weight.unit === 'g' ? 'kg' : item.weight.unit === 'ml' ? 'L' : item.weight.unit;
  return 'unité';
}
