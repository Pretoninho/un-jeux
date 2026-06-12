// Fonction de réaction des IA (memo §16) — politique générique pilotée par les
// paramètres de comportement du profil (data). UNE implémentation, N profils.
//
// Règle anti-script absolue : l'IA ne voit JAMAIS F ni l'ancre A. Elle agit sur
// des OBSERVABLES BRUITÉS — la volatilité perçue (lecture bruitée de F) et une
// estimation bruitée de l'ancre (plancher irréductible, §25.2). Elle est donc
// derrière la courbe : ses erreurs (et sa contribution à la fragilité) émergent.

import type { GameState, ActorState } from './state';
import type { ProfilIA, HexId } from './types';
import type { Rng } from './rng';
import type { Policy, PlannedAction } from './policy';
import { alwaysReserve } from './policy';

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Volatilité PERÇUE = lecture bruitée de F (avec le mensonge du rebond, §24.2). */
function perceivedVolatility(state: GameState, rng: Rng): number {
  const detune = state.crisis.active && state.crisis.phase === 'bounce' ? state.params.bounceDetune : 0;
  return clamp01(state.fragility - detune + rng.gauss() * state.params.signalNoiseVol);
}

/** Estimation BRUITÉE de l'ancre A (plancher irréductible, §25.2). */
function estimateAnchor(trueA: number, rng: Rng, noiseFloor: number): number {
  return trueA * (1 + rng.gauss() * noiseFloor);
}

const investableHexes = (state: GameState): HexId[] =>
  state.map.hexes.filter((h) => h.kind === 'marche').map((h) => h.id);

/** Hexe le plus monté (proxy de momentum : V le plus haut). */
function hottestHex(state: GameState): HexId | undefined {
  let best: HexId | undefined;
  let bestV = -Infinity;
  for (const id of investableHexes(state)) {
    const v = state.market[id]?.V ?? 0;
    if (v > bestV) { bestV = v; best = id; }
  }
  return best;
}

/** Hexe le plus décoté selon l'ESTIMATION bruitée de l'ancre. */
function mostUndervalued(state: GameState, rng: Rng): { hexId: HexId; decote: number } | undefined {
  let best: { hexId: HexId; decote: number } | undefined;
  for (const id of investableHexes(state)) {
    const m = state.market[id];
    if (!m) continue;
    const aEst = estimateAnchor(m.A, rng, state.params.anchorNoiseFloor);
    const decote = (aEst - m.V) / aEst;
    if (!best || decote > best.decote) best = { hexId: id, decote };
  }
  return best;
}

/** Construit la politique d'un profil. Sans `behavior` → reste en réserve. */
export function policyForProfile(profile: ProfilIA): Policy {
  const b = profile.behavior;
  if (!b) return alwaysReserve;

  return {
    id: `ai:${profile.id}`,
    decide(actor: ActorState, state: GameState, rng: Rng): PlannedAction[] {
      if (b.entrySignal === 'momentum') {
        const risk = perceivedVolatility(state, rng);
        if (risk < b.riskTolerance && actor.cash > 1) {
          const target = hottestHex(state);
          if (target) {
            return [{ verb: 'POSITIONNER', op: 'ouvrir', hexId: target, equity: actor.cash * b.sizing, leverage: b.leverageAppetite }];
          }
        }
        // Risque perçu trop haut : on réduit LENTEMENT (le « trop tard »).
        if (actor.positions.length > 0 && rng.chance(b.deRiskRate)) {
          return [{ verb: 'POSITIONNER', op: 'fermer', hexId: actor.positions[0]!.hexId }];
        }
        return [{ verb: 'RESERVER' }];
      }

      // entrySignal === 'value' : achète la décote, sans levier, ne panique pas.
      if (actor.cash > 1) {
        const pick = mostUndervalued(state, rng);
        if (pick && pick.decote > b.decoteThreshold) {
          return [{ verb: 'POSITIONNER', op: 'ouvrir', hexId: pick.hexId, equity: actor.cash * b.sizing, leverage: 0 }];
        }
      }
      return [{ verb: 'RESERVER' }];
    },
  };
}
