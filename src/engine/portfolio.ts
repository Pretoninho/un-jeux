// Comptabilité des positions : richesse mark-to-market, levier et crowding
// agrégés (entrées de F, memo §23.2), appels de marge (memo §29.3).

import type { ActorState, GameState, Position } from './state';
import type { HexId } from './types';
import { couponPositionValue } from './credit';

/** Signe directionnel d'une position (+1 long, −1 short) — pour le flux/impact. */
export function dirSign(pos: Position): number {
  return pos.direction === 'short' ? -1 : 1;
}

/**
 * Verrou d'illiquidité (spec immobilier) : tours restants avant de pouvoir fermer une
 * position sur cet hexe. 0 = libre. La tranche la PLUS RÉCENTE fait foi (renforcer
 * re-verrouille). Un acteur `ignoreLockup` (pouvoir d'archétype) n'est jamais verrouillé.
 */
export function lockTurnsLeft(hexId: HexId, actor: ActorState, state: GameState): number {
  if (actor.ignoreLockup) return 0;
  const hex = state.map.hexes.find((h) => h.id === hexId);
  if (!hex?.illiquid) return 0;
  let unlock = 0;
  for (const pos of actor.positions) {
    if (pos.hexId === hexId) unlock = Math.max(unlock, (pos.entryTurn ?? 0) + state.params.lockupTurns);
  }
  return Math.max(0, unlock - state.turn);
}

/** Valeur mark-to-market de l'équity d'une position (peut devenir négative). */
export function positionValue(pos: Position, V: number): number {
  const notional = pos.equity * (1 + pos.leverage);
  // long : gagne si V monte ; short : gagne si V chute.
  const move = pos.direction === 'short' ? 1 - V / pos.entryV : V / pos.entryV - 1;
  return pos.equity + notional * move;
}

/** Richesse mark-to-market d'un acteur = cash + valeur des positions (planchée à 0). */
export function actorWealth(actor: ActorState, market: GameState['market']): number {
  let w = actor.cash;
  for (const pos of actor.positions) {
    const m = market[pos.hexId];
    if (m) w += Math.max(0, positionValue(pos, m.V));
  }
  // Coupons : long = pair (+U), short = dette (−U). PAS de plancher par position : la
  // dette du short est réelle (compensée par le cash reçu à l'entrée). Cf. credit.ts.
  for (const cp of actor.couponPositions) w += couponPositionValue(cp);
  return w;
}

/** Ratio de levier agrégé (memo §23.2) : capital emprunté / richesse totale. */
export function aggregateLeverageRatio(state: GameState): number {
  let borrowed = 0;
  let total = 0;
  for (const actor of state.actors) {
    for (const pos of actor.positions) borrowed += pos.equity * pos.leverage;
    total += actorWealth(actor, state.market);
  }
  return total > 0 ? borrowed / total : 0;
}

/**
 * Indice de crowding ∈ [0,1] (memo §23.2) : concentration du notionnel déployé
 * par cluster (Herfindahl normalisé sur 3 clusters). 0 = dispersé, 1 = tout au
 * même endroit.
 */
export function crowdingIndex(state: GameState): number {
  const byCluster: Record<string, number> = { credit: 0, actions: 0, alternatifs: 0 };
  let total = 0;
  const clusterOf = new Map<HexId, string>(
    state.map.hexes.map((h) => [h.id, h.cluster ?? 'actions']),
  );
  for (const actor of state.actors) {
    for (const pos of actor.positions) {
      const notional = pos.equity * (1 + pos.leverage);
      const cl = clusterOf.get(pos.hexId) ?? 'actions';
      byCluster[cl] = (byCluster[cl] ?? 0) + notional;
      total += notional;
    }
    // Le crédit a quitté le monde V : sa concentration vient des coupons (reach-for-yield).
    for (const cp of actor.couponPositions) {
      byCluster.credit = (byCluster.credit ?? 0) + cp.notional;
      total += cp.notional;
    }
  }
  if (total <= 0) return 0;
  const k = 3;
  let h = 0;
  for (const cl of Object.keys(byCluster)) {
    const share = (byCluster[cl] ?? 0) / total;
    h += share * share;
  }
  return Math.max(0, (h - 1 / k) / (1 - 1 / k)); // normalisé [0,1]
}

/**
 * Applique les appels de marge (memo §29.3) : une position dont la perte dépasse
 * le seuil est liquidée de force. La vente forcée est rendue dans `fluxByHex`
 * (négatif) → elle nourrit la contagion via l'impact-prix (memo §25.4). Endogène.
 */
export function applyMarginCalls(
  state: GameState,
  fluxByHex: Record<string, number>,
): void {
  const thr = state.params.marginCallThreshold;
  for (const actor of state.actors) {
    const survivors: Position[] = [];
    for (const pos of actor.positions) {
      const m = state.market[pos.hexId];
      if (!m) { survivors.push(pos); continue; }
      const notional = pos.equity * (1 + pos.leverage);
      const value = positionValue(pos, m.V);
      const lossFrac = notional > 0 ? -((value - pos.equity) / notional) : 0;
      if (pos.leverage > 0 && (value <= 0 || lossFrac >= thr)) {
        actor.cash += Math.max(0, value); // liquidation, on récupère ce qui reste
        // déboucler une position = flux de sens opposé (un long liquidé vend, un short rachète).
        fluxByHex[pos.hexId] = (fluxByHex[pos.hexId] ?? 0) - dirSign(pos) * notional;
      } else {
        survivors.push(pos);
      }
    }
    actor.positions = survivors;
  }
}
