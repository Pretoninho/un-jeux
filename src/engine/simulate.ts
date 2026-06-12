// Harness de simulation (memo §28). Joue des parties headless pour n'importe
// quelle ConfigPartie + politiques. C'est l'instrument du calibrage J7 :
// cibles de tempo (§28.2), critère signaux>horloge (§28.7), neutralité (§28.8).

import type { ConfigPartie } from './types';
import type { GameState } from './state';
import type { Policy } from './policy';
import { alwaysReserve } from './policy';
import { buildInitialState } from './init';
import { runTurn } from './turn';
import { trackRecord, type TrackRecord } from './score';

export interface SimResult {
  seed: number;
  turns: number;
  crisisCount: number;
  crisisTurns: number[];
  finalFragility: number;
  fragilityHistory: number[];
  /** Track Record par acteur (clé = id d'acteur). actors[0] = le joueur. */
  trackRecords: Record<string, TrackRecord>;
  playerTrackRecord: TrackRecord;
}

export interface SimOptions {
  /** Politiques par acteur (alignées sur l'ordre des acteurs). Défaut : tout-réserve. */
  policies?: Policy[];
}

/** Joue une partie complète et retourne l'état final. */
export function runGame(config: ConfigPartie, options: SimOptions = {}): GameState {
  const { state, rng } = buildInitialState(config);
  const policies = state.actors.map((_, i) => options.policies?.[i] ?? alwaysReserve);
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
    trackRecords,
    playerTrackRecord: trackRecords[state.actors[0]!.id]!,
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
