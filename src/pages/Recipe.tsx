import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarPlus, Copy, Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db } from '../db/db';
import { deleteRecipe, duplicateRecipe, updateRecipe } from '../db/entityOps';
import { createMeal } from '../db/mealOps';
import { allocateStock, type NeedInput } from '../domain/families';
import { scaleQuantity } from '../domain/portions';
import { checkMeal } from '../domain/restrictions';
import type { IngredientRole, MealSlot, Recipe, RecipeIngredient, ScalingMode, Unit } from '../domain/types';
import { ALL_UNITS, convert, formatMoney, formatQty, round2 } from '../domain/units';
import { SLOTS, t } from '../i18n/fr';
import { ProductPicker } from '../ui/bits';
import { useCatalog, useToday } from '../ui/hooks';
import { Empty, Field, NumberInput, PageHead, Sheet, useUi } from '../ui/kit';

const ROLES: IngredientRole[] = ['féculent', 'protéine', 'légume', 'sauce', 'assaisonnement', 'matière grasse', 'laitage', 'fruit', 'boisson', 'autre'];
const METHODS = ['eau', 'vapeur', 'four', 'braise', 'papillote', 'cru', 'poêle sans huile', 'poêle', 'friture', 'mijoté'];

export default function RecipePage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const ui = useUi();
  const nav = useNavigate();
  const on = useToday();
  const { productById } = useCatalog();
  const recipe = useLiveQuery(() => db.recipes.get(id), [id]);
  const profiles = useLiveQuery(() => db.profiles.toArray(), []) ?? [];
  const families = useLiveQuery(async () => new Map((await db.families.toArray()).map((f) => [f.id, f])), []);
  const [servings, setServings] = useState<number>(Number(params.get('portions')) || 0);
  const [overrides, setOverrides] = useState<Record<number, number | null>>({});
  const [edit, setEdit] = useState<Recipe | null>(null);
  const [pick, setPick] = useState(false);
  const [plan, setPlan] = useState<{ date: string; slot: MealSlot } | null>(null);

  useEffect(() => {
    if (recipe && !servings) setServings(recipe.servings);
    if (recipe && params.get('edit') === '1' && !edit) setEdit(recipe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe]);

  if (recipe === undefined) return <div className="empty">Chargement…</div>;
  if (!recipe) return <Empty title="Recette introuvable" />;
  const ratio = servings / recipe.servings;
  const common = recipe.ingredients.map((ing, i) => ({ ing, i })).filter(({ ing }) => !ing.onlyForProfileIds?.length);
  const individual = recipe.ingredients.filter((ing) => ing.onlyForProfileIds?.length);
  let cost = 0;
  let costKnown = true;
  for (const { ing, i } of common) {
    if (ing.toTaste) continue;
    const p = productById.get(ing.productId);
    const qty = overrides[i] ?? scaleQuantity(ing.quantity, ing.scaling, ratio);
    const inUnit = p ? convert(qty, ing.unit, p.unit, p) : null;
    if (p?.unitPrice !== undefined && inUnit !== null) cost += inUnit * p.unitPrice;
    else costKnown = false;
  }
  const products = productById;
  // Disponibilité : stock propre puis références équivalentes autorisées pour tous les profils enregistrés.
  const needInputs: NeedInput[] = [];
  for (const { ing, i } of common) {
    const p = products.get(ing.productId);
    const inUnit = p ? convert(overrides[i] ?? scaleQuantity(ing.quantity, ing.scaling, ratio), ing.unit, p.unit, p) : null;
    if (p && inUnit !== null && !ing.toTaste) needInputs.push({ productId: p.id, quantity: inUnit, exactVariant: ing.exactVariant, profileIds: profiles.map((x) => x.id) });
  }
  const merged = new Map<string, NeedInput>();
  for (const n of needInputs) {
    const prev = merged.get(n.productId);
    merged.set(n.productId, prev ? { ...prev, quantity: prev.quantity + n.quantity, exactVariant: prev.exactVariant || n.exactVariant } : n);
  }
  const cover = allocateStock([...merged.values()], products, families ?? new Map(), new Map(profiles.map((x) => [x.id, x])), on).coverage;

  return (
    <div className="stack">
      <PageHead back title={recipe.name} sub={`${recipe.category} · préparation ${recipe.prepMinutes} min · cuisson ${recipe.cookMinutes} min · ${recipe.difficulty}`}
        actions={<button className="btn small" onClick={() => setEdit(recipe)}>Modifier</button>} />

      <section className="card stack">
        <div className="row between">
          <h2>Ingrédients</h2>
          <div className="stepper" aria-label="Nombre de portions">
            <button aria-label="Une portion de moins" onClick={() => setServings((s) => Math.max(1, s - 1))}><Minus size={18} /></button>
            <span>{servings} pers.</span>
            <button aria-label="Une portion de plus" onClick={() => setServings((s) => s + 1)}><Plus size={18} /></button>
          </div>
        </div>
        <p className="tiny muted">Recette de référence : {recipe.servings} portions. Quantités {recipe.quantitySource === 'indicatif' ? 'indicatives, à ajuster' : recipe.quantitySource}.</p>
        <div className="stack" style={{ gap: 8 }}>
          {common.map(({ ing, i }) => {
            const p = products.get(ing.productId);
            const scaled = round2(scaleQuantity(ing.quantity, ing.scaling, ratio));
            const c = p ? cover.get(p.id) : undefined;
            const have = !c || c.unknown ? null : c.covered;
            const enough = !!c && have !== null && c.shortfall <= 1e-9;
            return (
              <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <span className="strong">{p?.name ?? 'Produit supprimé'}</span>
                  {ing.optional && <span className="badge" style={{ marginLeft: 6 }}>Facultatif</span>}
                  {ing.toTaste && <span className="badge" style={{ marginLeft: 6 }}>Au goût</span>}
                  {ing.note && <div className="tiny muted">{ing.note}</div>}
                  {c?.uses.length ? <div className="tiny" style={{ color: 'var(--ok)' }}>Disponible avec {c.uses.map((u) => u.name).join(', ')}</div> : null}
                  {ing.exactVariant && <div className="tiny muted">Variante exigée par la recette</div>}
                  {ing.scaling === 'modéré' && ratio !== 1 && <div className="tiny muted">Assaisonnement : non multiplié linéairement, ajustez au goût.</div>}
                </div>
                {ing.scaling === 'linéaire' || ratio === 1 ? (
                  <span className="nowrap small strong">{formatQty(overrides[i] ?? scaled, ing.unit)}</span>
                ) : (
                  <div style={{ width: 120 }} className="row">
                    <NumberInput value={overrides[i] ?? scaled} onChange={(v) => setOverrides((o) => ({ ...o, [i]: v }))} ariaLabel={`Quantité ajustée : ${p?.name}`} />
                    <span className="tiny">{ing.unit}</span>
                  </div>
                )}
                {!ing.toTaste && <span className={`badge ${have === null ? 'info' : enough ? 'ok' : 'danger'}`} style={{ marginLeft: 6 }}>{have === null ? '?' : enough ? '✓' : 'Manque'}</span>}
              </div>
            );
          })}
        </div>
        {individual.length > 0 && (
          <div className="stack small" style={{ gap: 4 }}>
            <strong>Adaptations individuelles (par personne)</strong>
            {individual.map((ing, i) => (
              <div key={i} className="row between">
                <span>{products.get(ing.productId)?.name} <span className="muted">— {ing.onlyForProfileIds!.map((pid) => profiles.find((p) => p.id === pid)?.name ?? pid).join(', ')}</span></span>
                <span className="nowrap">{ing.toTaste ? 'au goût' : formatQty(ing.quantity, ing.unit)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="small">Coût estimé : <strong>{formatMoney(round2(cost))}</strong>{!costKnown && <span className="muted"> (certains prix ou conversions manquent)</span>}</p>
      </section>

      <section className="card stack">
        <h2>Préparation</h2>
        <ol style={{ margin: 0, paddingLeft: 20 }} className="stack">{recipe.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        {!recipe.steps.length && <p className="muted small">Aucune étape.</p>}
        <p className="small muted">Cuisson : {recipe.cookingMethods.join(', ') || '—'}</p>
        {recipe.equipment?.length ? <p className="small">Matériel : {recipe.equipment.join(', ')}</p> : null}
        {recipe.variants && <p className="small"><strong>Variantes :</strong> {recipe.variants}</p>}
        {recipe.storage && <p className="small"><strong>Conservation :</strong> {recipe.storage}</p>}
        {recipe.nutrition && <p className="small"><strong>Nutrition :</strong> {recipe.nutrition}</p>}
        {recipe.notes && <p className="small muted">{recipe.notes}</p>}
      </section>

      <section className="card stack small">
        <h2>Compatibilité avec les profils</h2>
        {profiles.map((p) => {
          const v = checkMeal([recipe], p, products);
          return (
            <div key={p.id}>
              <span className={`badge ${v.length ? 'danger' : 'ok'}`}>{v.length ? 'Incompatible' : 'Compatible'}</span> {p.name}
              {v.map((x, i) => <div key={i} className="tiny muted">{x.message}</div>)}
            </div>
          );
        })}
      </section>

      <div className="btn-row">
        <button className="btn primary grow" onClick={() => setPlan({ date: on, slot: 'déjeuner' })}><CalendarPlus /> Planifier</button>
        <button className="btn grow" onClick={async () => { const r = await ui.run(() => duplicateRecipe(recipe.id), 'Recette dupliquée'); if (r) nav(`/recettes/${r.id}`); }}><Copy /> Dupliquer</button>
        <button className="btn danger grow" onClick={async () => {
          if (await ui.confirm(`Supprimer « ${recipe.name} » ?`, { danger: true, confirm: 'Supprimer' })) {
            const ok = await ui.run(() => deleteRecipe(recipe.id), 'Recette supprimée');
            if (ok !== undefined) nav('/recettes');
          }
        }}><Trash2 /> Supprimer</button>
      </div>

      <Sheet open={!!plan} onClose={() => setPlan(null)} title="Planifier ce plat"
        footer={<button className="btn primary block" onClick={() => plan && ui.run(() => createMeal({ date: plan.date, slot: plan.slot, recipeIds: [recipe.id] }), 'Ajouté au menu').then((m) => { if (m) { setPlan(null); nav(`/menus/repas/${m.id}`); } })}>Ajouter au menu</button>}>
        {plan && (
          <div className="grid2">
            <Field label="Date"><input type="date" value={plan.date} onChange={(e) => setPlan({ ...plan, date: e.target.value })} /></Field>
            <Field label="Repas"><select value={plan.slot} onChange={(e) => setPlan({ ...plan, slot: e.target.value as MealSlot })}>{SLOTS.map((s) => <option key={s} value={s}>{t.slots[s]}</option>)}</select></Field>
          </div>
        )}
      </Sheet>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Modifier la recette"
        footer={<button className="btn primary block" onClick={() => edit && ui.run(() => updateRecipe(recipe.id, edit), 'Recette enregistrée').then((r) => { if (r !== undefined) setEdit(null); })}>Enregistrer</button>}>
        {edit && <RecipeForm r={edit} onChange={setEdit} onAddIngredient={() => setPick(true)} />}
      </Sheet>
      <ProductPicker open={pick} onClose={() => setPick(false)} onPick={(p) => {
        setEdit((e) => e && { ...e, ingredients: [...e.ingredients, { productId: p.id, quantity: 1, unit: p.unit, role: 'autre', scaling: 'linéaire' }] });
        setPick(false);
      }} />
    </div>
  );
}

function RecipeForm({ r, onChange, onAddIngredient }: { r: Recipe; onChange: (r: Recipe) => void; onAddIngredient: () => void }) {
  const { productById } = useCatalog();
  const profiles = useLiveQuery(() => db.profiles.toArray(), []) ?? [];
  const families = useLiveQuery(async () => new Map((await db.families.toArray()).map((f) => [f.id, f])), []);
  const setIng = (i: number, patch: Partial<RecipeIngredient>) => onChange({ ...r, ingredients: r.ingredients.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  return (
    <div className="stack">
      <Field label="Nom"><input value={r.name} onChange={(e) => onChange({ ...r, name: e.target.value })} /></Field>
      <div className="grid2">
        <Field label="Catégorie"><input value={r.category} onChange={(e) => onChange({ ...r, category: e.target.value })} list="recipe-cats" /></Field>
        <Field label="Portions de référence"><NumberInput value={r.servings} onChange={(v) => onChange({ ...r, servings: v ?? 1 })} ariaLabel="Portions" /></Field>
      </div>
      <datalist id="recipe-cats">{['Plats', 'Féculents', 'Sauces', 'Poissons', 'Volailles', 'Viandes', 'Œufs', 'Légumineuses', 'Légumes', 'Petit-déjeuner', 'Boissons', 'Desserts'].map((c) => <option key={c} value={c} />)}</datalist>
      <div className="grid2">
        <Field label="Préparation (min)"><NumberInput value={r.prepMinutes} onChange={(v) => onChange({ ...r, prepMinutes: v ?? 0 })} ariaLabel="Préparation" /></Field>
        <Field label="Cuisson (min)"><NumberInput value={r.cookMinutes} onChange={(v) => onChange({ ...r, cookMinutes: v ?? 0 })} ariaLabel="Cuisson" /></Field>
      </div>
      <Field label="Difficulté">
        <select value={r.difficulty} onChange={(e) => onChange({ ...r, difficulty: e.target.value as Recipe['difficulty'] })}><option value="facile">Facile</option><option value="moyen">Moyen</option><option value="difficile">Difficile</option></select>
      </Field>
      <div className="stack" style={{ gap: 4 }}>
        <span className="small strong muted">Modes de cuisson</span>
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {METHODS.map((m) => <button key={m} className="chip" aria-pressed={r.cookingMethods.includes(m)} onClick={() => onChange({ ...r, cookingMethods: r.cookingMethods.includes(m) ? r.cookingMethods.filter((x) => x !== m) : [...r.cookingMethods, m] })}>{m}</button>)}
        </div>
      </div>
      <div className="stack">
        <span className="small strong muted">Ingrédients</span>
        {r.ingredients.map((ing, i) => (
          <div key={i} className="card tight stack" style={{ gap: 6 }}>
            <div className="row between"><span className="strong">{productById.get(ing.productId)?.name ?? ing.productId}</span><button className="btn small ghost" onClick={() => onChange({ ...r, ingredients: r.ingredients.filter((_, j) => j !== i) })}>Retirer</button></div>
            <div className="grid2">
              <NumberInput value={ing.quantity} onChange={(v) => setIng(i, { quantity: v ?? 0 })} ariaLabel="Quantité" />
              <select value={ing.unit} onChange={(e) => setIng(i, { unit: e.target.value as Unit })} aria-label="Unité">{ALL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            </div>
            <div className="grid2">
              <select value={ing.role} onChange={(e) => setIng(i, { role: e.target.value as IngredientRole })} aria-label="Rôle">{ROLES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
              <select value={ing.scaling} onChange={(e) => setIng(i, { scaling: e.target.value as ScalingMode })} aria-label="Mise à l’échelle">
                <option value="linéaire">Proportionnel</option><option value="modéré">Assaisonnement (atténué)</option><option value="fixe">Fixe</option>
              </select>
            </div>
            <div className="row wrap" style={{ gap: 12 }}>
              <label className="check small"><input type="checkbox" checked={!!ing.optional} onChange={(e) => setIng(i, { optional: e.target.checked })} /> Facultatif</label>
              <label className="check small"><input type="checkbox" checked={!!ing.toTaste} onChange={(e) => setIng(i, { toTaste: e.target.checked })} /> Au goût (non compté)</label>
              {(() => {
                const fam = families?.get(productById.get(ing.productId)?.familyId ?? '');
                return fam ? (
                  <label className="check small"><input type="checkbox" checked={!!ing.exactVariant} onChange={(e) => setIng(i, { exactVariant: e.target.checked || undefined })} /> Cette variante seulement (pas d’autre {fam.name.toLowerCase()})</label>
                ) : null;
              })()}
            </div>
            <select value={ing.onlyForProfileIds?.[0] ?? ''} onChange={(e) => setIng(i, { onlyForProfileIds: e.target.value ? [e.target.value] : undefined })} aria-label="Réservé à un profil">
              <option value="">Plat commun (tout le monde)</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>Seulement : {p.name} (par personne)</option>)}
            </select>
          </div>
        ))}
        <button className="btn soft" onClick={onAddIngredient}><Plus /> Ajouter un ingrédient</button>
      </div>
      <Field label="Étapes (une par ligne)"><textarea value={r.steps.join('\n')} onChange={(e) => onChange({ ...r, steps: e.target.value.split('\n') })} rows={5} /></Field>
      <Field label="Matériel (séparé par des virgules)"><input value={(r.equipment ?? []).join(', ')} onChange={(e) => onChange({ ...r, equipment: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
      <Field label="Variantes et substitutions"><textarea value={r.variants ?? ''} onChange={(e) => onChange({ ...r, variants: e.target.value || undefined })} /></Field>
      <Field label="Conservation et congélation"><textarea value={r.storage ?? ''} onChange={(e) => onChange({ ...r, storage: e.target.value || undefined })} /></Field>
      <Field label="Informations nutritionnelles" hint="Seulement si fiables (source à indiquer)"><textarea value={r.nutrition ?? ''} onChange={(e) => onChange({ ...r, nutrition: e.target.value || undefined })} /></Field>
      <Field label="Notes"><textarea value={r.notes ?? ''} onChange={(e) => onChange({ ...r, notes: e.target.value || undefined })} /></Field>
    </div>
  );
}
