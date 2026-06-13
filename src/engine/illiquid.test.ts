// Illiquidité des hexes immobiliers (spec immobilier) : long-only, sans levier, verrou
// de sortie de `lockupTurns` tours, contournable par un pouvoir d'archétype.

import { describe, it, expect } from 'vitest';
import { buildInitialState } from './init';
import { runTurn } from './turn';
import { alwaysReserve, type Policy, type PlannedAction } from './policy';
import { presetMvp } from '../data/config-mvp';

const SEED = 1;
const scripted = (actions: PlannedAction[]): Policy => {
  let done = false;
  return { id: 's', decide: () => (done ? [{ verb: 'RESERVER' }] : ((done = true), actions)) };
};
const always = (actions: PlannedAction[]): Policy => ({ id: 'a', decide: () => actions });
const OPEN_IMMO: PlannedAction = { verb: 'POSITIONNER', op: 'ouvrir', hexId: 'IMMO', equity: 30, leverage: 0, direction: 'long' };
const CLOSE_IMMO: PlannedAction = { verb: 'POSITIONNER', op: 'fermer', hexId: 'IMMO' };

describe('immobilier — long-only & sans levier (spec immo, option a)', () => {
  it('un ordre SHORT sur l’immo est forcé en LONG (on ne short pas un immeuble)', () => {
    const { state, rng } = buildInitialState(presetMvp(SEED));
    runTurn(state, [scripted([{ ...OPEN_IMMO, direction: 'short' }]), alwaysReserve, alwaysReserve], rng);
    const pos = state.actors[0]!.positions.find((p) => p.hexId === 'IMMO');
    expect(pos?.direction).toBe('long');
  });

  it('le levier est forcé à 0 sur l’immo (pas d’appel de marge sur un asset bloqué)', () => {
    const { state, rng } = buildInitialState(presetMvp(SEED));
    runTurn(state, [scripted([{ ...OPEN_IMMO, leverage: 4 }]), alwaysReserve, alwaysReserve], rng);
    const pos = state.actors[0]!.positions.find((p) => p.hexId === 'IMMO');
    expect(pos?.leverage).toBe(0);
  });
});

describe('immobilier — verrou de sortie', () => {
  it('la position ne peut être fermée qu’après lockupTurns, puis se ferme', () => {
    const { state, rng } = buildInitialState(presetMvp(SEED));
    runTurn(state, [scripted([OPEN_IMMO]), alwaysReserve, alwaysReserve], rng); // ouverture au tour 1
    const entryTurn = state.actors[0]!.positions[0]!.entryTurn!;
    const L = state.params.lockupTurns;
    expect(entryTurn).toBe(1);

    // On tente de fermer à CHAQUE tour ; ça doit no-op tant que verrouillé.
    let closedAt = -1;
    for (let k = 0; k < 6 && closedAt < 0; k++) {
      runTurn(state, [always([CLOSE_IMMO]), alwaysReserve, alwaysReserve], rng);
      if (!state.actors[0]!.positions.some((p) => p.hexId === 'IMMO')) closedAt = state.turn;
    }
    // Verrouillé pendant L tours → fermable au tour entryTurn + L.
    expect(closedAt).toBe(entryTurn + L);
  });

  it('un archétype `ignoreLockup` ferme immédiatement (pouvoir d’archétype)', () => {
    const { state, rng } = buildInitialState(presetMvp(SEED));
    state.actors[0]!.ignoreLockup = true;
    runTurn(state, [scripted([OPEN_IMMO]), alwaysReserve, alwaysReserve], rng); // ouverture tour 1
    expect(state.actors[0]!.positions.some((p) => p.hexId === 'IMMO')).toBe(true);
    runTurn(state, [always([CLOSE_IMMO]), alwaysReserve, alwaysReserve], rng); // tour 2 : fermeture autorisée
    expect(state.actors[0]!.positions.some((p) => p.hexId === 'IMMO')).toBe(false);
  });

  it('un hexe liquide (actions) n’est jamais verrouillé', () => {
    const { state, rng } = buildInitialState(presetMvp(SEED));
    const OPEN_LC: PlannedAction = { verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: 30, leverage: 0, direction: 'long' };
    runTurn(state, [scripted([OPEN_LC]), alwaysReserve, alwaysReserve], rng);
    runTurn(state, [always([{ verb: 'POSITIONNER', op: 'fermer', hexId: 'LC_US' }]), alwaysReserve, alwaysReserve], rng);
    expect(state.actors[0]!.positions.some((p) => p.hexId === 'LC_US')).toBe(false); // fermé au 1er essai
  });
});
