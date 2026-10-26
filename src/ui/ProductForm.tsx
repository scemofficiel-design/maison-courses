import { useState } from 'react';
import type { Product, Unit, UnitConversion } from '../domain/types';
import { ALL_UNITS } from '../domain/units';
import { useCatalog } from './hooks';
import { Field, NumberInput } from './kit';

export type ProductDraft = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;

export function emptyDraft(categoryId = 'cat-legumes'): ProductDraft {
  return { name: '', categoryId, unit: 'unité', quantity: null, currency: 'CAD', essential: true, perishable: false, tags: [] };
}

/** Formulaire de produit : les champs essentiels d'abord, le reste replié. */
export function ProductForm({ draft, onChange }: { draft: ProductDraft; onChange: (d: ProductDraft) => void }) {
  const { categories, locations } = useCatalog();
  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) => onChange({ ...draft, [k]: v });
  const [unknown, setUnknown] = useState(draft.quantity === null);
  const conv: UnitConversion | undefined = draft.conversions?.[0];
  return (
    <div className="stack">
      <Field label="Nom">
        <input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. Riz basmati" autoFocus={!draft.name} />
      </Field>
      <div className="grid2">
        <Field label="Catégorie">
          <select value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </Field>
        <Field label="Unité">
          <select value={draft.unit} onChange={(e) => set('unit', e.target.value as Unit)}>
            {ALL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid2">
        <Field label="Quantité actuelle">
          {unknown ? <input disabled value="Inconnue" aria-label="Quantité inconnue" /> : <NumberInput value={draft.quantity} onChange={(v) => set('quantity', v ?? 0)} ariaLabel="Quantité actuelle" />}
        </Field>
        <Field label="Emplacement">
          <select value={draft.locationId ?? ''} onChange={(e) => set('locationId', e.target.value || undefined)}>
            <option value="">—</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
          </select>
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={unknown} onChange={(e) => { setUnknown(e.target.checked); set('quantity', e.target.checked ? null : 0); }} />
        Je ne sais pas ce qu’il reste
      </label>
      <div className="grid2">
        <Field label="Seuil minimal" hint="Alerte en dessous">
          <NumberInput value={draft.minQuantity} onChange={(v) => set('minQuantity', v ?? undefined)} ariaLabel="Seuil minimal" />
        </Field>
        <Field label="Quantité cible" hint="Après réapprovisionnement">
          <NumberInput value={draft.targetQuantity} onChange={(v) => set('targetQuantity', v ?? undefined)} ariaLabel="Quantité cible" />
        </Field>
      </div>
      <div className="grid2">
        <Field label="Date de péremption" hint="Facultative, jamais devinée">
          <input type="date" value={draft.expiryDate ?? ''} onChange={(e) => set('expiryDate', e.target.value || undefined)} />
        </Field>
        <Field label={`Prix estimé (par ${draft.unit})`}>
          <NumberInput value={draft.unitPrice} onChange={(v) => onChange({ ...draft, unitPrice: v ?? undefined, priceStatus: v === null ? undefined : 'estimé', priceSource: v === null ? undefined : 'Saisi manuellement' })} ariaLabel="Prix estimé" />
        </Field>
      </div>
      <div className="row wrap" style={{ gap: 16 }}>
        <label className="check"><input type="checkbox" checked={draft.essential} onChange={(e) => set('essential', e.target.checked)} /> Essentiel</label>
        <label className="check"><input type="checkbox" checked={draft.perishable} onChange={(e) => set('perishable', e.target.checked)} /> Périssable</label>
      </div>
      <details>
        <summary>Plus d’informations</summary>
        <div className="stack" style={{ marginTop: 8 }}>
          <div className="grid2">
            <Field label="Date d’achat">
              <input type="date" value={draft.purchaseDate ?? ''} onChange={(e) => set('purchaseDate', e.target.value || undefined)} />
            </Field>
            <Field label="Magasin habituel">
              <input value={draft.store ?? ''} onChange={(e) => set('store', e.target.value || undefined)} />
            </Field>
          </div>
          <div className="grid2">
            <Field label="Format de vente" hint={`Arrondi des achats (en ${draft.unit})`}>
              <NumberInput value={draft.purchaseStep} onChange={(v) => set('purchaseStep', v ?? undefined)} ariaLabel="Format de vente" />
            </Field>
            <Field label="Consommation habituelle" hint={`${draft.unit} par semaine, indicatif`}>
              <NumberInput value={draft.usualWeeklyConsumption} onChange={(v) => set('usualWeeklyConsumption', v ?? undefined)} ariaLabel="Consommation habituelle" />
            </Field>
          </div>
          <Field label={`Conversion : 1 ${draft.unit} =`} hint="Ex. 1 paquet = 300 g, 1 pain = 20 tranches. Permet de relier recettes et stock.">
            <div className="row">
              <NumberInput value={conv?.amount} ariaLabel="Quantité de conversion" onChange={(v) => set('conversions', v ? [{ unit: draft.unit, amount: v, to: conv?.to ?? 'g' }] : undefined)} />
              <select value={conv?.to ?? 'g'} aria-label="Unité de conversion" onChange={(e) => set('conversions', conv ? [{ ...conv, unit: draft.unit, to: e.target.value as Unit }] : undefined)}>
                {ALL_UNITS.filter((u) => u !== draft.unit).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Étiquettes" hint="Séparées par des virgules ; servent aux restrictions (ex. poisson-gras, sucre)">
            <input value={draft.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
          </Field>
          <Field label="Code-barres">
            <input inputMode="numeric" value={draft.barcode ?? ''} onChange={(e) => set('barcode', e.target.value || undefined)} />
          </Field>
          <Field label="Notes">
            <textarea value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />
          </Field>
        </div>
      </details>
    </div>
  );
}
