import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db/db';
import { deleteProfile, duplicateProfile, updateProfile } from '../db/entityOps';
import { uid } from '../db/util';
import type { DietProfile, DietRule, IngredientRole, RuleKind } from '../domain/types';
import { t } from '../i18n/fr';
import { Empty, Field, NumberInput, PageHead, Sheet, useUi } from '../ui/kit';

const KINDS: RuleKind[] = ['éviter', 'autorisé', 'limite', 'cuisson', 'portion', 'hydratation', 'collation', 'préparation', 'substitution', 'à confirmer', 'note'];
const ROLES: IngredientRole[] = ['féculent', 'protéine', 'légume', 'sauce', 'laitage', 'fruit'];

export default function ProfilePage() {
  const { id = '' } = useParams();
  const ui = useUi();
  const nav = useNavigate();
  const profile = useLiveQuery(() => db.profiles.get(id), [id]);
  const [d, setD] = useState<DietProfile | null>(null);
  const [rule, setRule] = useState<DietRule | null>(null);
  useEffect(() => { if (profile) setD(profile); }, [profile]);
  if (profile === undefined || (profile && !d)) return <div className="empty">Chargement…</div>;
  if (!profile || !d) return <Empty title="Profil introuvable" />;

  /** Toute modification d'une règle issue d'une prescription demande une confirmation explicite. */
  const guard = async (r: DietRule | undefined) => {
    if (!r?.prescription) return true;
    return ui.confirm('Règle issue d’une prescription', { body: <p className="row" style={{ alignItems: 'flex-start' }}><AlertTriangle size={20} style={{ flexShrink: 0 }} /> {t.prescriptionWarning}</p>, confirm: 'J’ai vérifié, modifier' });
  };
  const saveRule = async () => {
    if (!rule) return;
    const prev = d.rules.find((x) => x.id === rule.id);
    if (!(await guard(prev))) return;
    const rules = prev ? d.rules.map((x) => (x.id === rule.id ? rule : x)) : [...d.rules, rule];
    const ok = await ui.run(() => updateProfile(id, { rules }), 'Règle enregistrée');
    if (ok !== undefined) setRule(null);
  };
  const removeRule = async (r: DietRule) => {
    if (!(await guard(r))) return;
    if (!(await ui.confirm('Supprimer cette règle ?', { danger: true, confirm: 'Supprimer' }))) return;
    await ui.run(() => updateProfile(id, { rules: d.rules.filter((x) => x.id !== r.id) }), 'Règle supprimée');
  };
  const savePortions = async () => {
    if (d.portionRules.some((r) => r.prescription) && !(await ui.confirm('Portions issues d’une prescription', { body: <p>{t.prescriptionWarning}</p>, confirm: 'Enregistrer' }))) return;
    await ui.run(() => updateProfile(id, { name: d.name, description: d.description, notes: d.notes, portionFactors: d.portionFactors, portionRules: d.portionRules }), 'Profil enregistré');
  };

  const grouped = KINDS.map((k) => ({ k, rules: d.rules.filter((r) => r.kind === k) })).filter((g) => g.rules.length);

  return (
    <div className="stack">
      <PageHead back="/profils" title={profile.name} sub={profile.description} />
      {profile.hasPrescription && (
        <div className="card warn small">Ce profil reprend les règles du document fourni pour ce foyer. Ce n’est pas une prescription médicale universelle. Toute modification d’une règle de prescription doit être vérifiée avec le professionnel de santé concerné.</div>
      )}
      <Field label="Nom"><input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
      <Field label="Description"><input value={d.description ?? ''} onChange={(e) => setD({ ...d, description: e.target.value || undefined })} /></Field>

      <section className="card stack">
        <h2>Portions</h2>
        {d.portionRules.map((r, i) => (
          <div key={i} className="stack" style={{ gap: 2 }}>
            <input value={r.label} aria-label="Règle de portion" onChange={(e) => setD({ ...d, portionRules: d.portionRules.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <span className="tiny muted">{r.role}{r.slots ? ` · ${r.slots.join(', ')}` : ''}{r.prescription ? ' · prescription' : ''}{r.source ? ` · ${r.source}` : ''}</span>
          </div>
        ))}
        {!d.portionRules.length && <p className="small muted">Aucune règle de portion décrite.</p>}
        <div>
          <p className="small strong">Multiplicateurs pour le calcul des quantités</p>
          <p className="tiny muted">1 = portion de référence d’une recette. Ex. 1,5 pour une portion de féculent une fois et demie plus grande. Sert uniquement à estimer les quantités à cuisiner et à acheter.</p>
        </div>
        <div className="grid2">
          {ROLES.map((role) => (
            <Field key={role} label={role}>
              <NumberInput value={d.portionFactors[role] ?? null} placeholder="1" ariaLabel={`Multiplicateur ${role}`} onChange={(v) => setD({ ...d, portionFactors: { ...d.portionFactors, [role]: v ?? undefined } })} />
            </Field>
          ))}
        </div>
        {d.plateAdditions.length > 0 && <p className="small">Ajouts à l’assiette : {d.plateAdditions.map((a) => `${a.label} (${a.slot})`).join(', ')}</p>}
        <Field label="Notes, ambiguïtés et points à confirmer"><textarea rows={6} value={d.notes ?? ''} onChange={(e) => setD({ ...d, notes: e.target.value || undefined })} /></Field>
        <button className="btn primary" onClick={savePortions}>Enregistrer le profil</button>
      </section>

      <section>
        <div className="section-title"><h2>Règles ({d.rules.length})</h2><button className="btn small ghost" onClick={() => setRule({ id: uid('rule'), kind: 'éviter', label: '', tags: [] })}><Plus /> Ajouter</button></div>
        <div className="stack">
          {grouped.map(({ k, rules }) => (
            <div key={k} className="list">
              <div className="item"><span className="slot-label">{k}</span></div>
              {rules.map((r) => (
                <button key={r.id} className="item clickable" style={{ alignItems: 'flex-start' }} onClick={() => setRule({ ...r })}>
                  <span className="grow">
                    <span>{r.label}</span>
                    <div className="meta">
                      {r.prescription && <span className="badge warn" style={{ marginRight: 6 }}>Prescription</span>}
                      {r.tags?.length ? `Étiquettes : ${r.tags.join(', ')} · ` : ''}{r.allowedMethods ? `Autorisé : ${r.allowedMethods.join(', ')} · ` : ''}{r.max !== undefined ? `Max ${r.max} ${r.unit} / ${r.per} · ` : ''}{r.source}
                    </div>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <div className="btn-row">
        <button className="btn grow" onClick={async () => { const p = await ui.run(() => duplicateProfile(id), 'Profil dupliqué'); if (p) nav(`/profils/profil/${p.id}`); }}>Dupliquer</button>
        <button className="btn danger grow" onClick={async () => {
          if (await ui.confirm('Supprimer ce profil ?', { danger: true, confirm: 'Supprimer' })) {
            const ok = await ui.run(() => deleteProfile(id), 'Profil supprimé');
            if (ok !== undefined) nav('/profils');
          }
        }}>Supprimer</button>
      </div>

      <Sheet open={!!rule} onClose={() => setRule(null)} title={d.rules.some((x) => x.id === rule?.id) ? 'Modifier la règle' : 'Nouvelle règle'}
        footer={<>
          {rule && d.rules.some((x) => x.id === rule.id) && <button className="btn danger grow" onClick={() => removeRule(rule)}>Supprimer</button>}
          <button className="btn primary grow" disabled={!rule?.label.trim()} onClick={saveRule}>Enregistrer</button>
        </>}>
        {rule && (
          <>
            {rule.prescription && <div className="card warn small">{t.prescriptionWarning}</div>}
            <Field label="Type">
              <select value={rule.kind} onChange={(e) => setRule({ ...rule, kind: e.target.value as RuleKind })}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
            </Field>
            <Field label="Libellé"><textarea value={rule.label} onChange={(e) => setRule({ ...rule, label: e.target.value })} /></Field>
            {rule.kind === 'éviter' && (
              <Field label="Étiquettes de produits interdites" hint="Séparées par des virgules. Une recette contenant un produit portant l’une de ces étiquettes devient incompatible.">
                <input value={(rule.tags ?? []).join(', ')} onChange={(e) => setRule({ ...rule, tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
              </Field>
            )}
            {rule.kind === 'cuisson' && (
              <Field label="Modes de cuisson autorisés" hint="Ex. eau, vapeur, four, braise, papillote, cru">
                <input value={(rule.allowedMethods ?? []).join(', ')} onChange={(e) => setRule({ ...rule, allowedMethods: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
              </Field>
            )}
            {rule.kind === 'limite' && (
              <div className="grid2">
                <Field label="Étiquette"><input value={rule.limitTag ?? ''} onChange={(e) => setRule({ ...rule, limitTag: e.target.value })} /></Field>
                <Field label="Maximum (ml)"><NumberInput value={rule.max} onChange={(v) => setRule({ ...rule, max: v ?? undefined, unit: 'ml' })} ariaLabel="Maximum" /></Field>
                <Field label="Par"><select value={rule.per ?? 'repas'} onChange={(e) => setRule({ ...rule, per: e.target.value as 'repas' | 'jour' })}><option value="repas">repas</option><option value="jour">jour</option></select></Field>
              </div>
            )}
            {rule.source && <p className="tiny muted">Source : {rule.source}</p>}
          </>
        )}
      </Sheet>
    </div>
  );
}
