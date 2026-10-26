import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { createRecipe } from '../db/entityOps';
import { checkMeal } from '../domain/restrictions';
import { norm } from '../ui/hooks';
import { Empty, PageHead, SearchBox, useUi } from '../ui/kit';

export default function RecipesPage() {
  const ui = useUi();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [profileId, setProfileId] = useState('');
  const data = useLiveQuery(async () => {
    const [recipes, profiles, products] = await Promise.all([db.recipes.toArray(), db.profiles.toArray(), db.products.toArray()]);
    return { recipes: recipes.sort((a, b) => a.name.localeCompare(b.name, 'fr')), profiles, products: new Map(products.map((p) => [p.id, p])) };
  }, []);
  const cats = useMemo(() => [...new Set((data?.recipes ?? []).map((r) => r.category))].sort(), [data]);
  const shown = useMemo(() => {
    if (!data) return [];
    const n = norm(q);
    const prof = data.profiles.find((p) => p.id === profileId);
    return data.recipes
      .filter((r) => (!cat || r.category === cat) && (!n || norm(r.name).includes(n) || r.ingredients.some((i) => norm(data.products.get(i.productId)?.name ?? '').includes(n))))
      .map((r) => ({ r, violations: prof ? checkMeal([r], prof, data.products) : [] }));
  }, [data, q, cat, profileId]);

  const create = async () => {
    const r = await ui.run(() => createRecipe({ name: 'Nouvelle recette' }));
    if (r) nav(`/recettes/${r.id}?edit=1`);
  };

  return (
    <div className="stack">
      <PageHead back="/plus" title="Recettes" sub={`${data?.recipes.length ?? 0} recettes`} actions={<Link className="btn small soft" to="/suggestions"><Sparkles /> Avec mes stocks</Link>} />
      <SearchBox value={q} onChange={setQ} placeholder="Recette ou ingrédient" />
      <div className="chips" role="group" aria-label="Catégories">
        <button className="chip" aria-pressed={!cat} onClick={() => setCat('')}>Toutes</button>
        {cats.map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <select value={profileId} onChange={(e) => setProfileId(e.target.value)} aria-label="Vérifier la compatibilité avec un profil">
        <option value="">Compatibilité : tous profils confondus</option>
        {data?.profiles.map((p) => <option key={p.id} value={p.id}>Compatible avec : {p.name}</option>)}
      </select>
      {data && !shown.length && <Empty icon="🍲" title="Aucune recette" />}
      <div className="list">
        {shown.map(({ r, violations }) => (
          <Link key={r.id} to={`/recettes/${r.id}`} className="item">
            <span className="grow">
              <span className="title">{r.name}</span>
              <div className="meta">{r.category} · {r.prepMinutes + r.cookMinutes} min · {r.servings} portions{r.quantitySource !== 'indicatif' ? ` · quantités ${r.quantitySource}` : ''}</div>
            </span>
            {profileId && (violations.length ? <span className="badge danger">Incompatible</span> : <span className="badge ok">Compatible</span>)}
          </Link>
        ))}
      </div>
      <button className="fab" aria-label="Nouvelle recette" onClick={create}><Plus /></button>
    </div>
  );
}
