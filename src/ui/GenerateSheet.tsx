import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { periodRange } from '../db/planOps';
import { commitGeneration, createList, previewGeneration, type GenerationPreview } from '../db/shoppingOps';
import { addDays, formatDateShort } from '../domain/dates';
import type { ID } from '../domain/types';
import { formatMoney, formatQty, round2 } from '../domain/units';
import { useCatalog, useToday } from './hooks';
import { Field, NumberInput, Sheet, useUi } from './kit';

/**
 * Génération d'une liste à partir des menus d'une période et des stocks.
 * Toujours en deux temps : aperçu explicable et modifiable, puis enregistrement confirmé.
 */
export function GenerateSheet({ open, onClose, targetListId }: { open: boolean; onClose: () => void; targetListId?: ID }) {
  const on = useToday();
  const ui = useUi();
  const nav = useNavigate();
  const { categoryById } = useCatalog();
  const plans = useLiveQuery(() => db.plans.toArray(), []) ?? [];
  const target = useLiveQuery(() => (targetListId ? db.lists.get(targetListId) : undefined), [targetListId]);
  const [start, setStart] = useState(on);
  const [end, setEnd] = useState(addDays(on, 6));
  const [lowStock, setLowStock] = useState(true);
  const [optional, setOptional] = useState(false);
  const [preview, setPreview] = useState<GenerationPreview | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [off, setOff] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [budget, setBudget] = useState<number | null>(null);

  useEffect(() => {
    if (target?.periodStart && target.periodEnd) {
      setStart(target.periodStart);
      setEnd(target.periodEnd);
    }
  }, [target?.periodStart, target?.periodEnd]);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    previewGeneration({ start, end, includeLowStock: lowStock, includeOptional: optional, targetListId }).then((p) => {
      if (cancel) return;
      setPreview(p);
      setQty(Object.fromEntries(p.lines.map((l) => [l.productId, l.quantity])));
      setOff(new Set());
    });
    return () => {
      cancel = true;
    };
  }, [open, start, end, lowStock, optional, targetListId]);

  const selected = preview?.lines.filter((l) => !off.has(l.productId)) ?? [];
  const total = round2(selected.reduce((s, l) => s + (l.estUnitPrice !== undefined ? l.estUnitPrice * (qty[l.productId] ?? l.quantity) : 0), 0));
  const optionalTotal = round2(selected.filter((l) => l.priority === 'optionnel').reduce((s, l) => s + (l.estUnitPrice ?? 0) * (qty[l.productId] ?? l.quantity), 0));

  const periods = plans.filter((p) => p.startDate).flatMap((p) => p.periods.map((x) => ({ plan: p, period: x, range: periodRange(p, x.index)! })));

  const save = async () => {
    const lines = selected.map((l) => ({ ...l, quantity: qty[l.productId] ?? l.quantity }));
    const res = await ui.run(async () => {
      const listId = targetListId ?? (await createList({ name: name.trim() || `Courses du ${formatDateShort(start)} au ${formatDateShort(end)}`, plannedDate: start, periodStart: start, periodEnd: end, budget: budget ?? undefined })).id;
      await commitGeneration(listId, lines.filter((l) => l.quantity > 0));
      return listId;
    }, `${lines.length} article(s) ajouté(s)`);
    if (res) {
      onClose();
      if (!targetListId) nav(`/courses/${res}`);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={targetListId ? 'Compléter avec les menus' : 'Générer une liste'}
      footer={<><button className="btn grow" onClick={onClose}>Annuler</button><button className="btn primary grow" disabled={!selected.length} onClick={save}>Ajouter {selected.length} article(s)</button></>}>
      <p className="small muted">Les quantités sont calculées à partir des repas prévus (non préparés) de la période, moins le stock utilisable et ce qui figure déjà sur d’autres listes ouvertes.</p>
      {periods.length > 0 && !targetListId && (
        <div className="chips" role="group" aria-label="Périodes des plans">
          {periods.map(({ plan, period, range }) => (
            <button key={plan.id + period.index} className="chip" aria-pressed={start === range.start && end === range.end} onClick={() => { setStart(range.start); setEnd(range.end); setName(`${period.label} — courses calculées`); }}>
              {period.label} ({formatDateShort(range.start)})
            </button>
          ))}
        </div>
      )}
      <div className="grid2">
        <Field label="Du"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Au"><input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <label className="check"><input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} /> Ajouter les produits sous leur seuil minimal</label>
      <label className="check"><input type="checkbox" checked={optional} onChange={(e) => setOptional(e.target.checked)} /> Inclure les ingrédients facultatifs</label>
      {!targetListId && (
        <div className="grid2">
          <Field label="Nom de la liste"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Courses de la semaine" /></Field>
          <Field label="Budget cible ($)"><NumberInput value={budget} onChange={setBudget} ariaLabel="Budget cible" /></Field>
        </div>
      )}
      {!preview && <p className="muted">Calcul…</p>}
      {preview && (
        <>
          <div className="card info small">
            {preview.mealCount} repas pris en compte · {selected.length} article(s) · estimé <strong>{formatMoney(total)}</strong>
            {(budget ?? target?.budget) !== undefined && total > (budget ?? target?.budget ?? 0) && (
              <p style={{ marginTop: 6 }}>⚠️ Dépasse le budget de {formatMoney(total - (budget ?? target!.budget!))}. {optionalTotal > 0 ? `Décocher les facultatifs économise ${formatMoney(optionalTotal)}.` : ''} Voir aussi les substitutions économiques du plan.</p>
            )}
          </div>
          {preview.unconverted.length > 0 && (
            <div className="card warn small">
              <strong>Non comptés (conversion inconnue)</strong>
              <ul className="clean">{preview.unconverted.map((u) => <li key={u.name + u.unit}>{u.name} : {u.quantity} {u.unit} — ajoutez une conversion dans la fiche produit</li>)}</ul>
            </div>
          )}
          {preview.lines.length === 0 && <p className="muted">{preview.mealCount === 0 && !lowStock ? 'Aucun repas prévu sur cette période.' : 'Rien à acheter : les stocks et les listes ouvertes couvrent les besoins.'}</p>}
          <div className="list">
            {preview.lines.map((l) => (
              <div key={l.productId} className="item" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={!off.has(l.productId)} aria-label={`Inclure ${l.name}`} onChange={() => setOff((s) => { const n = new Set(s); if (n.has(l.productId)) n.delete(l.productId); else n.add(l.productId); return n; })} />
                <div className="grow">
                  <div className="row" style={{ gap: 6 }}>
                    <span className="title">{categoryById.get(l.categoryId)?.icon} {l.name}</span>
                    {l.priority === 'optionnel' && <span className="badge">Facultatif</span>}
                    {l.stockUnknown && <span className="badge info">Stock à vérifier</span>}
                  </div>
                  <div className="meta">{l.reasons.join(' · ')}</div>
                  <div className="row" style={{ marginTop: 6 }}>
                    <div style={{ width: 110 }}><NumberInput value={qty[l.productId]} onChange={(v) => setQty((q) => ({ ...q, [l.productId]: v ?? 0 }))} ariaLabel={`Quantité de ${l.name}`} /></div>
                    <span className="small">{l.unit}</span>
                    <span className="grow right small muted">{l.estUnitPrice !== undefined ? formatMoney(l.estUnitPrice * (qty[l.productId] ?? l.quantity)) : 'prix inconnu'}</span>
                  </div>
                  {l.rawQuantity !== l.quantity && <div className="tiny muted">Besoin exact : {formatQty(l.rawQuantity, l.unit)}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
