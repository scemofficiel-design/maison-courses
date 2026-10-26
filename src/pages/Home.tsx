import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ChefHat, ShoppingCart } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { loadDashboard } from '../db/dashboard';
import { planWeekOf } from '../db/planOps';
import { addMissingToList } from '../db/shoppingOps';
import { formatDateLong } from '../domain/dates';
import { formatMoney, formatQty } from '../domain/units';
import { SLOTS, t } from '../i18n/fr';
import { PlanStart } from '../ui/bits';
import { useSettings, useToday } from '../ui/hooks';
import { Progress, useUi } from '../ui/kit';

export default function HomePage() {
  const on = useToday();
  const settings = useSettings();
  const ui = useUi();
  const nav = useNavigate();
  const data = useLiveQuery(() => loadDashboard(on, settings.expiryWarningDays), [on, settings.expiryWarningDays]);
  if (!data) return <div className="empty">Chargement…</div>;
  const show = (w: (typeof settings.dashboardWidgets)[number]) => settings.dashboardWidgets.includes(w);
  const fp = data.familyPlan;
  const week = fp ? planWeekOf(fp, on) : undefined;
  const main = data.todayMeals.filter((m) => m.slot === 'déjeuner' || m.slot === 'dîner');
  const others = data.todayMeals.filter((m) => m.slot !== 'déjeuner' && m.slot !== 'dîner');

  const addShortages = async (items: typeof data.shortagesToday, label: string) => {
    const res = await ui.run(() => addMissingToList(items.map((s) => ({ productId: s.productId, quantity: s.missing, reason: `Manquant pour ${label}` })), on));
    if (res) ui.toast(`${res.added} produit(s) ajouté(s) à « ${res.listName} »`, { action: { label: 'Voir', run: () => nav(`/courses/${res.listId}`) } });
  };

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <p className="muted small">{formatDateLong(on)}</p>
          <h1>Aujourd’hui</h1>
          {week && fp && <p className="sub">{fp.name} · semaine {week} sur {fp.durationWeeks}</p>}
          {!week && fp?.active && fp.startDate && fp.startDate > on && <p className="sub">{fp.name} : début le {formatDateLong(fp.startDate).toLowerCase()}</p>}
        </div>
      </header>

      {show('plan') && fp && fp.active && !fp.materialized && <PlanStart plan={fp} />}

      {show('today') && (
        <section className="card stack" aria-labelledby="h-today">
          <div className="row between">
            <h2 id="h-today">Repas du jour</h2>
            <Link to="/menus" className="small">Semaine</Link>
          </div>
          {main.length === 0 && <p className="muted small">Aucun repas prévu aujourd’hui. <Link to="/menus">Planifier</Link> ou <Link to="/suggestions">voir ce qui est réalisable</Link>.</p>}
          {main.map((m) => (
            <Link key={m.id} to={`/menus/repas/${m.id}`} className={`row ${m.status === 'préparé' ? 'meal-done' : ''}`} style={{ textDecoration: 'none', color: 'inherit', alignItems: 'flex-start' }}>
              <span className="slot-label" style={{ width: 46, paddingTop: 3 }}>{t.slotsShort[m.slot]}</span>
              <span className="grow strong">{m.title}</span>
              {m.status === 'préparé' && <span className="badge ok">Préparé</span>}
            </Link>
          ))}
          {others.length > 0 && (
            <details>
              <summary className="small muted">Petit-déjeuner et collations</summary>
              <div className="stack small" style={{ gap: 6 }}>
                {others.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot)).map((m) => (
                  <Link key={m.id} to={`/menus/repas/${m.id}`} className="row" style={{ color: 'inherit', textDecoration: 'none' }}>
                    <span className="slot-label" style={{ width: 46 }}>{t.slotsShort[m.slot]}</span>
                    <span className="grow">{m.title}</span>
                  </Link>
                ))}
              </div>
            </details>
          )}
          {data.shortagesToday.length > 0 && (
            <div className="card warn flat stack" style={{ gap: 6 }}>
              <p className="strong row"><AlertTriangle size={18} /> Stock insuffisant ou à vérifier pour aujourd’hui</p>
              <ul className="clean small">
                {data.shortagesToday.slice(0, 6).map((s) => (
                  <li key={s.productId}>{s.name} : {s.have === null ? `stock inconnu, ${formatQty(s.need, s.unit)} nécessaires` : `manque ${formatQty(s.missing, s.unit)}`}</li>
                ))}
              </ul>
              <button className="btn small accent" onClick={() => addShortages(data.shortagesToday, 'les repas du jour')}><ShoppingCart /> Ajouter aux courses</button>
            </div>
          )}
        </section>
      )}

      {show('alerts') && (
        <section aria-labelledby="h-stock">
          <div className="section-title"><h2 id="h-stock">Stocks</h2><Link to="/stocks" className="small">Tout voir</Link></div>
          <div className="kpis">
            <Link className="kpi" to="/stocks?f=ok"><div className="v">{data.counts.available}</div><div className="l">Disponibles</div></Link>
            <Link className="kpi" to="/stocks?f=bas"><div className="v" style={{ color: 'var(--warn)' }}>{data.counts.low}</div><div className="l">Bientôt épuisés</div></Link>
            <Link className="kpi" to="/stocks?f=épuisé"><div className="v" style={{ color: 'var(--danger)' }}>{data.counts.missing}</div><div className="l">Manquants</div></Link>
            <Link className="kpi" to="/stocks?f=péremption"><div className="v">{data.counts.expiring}</div><div className="l">Péremption proche</div></Link>
          </div>
          {data.counts.unknown > 0 && (
            <p className="small muted" style={{ marginTop: 8 }}>
              {data.counts.unknown} produit(s) en quantité inconnue. <Link to="/stocks?f=inconnu">Faire l’inventaire</Link>
            </p>
          )}
          {data.alerts.length > 0 && (
            <div className="list" style={{ marginTop: 10 }}>
              {data.alerts.slice(0, 5).map((a, i) => (
                <Link key={`${a.productId}-${a.kind}-${i}`} to={`/stocks/${a.productId}`} className="item">
                  <span className={`badge ${a.severity === 3 ? 'danger' : 'warn'}`}>{a.kind}</span>
                  <span className="grow"><span className="title">{a.name}</span><div className="meta">{a.message}</div></span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {show('shopping') && (
        <section aria-labelledby="h-shop">
          <div className="section-title"><h2 id="h-shop">Prochaines courses</h2><Link to="/courses" className="small">Listes</Link></div>
          {data.nextList ? (
            <Link to={`/courses/${data.nextList.list.id}`} className="card stack" style={{ gap: 8 }}>
              <div className="row between">
                <span className="strong">{data.nextList.list.name}</span>
                <span className="badge primary">{data.nextList.todo} article(s)</span>
              </div>
              {show('budget') && (
                <>
                  <div className="row between small">
                    <span>Estimé {formatMoney(data.nextList.estimated)}</span>
                    {data.nextList.list.budget !== undefined && <span>Budget {formatMoney(data.nextList.list.budget)}</span>}
                  </div>
                  {data.nextList.list.budget !== undefined && <Progress value={data.nextList.estimated} max={data.nextList.list.budget} />}
                  <div className="row between small muted">
                    <span>Reste à acheter : {formatMoney(data.nextList.remaining)}</span>
                    {data.nextList.list.budget !== undefined && <span>Marge : {formatMoney(data.nextList.list.budget - data.nextList.estimated)}</span>}
                  </div>
                </>
              )}
            </Link>
          ) : (
            <div className="card small muted">Aucune liste ouverte. <Link to="/courses">Créer ou générer une liste</Link>.</div>
          )}
          {data.shortagesWeek.length > 0 && (
            <p className="small muted" style={{ marginTop: 8 }}>
              Repas des 7 prochains jours : {data.shortagesWeek.length} ingrédient(s) manquant(s) ou à vérifier. <Link to="/courses?generer=1">Préparer la liste</Link>
            </p>
          )}
        </section>
      )}

      {show('priority') && (data.priority.length > 0 || data.batch.length > 0) && (
        <section aria-labelledby="h-prio">
          <div className="section-title"><h2 id="h-prio">À consommer en priorité</h2></div>
          <div className="card stack small">
            {data.priority.map((p) => (
              <Link key={p.id} to={`/suggestions?f=priorité`} className="row between" style={{ color: 'inherit', textDecoration: 'none' }}>
                <span>{p.name}</span><span className="badge warn">avant le {p.expiryDate}</span>
              </Link>
            ))}
            {data.batch.map((b) => <p key={b.recipeId + b.dates[0]}>🍲 {b.message}</p>)}
          </div>
        </section>
      )}

      {show('feasible') && (
        <section aria-labelledby="h-feasible">
          <div className="section-title"><h2 id="h-feasible">Réalisable avec les stocks</h2><Link to="/suggestions" className="small">Suggestions</Link></div>
          {data.feasible.length ? (
            <div className="list">
              {data.feasible.map((f) => (
                <Link key={f.title} className="item" to="/suggestions">
                  <ChefHat size={20} aria-hidden />
                  <span className="grow"><span className="title">{f.title}</span><div className="meta">{f.why.join(' · ')}</div></span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="card small muted">Aucun repas entièrement réalisable avec les stocks connus. Renseignez vos quantités dans <Link to="/stocks">Stocks</Link> pour obtenir des suggestions.</p>
          )}
        </section>
      )}

      {show('profiles') && (
        <section aria-labelledby="h-people">
          <div className="section-title"><h2 id="h-people">À table</h2><Link to="/profils" className="small">Profils</Link></div>
          <div className="card stack small" style={{ gap: 6 }}>
            {data.persons.map((p) => (
              <div key={p.id} className="row between"><span className="strong">{p.name}</span><span className="muted ellipsis" style={{ maxWidth: '60%' }}>{p.profiles.join(', ') || 'Aucun profil'}</span></div>
            ))}
            {data.activePlans.map((p) => <p key={p.id} className="muted">Plan actif : {p.name}</p>)}
          </div>
        </section>
      )}
    </div>
  );
}
