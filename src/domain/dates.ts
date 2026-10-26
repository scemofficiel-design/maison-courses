import type { ISODate } from './types';

/** Dates civiles manipulées sans fuseau horaire (midi local pour éviter les décalages d'heure d'été). */
export function parseDate(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day, 12, 0, 0);
}

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = parseDate(d);
  x.setDate(x.getDate() + n);
  return toISODate(x);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

/** 0 = lundi … 6 = dimanche. */
export function weekdayIndex(d: ISODate): number {
  return (parseDate(d).getDay() + 6) % 7;
}

export function startOfWeek(d: ISODate): ISODate {
  return addDays(d, -weekdayIndex(d));
}

export function nextMonday(from: ISODate): ISODate {
  const w = weekdayIndex(from);
  return addDays(from, w === 0 ? 7 : 7 - w);
}

export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const longFmt = new Intl.DateTimeFormat('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
const shortFmt = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short' });

export function formatDateLong(d: ISODate): string {
  const s = longFmt.format(parseDate(d));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDateShort(d: ISODate): string {
  return shortFmt.format(parseDate(d));
}

export function isWithin(d: ISODate, start?: ISODate, end?: ISODate): boolean {
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}
