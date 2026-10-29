import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../db/db';
import { resolveFamilyDraft } from '../db/familyOps';
import { addMissingToList } from '../db/shoppingOps';
import { adjustQuantity, archiveProduct, deleteProduct, markEmpty, markUnknown, recordLoss, reverseMovement, setQuantity, updateProduct } from '../db/stockOps';
import { forecast } from '../domain/insights';
import { formatQty, formatMoney, quickSteps, unitLabel } from '../domain/units';
import { StockBadge, qtyText } from '../ui/bits';
import { useCatalog, useSettings, useToday } from '../ui/hooks';
import { Empty, Field, NumberInput, PageHead, Sheet, useUi } from '../ui/kit';
import { ProductForm, type ProductDraft } from '../ui/ProductForm';

export default function ProductPage() {
  const { id = '' } = useParams();
  const ui = useUi();
  const nav = useNavigate();
  const on = useToday();
  const settings = useSettings();
  const { categoryById, locationById, locations, familyById } = useCatalog();
  const p = useLiveQuery(() => db.products.get(id), [id]);
  const movements = useLiveQuery(() => db.movements.where('productId').equals(id).reverse().sortBy('at'), [id]);
  const recipes = useLiveQuery(() => db.recipes.filter((r) => r.ingredients.some((i) => i.productId === id)).toArray(), [id]);
  const prices = useLiveQuery(() => db.prices.where('productId').equals(id).reverse().sortBy('date'), [id]) ?? [];
  const [edit, setEdit] = useState<ProductDraft | null>(null);
  const [sheet, setSheet] = useState<'set' | 'loss' | 'move' | null>(null);
  const [num, setNum] = useState<number | null>(null);
  const [lossReason, setLossReason] = useState<'perte' | 'périmé'>('périmé');
  if (p === undefined) return <div className="empty">Chargement…</div>;
  if (p === null || !p) return <Empty title="Produit introuvable" />;
  const fc = movements ? forecast(p, movements, new Date().toISOString()) : null;
  const steps = quickSteps(p.unit);

  const saveEdit = async () => {
    if (!edit) return;
    const ok = await ui.run(async () => updateProduct(p.id, await resolveFamilyDraft(edit)), 'Produit enregistré');
    if (ok !== undefined) setEdit(null);
  };

  return (
    <div className="stack">
      <PageHead back title={p.name} sub={<span className="row wrap">{categoryById.get(p.categoryId)?.icon} {categoryById.get(p.categoryId)?.name}<StockBadge p={p} warningDays={settings.expiryWarningDays} /></span>}
        actions={<button className="btn small" onClick={() => { const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = p; setEdit(rest); }}>Modifier</button>} />

      <div className="card stack">
        <div className="row between">
          <div>
            <div className="muted small">En stock</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{qtyText(p)}</div>
          </div>
          <div className="right small muted">
            {p.minQuantity !== undefined && <div>Seuil : {formatQty(p.minQuantity, p.unit)}</div>}
            {p.targetQuantity !== undefined && <div>Cible : {formatQty(p.targetQuantity, p.unit)}</div>}
          </div>
        </div>
        <div className="btn-row">
          {p.quantity !== null && steps.map((s) => (
            <button key={`m${s}`} className="btn small" disabled={p.quantity! <= 0} onClick={() => ui.run(() => adjustQuantity(p.id, -s))}>−{String(s).replace('.', ',')} {unitLabel(p.unit, s)}</button>
          ))}
          {steps.map((s) => (
            <button key={`p${s}`} className="btn small soft" onClick={() => ui.run(() => adjustQuantity(p.id, s))}>+{String(s).replace('.', ',')} {unitLabel(p.unit, s)}</button>
          ))}
        </div>
        <div className="btn-row">
          <button className="btn small" onClick={() => { setNum(p.quantity); setSheet('set'); }}>Fixer la quantité</button>
          <button className="btn small" onClick={() => ui.run(() => markEmpty(p.id), 'Indiqué comme épuisé')}>Tout épuisé</button>
          <button className="btn small" onClick={() => ui.run(() => markUnknown(p.id), 'Quantité inconnue')}>Je ne sais pas</button>
          <button className="btn small" onClick={() => { setNum(null); setSheet('loss'); }}>Périmé ou jeté</button>
          <button className="btn small" onClick={() => setSheet('move')}>Déplacer</button>
          <button className="btn small accent" onClick={async () => {
            const need = Math.max((p.targetQuantity ?? p.minQuantity ?? 1) - (p.quantity ?? 0), p.purchaseStep ?? 1);
            const res = await ui.run(() => addMissingToList([{ productId: p.id, quantity: need, reason: 'Ajout depuis la fiche produit' }], on));
            if (res) ui.toast(`Ajouté à « ${res.listName} »`, { action: { label: 'Voir', run: () => nav(`/courses/${res.listId}`) } });
          }}>À acheter</button>
        </div>
      </div>

      <div className="card stack small">
        {p.familyId && familyById.get(p.familyId) && (
          <div className="row between"><span className="muted">Famille</span><Link to={`/stocks/famille/${p.familyId}`}>{familyById.get(p.familyId)!.name}{p.variant ? ` · ${p.variant}` : ''}</Link></div>
        )}
        {!p.familyId && p.variant && <div className="row between"><span className="muted">Variante</span><span>{p.variant}</span></div>}
        {p.brand && <div className="row between"><span className="muted">Marque</span><span>{p.brand}</span></div>}
        {p.format && <div className="row between"><span className="muted">Format d’achat</span><span>{p.format}</span></div>}
        <div className="row between"><span className="muted">Emplacement</span><span>{p.locationId ? `${locationById.get(p.locationId)?.icon ?? ''} ${locationById.get(p.locationId)?.name ?? ''}` : '—'}</span></div>
        <div className="row between"><span className="muted">Péremption</span><span>{p.expiryDate ?? 'Non renseignée'}</span></div>
        <div className="row between"><span className="muted">Date d’achat</span><span>{p.purchaseDate ?? '—'}</span></div>
        <div className="row between"><span className="muted">Prix estimé</span><span>{p.unitPrice !== undefined ? `${formatMoney(p.unitPrice, p.currency)} / ${p.unit}` : '—'}</span></div>
        {p.priceSource && <p className="tiny muted">{p.priceStatus === 'vérifié' ? '✔ ' : 'Estimation — '}{p.priceSource}</p>}
        {p.lastPrice && (
          <div className="row between"><span className="muted">Dernier prix payé</span><span className="right">{formatMoney(p.lastPrice.amount, p.currency)} pour {formatQty(p.lastPrice.quantity, p.lastPrice.unit)}<div className="tiny muted">{p.lastPrice.date}{p.lastPrice.store ? ` · ${p.lastPrice.store}` : ''}</div></span></div>
        )}
        <div className="row between"><span className="muted">Type</span><span>{p.essential ? 'Essentiel' : 'Facultatif'} · {p.perishable ? 'Périssable' : 'Non périssable'}</span></div>
        {p.store && <div className="row between"><span className="muted">Magasin</span><span>{p.store}</span></div>}
        {p.conversions?.map((c) => <div key={c.unit + c.to} className="row between"><span className="muted">Conversion</span><span>1 {c.unit} = {c.amount} {c.to}</span></div>)}
        {p.notes && <p className="muted">{p.notes}</p>}
      </div>

      {fc && (
        <div className="card info small">
          <strong>Prévision indicative</strong> ({fc.source}) : environ {formatQty(fc.weeklyRate, p.unit)} par semaine
          {fc.daysLeft !== null ? `, soit ${fc.daysLeft} jour(s) de stock restant.` : '.'} Ce n’est pas une quantité constatée.
        </div>
      )}

      {!!recipes?.length && (
        <section>
          <div className="section-title"><h2>Utilisé dans</h2></div>
          <div className="chips">{recipes.map((r) => <Link key={r.id} className="chip" to={`/recettes/${r.id}`}>{r.name}</Link>)}</div>
        </section>
      )}

      {prices.length > 0 && (
        <section>
          <div className="section-title"><h2>Historique des prix</h2><span className="small muted">{prices.length}</span></div>
          <div className="list">
            {prices.slice(0, 12).map((r) => (
              <div key={r.id} className="item">
                <span className="grow">
                  <span className="title">{formatMoney(r.paid, r.currency)} · {formatQty(r.quantity, r.unit)}{r.format ? ` (${r.format})` : ''}</span>
                  <div className="meta">{r.date}{r.store ? ` · ${r.store}` : ''} · {r.source === 'reçu' ? 'reçu importé' : 'liste de courses'}{r.discount ? ` · rabais ${formatMoney(r.discount, r.currency)}` : ''}</div>
                </span>
                {r.unitPrice !== undefined && <span className="small nowrap">{formatMoney(r.unitPrice, r.currency)} / {p.unit}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-title"><h2>Historique</h2></div>
        <div className="list">
          {(movements ?? []).map((m) => (
            <div key={m.id} className="item" style={{ opacity: m.reversedBy ? 0.5 : 1 }}>
              <span className="grow">
                <span className="title" style={{ textTransform: 'capitalize' }}>{m.type}{m.delta !== null && m.delta !== 0 ? ` ${m.delta > 0 ? '+' : ''}${String(m.delta).replace('.', ',')} ${m.unit}` : ''}</span>
                <div className="meta">
                  {new Date(m.at).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })} · {m.before === null ? '?' : m.before} → {m.after === null ? '?' : m.after}
                  {m.note ? ` · ${m.note}` : ''}{m.toLocationId ? ` · vers ${locationById.get(m.toLocationId)?.name ?? ''}` : ''}{m.reversedBy ? ' · annulé' : ''}
                </div>
              </span>
              {!m.reversedBy && !['annulation', 'création', 'déplacement'].includes(m.type) && (
                <button className="btn small ghost" onClick={async () => {
                  if (await ui.confirm('Annuler ce mouvement ?', { body: <p>Un mouvement inverse sera ajouté à l’historique.</p>, confirm: 'Annuler le mouvement' })) {
                    await ui.run(() => reverseMovement(m.id), 'Mouvement annulé');
                  }
                }}>Corriger</button>
              )}
            </div>
          ))}
          {!movements?.length && <div className="item muted">Aucun mouvement.</div>}
        </div>
      </section>

      <div className="btn-row">
        <button className="btn" onClick={() => ui.run(() => archiveProduct(p.id, !p.archived), p.archived ? 'Produit réactivé' : 'Produit archivé')}>{p.archived ? 'Réactiver' : 'Archiver'}</button>
        <button className="btn danger" onClick={async () => {
          if (!(await ui.confirm(`Supprimer « ${p.name} » ?`, { body: <p>S’il est utilisé par une recette ou une liste, il sera archivé au lieu d’être supprimé.</p>, danger: true, confirm: 'Supprimer' }))) return;
          const r = await ui.run(() => deleteProduct(p.id));
          if (r) { ui.toast(r === 'supprimé' ? 'Produit supprimé' : 'Produit archivé (encore utilisé)'); nav('/stocks'); }
        }}>Supprimer</button>
      </div>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Modifier le produit"
        footer={<><button className="btn grow" onClick={() => setEdit(null)}>Annuler</button><button className="btn primary grow" onClick={saveEdit}>Enregistrer</button></>}>
        {edit && <ProductForm draft={edit} onChange={setEdit} />}
      </Sheet>

      <Sheet open={sheet === 'set'} onClose={() => setSheet(null)} title="Quantité constatée"
        footer={<button className="btn primary block" disabled={num === null} onClick={() => num !== null && ui.run(() => setQuantity(p.id, num, 'Inventaire'), 'Quantité enregistrée').then(() => setSheet(null))}>Enregistrer</button>}>
        <Field label={`Quantité (${p.unit})`}><NumberInput value={num} onChange={setNum} autoFocus ariaLabel="Quantité" /></Field>
      </Sheet>

      <Sheet open={sheet === 'loss'} onClose={() => setSheet(null)} title="Produit périmé ou jeté"
        footer={<>
          <button className="btn grow" onClick={() => ui.run(() => recordLoss(p.id, 'tout', lossReason), 'Enregistré').then(() => setSheet(null))}>Tout le stock</button>
          <button className="btn primary grow" disabled={!num} onClick={() => num && ui.run(() => recordLoss(p.id, num, lossReason), 'Enregistré').then(() => setSheet(null))}>Cette quantité</button>
        </>}>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={lossReason === 'périmé'} onClick={() => setLossReason('périmé')}>Périmé</button>
          <button role="tab" aria-selected={lossReason === 'perte'} onClick={() => setLossReason('perte')}>Jeté / perdu</button>
        </div>
        <Field label={`Quantité perdue (${p.unit})`}><NumberInput value={num} onChange={setNum} ariaLabel="Quantité perdue" /></Field>
      </Sheet>

      <Sheet open={sheet === 'move'} onClose={() => setSheet(null)} title="Déplacer vers…">
        <div className="list">
          {locations.map((l) => (
            <button key={l.id} className="item clickable" disabled={l.id === p.locationId} onClick={() => ui.run(() => updateProduct(p.id, { locationId: l.id }), `Déplacé : ${l.name}`).then(() => setSheet(null))}>
              <span className="icon">{l.icon}</span><span className="grow title">{l.name}</span>{l.id === p.locationId && <span className="badge">Actuel</span>}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
