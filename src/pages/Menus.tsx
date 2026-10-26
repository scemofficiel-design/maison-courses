import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Copy, Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../db/db';
import { duplicateWeek, createMeal } from '../db/mealOps';
import { applyProposals, proposeWeek } from '../db/menuGenOps';
import { needsBetween } from '../db/queries';
import { addDays, formatDateLong, formatDateShort, parseDate, startOfWeek, WEEKDAYS_SHORT } from '../domain/dates';
import type { MenuProposal } from '../domain/menuGen';
import type { MealSlot, PlannedMeal, Recipe } from '../domain/types';
import { usableQuantity } from '../domain/stock';
import { formatQty } from '../domain/units';
import { MAIN_SLOTS, SLOTS, t } from '../i18n/fr';
import { RecipePicker } from '../ui/bits';
import { useSettings, useToday } from '../ui/hooks';
import { Field, PageHead, Sheet, useUi } from '../ui/kit';

export default function MenusPage() {
  const on = useToday();
  const ui = useUi();
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const selected = params.get('d') ?? on;
  const monday = startOfWeek(selected);
  const [view, setView] = useState<'jour' | 'semaine'>(window.matchMedia?.('(min-width: 900px)').matches ? 'semaine' : 'jour');
  const [snacks, setSnacks] = useState(true);
  const meals = useLiveQuery(() => db.meals.where('date').between(monday, addDays(monday, 6), true, true).toArray(), [monday]) ?? [];
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), []) ?? [];
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [draft, setDraft] = useState<{ title: string; recipes: Recipe[] }>({ title: '', recipes: [] });
  const [picker, setPicker] = useState(false);
  const [dup, setDup] = useState<string | null>(null);
  const [gen, setGen] = useState<{ proposals: MenuProposal[]; off: Set<number>; economy: boolean } | null>(null);
  const [missing, setMissing] = useState<{ name: string; text: string }[] | null>(null);

  const setDay = (d: string) => setParams({ d }, { replace: true });
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const slots = snacks ? SLOTS : SLOTS.filter((s) => !s.startsWith('collation'));
  const byKey = useMemo(() => {
    const m = new Map<string, PlannedMeal[]>();
    for (const x of meals) m.set(`${x.date}|${x.slot}`, [...(m.get(`${x.date}|${x.slot}`) ?? []), x]);
    return m;
  }, [meals]);

  const openAdd = (date: string, slot: MealSlot) => {
    setDraft({ title: '', recipes: [] });
    setAdding({ date, slot });
  };
  const saveMeal = async () => {
    if (!adding) return;
    const m = await ui.run(() => createMeal({ date: adding.date, slot: adding.slot, title: draft.title, recipeIds: draft.recipes.map((r) => r.id) }), 'Repas ajouté');
    if (m) setAdding(null);
  };
  const generate = async (economy = false) => {
    const proposals = await ui.run(() => proposeWeek(monday, { slots: MAIN_SLOTS, economy, warningDays: settings.expiryWarningDays }));
    if (proposals) setGen({ proposals, off: new Set(), economy });
  };
  const showMissing = async () => {
    const res = await needsBetween(monday, addDays(monday, 6));
    const products = new Map((await db.products.toArray()).map((p) => [p.id, p]));
    const out: { name: string; text: string }[] = [];
    for (const n of res.needs.values()) {
      if (n.optional) continue;
      const p = products.get(n.productId)!;
      const have = usableQuantity(p, monday);
      if (have === null) out.push({ name: p.name, text: `stock inconnu (${formatQty(n.quantity, n.unit)} nécessaires)` });
      else if (have < n.quantity) out.push({ name: p.name, text: `manque ${formatQty(n.quantity - have, n.unit)} (besoin ${formatQty(n.quantity, n.unit)})` });
    }
    setMissing(out.sort((a, b) => a.name.localeCompare(b.name, 'fr')));
  };

  const mealRow = (m: PlannedMeal) => (
    <Link key={m.id} to={`/menus/repas/${m.id}`} className={`card tight ${m.status === 'préparé' ? 'meal-done' : ''} ${m.status === 'archivé' ? 'meal-archived' : ''}`} style={{ display: 'block' }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <span className="strong">{m.title}</span>
        {m.status !== 'prévu' && <span className={`badge ${m.status === 'préparé' ? 'ok' : m.status === 'validé' ? 'primary' : ''}`}>{t.mealStatus[m.status]}</span>}
      </div>
      {m.recipeIds.length === 0 && m.notes && <div className="tiny muted">{m.notes}</div>}
    </Link>
  );

  return (
    <div className="stack">
      <PageHead title="Menus" sub={`Semaine du ${formatDateShort(monday)}`} />
      <div className="row between">
        <button className="btn round" aria-label="Semaine précédente" onClick={() => setDay(addDays(selected, -7))}><ChevronLeft /></button>
        <button className="btn small ghost" onClick={() => setDay(on)}>Aujourd’hui</button>
        <button className="btn round" aria-label="Semaine suivante" onClick={() => setDay(addDays(selected, 7))}><ChevronRight /></button>
      </div>
      <div className="tabs" role="tablist" aria-label="Affichage">
        <button role="tab" aria-selected={view === 'jour'} onClick={() => setView('jour')}>Jour</button>
        <button role="tab" aria-selected={view === 'semaine'} onClick={() => setView('semaine')}>Semaine</button>
      </div>

      {view === 'jour' && (
        <>
          <div className="week" role="group" aria-label="Jours de la semaine">
            {days.map((d, i) => (
              <button key={d} className={`day-pill ${d === on ? 'today' : ''}`} aria-pressed={d === selected} onClick={() => setDay(d)}>
                <small>{WEEKDAYS_SHORT[i]}</small>{parseDate(d).getDate()}
              </button>
            ))}
          </div>
          <h2>{formatDateLong(selected)}</h2>
          <div className="stack">
            {slots.map((slot) => {
              const list = (byKey.get(`${selected}|${slot}`) ?? []).filter((m) => m.status !== 'archivé');
              return (
                <section key={slot} className="stack" style={{ gap: 6 }}>
                  <div className="row between"><span className="slot-label">{t.slots[slot]}</span><button className="btn small ghost" onClick={() => openAdd(selected, slot)} aria-label={`Ajouter un repas : ${t.slots[slot]}`}><Plus /> Ajouter</button></div>
                  {list.length ? list.map(mealRow) : <p className="small muted" style={{ paddingLeft: 2 }}>Rien de prévu.</p>}
                </section>
              );
            })}
          </div>
        </>
      )}

      {view === 'semaine' && (
        <div className="stack">
          {days.map((d, i) => (
            <section key={d} className="card stack" style={{ gap: 8 }}>
              <button className="row between" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => { setDay(d); setView('jour'); }}>
                <h3>{WEEKDAYS_SHORT[i]} {formatDateShort(d)}{d === on ? ' · aujourd’hui' : ''}</h3>
                <ChevronRight size={18} />
              </button>
              {MAIN_SLOTS.map((slot) => {
                const list = (byKey.get(`${d}|${slot}`) ?? []).filter((m) => m.status !== 'archivé');
                return (
                  <div key={slot} className="row" style={{ alignItems: 'flex-start' }}>
                    <span className="slot-label" style={{ width: 44, paddingTop: 2 }}>{t.slotsShort[slot]}</span>
                    <div className="grow small">
                      {list.length ? list.map((m) => <Link key={m.id} to={`/menus/repas/${m.id}`} className={m.status === 'préparé' ? 'meal-done' : ''} style={{ color: 'inherit', display: 'block' }}>{m.title}{m.status === 'préparé' ? ' ✓' : ''}</Link>) : <button className="btn small ghost" style={{ minHeight: 28, padding: 0 }} onClick={() => openAdd(d, slot)}>+ Ajouter</button>}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}

      <label className="check small"><input type="checkbox" checked={snacks} onChange={(e) => setSnacks(e.target.checked)} /> Afficher petit-déjeuner et collations</label>

      <section className="card stack">
        <h2>Outils de la semaine</h2>
        <div className="btn-row">
          <button className="btn grow" onClick={showMissing}>Ingrédients manquants</button>
          <button className="btn grow" onClick={() => setDup(addDays(monday, 7))}><Copy /> Dupliquer la semaine</button>
        </div>
        <div className="btn-row">
          <button className="btn soft grow" onClick={() => generate(false)}><Sparkles /> Compléter les créneaux libres</button>
          <button className="btn soft grow" onClick={() => generate(true)}>Version économique</button>
        </div>
        <p className="tiny muted">Les propositions tiennent compte des stocks, des produits à consommer vite, des profils présents, du coût et de la variété. Rien n’est modifié sans votre confirmation ; les repas déjà prévus ne sont jamais remplacés.</p>
      </section>

      <Sheet open={!!adding} onClose={() => setAdding(null)} title={adding ? `${t.slots[adding.slot]} · ${formatDateShort(adding.date)}` : ''}
        footer={<button className="btn primary block" disabled={!draft.title.trim() && !draft.recipes.length} onClick={saveMeal}>Ajouter au menu</button>}>
        <Field label="Titre (facultatif)" hint="Par défaut : le nom des recettes"><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex. Riz · sauce tomate · poulet" /></Field>
        <div className="stack" style={{ gap: 6 }}>
          {draft.recipes.map((r, i) => (
            <div key={r.id + i} className="row between card tight"><span>{r.name}</span><button className="btn small ghost" onClick={() => setDraft({ ...draft, recipes: draft.recipes.filter((_, j) => j !== i) })}>Retirer</button></div>
          ))}
          <button className="btn soft" onClick={() => setPicker(true)}><Plus /> Ajouter une recette</button>
        </div>
        <p className="tiny muted">Les personnes présentes à cette date (plan actif) sont associées automatiquement ; modifiable ensuite dans le repas.</p>
      </Sheet>
      <RecipePicker open={picker} onClose={() => setPicker(false)} recipes={recipes} onPick={(r) => { setDraft((d) => ({ ...d, recipes: [...d.recipes, r] })); setPicker(false); }} />

      <Sheet open={!!dup} onClose={() => setDup(null)} title="Dupliquer la semaine"
        footer={<>
          <button className="btn grow" onClick={() => dup && ui.run(() => duplicateWeek(monday, startOfWeek(dup), false)).then((r) => { if (r) { ui.toast(`${r.created} repas copiés, ${r.skipped} créneau(x) déjà occupé(s) conservé(s)`); setDup(null); } })}>Copier (garder l’existant)</button>
          <button className="btn danger grow" onClick={async () => {
            if (!dup || !(await ui.confirm('Remplacer les repas de la semaine cible ?', { body: <p>Les repas prévus de la semaine du {formatDateShort(startOfWeek(dup))} seront remplacés (les repas préparés sont conservés).</p>, danger: true, confirm: 'Remplacer' }))) return;
            const r = await ui.run(() => duplicateWeek(monday, startOfWeek(dup), true));
            if (r) { ui.toast(`${r.created} repas copiés`); setDup(null); }
          }}>Remplacer</button>
        </>}>
        <p className="small">Copier les repas de la semaine du {formatDateShort(monday)} vers la semaine du :</p>
        <input type="date" value={dup ?? ''} onChange={(e) => setDup(e.target.value)} aria-label="Semaine cible" />
      </Sheet>

      <Sheet open={!!gen} onClose={() => setGen(null)} title={gen?.economy ? 'Proposition économique' : 'Proposition de menus'}
        footer={<button className="btn primary block" disabled={!gen || gen.proposals.length === gen.off.size} onClick={async () => {
          if (!gen) return;
          const n = await ui.run(() => applyProposals(gen.proposals.filter((_, i) => !gen.off.has(i))));
          if (n !== undefined) { ui.toast(`${n} repas ajouté(s)`); setGen(null); }
        }}>Ajouter les repas cochés</button>}>
        {gen && !gen.proposals.length && <p className="muted">Aucun créneau libre (déjeuner ou dîner) cette semaine, ou aucune combinaison compatible.</p>}
        {gen?.proposals.map((p, i) => (
          <label key={i} className="card tight row" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={!gen.off.has(i)} onChange={() => setGen((g) => { if (!g) return g; const off = new Set(g.off); if (off.has(i)) off.delete(i); else off.add(i); return { ...g, off }; })} />
            <span className="grow">
              <span className="tiny muted">{formatDateShort(p.date)} · {t.slotsShort[p.slot]}</span>
              <div className="strong">{p.title}</div>
              <div className="tiny muted">{p.why.join(' · ')}</div>
            </span>
          </label>
        ))}
      </Sheet>

      <Sheet open={!!missing} onClose={() => setMissing(null)} title="Ingrédients manquants (semaine)"
        footer={<Link className="btn primary block" to="/courses?generer=1">Préparer la liste de courses</Link>}>
        {missing && !missing.length && <p className="muted">Tout est disponible pour les repas prévus cette semaine.</p>}
        <div className="list">{missing?.map((m) => <div key={m.name} className="item"><span className="grow title">{m.name}</span><span className="small muted">{m.text}</span></div>)}</div>
      </Sheet>
    </div>
  );
}
