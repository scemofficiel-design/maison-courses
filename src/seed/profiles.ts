import type { DietProfile, DietRule, Person } from '../domain/types';
import { GM_PRESCRIPTION_SOURCE, TO_CONFIRM } from './planDocument';
import { PROFILE_GM, PROFILE_MOI, PROFILE_NOUS } from './recipes';

type SeedProfile = Omit<DietProfile, 'createdAt' | 'updatedAt'>;
type SeedPerson = Omit<Person, 'createdAt' | 'updatedAt'>;

const P1 = 'Plan PDF p. 1 — principe';
const P3M = 'Plan PDF p. 3 — méthode pour les repas communs';
const P3C = 'Plan PDF p. 3 — choix prudents en attente de confirmation';

const rule = (id: string, r: Omit<DietRule, 'id'>): DietRule => ({ id, ...r });

/** Modes de cuisson autorisés pour GM. « poêle sans huile » couvre l'omelette sans huile, nommée comme autorisée. */
export const GM_METHODS = ['eau', 'braise', 'vapeur', 'four', 'papillote', 'cru', 'poêle sans huile'];

export const PROFILES: SeedProfile[] = [
  {
    id: PROFILE_GM,
    seedKey: `profile:${PROFILE_GM}`,
    name: 'Grand-mère — prescription du plan familial',
    description: 'Règles et portions de la prescription de GM reprises du document fourni pour ce foyer. Ce ne sont pas des règles médicales générales.',
    hasPrescription: true,
    portionFactors: {},
    portionRules: [
      { role: 'féculent', label: 'Féculent 150 g cuit', amount: 150, unit: 'g', state: 'cuit', slots: ['déjeuner'], prescription: true, source: P1 },
      { role: 'féculent', label: 'Riz 180 g cuit', amount: 180, unit: 'g', state: 'cuit', slots: ['déjeuner'], whenProductId: 'p-riz', prescription: true, source: P1 },
      { role: 'protéine', label: 'Poisson ou poulet 150 g (midi et soir)', amount: 150, unit: 'g', state: 'cuit', slots: ['déjeuner', 'dîner'], prescription: true, source: P3M },
      { role: 'féculent', label: 'Au dîner : 1/3 de pain complet ou 3 tranches de pain complet ou de son', slots: ['dîner'], prescription: true, source: P3M },
    ],
    plateAdditions: [
      { slot: 'dîner', productId: 'p-pain', quantity: 1 / 3, unit: 'pain', label: '1/3 de pain complet' },
    ],
    rules: [
      rule('gm-eau', { kind: 'hydratation', label: 'Au moins 2 L d’eau par jour, un verre avant chaque repas', prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-rythme', { kind: 'note', label: 'Au moins 3 repas à heures régulières, activité physique régulière', prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-collations', { kind: 'collation', label: 'Collations de 10 h et 16 h : un fruit ou un yaourt 0 %', prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-cuisson', { kind: 'cuisson', label: 'Cuisson à l’eau, à la braise, à la vapeur, au four ou en papillote', allowedMethods: GM_METHODS, prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-huile-jour', { kind: 'limite', label: 'Huile végétale : 2 c. à soupe par jour au maximum, tous repas confondus', limitTag: 'huile', max: 30, unit: 'ml', per: 'jour', prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-huile-repas', { kind: 'limite', label: '1 c. à soupe d’huile d’olive au plus par repas (plat commun)', limitTag: 'huile', max: 15, unit: 'ml', per: 'repas', source: P1 }),
      rule('gm-sel', { kind: 'préparation', label: 'Sel : une pincée seulement après la cuisson', prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-plat-commun', { kind: 'préparation', label: 'Plat commun cuit sans sel, sans cube, sans peau', source: P1 }),
      rule('gm-ev-viandes', { kind: 'éviter', label: 'Viandes grasses (mouton, porc, canard, pattes ou queue de bœuf)', tags: ['viande-grasse'], prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-ev-poissons', { kind: 'éviter', label: 'Poissons gras (machoiron, maquereau, hareng)', tags: ['poisson-gras'], prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-ev-oeuf-huile', { kind: 'éviter', label: 'Œuf ou omelette à l’huile', tags: ['œuf-huile'], prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-ev-charcuterie', { kind: 'éviter', label: 'Charcuterie', tags: ['charcuterie'], prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-ev-conserves', { kind: 'éviter', label: 'Conserves de légumes ou de poisson', tags: ['conserve'], prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-ev-fruits', { kind: 'éviter', label: 'Coco, cacahuète, datte, raisin sec, avocat, banane douce', tags: ['coco', 'cacahuète', 'datte', 'raisin-sec', 'avocat', 'banane-douce'], prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-ev-laitages', { kind: 'éviter', label: 'Lait ou yaourt entier, crème fraîche, fromage', tags: ['lait-entier', 'crème', 'fromage'], prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-ev-graisses', { kind: 'éviter', label: 'Beurre, saindoux, mayonnaise', tags: ['beurre', 'saindoux', 'mayonnaise'], prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-ev-fritures', { kind: 'éviter', label: 'Fritures', tags: ['friture'], prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-ev-sucres', { kind: 'éviter', label: 'Sucre, miel, confiture, glace, chocolat', tags: ['sucre', 'miel', 'confiture', 'glace', 'chocolat', 'cacao'], prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-ev-patisseries', { kind: 'éviter', label: 'Pâtisseries', tags: ['pâtisserie'], prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-ev-boissons', { kind: 'éviter', label: 'Boissons sucrées, jus du commerce', tags: ['boisson-sucrée', 'jus-commerce'], prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-prudence-sodium', { kind: 'éviter', label: 'Par prudence (sodium) : cubes, sauce soya et moutarde exclus du plat commun', tags: ['cube', 'sauce-soya', 'moutarde'], source: P3C }),
      rule('gm-prudence-palme', { kind: 'éviter', label: 'Huile de palme rouge : hors du plat de GM (riche en graisses saturées)', tags: ['huile-palme'], source: P3C }),
      rule('gm-nous-seulement', { kind: 'éviter', label: 'Réservés à nos assiettes : lentilles, noix, graines, patate douce', tags: ['lentilles', 'noix', 'graines', 'patate-douce'], source: 'Plan PDF p. 3 — substitutions et § 5' }),
      rule('gm-autorise-proteines', { kind: 'autorisé', label: 'Protéines : veau, bœuf (filet), poulet sans peau, pintade, tous les poissons sauf les gras, œuf dur ou omelette sans huile, crevette, crabe', prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-autorise-feculents', { kind: 'autorisé', label: 'Féculents : riz, spaghetti, plantain, igname, attiéké, pomme de terre', prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-autorise-fruits', { kind: 'autorisé', label: 'Fruits : orange, pomme, papaye, ananas, mangue, poire, mandarine, clémentine, raisin frais, pastèque', prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-autorise-laitages', { kind: 'autorisé', label: 'Laitages : lait écrémé ou demi-écrémé, yaourt 0 %, fromage blanc maigre', prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-autorise-legumes', { kind: 'autorisé', label: 'Légumes : aubergine, tomate, gombo, feuilles, concombre, poireau, endive, navet, haricot vert, petit pois surgelé, carotte, haricot sec, oignon…', prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-autorise-autres', { kind: 'autorisé', label: 'Édulcorants ; eau, jus de fruit nature', prescription: true, source: GM_PRESCRIPTION_SOURCE }),
      rule('gm-subst-maquereau', { kind: 'substitution', label: 'Maquereau (poisson gras) remplacé par le tilapia', source: 'Plan PDF p. 3 — substitutions' }),
      rule('gm-subst-conserves', { kind: 'substitution', label: 'Thon, champignons et haricots rouges en boîte remplacés par des haricots secs cuits à la maison', source: 'Plan PDF p. 3 — substitutions' }),
      ...TO_CONFIRM.map((t, n) => rule(`gm-confirmer-${n + 1}`, { kind: 'à confirmer', label: t, source: 'Plan PDF p. 3 — à faire confirmer au diététicien' })),
    ],
    notes:
      'Points à faire confirmer au diététicien (choix prudents appliqués en attendant) : voir les règles « à confirmer ».\n' +
      'Ambiguïtés relevées lors de l’importation :\n' +
      '• « 1/3 de pain complet » (p. 1) / « 1/3 de pain complet ou 3 tranches de pain complet ou de son » (p. 3) : la taille du pain n’est pas précisée.\n' +
      '• Les portions de féculent et de protéine sont données en poids cuit ; les recettes sont exprimées en poids cru (quantités indicatives, sauf le poulet : 800 g cru pour 3 portions de 150 g cuites selon le document).\n' +
      '• « Foutou banane » interprété comme foutou de banane plantain (la banane douce est à éviter).\n' +
      '• « Bouillie de riz (300 g) » : il n’est pas précisé s’il s’agit du poids de bouillie ou de riz.',
  },
  {
    id: PROFILE_NOUS,
    seedKey: `profile:${PROFILE_NOUS}`,
    name: 'Nous — ma mère et moi',
    description: 'Même plat que GM, portions de féculent plus grandes, assaisonnements à l’assiette.',
    portionFactors: { féculent: 1.5 },
    portionRules: [
      { role: 'féculent', label: 'Féculent 200 à 250 g', amount: 200, amountMax: 250, unit: 'g', slots: ['déjeuner'], source: P3M },
      { role: 'protéine', label: 'Même protéine que GM', source: P3M },
      { role: 'féculent', label: 'Au dîner : le reste de féculent du midi ou une patate douce', slots: ['dîner'], source: P1 },
    ],
    plateAdditions: [],
    rules: [
      rule('nous-assiette', { kind: 'préparation', label: 'Sel, Maggi, piment, huile de palme et avocat dans notre assiette seulement', source: P1 }),
      rule('nous-collations', { kind: 'collation', label: 'Collations de 10 h et 16 h : à volonté', source: 'Plan PDF p. 1' }),
      rule('nous-eau', { kind: 'hydratation', label: 'Eau : au moins 2 L par jour, 1 verre avant chaque repas', source: 'Plan PDF p. 1' }),
    ],
    notes:
      'Multiplicateur de féculent 1,5 : hypothèse de calcul (225 g, milieu de 200–250 g, rapporté aux 150 g de la portion de GM), utilisée uniquement pour estimer les quantités. Modifiable.\n' +
      'Le féculent du midi est cuit en plus grande quantité pour notre dîner (document) : ce surplus n’est pas ajouté automatiquement.',
  },
  {
    id: PROFILE_MOI,
    seedKey: `profile:${PROFILE_MOI}`,
    name: 'Moi — ajouts personnels',
    description: 'Ajouts propres à « moi » mentionnés dans le document.',
    portionFactors: {},
    portionRules: [],
    plateAdditions: [],
    rules: [rule('moi-oeuf', { kind: 'note', label: 'Petit-déjeuner pain complet + œuf : 2e œuf pour moi', source: 'Plan PDF p. 1 — petit-déjeuner' })],
  },
];

export const PERSONS: SeedPerson[] = [
  { id: 'person-gm', seedKey: 'person:gm', name: 'Grand-mère', active: true, profileIds: [PROFILE_GM], likes: [], dislikes: [], allergies: [], notes: 'Aucun âge, poids ou diagnostic n’est indiqué dans le document.' },
  { id: 'person-moi', seedKey: 'person:moi', name: 'Moi', active: true, profileIds: [PROFILE_NOUS, PROFILE_MOI], likes: [], dislikes: [], allergies: [] },
  { id: 'person-mere', seedKey: 'person:mere', name: 'Ma mère', active: true, profileIds: [PROFILE_NOUS], likes: [], dislikes: [], allergies: [] },
];
