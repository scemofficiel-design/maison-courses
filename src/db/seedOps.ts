import { buildSeed, SEED_VERSION, type SeedData } from '../seed/build';
import { db } from './db';
import { DEFAULT_SETTINGS } from './entityOps';
import { nowISO } from './util';

type SeedTable = keyof SeedData;
const SEED_TABLES: SeedTable[] = ['categories', 'locations', 'products', 'recipes', 'profiles', 'persons', 'plans', 'lists', 'lines', 'budgets', 'substitutions'];

/**
 * Champs « vivants » : ils décrivent l'état réel de la maison (stock, achats, dates du plan).
 * Une mise à jour ou une réinitialisation des données initiales ne les modifie jamais.
 */
const LIVE_FIELDS: Partial<Record<SeedTable, string[]>> = {
  products: ['quantity', 'purchaseDate', 'expiryDate', 'archived', 'locationId'],
  plans: ['active', 'startDate', 'endDate', 'materialized', 'archivedAt'],
  lists: ['status', 'periodStart', 'periodEnd', 'plannedDate'],
  lines: ['status', 'actualQuantity', 'actualPrice', 'purchaseId'],
  budgets: ['periodStart', 'periodEnd'],
};

function keepLive(table: SeedTable, fresh: Record<string, unknown>, current: Record<string, unknown>) {
  const out = { ...fresh };
  for (const f of LIVE_FIELDS[table] ?? []) if (f in current) out[f] = current[f];
  out.createdAt = current.createdAt ?? fresh.createdAt;
  return out;
}

async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

/**
 * Installe les données initiales au premier lancement, puis applique les nouvelles versions
 * sans écraser ce que l'utilisateur a modifié (`userModified`) ni ce qu'il a supprimé.
 */
export async function ensureSeed(): Promise<'installé' | 'mis à jour' | 'à jour'> {
  const version = await getMeta<number>('seedVersion');
  if (version !== undefined && version >= SEED_VERSION) return 'à jour';
  const seed = buildSeed(nowISO());
  const known = new Set((await getMeta<string[]>('seedKeys')) ?? []);
  await db.transaction('rw', [...SEED_TABLES.map((t) => db.table(t)), db.settings, db.meta], async () => {
    for (const t of SEED_TABLES) {
      const table = db.table(t);
      for (const row of seed[t] as unknown as Record<string, unknown>[]) {
        const current = (await table.get(row.id as string)) as Record<string, unknown> | undefined;
        if (!current) {
          // Absente : nouvelle donnée initiale, ou donnée supprimée par l'utilisateur (alors on la laisse supprimée).
          if (!known.has(row.seedKey as string)) await table.add(row);
        } else if (!current.userModified) {
          await table.put(keepLive(t, row, current));
        }
        known.add(row.seedKey as string);
      }
    }
    if (!(await db.settings.get('app'))) await db.settings.put(DEFAULT_SETTINGS);
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION });
    await db.meta.put({ key: 'seedKeys', value: [...known] });
    if (version === undefined) await db.meta.put({ key: 'installedAt', value: nowISO() });
  });
  return version === undefined ? 'installé' : 'mis à jour';
}

export type ResetScope = 'recipes' | 'profiles' | 'plan' | 'lists' | 'catalog';

const SCOPE_TABLES: Record<ResetScope, SeedTable[]> = {
  recipes: ['recipes'],
  profiles: ['profiles', 'persons'],
  plan: ['plans', 'budgets', 'substitutions'],
  lists: ['lists', 'lines'],
  catalog: ['categories', 'locations', 'products'],
};

/**
 * Réinitialise les données de démonstration choisies à leur état d'origine.
 * Ne touche jamais : les données créées par l'utilisateur, les quantités en stock, l'historique,
 * les achats enregistrés, les repas préparés.
 */
export async function resetDemoData(scopes: ResetScope[]) {
  const seed = buildSeed(nowISO());
  const tables = [...new Set(scopes.flatMap((s) => SCOPE_TABLES[s]))];
  let restored = 0;
  await db.transaction('rw', tables.map((t) => db.table(t)), async () => {
    for (const t of tables) {
      const table = db.table(t);
      for (const row of seed[t] as unknown as Record<string, unknown>[]) {
        const current = (await table.get(row.id as string)) as Record<string, unknown> | undefined;
        if (t === 'lines' && current && current.status === 'acheté') continue;
        await table.put(current ? keepLive(t, row, current) : row);
        restored++;
      }
    }
  });
  return restored;
}
