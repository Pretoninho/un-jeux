// Jauge de fragilité F (memo §23). CACHÉE. Alimentée par les comportements
// agrégés (levier, crowding, valorisations tendues), désamorcée par la réversion.
// La purge est intrinsèquement symétrique et proportionnelle aux parts de capital
// (§29.1) car l'accumulation dépend du NIVEAU agrégé : baisser son levier réduit
// l'accumulation à hauteur de sa part — pas de forfait individuel.

import type { GameState } from './state';
import type { Rng } from './rng';
import { aggregateLeverageRatio, crowdingIndex } from './portfolio';
import { valuationStretch } from './market';

/** Variation de F sur un tour (peut être négative). */
export function fragilityDelta(state: GameState): number {
  const p = state.params;
  const accumulation =
    p.accLeverage * aggregateLeverageRatio(state) +
    p.accCrowding * crowdingIndex(state) +
    p.accValuation * valuationStretch(state) * 100; // l'étirement est petit ; échelle
  const purge = p.purgeMeanReversion;
  return accumulation - purge;
}

export function updateFragility(state: GameState): void {
  const next = state.fragility + fragilityDelta(state);
  state.fragility = Math.min(1, Math.max(0, next));
}

/**
 * Probabilité de déclenchement d'une crise ce tour (memo §23.4) :
 *   F < zone morte        → 0          (pas assez de combustible)
 *   zone morte ≤ F < plafond → k(F−dz)² (zone roulette, surprise)
 *   F ≥ plafond           → 1          (plafond déterministe)
 */
export function crisisProbability(state: GameState): number {
  const { fragility: F, params: p } = state;
  if (F < p.crisisDeadZone) return 0;
  if (F >= p.crisisCeiling) return 1;
  const d = F - p.crisisDeadZone;
  return Math.min(1, p.crisisK * d * d);
}

/** Tente de déclencher une crise. Retourne true si elle se déclenche. */
export function maybeTriggerCrisis(state: GameState, rng: Rng): boolean {
  if (state.crisis.active) return false;
  const p = crisisProbability(state);
  if (rng.chance(p)) {
    state.crisis = {
      active: true,
      triggeredTurn: state.turn,
      amplitude: state.fragility, // amplitude = F au déclenchement (§23.5)
      turnsLeft: 1, // durée minimale ; J3 remplacera par la cascade complète (§24)
    };
    state.crisisTurns.push(state.turn);
    return true;
  }
  return false;
}

/**
 * Fait avancer/terminer une crise active (version J2 : choc court à une phase).
 * J3 remplace par la morphologie complète (chute → rebond → vraie jambe, §24).
 * À la résolution : reset de F ∝ amplitude (§23.5), puis fenêtre de recovery.
 */
export function advanceCrisis(state: GameState): void {
  if (!state.crisis.active) {
    if (state.crisis.turnsLeft < 0) state.crisis.turnsLeft += 1; // décompte recovery
    return;
  }
  state.crisis.turnsLeft -= 1;
  if (state.crisis.turnsLeft <= 0) {
    state.fragility = state.params.resetFactor * state.crisis.amplitude; // purge quasi-totale
    state.crisis = { active: false, triggeredTurn: state.crisis.triggeredTurn, amplitude: 0, turnsLeft: -2 };
  }
}
