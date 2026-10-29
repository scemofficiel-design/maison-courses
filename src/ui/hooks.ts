import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import { DEFAULT_SETTINGS } from '../db/entityOps';
import type { Category, ID, Location, Product, ProductFamily, Settings } from '../domain/types';
import { today } from '../domain/dates';

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get('app'), []) ?? DEFAULT_SETTINGS;
}

export interface Catalog {
  products: Product[];
  productById: Map<ID, Product>;
  categories: Category[];
  categoryById: Map<ID, Category>;
  locations: Location[];
  locationById: Map<ID, Location>;
  families: ProductFamily[];
  familyById: Map<ID, ProductFamily>;
  ready: boolean;
}

export function useCatalog(): Catalog {
  const products = useLiveQuery(() => db.products.toArray(), []);
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray(), []);
  const locations = useLiveQuery(() => db.locations.orderBy('order').toArray(), []);
  const families = useLiveQuery(() => db.families.toArray(), []);
  return useMemo(() => {
    const p = (products ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const f = (families ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return {
      products: p,
      productById: new Map(p.map((x) => [x.id, x])),
      categories: categories ?? [],
      categoryById: new Map((categories ?? []).map((c) => [c.id, c])),
      locations: locations ?? [],
      locationById: new Map((locations ?? []).map((l) => [l.id, l])),
      families: f,
      familyById: new Map(f.map((x) => [x.id, x])),
      ready: !!products && !!categories && !!locations && !!families,
    };
  }, [products, categories, locations, families]);
}

export function useToday() {
  return useMemo(() => today(), []);
}

/** Normalise un texte pour la recherche (sans accents ni majuscules). */
export function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
