import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../db/db';
import { deactivatePerson, previewPersonDeactivation, updatePerson } from '../db/entityOps';
import type { Person } from '../domain/types';
import { useToday } from '../ui/hooks';
import { Empty, Field, PageHead, useUi } from '../ui/kit';

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function PersonPage() {
  const { id = '' } = useParams();
  const ui = useUi();
  const on = useToday();
  const person = useLiveQuery(() => db.persons.get(id), [id]);
  const profiles = useLiveQuery(() => db.profiles.toArray(), []) ?? [];
  const [d, setD] = useState<Person | null>(null);
  useEffect(() => { if (person) setD(person); }, [person]);
  if (person === undefined || (person && !d)) return <div className="empty">Chargement…</div>;
  if (!person || !d) return <Empty title="Personne introuvable" />;

  const save = () => ui.run(() => updatePerson(id, { ...d, active: person.active }), 'Enregistré');
  const toggleActive = async () => {
    if (person.active) {
      const pv = await previewPersonDeactivation(id, on);
      const ok = await ui.confirm(`Désactiver ${person.name} ?`, {
        body: (
          <>
            <p>{pv.futureMeals} repas à venir comptent cette personne : elle en sera retirée et les quantités nécessaires seront recalculées.</p>
            {pv.plans.length > 0 && <p className="small">Plans actifs concernés : {pv.plans.join(', ')}.</p>}
            <p className="small muted">Les repas passés, l’historique et le profil sont conservés. La personne pourra être réactivée.</p>
          </>
        ),
        confirm: 'Désactiver',
      });
      if (ok) await ui.run(() => deactivatePerson(id, on), `Profil de ${person.name} désactivé`);
    } else {
      await ui.run(() => updatePerson(id, { active: true }), `Profil de ${person.name} réactivé (à ajouter aux repas voulus)`);
    }
  };

  return (
    <div className="stack">
      <PageHead back="/profils" title={person.name} sub={person.active ? 'Profil actif' : 'Profil inactif'} actions={<button className="btn small" onClick={toggleActive}>{person.active ? 'Désactiver' : 'Réactiver'}</button>} />
      <Field label="Nom ou pseudonyme"><input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
      <div className="stack" style={{ gap: 2 }}>
        <span className="small strong muted">Profils alimentaires</span>
        {profiles.map((p) => (
          <label key={p.id} className="check"><input type="checkbox" checked={d.profileIds.includes(p.id)} onChange={(e) => setD({ ...d, profileIds: e.target.checked ? [...d.profileIds, p.id] : d.profileIds.filter((x) => x !== p.id) })} /> {p.name}</label>
        ))}
      </div>
      <div className="grid2">
        <Field label="Début (facultatif)"><input type="date" value={d.startDate ?? ''} onChange={(e) => setD({ ...d, startDate: e.target.value || undefined })} /></Field>
        <Field label="Fin (facultative)"><input type="date" value={d.endDate ?? ''} onChange={(e) => setD({ ...d, endDate: e.target.value || undefined })} /></Field>
      </div>
      <Field label="Aliments appréciés" hint="Séparés par des virgules"><input value={d.likes.join(', ')} onChange={(e) => setD({ ...d, likes: list(e.target.value) })} /></Field>
      <Field label="Aliments détestés"><input value={d.dislikes.join(', ')} onChange={(e) => setD({ ...d, dislikes: list(e.target.value) })} /></Field>
      <Field label="Allergies et intolérances (facultatif)" hint="Pour qu’une allergie bloque des recettes, ajoutez une règle « éviter » dans son profil."><input value={d.allergies.join(', ')} onChange={(e) => setD({ ...d, allergies: list(e.target.value) })} /></Field>
      <Field label="Repas et collations habituels"><textarea value={d.usualMeals ?? ''} onChange={(e) => setD({ ...d, usualMeals: e.target.value || undefined })} /></Field>
      <Field label="Objectifs (facultatif)" hint="Informatif : aucune prescription n’en est déduite."><textarea value={d.goals ?? ''} onChange={(e) => setD({ ...d, goals: e.target.value || undefined })} /></Field>
      <Field label="Notes"><textarea value={d.notes ?? ''} onChange={(e) => setD({ ...d, notes: e.target.value || undefined })} /></Field>
      <button className="btn primary" onClick={save}>Enregistrer</button>
    </div>
  );
}
