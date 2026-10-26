export function uid(prefix = ''): string {
  const c = globalThis.crypto;
  const id = c && 'randomUUID' in c ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${id}` : id;
}

/** Horloge injectable pour les tests. */
let clock: () => Date = () => new Date();
export function setClock(fn: () => Date) {
  clock = fn;
}
export function nowISO(): string {
  return clock().toISOString();
}
export function nowDate(): Date {
  return clock();
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
