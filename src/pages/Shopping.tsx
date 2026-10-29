import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, Plus, Receipt, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../db/db';
import { createList } from '../db/shoppingOps';
import { formatDateShort } from '../domain/dates';
import { listTotals } from '../domain/shopping';
import type { ShoppingList } from '../domain/types';
import { formatMoney } from '../domain/units';
import { t } from '../i18n/fr';
import { GenerateSheet } from '../ui/GenerateSheet';
import { Empty, Field, NumberInput, PageHead, Progress, Sheet, useUi } from '../ui/kit';

export default function ShoppingPage() {
  const ui = useUi();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [gen, setGen] = useState(params.get('generer') === '1');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<{ name: string; date: string; budget: number | null; store: string }>({ name: '', date: '', budget: null, store: '' });
  useEffect(() => {
    if (params.get('generer') === '1') setParams({}, { replace: true });
  }, [params, setParams]);

  const data = useLiveQuery(async () => {
    const lists = await db.lists.toArray();
    const lines = await db.lines.toArray();
    return lists.map((l) => ({ list: l, totals: listTotals(lines.filter((x) => x.listId === l.id)) }));
  }, []);
  const open = (data ?? []).filter((d) => d.list.status === 'à préparer' || d.list.status === 'en cours');
  const done = (data ?? []).filter((d) => d.list.status === 'terminée' || d.list.status === 'archivée');
  const sortKey = (l: ShoppingList) => l.periodStart ?? l.plannedDate ?? l.createdAt;
  const shown = (tab === 'open' ? open : done).sort((a, b) => sortKey(a.list).localeCompare(sortKey(b.list)) * (tab === 'open' ? 1 : -1));

  const create = async () => {
    const l = await ui.run(() => createList({ name: draft.name, plannedDate: draft.date || undefined, budget: draft.budget ?? undefined, store: draft.store || undefined }));
    if (l) {
      setCreating(false);
      nav(`/courses/${l.id}`);
    }
  };

  return (
    <div className="stack">
      <PageHead title="Courses" sub="Listes, budget et achats" actions={<><Link className="btn small" to="/courses/import"><Receipt /> Reçu</Link><Link className="btn small" to="/budget"><BarChart3 /> Budget</Link></>} />
      <div className="btn-row">
        <button className="btn primary grow" onClick={() => setGen(true)}><Sparkles /> Générer depuis les menus</button>
        <button className="btn grow" onClick={() => { setDraft({ name: '', date: '', budget: null, store: '' }); setCreating(true); }}><Plus /> Liste libre</button>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'open'} onClick={() => setTab('open')}>En cours ({open.length})</button>
        <button role="tab" aria-selected={tab === 'done'} onClick={() => setTab('done')}>Terminées ({done.length})</button>
      </div>
      {data && !shown.length && <Empty icon="🛒" title={tab === 'open' ? 'Aucune liste en cours' : 'Aucune liste terminée'}>Générez une liste à partir des menus ou créez une liste libre.</Empty>}
      <div className="stack">
        {shown.map(({ list, totals }) => (
          <Link key={list.id} to={`/courses/${list.id}`} className="card stack" style={{ gap: 8 }}>
            <div className="row between">
              <span className="strong">{list.name}</span>
              <span className={`badge ${list.status === 'en cours' ? 'primary' : ''}`}>{t.listStatus[list.status]}</span>
            </div>
            <div className="small muted">
              {list.periodStart && list.periodEnd ? `Du ${formatDateShort(list.periodStart)} au ${formatDateShort(list.periodEnd)}` : list.plannedDate ? `Prévue le ${formatDateShort(list.plannedDate)}` : 'Sans date'}
              {' · '}{totals.counts.bought}/{totals.counts.total} acheté(s)
              {list.planId && !list.periodStart ? ' · plan non démarré' : ''}
            </div>
            <div className="row between small">
              <span>Estimé {formatMoney(totals.estimated, list.currency)}</span>
              {totals.spent > 0 && <span>Dépensé {formatMoney(totals.spent, list.currency)}</span>}
              {list.budget !== undefined && <span>Budget {formatMoney(list.budget, list.currency)}</span>}
            </div>
            {list.budget !== undefined && <Progress value={totals.spent || totals.estimated} max={list.budget} />}
          </Link>
        ))}
      </div>

      <GenerateSheet open={gen} onClose={() => setGen(false)} />

      <Sheet open={creating} onClose={() => setCreating(false)} title="Nouvelle liste"
        footer={<><button className="btn grow" onClick={() => setCreating(false)}>Annuler</button><button className="btn primary grow" onClick={create}>Créer</button></>}>
        <Field label="Nom"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex. Produits ménagers, Courses urgentes" autoFocus /></Field>
        <div className="grid2">
          <Field label="Date prévue"><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></Field>
          <Field label="Budget cible ($)"><NumberInput value={draft.budget} onChange={(v) => setDraft({ ...draft, budget: v })} ariaLabel="Budget cible" /></Field>
        </div>
        <Field label="Magasin (facultatif)"><input value={draft.store} onChange={(e) => setDraft({ ...draft, store: e.target.value })} /></Field>
      </Sheet>
    </div>
  );
}
