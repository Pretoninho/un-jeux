// Le JEU — actions jouables sur GameStateV2 (brique « assemblage »).
//
// Fini les démos orphelines : il y a UN jeu, et chaque brique s'y branche.
// Ce module porte les VERBES du joueur (et de l'IA) sur l'état unifié :
//   - acquérir un hex LIBRE (achat au marché, prix ancré sur le revenu)
//   - emprunter (camp = capital + charge, selon le tronc)
//   - finir le tour (l'IA joue, puis le tick économique avance tout le monde)
//
// L'éviction d'un hex OCCUPÉ (rachat via le carnet d'ordres) viendra brancher
// `orderbook.ts` ICI même, brique suivante — pas dans une démo à part.
//
// Module PUR, immuable : chaque action rend un NOUVEAU GameStateV2.

import type { GameStateV2 } from './state2';
import { makeCamp, type Tronc } from './camp';
import { actorCharges } from './camp';
import { hexRevenue } from './revenue';
import { tick, type TickResult } from './tick';

export interface GameConfig {
  horizonTurns: number;
  /** Prix d'acquisition d'un hex libre = base × ce multiple (retour sur invest. en N tours). */
  claimMultiple: number;
  /** Prix d'ÉVICTION d'un hex occupé = revenu courant × ce multiple (> claim : l'assaillant surpaie). */
  evictMultiple: number;
  /** Charge d'un emprunt = ce taux × montant (Tronc A) ou × reliquat (Tronc B), par tour. */
  chargeRate: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  horizonTurns: 12,
  claimMultiple: 4,
  evictMultiple: 6,
  chargeRate: 0.1,
};

/** Prix pour acquérir un hex LIBRE (ancré sur son revenu de base). */
export function claimCost(state: GameStateV2, hexId: string, cfg: GameConfig): number {
  return (state.revenueCfg.baseByHex[hexId] ?? 0) * cfg.claimMultiple;
}

/** Peut-on acquérir cet hex ? Libre + acteur vivant + cash suffisant. */
export function canClaim(state: GameStateV2, actorId: string, hexId: string, cfg: GameConfig): boolean {
  const actor = state.actors.find((a) => a.id === actorId);
  if (!actor || actor.bankrupt) return false;
  if (state.ownership[hexId] !== null && state.ownership[hexId] !== undefined) return false;
  return actor.cash >= claimCost(state, hexId, cfg);
}

/** Acquiert un hex libre : débite le cash, pose la propriété. Sans effet si interdit. */
export function claimHex(state: GameStateV2, actorId: string, hexId: string, cfg: GameConfig): GameStateV2 {
  if (!canClaim(state, actorId, hexId, cfg)) return state;
  const cost = claimCost(state, hexId, cfg);
  return {
    ...state,
    actors: state.actors.map((a) => (a.id === actorId ? { ...a, cash: a.cash - cost } : a)),
    ownership: { ...state.ownership, [hexId]: actorId },
  };
}

/** Emprunte : ouvre un camp (capital + charge selon le tronc), crédite le cash. */
export function borrow(
  state: GameStateV2,
  actorId: string,
  amount: number,
  tronc: Tronc,
  cfg: GameConfig,
): GameStateV2 {
  const actor = state.actors.find((a) => a.id === actorId);
  if (!actor || actor.bankrupt || amount <= 0) return state;
  const camp = makeCamp(actorId, amount, tronc, cfg.chargeRate);
  return {
    ...state,
    actors: state.actors.map((a) => (a.id === actorId ? { ...a, cash: a.cash + amount } : a)),
    camps: [...state.camps, camp],
  };
}

// ─────────────────────── Éviction (brique 5 : possession) ─────────────────────
//
// Un hex OCCUPÉ ne s'acquiert pas au prix « libre » : il faut RACHETER la position de
// l'occupant. Le prix est ancré sur le revenu COURANT de l'hex (agglomération comprise)
// → un hex au cœur d'un cluster vaut plus cher à prendre = la « résistance » émerge des
// données (le siège est visible : tu vois le prix qu'il faut mettre). Transfert ZÉRO-SUM :
// l'assaillant paie, l'occupant encaisse, l'hex change de main. L'assaillant SURPAIE
// (evictMultiple > claimMultiple) : c'est son coût d'attaque, il parie sur le revenu futur.

/** Prix pour évincer l'occupant d'un hex (revenu courant × evictMultiple). */
export function evictionCost(state: GameStateV2, hexId: string, cfg: GameConfig): number {
  const rev = hexRevenue(hexId, state.ownership, state.map, state.revenueCfg);
  return Math.round(rev * cfg.evictMultiple);
}

/** Peut-on évincer ? Hex occupé par un AUTRE acteur, assaillant vivant, cash suffisant. */
export function canEvict(state: GameStateV2, buyerId: string, hexId: string, cfg: GameConfig): boolean {
  const occ = state.ownership[hexId];
  if (!occ || occ === buyerId) return false; // libre ou déjà à moi
  const buyer = state.actors.find((a) => a.id === buyerId);
  if (!buyer || buyer.bankrupt) return false;
  return buyer.cash >= evictionCost(state, hexId, cfg);
}

/** Évince l'occupant : transfert zéro-sum (acheteur → occupant), l'hex change de main. */
export function evict(state: GameStateV2, buyerId: string, hexId: string, cfg: GameConfig): GameStateV2 {
  if (!canEvict(state, buyerId, hexId, cfg)) return state;
  const occ = state.ownership[hexId]!;
  const cost = evictionCost(state, hexId, cfg);
  return {
    ...state,
    actors: state.actors.map((a) => {
      if (a.id === buyerId) return { ...a, cash: a.cash - cost };
      if (a.id === occ) return { ...a, cash: a.cash + cost };
      return a;
    }),
    ownership: { ...state.ownership, [hexId]: buyerId },
  };
}

// ─────────────────────── IA simple (un adversaire vivant) ─────────────────────

/** Liste des hexes libres, triés par meilleur retour sur investissement pour `actorId`. */
function freeHexesByValue(state: GameStateV2, actorId: string): string[] {
  const free = state.map.hexes.filter((h) => !state.ownership[h.id]);
  // Valeur = base + bonus d'agglomération potentiel (voisins déjà à moi).
  const score = (hexId: string) => {
    const base = state.revenueCfg.baseByHex[hexId] ?? 0;
    const hex = state.map.hexes.find((h) => h.id === hexId)!;
    const adj = hex.neighbors.filter((nb) => state.ownership[nb] === actorId).length;
    return base + state.revenueCfg.agglomerationBonus * adj;
  };
  return free.map((h) => h.id).sort((a, b) => score(b) - score(a));
}

/**
 * Tour d'IA « prudente » : garde une réserve pour couvrir ses charges, et achète
 * le meilleur hex abordable (priorité à l'agglomération). Achète tant qu'elle peut
 * en gardant une marge. Rend le nouvel état.
 */
export function aiTurn(state: GameStateV2, actorId: string, cfg: GameConfig): GameStateV2 {
  let s = state;
  const actor = s.actors.find((a) => a.id === actorId);
  if (!actor || actor.bankrupt) return s;

  // Achète en boucle tant qu'un hex est abordable en gardant 20 % de réserve.
  let safety = 8; // garde-fou anti-boucle
  while (safety-- > 0) {
    const me = s.actors.find((a) => a.id === actorId)!;
    const candidates = freeHexesByValue(s, actorId);
    const target = candidates.find((id) => {
      const cost = claimCost(s, id, cfg);
      return cost <= me.cash * 0.8; // garde une marge de cash
    });
    if (!target) break;
    s = claimHex(s, actorId, target, cfg);
  }

  // Puis tente UNE éviction rentable : un hex adverse adjacent à mes positions
  // (étend mon cluster), abordable en gardant de quoi couvrir 2 tours de charges.
  const me = s.actors.find((a) => a.id === actorId)!;
  const reserve = actorCharges(actorId, s.camps) * 2;
  const targets = s.map.hexes
    .filter((h) => {
      const owner = s.ownership[h.id];
      return owner && owner !== actorId && h.neighbors.some((nb) => s.ownership[nb] === actorId);
    })
    .map((h) => h.id)
    .filter((id) => canEvict(s, actorId, id, cfg) && me.cash - evictionCost(s, id, cfg) >= reserve)
    .sort((a, b) => evictionCost(s, b, cfg) - evictionCost(s, a, cfg)); // le plus juteux d'abord
  const evictTarget = targets[0];
  if (evictTarget) s = evict(s, actorId, evictTarget, cfg);

  return s;
}

// ─────────────────────── Fin de tour ─────────────────────────────────────────

/**
 * Clôt le tour : l'IA (tous les acteurs de `aiIds`) joue, PUIS le tick économique
 * avance tout le monde (income − charges → cash, faillites). Rend le résultat complet.
 */
export function endTurn(state: GameStateV2, aiIds: string[], cfg: GameConfig): TickResult {
  let s = state;
  for (const id of aiIds) s = aiTurn(s, id, cfg);
  return tick(s);
}
