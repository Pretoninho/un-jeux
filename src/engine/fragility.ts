// Jauge de fragilité F (memo §23). CACHÉE. Alimentée par les comportements
// agrégés (levier, crowding, valorisations tendues), désamorcée par la réversion.
// La purge est intrinsèquement symétrique et proportionnelle aux parts de capital
// (§29.1) car l'accumulation dépend du NIVEAU agrégé : baisser son levier réduit
// l'accumulation à hauteur de sa part — pas de forfait individuel.

import type { GameState } from './state';
import type { Rng } from './rng';
import { PARAM_RANGES } from './params';
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

/**
 * Tente de déclencher une crise (memo §24). La FORME de la cascade est tirée
 * PAR CRISE (durées, ampleur du rebond, vrai-plancher-ou-piège) → deux crises
 * d'une même partie diffèrent, pas de script intra-partie.
 */
export function maybeTriggerCrisis(state: GameState, rng: Rng): boolean {
  if (state.crisis.active) return false;
  const p = crisisProbability(state);
  if (rng.chance(p)) {
    const pr = state.params;
    state.crisis = {
      active: true,
      phase: 'leg1',
      triggeredTurn: state.turn,
      amplitude: state.fragility, // amplitude = F au déclenchement (§23.5)
      durations: {
        leg1: Math.round(rng.range(PARAM_RANGES.cascadeLeg1Turns.min, PARAM_RANGES.cascadeLeg1Turns.max)),
        bounce: Math.round(rng.range(PARAM_RANGES.cascadeBounceTurns.min, PARAM_RANGES.cascadeBounceTurns.max)),
        leg3: Math.round(rng.range(PARAM_RANGES.cascadeLeg3Turns.min, PARAM_RANGES.cascadeLeg3Turns.max)),
      },
      bounceRecovery: rng.range(PARAM_RANGES.bounceRecovery.min, PARAM_RANGES.bounceRecovery.max),
      isRealFloor: rng.chance(pr.realFloorProbability), // ~30% : le rebond EST le plancher (§24.2)
      phaseTurnsLeft: 0, // fixé au démarrage de leg1 (tour suivant)
      recoveryTurnsLeft: 0,
    };
    state.crisis.phaseTurnsLeft = state.crisis.durations.leg1;
    state.crisisTurns.push(state.turn);
    return true;
  }
  return false;
}

/** Résout la fin de cascade : reset de F ∝ amplitude (§23.5) + fenêtre de recovery. */
function resolveCascade(state: GameState, rng: Rng): void {
  state.fragility = state.params.resetFactor * state.crisis.amplitude; // purge quasi-totale
  const recovery = Math.round(rng.range(PARAM_RANGES.recoveryTurns.min, PARAM_RANGES.recoveryTurns.max));
  state.crisis.active = false;
  state.crisis.phase = 'none';
  state.crisis.recoveryTurnsLeft = recovery;
}

/**
 * Fait avancer la cascade (memo §24) : leg1 → rebond → (leg3 OU vrai plancher) →
 * recovery. Le tour de déclenchement ne consomme pas de phase (la chute démarre
 * au tour suivant).
 */
export function advanceCrisis(state: GameState, rng: Rng): void {
  const c = state.crisis;
  if (!c.active) {
    if (c.recoveryTurnsLeft > 0) c.recoveryTurnsLeft -= 1; // décompte de la recovery
    return;
  }
  if (c.triggeredTurn === state.turn) return; // déclenché ce tour : on n'avance pas encore

  c.phaseTurnsLeft -= 1;
  if (c.phaseTurnsLeft > 0) return;

  if (c.phase === 'leg1') {
    c.phase = 'bounce';
    c.phaseTurnsLeft = c.durations.bounce;
  } else if (c.phase === 'bounce') {
    if (c.isRealFloor) {
      resolveCascade(state, rng); // le rebond était le vrai plancher : pas de leg3
    } else {
      c.phase = 'leg3';
      c.phaseTurnsLeft = c.durations.leg3;
    }
  } else if (c.phase === 'leg3') {
    resolveCascade(state, rng);
  }
}
