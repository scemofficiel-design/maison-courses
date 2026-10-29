import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../db/db';
import { deleteFamily, resolveFamilyDraft, updateFamily } from '../db/familyOps';
import { createProduct } from '../db/stockOps';
import { familyStock } from '../domain/families';
import type { SubstitutionMode, Unit } from '../domain/types';
import { ALL_UNITS, formatMoney, formatQty } from '../domain/units';
import { StockBadge, qtyText } from '../ui/bits';
import { useCatalog, useSettings } from '../ui/hooks';
import { Empty, Field, PageHead, Sheet, useUi } from '../ui/kit';
import { emptyDraft, ProductForm, type ProductDraft } from '../ui/ProductForm';

export const SUBSTITUTION_HELP: Record<SubstitutionMode, { label: string; help: string }> = {
  interchangeable: { label: 'Interchangeables', help: 'Toute variante couvre le besoin d’une autre (ex. raisins verts ou rouges). Les variantes interdites par un profil ne sont jamais utilisées.' },
  'à confirmer': { label: 'À confirmer', help: 'Les autres variantes sont proposées, jamais comptées d’office (ex. yaourt nature ou aux fruits). Une même variante d’une autre marque ou d’un autre format reste équivalente.' },
  non: { label: 'Non interchangeables', help: 'Simple regroupement pour l’affichage (ex. tomates fraîches et en conserve). Seule une même variante d’une autre marque ou d’un autre format est équivalente.' },
};

export default function FamilyPage() {
  const { id = '' } = useParams();
  const ui = useUi();
  const nav = useNavigate();
  const settings = useSettings();
  const { categoryById, categories } = useCatalog();
  const fam = useLiveQuery(() => db.families.get(id), [id]);
  const members = useLiveQuery(() => db.products.where('familyId').equals(id).toArray(), [id]) ?? [];
  const prices = useLiveQuery(() => db.prices.where('familyId').equals(id).reverse().sortBy('date'), [id]) ?? [];
  const [edit, setEdit] = useState<{ name: string; notes: string; categoryId: string } | null>(null);
  const [adding, setAdding] = useState<ProductDraft | null>(null);
  if (fam === undefined) return <div className="empty">Chargement…</div>;
  if (!fam) return <Empty title="Famille introuvable" />;
  const stock = familyStock(fam, members);
  const productName = new Map(members.map((p) => [p.id, p.name]));
  const active = members.filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return (
    <div className="stack">
      <PageHead back title={fam.name} sub={`${categoryById.get(fam.categoryId)?.icon ?? ''} ${categoryById.get(fam.categoryId)?.name ?? ''} · famille de produits`}
        actions={<button className="btn small" onClick={() => setEdit({ name: fam.name, notes: fam.notes ?? '', categoryId: fam.categoryId })}>Modifier</button>} />

      <div className="card stack">
        <div className="muted small">Stock global</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stock.text}</div>
        <p className="tiny muted">Les quantités ne sont additionnées que si la conversion entre formats est connue ; sinon elles restent séparées par unité.</p>
        <Field label="Unité de synthèse (facultative)">
          <select value={fam.unit ?? ''} onChange={(e) => ui.run(() => updateFamily(fam.id, { unit: (e.target.value || undefined) as Unit | undefined }))}>
            <option value="">Par unité de chaque variante</option>
            {ALL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
      </div>

      <section className="card stack small">
        <h2>Remplacement entre variantes</h2>
        <div className="chips" role="group" aria-label="Remplacement entre variantes">
          {(Object.keys(SUBSTITUTION_HELP) as SubstitutionMode[]).map((m) => (
            <button key={m} className="chip" aria-pressed={fam.substitution === m} onClick={() => ui.run(() => updateFamily(fam.id, { substitution: m }), 'Règle enregistrée')}>{SUBSTITUTION_HELP[m].label}</button>
          ))}
        </div>
        <p className="muted">{SUBSTITUTION_HELP[fam.substitution].help}</p>
        <p className="tiny muted">Une recette peut exiger une variante précise (case « Cette variante seulement » dans la recette).</p>
        {fam.notes && <p>{fam.notes}</p>}
      </section>

      <section>
        <div className="section-title"><h2>Variantes et formats</h2><span className="small muted">{active.length}</span></div>
        <div className="list">
          {active.map((p) => (
            <Link key={p.id} to={`/stocks/${p.id}`} className="item">
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="row" style={{ gap: 6 }}><span className="title ellipsis">{p.name}</span><StockBadge p={p} warningDays={settings.expiryWarningDays} /></span>
                <div className="meta">{[p.variant, p.brand, p.format].filter(Boolean).join(' · ') || 'Variante non précisée'}</div>
                {p.lastPrice && <div className="meta">Dernier prix : {formatMoney(p.lastPrice.amount, p.currency)} pour {formatQty(p.lastPrice.quantity, p.lastPrice.unit)} ({p.lastPrice.date}{p.lastPrice.store ? `, ${p.lastPrice.store}` : ''})</div>}
              </span>
              <span className="small strong nowrap">{qtyText(p)}</span>
            </Link>
          ))}
          {!active.length && <div className="item muted small">Aucune référence dans cette famille.</div>}
        </div>
        <button className="btn soft block" style={{ marginTop: 10 }} onClick={() => setAdding({ ...emptyDraft(fam.categoryId), familyId: fam.id })}><Plus /> Ajouter une variante</button>
      </section>

      {prices.length > 0 && (
        <section>
          <div className="section-title"><h2>Prix payés</h2></div>
          <div className="list">
            {prices.slice(0, 20).map((r) => (
              <div key={r.id} className="item">
                <span className="grow">
                  <span className="title">{productName.get(r.productId) ?? 'Produit'}</span>
                  <div className="meta">{r.date}{r.store ? ` · ${r.store}` : ''} · {formatQty(r.quantity, r.unit)}{r.format ? ` (${r.format})` : ''}{r.discount ? ` · rabais ${formatMoney(r.discount, r.currency)}` : ''}</div>
                </span>
                <span className="right small"><strong>{formatMoney(r.paid, r.currency)}</strong>{r.unitPrice !== undefined && <div className="tiny muted">{formatMoney(r.unitPrice, r.currency)} / unité de stock</div>}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <button className="btn danger" onClick={async () => {
        if (!(await ui.confirm(`Supprimer la famille « ${fam.name} » ?`, { body: <p>Les produits sont conservés, sans famille. Leurs stocks ne seront plus regroupés.</p>, danger: true, confirm: 'Supprimer' }))) return;
        await ui.run(() => deleteFamily(fam.id), 'Famille supprimée');
        nav('/stocks?vue=familles');
      }}>Supprimer la famille</button>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Modifier la famille"
        footer={<><button className="btn grow" onClick={() => setEdit(null)}>Annuler</button><button className="btn primary grow" onClick={() => edit && ui.run(() => updateFamily(fam.id, { name: edit.name, notes: edit.notes || undefined, categoryId: edit.categoryId }), 'Famille enregistrée').then(() => setEdit(null))}>Enregistrer</button></>}>
        {edit && (
          <>
            <Field label="Nom"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Catégorie">
              <select value={edit.categoryId} onChange={(e) => setEdit({ ...edit, categoryId: e.target.value })}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </Field>
            <Field label="Notes"><textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </>
        )}
      </Sheet>

      <Sheet open={!!adding} onClose={() => setAdding(null)} title={`Nouvelle variante — ${fam.name}`}
        footer={<><button className="btn grow" onClick={() => setAdding(null)}>Annuler</button><button className="btn primary grow" onClick={async () => {
          if (!adding) return;
          const p = await ui.run(async () => createProduct(await resolveFamilyDraft(adding)), 'Variante ajoutée');
          if (p) setAdding(null);
        }}>Enregistrer</button></>}>
        {adding && <ProductForm draft={adding} onChange={setAdding} />}
      </Sheet>
    </div>
  );
}
