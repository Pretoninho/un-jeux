import { describe, it, expect } from 'vitest';
import { buildInitialState } from './init';
import { maybeTriggerCrisis, advanceCrisis } from './fragility';
import { resolveMarket } from './market';
import { makeRng } from './rng';
import { presetMvp } from '../data/config-mvp';
import type { GameState } from './state';

function triggeredState(seed: number): { state: GameState; rng: ReturnType<typeof makeRng> } {
  const { state, rng } = buildInitialState(presetMvp(seed));
  state.fragility = 0.9; // ≥ plafond → déclenchement certain (memo §23.4)
  maybeTriggerCrisis(state, rng);
  return { state, rng };
}

describe('cascade de crise (memo §24)', () => {
  it('déclenche et entre en leg1 avec des durées dans les plages', () => {
    const { state } = triggeredState(3);
    expect(state.crisis.active).toBe(true);
    expect(state.crisis.phase).toBe('leg1');
    const d = state.crisis.durations;
    expect(d.leg1).toBeGreaterThanOrEqual(1);
    expect(d.bounce).toBeGreaterThanOrEqual(1);
    expect(d.leg3).toBeGreaterThanOrEqual(1);
  });

  it('enchaîne leg1 → bounce → leg3 quand ce n’est pas un vrai plancher', () => {
    const { state, rng } = triggeredState(5);
    state.crisis.isRealFloor = false;
    const phases = new Set<string>();
    for (let k = 0; k < 20 && (state.crisis.active || state.crisis.recoveryTurnsLeft > 0); k++) {
      state.turn += 1;
      advanceCrisis(state, rng);
      if (state.crisis.active) phases.add(state.crisis.phase);
    }
    expect(phases.has('leg1')).toBe(true);
    expect(phases.has('bounce')).toBe(true);
    expect(phases.has('leg3')).toBe(true);
  });

  it('saute la leg3 quand le rebond est un vrai plancher (§24.2)', () => {
    const { state, rng } = triggeredState(5);
    state.crisis.isRealFloor = true;
    let sawLeg3 = false;
    for (let k = 0; k < 20 && state.crisis.active; k++) {
      state.turn += 1;
      advanceCrisis(state, rng);
      if (state.crisis.active && state.crisis.phase === 'leg3') sawLeg3 = true;
    }
    expect(sawLeg3).toBe(false);
    expect(state.crisis.active).toBe(false);
    expect(state.crisis.recoveryTurnsLeft).toBeGreaterThan(0); // fenêtre de recovery ouverte
  });

  it('reset F ∝ amplitude à la résolution (memo §23.5)', () => {
    const { state, rng } = triggeredState(8);
    const amplitude = state.crisis.amplitude;
    for (let k = 0; k < 30 && state.crisis.active; k++) {
      state.turn += 1;
      advanceCrisis(state, rng);
    }
    expect(state.fragility).toBeCloseTo(state.params.resetFactor * amplitude, 6);
  });
});

describe('le bull trap se matérialise en P&L (memo §24)', () => {
  // Rendement moyen du marché sur un tour, dans une phase donnée.
  function meanReturnInPhase(phase: 'leg1' | 'bounce'): number {
    let sum = 0;
    const seeds = 40;
    for (let s = 0; s < seeds; s++) {
      const { state } = buildInitialState(presetMvp(100 + s));
      state.regime = 'crise';
      state.crisis = {
        active: true, phase, triggeredTurn: 0, amplitude: 0.9,
        durations: { leg1: 1, bounce: 2, leg3: 2 }, bounceRecovery: 0.4,
        isRealFloor: false, phaseTurnsLeft: 2, recoveryTurnsLeft: 0,
      };
      const before = Object.values(state.market).map((m) => m.V);
      resolveMarket(state, {}, makeRng(7000 + s));
      const after = Object.values(state.market).map((m) => m.V);
      const ret = after.reduce((a, v, i) => a + (v / before[i]! - 1), 0) / after.length;
      sum += ret;
    }
    return sum / seeds;
  }

  it('la première jambe chute, le rebond remonte', () => {
    expect(meanReturnInPhase('leg1')).toBeLessThan(0);
    expect(meanReturnInPhase('bounce')).toBeGreaterThan(0);
  });
});
