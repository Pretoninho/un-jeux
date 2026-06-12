import { describe, it, expect } from 'vitest';
import { computeSignals, clockVsSignalPower } from './signals';
import { buildInitialState } from './init';
import { simulate } from './simulate';
import { steadyLong } from './policy';
import { makeRng } from './rng';
import { presetMvp } from '../data/config-mvp';
import type { GameState } from './state';

function stateAtF(F: number, history: number[] = [F]): GameState {
  const { state } = buildInitialState(presetMvp(1));
  state.fragility = F;
  state.fragilityHistory = history;
  return state;
}

const meanReading = (state: GameState, channel: 'volatilite', draws = 400): number => {
  let sum = 0;
  for (let i = 0; i < draws; i++) sum += computeSignals(state, makeRng(i + 1))[channel];
  return sum / draws;
};

describe('signaux (memo §23.6, §29.2)', () => {
  it('restent dans [0,1]', () => {
    const s = computeSignals(stateAtF(0.7), makeRng(1));
    for (const v of [s.volatilite, s.ecartCredit, s.financement]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('corrèlent avec F en moyenne, sans jamais le révéler exactement', () => {
    // Moyenne ≈ F (signal informatif) mais chaque lecture bruite (plancher irréductible).
    const state = stateAtF(0.6);
    expect(meanReading(state, 'volatilite')).toBeCloseTo(0.6, 1);
    const readings = new Set(
      Array.from({ length: 50 }, (_, i) => computeSignals(state, makeRng(i + 1)).volatilite),
    );
    expect(readings.size).toBeGreaterThan(40); // dispersion réelle → jamais une certitude
  });

  it('MENTENT pendant le rebond : la lecture passe sous le F réel (§24.2)', () => {
    const calm = stateAtF(0.8);
    const trap = stateAtF(0.8);
    trap.crisis = {
      active: true, phase: 'bounce', triggeredTurn: 0, amplitude: 0.8,
      durations: { leg1: 1, bounce: 2, leg3: 2 }, bounceRecovery: 0.4,
      isRealFloor: false, phaseTurnsLeft: 2, recoveryTurnsLeft: 0,
    };
    expect(meanReading(trap, 'volatilite')).toBeLessThan(meanReading(calm, 'volatilite'));
  });
});

describe('instrument horloge-vs-signaux (memo §28.7 — assertion stricte en J7)', () => {
  it('se calcule et renvoie des corrélations finies', () => {
    const res = simulate(presetMvp(1), 25, { policies: [steadyLong(4), steadyLong(4), steadyLong(4)] });
    const m = clockVsSignalPower(res);
    expect(m.n).toBeGreaterThan(0);
    expect(Number.isFinite(m.clockCorr)).toBe(true);
    expect(Number.isFinite(m.signalCorr)).toBe(true);
  });
});
