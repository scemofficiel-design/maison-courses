import { daysBetween, formatDateShort } from './dates';
import type { ID, ISODate, PlannedMeal, Product, Recipe, StockMovement } from './types';
import { roundNice } from './units';

export interface Forecast {
  /** Consommation hebdomadaire estimée, dans l'unité du produit. */
  weeklyRate: number;
  source: 'historique' | 'habitude déclarée';
  /** Jours restants estimés ; null si la quantité actuelle est inconnue. */
  daysLeft: number | null;
}

const CONSUMING: StockMovement['type'][] = ['consommation', 'perte', 'périmé'];

/**
 * Prévision indicative : basée sur l'historique des 60 derniers jours lorsqu'il existe,
 * sinon sur la consommation habituelle déclarée. Ce n'est jamais une quantité constatée.
 */
export function forecast(p: Product, movements: StockMovement[], nowISO: string): Forecast | null {
  const now = new Date(nowISO).getTime();
  const windowDays = 60;
  const mine = movements.filter((m) => m.productId === p.id && !m.reversedBy && !m.reverses);
  const consumed = mine
    .filter((m) => (CONSUMING.includes(m.type) || (m.type === 'ajustement' && (m.delta ?? 0) < 0)) && now - new Date(m.at).getTime() <= windowDays * 86_400_000)
    .reduce((s, m) => s + Math.abs(m.delta ?? 0), 0);
  const first = mine.reduce<number | null>((min, m) => {
    const t = new Date(m.at).getTime();
    return min === null || t < min ? t : min;
  }, null);
  let weeklyRate: number | null = null;
  let source: Forecast['source'] = 'historique';
  if (consumed > 0 && first !== null) {
    const spanDays = Math.min(windowDays, Math.max(7, (now - first) / 86_400_000));
    weeklyRate = (consumed / spanDays) * 7;
  } else if (p.usualWeeklyConsumption) {
    weeklyRate = p.usualWeeklyConsumption;
    source = 'habitude déclarée';
  }
  if (!weeklyRate) return null;
  const daysLeft = p.quantity === null ? null : Math.floor((p.quantity / weeklyRate) * 7);
  return { weeklyRate: roundNice(weeklyRate, 2), source, daysLeft };
}

export interface OverbuyInsight {
  productId: ID;
  purchased: number;
  consumed: number;
  lost: number;
}

/** Produits achetés au moins deux fois en 90 jours mais dont moins de la moitié a été consommée. */
export function overbought(products: Product[], movements: StockMovement[], nowISO: string): OverbuyInsight[] {
  const now = new Date(nowISO).getTime();
  const recent = movements.filter((m) => !m.reversedBy && !m.reverses && now - new Date(m.at).getTime() <= 90 * 86_400_000);
  const out: OverbuyInsight[] = [];
  for (const p of products) {
    const mine = recent.filter((m) => m.productId === p.id);
    const buys = mine.filter((m) => m.type === 'achat');
    if (buys.length < 2) continue;
    const purchased = buys.reduce((s, m) => s + (m.delta ?? 0), 0);
    const consumed = mine.filter((m) => m.type === 'consommation').reduce((s, m) => s + Math.abs(m.delta ?? 0), 0);
    const lost = mine.filter((m) => m.type === 'perte' || m.type === 'périmé').reduce((s, m) => s + Math.abs(m.delta ?? 0), 0);
    if (purchased > 0 && consumed < purchased * 0.5) out.push({ productId: p.id, purchased: roundNice(purchased), consumed: roundNice(consumed), lost: roundNice(lost) });
  }
  return out;
}

export interface BatchIdea {
  recipeId: ID;
  recipeName: string;
  dates: ISODate[];
  message: string;
}

/** Préparations groupées : une même recette prévue plusieurs fois à moins de 3 jours d'intervalle. */
export function batchCookingIdeas(meals: PlannedMeal[], recipes: Map<ID, Recipe>, from: ISODate, horizonDays = 7): BatchIdea[] {
  const upcoming = meals
    .filter((m) => m.status !== 'préparé' && m.status !== 'archivé' && m.date >= from && daysBetween(from, m.date) < horizonDays)
    .sort((a, b) => a.date.localeCompare(b.date));
  const byRecipe = new Map<ID, ISODate[]>();
  for (const m of upcoming) {
    for (const id of m.recipeIds) {
      const r = recipes.get(id);
      if (!r || r.cookMinutes < 20) continue;
      const list = byRecipe.get(id) ?? [];
      list.push(m.date);
      byRecipe.set(id, list);
    }
  }
  const out: BatchIdea[] = [];
  for (const [id, dates] of byRecipe) {
    for (let i = 0; i + 1 < dates.length; i++) {
      const gap = daysBetween(dates[i], dates[i + 1]);
      if (gap >= 0 && gap <= 2) {
        const r = recipes.get(id)!;
        const pair = [dates[i], dates[i + 1]];
        out.push({
          recipeId: id,
          recipeName: r.name,
          dates: pair,
          message: gap === 0
            ? `${r.name} est prévu deux fois le ${formatDateShort(pair[0])} : une seule cuisson suffit.`
            : `${r.name} est prévu le ${formatDateShort(pair[0])} et le ${formatDateShort(pair[1])} : cuire en une fois et conserver au frais.`,
        });
        break;
      }
    }
  }
  return out;
}
