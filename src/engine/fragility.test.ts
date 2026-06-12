import { describe, it, expect } from 'vitest';
import { crisisProbability } from './fragility';
import type { GameState } from './state';

function stateWithF(F: number): GameState {
  // On ne renseigne que ce que crisisProbability lit (F + 3 paramètres).
  return {
    fragility: F,
    params: { crisisDeadZone: 0.4, crisisCeiling: 0.85, crisisK: 1.5 },
  } as unknown as GameState;
}

describe('déclencheur de crise (memo §23.4)', () => {
  it('proba nulle sous la zone morte', () => {
    expect(crisisProbability(stateWithF(0.2))).toBe(0);
    expect(crisisProbability(stateWithF(0.39))).toBe(0);
  });

  it('proba certaine au plafond', () => {
    expect(crisisProbability(stateWithF(0.85))).toBe(1);
    expect(crisisProbability(stateWithF(0.95))).toBe(1);
  });

  it('proba quadratique croissante dans la zone roulette', () => {
    const p06 = crisisProbability(stateWithF(0.6));
    const p07 = crisisProbability(stateWithF(0.7));
    expect(p06).toBeGreaterThan(0);
    expect(p07).toBeGreaterThan(p06); // monte avec F
    expect(p06).toBeCloseTo(1.5 * 0.2 * 0.2, 6); // k·(F−dz)²
  });
});
