import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { knownCombos } from '../db/dashboard';
import { createMeal } from '../db/mealOps';
import { dinersOn, loadContext } from '../db/queries';
import type { Diner } from '../domain/portions';
import { checkMeal } from '../domain/restrictions';
import { mealFeasibility, rankSuggestions, type Feasibility, type SuggestionFilter } from '../domain/suggestions';
import type { MealSlot, Recipe } from '../domain/types';
import { formatMoney, formatQty } from '../domain/units';
import { SLOTS, t } from '../i18n/fr';
import { useSettings, useToday } from '../ui/hooks';
import { Chips, Empty, Field, PageHead, Sheet, useUi } from '../ui/kit';

export default function SuggestionsPage() {
  const on = useToday();
  const ui = useUi();
  const nav = useNavigate();
  const settings = useSettings();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<SuggestionFilter>((params.get('f') as SuggestionFilter) ?? 'tous');
  const [slot, setSlot] = useState<'déjeuner' | 'dîner'>('déjeuner');
  const [who, setWho] = useState('famille');
  const [plan, setPlan] = useState<{ f: Feasibility; date: string; slot: MealSlot } | null>(null);

  const data = useLiveQuery(async () => {
    const ctx = await loadContext();
    const family = dinersOn(on, ctx);
    const recipes = (ids: string[]) => ids.map((id) => ctx.recipes.get(id)).filter((r): r is Recipe => !!r);
    return { ctx, family, combos: knownCombos(ctx), recipes };
  }, [on]);

  if (!data) return <div className="empty">Calcul…</div>;
  const profiles = [...data.ctx.profiles.values()];
  const diners: Diner[] = who === 'famille' ? data.family : (() => {
    const p = data.ctx.profiles.get(who);
    return p ? [{ personId: 'x', name: p.name, profiles: [p] }] : data.family;
  })();
  const all = data.combos.filter((c) => c.slot === slot).map((c) => mealFeasibility(c.title, data.recipes(c.recipeIds), diners, c.slot, data.ctx.products, on, settings.expiryWarningDays, data.ctx.families));
  const ranked = rankSuggestions(all, filter).slice(0, 25);
  const excluded = all.filter((f) => f.violations.length).length;
  const compatibleWith = (f: Feasibility) => profiles.filter((p) => checkMeal(data.recipes(f.recipeIds), p, data.ctx.products).length === 0).map((p) => p.name);

  return (
    <div className="stack">
      <PageHead back title="Que cuisiner ?" sub="Suggestions selon les stocks réels" />
      <Chips label="Repas" value={slot} onChange={setSlot} options={[{ value: 'déjeuner', label: 'Midi' }, { value: 'dîner', label: 'Soir' }]} />
      <Chips label="Filtre" value={filter} onChange={setFilter} options={[
        { value: 'tous', label: 'Toutes' }, { value: 'stock seul', label: 'Stocks actuels seulement' }, { value: 'priorité', label: 'À consommer vite' },
        { value: 'rapide', label: '≤ 20 min' }, { value: 'économique', label: 'Économique' },
      ]} />
      <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Pour qui">
        <option value="famille">Plat commun : personnes présentes ({data.family.map((d) => d.name).join(', ') || 'aucune'})</option>
        {profiles.map((p) => <option key={p.id} value={p.id}>Adapté au profil : {p.name}</option>)}
      </select>
      {excluded > 0 && <p className="tiny muted">{excluded} combinaison(s) écartée(s) car elles enfreignent une restriction active.</p>}
      {!ranked.length && <Empty icon="🥘" title="Aucune suggestion pour ce filtre">Renseignez les quantités de vos stocks pour des suggestions plus précises.</Empty>}
      {ranked.map((f) => (
        <article key={f.title} className="card stack" style={{ gap: 6 }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <h3>{f.title}</h3>
            <span className={`badge ${f.coverage === 1 && !f.unknown.length ? 'ok' : f.coverage >= 0.5 ? 'warn' : ''}`}>{Math.round(f.coverage * 100)} %</span>
          </div>
          <p className="small muted">{f.why.join(' · ')}</p>
          {f.available.length > 0 && <p className="small"><strong>Disponible :</strong> {f.available.map((a) => a.name).join(', ')}</p>}
          {f.missing.length > 0 && <p className="small"><strong>Manque :</strong> {f.missing.map((m) => `${m.name} (${formatQty(m.missing, m.unit)})`).join(', ')}</p>}
          {f.unknown.length > 0 && <p className="small"><strong>À vérifier :</strong> {f.unknown.map((m) => m.name).join(', ')}</p>}
          <p className="tiny muted">{f.minutes} min · surcoût estimé {formatMoney(f.extraCost)} · compatible : {compatibleWith(f).join(', ') || '—'}</p>
          <button className="btn small soft" onClick={() => setPlan({ f, date: on, slot })}>Planifier</button>
        </article>
      ))}

      <Sheet open={!!plan} onClose={() => setPlan(null)} title={plan?.f.title ?? ''}
        footer={<button className="btn primary block" onClick={() => plan && ui.run(() => createMeal({ date: plan.date, slot: plan.slot, title: plan.f.title, recipeIds: plan.f.recipeIds }), 'Ajouté au menu').then((m) => { if (m) { setPlan(null); nav(`/menus/repas/${m.id}`); } })}>Ajouter au menu</button>}>
        {plan && (
          <div className="grid2">
            <Field label="Date"><input type="date" value={plan.date} onChange={(e) => setPlan({ ...plan, date: e.target.value })} /></Field>
            <Field label="Repas"><select value={plan.slot} onChange={(e) => setPlan({ ...plan, slot: e.target.value as MealSlot })}>{SLOTS.map((s) => <option key={s} value={s}>{t.slots[s]}</option>)}</select></Field>
          </div>
        )}
      </Sheet>
    </div>
  );
}
