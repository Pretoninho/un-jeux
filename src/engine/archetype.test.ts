// Compétence d'archétype « Récolte » (Vautour) : carry ×factor pendant `duration` tours,
// puis cooldown. On vérifie que le boost s'applique bien au carry et que le cooldown est posé.

import { describe, it, expect } from 'vitest';
import { buildInitialState } from './init';
import { runTurn } from './turn';
import { alwaysReserve, type Policy } from './policy';
import { presetMvp } from '../data/config-mvp';
import type { ActorState } from './state';

// Donne au joueur une position V à carry connu (LC_US, carry 0.015) sans toucher au cash.
function seed(s: number) {
  const { state, rng } = buildInitialState(presetMvp(s));
  const player = state.actors[0]!;
  player.positions.push({ hexId: 'LC_US', direction: 'long', equity: 100, leverage: 0, entryV: state.market['LC_US']!.V, entryTurn: 0 });
  return { state, rng, player };
}

// Politique qui active la compétence au 1ᵉʳ tour (si prête), sinon réserve.
const activateThenReserve: Policy = {
  id: 'activate',
  decide: (actor: ActorState, state) =>
    actor.carrySkill && state.turn >= (actor.carrySkillReadyAt ?? 0)
      ? [{ verb: 'COMPETENCE', skill: 'carry_boost' }]
      : [{ verb: 'RESERVER' }],
};

describe('compétence « Récolte » (Vautour)', () => {
  it('le Vautour porte la compétence (donnée copiée à l’init)', () => {
    const { player } = seed(1);
    expect(player.carrySkill).toEqual({ factor: 2, duration: 2, cooldown: 12, paCost: 3 });
  });

  it('activée, elle MULTIPLIE le carry encaissé (×factor) au tour résolu', () => {
    // Deux runs identiques (même seed → même RNG), seul l'un active la compétence.
    const off = seed(5);
    runTurn(off.state, [alwaysReserve, alwaysReserve, alwaysReserve], off.rng);
    const on = seed(5);
    runTurn(on.state, [activateThenReserve, alwaysReserve, alwaysReserve], on.rng);
    // L'écart de cash ≈ carry supplémentaire = notionnel × carry × (factor − 1) = 100 × 0.015 × 1
    // (+ un cheveu de carry cash gagné sur ce surplus → tolérance large).
    const extra = on.player.cash - off.player.cash;
    expect(extra).toBeCloseTo(100 * 0.015 * (2 - 1), 1); // ~1.5, à 0.05 près
  });

  it('pose un cooldown : indisponible juste après l’activation', () => {
    const { state, rng, player } = seed(5);
    runTurn(state, [activateThenReserve, alwaysReserve, alwaysReserve], rng); // active au tour 1
    // Activé au tour 1 : réutilisable au tour 1 + duration(2) + cooldown(12) = 15.
    expect(player.carrySkillReadyAt).toBe(15);
    expect(player.carryBoostUntil).toBe(2); // boost actif tours 1 et 2
  });
});
