import { useLiveQuery } from 'dexie-react-hooks';
import { Minus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../db/db';
import { adjustQuantity, createProduct, setQuantity } from '../db/stockOps';
import { expiryLevel, stockLevel } from '../domain/stock';
import type { Product } from '../domain/types';
import { quickSteps, unitLabel } from '../domain/units';
import { StockBadge, qtyText } from '../ui/bits';
import { norm, useCatalog, useSettings, useToday } from '../ui/hooks';
import { Chips, Empty, NumberInput, PageHead, SearchBox, Sheet, useUi } from '../ui/kit';
import { emptyDraft, ProductForm, type ProductDraft } from '../ui/ProductForm';

type StatusFilter = 'tous' | 'ok' | 'bas' | 'épuisé' | 'inconnu' | 'péremption';
type KindFilter = 'tout' | 'alimentaire' | 'maison';

export default function StocksPage() {
  const [params, setParams] = useSearchParams();
  const { products, categories, categoryById, locations, locationById, ready } = useCatalog();
  const settings = useSettings();
  const on = useToday();
  const ui = useUi();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<KindFilter>('tout');
  const [cat, setCat] = useState('');
  const [loc, setLoc] = useState('');
  const status = (params.get('f') as StatusFilter) ?? 'tous';
  const [creating, setCreating] = useState<ProductDraft | null>(null);
  const [setting, setSetting] = useState<Product | null>(null);
  const [setValue, setSetValue] = useState<number | null>(null);
  const archivedCount = useLiveQuery(() => db.products.filter((p) => !!p.archived).count(), []);
  const [showArchived, setShowArchived] = useState(false);

  const shown = useMemo(() => {
    const n = norm(q);
    return products.filter((p) => {
      if (!!p.archived !== showArchived) return false;
      if (n && !norm(p.name).includes(n) && p.barcode !== q.trim()) return false;
      const c = categoryById.get(p.categoryId);
      if (kind !== 'tout' && c?.kind !== kind) return false;
      if (cat && p.categoryId !== cat) return false;
      if (loc && p.locationId !== loc) return false;
      const lvl = stockLevel(p);
      switch (status) {
        case 'ok': return lvl === 'ok' || lvl === 'bas';
        case 'bas': return lvl === 'bas';
        case 'épuisé': return lvl === 'épuisé';
        case 'inconnu': return lvl === 'inconnu';
        case 'péremption': return ['bientôt', 'périmé'].includes(expiryLevel(p, on, settings.expiryWarningDays));
        default: return true;
      }
    });
  }, [products, q, kind, cat, loc, status, categoryById, on, settings.expiryWarningDays, showArchived]);

  const grouped = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of shown) m.set(p.categoryId, [...(m.get(p.categoryId) ?? []), p]);
    return categories.filter((c) => m.has(c.id)).map((c) => ({ c, items: m.get(c.id)! }));
  }, [shown, categories]);

  const save = async () => {
    if (!creating) return;
    const p = await ui.run(() => createProduct(creating), 'Produit ajouté');
    if (p) setCreating(null);
  };

  return (
    <div className="stack">
      <PageHead title="Stocks" sub={`${products.filter((p) => !p.archived).length} produits suivis`} />
      <SearchBox value={q} onChange={setQ} placeholder="Rechercher un produit ou un code-barres" />
      <Chips label="Type" value={kind} onChange={setKind} options={[{ value: 'tout', label: 'Tout' }, { value: 'alimentaire', label: 'Alimentaire' }, { value: 'maison', label: 'Maison' }]} />
      <Chips
        label="Statut"
        value={status}
        onChange={(v) => setParams(v === 'tous' ? {} : { f: v }, { replace: true })}
        options={[
          { value: 'tous', label: 'Tous' }, { value: 'ok', label: 'Disponibles' }, { value: 'bas', label: 'Bas' }, { value: 'épuisé', label: 'Épuisés' },
          { value: 'inconnu', label: 'Inconnus' }, { value: 'péremption', label: 'Péremption' },
        ]}
      />
      <div className="grid2">
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie">
          <option value="">Toutes catégories</option>
          {categories.filter((c) => kind === 'tout' || c.kind === kind).map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <select value={loc} onChange={(e) => setLoc(e.target.value)} aria-label="Emplacement">
          <option value="">Tous emplacements</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
        </select>
      </div>

      {ready && grouped.length === 0 && <Empty title="Aucun produit" icon="🔍">Modifiez les filtres ou ajoutez un produit avec le bouton +.</Empty>}

      {grouped.map(({ c, items }) => (
        <section key={c.id}>
          <div className="section-title"><h2>{c.icon} {c.name}</h2><span className="small muted">{items.length}</span></div>
          <div className="list">
            {items.map((p) => {
              const step = quickSteps(p.unit)[0];
              return (
                <div key={p.id} className="item">
                  <Link to={`/stocks/${p.id}`} className="grow" style={{ color: 'inherit', textDecoration: 'none', minWidth: 0 }}>
                    <div className="row" style={{ gap: 6 }}><span className="title ellipsis">{p.name}</span><StockBadge p={p} warningDays={settings.expiryWarningDays} /></div>
                    <div className="meta">{qtyText(p)}{p.locationId ? ` · ${locationById.get(p.locationId)?.name ?? ''}` : ''}{p.minQuantity !== undefined ? ` · seuil ${p.minQuantity}` : ''}</div>
                  </Link>
                  {p.quantity === null ? (
                    <button className="btn small soft" onClick={() => { setSetting(p); setSetValue(null); }}>Indiquer</button>
                  ) : (
                    <div className="stepper" aria-label={`Quantité de ${p.name}`}>
                      <button aria-label={`Retirer ${step} ${unitLabel(p.unit, step)}`} disabled={p.quantity <= 0} onClick={() => ui.run(() => adjustQuantity(p.id, -step))}><Minus size={18} /></button>
                      <button aria-label={`Ajouter ${step} ${unitLabel(p.unit, step)}`} onClick={() => ui.run(() => adjustQuantity(p.id, step))}><Plus size={18} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {!!archivedCount && (
        <button className="btn ghost" onClick={() => setShowArchived((s) => !s)}>{showArchived ? 'Masquer les produits archivés' : `Voir les produits archivés (${archivedCount})`}</button>
      )}

      <button className="fab" aria-label="Ajouter un produit" onClick={() => setCreating(emptyDraft(cat || categories[0]?.id))}><Plus /></button>

      <Sheet open={!!creating} onClose={() => setCreating(null)} title="Nouveau produit"
        footer={<><button className="btn grow" onClick={() => setCreating(null)}>Annuler</button><button className="btn primary grow" onClick={save}>Enregistrer</button></>}>
        {creating && <ProductForm draft={creating} onChange={setCreating} />}
      </Sheet>

      <Sheet open={!!setting} onClose={() => setSetting(null)} title={setting ? `Combien reste-t-il : ${setting.name} ?` : ''}
        footer={<>
          <button className="btn grow" onClick={() => setting && ui.run(() => setQuantity(setting.id, 0), 'Indiqué comme épuisé').then(() => setSetting(null))}>Il n’en reste plus</button>
          <button className="btn primary grow" disabled={setValue === null} onClick={() => setting && setValue !== null && ui.run(() => setQuantity(setting.id, setValue), 'Quantité enregistrée').then(() => setSetting(null))}>Enregistrer</button>
        </>}>
        {setting && (
          <>
            <label className="field">Quantité ({setting.unit})<NumberInput value={setValue} onChange={setSetValue} autoFocus ariaLabel="Quantité" /></label>
            <button className="btn ghost" onClick={() => nav(`/stocks/${setting.id}`)}>Ouvrir la fiche complète</button>
          </>
        )}
      </Sheet>
    </div>
  );
}
