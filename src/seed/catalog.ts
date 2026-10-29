import type { SubstitutionMode, Unit, UnitConversion } from '../domain/types';

export interface SeedCategory { id: string; name: string; icon: string; kind: 'alimentaire' | 'maison' }
export interface SeedLocation { id: string; name: string; icon: string }

export const CATEGORIES: SeedCategory[] = [
  { id: 'cat-fruits', name: 'Fruits', icon: '🍊', kind: 'alimentaire' },
  { id: 'cat-legumes', name: 'Légumes', icon: '🥕', kind: 'alimentaire' },
  { id: 'cat-viandes', name: 'Viandes et volailles', icon: '🍗', kind: 'alimentaire' },
  { id: 'cat-poissons', name: 'Poissons et fruits de mer', icon: '🐟', kind: 'alimentaire' },
  { id: 'cat-feculents', name: 'Féculents et céréales', icon: '🍚', kind: 'alimentaire' },
  { id: 'cat-legumineuses', name: 'Légumineuses', icon: '🫘', kind: 'alimentaire' },
  { id: 'cat-laitiers', name: 'Produits laitiers', icon: '🥛', kind: 'alimentaire' },
  { id: 'cat-oeufs', name: 'Œufs', icon: '🥚', kind: 'alimentaire' },
  { id: 'cat-huiles', name: 'Huiles et matières grasses', icon: '🫒', kind: 'alimentaire' },
  { id: 'cat-epices', name: 'Épices, condiments et sauces', icon: '🧂', kind: 'alimentaire' },
  { id: 'cat-boissons', name: 'Boissons', icon: '🧃', kind: 'alimentaire' },
  { id: 'cat-nettoyage', name: 'Produits de nettoyage', icon: '🧽', kind: 'maison' },
  { id: 'cat-hygiene', name: 'Hygiène personnelle', icon: '🧴', kind: 'maison' },
  { id: 'cat-papier', name: 'Papier et fournitures', icon: '🧻', kind: 'maison' },
  { id: 'cat-menager', name: 'Autres produits ménagers', icon: '🏠', kind: 'maison' },
];

export const LOCATIONS: SeedLocation[] = [
  { id: 'loc-frigo', name: 'Réfrigérateur', icon: '🧊' },
  { id: 'loc-congel', name: 'Congélateur', icon: '❄️' },
  { id: 'loc-garde-manger', name: 'Garde-manger', icon: '🥫' },
  { id: 'loc-placard', name: 'Placard', icon: '🗄️' },
  { id: 'loc-comptoir', name: 'Comptoir / corbeille', icon: '🧺' },
  { id: 'loc-sdb', name: 'Salle de bain', icon: '🛁' },
  { id: 'loc-buanderie', name: 'Buanderie', icon: '🧺' },
];

export interface SeedProduct {
  id: string;
  name: string;
  categoryId: string;
  locationId?: string;
  unit: Unit;
  unitPrice?: number;
  /** Explication de l'origine du prix. */
  priceSource?: string;
  essential: boolean;
  perishable: boolean;
  tags: string[];
  conversions?: UnitConversion[];
  purchaseStep?: number;
  notes?: string;
}

const DOC_PRICE = 'Prix de la liste de référence du document (octobre 2026), non revérifié en magasin';
const DOC_STAR = 'Prix estimé dans le document (produit absent de la liste de référence), non revérifié';

/** Prix unitaire déduit d'une ligne du document : montant ÷ quantité. */
const per = (amount: number, qty: number) => Math.round((amount / qty) * 10000) / 10000;

export const PRODUCTS: SeedProduct[] = [
  // Légumes
  { id: 'p-ail', name: 'Ail', categoryId: 'cat-legumes', locationId: 'loc-garde-manger', unit: 'tête', unitPrice: per(3.75, 5), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['légume', 'ail'] },
  { id: 'p-aubergine', name: 'Aubergines', categoryId: 'cat-legumes', locationId: 'loc-frigo', unit: 'unité', unitPrice: per(1.5, 2), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['légume', 'aubergine'] },
  { id: 'p-brocoli', name: 'Brocoli', categoryId: 'cat-legumes', locationId: 'loc-frigo', unit: 'tête', unitPrice: per(5, 2), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['légume', 'brocoli'] },
  { id: 'p-carotte', name: 'Carottes', categoryId: 'cat-legumes', locationId: 'loc-frigo', unit: 'unité', unitPrice: per(6.4, 16), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['légume', 'carotte'] },
  { id: 'p-citron', name: 'Citrons', categoryId: 'cat-legumes', locationId: 'loc-frigo', unit: 'unité', unitPrice: per(3.78, 9), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['citron'] },
  { id: 'p-concombre', name: 'Concombres', categoryId: 'cat-legumes', locationId: 'loc-frigo', unit: 'unité', unitPrice: per(4.02, 6), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['légume', 'concombre'] },
  { id: 'p-courgette', name: 'Courgettes', categoryId: 'cat-legumes', locationId: 'loc-frigo', unit: 'unité', unitPrice: per(5.25, 7), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['légume', 'courgette'] },
  { id: 'p-gingembre', name: 'Gingembre', categoryId: 'cat-legumes', locationId: 'loc-frigo', unit: 'morceau', unitPrice: per(2.25, 3), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['gingembre'] },
  { id: 'p-gombo', name: 'Gombo surgelé (paquet 300 g)', categoryId: 'cat-legumes', locationId: 'loc-congel', unit: 'paquet', unitPrice: 3.5, priceSource: DOC_STAR, essential: true, perishable: false, tags: ['légume', 'gombo', 'surgelé'], conversions: [{ unit: 'paquet', amount: 300, to: 'g' }], purchaseStep: 1 },
  { id: 'p-haricots-verts', name: 'Haricots verts', categoryId: 'cat-legumes', locationId: 'loc-frigo', unit: 'kg', unitPrice: per(6.68, 2), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['légume', 'haricot-vert'], purchaseStep: 0.5, notes: 'Surgelés possibles en semaine 2 (document).' },
  { id: 'p-oignon', name: 'Oignons', categoryId: 'cat-legumes', locationId: 'loc-garde-manger', unit: 'unité', unitPrice: per(7, 14), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['légume', 'oignon'] },
  { id: 'p-poivron', name: 'Poivrons', categoryId: 'cat-legumes', locationId: 'loc-frigo', unit: 'unité', unitPrice: per(5.67, 9), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['légume', 'poivron'] },
  { id: 'p-salade', name: 'Salade verte', categoryId: 'cat-legumes', locationId: 'loc-frigo', unit: 'botte', unitPrice: per(7.5, 3), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['légume', 'salade'] },
  { id: 'p-tomate', name: 'Tomates grosses', categoryId: 'cat-legumes', locationId: 'loc-comptoir', unit: 'unité', unitPrice: per(18.81, 33), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['légume', 'tomate'] },
  { id: 'p-epinards', name: 'Épinards frais', categoryId: 'cat-legumes', locationId: 'loc-frigo', unit: 'sac', unitPrice: 3.5, priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['légume', 'épinard', 'feuilles'] },

  // Fruits
  { id: 'p-avocat', name: 'Avocats', categoryId: 'cat-fruits', locationId: 'loc-comptoir', unit: 'unité', unitPrice: 1, priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['fruit', 'avocat'], notes: 'Nous seulement (document).' },
  { id: 'p-banane', name: 'Bananes', categoryId: 'cat-fruits', locationId: 'loc-comptoir', unit: 'unité', unitPrice: per(5.88, 14), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['fruit', 'banane-douce'], notes: 'Nous seulement (document).' },
  { id: 'p-clementine', name: 'Clémentines', categoryId: 'cat-fruits', locationId: 'loc-comptoir', unit: 'unité', unitPrice: per(3, 10), priceSource: DOC_STAR, essential: true, perishable: true, tags: ['fruit'] },
  { id: 'p-orange', name: 'Oranges', categoryId: 'cat-fruits', locationId: 'loc-comptoir', unit: 'unité', unitPrice: per(8.6, 20), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['fruit'] },
  { id: 'p-pomme', name: 'Pommes', categoryId: 'cat-fruits', locationId: 'loc-comptoir', unit: 'unité', unitPrice: per(8.4, 14), priceSource: DOC_STAR, essential: true, perishable: true, tags: ['fruit'] },
  { id: 'p-mangue', name: 'Mangues', categoryId: 'cat-fruits', locationId: 'loc-comptoir', unit: 'unité', unitPrice: per(3.99, 3), priceSource: DOC_PRICE, essential: false, perishable: true, tags: ['fruit'], notes: 'Si saison (document).' },
  { id: 'p-poire', name: 'Poires', categoryId: 'cat-fruits', locationId: 'loc-comptoir', unit: 'unité', unitPrice: per(4.02, 6), priceSource: DOC_PRICE, essential: false, perishable: true, tags: ['fruit'] },

  // Protéines
  { id: 'p-haricots-secs', name: 'Haricots secs', categoryId: 'cat-legumineuses', locationId: 'loc-garde-manger', unit: 'kg', unitPrice: per(1.95, 0.5), priceSource: DOC_STAR, essential: true, perishable: false, tags: ['légumineuse', 'haricot-sec'], purchaseStep: 0.5 },
  { id: 'p-oeufs', name: 'Œufs', categoryId: 'cat-oeufs', locationId: 'loc-frigo', unit: 'douzaine', unitPrice: per(18, 4), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['œuf'], purchaseStep: 1 },
  { id: 'p-poulet', name: 'Poulet cuisses/pilons, sans peau', categoryId: 'cat-viandes', locationId: 'loc-congel', unit: 'kg', unitPrice: per(95.2, 11.2), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['volaille', 'poulet-sans-peau', 'surgelé'], purchaseStep: 0.1, notes: 'Compté avec os, sans peau : environ 800 g cru pour 3 portions de 150 g cuites (hypothèse du document).' },
  { id: 'p-tilapia', name: 'Tilapia surgelé', categoryId: 'cat-poissons', locationId: 'loc-congel', unit: 'kg', unitPrice: per(67.5, 5.4), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['poisson', 'poisson-maigre', 'surgelé'], purchaseStep: 0.1 },
  { id: 'p-lentilles', name: 'Lentilles sèches', categoryId: 'cat-legumineuses', locationId: 'loc-garde-manger', unit: 'kg', unitPrice: per(2, 0.5), priceSource: DOC_PRICE, essential: false, perishable: false, tags: ['légumineuse', 'lentilles'], purchaseStep: 0.5, notes: 'Nous seulement (document).' },
  { id: 'p-thon', name: 'Thon naturel (boîte)', categoryId: 'cat-poissons', locationId: 'loc-garde-manger', unit: 'boîte', unitPrice: per(5.01, 3), priceSource: DOC_PRICE, essential: false, perishable: false, tags: ['poisson', 'conserve'], notes: 'Nous seulement (document).' },

  // Féculents
  { id: 'p-attieke', name: 'Attiéké', categoryId: 'cat-feculents', locationId: 'loc-congel', unit: 'kg', unitPrice: 8, priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['féculent', 'attiéké'], purchaseStep: 0.5 },
  { id: 'p-plantain', name: 'Banane plantain', categoryId: 'cat-feculents', locationId: 'loc-comptoir', unit: 'unité', unitPrice: per(15, 12), priceSource: DOC_STAR, essential: true, perishable: true, tags: ['féculent', 'plantain'] },
  { id: 'p-avoine', name: 'Flocons d’avoine', categoryId: 'cat-feculents', locationId: 'loc-placard', unit: 'kg', unitPrice: 8, priceSource: DOC_PRICE, essential: true, perishable: false, tags: ['féculent', 'céréale'], purchaseStep: 1 },
  { id: 'p-igname', name: 'Igname', categoryId: 'cat-feculents', locationId: 'loc-garde-manger', unit: 'kg', unitPrice: 4, priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['féculent', 'igname'], purchaseStep: 0.5 },
  { id: 'p-pain', name: 'Pain complet tranché', categoryId: 'cat-feculents', locationId: 'loc-placard', unit: 'pain', unitPrice: per(14, 4), priceSource: DOC_STAR, essential: true, perishable: true, tags: ['féculent', 'pain-complet'], purchaseStep: 1, notes: 'Nombre de tranches par pain non précisé dans le document : à renseigner dans les conversions pour que les petits-déjeuners soient comptés.' },
  { id: 'p-patate-douce', name: 'Patates douces', categoryId: 'cat-feculents', locationId: 'loc-garde-manger', unit: 'unité', unitPrice: 1, priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['féculent', 'patate-douce'], notes: 'Nous seulement (document).' },
  { id: 'p-pdt', name: 'Pommes de terre', categoryId: 'cat-feculents', locationId: 'loc-garde-manger', unit: 'kg', unitPrice: 2, priceSource: DOC_STAR, essential: true, perishable: true, tags: ['féculent', 'pomme-de-terre'], purchaseStep: 1 },
  { id: 'p-riz', name: 'Riz basmati', categoryId: 'cat-feculents', locationId: 'loc-placard', unit: 'kg', unitPrice: 5, priceSource: DOC_PRICE, essential: true, perishable: false, tags: ['féculent', 'riz'], purchaseStep: 1 },
  { id: 'p-spaghetti', name: 'Spaghetti', categoryId: 'cat-feculents', locationId: 'loc-placard', unit: 'kg', unitPrice: per(2.2, 0.45), priceSource: DOC_STAR, essential: true, perishable: false, tags: ['féculent', 'pâtes'], purchaseStep: 0.45 },

  // Produits laitiers
  { id: 'p-lait', name: 'Lait demi-écrémé', categoryId: 'cat-laitiers', locationId: 'loc-frigo', unit: 'L', unitPrice: per(5, 2), priceSource: DOC_PRICE, essential: true, perishable: true, tags: ['laitage', 'laitage-maigre'], purchaseStep: 1 },
  { id: 'p-yaourt', name: 'Yaourt nature 0 % (pot 750 g)', categoryId: 'cat-laitiers', locationId: 'loc-frigo', unit: 'pot', unitPrice: per(24.5, 7), priceSource: DOC_STAR, essential: true, perishable: true, tags: ['laitage', 'laitage-maigre'], conversions: [{ unit: 'pot', amount: 750, to: 'g' }], purchaseStep: 1 },
  { id: 'p-fromage-blanc', name: 'Fromage blanc 0 % (500 g)', categoryId: 'cat-laitiers', locationId: 'loc-frigo', unit: 'pot', unitPrice: 4.5, priceSource: DOC_PRICE, essential: false, perishable: true, tags: ['laitage', 'laitage-maigre'], conversions: [{ unit: 'pot', amount: 500, to: 'g' }], purchaseStep: 1 },

  // Condiments, huiles
  { id: 'p-maggi', name: 'Cubes Maggi', categoryId: 'cat-epices', locationId: 'loc-placard', unit: 'paquet', unitPrice: 2, priceSource: DOC_PRICE, essential: true, perishable: false, tags: ['cube', 'sodium'], notes: 'Nous, à table (document).' },
  { id: 'p-huile-olive', name: 'Huile d’olive', categoryId: 'cat-huiles', locationId: 'loc-placard', unit: 'bouteille', unitPrice: 7, priceSource: DOC_PRICE, essential: true, perishable: false, tags: ['huile', 'huile-végétale'], notes: 'Contenance de la bouteille non précisée dans le document.' },
  { id: 'p-huile-palme', name: 'Huile de palme rouge', categoryId: 'cat-huiles', locationId: 'loc-placard', unit: 'bouteille', unitPrice: 4, priceSource: DOC_PRICE, essential: true, perishable: false, tags: ['huile', 'huile-palme'], notes: 'Nous, à table (document).' },
  { id: 'p-moutarde', name: 'Moutarde naturelle', categoryId: 'cat-epices', locationId: 'loc-frigo', unit: 'pot', unitPrice: 3, priceSource: DOC_PRICE, essential: true, perishable: false, tags: ['moutarde', 'sodium'] },
  { id: 'p-epices', name: 'Épices de base (sel, poivre, thym)', categoryId: 'cat-epices', locationId: 'loc-placard', unit: 'paquet', unitPrice: 3, priceSource: DOC_PRICE, essential: true, perishable: false, tags: ['épices'] },
  { id: 'p-piment', name: 'Piment', categoryId: 'cat-epices', locationId: 'loc-placard', unit: 'paquet', unitPrice: 2, priceSource: DOC_PRICE, essential: false, perishable: false, tags: ['piment'] },
  { id: 'p-soya', name: 'Sauce soya réduite en sel', categoryId: 'cat-epices', locationId: 'loc-placard', unit: 'bouteille', unitPrice: 3.5, priceSource: DOC_PRICE, essential: false, perishable: false, tags: ['sauce-soya', 'sodium'], notes: 'Nous (document).' },
  { id: 'p-vinaigre', name: 'Vinaigre de cidre', categoryId: 'cat-epices', locationId: 'loc-placard', unit: 'bouteille', unitPrice: 3.5, priceSource: DOC_PRICE, essential: false, perishable: false, tags: ['vinaigre'] },
  { id: 'p-epices-extra', name: 'Épices extra (paprika, cumin)', categoryId: 'cat-epices', locationId: 'loc-placard', unit: 'paquet', unitPrice: 3, priceSource: DOC_PRICE, essential: false, perishable: false, tags: ['épices'] },

  // Autres produits
  { id: 'p-bissap', name: 'Bissap sec (200 g)', categoryId: 'cat-boissons', locationId: 'loc-placard', unit: 'sac', unitPrice: 4, priceSource: DOC_PRICE, essential: true, perishable: false, tags: ['boisson', 'bissap'], conversions: [{ unit: 'sac', amount: 200, to: 'g' }], purchaseStep: 1 },
  { id: 'p-edulcorant', name: 'Édulcorant (stévia ou Canderel)', categoryId: 'cat-epices', locationId: 'loc-placard', unit: 'boîte', unitPrice: 6, priceSource: DOC_STAR, essential: true, perishable: false, tags: ['édulcorant'] },
  { id: 'p-graines', name: 'Graines de chia ou lin (150 g)', categoryId: 'cat-feculents', locationId: 'loc-placard', unit: 'sac', unitPrice: 4, priceSource: DOC_PRICE, essential: false, perishable: false, tags: ['graines'], conversions: [{ unit: 'sac', amount: 150, to: 'g' }], notes: 'Nous (document).' },
  { id: 'p-noix', name: 'Noix non salées (200 g)', categoryId: 'cat-feculents', locationId: 'loc-placard', unit: 'sac', unitPrice: 5, priceSource: DOC_PRICE, essential: false, perishable: false, tags: ['noix'], conversions: [{ unit: 'sac', amount: 200, to: 'g' }], notes: 'Nous (document).' },

  // Hors document : produit utilisé par une recette de la bibliothèque (alloco), sans prix.
  { id: 'p-huile-friture', name: 'Huile végétale (friture)', categoryId: 'cat-huiles', locationId: 'loc-placard', unit: 'bouteille', essential: false, perishable: false, tags: ['huile', 'friture'] },

  // Fournitures ménagères (hors document : catalogue de départ, sans quantité ni prix)
  { id: 'p-papier-toilette', name: 'Papier toilette', categoryId: 'cat-papier', locationId: 'loc-sdb', unit: 'rouleau', essential: true, perishable: false, tags: ['maison'] },
  { id: 'p-essuie-tout', name: 'Essuie-tout', categoryId: 'cat-papier', locationId: 'loc-placard', unit: 'rouleau', essential: true, perishable: false, tags: ['maison'] },
  { id: 'p-savon', name: 'Savon', categoryId: 'cat-hygiene', locationId: 'loc-sdb', unit: 'unité', essential: true, perishable: false, tags: ['maison'] },
  { id: 'p-dentifrice', name: 'Dentifrice', categoryId: 'cat-hygiene', locationId: 'loc-sdb', unit: 'unité', essential: true, perishable: false, tags: ['maison'] },
  { id: 'p-shampoing', name: 'Shampoing', categoryId: 'cat-hygiene', locationId: 'loc-sdb', unit: 'bouteille', essential: false, perishable: false, tags: ['maison'] },
  { id: 'p-lessive', name: 'Lessive', categoryId: 'cat-nettoyage', locationId: 'loc-buanderie', unit: 'bouteille', essential: true, perishable: false, tags: ['maison'] },
  { id: 'p-vaisselle', name: 'Liquide vaisselle', categoryId: 'cat-nettoyage', locationId: 'loc-placard', unit: 'bouteille', essential: true, perishable: false, tags: ['maison'] },
  { id: 'p-nettoyant', name: 'Nettoyant multi-usage', categoryId: 'cat-nettoyage', locationId: 'loc-placard', unit: 'bouteille', essential: false, perishable: false, tags: ['maison'] },
  { id: 'p-sacs-poubelle', name: 'Sacs-poubelle', categoryId: 'cat-menager', locationId: 'loc-placard', unit: 'boîte', essential: true, perishable: false, tags: ['maison'] },
];

/**
 * Correspondance ligne du document → produit, et quantité numérique de chaque libellé.
 * Les libellés « 48 (4 dz) » sont convertis en douzaines (unité du produit).
 */
export const ROW_PRODUCT: Record<string, string> = {
  'Ail (têtes)': 'p-ail',
  Aubergines: 'p-aubergine',
  'Brocoli (têtes)': 'p-brocoli',
  Carottes: 'p-carotte',
  Citrons: 'p-citron',
  Concombres: 'p-concombre',
  Courgettes: 'p-courgette',
  'Gingembre (morceaux)': 'p-gingembre',
  'Gombo surgelé (paquet 300 g)': 'p-gombo',
  'Haricots verts': 'p-haricots-verts',
  Oignons: 'p-oignon',
  Poivrons: 'p-poivron',
  'Salade verte (bottes)': 'p-salade',
  'Tomates grosses': 'p-tomate',
  'Épinards frais (sacs)': 'p-epinards',
  'Avocats (nous seulement)': 'p-avocat',
  'Bananes (nous seulement)': 'p-banane',
  Clémentines: 'p-clementine',
  Oranges: 'p-orange',
  Pommes: 'p-pomme',
  'Mangues (si saison)': 'p-mangue',
  Poires: 'p-poire',
  'Haricots secs': 'p-haricots-secs',
  'Oeufs (douzaines)': 'p-oeufs',
  'Poulet cuisses/pilons, sans peau': 'p-poulet',
  'Tilapia surgelé': 'p-tilapia',
  'Lentilles sèches (nous seulement)': 'p-lentilles',
  'Thon naturel, boîtes (nous seulement)': 'p-thon',
  Attiéké: 'p-attieke',
  'Banane plantain': 'p-plantain',
  'Flocons d’avoine': 'p-avoine',
  Igname: 'p-igname',
  'Pain complet tranché (pains)': 'p-pain',
  'Patates douces (nous seulement)': 'p-patate-douce',
  'Pommes de terre': 'p-pdt',
  'Riz basmati': 'p-riz',
  Spaghetti: 'p-spaghetti',
  'Lait demi-écrémé': 'p-lait',
  'Yaourt nature 0 % (pot 750 g)': 'p-yaourt',
  'Fromage blanc 0 % (500 g)': 'p-fromage-blanc',
  'Cubes Maggi (nous, à table)': 'p-maggi',
  'Huile d’olive (bouteille)': 'p-huile-olive',
  'Huile de palme rouge (nous, à table)': 'p-huile-palme',
  'Moutarde naturelle': 'p-moutarde',
  'Épices de base (sel, poivre, thym)': 'p-epices',
  Piment: 'p-piment',
  'Sauce soya réduite en sel (nous)': 'p-soya',
  'Vinaigre de cidre': 'p-vinaigre',
  'Épices extra (paprika, cumin)': 'p-epices-extra',
  'Bissap sec (200 g)': 'p-bissap',
  'Édulcorant (stévia ou Canderel)': 'p-edulcorant',
  'Graines de chia ou lin 150 g (nous)': 'p-graines',
  'Noix non salées 200 g (nous)': 'p-noix',
};

/** « 1,5 kg » → 1.5 ; « 48 (4 dz) » → 4 (douzaines) ; « 2 L » → 2 ; « - » → null. */
export function parseDocQuantity(label: string): number | null {
  const s = label.trim();
  if (s === '-' || s === '') return null;
  const dz = s.match(/\((\d+(?:,\d+)?)\s*dz\)/);
  if (dz) return Number(dz[1].replace(',', '.'));
  const m = s.match(/^(\d+(?:,\d+)?)/);
  return m ? Number(m[1].replace(',', '.')) : null;
}

// ---------------------------------------------------------------------------
// Familles de produits (données initiales v2)
// ---------------------------------------------------------------------------

export interface SeedFamily { id: string; name: string; categoryId: string; substitution: SubstitutionMode; notes?: string }

const f = (id: string, name: string, categoryId: string, substitution: SubstitutionMode, notes?: string): SeedFamily => ({ id: `fam-${id}`, name, categoryId, substitution, notes });

/**
 * Règles d'équivalence par défaut, modifiables dans l'application :
 * « interchangeable » seulement quand toute variante convient à un besoin générique ; « à confirmer » quand
 * les variantes ne conviennent pas toujours aux mêmes recettes ou profils ; « non » pour un simple regroupement.
 */
export const FAMILIES: SeedFamily[] = [
  f('ail', 'Ail', 'cat-legumes', 'interchangeable'),
  f('aubergines', 'Aubergines', 'cat-legumes', 'interchangeable'),
  f('brocoli', 'Brocoli', 'cat-legumes', 'interchangeable'),
  f('carottes', 'Carottes', 'cat-legumes', 'interchangeable'),
  f('citrons', 'Citrons', 'cat-legumes', 'interchangeable'),
  f('concombres', 'Concombres', 'cat-legumes', 'interchangeable'),
  f('courgettes', 'Courgettes', 'cat-legumes', 'interchangeable'),
  f('gingembre', 'Gingembre', 'cat-legumes', 'interchangeable'),
  f('gombo', 'Gombo', 'cat-legumes', 'à confirmer', 'Frais ou surgelé : à confirmer selon la recette.'),
  f('haricots-verts', 'Haricots verts', 'cat-legumes', 'à confirmer', 'Frais ou surgelés : à confirmer selon la recette.'),
  f('oignons', 'Oignons', 'cat-legumes', 'interchangeable'),
  f('poivrons', 'Poivrons', 'cat-legumes', 'interchangeable', 'Rouges, verts ou jaunes : interchangeables pour un besoin générique.'),
  f('salades', 'Salades', 'cat-legumes', 'à confirmer'),
  f('tomates', 'Tomates', 'cat-legumes', 'non', 'Fraîches et en conserve ne sont pas interchangeables (les conserves sont exclues du plat de GM).'),
  f('epinards', 'Épinards', 'cat-legumes', 'à confirmer'),
  f('avocats', 'Avocats', 'cat-fruits', 'interchangeable'),
  f('bananes', 'Bananes', 'cat-fruits', 'interchangeable'),
  f('clementines', 'Clémentines et mandarines', 'cat-fruits', 'interchangeable'),
  f('oranges', 'Oranges', 'cat-fruits', 'interchangeable'),
  f('pommes', 'Pommes', 'cat-fruits', 'interchangeable'),
  f('mangues', 'Mangues', 'cat-fruits', 'interchangeable'),
  f('poires', 'Poires', 'cat-fruits', 'interchangeable'),
  f('raisins', 'Raisins', 'cat-fruits', 'interchangeable', 'Raisins frais verts, rouges ou noirs : interchangeables. Les raisins secs, exclus pour GM, ne remplacent jamais des raisins frais.'),
  f('haricots-secs', 'Haricots secs', 'cat-legumineuses', 'à confirmer'),
  f('oeufs', 'Œufs', 'cat-oeufs', 'interchangeable'),
  f('poulet', 'Poulet', 'cat-viandes', 'à confirmer', 'Morceaux différents (cuisses, poitrine) : à confirmer. Le poulet doit rester sans peau pour GM.'),
  f('poissons-blancs', 'Poissons blancs', 'cat-poissons', 'à confirmer', 'Poissons maigres : à confirmer. Les poissons gras sont exclus pour GM.'),
  f('lentilles', 'Lentilles', 'cat-legumineuses', 'interchangeable'),
  f('thon', 'Thon en conserve', 'cat-poissons', 'interchangeable'),
  f('attieke', 'Attiéké', 'cat-feculents', 'interchangeable'),
  f('plantain', 'Banane plantain', 'cat-feculents', 'interchangeable'),
  f('avoine', 'Flocons d’avoine', 'cat-feculents', 'interchangeable'),
  f('igname', 'Igname', 'cat-feculents', 'interchangeable'),
  f('pain', 'Pain', 'cat-feculents', 'à confirmer', 'Le pain complet est demandé pour GM : une autre variante est seulement proposée.'),
  f('patates-douces', 'Patates douces', 'cat-feculents', 'interchangeable'),
  f('pommes-de-terre', 'Pommes de terre', 'cat-feculents', 'interchangeable'),
  f('riz', 'Riz', 'cat-feculents', 'à confirmer'),
  f('pates', 'Pâtes', 'cat-feculents', 'à confirmer'),
  f('lait', 'Lait', 'cat-laitiers', 'à confirmer', 'Le lait entier est exclu pour GM.'),
  f('yaourts', 'Yaourts', 'cat-laitiers', 'à confirmer', 'Nature et aux fruits appartiennent à la même famille mais ne conviennent pas aux mêmes profils (le sucre est exclu pour GM).'),
  f('fromage-blanc', 'Fromage blanc', 'cat-laitiers', 'à confirmer'),
  f('cubes', 'Cubes de bouillon', 'cat-epices', 'interchangeable'),
  f('huiles', 'Huiles', 'cat-huiles', 'non', 'Huile d’olive, de palme et de friture ne sont pas interchangeables.'),
  f('moutarde', 'Moutarde', 'cat-epices', 'interchangeable'),
  f('epices-base', 'Épices de base', 'cat-epices', 'interchangeable'),
  f('epices-extra', 'Épices extra', 'cat-epices', 'interchangeable'),
  f('piment', 'Piment', 'cat-epices', 'interchangeable'),
  f('sauce-soya', 'Sauce soya', 'cat-epices', 'à confirmer'),
  f('vinaigre', 'Vinaigre', 'cat-epices', 'à confirmer'),
  f('bissap', 'Bissap', 'cat-boissons', 'interchangeable'),
  f('edulcorant', 'Édulcorant', 'cat-epices', 'interchangeable'),
  f('graines', 'Graines (chia, lin)', 'cat-feculents', 'interchangeable'),
  f('noix', 'Noix', 'cat-feculents', 'à confirmer'),
  f('papier-toilette', 'Papier toilette', 'cat-papier', 'interchangeable'),
  f('essuie-tout', 'Essuie-tout', 'cat-papier', 'interchangeable'),
  f('savon', 'Savon', 'cat-hygiene', 'interchangeable'),
  f('dentifrice', 'Dentifrice', 'cat-hygiene', 'interchangeable'),
  f('shampoing', 'Shampoing', 'cat-hygiene', 'interchangeable'),
  f('lessive', 'Lessive', 'cat-nettoyage', 'interchangeable'),
  f('vaisselle', 'Liquide vaisselle', 'cat-nettoyage', 'interchangeable'),
  f('nettoyant', 'Nettoyant multi-usage', 'cat-nettoyage', 'interchangeable'),
  f('sacs-poubelle', 'Sacs-poubelle', 'cat-menager', 'interchangeable'),
];

/** Famille, variante et format d'achat de chaque produit du catalogue : [famille, variante, format]. */
export const PRODUCT_FAMILY: Record<string, [string, string?, string?]> = {
  'p-ail': ['ail'], 'p-aubergine': ['aubergines'], 'p-brocoli': ['brocoli'], 'p-carotte': ['carottes'], 'p-citron': ['citrons'],
  'p-concombre': ['concombres'], 'p-courgette': ['courgettes'], 'p-gingembre': ['gingembre'],
  'p-gombo': ['gombo', 'surgelé', 'paquet 300 g'], 'p-haricots-verts': ['haricots-verts', 'frais'], 'p-oignon': ['oignons'],
  'p-poivron': ['poivrons'], 'p-salade': ['salades', 'verte', 'botte'], 'p-tomate': ['tomates', 'fraîches'], 'p-epinards': ['epinards', 'frais', 'sac'],
  'p-avocat': ['avocats'], 'p-banane': ['bananes'], 'p-clementine': ['clementines'], 'p-orange': ['oranges'], 'p-pomme': ['pommes'],
  'p-mangue': ['mangues'], 'p-poire': ['poires'],
  'p-haricots-secs': ['haricots-secs', 'secs'], 'p-oeufs': ['oeufs'], 'p-poulet': ['poulet', 'cuisses et pilons sans peau'],
  'p-tilapia': ['poissons-blancs', 'tilapia surgelé'], 'p-lentilles': ['lentilles', 'sèches'], 'p-thon': ['thon', 'au naturel', 'boîte'],
  'p-attieke': ['attieke'], 'p-plantain': ['plantain'], 'p-avoine': ['avoine'], 'p-igname': ['igname'],
  'p-pain': ['pain', 'complet tranché', 'pain'], 'p-patate-douce': ['patates-douces'], 'p-pdt': ['pommes-de-terre'],
  'p-riz': ['riz', 'basmati'], 'p-spaghetti': ['pates', 'spaghetti'],
  'p-lait': ['lait', 'demi-écrémé'], 'p-yaourt': ['yaourts', 'nature 0 %', 'pot 750 g'], 'p-fromage-blanc': ['fromage-blanc', '0 %', 'pot 500 g'],
  'p-maggi': ['cubes', 'Maggi'], 'p-huile-olive': ['huiles', 'olive', 'bouteille'], 'p-huile-palme': ['huiles', 'palme rouge', 'bouteille'],
  'p-huile-friture': ['huiles', 'végétale (friture)', 'bouteille'], 'p-moutarde': ['moutarde', 'naturelle', 'pot'],
  'p-epices': ['epices-base'], 'p-piment': ['piment'], 'p-soya': ['sauce-soya', 'réduite en sel', 'bouteille'], 'p-vinaigre': ['vinaigre', 'de cidre', 'bouteille'],
  'p-epices-extra': ['epices-extra'], 'p-bissap': ['bissap', 'sec', 'sac 200 g'], 'p-edulcorant': ['edulcorant'],
  'p-graines': ['graines', 'chia ou lin', 'sac 150 g'], 'p-noix': ['noix', 'non salées', 'sac 200 g'],
  'p-papier-toilette': ['papier-toilette'], 'p-essuie-tout': ['essuie-tout'], 'p-savon': ['savon'], 'p-dentifrice': ['dentifrice'],
  'p-shampoing': ['shampoing'], 'p-lessive': ['lessive'], 'p-vaisselle': ['vaisselle'], 'p-nettoyant': ['nettoyant'], 'p-sacs-poubelle': ['sacs-poubelle'],
};
