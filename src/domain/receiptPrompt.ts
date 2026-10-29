import { RECEIPT_FORMAT, RECEIPT_FORMAT_VERSION } from './receipt';
import type { Category, Product, ProductFamily } from './types';
import { ALL_UNITS } from './units';

/** Exemple minimal, identique dans son principe à `examples/recu-exemple.json`. */
export const RECEIPT_EXAMPLE = {
  format: RECEIPT_FORMAT,
  version: RECEIPT_FORMAT_VERSION,
  recu: { date: '2026-10-28', heure: '14:32', magasin: 'Maxi', succursale: null, numero: '0042-118', devise: 'CAD', sousTotal: 17.46, taxes: 0, total: 17.46, rabaisTotal: 1.5 },
  articles: [
    {
      nomRecu: 'RAISIN VERT S/PEP',
      produit: { id: null, nom: 'Raisins verts', famille: 'Raisins', variante: 'verts sans pépins', marque: null, categorie: 'Fruits' },
      quantite: 1, unite: 'barquette', format: { libelle: 'barquette 907 g', contenance: { quantite: 907, unite: 'g' } }, poids: null,
      prixUnitaire: 5.99, prixTotal: 5.99, rabais: 1.5, prixPaye: 4.49, incertain: [], illisible: false, confiance: 'haute', note: null,
    },
    {
      nomRecu: 'YOG NAT 0% 750G',
      produit: { id: 'p-yaourt', nom: 'Yaourt nature 0 %', famille: 'Yaourts', variante: 'nature 0 %', marque: null, categorie: 'Produits laitiers' },
      quantite: 2, unite: 'pot', format: { libelle: 'pot 750 g', contenance: { quantite: 750, unite: 'g' } }, poids: null,
      prixUnitaire: 3.49, prixTotal: 6.98, rabais: null, prixPaye: 6.98, incertain: [], illisible: false, confiance: 'haute', note: null,
    },
    {
      nomRecu: 'BANANE PLANTAIN',
      produit: { id: 'p-plantain', nom: 'Banane plantain', famille: 'Banane plantain', variante: null, marque: null, categorie: 'Féculents et céréales' },
      quantite: 4, unite: 'unité', format: null, poids: { quantite: 1.32, unite: 'kg' },
      prixUnitaire: null, prixTotal: 5.99, rabais: null, prixPaye: 5.99, incertain: ['quantite'], illisible: false, confiance: 'moyenne',
      note: 'Nombre de bananes déduit de la photo, à vérifier',
    },
  ],
  incertitudes: ['Le nom de la succursale n’est pas lisible'],
};

/**
 * Consignes à coller dans ChatGPT avec la photo du reçu. Elles contiennent la liste des produits
 * de l'application pour que l'assistant puisse indiquer l'identifiant correspondant.
 */
export function buildReceiptPrompt(products: Product[], families: ProductFamily[], categories: Category[]): string {
  const famName = new Map(families.map((f) => [f.id, f.name]));
  const catalog = products
    .filter((p) => !p.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map((p) => {
      const bits = [p.id, p.name, p.familyId ? `famille ${famName.get(p.familyId) ?? ''}` : '', p.variant ? `variante ${p.variant}` : '', `unité ${p.unit}`, p.format ? `format ${p.format}` : '', p.brand ? `marque ${p.brand}` : ''];
      return `- ${bits.filter(Boolean).join(' | ')}`;
    })
    .join('\n');
  return `Analyse la photo de reçu de caisse jointe et réponds UNIQUEMENT par un fichier JSON valide (sans texte autour), au format « ${RECEIPT_FORMAT} » version ${RECEIPT_FORMAT_VERSION}, pour l'application Maison & Courses.

Règles :
1. Un objet par ligne d'article du reçu, dans l'ordre du reçu. Ne regroupe pas deux lignes, n'invente aucun article.
2. « nomRecu » : le texte exact imprimé sur le reçu.
3. « produit.id » : l'identifiant du produit de ma liste ci-dessous s'il correspond clairement, sinon null. Remplis aussi « nom », « famille », « variante », « marque » et « categorie » (catégories possibles : ${categories.map((c) => c.name).join(', ')}).
4. « quantite » et « unite » : nombre d'articles achetés et unité pratique (${ALL_UNITS.join(', ')}). Pour un article pesé, mets le nombre d'articles s'il est visible et le poids dans « poids » ({ "quantite": 0.912, "unite": "kg" }) ; les livres (lb) sont acceptées.
5. « format » : format d'achat (« pack de 4 », « grappe », « sac 2 kg »…) avec « contenance » seulement si elle est imprimée sur le reçu ou visible ({ "quantite": 4, "unite": "pot" } ou { "quantite": 2, "unite": "kg" }). Ne devine jamais une contenance.
6. Prix en nombres avec un point décimal : « prixUnitaire », « prixTotal » (avant rabais), « rabais » (positif), « prixPaye » (après rabais). Mets null pour ce qui n'est pas lisible. Associe chaque rabais à l'article concerné.
7. Tout ce qui est incertain va dans « incertain » (liste de noms de champs, ex. ["quantite", "prixPaye"]) ; une ligne illisible a « illisible »: true. « confiance » : "haute", "moyenne" ou "faible". Les remarques générales vont dans « incertitudes ».
8. Date au format AAAA-MM-JJ, heure HH:MM, devise (CAD par défaut).
9. Ignore les lignes de taxes, de consigne de bouteilles, de sacs de caisse et de paiement, sauf si ce sont des produits à stocker.

Structure attendue (exemple) :
${JSON.stringify(RECEIPT_EXAMPLE, null, 2)}

Mes produits (identifiant | nom | famille | variante | unité | format) :
${catalog}
`;
}
