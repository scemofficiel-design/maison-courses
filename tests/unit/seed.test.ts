import { describe, expect, it } from 'vitest';
import { buildSeed } from '../../src/seed/build';
import { verifySeed } from '../../src/seed/verify';

describe('Vérification de l’importation du document (tests 17 et 18)', () => {
  const report = verifySeed(buildSeed('2026-10-26T00:00:00.000Z'));
  for (const c of report.checks) {
    it(`${c.label} — ${c.detail}`, () => {
      expect(c.ok, `${c.label} : ${c.detail}`).toBe(true);
    });
  }
  it('signale les interprétations et données non importées', () => {
    expect(report.notes.length).toBeGreaterThan(3);
  });
});
