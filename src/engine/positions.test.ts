import { describe, it, expect } from 'vitest';
import { buildInitialState } from './init';
import { runTurn } from './turn';
import { alwaysReserve, type Policy, type PlannedAction } from './policy';
import { presetMvp } from '../data/config-mvp';

// Politique qui joue une liste d'actions fixée au premier tour, puis réserve.
function scripted(actions: PlannedAction[]): Policy {
  let done = false;
  return { id: 'scripted', decide: () => (done ? [{ verb: 'RESERVER' }] : ((done = true), actions)) };
}

function gameWith(actions: PlannedAction[]) {
  const { state, rng } = buildInitialState(presetMvp(1));
  runTurn(state, [scripted(actions), alwaysReserve, alwaysReserve], rng);
  return state;
}

describe('opérations de POSITIONNER (memo §9bis)', () => {
  it('Ouvrir crée une position et ponctionne la réserve', () => {
    const s = gameWith([{ verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: 40, leverage: 0, direction: 'long' }]);
    const player = s.actors[0]!;
    expect(player.positions.some((p) => p.hexId === 'LC_US')).toBe(true);
    expect(player.cash).toBeLessThan(100);
  });

  it('Clôture partielle réduit de moitié l’équity engagée sur l’hexe', () => {
    const s = gameWith([
      { verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: 40, leverage: 0, direction: 'long' },
      { verb: 'POSITIONNER', op: 'cloture_partielle', hexId: 'LC_US' },
    ]);
    const pos = s.actors[0]!.positions.find((p) => p.hexId === 'LC_US');
    expect(pos).toBeDefined();
    expect(pos!.equity).toBeCloseTo(20, 0); // 40 → ~20 (au mouvement de marché près)
  });

  it('Renforcer ajoute de l’exposition sur l’hexe', () => {
    const s = gameWith([
      { verb: 'POSITIONNER', op: 'ouvrir', hexId: 'IG_US', equity: 25, leverage: 0, direction: 'long' },
      { verb: 'POSITIONNER', op: 'renforcer', hexId: 'IG_US', equity: 25, leverage: 0, direction: 'long' },
    ]);
    const exposure = s.actors[0]!.positions.filter((p) => p.hexId === 'IG_US').length;
    expect(exposure).toBe(2); // deux apports d'exposition
  });
});
