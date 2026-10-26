import type { IngredientRole, QuantitySource, Recipe, RecipeIngredient, Unit } from '../domain/types';

/**
 * Bibliothèque de recettes de départ.
 *
 * Les menus du document nomment des plats (« Riz · sauce claire · tilapia au four ») sans
 * donner de recettes ni de quantités par plat. Chaque élément du menu est donc relié à une
 * recette simple ci-dessous. Origine des quantités (champ `quantitySource`) :
 * - « déduit du document » : calculé à partir des totaux ou hypothèses du PDF
 *   (poulet 800 g cru pour 3 portions ; tilapia 5,4 kg pour 10 repas = 540 g ; haricots secs 0,5 kg pour 2 repas) ;
 * - « indicatif » : quantité de départ raisonnable, NON issue du document, à ajuster.
 * Les recettes sont pour 3 portions de référence (la portion de GM).
 */

export const PROFILE_GM = 'prof-gm';
export const PROFILE_NOUS = 'prof-nous';
export const PROFILE_MOI = 'prof-moi';

type Opt = Partial<Pick<RecipeIngredient, 'scaling' | 'optional' | 'toTaste' | 'onlyForProfileIds' | 'note'>>;
const i = (productId: string, quantity: number, unit: Unit, role: IngredientRole, o: Opt = {}): RecipeIngredient => ({
  productId,
  quantity,
  unit,
  role,
  scaling: o.scaling ?? (role === 'assaisonnement' ? 'modéré' : 'linéaire'),
  ...o,
});

const oil = (note = '1 c. à soupe d’huile d’olive au plus pour tout le repas (plat commun).') =>
  i('p-huile-olive', 1, 'c. à soupe', 'matière grasse', { toTaste: true, scaling: 'fixe', note });
const spices = () => i('p-epices', 1, 'pincée', 'assaisonnement', { toTaste: true, note: 'Poivre et thym dans la cuisson ; le sel seulement après cuisson, à l’assiette.' });
const nousSeasoning = () =>
  i('p-maggi', 1, 'pincée', 'assaisonnement', { toTaste: true, onlyForProfileIds: [PROFILE_NOUS], note: 'Sel, Maggi, piment, huile de palme : dans notre assiette seulement.' });

interface R extends Omit<Recipe, 'createdAt' | 'updatedAt' | 'seedKey' | 'tags' | 'servings' | 'difficulty'> {
  tags?: string[];
  servings?: number;
  difficulty?: Recipe['difficulty'];
}

const recipe = (r: R): Omit<Recipe, 'createdAt' | 'updatedAt'> => ({
  servings: 3,
  difficulty: 'facile',
  tags: [],
  ...r,
  seedKey: `recipe:${r.id}`,
});

const IND: QuantitySource = 'indicatif';
const DED: QuantitySource = 'déduit du document';

export const RECIPES: Omit<Recipe, 'createdAt' | 'updatedAt'>[] = [
  // ------------------------------------------------------------------ Féculents
  recipe({
    id: 'r-riz', name: 'Riz blanc à l’eau', category: 'Féculents', prepMinutes: 5, cookMinutes: 15, cookingMethods: ['eau'],
    ingredients: [i('p-riz', 250, 'g', 'féculent', { note: 'Quantité crue indicative. Portion de GM : riz 180 g cuit (document).' })],
    steps: ['Rincer le riz.', 'Cuire à l’eau sans sel (environ 2 volumes d’eau pour 1 de riz) 12 à 15 min.', 'Servir d’abord GM (180 g cuit), puis les autres portions.'],
    storage: 'Se conserve au réfrigérateur dans une boîte fermée ; réchauffer à cœur.', quantitySource: IND, tags: ['africain', 'international'],
  }),
  recipe({
    id: 'r-attieke', name: 'Attiéké réchauffé à la vapeur', category: 'Féculents', prepMinutes: 5, cookMinutes: 10, cookingMethods: ['vapeur'],
    ingredients: [i('p-attieke', 450, 'g', 'féculent', { note: 'Portion de GM : 150 g (document) ; 450 g pour 3 portions de référence.' })],
    steps: ['Égrener l’attiéké.', 'Réchauffer 10 min à la vapeur, sans huile ni sel.'], quantitySource: IND, tags: ['africain'],
  }),
  recipe({
    id: 'r-foutou-banane', name: 'Foutou banane (plantain)', category: 'Féculents', prepMinutes: 10, cookMinutes: 25, difficulty: 'moyen', cookingMethods: ['eau'],
    ingredients: [i('p-plantain', 4, 'unité', 'féculent')],
    steps: ['Éplucher les bananes plantain et les couper en tronçons.', 'Cuire à l’eau sans sel 20 à 25 min.', 'Piler jusqu’à obtenir une pâte lisse.'],
    notes: 'Le document écrit « foutou banane » : interprété comme banane plantain (la banane douce est à éviter pour GM). À confirmer.',
    quantitySource: IND, tags: ['africain'],
  }),
  recipe({
    id: 'r-foutou-igname', name: 'Foutou igname', category: 'Féculents', prepMinutes: 10, cookMinutes: 25, difficulty: 'moyen', cookingMethods: ['eau'],
    ingredients: [i('p-igname', 750, 'g', 'féculent')],
    steps: ['Éplucher et couper l’igname.', 'Cuire à l’eau sans sel 20 à 25 min.', 'Piler jusqu’à obtenir une pâte élastique.'], quantitySource: IND, tags: ['africain'],
  }),
  recipe({
    id: 'r-igname', name: 'Igname bouillie', category: 'Féculents', prepMinutes: 10, cookMinutes: 20, cookingMethods: ['eau'],
    ingredients: [i('p-igname', 750, 'g', 'féculent')],
    steps: ['Éplucher, couper en morceaux.', 'Cuire à l’eau sans sel 20 min environ.'], quantitySource: IND, tags: ['africain'],
  }),
  recipe({
    id: 'r-plantain', name: 'Plantain bouilli', category: 'Féculents', prepMinutes: 5, cookMinutes: 20, cookingMethods: ['eau'],
    ingredients: [i('p-plantain', 3, 'unité', 'féculent')],
    steps: ['Couper les extrémités et inciser la peau.', 'Cuire à l’eau sans sel 20 min.', 'Éplucher et servir.'], quantitySource: IND, tags: ['africain'],
  }),
  recipe({
    id: 'r-spaghetti', name: 'Spaghetti', category: 'Féculents', prepMinutes: 2, cookMinutes: 10, cookingMethods: ['eau'],
    ingredients: [i('p-spaghetti', 225, 'g', 'féculent')],
    steps: ['Cuire dans un grand volume d’eau sans sel selon le paquet.', 'Égoutter.'], quantitySource: IND, tags: ['international'],
  }),
  recipe({
    id: 'r-pdt', name: 'Pommes de terre à l’eau', category: 'Féculents', prepMinutes: 10, cookMinutes: 20, cookingMethods: ['eau'],
    ingredients: [i('p-pdt', 600, 'g', 'féculent')],
    steps: ['Éplucher et couper en morceaux réguliers.', 'Cuire à l’eau sans sel 15 à 20 min.'], quantitySource: IND, tags: ['international'],
  }),
  recipe({
    id: 'r-alloco', name: 'Alloco (plantain frit)', category: 'Féculents', prepMinutes: 10, cookMinutes: 10, cookingMethods: ['friture'],
    ingredients: [i('p-plantain', 3, 'unité', 'féculent'), i('p-huile-friture', 1, 'bouteille', 'matière grasse', { toTaste: true, scaling: 'fixe' })],
    steps: ['Couper les bananes plantain bien mûres en rondelles.', 'Frire dans l’huile chaude jusqu’à coloration.', 'Égoutter sur du papier absorbant.'],
    notes: 'Friture : incompatible avec les règles de cuisson de GM. Recette de bibliothèque, absente du plan.', quantitySource: IND, tags: ['africain'],
  }),

  // ------------------------------------------------------------------ Sauces (sans sel ni cube)
  recipe({
    id: 'r-sauce-claire', name: 'Sauce claire', category: 'Sauces', prepMinutes: 15, cookMinutes: 30, cookingMethods: ['eau'],
    ingredients: [
      i('p-tomate', 3, 'unité', 'sauce'), i('p-aubergine', 1, 'unité', 'sauce'), i('p-oignon', 1, 'unité', 'sauce'),
      i('p-ail', 0.25, 'tête', 'assaisonnement'), i('p-gingembre', 0.5, 'morceau', 'assaisonnement'), oil(), spices(), nousSeasoning(),
    ],
    steps: ['Faire bouillir les légumes entiers dans 1 L d’eau 15 min.', 'Les écraser et les remettre dans le bouillon avec l’ail et le gingembre.', 'Ajouter le poisson ou la viande et laisser mijoter 15 min, sans sel ni cube.', 'Saler à l’assiette.'],
    quantitySource: IND, tags: ['africain'],
  }),
  recipe({
    id: 'r-sauce-tomate', name: 'Sauce tomate', category: 'Sauces', prepMinutes: 10, cookMinutes: 25, cookingMethods: ['eau'],
    ingredients: [i('p-tomate', 5, 'unité', 'sauce'), i('p-oignon', 1, 'unité', 'sauce'), i('p-ail', 0.25, 'tête', 'assaisonnement'), i('p-gingembre', 0.5, 'morceau', 'assaisonnement'), oil(), spices(), nousSeasoning()],
    steps: ['Mixer tomates, oignon, ail et gingembre.', 'Cuire à feu doux 20 à 25 min avec un peu d’eau et la cuillère d’huile.', 'Sans sel ni cube ; assaisonner à l’assiette.'],
    quantitySource: IND, tags: ['africain', 'international'],
  }),
  recipe({
    id: 'r-sauce-gombo', name: 'Sauce gombo', category: 'Sauces', prepMinutes: 10, cookMinutes: 30, cookingMethods: ['eau'],
    ingredients: [i('p-gombo', 300, 'g', 'sauce'), i('p-tomate', 2, 'unité', 'sauce'), i('p-oignon', 1, 'unité', 'sauce'), i('p-ail', 0.25, 'tête', 'assaisonnement'), oil(), spices(), nousSeasoning()],
    steps: ['Cuire tomates et oignon dans un peu d’eau 10 min.', 'Ajouter le gombo (encore surgelé) et laisser mijoter 20 min.', 'Ajouter le poisson pour les 10 dernières minutes.'],
    quantitySource: IND, tags: ['africain'],
  }),
  recipe({
    id: 'r-sauce-tomate-aubergine', name: 'Sauce tomate-aubergine', category: 'Sauces', prepMinutes: 15, cookMinutes: 30, cookingMethods: ['eau'],
    ingredients: [i('p-tomate', 4, 'unité', 'sauce'), i('p-aubergine', 2, 'unité', 'sauce'), i('p-oignon', 1, 'unité', 'sauce'), i('p-ail', 0.25, 'tête', 'assaisonnement'), i('p-gingembre', 0.5, 'morceau', 'assaisonnement'), oil(), spices(), nousSeasoning()],
    steps: ['Couper les aubergines en dés, mixer tomates et oignon.', 'Cuire le tout à feu doux 30 min avec un fond d’eau et la cuillère d’huile.'],
    notes: 'Correspond aux libellés « sauce tomate-aubergine » et « sauce aubergine-tomate » du document.', quantitySource: IND, tags: ['africain'],
  }),
  recipe({
    id: 'r-sauce-feuilles', name: 'Sauce feuilles', category: 'Sauces', prepMinutes: 15, cookMinutes: 30, cookingMethods: ['eau'],
    ingredients: [i('p-epinards', 1, 'sac', 'sauce'), i('p-tomate', 2, 'unité', 'sauce'), i('p-oignon', 1, 'unité', 'sauce'), i('p-ail', 0.25, 'tête', 'assaisonnement'), oil(), spices(), nousSeasoning()],
    steps: ['Laver et hacher les feuilles.', 'Cuire tomates et oignon 10 min, ajouter les feuilles et laisser mijoter 20 min.'],
    notes: 'Le document ne précise pas les feuilles : épinards utilisés (seules feuilles de la liste de courses). À confirmer.', quantitySource: IND, tags: ['africain'],
  }),
  recipe({
    id: 'r-sauce-legumes', name: 'Sauce légumes', category: 'Sauces', prepMinutes: 15, cookMinutes: 25, cookingMethods: ['eau'],
    ingredients: [i('p-tomate', 3, 'unité', 'sauce'), i('p-carotte', 2, 'unité', 'sauce'), i('p-courgette', 1, 'unité', 'sauce'), i('p-poivron', 1, 'unité', 'sauce'), i('p-oignon', 1, 'unité', 'sauce'), oil(), spices(), nousSeasoning()],
    steps: ['Couper les légumes en dés.', 'Cuire dans la sauce tomate-oignon avec un fond d’eau 25 min.'], quantitySource: IND, tags: ['africain'],
  }),
  recipe({
    id: 'r-sauce-epinards', name: 'Sauce épinards', category: 'Sauces', prepMinutes: 10, cookMinutes: 25, cookingMethods: ['eau'],
    ingredients: [i('p-epinards', 1, 'sac', 'sauce'), i('p-tomate', 2, 'unité', 'sauce'), i('p-oignon', 1, 'unité', 'sauce'), i('p-ail', 0.25, 'tête', 'assaisonnement'), i('p-gingembre', 0.5, 'morceau', 'assaisonnement'), oil(), spices(), nousSeasoning()],
    steps: ['Cuire tomates, oignon, ail et gingembre 10 min.', 'Ajouter les épinards hachés et laisser mijoter 15 min.'], quantitySource: IND, tags: ['africain'],
  }),

  // ------------------------------------------------------------------ Protéines
  recipe({
    id: 'r-tilapia-four', name: 'Tilapia au four', category: 'Poissons', prepMinutes: 10, cookMinutes: 25, cookingMethods: ['four'],
    ingredients: [i('p-tilapia', 540, 'g', 'protéine', { note: 'Portion de GM : 150 g (document).' }), i('p-citron', 1, 'unité', 'assaisonnement', { scaling: 'linéaire' }), i('p-ail', 0.25, 'tête', 'assaisonnement'), spices()],
    steps: ['Décongeler la veille au réfrigérateur.', 'Mariner avec citron, ail et épices (sans sel).', 'Cuire au four à 200 °C, 20 à 25 min.'],
    storage: 'Décongeler au réfrigérateur la veille (document).', quantitySource: DED, tags: ['africain', 'international'],
  }),
  recipe({
    id: 'r-tilapia-braise', name: 'Tilapia braisé', category: 'Poissons', prepMinutes: 10, cookMinutes: 20, cookingMethods: ['braise'],
    ingredients: [i('p-tilapia', 540, 'g', 'protéine'), i('p-citron', 1, 'unité', 'assaisonnement', { scaling: 'linéaire' }), i('p-oignon', 0.5, 'unité', 'assaisonnement', { scaling: 'linéaire' }), i('p-gingembre', 0.5, 'morceau', 'assaisonnement'), spices()],
    steps: ['Mariner le poisson (citron, oignon, gingembre).', 'Griller à la braise ou sous le gril du four, sans huile, 8 à 10 min par face.'], quantitySource: DED, tags: ['africain'],
  }),
  recipe({
    id: 'r-tilapia-sauce', name: 'Tilapia (cuit dans la sauce)', category: 'Poissons', prepMinutes: 5, cookMinutes: 15, cookingMethods: ['eau'],
    ingredients: [i('p-tilapia', 540, 'g', 'protéine'), i('p-citron', 0.5, 'unité', 'assaisonnement', { scaling: 'linéaire' })],
    steps: ['Nettoyer le poisson au citron.', 'Le pocher dans la sauce du jour 10 à 15 min.'],
    notes: 'Le document écrit seulement « tilapia » : cuisson dans la sauce du repas.', quantitySource: DED, tags: ['africain'],
  }),
  recipe({
    id: 'r-tilapia-papillote', name: 'Tilapia en papillote', category: 'Poissons', prepMinutes: 10, cookMinutes: 20, cookingMethods: ['papillote'],
    ingredients: [i('p-tilapia', 540, 'g', 'protéine'), i('p-citron', 1, 'unité', 'assaisonnement', { scaling: 'linéaire' }), i('p-tomate', 1, 'unité', 'légume'), i('p-oignon', 0.5, 'unité', 'assaisonnement', { scaling: 'linéaire' }), spices()],
    steps: ['Déposer chaque filet sur du papier cuisson avec rondelles de tomate, oignon et citron.', 'Fermer et cuire 20 min à 200 °C.'], quantitySource: DED, tags: ['international'],
  }),
  recipe({
    id: 'r-poulet-four', name: 'Poulet au four (sans peau)', category: 'Volailles', prepMinutes: 10, cookMinutes: 40, cookingMethods: ['four'],
    ingredients: [i('p-poulet', 800, 'g', 'protéine', { note: '800 g cru avec os pour 3 portions de 150 g cuites (hypothèse du document).' }), i('p-citron', 1, 'unité', 'assaisonnement', { scaling: 'linéaire' }), i('p-ail', 0.25, 'tête', 'assaisonnement'), i('p-gingembre', 0.5, 'morceau', 'assaisonnement'), spices()],
    steps: ['Retirer la peau.', 'Mariner (citron, ail, gingembre, épices, sans sel).', 'Cuire au four à 200 °C, 35 à 40 min, jusqu’à cuisson à cœur.'],
    storage: 'Cuire deux repas à la fois et conserver au réfrigérateur ; congeler en portions de trois (document).', quantitySource: DED, tags: ['international'],
  }),
  recipe({
    id: 'r-poulet-braise', name: 'Poulet braisé (sans peau)', category: 'Volailles', prepMinutes: 10, cookMinutes: 30, cookingMethods: ['braise'],
    ingredients: [i('p-poulet', 800, 'g', 'protéine'), i('p-citron', 1, 'unité', 'assaisonnement', { scaling: 'linéaire' }), i('p-oignon', 0.5, 'unité', 'assaisonnement', { scaling: 'linéaire' }), i('p-ail', 0.25, 'tête', 'assaisonnement'), spices()],
    steps: ['Retirer la peau et mariner.', 'Griller à la braise ou au four position gril, en retournant, 25 à 30 min.'], quantitySource: DED, tags: ['africain'],
  }),
  recipe({
    id: 'r-poulet', name: 'Poulet sans peau (cuit dans la sauce ou à l’eau)', category: 'Volailles', prepMinutes: 5, cookMinutes: 30, cookingMethods: ['eau'],
    ingredients: [i('p-poulet', 800, 'g', 'protéine'), i('p-citron', 0.5, 'unité', 'assaisonnement', { scaling: 'linéaire' }), spices()],
    steps: ['Retirer la peau.', 'Cuire dans la sauce ou à l’eau avec oignon et épices 30 min.'],
    notes: 'Le document écrit seulement « poulet » : cuisson au choix parmi les modes autorisés.', quantitySource: DED, tags: ['africain'],
  }),
  recipe({
    id: 'r-oeufs-durs', name: 'Œufs durs', category: 'Œufs', prepMinutes: 2, cookMinutes: 10, cookingMethods: ['eau'],
    ingredients: [i('p-oeufs', 6, 'unité', 'protéine', { note: '2 par personne (le menu indique parfois « 2 œufs durs »).' })],
    steps: ['Plonger les œufs dans l’eau bouillante 10 min.', 'Refroidir à l’eau froide.'],
    storage: 'Cuire en une fois pour deux repas (document).', quantitySource: IND,
  }),
  recipe({
    id: 'r-omelette', name: 'Omelette sans huile', category: 'Œufs', prepMinutes: 5, cookMinutes: 8, cookingMethods: ['poêle sans huile'],
    ingredients: [i('p-oeufs', 6, 'unité', 'protéine'), i('p-oignon', 0.5, 'unité', 'légume'), i('p-tomate', 1, 'unité', 'légume'), spices()],
    steps: ['Battre les œufs avec oignon et tomate hachés.', 'Cuire dans une poêle antiadhésive sans huile, à feu doux.'], quantitySource: IND,
  }),
  recipe({
    id: 'r-haricots-secs', name: 'Haricots secs cuits sans sel', category: 'Légumineuses', prepMinutes: 10, cookMinutes: 90, difficulty: 'moyen', cookingMethods: ['eau'],
    ingredients: [i('p-haricots-secs', 250, 'g', 'légume', { note: '0,5 kg par période de 2 semaines pour 2 repas (document).' }), i('p-oignon', 0.5, 'unité', 'assaisonnement', { scaling: 'linéaire' })],
    steps: ['Faire tremper la veille.', 'Cuire à l’eau sans sel 1 h 30, jusqu’à ce qu’ils soient tendres.'],
    storage: 'Cuire deux repas à la fois (document).', quantitySource: DED, tags: ['africain'],
  }),

  // ------------------------------------------------------------------ Légumes et salades
  recipe({
    id: 'r-salade-composee', name: 'Salade composée', category: 'Légumes', prepMinutes: 15, cookMinutes: 0, cookingMethods: ['cru'],
    ingredients: [i('p-salade', 0.5, 'botte', 'légume'), i('p-tomate', 2, 'unité', 'légume'), i('p-concombre', 1, 'unité', 'légume'), i('p-carotte', 1, 'unité', 'légume'), i('p-citron', 0.5, 'unité', 'assaisonnement', { scaling: 'linéaire' }), i('p-huile-olive', 1, 'c. à café', 'matière grasse', { toTaste: true, scaling: 'fixe' })],
    steps: ['Laver et couper les légumes.', 'Assaisonner au citron et à l’huile d’olive (1 c. à café).'], quantitySource: IND,
  }),
  recipe({
    id: 'r-tomate-concombre', name: 'Salade tomate-concombre', category: 'Légumes', prepMinutes: 10, cookMinutes: 0, cookingMethods: ['cru'],
    ingredients: [i('p-tomate', 3, 'unité', 'légume'), i('p-concombre', 1, 'unité', 'légume'), i('p-citron', 0.5, 'unité', 'assaisonnement', { scaling: 'linéaire' })],
    steps: ['Couper tomates et concombre en dés.', 'Arroser de jus de citron.'], quantitySource: IND,
  }),
  recipe({
    id: 'r-carottes-rapees', name: 'Carottes râpées', category: 'Légumes', prepMinutes: 10, cookMinutes: 0, cookingMethods: ['cru'],
    ingredients: [i('p-carotte', 4, 'unité', 'légume'), i('p-citron', 1, 'unité', 'assaisonnement', { scaling: 'linéaire' })],
    steps: ['Râper les carottes.', 'Assaisonner au citron.'], quantitySource: IND,
  }),
  recipe({
    id: 'r-brocoli', name: 'Brocoli vapeur', category: 'Légumes', prepMinutes: 5, cookMinutes: 8, cookingMethods: ['vapeur'],
    ingredients: [i('p-brocoli', 1, 'tête', 'légume')],
    steps: ['Détailler en fleurettes.', 'Cuire 8 min à la vapeur.'], quantitySource: IND,
  }),
  recipe({
    id: 'r-salade-verte', name: 'Salade verte', category: 'Légumes', prepMinutes: 5, cookMinutes: 0, cookingMethods: ['cru'],
    ingredients: [i('p-salade', 0.5, 'botte', 'légume'), i('p-citron', 0.5, 'unité', 'assaisonnement', { scaling: 'linéaire' })],
    steps: ['Laver et essorer.', 'Assaisonner au citron.'], quantitySource: IND,
  }),
  recipe({
    id: 'r-haricots-verts', name: 'Haricots verts vapeur', category: 'Légumes', prepMinutes: 10, cookMinutes: 12, cookingMethods: ['vapeur'],
    ingredients: [i('p-haricots-verts', 450, 'g', 'légume')],
    steps: ['Équeuter.', 'Cuire 10 à 12 min à la vapeur.'], quantitySource: IND,
  }),
  recipe({
    id: 'r-courgettes-poivron', name: 'Courgettes-poivron vapeur', category: 'Légumes', prepMinutes: 10, cookMinutes: 10, cookingMethods: ['vapeur'],
    ingredients: [i('p-courgette', 2, 'unité', 'légume'), i('p-poivron', 2, 'unité', 'légume')],
    steps: ['Couper en lamelles.', 'Cuire 10 min à la vapeur.'], notes: 'Correspond aussi à « Poivrons-courgettes vapeur ».', quantitySource: IND,
  }),
  recipe({
    id: 'r-legumes-vapeur', name: 'Légumes vapeur', category: 'Légumes', prepMinutes: 10, cookMinutes: 12, cookingMethods: ['vapeur'],
    ingredients: [i('p-carotte', 2, 'unité', 'légume'), i('p-courgette', 1, 'unité', 'légume'), i('p-brocoli', 0.5, 'tête', 'légume')],
    steps: ['Couper les légumes.', 'Cuire 12 min à la vapeur.'], quantitySource: IND,
  }),
  recipe({
    id: 'r-carottes', name: 'Carottes vapeur', category: 'Légumes', prepMinutes: 5, cookMinutes: 12, cookingMethods: ['vapeur'],
    ingredients: [i('p-carotte', 5, 'unité', 'légume')],
    steps: ['Couper en rondelles.', 'Cuire 12 min à la vapeur.'], quantitySource: IND,
  }),
  recipe({
    id: 'r-courgettes', name: 'Courgettes vapeur', category: 'Légumes', prepMinutes: 5, cookMinutes: 10, cookingMethods: ['vapeur'],
    ingredients: [i('p-courgette', 3, 'unité', 'légume')],
    steps: ['Couper en rondelles.', 'Cuire 10 min à la vapeur.'], quantitySource: IND,
  }),
  recipe({
    id: 'r-courgettes-aubergine', name: 'Courgettes-aubergine vapeur', category: 'Légumes', prepMinutes: 10, cookMinutes: 12, cookingMethods: ['vapeur'],
    ingredients: [i('p-courgette', 2, 'unité', 'légume'), i('p-aubergine', 1, 'unité', 'légume')],
    steps: ['Couper en dés.', 'Cuire 12 min à la vapeur.'], quantitySource: IND,
  }),
  recipe({
    id: 'r-aubergines-four', name: 'Aubergines au four', category: 'Légumes', prepMinutes: 10, cookMinutes: 30, cookingMethods: ['four'],
    ingredients: [i('p-aubergine', 2, 'unité', 'légume'), i('p-ail', 0.25, 'tête', 'assaisonnement'), spices()],
    steps: ['Couper en tranches.', 'Cuire 30 min au four à 200 °C sur papier cuisson, sans huile.'], quantitySource: IND,
  }),
  recipe({
    id: 'r-aubergine-tomate-four', name: 'Aubergine-tomate au four', category: 'Légumes', prepMinutes: 10, cookMinutes: 35, cookingMethods: ['four'],
    ingredients: [i('p-aubergine', 2, 'unité', 'légume'), i('p-tomate', 3, 'unité', 'légume'), i('p-oignon', 0.5, 'unité', 'légume'), spices()],
    steps: ['Alterner tranches d’aubergine et de tomate dans un plat.', 'Cuire 35 min à 190 °C.'], quantitySource: IND,
  }),
  recipe({
    id: 'r-tomates', name: 'Tomates en salade', category: 'Légumes', prepMinutes: 5, cookMinutes: 0, cookingMethods: ['cru'],
    ingredients: [i('p-tomate', 3, 'unité', 'légume'), i('p-oignon', 0.5, 'unité', 'légume'), i('p-citron', 0.5, 'unité', 'assaisonnement', { scaling: 'linéaire' })],
    steps: ['Couper les tomates en quartiers, émincer l’oignon.', 'Arroser de citron.'], quantitySource: IND,
  }),

  // ------------------------------------------------------------------ Petits-déjeuners
  recipe({
    id: 'r-pdj-avoine', name: 'Flocons d’avoine (1 bol)', category: 'Petit-déjeuner', prepMinutes: 2, cookMinutes: 5, cookingMethods: ['eau'],
    ingredients: [
      i('p-avoine', 120, 'g', 'féculent', { note: 'Environ 40 g par bol (indicatif).' }),
      i('p-edulcorant', 1, 'pincée', 'assaisonnement', { toTaste: true, onlyForProfileIds: [PROFILE_GM], note: 'GM : édulcorant, ni sucre ni miel.' }),
      i('p-yaourt', 125, 'g', 'laitage', { onlyForProfileIds: [PROFILE_NOUS], note: 'Nous : + yaourt 0 %.' }),
      i('p-noix', 15, 'g', 'autre', { optional: true, toTaste: true, onlyForProfileIds: [PROFILE_NOUS], note: 'Nous : noix ou graines.' }),
    ],
    steps: ['Cuire les flocons dans l’eau 3 à 5 min.', 'GM : édulcorant. Nous : yaourt 0 %, noix ou graines.', '+ 1 fruit pour tous.'],
    quantitySource: IND,
  }),
  recipe({
    id: 'r-pdj-pain-oeuf', name: 'Pain complet (2 tr.) + œuf dur ou au plat sans huile', category: 'Petit-déjeuner', prepMinutes: 2, cookMinutes: 10, cookingMethods: ['eau', 'poêle sans huile'],
    ingredients: [
      i('p-pain', 6, 'tranche', 'féculent', { note: '2 tranches par personne (document).' }),
      i('p-oeufs', 3, 'unité', 'protéine'),
      i('p-avocat', 1, 'unité', 'fruit', { onlyForProfileIds: [PROFILE_NOUS], note: 'Nous : + avocat (8 avocats par période pour 4 petits-déjeuners à 2 : quantité déduite du document).' }),
      i('p-oeufs', 1, 'unité', 'protéine', { onlyForProfileIds: [PROFILE_MOI], note: 'Moi : 2e œuf.' }),
    ],
    steps: ['Cuire l’œuf dur (10 min) ou au plat dans une poêle antiadhésive sans huile.', 'Servir avec 2 tranches de pain complet.', '+ 1 fruit pour tous.'],
    quantitySource: IND,
  }),
  recipe({
    id: 'r-pdj-bouillie', name: 'Bouillie de riz (300 g)', category: 'Petit-déjeuner', prepMinutes: 2, cookMinutes: 20, cookingMethods: ['eau'],
    ingredients: [
      i('p-riz', 90, 'g', 'féculent', { note: 'Le document indique « 300 g » sans préciser s’il s’agit de bouillie prête ou de riz : quantité de riz indicative.' }),
      i('p-edulcorant', 1, 'pincée', 'assaisonnement', { toTaste: true, onlyForProfileIds: [PROFILE_GM], note: 'GM : édulcorant.' }),
      i('p-lait', 0.1, 'L', 'laitage', { optional: true, onlyForProfileIds: [PROFILE_GM], note: 'GM : lait demi-écrémé ou eau.' }),
      i('p-lait', 0.15, 'L', 'laitage', { onlyForProfileIds: [PROFILE_NOUS], note: 'Nous : + lait.' }),
      i('p-banane', 1, 'unité', 'fruit', { onlyForProfileIds: [PROFILE_NOUS], note: 'Nous : + banane.' }),
    ],
    steps: ['Cuire le riz dans beaucoup d’eau 20 min en remuant jusqu’à consistance de bouillie.', 'GM : édulcorant, lait demi-écrémé ou eau. Nous : + lait, banane.', '+ 1 fruit pour tous.'],
    quantitySource: IND,
  }),
  recipe({
    id: 'r-pdj-pain-yaourt', name: 'Pain complet (2 tr.) + yaourt nature 0 %', category: 'Petit-déjeuner', prepMinutes: 2, cookMinutes: 0, cookingMethods: ['cru'],
    ingredients: [
      i('p-pain', 6, 'tranche', 'féculent'),
      i('p-yaourt', 375, 'g', 'laitage', { note: '125 g par personne (indicatif).' }),
      i('p-fromage-blanc', 100, 'g', 'laitage', { optional: true, onlyForProfileIds: [PROFILE_NOUS], note: 'Nous : + fromage blanc.' }),
      i('p-graines', 10, 'g', 'autre', { optional: true, toTaste: true, onlyForProfileIds: [PROFILE_NOUS], note: 'Nous : graines.' }),
    ],
    steps: ['Servir 2 tranches de pain complet et un yaourt nature 0 %.', 'GM : yaourt 0 % seulement. Nous : + fromage blanc, graines.', '+ 1 fruit pour tous.'],
    quantitySource: IND,
  }),

  // ------------------------------------------------------------------ Boisson
  recipe({
    id: 'r-bissap', name: 'Bissap maison sans sucre', category: 'Boissons', prepMinutes: 5, cookMinutes: 15, cookingMethods: ['eau'], servings: 6,
    ingredients: [i('p-bissap', 50, 'g', 'boisson'), i('p-gingembre', 0.5, 'morceau', 'assaisonnement'), i('p-edulcorant', 1, 'pincée', 'assaisonnement', { toTaste: true, note: 'Édulcorant au lieu du sucre.' })],
    steps: ['Rincer les fleurs de bissap.', 'Faire bouillir 15 min dans 1,5 L d’eau avec le gingembre.', 'Filtrer, laisser refroidir, sucrer à l’édulcorant.'],
    notes: 'Le bissap figure dans la liste de courses du document, sans recette associée.', quantitySource: IND, tags: ['africain'],
  }),
];

/** Correspondance entre les éléments des menus du document et les recettes. */
export const MENU_ITEM_RECIPE: Record<string, string> = {
  riz: 'r-riz',
  'attiéké': 'r-attieke',
  'foutou banane': 'r-foutou-banane',
  'foutou igname': 'r-foutou-igname',
  igname: 'r-igname',
  'igname bouillie': 'r-igname',
  'plantain bouilli': 'r-plantain',
  plantain: 'r-plantain',
  spaghetti: 'r-spaghetti',
  'pommes de terre': 'r-pdt',
  'sauce claire': 'r-sauce-claire',
  'sauce tomate': 'r-sauce-tomate',
  'sauce gombo': 'r-sauce-gombo',
  'sauce tomate-aubergine': 'r-sauce-tomate-aubergine',
  'sauce aubergine-tomate': 'r-sauce-tomate-aubergine',
  'sauce feuilles': 'r-sauce-feuilles',
  'sauce légumes': 'r-sauce-legumes',
  'sauce épinards': 'r-sauce-epinards',
  'tilapia au four': 'r-tilapia-four',
  'tilapia braisé': 'r-tilapia-braise',
  tilapia: 'r-tilapia-sauce',
  'tilapia papillote': 'r-tilapia-papillote',
  'poulet au four': 'r-poulet-four',
  'poulet braisé': 'r-poulet-braise',
  poulet: 'r-poulet',
  'œufs durs': 'r-oeufs-durs',
  '2 œufs durs': 'r-oeufs-durs',
  'omelette sans huile': 'r-omelette',
  'haricots secs': 'r-haricots-secs',
  'salade composée': 'r-salade-composee',
  'tomate-concombre': 'r-tomate-concombre',
  'salade tomate-concombre': 'r-tomate-concombre',
  'carottes râpées': 'r-carottes-rapees',
  brocoli: 'r-brocoli',
  salade: 'r-salade-verte',
  'haricots verts': 'r-haricots-verts',
  'courgettes-poivron vapeur': 'r-courgettes-poivron',
  'poivrons-courgettes vapeur': 'r-courgettes-poivron',
  'légumes vapeur': 'r-legumes-vapeur',
  carottes: 'r-carottes',
  'courgettes vapeur': 'r-courgettes',
  courgettes: 'r-courgettes',
  'courgettes-aubergine': 'r-courgettes-aubergine',
  'aubergines au four': 'r-aubergines-four',
  'aubergine-tomate au four': 'r-aubergine-tomate-four',
  tomates: 'r-tomates',
};

export const BREAKFAST_RECIPE: Record<string, string> = {
  'Flocons d’avoine (1 bol)': 'r-pdj-avoine',
  'Pain complet (2 tr.) + œuf dur ou au plat sans huile': 'r-pdj-pain-oeuf',
  'Bouillie de riz (300 g)': 'r-pdj-bouillie',
  'Pain complet (2 tr.) + yaourt nature 0 %': 'r-pdj-pain-yaourt',
};
