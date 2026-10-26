/**
 * Transcription du document « Plan_alimentaire_familial_8_semaines.pdf » (3 pages, octobre 2026).
 *
 * Ce fichier ne contient QUE ce qui figure dans le document, recopié tel quel
 * (libellés, quantités, prix). Les interprétations nécessaires pour relier ces
 * données aux recettes sont isolées dans `menuMapping.ts` et signalées dans le
 * rapport de vérification (`verify.ts`).
 */

export const DOCUMENT_NAME = 'Plan_alimentaire_familial_8_semaines.pdf';

// ---------------------------------------------------------------------------
// Page 1 — menus
// ---------------------------------------------------------------------------

/** Pour chaque semaine, 7 jours (lundi → dimanche) : [midi, soir], libellés exacts du tableau. */
export const MENU_WEEKS: [string, string][][] = [
  // S1 (P1)
  [
    ['Riz · sauce claire · tilapia au four', 'Salade composée · poulet braisé'],
    ['Attiéké · tilapia braisé · tomate-concombre', 'Haricots secs · poulet braisé'],
    ['Foutou banane · sauce gombo · tilapia', 'Carottes râpées · 2 œufs durs'],
    ['Igname · sauce tomate-aubergine · poulet', 'Brocoli · tilapia au four'],
    ['Riz · sauce aubergine-tomate · poulet', 'Omelette sans huile · salade'],
    ['Foutou igname · sauce feuilles · tilapia', 'Carottes râpées · poulet braisé'],
    ['Igname bouillie · sauce légumes · poulet braisé', 'Haricots verts · poulet'],
  ],
  // S2 (P1)
  [
    ['Spaghetti · sauce tomate · tilapia', 'Courgettes-poivron vapeur · poulet'],
    ['Riz · sauce épinards · tilapia', 'Haricots secs · légumes vapeur · poulet'],
    ['Plantain bouilli · sauce tomate · tilapia', 'Salade composée · œufs durs'],
    ['Riz · poulet au four · haricots verts', 'Haricots verts · tilapia papillote'],
    ['Plantain bouilli · poulet braisé · salade', 'Poivrons-courgettes vapeur · œufs durs'],
    ['Riz · sauce claire · tilapia au four', 'Haricots verts · poulet'],
    ['Riz · sauce légumes · poulet au four', 'Salade tomate-concombre · poulet'],
  ],
  // S3 (P2)
  [
    ['Riz · tilapia braisé · carottes', 'Haricots verts · poulet au four'],
    ['Attiéké · tilapia au four · salade', 'Haricots secs · poulet au four'],
    ['Foutou banane · sauce gombo · tilapia', 'Courgettes vapeur · œufs durs'],
    ['Igname · sauce épinards · poulet', 'Brocoli · tilapia au four'],
    ['Attiéké · poulet au four · haricots verts', 'Carottes râpées · œufs durs'],
    ['Igname · sauce gombo · tilapia', 'Salade composée · poulet au four'],
    ['Plantain · sauce épinards · poulet', 'Courgettes-aubergine · poulet'],
  ],
  // S4 (P2)
  [
    ['Pommes de terre · tilapia papillote · haricots verts', 'Carottes râpées · poulet braisé'],
    ['Igname · sauce tomate · tilapia', 'Haricots secs · salade · poulet'],
    ['Riz · sauce gombo · tilapia', 'Aubergines au four · œufs durs'],
    ['Pommes de terre · poulet braisé · carottes', 'Courgettes · tilapia papillote'],
    ['Spaghetti · sauce tomate · poulet', 'Aubergine-tomate au four · œufs durs'],
    ['Attiéké · tilapia braisé · tomates', 'Brocoli · poulet'],
    ['Attiéké · poulet braisé · salade', 'Carottes · poulet braisé'],
  ],
  // S5 (P3)
  [
    ['Spaghetti · sauce tomate · tilapia', 'Courgettes-poivron vapeur · poulet'],
    ['Attiéké · tilapia au four · salade', 'Haricots secs · poulet au four'],
    ['Riz · sauce gombo · tilapia', 'Aubergines au four · œufs durs'],
    ['Riz · poulet au four · haricots verts', 'Haricots verts · tilapia papillote'],
    ['Attiéké · poulet au four · haricots verts', 'Carottes râpées · œufs durs'],
    ['Attiéké · tilapia braisé · tomates', 'Brocoli · poulet'],
    ['Riz · sauce légumes · poulet au four', 'Salade tomate-concombre · poulet'],
  ],
  // S6 (P3)
  [
    ['Riz · tilapia braisé · carottes', 'Haricots verts · poulet au four'],
    ['Igname · sauce tomate · tilapia', 'Haricots secs · salade · poulet'],
    ['Foutou banane · sauce gombo · tilapia', 'Carottes râpées · 2 œufs durs'],
    ['Igname · sauce épinards · poulet', 'Brocoli · tilapia au four'],
    ['Spaghetti · sauce tomate · poulet', 'Aubergine-tomate au four · œufs durs'],
    ['Foutou igname · sauce feuilles · tilapia', 'Carottes râpées · poulet braisé'],
    ['Plantain · sauce épinards · poulet', 'Courgettes-aubergine · poulet'],
  ],
  // S7 (P4)
  [
    ['Pommes de terre · tilapia papillote · haricots verts', 'Carottes râpées · poulet braisé'],
    ['Attiéké · tilapia braisé · tomate-concombre', 'Haricots secs · poulet braisé'],
    ['Plantain bouilli · sauce tomate · tilapia', 'Salade composée · œufs durs'],
    ['Pommes de terre · poulet braisé · carottes', 'Courgettes · tilapia papillote'],
    ['Riz · sauce aubergine-tomate · poulet', 'Omelette sans huile · salade'],
    ['Riz · sauce claire · tilapia au four', 'Haricots verts · poulet'],
    ['Attiéké · poulet braisé · salade', 'Carottes · poulet braisé'],
  ],
  // S8 (P4)
  [
    ['Riz · sauce claire · tilapia au four', 'Salade composée · poulet braisé'],
    ['Riz · sauce épinards · tilapia', 'Haricots secs · légumes vapeur · poulet'],
    ['Foutou banane · sauce gombo · tilapia', 'Courgettes vapeur · œufs durs'],
    ['Igname · sauce tomate-aubergine · poulet', 'Brocoli · tilapia au four'],
    ['Plantain bouilli · poulet braisé · salade', 'Poivrons-courgettes vapeur · œufs durs'],
    ['Igname · sauce gombo · tilapia', 'Salade composée · poulet au four'],
    ['Igname bouillie · sauce légumes · poulet braisé', 'Haricots verts · poulet'],
  ],
];

/** Petit-déjeuner identique chaque semaine (+ 1 fruit pour tous). Jours : 0 = lundi. */
export const BREAKFASTS: { days: number[]; common: string; gm: string; nous: string }[] = [
  { days: [0, 3], common: 'Flocons d’avoine (1 bol)', gm: 'Édulcorant, ni sucre ni miel', nous: '+ yaourt 0 %, noix ou graines' },
  { days: [1, 4], common: 'Pain complet (2 tr.) + œuf dur ou au plat sans huile', gm: 'Sans huile', nous: '+ avocat, 2e œuf (moi)' },
  { days: [2, 6], common: 'Bouillie de riz (300 g)', gm: 'Édulcorant, lait demi-écrémé ou eau', nous: '+ lait, banane' },
  { days: [5], common: 'Pain complet (2 tr.) + yaourt nature 0 %', gm: 'Yaourt 0 % seulement', nous: '+ fromage blanc, graines' },
];

export const SNACKS_TEXT = 'Collations à 10 h et 16 h : 1 fruit ou 1 yaourt 0 % pour GM ; à volonté pour nous.';
export const WATER_TEXT = 'Eau : au moins 2 L par jour, 1 verre avant chaque repas.';

export const PAGE1_PRINCIPLE =
  'Un seul plat de base pour tout le monde, cuit sans sel, sans cube, sans peau, avec 1 c. à soupe d’huile d’olive au plus par repas. ' +
  'GM : les portions de sa prescription (féculent 150 g cuit, riz 180 g ; poisson ou poulet 150 g) + une pincée de sel après cuisson. ' +
  'Nous : le même plat, avec plus de féculent (200 à 250 g), puis sel, Maggi, piment, huile de palme et avocat dans notre assiette seulement. ' +
  'Au dîner, GM prend les mêmes légumes et la même protéine avec 1/3 de pain complet ; nous ajoutons le reste de féculent du midi ou une patate douce.';

export const PAGE1_FOOTNOTE =
  'Tous les midis sont des repas communs : même plat, portions adaptées. Poisson (tilapia) : lun, mar, mer, sam à midi et jeu soir ; ' +
  'poulet sans peau : jeu, ven, dim à midi et 4 soirs ; œufs durs (ou omelette sans huile) : mer et ven soir. ' +
  'Plantain, igname, attiéké, riz, pomme de terre et spaghetti tournent d’une semaine à l’autre. Plats au four, à la braise, à la vapeur ou en papillote uniquement.';

// ---------------------------------------------------------------------------
// Page 2 — courses et budget
// ---------------------------------------------------------------------------

export type DocGroup = 'Légumes' | 'Fruits' | 'Protéines' | 'Féculents' | 'Produits laitiers' | 'Condiments, huiles, assaisonnements' | 'Autres produits';

export interface DocShoppingRow {
  /** Libellé exact du document. */
  label: string;
  group: DocGroup;
  prio: 'E' | 'O';
  /** Libellés de quantité P1..P4 tels qu'imprimés ; « - » = rien à acheter. */
  qty: [string, string, string, string];
  /** Montants P1..P4 en $ CA ; null = « - ». */
  price: [number | null, number | null, number | null, number | null];
  /** « * » : produit absent de la liste de référence, prix estimé. */
  estimatedStar: boolean;
}

const r = (
  label: string,
  group: DocGroup,
  prio: 'E' | 'O',
  qty: [string, string, string, string],
  price: [number | null, number | null, number | null, number | null],
): DocShoppingRow => ({ label: label.replace(/ \*$/, ''), group, prio, qty, price, estimatedStar: label.endsWith(' *') });

export const SHOPPING_ROWS: DocShoppingRow[] = [
  r('Ail (têtes)', 'Légumes', 'E', ['5', '5', '5', '5'], [3.75, 3.75, 3.75, 3.75]),
  r('Aubergines', 'Légumes', 'E', ['2', '6', '6', '2'], [1.5, 4.5, 4.5, 1.5]),
  r('Brocoli (têtes)', 'Légumes', 'E', ['2', '3', '3', '2'], [5.0, 7.5, 7.5, 5.0]),
  r('Carottes', 'Légumes', 'E', ['16', '21', '16', '21'], [6.4, 8.4, 6.4, 8.4]),
  r('Citrons', 'Légumes', 'E', ['9', '9', '10', '8'], [3.78, 3.78, 4.2, 3.36]),
  r('Concombres', 'Légumes', 'E', ['6', '5', '4', '7'], [4.02, 3.35, 2.68, 4.69]),
  r('Courgettes', 'Légumes', 'E', ['7', '6', '5', '8'], [5.25, 4.5, 3.75, 6.0]),
  r('Gingembre (morceaux)', 'Légumes', 'E', ['3', '3', '3', '3'], [2.25, 2.25, 2.25, 2.25]),
  r('Gombo surgelé (paquet 300 g) *', 'Légumes', 'E', ['1', '3', '2', '2'], [3.5, 10.5, 7.0, 7.0]),
  r('Haricots verts', 'Légumes', 'E', ['2 kg', '1,5 kg', '2 kg', '1,5 kg'], [6.68, 5.01, 6.68, 5.01]),
  r('Oignons', 'Légumes', 'E', ['14', '14', '14', '14'], [7.0, 7.0, 7.0, 7.0]),
  r('Poivrons', 'Légumes', 'E', ['9', '5', '3', '11'], [5.67, 3.15, 1.89, 6.93]),
  r('Salade verte (bottes)', 'Légumes', 'E', ['3', '2', '-', '5'], [7.5, 5.0, null, 12.5]),
  r('Tomates grosses', 'Légumes', 'E', ['33', '24', '26', '31'], [18.81, 13.68, 14.82, 17.67]),
  r('Épinards frais (sacs)', 'Légumes', 'E', ['2', '2', '3', '1'], [7.0, 7.0, 10.5, 3.5]),

  r('Avocats (nous seulement)', 'Fruits', 'E', ['8', '8', '8', '8'], [8.0, 8.0, 8.0, 8.0]),
  r('Bananes (nous seulement)', 'Fruits', 'E', ['14', '14', '14', '14'], [5.88, 5.88, 5.88, 5.88]),
  r('Clémentines *', 'Fruits', 'E', ['10', '10', '10', '10'], [3.0, 3.0, 3.0, 3.0]),
  r('Oranges', 'Fruits', 'E', ['20', '20', '20', '20'], [8.6, 8.6, 8.6, 8.6]),
  r('Pommes *', 'Fruits', 'E', ['14', '14', '14', '14'], [8.4, 8.4, 8.4, 8.4]),
  r('Mangues (si saison)', 'Fruits', 'O', ['3', '3', '3', '3'], [3.99, 3.99, 3.99, 3.99]),
  r('Poires', 'Fruits', 'O', ['6', '6', '6', '6'], [4.02, 4.02, 4.02, 4.02]),

  r('Haricots secs *', 'Protéines', 'E', ['0,5 kg', '0,5 kg', '0,5 kg', '0,5 kg'], [1.95, 1.95, 1.95, 1.95]),
  r('Oeufs (douzaines)', 'Protéines', 'E', ['48 (4 dz)', '48 (4 dz)', '48 (4 dz)', '48 (4 dz)'], [18.0, 18.0, 18.0, 18.0]),
  r('Poulet cuisses/pilons, sans peau', 'Protéines', 'E', ['11,2 kg', '11,2 kg', '11,2 kg', '11,2 kg'], [95.2, 95.2, 95.2, 95.2]),
  r('Tilapia surgelé', 'Protéines', 'E', ['5,4 kg', '5,4 kg', '5,4 kg', '5,4 kg'], [67.5, 67.5, 67.5, 67.5]),
  r('Lentilles sèches (nous seulement)', 'Protéines', 'O', ['0,5 kg', '0,5 kg', '0,5 kg', '0,5 kg'], [2.0, 2.0, 2.0, 2.0]),
  r('Thon naturel, boîtes (nous seulement)', 'Protéines', 'O', ['3', '3', '3', '3'], [5.01, 5.01, 5.01, 5.01]),

  r('Attiéké', 'Féculents', 'E', ['1 kg', '3 kg', '2 kg', '1,5 kg'], [8.0, 24.0, 16.0, 12.0]),
  r('Banane plantain *', 'Féculents', 'E', ['12', '8', '8', '12'], [15.0, 10.0, 10.0, 15.0]),
  r('Flocons d’avoine', 'Féculents', 'E', ['1 kg', '1 kg', '1 kg', '1 kg'], [8.0, 8.0, 8.0, 8.0]),
  r('Igname', 'Féculents', 'E', ['3 kg', '3 kg', '3 kg', '3 kg'], [12.0, 12.0, 12.0, 12.0]),
  r('Pain complet tranché (pains) *', 'Féculents', 'E', ['4', '4', '4', '4'], [14.0, 14.0, 14.0, 14.0]),
  r('Patates douces (nous seulement)', 'Féculents', 'E', ['6', '6', '6', '6'], [6.0, 6.0, 6.0, 6.0]),
  r('Pommes de terre *', 'Féculents', 'E', ['-', '2 kg', '-', '2 kg'], [null, 4.0, null, 4.0]),
  r('Riz basmati', 'Féculents', 'E', ['3 kg', '2 kg', '2 kg', '2 kg'], [15.0, 10.0, 10.0, 10.0]),
  r('Spaghetti *', 'Féculents', 'E', ['0,45 kg', '0,45 kg', '0,9 kg', '-'], [2.2, 2.2, 4.4, null]),

  r('Lait demi-écrémé', 'Produits laitiers', 'E', ['2 L', '2 L', '2 L', '2 L'], [5.0, 5.0, 5.0, 5.0]),
  r('Yaourt nature 0 % (pot 750 g) *', 'Produits laitiers', 'E', ['7', '7', '7', '7'], [24.5, 24.5, 24.5, 24.5]),
  r('Fromage blanc 0 % (500 g)', 'Produits laitiers', 'O', ['1', '1', '1', '1'], [4.5, 4.5, 4.5, 4.5]),

  r('Cubes Maggi (nous, à table)', 'Condiments, huiles, assaisonnements', 'E', ['1', '-', '1', '-'], [2.0, null, 2.0, null]),
  r('Huile d’olive (bouteille)', 'Condiments, huiles, assaisonnements', 'E', ['1', '1', '1', '1'], [7.0, 7.0, 7.0, 7.0]),
  r('Huile de palme rouge (nous, à table)', 'Condiments, huiles, assaisonnements', 'E', ['1', '-', '-', '-'], [4.0, null, null, null]),
  r('Moutarde naturelle', 'Condiments, huiles, assaisonnements', 'E', ['1', '-', '1', '-'], [3.0, null, 3.0, null]),
  r('Épices de base (sel, poivre, thym)', 'Condiments, huiles, assaisonnements', 'E', ['1', '-', '1', '-'], [3.0, null, 3.0, null]),
  r('Piment', 'Condiments, huiles, assaisonnements', 'O', ['1', '-', '1', '-'], [2.0, null, 2.0, null]),
  r('Sauce soya réduite en sel (nous)', 'Condiments, huiles, assaisonnements', 'O', ['1', '-', '-', '-'], [3.5, null, null, null]),
  r('Vinaigre de cidre', 'Condiments, huiles, assaisonnements', 'O', ['1', '-', '-', '-'], [3.5, null, null, null]),
  r('Épices extra (paprika, cumin)', 'Condiments, huiles, assaisonnements', 'O', ['1', '-', '-', '-'], [3.0, null, null, null]),

  r('Bissap sec (200 g)', 'Autres produits', 'E', ['1', '1', '1', '1'], [4.0, 4.0, 4.0, 4.0]),
  r('Édulcorant (stévia ou Canderel) *', 'Autres produits', 'E', ['1', '-', '1', '-'], [6.0, null, 6.0, null]),
  r('Graines de chia ou lin 150 g (nous)', 'Autres produits', 'O', ['1', '-', '1', '-'], [4.0, null, 4.0, null]),
  r('Noix non salées 200 g (nous)', 'Autres produits', 'O', ['1', '1', '1', '1'], [5.0, 5.0, 5.0, 5.0]),
];

/** Sous-totaux par groupe tels qu'imprimés (P1..P4), utilisés pour vérifier l'importation. */
export const GROUP_SUBTOTALS: Record<DocGroup, [number, number, number, number]> = {
  Légumes: [88.11, 89.37, 82.92, 94.56],
  Fruits: [41.89, 41.89, 41.89, 41.89],
  Protéines: [189.66, 189.66, 189.66, 189.66],
  Féculents: [80.2, 90.2, 80.4, 81.0],
  'Produits laitiers': [34.0, 34.0, 34.0, 34.0],
  'Condiments, huiles, assaisonnements': [31.0, 7.0, 17.0, 7.0],
  'Autres produits': [19.0, 9.0, 19.0, 9.0],
};

export const BUDGET_TARGET: [number, number, number, number] = [483.86, 461.12, 464.87, 457.11];
export const BUDGET_TARGET_TOTAL = 1866.96;
export const BUDGET_ECONOMY: [number, number, number, number] = [429.1, 421.99, 423.35, 414.74];
export const BUDGET_ECONOMY_TOTAL = 1689.18;
export const ECONOMY_DEFINITION = 'Version économique : essentiels seulement, et œufs durs au lieu du poulet les lundis et samedis soir.';

export const PAGE2_HEADER =
  'Quantités totales à acheter pour 3 personnes pendant 2 semaines (arrondies à l’unité vendue), calculées à partir des menus ; chaque ingrédient est compté une seule fois. ' +
  'E = essentiel, O = optionnel. Prix en $ CA : ceux de votre liste de référence, non revérifiés en magasin ; * = produit absent de la liste, prix estimé.';

// ---------------------------------------------------------------------------
// Page 3 — règles pratiques et optimisation
// ---------------------------------------------------------------------------

export const GM_PRESCRIPTION_SOURCE = 'Plan PDF p. 3 — prescription de GM (menu du 07/09/2026)';

export const BUDGET_SUMMARY = {
  target: { total: 1866.96, perPeriod: 466.74, perWeek: 233.37, perPersonWeek: 77.79 },
  economy: { total: 1689.18, perPeriod: 422.3, perWeek: 211.15, perPersonWeek: 70.38 },
  optionalRemovable: { averagePerPeriod: 30.02, p1: 40.52, total: 120.08 },
  economySaving: 177.78,
  pantryP1Saving: 34.0,
  comparison:
    'Multiplier mécaniquement le budget initial (254 $ pour 2 personnes) par 1,5 donnerait 381,00 $ par période, soit 1524,00 $ sur 8 semaines. ' +
    'Le total est plus élevé parce que la prescription de GM fixe 150 g de poisson ou de poulet à chaque repas (midi et soir), ce qui fait des protéines le premier poste (environ 189,66 $ par période).',
  disclaimer: 'Aucun montant n’est garanti : les prix n’ont pas été vérifiés en magasin.',
};

export const OPTIMIZATION_PRINCIPLES: string[] = [
  'Un pot, zéro sel : poulet sans peau, sauce tomate-oignon-ail-gingembre et légumes cuits sans sel, sans cube et sans sauce soya, avec 1 c. à soupe d’huile d’olive par repas. Dans l’assiette de GM : une pincée de sel. Dans les nôtres : sel, Maggi, piment, huile de palme.',
  'Portions : on sert d’abord GM (féculent 150 g cuit, riz 180 g ; protéine 150 g), puis nous : même protéine, féculent 200 à 250 g. Le féculent du midi est cuit en plus grande quantité pour notre dîner ; GM prend 1/3 de pain complet ou 3 tranches de pain complet ou de son.',
  'Cuisiner moins souvent : cuire deux repas à la fois (poulet au four, œufs durs, haricots secs sans sel) ; congeler en portions de trois les repas du jeudi au dimanche ; décongeler le poisson et le poulet au frigo la veille.',
  'Éviter le gaspillage : semaine 1 de chaque période : épinards, salade, gombo, brocoli ; semaine 2 : carottes, courgettes, aubergines, haricots verts (surgelés si besoin), plantain, igname.',
  'Garde-manger : huile de palme, moutarde, cubes, épices, piment, soya, vinaigre, édulcorant et graines ne sont achetés qu’en P1 (et en P3 pour certains) : ne rien racheter s’il en reste. Si vous les avez déjà, P1 baisse de 34,00 $.',
  'Autres leviers : yaourt nature en pot de 750 g, légumes surgelés (haricots verts, brocoli), poisson surgelé en sac, cuisses de poulet en format familial si le prix au kilo est inférieur à 8,50 $. Aucune économie chiffrée sur ces points tant que les prix ne sont pas vérifiés en magasin.',
];

export const TO_CONFIRM: string[] = [
  'Lentilles : citées dans son menu (vendredi soir) mais absentes des aliments autorisés. Remplacées par des haricots secs, clairement autorisés.',
  'Patate douce : non nommée (la pomme de terre l’est). Réservée à nos assiettes.',
  'Brocoli, salade, courgette, poivron, épinards : la liste des légumes se termine par des points de suspension ; le brocoli et la salade composée figurent dans son menu, donc inclus.',
  'Poudre de cacao (petit-déjeuner de son menu) alors que le chocolat est exclu : non incluse.',
  'Huile de palme rouge : huile végétale mais riche en graisses saturées : hors du plat de GM.',
  'Sodium : cubes, sauce soya et moutarde exclus du plat commun par prudence.',
  'Œufs : 2 dîners par semaine plus 2 petits-déjeuners ; alternance poisson/poulet à midi (son menu est surtout au poisson).',
];

export const HYPOTHESES =
  'Aucune cible calorique ni objectif de poids ajoutés ; condiments à acheter en P1 faute d’inventaire du garde-manger ; tilapia et poulet surgelés ; poulet compté avec os, sans peau (environ 800 g cru pour 3 portions de 150 g cuites).';
