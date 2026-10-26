import { useMemo, useState } from 'react';
import { expiryLevel, stockLevel } from '../domain/stock';
import type { ID, MealPlan, Product, Recipe } from '../domain/types';
import { formatQty } from '../domain/units';
import { nextMonday, startOfWeek, today, formatDateLong, weekdayIndex } from '../domain/dates';
import { previewPlanStart, startPlan } from '../db/planOps';
import { norm, useCatalog } from './hooks';
import { SearchBox, Sheet, useUi } from './kit';

export function StockBadge({ p, warningDays = 3 }: { p: Product; warningDays?: number }) {
  const lvl = stockLevel(p);
  const exp = expiryLevel(p, today(), warningDays);
  return (
    <span className="row" style={{ gap: 4 }}>
      {lvl === 'inconnu' && <span className="badge info">Inconnu</span>}
      {lvl === 'épuisé' && <span className="badge danger">Épuisé</span>}
      {lvl === 'bas' && <span className="badge warn">Bas</span>}
      {exp === 'périmé' && <span className="badge danger">Périmé</span>}
      {exp === 'bientôt' && <span className="badge warn">À consommer</span>}
    </span>
  );
}

export function qtyText(p: Product) {
  return p.quantity === null ? 'Quantité inconnue' : formatQty(p.quantity, p.unit);
}

/** Sélecteur de produit avec recherche (option : créer un article libre). */
export function ProductPicker({ open, onClose, onPick, title = 'Choisir un produit', allowFree, onFree }: {
  open: boolean; onClose: () => void; onPick: (p: Product) => void; title?: string; allowFree?: boolean; onFree?: (name: string) => void;
}) {
  const { products, categoryById } = useCatalog();
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const n = norm(q);
    return products.filter((p) => !p.archived && (!n || norm(p.name).includes(n))).slice(0, 60);
  }, [products, q]);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <SearchBox value={q} onChange={setQ} placeholder="Rechercher un produit" />
      {allowFree && q.trim() && (
        <button className="btn soft block" onClick={() => { onFree?.(q.trim()); setQ(''); }}>Ajouter « {q.trim()} » (article libre)</button>
      )}
      <div className="list">
        {shown.map((p) => (
          <button key={p.id} className="item clickable" onClick={() => { onPick(p); setQ(''); }}>
            <span className="icon" aria-hidden>{categoryById.get(p.categoryId)?.icon ?? '📦'}</span>
            <span className="grow">
              <span className="title">{p.name}</span>
              <div className="meta">{qtyText(p)} · {p.unit}</div>
            </span>
          </button>
        ))}
        {!shown.length && <div className="item muted">Aucun produit trouvé.</div>}
      </div>
    </Sheet>
  );
}

export function RecipePicker({ open, onClose, onPick, recipes }: { open: boolean; onClose: () => void; onPick: (r: Recipe) => void; recipes: Recipe[] }) {
  const [q, setQ] = useState('');
  const shown = recipes.filter((r) => !q || norm(r.name).includes(norm(q)) || norm(r.category).includes(norm(q)));
  return (
    <Sheet open={open} onClose={onClose} title="Ajouter une recette">
      <SearchBox value={q} onChange={setQ} placeholder="Rechercher une recette" />
      <div className="list">
        {shown.map((r) => (
          <button key={r.id} className="item clickable" onClick={() => { onPick(r); setQ(''); }}>
            <span className="grow">
              <span className="title">{r.name}</span>
              <div className="meta">{r.category} · {r.prepMinutes + r.cookMinutes} min</div>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Carte de démarrage d'un plan : choix de la date, aperçu, confirmation. */
export function PlanStart({ plan, compact }: { plan: MealPlan; compact?: boolean }) {
  const ui = useUi();
  const [date, setDate] = useState(plan.startDate ?? nextMonday(today()));
  // Le document commence chaque semaine un lundi : la date choisie est ramenée au lundi de sa semaine.
  const monday = date ? startOfWeek(date) : '';
  const start = async () => {
    const preview = await previewPlanStart(plan.id, monday);
    const ok = await ui.confirm(plan.materialized ? 'Redémarrer le plan à cette date ?' : 'Démarrer le plan ?', {
      body: (
        <>
          <p>Du <strong>{formatDateLong(preview.start).toLowerCase()}</strong> au <strong>{formatDateLong(preview.end).toLowerCase()}</strong>.</p>
          <p>{preview.meals} repas et collations seront ajoutés au calendrier, et les 4 listes de courses seront datées.</p>
          {preview.conflicts > 0 && <p className="small">{preview.conflicts} créneau(x) déjà occupé(s) par d’autres repas seront conservés tels quels.</p>}
          {plan.materialized && <p className="small">Les repas du plan encore prévus seront recréés ; les repas déjà préparés sont conservés.</p>}
          <p className="small muted">Aucun stock n’est déduit : seule la confirmation d’un repas préparé modifie les stocks.</p>
        </>
      ),
      confirm: 'Démarrer',
    });
    if (!ok) return;
    await ui.run(() => startPlan(plan.id, monday), 'Plan démarré : les menus sont dans le calendrier.');
  };
  return (
    <div className={compact ? 'stack' : 'card accent stack'}>
      {!compact && (
        <>
          <h2>{plan.name}</h2>
          <p className="small">Les 8 semaines de menus, les règles et les 4 listes de courses du document sont prêtes. Choisissez le premier jour (semaine 1, lundi).</p>
        </>
      )}
      <div className="row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date de début du plan" />
        <button className="btn primary" onClick={start} disabled={!date}>{plan.materialized ? 'Redémarrer' : 'Démarrer'}</button>
      </div>
      {date && weekdayIndex(date) !== 0 && <p className="tiny muted">Le plan démarrera le {formatDateLong(monday).toLowerCase()} (les semaines du document commencent un lundi).</p>}
    </div>
  );
}

export function useIdSet(initial: ID[] = []) {
  const [set, setSet] = useState(new Set(initial));
  return {
    set,
    toggle: (id: ID) => setSet((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    }),
    reset: (ids: ID[]) => setSet(new Set(ids)),
  };
}
