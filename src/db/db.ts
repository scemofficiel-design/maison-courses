import Dexie, { type Table } from 'dexie';
import type {
  Budget, Category, DietProfile, Location, MealLog, MealPlan, MetaRecord, Person, PlannedMeal, Product, Purchase, Recipe,
  Settings, ShoppingLine, ShoppingList, StockMovement, Substitution,
} from '../domain/types';

export const DB_NAME = 'maison-courses';
/** Version du schéma de données (incluse dans les sauvegardes). */
export const SCHEMA_VERSION = 1;

export class MaisonDB extends Dexie {
  categories!: Table<Category, string>;
  locations!: Table<Location, string>;
  products!: Table<Product, string>;
  movements!: Table<StockMovement, string>;
  persons!: Table<Person, string>;
  profiles!: Table<DietProfile, string>;
  plans!: Table<MealPlan, string>;
  recipes!: Table<Recipe, string>;
  meals!: Table<PlannedMeal, string>;
  mealLogs!: Table<MealLog, string>;
  lists!: Table<ShoppingList, string>;
  lines!: Table<ShoppingLine, string>;
  purchases!: Table<Purchase, string>;
  budgets!: Table<Budget, string>;
  substitutions!: Table<Substitution, string>;
  settings!: Table<Settings, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name = DB_NAME) {
    super(name);
    // Toute évolution du modèle ajoute une nouvelle version ici, avec une fonction .upgrade() si
    // les données existantes doivent être transformées. Ne jamais modifier une version publiée.
    this.version(1).stores({
      categories: 'id, kind, order',
      locations: 'id, order',
      products: 'id, categoryId, locationId, name, seedKey, barcode',
      movements: 'id, productId, at, &key, sourceId',
      persons: 'id, active',
      profiles: 'id',
      plans: 'id, active',
      recipes: 'id, category, name',
      meals: 'id, date, planId, status, [date+slot]',
      mealLogs: 'id, plannedMealId, &key',
      lists: 'id, status, planId',
      lines: 'id, listId, productId',
      purchases: 'id, listId, lineId, &key',
      budgets: 'id, planId',
      substitutions: 'id',
      settings: 'id',
      meta: 'key',
    });
  }
}

export const TABLE_NAMES = [
  'categories', 'locations', 'products', 'movements', 'persons', 'profiles', 'plans', 'recipes', 'meals', 'mealLogs',
  'lists', 'lines', 'purchases', 'budgets', 'substitutions', 'settings', 'meta',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export let db = new MaisonDB();

/** Remplace la base active (tests uniquement). */
export function useDatabase(instance: MaisonDB) {
  db = instance;
}
