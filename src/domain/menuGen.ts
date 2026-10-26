import { addDays } from './dates';
import type { Feasibility } from './suggestions';
import type { ID, ISODate, MealSlot } from './types';

export interface Combo {
  title: string;
  recipeIds: ID[];
  slot: MealSlot;
}

export interface MenuProposal {
  date: ISODate;
  slot: MealSlot;
  title: string;
  recipeIds: ID[];
  why: string[];
}

export interface MenuGenOptions {
  start: ISODate;
  days: number;
  slots: MealSlot[];
  /** Créneaux déjà occupés « date|créneau » : jamais remplacés. */
  occupied: Set<string>;
  /** Titres déjà servis récemment, pour varier. */
  recentTitles?: string[];
  /** Privilégier les plats les moins chers. */
  economy?: boolean;
  /** Temps maximal de préparation (minutes). */
  maxMinutes?: number;
  /** Identifiants des recettes de féculents, pour éviter le même féculent deux jours de suite. */
  starchRecipeIds?: Set<ID>;
}

/**
 * Génère une proposition de menus pour les créneaux libres.
 * La proposition n'est jamais appliquée directement : l'interface la présente pour confirmation.
 */
export function proposeMenus(combos: Combo[], feasibility: (c: Combo) => Feasibility, opts: MenuGenOptions): MenuProposal[] {
  const out: MenuProposal[] = [];
  const used = new Map<string, number>();
  for (const t of opts.recentTitles ?? []) used.set(t, (used.get(t) ?? 0) + 1);
  const cache = new Map<string, Feasibility>();
  const feas = (c: Combo) => {
    const k = `${c.slot}|${c.title}`;
    let f = cache.get(k);
    if (!f) {
      f = feasibility(c);
      cache.set(k, f);
    }
    return f;
  };
  let lastStarch: ID | undefined;
  for (let i = 0; i < opts.days; i++) {
    const date = addDays(opts.start, i);
    let dayStarch: ID | undefined;
    for (const slot of opts.slots) {
      if (opts.occupied.has(`${date}|${slot}`)) continue;
      const candidates = combos.filter((c) => c.slot === slot);
      let best: { c: Combo; score: number; f: Feasibility } | undefined;
      for (const c of candidates) {
        const f = feas(c);
        if (f.violations.length) continue;
        if (opts.maxMinutes && f.minutes > opts.maxMinutes) continue;
        let score = f.coverage * 10 + f.priorityProducts.length * 4;
        score -= (used.get(c.title) ?? 0) * 6;
        score -= opts.economy ? f.extraCost * 0.5 : f.extraCost * 0.1;
        const starch = c.recipeIds.find((id) => opts.starchRecipeIds?.has(id));
        if (starch && (starch === lastStarch || starch === dayStarch)) score -= 3;
        if (!best || score > best.score) best = { c, score, f };
      }
      if (!best) continue;
      used.set(best.c.title, (used.get(best.c.title) ?? 0) + 1);
      const starch = best.c.recipeIds.find((id) => opts.starchRecipeIds?.has(id));
      if (starch) dayStarch = starch;
      const why = [...best.f.why];
      if (best.f.extraCost > 0) why.push(`Coût supplémentaire estimé : ${best.f.extraCost.toFixed(2)} $`);
      out.push({ date, slot, title: best.c.title, recipeIds: best.c.recipeIds, why });
    }
    lastStarch = dayStarch;
  }
  return out;
}
