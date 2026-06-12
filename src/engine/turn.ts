// Orchestration d'un tour (memo : ordre du tour, spec §5).
//   actions des acteurs → résolution marché → carry/coût du levier → appels de
//   marge → mise à jour de F → test de crise → avance de cascade → comptabilité.

import type { GameState, ActorState, Position } from './state';
import { makeRng, type Rng } from './rng';
import type { Policy, PlannedAction } from './policy';
import { PA_PAR_TOUR } from '../data/actions';
import { deriveRegime } from './regime';
import { resolveMarket } from './market';
import { actorWealth, applyMarginCalls, positionValue, dirSign } from './portfolio';
import { updateFragility, maybeTriggerCrisis, advanceCrisis } from './fragility';
import { computeSignals } from './signals';

const PA_COST: Record<string, number> = {
  RESERVER: 0, ouvrir: 1, renforcer: 1, cloture_partielle: 2, fermer: 1,
};

function executeAction(actor: ActorState, action: PlannedAction, state: GameState, flux: Record<string, number>): void {
  if (action.verb === 'RESERVER') return;
  const m = state.market[action.hexId];
  if (!m) return;

  if (action.op === 'ouvrir' || action.op === 'renforcer') {
    // Ouvrir = nouvelle position ; Renforcer = exposition additionnelle (memo §9bis).
    const equity = Math.min(action.equity, actor.cash);
    if (equity <= 0) return;
    actor.cash -= equity;
    actor.positions.push({ hexId: action.hexId, direction: action.direction, equity, leverage: action.leverage, entryV: m.V });
    const sign = action.direction === 'short' ? -1 : 1; // long = achat (+), short = vente (−)
    flux[action.hexId] = (flux[action.hexId] ?? 0) + sign * equity * (1 + action.leverage);
  } else if (action.op === 'cloture_partielle') {
    // Allège de moitié chaque position de l'hexe (memo §9bis).
    for (const pos of actor.positions) {
      if (pos.hexId !== action.hexId) continue;
      actor.cash += 0.5 * Math.max(0, positionValue(pos, m.V));
      flux[action.hexId] = (flux[action.hexId] ?? 0) - dirSign(pos) * 0.5 * pos.equity * (1 + pos.leverage);
      pos.equity *= 0.5;
    }
  } else if (action.op === 'fermer') {
    const kept: Position[] = [];
    for (const pos of actor.positions) {
      if (pos.hexId === action.hexId) {
        actor.cash += Math.max(0, positionValue(pos, m.V));
        flux[action.hexId] = (flux[action.hexId] ?? 0) - dirSign(pos) * pos.equity * (1 + pos.leverage);
      } else kept.push(pos);
    }
    actor.positions = kept;
  }
}

/** Carry encaissé et coût du levier payé, par acteur (memo §25.5, §29.3). */
function accrueCarryAndCost(state: GameState): void {
  const carryOf = new Map(state.map.hexes.map((h) => [h.id, h.carry ?? 0]));
  for (const actor of state.actors) {
    const borrowMult = actor.borrowMultiplier ?? 1; // <1 = levier moins cher (présence PB)
    for (const pos of actor.positions) {
      const notional = pos.equity * (1 + pos.leverage);
      actor.cash += notional * (carryOf.get(pos.hexId) ?? 0); // carry
      actor.cash -= pos.equity * pos.leverage * state.params.leverageBorrowRate * borrowMult; // coût d'emprunt
    }
  }
}

/** Indice de marché passif du tour (benchmark, memo §27.2) : equal-weight des `V`. */
function benchmarkLevel(state: GameState): number {
  let sum = 0;
  let n = 0;
  for (const hex of state.map.hexes) {
    if (hex.kind !== 'marche') continue; // benchmark = hexes investissables non-frontière
    const m = state.market[hex.id];
    if (m) { sum += m.V; n++; }
  }
  return n ? sum / n : 0;
}

export function runTurn(state: GameState, policies: Policy[], rng: Rng): void {
  state.turn += 1;
  const flux: Record<string, number> = {};
  const benchBefore = benchmarkLevel(state);

  // 1. Décisions et exécution (budget PA borné par acteur).
  state.actors.forEach((actor, i) => {
    const policy = policies[i];
    if (!policy) return;
    let pa = PA_PAR_TOUR;
    for (const action of policy.decide(actor, state, rng)) {
      const cost = PA_COST[action.verb === 'RESERVER' ? 'RESERVER' : action.op] ?? 1;
      if (cost > pa) break;
      pa -= cost;
      executeAction(actor, action, state, flux);
    }
  });

  // 2. Régime émergent (lecture de l'état) puis résolution du marché.
  state.regime = deriveRegime(state);
  resolveMarket(state, flux, rng);

  // 3. Carry / coût du levier, puis appels de marge (contagion endogène).
  accrueCarryAndCost(state);
  applyMarginCalls(state, flux);

  // 4. Fragilité : streak, accumulation/purge, test de crise, avance de cascade.
  state.bullStreak = state.regime === 'bull' ? state.bullStreak + 1 : 0;
  updateFragility(state);
  maybeTriggerCrisis(state, rng);
  advanceCrisis(state, rng);
  state.fragilityHistory.push(state.fragility);

  // Signaux observés du tour (memo §23.6). RNG dédié, dérivé du seed+tour, pour ne
  // pas perturber la dynamique : les signaux sont purement observationnels.
  const sigRng = makeRng(state.rngSeed * 1000003 + state.turn);
  state.signalsHistory.push(computeSignals(state, sigRng));

  // 5. Comptabilité : benchmark (return + carry moyen) et richesse des acteurs.
  const benchAfter = benchmarkLevel(state);
  const meanCarry = avgCarry(state);
  const benchReturn = benchBefore > 0 ? benchAfter / benchBefore - 1 + meanCarry : 0;
  const lastBench = state.benchmarkHistory[state.benchmarkHistory.length - 1]!;
  state.benchmarkHistory.push(lastBench * (1 + benchReturn));

  for (const actor of state.actors) actor.wealthHistory.push(actorWealth(actor, state.market));
}

function avgCarry(state: GameState): number {
  let sum = 0;
  let n = 0;
  for (const hex of state.map.hexes) {
    if (hex.kind !== 'marche') continue;
    sum += hex.carry ?? 0;
    n++;
  }
  return n ? sum / n : 0;
}
