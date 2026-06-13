import { describe, it, expect } from 'vitest';
import { maxDrawdown, totalReturn, trackRecord } from './score';
import type { ActorState } from './state';

describe('Track Record (memo §27)', () => {
  it('maxDrawdown capte le pire repli pic-à-creux', () => {
    expect(maxDrawdown([100, 120, 60, 90])).toBeCloseTo(0.5, 6); // 120 → 60
    expect(maxDrawdown([100, 110, 120])).toBe(0); // monotone montant
  });

  it('totalReturn = premier → dernier', () => {
    expect(totalReturn([100, 130])).toBeCloseTo(0.3, 6);
  });

  it('pénalise le drawdown : à excédent égal, plus de drawdown = moins de score', () => {
    const bench = [1, 1.1];
    const calme: ActorState = { id: 'a', cash: 0, positions: [], couponPositions: [], wealthHistory: [100, 110] };
    const cahot: ActorState = { id: 'b', cash: 0, positions: [], couponPositions: [], wealthHistory: [100, 150, 70, 110] };
    const ra = trackRecord(calme, bench, 0.5);
    const rb = trackRecord(cahot, bench, 0.5);
    // Même rendement total (+10%) et même excédent, mais b a souffert un gros drawdown.
    expect(ra.excessReturn).toBeCloseTo(rb.excessReturn, 6);
    expect(rb.maxDrawdown).toBeGreaterThan(ra.maxDrawdown);
    expect(rb.score).toBeLessThan(ra.score);
  });

  it('un pic de gain n’est pas un drawdown (profil lumpy non puni, §27.1)', () => {
    // plat puis +60% d'un coup : aucun repli → drawdown nul.
    expect(maxDrawdown([100, 100, 100, 160])).toBe(0);
  });
});
