import type { ID, ProductFamily, SubstitutionMode } from '../domain/types';
import { normText } from '../domain/receipt';
import { db } from './db';
import { nowISO, uid, ValidationError } from './util';

export async function createFamily(input: { name: string; categoryId: ID; substitution?: SubstitutionMode; notes?: string }): Promise<ProductFamily> {
  const name = input.name.trim();
  if (!name) throw new ValidationError('Le nom de la famille est obligatoire.');
  const existing = (await db.families.toArray()).find((f) => normText(f.name) === normText(name));
  if (existing) return existing;
  const now = nowISO();
  // Par prudence, une nouvelle famille ne remplace rien d'office : les autres variantes sont proposées.
  const fam: ProductFamily = { id: uid('fam'), name, categoryId: input.categoryId, substitution: input.substitution ?? 'à confirmer', notes: input.notes, createdAt: now, updatedAt: now };
  await db.families.add(fam);
  return fam;
}

export async function updateFamily(id: ID, patch: Partial<ProductFamily>) {
  const f = await db.families.get(id);
  if (!f) throw new ValidationError('Famille introuvable.');
  if (patch.name !== undefined && !patch.name.trim()) throw new ValidationError('Le nom de la famille est obligatoire.');
  await db.families.update(id, { ...patch, updatedAt: nowISO(), userModified: f.seedKey ? true : f.userModified });
}

/** Supprime une famille : ses produits sont conservés, sans famille. */
export async function deleteFamily(id: ID) {
  await db.transaction('rw', db.families, db.products, async () => {
    const members = await db.products.where('familyId').equals(id).toArray();
    for (const p of members) await db.products.update(p.id, { familyId: undefined, updatedAt: nowISO() });
    await db.families.delete(id);
  });
}

/** Brouillon de produit pouvant demander la création d'une famille (champ `newFamilyName`). */
export async function resolveFamilyDraft<T extends { familyId?: ID; categoryId: ID }>(draft: T & { newFamilyName?: string }): Promise<T> {
  const { newFamilyName, ...rest } = draft;
  if (!newFamilyName?.trim()) return rest as unknown as T;
  const fam = await createFamily({ name: newFamilyName, categoryId: draft.categoryId });
  return { ...(rest as unknown as T), familyId: fam.id };
}
