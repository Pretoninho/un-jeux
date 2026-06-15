// Tick économique (brique 4) — la PREMIÈRE boucle qui relie les briques entre elles.
//
// C'est ici que revenu (brique 2) et charges des camps (brique 3) se rencontrent :
//   net/tour = income(hexes + agglomération) − charges(camps)
//
// SI→ALORS du tour :
//   1. chaque acteur encaisse son income, paie ses charges → cash += net
//   2. SI cash < 0 après le tour → FAILLITE (éliminé, ses hexes redeviennent libres)
//
// Module PUR : prend un GameStateV2, rend un NOUVEAU GameStateV2 (immuable) + un rapport
// par acteur. Aucune mutation en place → testable, rejouable, déterministe.

import type { GameStateV2, ActorV2 } from './state2';
import { actorIncome, isCampHex } from './revenue';
import { actorCharges } from './camp';

/** Nombre d'hexes d'INCOME (hors QG) possédés par un acteur — base de l'upkeep. */
function incomeHexCount(state: GameStateV2, actorId: string): number {
  let n = 0;
  for (const h of state.map.hexes) {
    if (state.ownership[h.id] === actorId && !isCampHex(h.id, state.revenueCfg)) n++;
  }
  return n;
}

/** Charge totale d'un acteur/tour = charges des camps (dette) + upkeep × hexes d'income. */
export function actorTotalCharges(state: GameStateV2, actorId: string): number {
  return actorCharges(actorId, state.camps) + state.hexUpkeep * incomeHexCount(state, actorId);
}

/** Bilan d'un acteur pour un tour. */
export interface ActorTickReport {
  actorId: string;
  income: number;
  charges: number;
  net: number;
  cashBefore: number;
  cashAfter: number;
  /** A basculé en faillite CE tour-ci (transition, pas état persistant). */
  wentBankrupt: boolean;
}

export interface TickResult {
  state: GameStateV2;
  reports: ActorTickReport[];
}

/** Income net d'un acteur ce tour = revenu des hexes − charges totales (camps + upkeep). */
export function actorNet(state: GameStateV2, actorId: string): number {
  const income = actorIncome(actorId, state.ownership, state.map, state.revenueCfg);
  return income - actorTotalCharges(state, actorId);
}

/**
 * Avance la partie d'un tour. Chaque acteur vivant encaisse son net.
 * Un acteur dont le cash devient négatif fait faillite : il est marqué `bankrupt`,
 * ses hexes redeviennent libres, ses camps sont retirés (la dette meurt avec lui).
 */
export function tick(state: GameStateV2): TickResult {
  const reports: ActorTickReport[] = [];
  const newlyBankrupt = new Set<string>();

  const actors: ActorV2[] = state.actors.map((a) => {
    if (a.bankrupt) {
      // Déjà éliminé : on le laisse tel quel, pas de rapport.
      return a;
    }
    const income = actorIncome(a.id, state.ownership, state.map, state.revenueCfg);
    const charges = actorTotalCharges(state, a.id);
    const net = income - charges;
    const cashAfter = a.cash + net;
    const wentBankrupt = cashAfter < 0;

    reports.push({
      actorId: a.id,
      income,
      charges,
      net,
      cashBefore: a.cash,
      cashAfter: Math.max(0, cashAfter),
      wentBankrupt,
    });

    if (wentBankrupt) {
      newlyBankrupt.add(a.id);
      return { ...a, cash: 0, bankrupt: true };
    }
    return { ...a, cash: cashAfter };
  });

  // Libère les hexes (+ leurs ordres de vente) et purge les camps des acteurs coulés.
  const ownership = { ...state.ownership };
  const asks = { ...state.asks };
  if (newlyBankrupt.size > 0) {
    for (const id of Object.keys(ownership)) {
      if (ownership[id] && newlyBankrupt.has(ownership[id]!)) {
        ownership[id] = null;
        delete asks[id];
      }
    }
  }
  const camps = newlyBankrupt.size > 0
    ? state.camps.filter((c) => !newlyBankrupt.has(c.ownerId))
    : state.camps;

  return {
    state: { ...state, turn: state.turn + 1, actors, ownership, camps, asks },
    reports,
  };
}

/**
 * Conditions de fin (brique 4, version minimale) :
 *   - 'last_standing' : un seul acteur encore en vie → il gagne.
 *   - 'time'          : l'horloge a atteint `horizonTurns` → le plus riche gagne.
 *   - null            : la partie continue.
 */
export interface EndStatus {
  ended: boolean;
  reason: 'last_standing' | 'time' | null;
  winnerId: string | null;
}

/**
 * Conditions de fin. `wealthOf` mesure la richesse d'un acteur pour départager au temps
 * — par défaut le cash seul, mais le jeu passe la VALEUR NETTE (cash + territoire − dette)
 * pour que l'emprunt ne soit pas de l'argent gratuit (cf. game.ts `netWorth`).
 */
export function checkEnd(
  state: GameStateV2,
  horizonTurns: number,
  wealthOf: (actorId: string) => number = (id) => state.actors.find((a) => a.id === id)?.cash ?? 0,
): EndStatus {
  const live = state.actors.filter((a) => !a.bankrupt);

  if (live.length <= 1) {
    return { ended: true, reason: 'last_standing', winnerId: live[0]?.id ?? null };
  }
  if (state.turn >= horizonTurns) {
    const richest = live.reduce((best, a) => (wealthOf(a.id) > wealthOf(best.id) ? a : best), live[0]!);
    return { ended: true, reason: 'time', winnerId: richest.id };
  }
  return { ended: false, reason: null, winnerId: null };
}
