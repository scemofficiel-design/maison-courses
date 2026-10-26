import { db, SCHEMA_VERSION, TABLE_NAMES, type TableName } from './db';
import { nowISO, ValidationError } from './util';

export const BACKUP_APP = 'maison-courses';

export interface Backup {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  tables: Partial<Record<TableName, unknown[]>>;
}

/** Exporte toutes les données dans un objet JSON autonome. */
export async function exportAll(): Promise<Backup> {
  const tables: Backup['tables'] = {};
  await db.transaction('r', TABLE_NAMES.map((t) => db.table(t)), async () => {
    for (const t of TABLE_NAMES) tables[t] = await db.table(t).toArray();
  });
  return { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: nowISO(), tables };
}

export function backupFileName(date = new Date()) {
  const d = date.toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');
  return `maison-courses-sauvegarde-${d}.json`;
}

export interface BackupSummary {
  exportedAt: string;
  schemaVersion: number;
  counts: Partial<Record<TableName, number>>;
}

/** Vérifie la structure d'une sauvegarde avant toute restauration. */
export function validateBackup(data: unknown): Backup {
  if (!data || typeof data !== 'object') throw new ValidationError('Fichier illisible : ce n’est pas une sauvegarde Maison & Courses.');
  const b = data as Partial<Backup>;
  if (b.app !== BACKUP_APP) throw new ValidationError('Ce fichier ne provient pas de Maison & Courses.');
  if (typeof b.schemaVersion !== 'number') throw new ValidationError('Version de sauvegarde absente.');
  if (b.schemaVersion > SCHEMA_VERSION) throw new ValidationError('Cette sauvegarde provient d’une version plus récente de l’application : mettez l’application à jour avant de la restaurer.');
  if (!b.tables || typeof b.tables !== 'object') throw new ValidationError('Sauvegarde incomplète.');
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!(TABLE_NAMES as readonly string[]).includes(name)) throw new ValidationError(`Table inconnue dans la sauvegarde : ${name}`);
    if (!Array.isArray(rows)) throw new ValidationError(`Table ${name} invalide.`);
    const keyField = name === 'meta' ? 'key' : 'id';
    for (const row of rows) {
      if (!row || typeof row !== 'object' || typeof (row as Record<string, unknown>)[keyField] !== 'string') {
        throw new ValidationError(`Enregistrement invalide dans ${name}.`);
      }
    }
  }
  return b as Backup;
}

export function summarize(b: Backup): BackupSummary {
  const counts: BackupSummary['counts'] = {};
  for (const t of TABLE_NAMES) counts[t] = b.tables[t]?.length ?? 0;
  return { exportedAt: b.exportedAt, schemaVersion: b.schemaVersion, counts };
}

/**
 * Restaure une sauvegarde : remplace TOUTES les données actuelles, en une seule transaction
 * (en cas d'erreur, rien n'est modifié).
 */
export async function restoreBackup(data: unknown) {
  const b = validateBackup(data);
  const migrated = migrateBackup(b);
  await db.transaction('rw', TABLE_NAMES.map((t) => db.table(t)), async () => {
    for (const t of TABLE_NAMES) {
      await db.table(t).clear();
      const rows = migrated.tables[t];
      if (rows?.length) await db.table(t).bulkAdd(rows);
    }
  });
  return summarize(migrated);
}

/** Migrations des sauvegardes d'anciennes versions du schéma (aucune pour l'instant : v1). */
function migrateBackup(b: Backup): Backup {
  return b;
}
