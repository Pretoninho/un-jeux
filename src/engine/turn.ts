// Orchestration d'un tour (memo : ordre du tour, spec §5).
//   actions des acteurs → résolution marché → carry/coût du levier → appels de
//   marge → mise à jour de F → test de crise → avance de cascade → comptabilité.

import type { GameState, ActorState, Position } from './state';
import { makeRng, type Rng } from './rng';
import type { Policy, PlannedAction } from './policy';
import { PA_PAR_TOUR } from '../data/actions';
import { deriveRegime } from './regime';
import { resolveMarket } from './market';
import { actorWealth, applyMarginCalls, positionValue, dirSign, lockTurnsLeft } from './portfolio';
import { updateFragility, maybeTriggerCrisis, advanceCrisis } from './fragility';
import { computeSignals } from './signals';
import { bcReact, bcMeets, refreshBook, accrueCoupons, settleMatured, resolveCouponDefaults, openCouponPosition } from './credit';

const PA_COST: Record<string, number> = {
  RESERVER: 0, ouvrir: 1, renforcer: 1, cloture_partielle: 2, fermer: 1, ouvrir_coupon: 1,
};

/** Le boost « Récolte » (Vautour) est-il actif pour cet acteur ce tour-ci ? */
function carryBoostMult(actor: ActorState, state: GameState): number {
  return state.turn <= (actor.carryBoostUntil ?? -1) ? actor.carrySkill?.factor ?? 1 : 1;
}

function executeAction(actor: ActorState, action: PlannedAction, state: GameState, flux: Record<string, number>): void {
  if (action.verb === 'RESERVER') return;

  if (action.verb === 'COMPETENCE') {
    // « Récolte » (Vautour) : si la compétence est prête, arme le boost et pose le cooldown.
    const sk = actor.carrySkill;
    if (!sk || state.turn < (actor.carrySkillReadyAt ?? 0)) return;
    actor.carryBoostUntil = state.turn + sk.duration - 1; // actif `duration` tours, dès ce tour
    actor.carrySkillReadyAt = state.turn + sk.duration + sk.cooldown; // réutilisable après le cooldown
    return;
  }

  if (action.op === 'ouvrir_coupon') {
    // Crédit hors-V : on prend un coupon OFFERT (issuer + maturité) du carnet.
    const offered = state.credit.book.find((c) => c.issuer === action.issuer && c.maturity === action.maturity);
    if (!offered) return;
    // Taille verrouillée, bornée par la réserve sèche (le long la paie, le short la pose
    // en garantie implicite — pas de short non borné).
    const notional = Math.min(action.notional, actor.cash);
    if (notional <= 0) return;
    const res = openCouponPosition(state.credit, offered.id, action.direction, notional);
    if (!res) return;
    actor.cash += res.entryCash; // long −U, short +U
    actor.couponPositions.push(res.position);
    return;
  }

  const m = state.market[action.hexId];
  if (!m) return;

  if (action.op === 'ouvrir' || action.op === 'renforcer') {
    // Ouvrir = nouvelle position ; Renforcer = exposition additionnelle (memo §9bis).
    const equity = Math.min(action.equity, actor.cash);
    if (equity <= 0) return;
    const hex = state.map.hexes.find((h) => h.id === action.hexId);
    // Illiquidité (spec immo) : long-only (pas de short) et SANS levier (option a → pas
    // d'appel de marge sur un asset bloqué). `entryTurn` arme le verrou de sortie.
    const direction = hex?.longOnly ? 'long' : action.direction;
    const leverage = hex?.illiquid ? 0 : action.leverage;
    actor.cash -= equity;
    actor.positions.push({ hexId: action.hexId, direction, equity, leverage, entryV: m.V, entryTurn: state.turn });
    const sign = direction === 'short' ? -1 : 1; // long = achat (+), short = vente (−)
    flux[action.hexId] = (flux[action.hexId] ?? 0) + sign * equity * (1 + leverage);
  } else if (action.op === 'cloture_partielle') {
    if (lockTurnsLeft(action.hexId, actor, state) > 0) return; // position illiquide encore verrouillée
    // Allège de moitié chaque position de l'hexe (memo §9bis).
    for (const pos of actor.positions) {
      if (pos.hexId !== action.hexId) continue;
      actor.cash += 0.5 * Math.max(0, positionValue(pos, m.V));
      flux[action.hexId] = (flux[action.hexId] ?? 0) - dirSign(pos) * 0.5 * pos.equity * (1 + pos.leverage);
      pos.equity *= 0.5;
    }
  } else if (action.op === 'fermer') {
    if (lockTurnsLeft(action.hexId, actor, state) > 0) return; // position illiquide encore verrouillée
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
    const mult = carryBoostMult(actor, state); // « Récolte » (Vautour) : ×factor si actif
    for (const pos of actor.positions) {
      const notional = pos.equity * (1 + pos.leverage);
      actor.cash += notional * (carryOf.get(pos.hexId) ?? 0) * mult; // carry (boosté si Récolte active)
      actor.cash -= pos.equity * pos.leverage * state.params.leverageBorrowRate * borrowMult; // coût d'emprunt
    }
  }
}

/**
 * Cycle de vie du crédit-coupons sur un tour (spec crédit-coupons §4-7). Joué APRÈS la
 * mise à jour de fragilité (la BC réagit au F du tour ; le défaut frappe en crise) et
 * AVANT la comptabilité (les flux de coupons entrent dans le cash avant le mark-to-market).
 */
function runCreditLifecycle(state: GameState, rng: Rng): void {
  // 1. Banque centrale : fonction de réaction LISIBLE au F caché (monte en surchauffe,
  //    coupe en crise) → le ton de la BC trahit F (quasi-4ᵉ signal). En mode réunions
  //    (bcMeetingEvery > 1) le taux n'est révisé qu'aux réunions — et de façon DÉCISIVE
  //    (saut à la cible, smoothing=1 : à la réunion la BC pose le taux où F l'exige) ;
  //    figé entre deux. En continu (=1) on garde le lissage θ historique.
  const every = state.params.bcMeetingEvery;
  if (bcMeets(state.turn, every)) {
    bcReact(state.credit.bc, state.fragility, state.crisis.active, state.params, every > 1 ? 1 : state.params.bcSmoothing);
  }

  // 2. Par acteur : défauts (en crise crédit) → portage → échéances (vrai bond).
  const inCreditCrisis = state.crisis.active; // toute crise systémique touche le crédit (M domine)
  for (const actor of state.actors) {
    const def = resolveCouponDefaults(actor.couponPositions, state.fragility, inCreditCrisis, rng, state.params);
    actor.couponPositions = def.survivors; // les défauts disparaissent (long perd U, short gagne U)
    actor.cash += accrueCoupons(actor.couponPositions) * carryBoostMult(actor, state); // long encaisse, short paie ; décrémente le RCE (boosté si Récolte active)
    const mat = settleMatured(actor.couponPositions);
    actor.cash += mat.cash; // long récupère U, short rend U
    actor.couponPositions = mat.survivors;
  }

  // 3. Rollover : on réémet les coupons consommés/expirés au contexte BC/F COURANT
  //    (taux/maturité différents → risque de réinvestissement, spec §5).
  refreshBook(state.credit, state.map, state.fragility, state.params);
}

/** Indice de marché passif du tour (benchmark, memo §27.2) : equal-weight des `V`.
 *  ALPHA PUR (spec crédit-coupons §9) : le crédit a quitté le monde V → il n'est PAS dans
 *  le benchmark. Les décisions de coupons sont jugées contre « ne rien faire ». */
function benchmarkLevel(state: GameState): number {
  let sum = 0;
  let n = 0;
  for (const hex of state.map.hexes) {
    if (hex.kind !== 'marche' || hex.cluster === 'credit') continue;
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
      const cost = action.verb === 'COMPETENCE'
        ? (actor.carrySkill?.paCost ?? 3)
        : PA_COST[action.verb === 'RESERVER' ? 'RESERVER' : action.op] ?? 1;
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

  // 4bis. Crédit-coupons : BC réagit à F, portage/défaut/échéance, rollover du carnet.
  runCreditLifecycle(state, rng);

  // 4ter. Carry du cash en réserve (viabilité hoarder, PATH B) : la poudre sèche au-dessus
  //   de la franchise gagne le taux directeur r_BC. APRÈS la réaction BC (taux du tour à
  //   jour), AVANT la comptabilité de richesse (entre dans wealthHistory ce tour-ci).
  accrueCashCarry(state);

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

/**
 * Carry du cash en réserve (PATH B). La trésorerie non déployée au-dessus de la franchise
 * `cashCarryFloor` encaisse le taux directeur r_BC (le cash gagne le taux sans risque).
 * Neutre : s'applique à TOUS les acteurs (le seuil fait le tri, seul un gros cash est payé).
 * Ne touche pas F (couche richesse). r_BC < carry risqué en régime calme → la réserve reste
 * un pari perdant en moyenne, mais gagnant dans les krachs (la BC coupe peu, le cash survit).
 */
function accrueCashCarry(state: GameState): void {
  const r = state.credit.bc.rate;
  if (r <= 0) return;
  const floor = state.params.cashCarryFloor;
  for (const actor of state.actors) {
    const base = actor.cash - floor;
    if (base > 0) actor.cash += r * base;
  }
}

function avgCarry(state: GameState): number {
  let sum = 0;
  let n = 0;
  for (const hex of state.map.hexes) {
    if (hex.kind !== 'marche' || hex.cluster === 'credit') continue; // alpha pur : crédit hors benchmark
    sum += hex.carry ?? 0;
    n++;
  }
  return n ? sum / n : 0;
}
