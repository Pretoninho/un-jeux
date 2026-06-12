import { describe, it, expect } from 'vitest';
import { makeRng } from './rng';

describe('RNG seedé', () => {
  it('est reproductible : même seed ⇒ même séquence', () => {
    // Prérequis de tous les tests anti-script de J7 (parties rejouables).
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('diverge avec un seed différent', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() reste dans [0, 1)', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 1000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('int(min, max) respecte les bornes incluses', () => {
    const rng = makeRng(123);
    for (let i = 0; i < 1000; i++) {
      const x = rng.int(1, 3);
      expect(x).toBeGreaterThanOrEqual(1);
      expect(x).toBeLessThanOrEqual(3);
      expect(Number.isInteger(x)).toBe(true);
    }
  });
});
