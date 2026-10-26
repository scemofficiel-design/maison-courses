import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { createPerson, createProfile } from '../db/entityOps';
import { createPlan } from '../db/planOps';
import { formatDateShort } from '../domain/dates';
import { Field, PageHead, Sheet, useUi } from '../ui/kit';

export default function ProfilesPage() {
  const ui = useUi();
  const nav = useNavigate();
  const persons = useLiveQuery(() => db.persons.toArray(), []) ?? [];
  const profiles = useLiveQuery(() => db.profiles.toArray(), []) ?? [];
  const plans = useLiveQuery(() => db.plans.toArray(), []) ?? [];
  const [creating, setCreating] = useState<'person' | 'profile' | 'plan' | null>(null);
  const [name, setName] = useState('');
  const profileName = (id: string) => profiles.find((p) => p.id === id)?.name ?? id;

  const create = async () => {
    const res = await ui.run(async () => {
      if (creating === 'person') return `/profils/personne/${(await createPerson({ name })).id}`;
      if (creating === 'profile') return `/profils/profil/${(await createProfile({ name })).id}`;
      return `/profils/plan/${(await createPlan({ name, durationWeeks: 4 })).id}`;
    });
    if (res) { setCreating(null); setName(''); nav(res); }
  };

  return (
    <div className="stack">
      <PageHead back="/plus" title="Profils" sub="Personnes, régimes et plans alimentaires" />
      <p className="small muted">Les données de santé restent sur cet appareil. L’application ne pose aucun diagnostic et ne déduit aucune prescription : les règles proviennent de vos documents ou de vos saisies.</p>

      <section>
        <div className="section-title"><h2>Personnes</h2><button className="btn small ghost" onClick={() => setCreating('person')}><Plus /> Ajouter</button></div>
        <div className="list">
          {persons.map((p) => (
            <Link key={p.id} to={`/profils/personne/${p.id}`} className="item">
              <span className="icon" aria-hidden>{p.active ? '🙂' : '💤'}</span>
              <span className="grow"><span className="title">{p.name}</span><div className="meta">{p.profileIds.map(profileName).join(', ') || 'Aucun profil'}</div></span>
              {!p.active && <span className="badge">Inactive</span>}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-title"><h2>Profils alimentaires</h2><button className="btn small ghost" onClick={() => setCreating('profile')}><Plus /> Ajouter</button></div>
        <div className="list">
          {profiles.map((p) => (
            <Link key={p.id} to={`/profils/profil/${p.id}`} className="item">
              <span className="grow"><span className="title">{p.name}</span><div className="meta">{p.rules.length} règle(s){p.hasPrescription ? ' · contient une prescription' : ''}</div></span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-title"><h2>Plans alimentaires</h2><button className="btn small ghost" onClick={() => setCreating('plan')}><Plus /> Ajouter</button></div>
        <div className="list">
          {plans.map((p) => (
            <Link key={p.id} to={`/profils/plan/${p.id}`} className="item">
              <span className="grow">
                <span className="title">{p.name}</span>
                <div className="meta">{p.members.length} personne(s){p.startDate ? ` · du ${formatDateShort(p.startDate)} au ${p.endDate ? formatDateShort(p.endDate) : '…'}` : ' · non démarré'}</div>
              </span>
              <span className={`badge ${p.active ? 'ok' : ''}`}>{p.active ? 'Actif' : 'Inactif'}</span>
            </Link>
          ))}
        </div>
      </section>

      <Sheet open={!!creating} onClose={() => setCreating(null)} title={creating === 'person' ? 'Nouvelle personne' : creating === 'profile' ? 'Nouveau profil alimentaire' : 'Nouveau plan alimentaire'}
        footer={<button className="btn primary block" disabled={!name.trim()} onClick={create}>Créer</button>}>
        <Field label={creating === 'person' ? 'Nom ou pseudonyme' : 'Nom'}><input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder={creating === 'plan' ? 'Ex. Plan familial standard' : creating === 'profile' ? 'Ex. Végétarien' : ''} /></Field>
      </Sheet>
    </div>
  );
}
