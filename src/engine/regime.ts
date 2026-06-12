// Régimes émergents (memo §15) — dérivés de F et de la tendance, JAMAIS scriptés.
// Aucune séquence garantie : une partie calme peut rester en bull tout du long.

import type { GameState, Regime } from './state';

/**
 * Régime du tour, dérivé de l'état. La crise (et la recovery qui suit) priment ;
 * sinon c'est une lecture du niveau de fragilité.
 */
export function deriveRegime(state: GameState): Regime {
  if (state.crisis.active) return 'crise';
  // Fenêtre de recovery juste après la résolution d'une cascade (memo §24).
  if (state.crisis.recoveryTurnsLeft > 0) return 'recovery';

  const { fragility, params } = state;
  // bull tant que la fragilité est sous la zone morte ; tension quand ça chauffe.
  return fragility < params.crisisDeadZone ? 'bull' : 'tension';
}
