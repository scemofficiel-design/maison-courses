import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ClipboardCopy, FileUp, Receipt } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { draftFor, importReceipt, linkToList, previewReceipt, purchasesElsewhere, type ListLink, type ReceiptLinePlan, type ReceiptPreview } from '../db/receiptOps';
import { normText, stockQuantityFor, type MatchConfidence } from '../domain/receipt';
import { buildReceiptPrompt } from '../domain/receiptPrompt';
import type { Product, ProductFamily, ReceiptImport, Unit } from '../domain/types';
import { ALL_UNITS, formatMoney, formatQty } from '../domain/units';
import { useCatalog } from '../ui/hooks';
import { Empty, Field, NumberInput, PageHead, Sheet, useUi } from '../ui/kit';

const CONFIDENCE: Record<MatchConfidence, { label: string; cls: string }> = {
  sûre: { label: 'Correspondance sûre', cls: 'ok' },
  probable: { label: 'Correspondance probable', cls: 'info' },
  'à vérifier': { label: 'À vérifier', cls: 'warn' },
  aucune: { label: 'Nouveau produit', cls: '' },
};

const UNCERTAIN_LABEL: Record<string, string> = {
  quantite: 'quantité', unite: 'unité', prixPaye: 'prix payé', prixTotal: 'prix', prixUnitaire: 'prix unitaire', rabais: 'rabais', format: 'format',
  nomRecu: 'nom', produit: 'produit', poids: 'poids',
};

const ACTION_LABEL: Record<ReceiptImport['lines'][number]['action'], string> = {
  ajouté: 'Ajouté au stock', créé: 'Produit créé', 'déjà compté': 'Déjà compté via la liste', ignoré: 'Non ajouté',
};

export default function ImportPage() {
  const ui = useUi();
  const { products, productById, categories, families, familyById } = useCatalog();
  const lists = useLiveQuery(() => db.lists.toArray(), []) ?? [];
  const history = useLiveQuery(() => db.receipts.orderBy('importedAt').reverse().toArray(), []) ?? [];
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string>();
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);
  const [plans, setPlans] = useState<ReceiptLinePlan[]>([]);
  const [listId, setListId] = useState('');
  const [links, setLinks] = useState<Map<number, ListLink>>(new Map());
  const [elsewhere, setElsewhere] = useState<Map<number, string>>(new Map());
  const [result, setResult] = useState<ReceiptImport | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [detail, setDetail] = useState<ReceiptImport | null>(null);

  // Rapprochement avec la liste choisie, recalculé à chaque changement de correspondance.
  useEffect(() => {
    let live = true;
    if (!preview) return;
    Promise.all([linkToList(listId || undefined, plans), purchasesElsewhere(plans, preview.receipt.date, listId || undefined)]).then(([l, e]) => {
      if (live) {
        setLinks(l);
        setElsewhere(e);
      }
    });
    return () => {
      live = false;
    };
  }, [preview, plans, listId]);

  const analyse = async (input: string, name?: string) => {
    const pv = await ui.run(() => previewReceipt(input, name));
    if (!pv) return;
    setPreview(pv);
    setPlans(pv.plans);
    setListId(pv.suggestedListId ?? '');
    setResult(null);
    window.scrollTo(0, 0);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    setFileName(file.name);
    setText(content);
    await analyse(content, file.name);
  };

  const update = (i: number, patch: Partial<ReceiptLinePlan>) => setPlans((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const missingQty = plans.filter((p) => p.choice !== 'ignorer' && p.stockQuantity === null).length;
  const counts = {
    existing: plans.filter((p) => p.choice === 'existant').length,
    create: plans.filter((p) => p.choice === 'créer').length,
    skip: plans.filter((p) => p.choice === 'ignorer').length,
  };

  const doImport = async () => {
    if (!preview) return;
    const list = lists.find((l) => l.id === listId);
    const ok = await ui.confirm('Importer ce reçu ?', {
      body: (
        <ul className="clean small">
          <li>{counts.existing} produit(s) existant(s) et {counts.create} nouveau(x) : quantités ajoutées au stock, jamais retirées.</li>
          {counts.skip > 0 && <li>{counts.skip} ligne(s) non ajoutée(s).</li>}
          <li>Derniers prix payés et historique des prix mis à jour.</li>
          {list ? <li>Liste « {list.name} » : articles cochés, sans double ajout au stock.</li> : <li>Aucune liste de courses associée.</li>}
        </ul>
      ),
      confirm: 'Importer',
    });
    if (!ok) return;
    const rec = await ui.run(() => importReceipt(preview, plans, { listId: listId || undefined }), 'Reçu importé');
    if (rec) {
      window.scrollTo(0, 0);
      setResult(rec);
      setPreview(null);
      setPlans([]);
      setText('');
      setFileName(undefined);
    }
  };

  const prompt = useMemo(() => (promptOpen ? buildReceiptPrompt(products, families, categories) : ''), [promptOpen, products, families, categories]);
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      ui.toast('Consignes copiées : collez-les dans ChatGPT avec la photo du reçu');
    } catch {
      ui.toast('Copie impossible : sélectionnez le texte et copiez-le manuellement', { error: true });
    }
  };

  const openLists = lists.filter((l) => l.status === 'à préparer' || l.status === 'en cours' || l.id === listId);

  return (
    <div className="stack">
      <PageHead back="/courses" title="Importer un reçu" sub="Ajoute vos achats au stock à partir d’un fichier JSON" />

      {result && <ImportResult rec={result} productById={productById} onAgain={() => setResult(null)} />}

      {!preview && !result && (
        <>
          <div className="card stack small">
            <strong>Comment faire</strong>
            <ol style={{ margin: 0, paddingLeft: 20 }} className="stack">
              <li>Touchez « Consignes pour ChatGPT », copiez le texte et collez-le dans ChatGPT avec la photo du reçu.</li>
              <li>Enregistrez la réponse (fichier <code>.json</code>) dans Fichiers, ou copiez-la.</li>
              <li>Choisissez le fichier ou collez le texte ici, vérifiez l’aperçu, puis importez.</li>
            </ol>
            <button className="btn soft" onClick={() => setPromptOpen(true)}><ClipboardCopy /> Consignes pour ChatGPT</button>
          </div>
          <label className="btn primary block" style={{ cursor: 'pointer' }}>
            <FileUp /> Choisir le fichier du reçu
            <input type="file" accept=".json,application/json,text/plain" style={{ display: 'none' }} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <Field label="… ou collez le contenu du fichier">
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder='{ "format": "maison-courses-recu", … }' rows={5} spellCheck={false} autoCapitalize="off" autoCorrect="off" />
          </Field>
          <button className="btn block" disabled={!text.trim()} onClick={() => analyse(text, fileName)}>Analyser</button>
        </>
      )}

      {preview && (
        <>
          <div className={`card stack small ${preview.duplicateOf ? 'danger' : ''}`}>
            <div className="row between wrap">
              <strong className="row"><Receipt size={18} /> {preview.receipt.store ?? 'Magasin inconnu'}</strong>
              <span>{preview.receipt.date}{preview.receipt.time ? ` · ${preview.receipt.time}` : ''}</span>
            </div>
            <div className="row between wrap">
              <span>{preview.receipt.items.length} article(s)</span>
              <span>Total : <strong>{formatMoney(preview.receipt.total, preview.receipt.currency)}</strong>{preview.receipt.totalDiscount ? ` · rabais ${formatMoney(preview.receipt.totalDiscount, preview.receipt.currency)}` : ''}</span>
            </div>
            {preview.duplicateOf && (
              <p className="strong row"><AlertTriangle size={18} /> Ce reçu a déjà été importé le {new Date(preview.duplicateOf.importedAt).toLocaleDateString('fr-CA')}. Il ne peut pas être importé une seconde fois.</p>
            )}
            {preview.similar.length > 0 && <p>⚠️ Un autre reçu du même magasin, du même jour et du même total a déjà été importé. Vérifiez qu’il ne s’agit pas du même.</p>}
            {[...preview.warnings, ...preview.receipt.uncertainties].map((w, i) => <p key={i} className="muted">• {w}</p>)}
          </div>

          <Field label="Liste de courses associée" hint="Les articles prévus sont cochés ; un achat déjà coché en magasin n’est pas ajouté une seconde fois au stock.">
            <select value={listId} onChange={(e) => setListId(e.target.value)}>
              <option value="">Aucune</option>
              {openLists.map((l) => <option key={l.id} value={l.id}>{l.name}{l.id === preview.suggestedListId ? ' (suggérée)' : ''}</option>)}
            </select>
          </Field>

          <div className="row wrap small">
            <span className="badge ok">{counts.existing} existant(s)</span>
            <span className="badge primary">{counts.create} à créer</span>
            {counts.skip > 0 && <span className="badge">{counts.skip} non ajouté(s)</span>}
            {missingQty > 0 && <span className="badge danger">{missingQty} quantité(s) à préciser</span>}
          </div>

          {plans.map((plan, i) => (
            <PlanCard key={plan.item.index} plan={plan} onChange={(patch) => update(i, patch)} products={products} productById={productById}
              categories={categories} families={families} familyName={(id) => familyById.get(id)?.name}
              link={links.get(plan.item.index)} elsewhere={elsewhere.get(plan.item.index)} />
          ))}

          <div className="btn-row">
            <button className="btn grow" onClick={() => { setPreview(null); setPlans([]); }}>Annuler</button>
            <button className="btn primary grow" disabled={!!preview.duplicateOf || missingQty > 0} onClick={doImport}>Importer</button>
          </div>
          {missingQty > 0 && <p className="tiny muted">Indiquez les quantités manquantes ou choisissez « Ne pas ajouter au stock » pour ces lignes.</p>}
        </>
      )}

      <section>
        <div className="section-title"><h2>Reçus importés</h2><span className="small muted">{history.length}</span></div>
        {history.length === 0 ? <Empty icon="🧾" title="Aucun reçu importé" /> : (
          <div className="list">
            {history.map((r) => (
              <button key={r.id} className="item clickable" onClick={() => setDetail(r)}>
                <span className="grow">
                  <span className="title">{r.store ?? 'Magasin inconnu'} · {r.date}</span>
                  <div className="meta">{r.lines.filter((l) => l.action !== 'ignoré').length} article(s) ajouté(s) · {formatMoney(r.total, r.currency)}{r.listId ? ` · ${lists.find((l) => l.id === r.listId)?.name ?? 'liste'}` : ''}</div>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <Sheet open={promptOpen} onClose={() => setPromptOpen(false)} title="Consignes pour ChatGPT"
        footer={<button className="btn primary block" onClick={copyPrompt}><ClipboardCopy /> Copier les consignes</button>}>
        <p className="small muted">Elles décrivent le format du fichier et contiennent la liste de vos produits, pour que ChatGPT indique la bonne correspondance. Joignez la photo du reçu au même message.</p>
        <textarea readOnly value={prompt} rows={10} style={{ fontSize: 13, fontFamily: 'ui-monospace, monospace' }} onFocus={(e) => e.currentTarget.select()} />
      </Sheet>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.store ?? 'Reçu'} · ${detail.date}` : ''}>
        {detail && (
          <>
            <p className="small muted">Importé le {new Date(detail.importedAt).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}{detail.fileName ? ` · ${detail.fileName}` : ''}</p>
            <ImportLines rec={detail} productById={productById} />
          </>
        )}
      </Sheet>
    </div>
  );
}

function PlanCard({ plan, onChange, products, productById, categories, families, familyName, link, elsewhere }: {
  plan: ReceiptLinePlan;
  onChange: (patch: Partial<ReceiptLinePlan>) => void;
  products: Product[];
  productById: Map<string, Product>;
  categories: { id: string; name: string; icon: string }[];
  families: ProductFamily[];
  familyName: (id: string) => string | undefined;
  link?: ListLink;
  elsewhere?: string;
}) {
  const { item, match } = plan;
  const p = plan.productId ? productById.get(plan.productId) : undefined;
  const unit: Unit | undefined = plan.choice === 'existant' ? p?.unit : plan.choice === 'créer' ? plan.create?.unit : undefined;
  const conf = CONFIDENCE[match.confidence];
  const familyFirst = useMemo(() => {
    const fam = match.familyId;
    const active = products.filter((x) => !x.archived);
    return { same: fam ? active.filter((x) => x.familyId === fam) : [], others: fam ? active.filter((x) => x.familyId !== fam) : active };
  }, [products, match.familyId]);

  const choose = (value: string) => {
    if (value === '__skip') return onChange({ choice: 'ignorer' });
    if (value === '__new') {
      const create = plan.create ?? draftFor(item, match, families, categories[0]?.id ?? 'cat-menager');
      return onChange({ choice: 'créer', create, stockQuantity: stockQuantityFor(item, create) });
    }
    const np = productById.get(value);
    if (np) onChange({ choice: 'existant', productId: np.id, stockQuantity: stockQuantityFor(item, np), rememberName: !np.receiptNames?.includes(normText(item.receiptName)) });
  };
  const setCreate = (patch: Partial<NonNullable<ReceiptLinePlan['create']>>) => {
    const create = { ...plan.create!, ...patch };
    onChange({ create, ...(patch.unit ? { stockQuantity: stockQuantityFor(item, create) } : {}) });
  };

  const bought = [
    item.quantity !== null && item.unit ? formatQty(item.quantity, item.unit) : null,
    item.format?.label,
    item.weight ? formatQty(item.weight.quantity, item.weight.unit) : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={`card stack ${plan.choice === 'ignorer' ? 'flat' : ''}`} style={{ gap: 10, opacity: plan.choice === 'ignorer' ? 0.75 : 1 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="strong ellipsis">{item.receiptName}</div>
          <div className="small muted">{bought || 'Quantité non indiquée'}</div>
        </div>
        <div className="right small">
          <div className="strong">{formatMoney(item.paid)}</div>
          {item.discount ? <div className="tiny" style={{ color: 'var(--ok)' }}>rabais −{formatMoney(item.discount)}</div> : null}
        </div>
      </div>
      <div className="row wrap" style={{ gap: 4 }}>
        {plan.choice !== 'ignorer' && <span className={`badge ${conf.cls}`} title={match.reason}>{conf.label}</span>}
        {item.uncertain.length > 0 && <span className="badge warn">Incertain : {item.uncertain.map((u) => UNCERTAIN_LABEL[u] ?? u).join(', ')}</span>}
        {item.illegible && <span className="badge danger">Illisible</span>}
        {item.isReturn && <span className="badge danger">Retour</span>}
        {item.confidence === 'faible' && <span className="badge warn">Lecture peu sûre</span>}
      </div>
      {(item.note || item.problems.length > 0) && <div className="tiny muted">{[item.note, ...item.problems].filter(Boolean).join(' · ')}</div>}

      <Field label="Produit dans l’application">
        <select value={plan.choice === 'ignorer' ? '__skip' : plan.choice === 'créer' ? '__new' : plan.productId ?? ''} onChange={(e) => choose(e.target.value)}>
          <option value="__skip">Ne pas ajouter au stock</option>
          <option value="__new">➕ Créer un nouveau produit</option>
          {familyFirst.same.length > 0 && (
            <optgroup label={`Famille ${familyName(match.familyId!) ?? ''}`}>
              {familyFirst.same.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </optgroup>
          )}
          <optgroup label="Tous les produits">
            {familyFirst.others.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </optgroup>
        </select>
      </Field>
      {plan.choice !== 'ignorer' && <div className="tiny muted">{match.reason}</div>}

      {plan.choice === 'créer' && plan.create && (
        <div className="stack" style={{ gap: 8 }}>
          <Field label="Nom du nouveau produit"><input value={plan.create.name} onChange={(e) => setCreate({ name: e.target.value })} /></Field>
          <div className="grid2">
            <Field label="Famille">
              <select value={plan.create.familyId ?? (plan.create.newFamilyName !== undefined ? '__new' : '')} onChange={(e) => {
                const v = e.target.value;
                const fam = families.find((f) => f.id === v);
                setCreate({ familyId: fam?.id, newFamilyName: v === '__new' ? plan.create!.newFamilyName ?? item.productRef.family ?? '' : undefined, ...(fam ? { categoryId: fam.categoryId } : {}) });
              }}>
                <option value="">Aucune</option>
                {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                <option value="__new">➕ Nouvelle famille…</option>
              </select>
            </Field>
            <Field label="Variante"><input value={plan.create.variant ?? ''} onChange={(e) => setCreate({ variant: e.target.value || undefined })} /></Field>
          </div>
          {plan.create.newFamilyName !== undefined && !plan.create.familyId && (
            <Field label="Nom de la nouvelle famille"><input value={plan.create.newFamilyName} onChange={(e) => setCreate({ newFamilyName: e.target.value })} /></Field>
          )}
          <div className="grid2">
            <Field label="Catégorie">
              <select value={plan.create.categoryId} onChange={(e) => setCreate({ categoryId: e.target.value })}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </Field>
            <Field label="Unité de stock">
              <select value={plan.create.unit} onChange={(e) => setCreate({ unit: e.target.value as Unit })}>
                {ALL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          {plan.create.conversions?.map((c) => <div key={c.to} className="tiny muted">Conversion reprise du format : 1 {c.unit} = {formatQty(c.amount, c.to)}</div>)}
        </div>
      )}

      {plan.choice !== 'ignorer' && unit && (
        <>
          <Field label={`Ajouter au stock (${unit})`} hint={plan.stockQuantity === null ? `Correspondance inconnue entre ce qui est acheté et l’unité « ${unit} » : indiquez la quantité.` : undefined}>
            <NumberInput value={plan.stockQuantity} onChange={(v) => onChange({ stockQuantity: v })} ariaLabel={`Quantité à ajouter : ${item.receiptName}`} />
          </Field>
          {plan.choice === 'existant' && p && plan.stockQuantity !== null && (
            <div className="tiny muted">
              Stock actuel : {p.quantity === null ? 'inconnu' : formatQty(p.quantity, p.unit)} →{' '}
              {p.quantity === null ? `au moins ${formatQty((link?.toAdd ?? plan.stockQuantity), p.unit)}` : formatQty(p.quantity + (link?.toAdd ?? plan.stockQuantity), p.unit)}
            </div>
          )}
          {link && (
            <div className="tiny" style={{ color: 'var(--primary)' }}>
              Liste : « {link.line.name} » {link.line.status === 'acheté' ? 'déjà cochée' : 'sera cochée'}
              {link.alreadyCounted > 0 ? ` · ${formatQty(link.alreadyCounted, unit)} déjà compté(s) en stock, ajout de ${formatQty(link.toAdd, unit)}` : ''}
            </div>
          )}
          {!link && elsewhere && <div className="tiny" style={{ color: 'var(--warn)' }}>⚠️ Déjà coché comme acheté sur « {elsewhere} » : associez cette liste pour ne pas l’ajouter deux fois.</div>}
          <label className="check small" style={{ minHeight: 32 }}>
            <input type="checkbox" checked={plan.rememberName} onChange={(e) => onChange({ rememberName: e.target.checked })} /> Reconnaître « {item.receiptName} » la prochaine fois
          </label>
        </>
      )}
    </div>
  );
}

function ImportLines({ rec, productById }: { rec: ReceiptImport; productById: Map<string, Product> }) {
  return (
    <div className="list">
      {rec.lines.map((l) => {
        const p = l.productId ? productById.get(l.productId) : undefined;
        return (
          <div key={l.index} className="item">
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="title ellipsis">{p ? <Link to={`/stocks/${p.id}`}>{p.name}</Link> : l.receiptName}</span>
              <div className="meta">{l.receiptName} · {ACTION_LABEL[l.action]}{l.quantityAdded > 0 && l.unit ? ` : +${formatQty(l.quantityAdded, l.unit)}` : ''}{l.note ? ` · ${l.note}` : ''}</div>
            </span>
            <span className="small nowrap">{formatMoney(l.paid)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ImportResult({ rec, productById, onAgain }: { rec: ReceiptImport; productById: Map<string, Product>; onAgain: () => void }) {
  const added = rec.lines.filter((l) => l.quantityAdded > 0).length;
  return (
    <div className="stack">
      <div className="card ok stack small">
        <strong>Reçu importé</strong>
        <span>{added} produit(s) ajouté(s) au stock, {rec.lines.filter((l) => l.action === 'créé').length} créé(s), {rec.lines.filter((l) => l.action === 'déjà compté').length} déjà compté(s) via la liste.</span>
        <span className="muted">Une erreur ? Chaque ajout peut être corrigé depuis l’historique de la fiche produit.</span>
      </div>
      <ImportLines rec={rec} productById={productById} />
      <div className="btn-row">
        <Link className="btn grow" to="/stocks">Voir les stocks</Link>
        <button className="btn primary grow" onClick={onAgain}>Importer un autre reçu</button>
      </div>
    </div>
  );
}
