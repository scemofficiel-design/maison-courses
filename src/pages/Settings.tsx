import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { backupFileName, exportAll, restoreBackup, summarize, validateBackup, type Backup } from '../db/backup';
import { db, SCHEMA_VERSION } from '../db/db';
import { createCategory, createLocation, updateSettings } from '../db/entityOps';
import { resetDemoData, type ResetScope } from '../db/seedOps';
import { nowISO } from '../db/util';
import type { DashboardWidget } from '../domain/types';
import { t } from '../i18n/fr';
import { buildSeed, SEED_VERSION } from '../seed/build';
import { DOCUMENT_NAME } from '../seed/planDocument';
import { verifySeed } from '../seed/verify';
import { useCatalog, useSettings } from '../ui/hooks';
import { Field, NumberInput, PageHead, useUi } from '../ui/kit';

const WIDGETS: { id: DashboardWidget; label: string }[] = [
  { id: 'plan', label: 'Démarrage du plan' },
  { id: 'today', label: 'Repas du jour et manques' },
  { id: 'alerts', label: 'Indicateurs et alertes de stock' },
  { id: 'shopping', label: 'Prochaine liste de courses' },
  { id: 'budget', label: 'Budget de la prochaine liste' },
  { id: 'priority', label: 'À consommer en priorité' },
  { id: 'feasible', label: 'Repas réalisables' },
  { id: 'profiles', label: 'Personnes et plans actifs' },
];

const SCOPES: { id: ResetScope; label: string }[] = [
  { id: 'recipes', label: 'Recettes de départ' },
  { id: 'profiles', label: 'Profils et règles des 3 personnes' },
  { id: 'plan', label: 'Plan familial, budgets et substitutions' },
  { id: 'lists', label: 'Listes P1 à P4 du document (articles non achetés)' },
  { id: 'catalog', label: 'Catalogue : catégories, emplacements, fiches produits (sans toucher aux quantités)' },
];

export default function SettingsPage() {
  const ui = useUi();
  const settings = useSettings();
  const { categories, locations } = useCatalog();
  const fileRef = useRef<HTMLInputElement>(null);
  const [storage, setStorage] = useState<{ persisted?: boolean; usage?: number; quota?: number }>({});
  const [scopes, setScopes] = useState<Set<ResetScope>>(new Set());
  const [newCat, setNewCat] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const report = useMemo(() => verifySeed(buildSeed(nowISO())), []);
  const counts = useLiveQuery(async () => ({ products: await db.products.count(), movements: await db.movements.count(), meals: await db.meals.count(), purchases: await db.purchases.count() }), []);

  useEffect(() => {
    (async () => {
      const persisted = await navigator.storage?.persisted?.().catch(() => undefined);
      const est = await navigator.storage?.estimate?.().catch(() => undefined);
      setStorage({ persisted, usage: est?.usage, quota: est?.quota });
    })();
  }, []);

  const doExport = async () => {
    const backup = await exportAll();
    const json = JSON.stringify(backup, null, 1);
    const name = backupFileName();
    const file = new File([json], name, { type: 'application/json' });
    // Sur iPhone, le partage permet d'enregistrer dans Fichiers, iCloud Drive, AirDrop ou un courriel.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Sauvegarde Maison & Courses' });
        await updateSettings({ lastExportAt: nowISO() });
        ui.toast('Sauvegarde partagée');
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    await updateSettings({ lastExportAt: nowISO() });
    ui.toast('Sauvegarde exportée');
  };

  const doImport = async (f: File) => {
    let data: Backup;
    try {
      data = validateBackup(JSON.parse(await f.text()));
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'Fichier illisible', { error: true });
      return;
    }
    const s = summarize(data);
    const ok = await ui.confirm('Restaurer cette sauvegarde ?', {
      body: (
        <>
          <p>Sauvegarde du {new Date(s.exportedAt).toLocaleString('fr-CA')} : {s.counts.products} produits, {s.counts.meals} repas, {s.counts.lists} listes, {s.counts.movements} mouvements.</p>
          <p className="strong">Toutes les données actuelles de cet appareil seront remplacées.</p>
          <p className="small muted">Conseil : exportez d’abord les données actuelles si vous pourriez en avoir besoin.</p>
        </>
      ),
      danger: true,
      confirm: 'Remplacer et restaurer',
    });
    if (!ok) return;
    const r = await ui.run(() => restoreBackup(data));
    if (r) {
      ui.toast('Sauvegarde restaurée');
      setTimeout(() => window.location.reload(), 600);
    }
  };

  const toggleWidget = (w: DashboardWidget) => {
    const has = settings.dashboardWidgets.includes(w);
    ui.run(() => updateSettings({ dashboardWidgets: has ? settings.dashboardWidgets.filter((x) => x !== w) : [...settings.dashboardWidgets, w] }));
  };

  const mb = (n?: number) => (n === undefined ? '?' : `${(n / 1024 / 1024).toFixed(1)} Mo`);

  return (
    <div className="stack">
      <PageHead back="/plus" title="Paramètres" />

      <section className="card stack" id="sauvegarde">
        <h2>Sauvegarde et restauration</h2>
        <p className="small">{t.backupWarning}</p>
        <p className="small muted">Dernière sauvegarde : {settings.lastExportAt ? new Date(settings.lastExportAt).toLocaleString('fr-CA') : 'jamais'}.</p>
        <div className="btn-row">
          <button className="btn primary grow" onClick={doExport}><Download /> Exporter toutes les données</button>
          <button className="btn grow" onClick={() => fileRef.current?.click()}><Upload /> Restaurer une sauvegarde</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
        <p className="tiny muted">
          Stockage : {storage.persisted === true ? 'protégé contre l’effacement automatique' : storage.persisted === false ? 'non protégé (le navigateur peut l’effacer)' : 'état inconnu'} · {mb(storage.usage)} utilisés
          {counts && ` · ${counts.products} produits, ${counts.meals} repas, ${counts.movements} mouvements, ${counts.purchases} achats`}
        </p>
        <Field label="Rappel de sauvegarde (jours)"><NumberInput value={settings.exportReminderDays} onChange={(v) => v && ui.run(() => updateSettings({ exportReminderDays: v }))} ariaLabel="Rappel de sauvegarde" /></Field>
      </section>

      <section className="card stack">
        <h2>Installer sur l’iPhone</h2>
        <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>Ouvrez cette page dans <strong>Safari</strong>.</li>
          <li>Touchez le bouton <strong>Partager</strong> (carré avec une flèche).</li>
          <li>Choisissez <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.</li>
          <li>Lancez l’application depuis son icône : elle fonctionne aussi hors ligne.</li>
        </ol>
        <p className="tiny muted">L’application installée et Safari ont des données séparées sur iPhone : utilisez toujours l’icône de l’écran d’accueil, et exportez une sauvegarde avant de la supprimer.</p>
      </section>

      <section className="card stack">
        <h2>Préférences</h2>
        <Field label="Alerte de péremption (jours avant la date)"><NumberInput value={settings.expiryWarningDays} onChange={(v) => v !== null && ui.run(() => updateSettings({ expiryWarningDays: v }))} ariaLabel="Alerte de péremption" /></Field>
        <Field label="Devise" hint="CAD pour cette version ; la structure prévoit d’autres devises.">
          <select value={settings.currency} onChange={(e) => ui.run(() => updateSettings({ currency: e.target.value }))}><option value="CAD">Dollar canadien (CAD)</option></select>
        </Field>
        <div className="stack" style={{ gap: 0 }}>
          <span className="small strong muted">Indicateurs de l’accueil</span>
          {WIDGETS.map((w) => <label key={w.id} className="check"><input type="checkbox" checked={settings.dashboardWidgets.includes(w.id)} onChange={() => toggleWidget(w.id)} /> {w.label}</label>)}
        </div>
      </section>

      <section className="card stack">
        <h2>Catégories et emplacements</h2>
        <div className="chips" style={{ flexWrap: 'wrap' }}>{categories.map((c) => <span key={c.id} className="chip">{c.icon} {c.name}</span>)}</div>
        <div className="row">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nouvelle catégorie" aria-label="Nouvelle catégorie" />
          <button className="btn" disabled={!newCat.trim()} onClick={() => ui.run(() => createCategory(newCat, 'alimentaire'), 'Catégorie ajoutée').then(() => setNewCat(''))}>Ajouter</button>
        </div>
        <div className="chips" style={{ flexWrap: 'wrap' }}>{locations.map((l) => <span key={l.id} className="chip">{l.icon} {l.name}</span>)}</div>
        <div className="row">
          <input value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="Nouvel emplacement" aria-label="Nouvel emplacement" />
          <button className="btn" disabled={!newLoc.trim()} onClick={() => ui.run(() => createLocation(newLoc), 'Emplacement ajouté').then(() => setNewLoc(''))}>Ajouter</button>
        </div>
      </section>

      <section className="card stack">
        <h2>Importation du plan familial</h2>
        <p className="small muted">Source : {DOCUMENT_NAME} · données initiales v{SEED_VERSION}</p>
        <ul className="clean small">
          {report.checks.map((c) => <li key={c.label}>{c.ok ? '✅' : '❌'} {c.label} <span className="muted">— {c.detail}</span></li>)}
        </ul>
        <details>
          <summary className="small">Données interprétées, ambiguës ou non importées ({report.notes.length})</summary>
          <ul className="clean small">{report.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </details>
      </section>

      <section className="card stack">
        <h2>Réinitialiser les données de démonstration</h2>
        <p className="small muted">Remet les éléments choisis dans leur état d’origine. Ne touche jamais aux quantités en stock, à l’historique, aux achats, aux repas préparés ni aux éléments que vous avez créés.</p>
        {SCOPES.map((s) => (
          <label key={s.id} className="check small"><input type="checkbox" checked={scopes.has(s.id)} onChange={() => setScopes((x) => { const n = new Set(x); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} /> {s.label}</label>
        ))}
        <button className="btn" disabled={!scopes.size} onClick={async () => {
          if (!(await ui.confirm('Réinitialiser ces données ?', { body: <p>Vos modifications sur ces éléments de démonstration seront perdues.</p>, danger: true, confirm: 'Réinitialiser' }))) return;
          const n = await ui.run(() => resetDemoData([...scopes]));
          if (n !== undefined) { ui.toast(`${n} élément(s) réinitialisé(s)`); setScopes(new Set()); }
        }}>Réinitialiser la sélection</button>
      </section>

      <section className="card stack small">
        <h2>Intelligence artificielle</h2>
        <p>Toutes les fonctions (calcul des quantités, listes, suggestions, budget, portions, restrictions) fonctionnent avec des règles locales, sans abonnement ni service externe.</p>
        <p className="muted">Aucune IA externe n’est intégrée dans cette version et aucune donnée ne quitte l’appareil. Si une IA est ajoutée plus tard, elle sera facultative, clairement signalée, désactivée par défaut, et rien ne lui sera envoyé sans votre action explicite.</p>
      </section>

      <p className="tiny muted center">Maison & Courses · version {__APP_VERSION__} · schéma v{SCHEMA_VERSION}</p>
    </div>
  );
}
