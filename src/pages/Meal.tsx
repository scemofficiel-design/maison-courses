import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ChefHat, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../db/db';
import { confirmCooked, deleteMeal, previewCooking, undoCooked, updateMeal, type ConsumptionLine } from '../db/mealOps';
import { dinersForMeal, loadContext, requirementsForMeal } from '../db/queries';
import { addMissingToList } from '../db/shoppingOps';
import { formatDateLong } from '../domain/dates';
import { aggregateRequirements } from '../domain/portions';
import { checkMealForProfiles } from '../domain/restrictions';
import { usableQuantity } from '../domain/stock';
import { uniqueProfiles } from '../domain/suggestions';
import type { MealSlot, Recipe } from '../domain/types';
import { formatQty } from '../domain/units';
import { SLOTS, t } from '../i18n/fr';
import { RecipePicker } from '../ui/bits';
import { Empty, Field, NumberInput, PageHead, Sheet, useUi } from '../ui/kit';

export default function MealPage() {
  const { id = '' } = useParams();
  const ui = useUi();
  const nav = useNavigate();
  const data = useLiveQuery(async () => {
    const meal = await db.meals.get(id);
    if (!meal) return { meal: null };
    const ctx = await loadContext();
    const diners = dinersForMeal(meal, ctx);
    const recipes = meal.recipeIds.map((r) => ctx.recipes.get(r)).filter((r): r is Recipe => !!r);
    const { needs, unconverted } = aggregateRequirements(requirementsForMeal(meal, ctx), ctx.products);
    const items = [...needs.values()].map((n) => {
      const p = ctx.products.get(n.productId)!;
      const have = usableQuantity(p, meal.date);
      return { ...n, name: p.name, have, missing: have === null ? null : Math.max(0, n.quantity - have) };
    }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const violations = checkMealForProfiles(recipes, uniqueProfiles(diners), ctx.products);
    const log = await db.mealLogs.where('plannedMealId').equals(id).filter((l) => !l.reversed).first();
    const persons = [...ctx.persons.values()];
    const plan = meal.planId ? ctx.plans.find((p) => p.id === meal.planId) : undefined;
    return { meal, diners, recipes, items, unconverted, violations, log, persons, plan, products: ctx.products };
  }, [id]);
  const allRecipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), []) ?? [];
  const [cook, setCook] = useState<ConsumptionLine[] | null>(null);
  const [cookUnconverted, setCookUnconverted] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [edit, setEdit] = useState<{ title: string; date: string; slot: MealSlot; recipeIds: string[]; personIds: string[]; notes: string } | null>(null);
  const [picker, setPicker] = useState(false);

  if (!data) return <div className="empty">Chargement…</div>;
  if (!data.meal) return <Empty title="Repas introuvable" />;
  const { meal, diners, recipes, items, violations, log, persons, plan } = data;
  const short = items.filter((i) => !i.optional && (i.have === null || (i.missing ?? 0) > 1e-9));

  const openCook = async () => {
    const r = await ui.run(() => previewCooking(meal.id));
    if (r) {
      setCook(r.lines);
      setCookUnconverted(r.unconverted);
    }
  };
  const doCook = async () => {
    if (!cook) return;
    const res = await ui.run(() => confirmCooked(meal.id, cook.map((c) => ({ productId: c.productId, quantity: c.quantity, unit: c.unit }))));
    if (!res) return;
    setCook(null);
    if (res.alreadyDone) ui.toast('Ce repas était déjà enregistré comme préparé : aucune nouvelle déduction.');
    else if (res.warnings.length) setWarnings(res.warnings);
    else ui.toast('Préparation enregistrée, stocks mis à jour');
  };

  return (
    <div className="stack">
      <PageHead back title={meal.title} sub={<span>{t.slots[meal.slot]} · {formatDateLong(meal.date)}</span>} />
      <div className="row wrap">
        <span className={`badge ${meal.status === 'préparé' ? 'ok' : meal.status === 'validé' ? 'primary' : ''}`}>{t.mealStatus[meal.status]}</span>
        {plan && <Link className="badge info" to={`/profils/plan/${plan.id}`}>{plan.name}</Link>}
      </div>
      {meal.notes && <p className="small muted">{meal.notes}</p>}

      {violations.length > 0 && (
        <div className="card danger small stack" style={{ gap: 4 }}>
          <strong className="row"><AlertTriangle size={18} /> Incompatible avec un profil actif</strong>
          {violations.map((v, i) => <span key={i}>{v.profileName} : {v.message}</span>)}
        </div>
      )}

      <section className="card stack">
        <h2>Portions individuelles</h2>
        {!diners.length && <p className="small muted">Aucune personne associée à ce repas.</p>}
        {diners.map((d) => {
          const rules = d.profiles.flatMap((p) => p.portionRules.filter((r) => (!r.slots || r.slots.includes(meal.slot)) && (!r.whenProductId || items.some((i) => i.productId === r.whenProductId))));
          const adds = d.profiles.flatMap((p) => p.plateAdditions.filter((a) => a.slot === meal.slot));
          const prep = d.profiles.flatMap((p) => p.rules.filter((r) => r.kind === 'préparation'));
          return (
            <div key={d.personId} className="stack" style={{ gap: 2 }}>
              <span className="strong">{d.name}</span>
              <ul className="clean small">
                {rules.map((r, i) => <li key={i}>{r.label}{r.prescription ? ' (prescription)' : ''}</li>)}
                {adds.map((a, i) => <li key={`a${i}`}>+ {a.label}</li>)}
                {prep.map((r) => <li key={r.id} className="muted">{r.label}</li>)}
                {!rules.length && !adds.length && !prep.length && <li className="muted">Portion standard.</li>}
              </ul>
            </div>
          );
        })}
      </section>

      <section>
        <div className="section-title"><h2>Recettes</h2></div>
        <div className="list">
          {recipes.map((r) => (
            <Link key={r.id} to={`/recettes/${r.id}?portions=${diners.length || r.servings}`} className="item">
              <ChefHat size={20} aria-hidden />
              <span className="grow"><span className="title">{r.name}</span><div className="meta">{r.prepMinutes + r.cookMinutes} min · {r.cookingMethods.join(', ')}</div></span>
            </Link>
          ))}
          {!recipes.length && <div className="item muted small">Aucune recette associée (repas libre).</div>}
        </div>
      </section>

      {items.length > 0 && (
        <section>
          <div className="section-title"><h2>Ingrédients pour {diners.length} personne(s)</h2></div>
          <div className="list">
            {items.map((i) => (
              <div key={i.productId} className="item">
                <span className="grow"><span className="title">{i.name}</span>{i.optional && <span className="badge" style={{ marginLeft: 6 }}>Facultatif</span>}<div className="meta">{formatQty(i.quantity, i.unit)}</div></span>
                {i.have === null ? <span className="badge info">Stock inconnu</span> : (i.missing ?? 0) > 1e-9 ? <span className="badge danger">Manque {formatQty(i.missing!, i.unit)}</span> : <span className="badge ok">Disponible</span>}
              </div>
            ))}
          </div>
          {data.unconverted.length > 0 && <p className="tiny muted" style={{ marginTop: 6 }}>Non comptés (conversion inconnue) : {data.unconverted.map((u) => `${data.products.get(u.productId)?.name} ${u.quantity} ${u.unit}`).join(', ')}.</p>}
          {short.length > 0 && meal.status !== 'préparé' && (
            <button className="btn accent block" style={{ marginTop: 10 }} onClick={async () => {
              const res = await ui.run(() => addMissingToList(short.map((s) => ({ productId: s.productId, quantity: s.missing ?? s.quantity, reason: `Manquant pour « ${meal.title} »` })), meal.date));
              if (res) ui.toast(`${res.added} produit(s) ajouté(s) à « ${res.listName} »`, { action: { label: 'Voir', run: () => nav(`/courses/${res.listId}`) } });
            }}><ShoppingCart /> Ajouter les manquants aux courses</button>
          )}
        </section>
      )}

      <div className="stack">
        {meal.status === 'préparé' ? (
          <>
            {log && <p className="small muted">Préparé le {new Date(log.at).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })} : {log.consumed.length} ingrédient(s) déduit(s) du stock.</p>}
            <button className="btn" onClick={async () => {
              if (await ui.confirm('Annuler la préparation ?', { body: <p>Les quantités déduites seront remises en stock.</p>, confirm: 'Annuler la préparation' })) await ui.run(() => undoCooked(meal.id), 'Préparation annulée, stock rétabli');
            }}>Annuler la préparation (erreur)</button>
          </>
        ) : (
          <>
            <button className="btn primary block" onClick={openCook} disabled={meal.status === 'archivé'}><ChefHat /> J’ai préparé ce repas</button>
            <div className="btn-row">
              {meal.status === 'prévu' && <button className="btn grow" onClick={() => ui.run(() => updateMeal(meal.id, { status: 'validé' }), 'Menu validé')}>Valider le menu</button>}
              {meal.status === 'validé' && <button className="btn grow" onClick={() => ui.run(() => updateMeal(meal.id, { status: 'prévu' }))}>Repasser en « prévu »</button>}
              {meal.status === 'archivé' && <button className="btn grow" onClick={() => ui.run(() => updateMeal(meal.id, { status: 'prévu' }), 'Repas restauré')}>Restaurer</button>}
              <button className="btn grow" onClick={() => setEdit({ title: meal.title, date: meal.date, slot: meal.slot, recipeIds: meal.recipeIds, personIds: meal.personIds, notes: meal.notes ?? '' })}>Modifier / déplacer</button>
              <button className="btn danger grow" onClick={async () => {
                if (await ui.confirm('Supprimer ce repas du menu ?', { danger: true, confirm: 'Supprimer' })) {
                  const ok = await ui.run(() => deleteMeal(meal.id), 'Repas supprimé');
                  if (ok !== undefined) nav('/menus?d=' + meal.date);
                }
              }}>Supprimer</button>
            </div>
            <p className="tiny muted">Planifier un repas ne modifie pas les stocks : seule la confirmation de la préparation déduit les quantités, avec possibilité de les corriger.</p>
          </>
        )}
      </div>

      <Sheet open={!!cook} onClose={() => setCook(null)} title="Quantités utilisées"
        footer={<button className="btn primary block" onClick={doCook}>Confirmer et déduire du stock</button>}>
        <p className="small muted">Corrigez les quantités réellement utilisées. Mettez 0 pour ne rien déduire.</p>
        {cook?.map((c, i) => (
          <div key={c.productId} className="row">
            <span className="grow"><span className="strong">{c.name}</span><div className="tiny muted">En stock : {c.stock === null ? 'inconnu' : formatQty(c.stock, c.unit)}</div></span>
            <div style={{ width: 100 }}><NumberInput value={c.quantity} onChange={(v) => setCook((x) => x && x.map((y, j) => (j === i ? { ...y, quantity: v ?? 0 } : y)))} ariaLabel={`Quantité utilisée : ${c.name}`} /></div>
            <span className="small" style={{ width: 54 }}>{c.unit}</span>
          </div>
        ))}
        {!cook?.length && <p className="muted">Aucun ingrédient compté pour ce repas.</p>}
        {cookUnconverted.length > 0 && <p className="tiny muted">Non déduits (conversion inconnue) : {cookUnconverted.join(', ')}.</p>}
        <p className="tiny muted">Les produits « au goût » (huile, épices, condiments) ne sont pas déduits automatiquement.</p>
      </Sheet>

      <Sheet open={!!warnings} onClose={() => setWarnings(null)} title="Stock à surveiller"
        footer={<button className="btn primary block" onClick={() => setWarnings(null)}>Compris</button>}>
        <p>La préparation est enregistrée. Attention :</p>
        <ul className="clean">{warnings?.map((w) => <li key={w}>{w}</li>)}</ul>
      </Sheet>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Modifier le repas"
        footer={<button className="btn primary block" onClick={() => edit && ui.run(() => updateMeal(meal.id, { ...edit, title: edit.title.trim() || meal.title, notes: edit.notes || undefined }), 'Repas modifié').then(() => setEdit(null))}>Enregistrer</button>}>
        {edit && (
          <>
            <Field label="Titre"><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <div className="grid2">
              <Field label="Date"><input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></Field>
              <Field label="Repas">
                <select value={edit.slot} onChange={(e) => setEdit({ ...edit, slot: e.target.value as MealSlot })}>{SLOTS.map((s) => <option key={s} value={s}>{t.slots[s]}</option>)}</select>
              </Field>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <span className="small strong muted">Recettes</span>
              {edit.recipeIds.map((rid, i) => (
                <div key={rid + i} className="row between card tight"><span>{allRecipes.find((r) => r.id === rid)?.name ?? rid}</span><button className="btn small ghost" onClick={() => setEdit({ ...edit, recipeIds: edit.recipeIds.filter((_, j) => j !== i) })}>Retirer</button></div>
              ))}
              <button className="btn soft" onClick={() => setPicker(true)}>Ajouter ou remplacer une recette</button>
            </div>
            <div className="stack" style={{ gap: 2 }}>
              <span className="small strong muted">Personnes à table</span>
              {persons.map((p) => (
                <label key={p.id} className="check"><input type="checkbox" checked={edit.personIds.includes(p.id)} onChange={(e) => setEdit({ ...edit, personIds: e.target.checked ? [...edit.personIds, p.id] : edit.personIds.filter((x) => x !== p.id) })} /> {p.name}</label>
              ))}
            </div>
            <Field label="Notes"><textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </>
        )}
      </Sheet>
      <RecipePicker open={picker} onClose={() => setPicker(false)} recipes={allRecipes} onPick={(r) => { setEdit((e) => e && { ...e, recipeIds: [...e.recipeIds, r.id] }); setPicker(false); }} />
    </div>
  );
}
