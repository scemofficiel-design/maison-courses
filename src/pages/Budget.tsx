import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { daysBetween, formatDateShort } from '../domain/dates';
import { listTotals } from '../domain/shopping';
import { formatMoney, round2 } from '../domain/units';
import { BUDGET_SUMMARY } from '../seed/planDocument';
import { PageHead } from '../ui/kit';

export default function BudgetPage() {
  const data = useLiveQuery(async () => {
    const [lists, lines, purchases, budgets, plans] = await Promise.all([db.lists.toArray(), db.lines.toArray(), db.purchases.toArray(), db.budgets.toArray(), db.plans.toArray()]);
    return { lists, lines, purchases: purchases.filter((p) => !p.reversed), budgets, plans };
  }, []);
  if (!data) return <div className="empty">Chargement…</div>;
  const rows = data.lists
    .filter((l) => l.status !== 'archivée' || data.purchases.some((p) => p.listId === l.id))
    .map((l) => {
      const tt = listTotals(data.lines.filter((x) => x.listId === l.id));
      const days = l.periodStart && l.periodEnd ? daysBetween(l.periodStart, l.periodEnd) + 1 : undefined;
      const plan = data.plans.find((p) => p.id === l.planId);
      const people = plan?.members.length;
      const basis = tt.spent > 0 ? tt.spent : tt.estimated;
      return { l, tt, weekly: days ? round2((basis / days) * 7) : undefined, perPerson: days && people ? round2((basis / days) * 7 / people) : undefined, people };
    })
    .sort((a, b) => (a.l.periodStart ?? a.l.createdAt).localeCompare(b.l.periodStart ?? b.l.createdAt));
  const max = Math.max(1, ...rows.map((r) => Math.max(r.l.budget ?? 0, r.tt.estimated, r.tt.spent)));
  const spentTotal = round2(data.purchases.reduce((s, p) => s + (p.price ?? 0), 0));
  const byDay = new Map<string, number>();
  for (const p of data.purchases) if (p.price !== undefined) byDay.set(p.at.slice(0, 10), round2((byDay.get(p.at.slice(0, 10)) ?? 0) + p.price));
  const planBudgets = data.budgets.filter((b) => b.planId);

  return (
    <div className="stack">
      <PageHead back="/courses" title="Budget" sub="Prévu, estimé et dépensé par liste" />
      <div className="kpis">
        <div className="kpi"><div className="v">{formatMoney(spentTotal)}</div><div className="l">Dépensé (achats saisis)</div></div>
        <div className="kpi"><div className="v">{rows.length}</div><div className="l">Listes suivies</div></div>
      </div>

      <section className="card">
        <h2>Comparaison des listes</h2>
        <div className="bars" aria-label="Graphique budget, estimé et dépensé">
          {rows.slice(-8).map((r) => (
            <div key={r.l.id} className="bar" title={`${r.l.name} : estimé ${formatMoney(r.tt.estimated)}, dépensé ${formatMoney(r.tt.spent)}`}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: '100%', width: '100%', justifyContent: 'center' }}>
                <div className="fill" style={{ height: `${(r.tt.estimated / max) * 100}%`, width: '45%' }} />
                <div className="fill spent" style={{ height: `${(r.tt.spent / max) * 100}%`, width: '45%' }} />
              </div>
              <small className="ellipsis" style={{ maxWidth: 70 }}>{r.l.periodIndex ? `P${r.l.periodIndex}` : r.l.name}</small>
            </div>
          ))}
        </div>
        <p className="tiny muted row" style={{ gap: 12, marginTop: 6 }}><span>▮ <span style={{ color: 'var(--primary)' }}>estimé</span></span><span>▮ <span style={{ color: 'var(--accent)' }}>dépensé</span></span></p>
      </section>

      <div className="list">
        {rows.map(({ l, tt, weekly, perPerson, people }) => (
          <Link key={l.id} to={`/courses/${l.id}`} className="item" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <div className="title">{l.name}</div>
              <div className="meta">
                {l.periodStart && l.periodEnd ? `${formatDateShort(l.periodStart)} – ${formatDateShort(l.periodEnd)} · ` : ''}
                Budget {formatMoney(l.budget)} · estimé {formatMoney(tt.estimated)} · dépensé {formatMoney(tt.spent)}
              </div>
              <div className="meta">
                {tt.estimatedOfBought > 0 && `Écart payé/estimé : ${tt.variance >= 0 ? '+' : ''}${formatMoney(tt.variance)} · `}
                {weekly !== undefined && `≈ ${formatMoney(weekly)} / semaine`}
                {perPerson !== undefined && ` · ${formatMoney(perPerson)} / personne / semaine (${people} pers.)`}
              </div>
            </div>
            {l.budget !== undefined && <span className={`badge ${tt.estimated > l.budget ? 'danger' : 'ok'}`}>{tt.estimated > l.budget ? 'Au-dessus' : 'Dans le budget'}</span>}
          </Link>
        ))}
      </div>

      {planBudgets.length > 0 && (
        <section className="card stack small">
          <h2>Budgets de référence du plan familial</h2>
          <p className="muted">Estimations historiques du document (prix de votre liste de référence d’octobre 2026, non vérifiés en magasin). Aucun montant n’est garanti.</p>
          <table className="table">
            <thead><tr><th>Période</th><th className="right">Cible</th><th className="right">Économique</th></tr></thead>
            <tbody>
              {[1, 2, 3, 4].map((k) => (
                <tr key={k}>
                  <td>P{k}</td>
                  <td className="right">{formatMoney(planBudgets.find((b) => b.periodIndex === k && b.kind === 'cible')?.amount)}</td>
                  <td className="right">{formatMoney(planBudgets.find((b) => b.periodIndex === k && b.kind === 'économique')?.amount)}</td>
                </tr>
              ))}
              <tr><td className="strong">8 semaines</td><td className="right strong">{formatMoney(BUDGET_SUMMARY.target.total)}</td><td className="right strong">{formatMoney(BUDGET_SUMMARY.economy.total)}</td></tr>
              <tr><td>Par période</td><td className="right">{formatMoney(BUDGET_SUMMARY.target.perPeriod)}</td><td className="right">{formatMoney(BUDGET_SUMMARY.economy.perPeriod)}</td></tr>
              <tr><td>Par semaine</td><td className="right">{formatMoney(BUDGET_SUMMARY.target.perWeek)}</td><td className="right">{formatMoney(BUDGET_SUMMARY.economy.perWeek)}</td></tr>
              <tr><td>Par personne et par semaine</td><td className="right">{formatMoney(BUDGET_SUMMARY.target.perPersonWeek)}</td><td className="right">{formatMoney(BUDGET_SUMMARY.economy.perPersonWeek)}</td></tr>
            </tbody>
          </table>
          <p className="muted">Version économique : essentiels seulement, et œufs durs au lieu du poulet les lundis et samedis soir (économie de {formatMoney(BUDGET_SUMMARY.economySaving)}). Optionnels supprimables : {formatMoney(BUDGET_SUMMARY.optionalRemovable.averagePerPeriod)} par période en moyenne. {BUDGET_SUMMARY.comparison}</p>
        </section>
      )}

      {byDay.size > 0 && (
        <section>
          <div className="section-title"><h2>Historique des dépenses</h2></div>
          <div className="list">
            {[...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([d, v]) => (
              <div key={d} className="item"><span className="grow">{formatDateShort(d)}</span><strong>{formatMoney(v)}</strong></div>
            ))}
          </div>
        </section>
      )}
      <p className="tiny muted">Devise : dollar canadien (CAD). La structure des données prévoit d’autres devises par liste et par produit.</p>
    </div>
  );
}
