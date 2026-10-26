/**
 * Modèle de données de Maison & Courses.
 *
 * Chaque entité possède un identifiant texte stable. Les entités issues des données
 * initiales (plan familial, catalogue, recettes) portent un `seedKey` : cela permet de
 * mettre à jour ou de réinitialiser les données de démonstration sans toucher aux
 * données créées par l'utilisateur.
 */

export type ID = string;
/** Date civile au format AAAA-MM-JJ (sans fuseau horaire). */
export type ISODate = string;
/** Horodatage ISO 8601 complet. */
export type Timestamp = string;

export interface BaseEntity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Clé de la donnée initiale d'origine, absente pour les données créées par l'utilisateur. */
  seedKey?: string;
  /** Vrai dès que l'utilisateur modifie une donnée initiale : elle ne sera plus écrasée par une mise à jour. */
  userModified?: boolean;
}

// ---------------------------------------------------------------------------
// Unités
// ---------------------------------------------------------------------------

export type Unit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'L'
  | 'unité'
  | 'douzaine'
  | 'paquet'
  | 'bouteille'
  | 'boîte'
  | 'pot'
  | 'sac'
  | 'botte'
  | 'tête'
  | 'tranche'
  | 'rouleau'
  | 'pain'
  | 'morceau'
  | 'c. à soupe'
  | 'c. à café'
  | 'pincée'
  | 'bol';

/** Conversion propre à un produit : 1 `unit` du produit = `amount` `to`. Ex. 1 paquet = 300 g. */
export interface UnitConversion {
  unit: Unit;
  amount: number;
  to: Unit;
}

// ---------------------------------------------------------------------------
// Inventaire
// ---------------------------------------------------------------------------

export type CategoryKind = 'alimentaire' | 'maison';

export interface Category extends BaseEntity {
  name: string;
  icon: string;
  kind: CategoryKind;
  order: number;
}

export interface Location extends BaseEntity {
  name: string;
  icon: string;
  order: number;
}

export type PriceStatus = 'document' | 'estimé' | 'vérifié';

export interface Product extends BaseEntity {
  name: string;
  categoryId: ID;
  locationId?: ID;
  unit: Unit;
  /**
   * Quantité actuelle. `null` = quantité inconnue (on ne sait pas ce qu'il reste),
   * ce qui est différent de 0 (il n'en reste plus).
   */
  quantity: number | null;
  minQuantity?: number;
  targetQuantity?: number;
  purchaseDate?: ISODate;
  expiryDate?: ISODate;
  /** Prix estimé pour 1 `unit`. */
  unitPrice?: number;
  priceStatus?: PriceStatus;
  priceSource?: string;
  currency: string;
  store?: string;
  notes?: string;
  essential: boolean;
  perishable: boolean;
  /** Étiquettes servant au contrôle des restrictions (ex. « poisson-gras », « sucre »). */
  tags: string[];
  /** Conversions vers d'autres unités (ex. 1 paquet = 300 g). */
  conversions?: UnitConversion[];
  /** Format de vente pour l'arrondi des achats, exprimé dans l'unité du produit (ex. 0,5 kg). */
  purchaseStep?: number;
  /** Consommation habituelle indicative par semaine, dans l'unité du produit. */
  usualWeeklyConsumption?: number;
  barcode?: string;
  archived?: boolean;
}

export type MovementType =
  | 'création'
  | 'achat'
  | 'consommation'
  | 'ajustement'
  | 'épuisé'
  | 'inconnu'
  | 'perte'
  | 'périmé'
  | 'déplacement'
  | 'annulation';

export interface StockMovement {
  id: ID;
  productId: ID;
  type: MovementType;
  /** Variation de quantité (positive ou négative). `null` quand la quantité devient inconnue. */
  delta: number | null;
  before: number | null;
  after: number | null;
  unit: Unit;
  at: Timestamp;
  note?: string;
  sourceType?: 'achat' | 'repas' | 'manuel';
  sourceId?: ID;
  /** Clé d'idempotence unique : empêche d'appliquer deux fois la même opération. */
  key: string;
  /** Identifiant du mouvement qui annule celui-ci. */
  reversedBy?: ID;
  /** Identifiant du mouvement annulé par celui-ci. */
  reverses?: ID;
  fromLocationId?: ID;
  toLocationId?: ID;
}

// ---------------------------------------------------------------------------
// Personnes, profils alimentaires, plans
// ---------------------------------------------------------------------------

export interface Person extends BaseEntity {
  name: string;
  photo?: string;
  active: boolean;
  profileIds: ID[];
  likes: string[];
  dislikes: string[];
  allergies: string[];
  goals?: string;
  usualMeals?: string;
  notes?: string;
  startDate?: ISODate;
  endDate?: ISODate;
}

/** Rôle d'un ingrédient dans l'assiette, utilisé pour les portions individuelles. */
export type IngredientRole = 'féculent' | 'protéine' | 'légume' | 'sauce' | 'assaisonnement' | 'matière grasse' | 'laitage' | 'fruit' | 'boisson' | 'autre';

export type MealSlot = 'petit-déjeuner' | 'collation-matin' | 'déjeuner' | 'collation-après-midi' | 'dîner';

export type RuleKind =
  | 'éviter'
  | 'autorisé'
  | 'limite'
  | 'cuisson'
  | 'portion'
  | 'hydratation'
  | 'collation'
  | 'préparation'
  | 'substitution'
  | 'à confirmer'
  | 'note';

export interface DietRule {
  id: ID;
  kind: RuleKind;
  label: string;
  /** Pour « éviter » : étiquettes de produits interdites dans le plat de cette personne. */
  tags?: string[];
  /** Pour « cuisson » : modes de cuisson autorisés. */
  allowedMethods?: string[];
  /** Pour « limite » : étiquette concernée, plafond, unité et période. */
  limitTag?: string;
  max?: number;
  unit?: Unit;
  per?: 'repas' | 'jour';
  /** Vrai si la règle provient d'une prescription : sa modification affiche un avertissement. */
  prescription?: boolean;
  /** Origine de la règle (ex. « Plan PDF, page 3 »). */
  source?: string;
}

/** Portion de référence décrite dans la source (affichée au service, non convertie). */
export interface PortionRule {
  role: IngredientRole;
  label: string;
  amount?: number;
  amountMax?: number;
  unit?: Unit;
  state?: 'cuit' | 'cru' | 'tel quel';
  slots?: MealSlot[];
  /** Règle affichée seulement si le repas contient ce produit (ex. riz). */
  whenProductId?: ID;
  prescription?: boolean;
  source?: string;
}

/** Ajout individuel dans l'assiette d'une personne (ex. pain complet au dîner). */
export interface PlateAddition {
  slot: MealSlot;
  productId: ID;
  quantity: number;
  unit: Unit;
  label: string;
}

export interface DietProfile extends BaseEntity {
  name: string;
  description?: string;
  rules: DietRule[];
  portionRules: PortionRule[];
  /** Multiplicateur de portion par rôle, utilisé pour calculer les quantités (1 = portion de référence). */
  portionFactors: Partial<Record<IngredientRole, number>>;
  plateAdditions: PlateAddition[];
  /** Ambiguïtés et points à confirmer, conservés tels quels. */
  notes?: string;
  /** Le profil contient des règles issues d'une prescription. */
  hasPrescription?: boolean;
}

export interface PlanMember {
  personId: ID;
  profileIds: ID[];
}

/** Repas modèle d'un plan (semaine n, jour n). Il devient un repas planifié lorsque le plan démarre. */
export interface TemplateMeal {
  week: number; // 1..n
  weekday: number; // 0 = lundi … 6 = dimanche
  slot: MealSlot;
  title: string;
  recipeIds: ID[];
  notes?: string;
}

export interface ShoppingPeriod {
  index: number;
  label: string;
  /** Semaines couvertes (1-indexées). */
  weeks: number[];
}

export interface MealPlan extends BaseEntity {
  name: string;
  description?: string;
  active: boolean;
  startDate?: ISODate;
  endDate?: ISODate;
  durationWeeks?: number;
  members: PlanMember[];
  principles: string[];
  templateMeals: TemplateMeal[];
  periods: ShoppingPeriod[];
  /** Le plan est temporaire (ex. séjour d'un proche). */
  temporary?: boolean;
  /** Repas déjà générés dans le calendrier à partir du modèle. */
  materialized?: boolean;
  archivedAt?: Timestamp;
}

// ---------------------------------------------------------------------------
// Recettes et menus
// ---------------------------------------------------------------------------

export type ScalingMode = 'linéaire' | 'fixe' | 'modéré';

export interface RecipeIngredient {
  productId: ID;
  quantity: number;
  unit: Unit;
  role: IngredientRole;
  /** linéaire : proportionnel ; fixe : ne change pas ; modéré : épices et sel (croissance atténuée). */
  scaling: ScalingMode;
  optional?: boolean;
  /**
   * « Au goût » / produit de garde-manger : affiché et contrôlé par les restrictions, mais non compté
   * dans les besoins ni déduit du stock (réapprovisionné par son seuil minimal).
   */
  toTaste?: boolean;
  /** Si renseigné, l'ingrédient n'est ajouté que dans l'assiette de ces profils (quantité par personne). */
  onlyForProfileIds?: ID[];
  note?: string;
}

export type QuantitySource = 'document' | 'déduit du document' | 'indicatif';

export interface Recipe extends BaseEntity {
  name: string;
  category: string;
  photo?: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  difficulty: 'facile' | 'moyen' | 'difficile';
  ingredients: RecipeIngredient[];
  steps: string[];
  equipment?: string[];
  cookingMethods: string[];
  tags: string[];
  nutrition?: string;
  variants?: string;
  storage?: string;
  notes?: string;
  quantitySource: QuantitySource;
}

export type MealStatus = 'prévu' | 'validé' | 'préparé' | 'archivé';

export interface PlannedMeal extends BaseEntity {
  date: ISODate;
  slot: MealSlot;
  title: string;
  recipeIds: ID[];
  /** Personnes qui mangent ce repas. */
  personIds: ID[];
  planId?: ID;
  status: MealStatus;
  notes?: string;
  cookedAt?: Timestamp;
}

/** Consommation enregistrée après confirmation de la préparation d'un repas. */
export interface MealLog {
  id: ID;
  plannedMealId?: ID;
  title: string;
  at: Timestamp;
  consumed: { productId: ID; quantity: number; unit: Unit }[];
  movementIds: ID[];
  key: string;
  reversed?: boolean;
}

// ---------------------------------------------------------------------------
// Courses et budget
// ---------------------------------------------------------------------------

export type ListStatus = 'à préparer' | 'en cours' | 'terminée' | 'archivée';
export type LineStatus = 'à acheter' | 'acheté' | 'indisponible' | 'retiré';
export type Priority = 'essentiel' | 'optionnel';
export type LineSource = 'menus' | 'stock bas' | 'manuel' | 'document' | 'substitution';

export interface ShoppingList extends BaseEntity {
  name: string;
  plannedDate?: ISODate;
  periodStart?: ISODate;
  periodEnd?: ISODate;
  budget?: number;
  currency: string;
  store?: string;
  status: ListStatus;
  planId?: ID;
  periodIndex?: number;
  notes?: string;
}

export interface ShoppingLine extends BaseEntity {
  listId: ID;
  productId?: ID;
  name: string;
  categoryId?: ID;
  quantity: number;
  unit: Unit;
  /** Libellé de quantité original (ex. « 48 (4 dz) »), conservé pour les listes importées. */
  quantityLabel?: string;
  estUnitPrice?: number;
  estTotal?: number;
  priceStatus?: PriceStatus;
  actualQuantity?: number;
  actualPrice?: number;
  status: LineStatus;
  priority: Priority;
  source: LineSource;
  reasons: string[];
  /** Achat actif rattaché à cette ligne (idempotence). */
  purchaseId?: ID;
  substituteForLineId?: ID;
  stockUnknown?: boolean;
  note?: string;
  order: number;
}

export interface Purchase {
  id: ID;
  listId: ID;
  lineId: ID;
  productId?: ID;
  quantity: number;
  unit: Unit;
  price?: number;
  currency: string;
  at: Timestamp;
  movementId?: ID;
  key: string;
  reversed?: boolean;
}

export interface Budget extends BaseEntity {
  name: string;
  amount: number;
  currency: string;
  kind: 'cible' | 'économique' | 'libre';
  planId?: ID;
  periodIndex?: number;
  periodStart?: ISODate;
  periodEnd?: ISODate;
  source?: string;
}

/** Substitution documentée ou créée par l'utilisateur. */
export interface Substitution extends BaseEntity {
  fromLabel: string;
  toLabel: string;
  fromProductId?: ID;
  toProductId?: ID;
  reason: string;
  economy?: boolean;
  source?: string;
}

// ---------------------------------------------------------------------------
// Préférences et métadonnées
// ---------------------------------------------------------------------------

export type DashboardWidget =
  | 'today'
  | 'alerts'
  | 'shopping'
  | 'budget'
  | 'feasible'
  | 'profiles'
  | 'priority'
  | 'plan';

export interface Settings {
  id: 'app';
  currency: string;
  locale: 'fr';
  expiryWarningDays: number;
  dashboardWidgets: DashboardWidget[];
  lastExportAt?: Timestamp;
  exportReminderDays: number;
  aiEnabled: false;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}
