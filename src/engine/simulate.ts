// Harness de simulation (memo §28). Joue des parties headless pour n'importe
// quelle ConfigPartie + politiques. C'est l'instrument du calibrage J7 :
// cibles de tempo (§28.2), critère signaux>horloge (§28.7), neutralité (§28.8).

import type { ConfigPartie } from './types';
import type { GameState, SignalReading } from './state';
import type { Policy } from './policy';
import { alwaysReserve } from './policy';
import { policyForProfile } from './ai';
import { buildInitialState } from './init';
import { runTurn } from './turn';
import { trackRecord, totalReturn, type TrackRecord } from './score';

export interface SimResult {
  seed: number;
  turns: number;
  crisisCount: number;
  crisisTurns: number[];
  finalFragility: number;
  fragilityHistory: number[];
  /** Signaux observés par tour (memo §23.6) — pour le critère J7 (§28.7). */
  signalsHistory: SignalReading[];
  /** Track Record par acteur (clé = id d'acteur). actors[0] = le joueur. */
  trackRecords: Record<string, TrackRecord>;
  playerTrackRecord: TrackRecord;
  /** Rendement total du benchmark = amplitude du marché sur la partie (§28, §28.6). */
  benchmarkReturn: number;
}

export interface SimOptions {
  /** Politiques par acteur (alignées sur l'ordre des acteurs). Défaut : tout-réserve. */
  policies?: Policy[];
}

/** Joue une partie complète et retourne l'état final. */
export function runGame(config: ConfigPartie, options: SimOptions = {}): GameState {
  const { state, rng } = buildInitialState(config);
  // Par défaut : le joueur (acteur 0) reste en réserve (bot-archétypes = J7) ; chaque
  // adversaire joue la fonction de réaction de son profil (memo §16). `options.policies`
  // peut tout surcharger (fixtures de test).
  const defaults: Policy[] = [alwaysReserve, ...config.adversaires.map((a) => policyForProfile(a))];
  const policies = state.actors.map((_, i) => options.policies?.[i] ?? defaults[i] ?? alwaysReserve);
  const horizon = state.params.horizonTurns;
  for (let t = 0; t < horizon; t++) runTurn(state, policies, rng);
  return state;
}

function resultFromState(state: GameState, seed: number): SimResult {
  const alpha = state.params.drawdownPenalty;
  const trackRecords: Record<string, TrackRecord> = {};
  for (const actor of state.actors) {
    trackRecords[actor.id] = trackRecord(actor, state.benchmarkHistory, alpha);
  }
  return {
    seed,
    turns: state.turn,
    crisisCount: state.crisisTurns.length,
    crisisTurns: [...state.crisisTurns],
    finalFragility: state.fragility,
    fragilityHistory: [...state.fragilityHistory],
    signalsHistory: [...state.signalsHistory],
    trackRecords,
    playerTrackRecord: trackRecords[state.actors[0]!.id]!,
    benchmarkReturn: totalReturn(state.benchmarkHistory),
  };
}

/** Joue N parties (seed = config.seed + i) et retourne les résultats. */
export function simulate(config: ConfigPartie, n: number, options: SimOptions = {}): SimResult[] {
  const results: SimResult[] = [];
  for (let i = 0; i < n; i++) {
    const state = runGame({ ...config, seed: config.seed + i }, options);
    results.push(resultFromState(state, config.seed + i));
  }
  return results;
}
