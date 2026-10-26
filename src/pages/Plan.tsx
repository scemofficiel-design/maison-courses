import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../db/db';
import { createPlan, deactivatePlan, duplicatePlan, previewDeactivation, reactivatePlan, updatePlan } from '../db/planOps';
import { formatDateLong, formatDateShort } from '../domain/dates';
import type { PlanMember } from '../domain/types';
import { formatMoney } from '../domain/units';
import { PlanStart } from '../ui/bits';
import { useToday } from '../ui/hooks';
import { Empty, Field, PageHead, Sheet, useUi } from '../ui/kit';

export default function PlanPage() {
  const { id = '' } = useParams();
  const ui = useUi();
  const nav = useNavigate();
  const on = useToday();
  const plan = useLiveQuery(() => db.plans.get(id), [id]);
  const persons = useLiveQuery(() => db.persons.toArray(), []) ?? [];
  const profiles = useLiveQuery(() => db.profiles.toArray(), []) ?? [];
  const lists = useLiveQuery(() => db.lists.where('planId').equals(id).sortBy('periodIndex'), [id]) ?? [];
  const budgets = useLiveQuery(() => db.budgets.where('planId').equals(id).toArray(), [id]) ?? [];
  const otherPlans = useLiveQuery(() => db.plans.filter((p) => p.id !== id).toArray(), [id]) ?? [];
  const [members, setMembers] = useState<PlanMember[] | null>(null);
  const [next, setNext] = useState(false);
  const [from, setFrom] = useState(on);
  if (plan === undefined) return <div className="empty">Chargement…</div>;
  if (!plan) return <Empty title="Plan introuvable" />;

  const deactivate = async () => {
    const pv = await previewDeactivation(plan.id, from);
    const ok = await ui.confirm('Désactiver ce plan ?', {
      body: (
        <>
          <p>À partir du <strong>{formatDateLong(from).toLowerCase()}</strong> :</p>
          <ul className="clean">
            <li>{pv.futureMeals} repas prévus seront archivés (pas supprimés) ;</li>
            <li>{pv.openLists.length ? `listes archivées : ${pv.openLists.join(', ')}` : 'aucune liste à archiver'} ;</li>
            <li>{pv.cookedKept} repas déjà préparés, l’historique, les recettes, les profils et les stocks sont conservés.</li>
          </ul>
          <p className="small muted">Les règles de ce plan ne s’appliqueront plus aux suggestions et aux courses. Vous pourrez le réactiver.</p>
        </>
      ),
      confirm: 'Désactiver',
    });
    if (!ok) return;
    const r = await ui.run(() => deactivatePlan(plan.id, from));
    if (r) { ui.toast(`Plan désactivé : ${r.archivedMeals} repas archivés`); setNext(true); }
  };

  const toggleMember = (personId: string) => {
    const m = members ?? plan.members;
    setMembers(m.some((x) => x.personId === personId) ? m.filter((x) => x.personId !== personId) : [...m, { personId, profileIds: persons.find((p) => p.id === personId)?.profileIds ?? [] }]);
  };
  const cur = members ?? plan.members;

  return (
    <div className="stack">
      <PageHead back="/profils" title={plan.name} sub={plan.description} />
      <div className="row wrap">
        <span className={`badge ${plan.active ? 'ok' : ''}`}>{plan.active ? 'Actif' : 'Inactif'}</span>
        {plan.temporary && <span className="badge info">Temporaire</span>}
        {plan.startDate && <span className="badge">Du {formatDateShort(plan.startDate)} au {plan.endDate ? formatDateShort(plan.endDate) : '…'}</span>}
      </div>

      {plan.templateMeals.length > 0 && (
        <section className="card stack">
          <h2>{plan.materialized ? 'Dates du plan' : 'Démarrer le plan'}</h2>
          <p className="small muted">{plan.templateMeals.length} repas modèles sur {plan.durationWeeks} semaines. {plan.materialized ? 'Changer la date recrée les repas encore prévus.' : 'Choisissez le lundi de la semaine 1.'}</p>
          <PlanStart plan={plan} compact />
        </section>
      )}

      <section className="card stack">
        <h2>Personnes du plan</h2>
        {persons.map((p) => {
          const m = cur.find((x) => x.personId === p.id);
          return (
            <div key={p.id} className="stack" style={{ gap: 2 }}>
              <label className="check"><input type="checkbox" checked={!!m} onChange={() => toggleMember(p.id)} /> {p.name}</label>
              {m && <p className="tiny muted" style={{ marginLeft: 32 }}>Profils : {m.profileIds.map((x) => profiles.find((pr) => pr.id === x)?.name ?? x).join(', ') || 'aucun'}</p>}
            </div>
          );
        })}
        {members && <button className="btn primary" onClick={() => ui.run(() => updatePlan(plan.id, { members }), 'Membres enregistrés').then(() => setMembers(null))}>Enregistrer les membres</button>}
        <p className="tiny muted">Les repas déjà générés gardent leurs convives ; modifiez un repas pour changer qui mange.</p>
      </section>

      {lists.length > 0 && (
        <section>
          <div className="section-title"><h2>Périodes de courses</h2></div>
          <div className="list">
            {lists.map((l) => {
              const b = budgets.find((x) => x.periodIndex === l.periodIndex && x.kind === 'cible');
              const e = budgets.find((x) => x.periodIndex === l.periodIndex && x.kind === 'économique');
              return (
                <Link key={l.id} to={`/courses/${l.id}`} className="item">
                  <span className="grow"><span className="title">{l.name}</span><div className="meta">{l.periodStart ? `${formatDateShort(l.periodStart)} – ${formatDateShort(l.periodEnd!)} · ` : ''}cible {formatMoney(b?.amount)} · économique {formatMoney(e?.amount)}</div></span>
                  <span className="badge">{l.status}</span>
                </Link>
              );
            })}
          </div>
          <p className="tiny muted" style={{ marginTop: 6 }}>Prix : estimations historiques du document, non vérifiées en magasin.</p>
        </section>
      )}

      {plan.principles.length > 0 && (
        <section className="card stack small">
          <h2>Principes et règles du plan</h2>
          <ul className="clean">{plan.principles.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </section>
      )}

      <section className="card stack">
        <h2>Activation</h2>
        {plan.active ? (
          <>
            <Field label="Désactiver à partir du"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <button className="btn danger" onClick={deactivate}>Désactiver le plan…</button>
          </>
        ) : (
          <button className="btn primary" onClick={() => ui.run(() => reactivatePlan(plan.id, on), 'Plan réactivé')}>Réactiver le plan</button>
        )}
        <button className="btn" onClick={async () => { const p = await ui.run(() => duplicatePlan(plan.id), 'Plan dupliqué'); if (p) nav(`/profils/plan/${p.id}`); }}>Dupliquer ce plan</button>
      </section>

      <Sheet open={next} onClose={() => setNext(false)} title="Et maintenant ?">
        <p>Le plan est désactivé et son historique conservé. Les produits encore présents dans les placards et le congélateur restent en stock : ils ne seront pas rachetés tant qu’ils suffisent.</p>
        {otherPlans.length > 0 && (
          <div className="list">
            {otherPlans.map((p) => (
              <Link key={p.id} className="item" to={`/profils/plan/${p.id}`} onClick={() => setNext(false)}>
                <span className="grow title">{p.name}</span><span className="badge">{p.active ? 'Actif' : 'Activer…'}</span>
              </Link>
            ))}
          </div>
        )}
        <button className="btn primary" onClick={async () => {
          const p = await ui.run(() => createPlan({ name: 'Plan familial standard', members: persons.filter((x) => x.active).map((x) => ({ personId: x.id, profileIds: x.profileIds.filter((pid) => !profiles.find((pr) => pr.id === pid)?.hasPrescription) })), active: true }));
          if (p) { setNext(false); nav(`/profils/plan/${p.id}`); }
        }}>Créer un nouveau plan avec les personnes actives</button>
        <Link className="btn" to="/menus" onClick={() => setNext(false)}>Recalculer les menus à venir</Link>
        <Link className="btn" to="/courses?generer=1" onClick={() => setNext(false)}>Générer les prochaines courses</Link>
      </Sheet>
    </div>
  );
}
