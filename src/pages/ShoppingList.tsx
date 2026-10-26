import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db/db';
import {
  addLine, deleteList, markBought, markUnavailable, removeLine, removeOptionalLines, restoreLine, setActualPrice, substituteLine, unmarkBought, updateLine, updateList,
} from '../db/shoppingOps';
import { listTotals } from '../domain/shopping';
import type { ShoppingLine, ShoppingList } from '../domain/types';
import { formatMoney, formatQty } from '../domain/units';
import { t } from '../i18n/fr';
import { ProductPicker } from '../ui/bits';
import { GenerateSheet } from '../ui/GenerateSheet';
import { useCatalog } from '../ui/hooks';
import { Empty, Field, NumberInput, PageHead, Progress, Sheet, useUi } from '../ui/kit';

export default function ListPage() {
  const { id = '' } = useParams();
  const ui = useUi();
  const nav = useNavigate();
  const { categoryById, productById } = useCatalog();
  const list = useLiveQuery(() => db.lists.get(id), [id]);
  const lines = useLiveQuery(() => db.lines.where('listId').equals(id).sortBy('order'), [id]) ?? [];
  const substitutions = useLiveQuery(() => db.substitutions.toArray(), []) ?? [];
  const [buying, setBuying] = useState<ShoppingLine | null>(null);
  const [buy, setBuy] = useState<{ qty: number | null; price: number | null; stock: boolean; savePrice: boolean }>({ qty: null, price: null, stock: true, savePrice: true });
  const [actions, setActions] = useState<ShoppingLine | null>(null);
  const [edit, setEdit] = useState<{ qty: number | null; price: number | null; actual: number | null }>({ qty: null, price: null, actual: null });
  const [picker, setPicker] = useState<'add' | 'substitute' | null>(null);
  const [gen, setGen] = useState(false);
  const [editList, setEditList] = useState<Partial<ShoppingList> | null>(null);
  const [hideDone, setHideDone] = useState(false);

  const totals = useMemo(() => listTotals(lines), [lines]);
  const groups = useMemo(() => {
    const visible = lines.filter((l) => l.status !== 'retiré' && !(hideDone && l.status === 'acheté'));
    const m = new Map<string, ShoppingLine[]>();
    for (const l of visible) m.set(l.categoryId ?? 'autre', [...(m.get(l.categoryId ?? 'autre') ?? []), l]);
    return [...m.entries()].sort((a, b) => (categoryById.get(a[0])?.order ?? 99) - (categoryById.get(b[0])?.order ?? 99));
  }, [lines, hideDone, categoryById]);
  const removed = lines.filter((l) => l.status === 'retiré');

  if (list === undefined) return <div className="empty">Chargement…</div>;
  if (!list) return <Empty title="Liste introuvable" />;

  const openBuy = (l: ShoppingLine) => {
    if (l.status === 'acheté') {
      setActions(l);
      setEdit({ qty: l.quantity, price: l.estUnitPrice ?? null, actual: l.actualPrice ?? null });
      return;
    }
    setBuying(l);
    setBuy({ qty: l.quantity, price: null, stock: !!l.productId, savePrice: true });
  };
  const confirmBuy = async () => {
    if (!buying || !buy.qty) return;
    const ok = await ui.run(() => markBought(buying.id, { quantity: buy.qty!, price: buy.price ?? undefined, updateStock: buy.stock, savePrice: buy.savePrice }));
    if (ok) {
      ui.toast(buy.stock ? `${buying.name} : acheté, stock mis à jour` : `${buying.name} : acheté`, { action: { label: 'Annuler', run: () => ui.run(() => unmarkBought(buying.id)) } });
      setBuying(null);
    }
  };
  const subsFor = (l: ShoppingLine) => substitutions.filter((s) => s.fromProductId && s.fromProductId === l.productId && s.toProductId);
  const budget = list.budget;

  return (
    <div className="stack">
      <PageHead back="/courses" title={list.name} sub={<>{t.listStatus[list.status]}{list.store ? ` · ${list.store}` : ''}</>}
        actions={<button className="btn small" onClick={() => setEditList({ name: list.name, plannedDate: list.plannedDate, budget: list.budget, store: list.store })}>Modifier</button>} />

      <div className="card primary stack" style={{ gap: 8, position: 'sticky', top: 'calc(var(--safe-top) + 6px)', zIndex: 5 }}>
        <div className="row between">
          <div><div className="tiny muted">Dépensé</div><div className="strong" style={{ fontSize: '1.3rem' }}>{formatMoney(totals.spent, list.currency)}</div></div>
          <div className="right"><div className="tiny muted">Estimé</div><div className="strong">{formatMoney(totals.estimated, list.currency)}</div></div>
          {budget !== undefined && <div className="right"><div className="tiny muted">Budget</div><div className="strong">{formatMoney(budget, list.currency)}</div></div>}
        </div>
        {budget !== undefined && <Progress value={Math.max(totals.spent, totals.estimated)} max={budget} />}
        <div className="tiny muted">{totals.counts.bought}/{totals.counts.total} acheté(s) · reste estimé {formatMoney(totals.remainingEstimate, list.currency)}{totals.estimatedOfBought > 0 ? ` · écart ${totals.variance >= 0 ? '+' : ''}${formatMoney(totals.variance, list.currency)}` : ''}</div>
      </div>

      {list.notes && <p className="small muted">{list.notes}</p>}
      {budget !== undefined && totals.estimated > budget && (
        <div className="card warn small stack" style={{ gap: 6 }}>
          <span>Estimation au-dessus du budget de {formatMoney(totals.estimated - budget, list.currency)}.</span>
          {totals.optionalEstimate > 0 && <button className="btn small" onClick={async () => { const n = await ui.run(() => removeOptionalLines(list.id)); if (n !== undefined) ui.toast(`${n} article(s) facultatif(s) retiré(s)`); }}>Retirer les facultatifs (−{formatMoney(totals.optionalEstimate, list.currency)})</button>}
        </div>
      )}

      <div className="row between">
        <label className="check small"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Masquer les achetés</label>
      </div>

      {!lines.length && <Empty icon="📝" title="Liste vide">Ajoutez des articles ou complétez avec les menus.</Empty>}

      {groups.map(([catId, items]) => (
        <section key={catId}>
          <div className="section-title"><h2>{categoryById.get(catId)?.icon ?? '📦'} {categoryById.get(catId)?.name ?? 'Autres'}</h2></div>
          <div className="list">
            {items.map((l) => {
              const bought = l.status === 'acheté';
              const off = l.status === 'indisponible';
              return (
                <div key={l.id} className={`line-item ${bought ? 'bought' : ''} ${off ? 'off' : ''}`}>
                  <button className={`tick ${bought ? 'on' : ''}`} aria-label={bought ? `${l.name} acheté — corriger` : `Cocher ${l.name}`} aria-pressed={bought} onClick={() => (off ? ui.run(() => restoreLine(l.id)) : openBuy(l))}>
                    {bought && <Check />}
                  </button>
                  <button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0, minWidth: 0, cursor: 'pointer' }} onClick={() => { setActions(l); setEdit({ qty: l.quantity, price: l.estUnitPrice ?? null, actual: l.actualPrice ?? null }); }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="name strong ellipsis">{l.name}</span>
                      {l.priority === 'optionnel' && <span className="badge">Facultatif</span>}
                      {l.stockUnknown && <span className="badge info">Stock à vérifier</span>}
                      {off && <span className="badge warn">Indisponible</span>}
                    </div>
                    <div className="small muted">
                      {bought && l.actualQuantity !== undefined ? formatQty(l.actualQuantity, l.unit) : l.quantityLabel ?? formatQty(l.quantity, l.unit)}
                      {l.substituteForLineId ? ' · substitut' : ''}
                      {l.reasons.length > 0 && !bought && l.source !== 'document' ? ` · ${l.reasons[l.reasons.length - 1]}` : ''}
                    </div>
                  </button>
                  <div className="right small nowrap">
                    {bought && l.actualPrice !== undefined ? <strong>{formatMoney(l.actualPrice, list.currency)}</strong> : <span className="muted">{l.estTotal !== undefined ? formatMoney(l.estTotal, list.currency) : '—'}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {removed.length > 0 && (
        <details>
          <summary className="small muted">{removed.length} article(s) retiré(s)</summary>
          <div className="list">
            {removed.map((l) => (
              <div key={l.id} className="item"><span className="grow muted">{l.name}</span><button className="btn small ghost" onClick={() => ui.run(() => restoreLine(l.id))}>Remettre</button></div>
            ))}
          </div>
        </details>
      )}

      <div className="btn-row">
        <button className="btn soft grow" onClick={() => setPicker('add')}><Plus /> Ajouter un article</button>
        <button className="btn grow" onClick={() => setGen(true)}><Sparkles /> Compléter avec les menus</button>
      </div>
      <div className="btn-row">
        {list.status !== 'terminée' && <button className="btn grow" onClick={() => ui.run(() => updateList(list.id, { status: 'terminée' }), 'Liste terminée')}>Terminer la liste</button>}
        {list.status !== 'archivée' && <button className="btn grow" onClick={() => ui.run(() => updateList(list.id, { status: 'archivée' }), 'Liste archivée')}>Archiver</button>}
        {(list.status === 'terminée' || list.status === 'archivée') && <button className="btn grow" onClick={() => ui.run(() => updateList(list.id, { status: 'en cours' }), 'Liste rouverte')}>Rouvrir</button>}
        <button className="btn danger grow" onClick={async () => {
          if (!(await ui.confirm('Supprimer cette liste ?', { body: <p>Une liste avec des achats enregistrés est archivée pour conserver l’historique des dépenses.</p>, danger: true, confirm: 'Supprimer' }))) return;
          const r = await ui.run(() => deleteList(list.id));
          if (r) { ui.toast(r === 'supprimée' ? 'Liste supprimée' : 'Liste archivée (achats conservés)'); nav('/courses'); }
        }}>Supprimer</button>
      </div>

      {/* Achat */}
      <Sheet open={!!buying} onClose={() => setBuying(null)} title={buying ? `Acheté : ${buying.name}` : ''}
        footer={<button className="btn primary block" disabled={!buy.qty} onClick={confirmBuy}><Check /> Valider l’achat</button>}>
        {buying && (
          <>
            <div className="grid2">
              <Field label={`Quantité achetée (${buying.unit})`}><NumberInput value={buy.qty} onChange={(v) => setBuy({ ...buy, qty: v })} ariaLabel="Quantité achetée" /></Field>
              <Field label="Prix payé ($)" hint={buying.estTotal !== undefined ? `Estimé : ${formatMoney(buying.estTotal)}` : undefined}><NumberInput value={buy.price} onChange={(v) => setBuy({ ...buy, price: v })} ariaLabel="Prix payé" /></Field>
            </div>
            {buying.productId ? (
              <>
                <label className="check"><input type="checkbox" checked={buy.stock} onChange={(e) => setBuy({ ...buy, stock: e.target.checked })} /> Ajouter au stock ({productById.get(buying.productId)?.name})</label>
                {buy.price !== null && <label className="check small"><input type="checkbox" checked={buy.savePrice} onChange={(e) => setBuy({ ...buy, savePrice: e.target.checked })} /> Utiliser ce prix comme prix de référence vérifié</label>}
              </>
            ) : <p className="small muted">Article libre : non relié au stock.</p>}
          </>
        )}
      </Sheet>

      {/* Actions sur une ligne */}
      <Sheet open={!!actions} onClose={() => setActions(null)} title={actions?.name ?? ''}>
        {actions && (
          <>
            {actions.reasons.length > 0 && <div className="card info small"><strong>Pourquoi cet article ?</strong><ul className="clean">{actions.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
            {actions.status === 'acheté' ? (
              <>
                <Field label="Prix réellement payé ($)"><NumberInput value={edit.actual} onChange={(v) => setEdit({ ...edit, actual: v })} ariaLabel="Prix payé" /></Field>
                <div className="btn-row">
                  <button className="btn primary grow" onClick={() => ui.run(() => setActualPrice(actions.id, edit.actual ?? undefined), 'Prix corrigé').then(() => setActions(null))}>Enregistrer le prix</button>
                  <button className="btn grow" onClick={async () => {
                    if (await ui.confirm('Annuler cet achat ?', { body: <p>L’article redevient « à acheter » et la quantité ajoutée au stock est retirée.</p>, confirm: 'Annuler l’achat' })) {
                      await ui.run(() => unmarkBought(actions.id), 'Achat annulé');
                      setActions(null);
                    }
                  }}>Annuler l’achat</button>
                </div>
              </>
            ) : (
              <>
                <div className="grid2">
                  <Field label={`Quantité (${actions.unit})`}><NumberInput value={edit.qty} onChange={(v) => setEdit({ ...edit, qty: v })} ariaLabel="Quantité" /></Field>
                  <Field label={`Prix estimé / ${actions.unit}`} hint={actions.priceStatus === 'document' ? 'Estimation historique du document' : undefined}><NumberInput value={edit.price} onChange={(v) => setEdit({ ...edit, price: v })} ariaLabel="Prix estimé" /></Field>
                </div>
                <button className="btn primary" disabled={!edit.qty} onClick={() => ui.run(() => updateLine(actions.id, { quantity: edit.qty!, estUnitPrice: edit.price ?? undefined, priceStatus: edit.price !== (actions.estUnitPrice ?? null) ? 'estimé' : actions.priceStatus }), 'Article modifié').then(() => setActions(null))}>Enregistrer</button>
                <div className="btn-row">
                  <button className="btn grow" onClick={() => ui.run(() => markUnavailable(actions.id), 'Marqué indisponible').then(() => setActions(null))}>Indisponible</button>
                  <button className="btn grow" onClick={() => setPicker('substitute')}>Remplacer…</button>
                  <button className="btn grow" onClick={() => ui.run(() => removeLine(actions.id), 'Article retiré').then(() => setActions(null))}>Retirer</button>
                </div>
                {subsFor(actions).length > 0 && (
                  <div className="stack small">
                    <strong>Substitutions documentées</strong>
                    {subsFor(actions).map((s) => (
                      <button key={s.id} className="btn small soft" onClick={() => ui.run(() => substituteLine(actions.id, s.toProductId!), `Remplacé par ${s.toLabel}`).then(() => setActions(null))}>
                        {s.toLabel} — {s.reason}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Sheet>

      <ProductPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker === 'substitute' ? 'Remplacer par…' : 'Ajouter un article'}
        allowFree={picker === 'add'}
        onFree={(name) => ui.run(() => addLine(list.id, { name, quantity: 1, unit: 'unité', reasons: ['Article imprévu'] }), `${name} ajouté`).then(() => setPicker(null))}
        onPick={(p) => {
          if (picker === 'substitute' && actions) {
            ui.run(() => substituteLine(actions.id, p.id), `Remplacé par ${p.name}`).then(() => { setPicker(null); setActions(null); });
          } else {
            ui.run(() => addLine(list.id, { productId: p.id, quantity: p.purchaseStep ?? 1, reasons: ['Ajout manuel'] }), `${p.name} ajouté`).then(() => setPicker(null));
          }
        }}
      />

      <GenerateSheet open={gen} onClose={() => setGen(false)} targetListId={list.id} />

      <Sheet open={!!editList} onClose={() => setEditList(null)} title="Modifier la liste"
        footer={<button className="btn primary block" onClick={() => editList && ui.run(() => updateList(list.id, editList), 'Liste enregistrée').then(() => setEditList(null))}>Enregistrer</button>}>
        {editList && (
          <>
            <Field label="Nom"><input value={editList.name ?? ''} onChange={(e) => setEditList({ ...editList, name: e.target.value })} /></Field>
            <div className="grid2">
              <Field label="Date prévue"><input type="date" value={editList.plannedDate ?? ''} onChange={(e) => setEditList({ ...editList, plannedDate: e.target.value || undefined })} /></Field>
              <Field label="Budget cible ($)"><NumberInput value={editList.budget} onChange={(v) => setEditList({ ...editList, budget: v ?? undefined })} ariaLabel="Budget" /></Field>
            </div>
            <Field label="Magasin"><input value={editList.store ?? ''} onChange={(e) => setEditList({ ...editList, store: e.target.value || undefined })} /></Field>
          </>
        )}
      </Sheet>
    </div>
  );
}
