// Interface de décision d'un acteur. Les VRAIES IA (fonctions de réaction des
// profils, memo §16) arrivent en J4. Ici, seulement des politiques TRIVIALES qui
// servent de fixtures pour exercer le moteur et écrire les tests d'émergence.
//
// Note : une politique ne « voit » que ce qui est observable (son état, les `V`
// publics). L'état caché (F, ancres A) ne lui est jamais passé.

import type { ActorState, GameState } from './state';
import type { HexId } from './types';
import type { Rng } from './rng';
import type { CouponMaturity } from './credit';

export type Direction = 'long' | 'short';

export type PlannedAction =
  | { verb: 'RESERVER' }
  | { verb: 'POSITIONNER'; op: 'ouvrir'; hexId: HexId; equity: number; leverage: number; direction: Direction }
  | { verb: 'POSITIONNER'; op: 'renforcer'; hexId: HexId; equity: number; leverage: number; direction: Direction }
  | { verb: 'POSITIONNER'; op: 'cloture_partielle'; hexId: HexId }
  | { verb: 'POSITIONNER'; op: 'fermer'; hexId: HexId }
  // Ouvre une position sur un coupon offert (crédit hors-V) : long XOR short, taille
  // `notional` choisie une fois et verrouillée (spec crédit-coupons §6).
  | { verb: 'POSITIONNER'; op: 'ouvrir_coupon'; issuer: HexId; maturity: CouponMaturity; notional: number; direction: Direction }
  // Active la compétence d'archétype « Récolte » (Vautour) : coûte `paCost` PA, booste le carry.
  | { verb: 'COMPETENCE'; skill: 'carry_boost' };

export interface Policy {
  id: string;
  decide(actor: ActorState, state: GameState, rng: Rng): PlannedAction[];
}

const investableHexes = (state: GameState): HexId[] =>
  state.map.hexes.filter((h) => h.kind === 'marche' && h.cluster !== 'credit').map((h) => h.id);

/** Reste toujours en réserve (le hoarder pur). */
export const alwaysReserve: Policy = {
  id: 'always_reserve',
  decide: () => [{ verb: 'RESERVER' }],
};

/**
 * Déploie une fraction de son cash chaque tour sur un hexe au hasard, au levier
 * donné. `leverage > 0` = moteur de fragilité ; `leverage = 0` = investisseur sage.
 */
export function steadyLong(leverage: number, fraction = 0.25): Policy {
  return {
    id: leverage > 0 ? `leverage_${leverage}` : 'long_sans_levier',
    decide(actor, state, rng) {
      if (actor.cash < 1) return [{ verb: 'RESERVER' }];
      const hexes = investableHexes(state);
      const hexId = hexes[rng.int(0, hexes.length - 1)]!;
      const equity = actor.cash * fraction;
      return [{ verb: 'POSITIONNER', op: 'ouvrir', hexId, equity, leverage, direction: 'long' }];
    },
  };
}
