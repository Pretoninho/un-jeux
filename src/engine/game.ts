// Le JEU — actions jouables sur GameState.
//
// Cœur économique minimal. Verbes :
//   - acquérir un hex LIBRE (achat au marché, ancré sur son revenu)
//   - emprunter (camp = capital + charge) ; camp de BASE posé au départ
//   - finir le tour (l'IA joue, puis le tick économique avance tout le monde)
//
// La contestation d'un hex ADVERSE n'est plus économique (l'ancien rachat par carnet
// d'ordres est retiré) : elle se fera par le COMBAT, couche à greffer par-dessus.
//
// TRONC : un seul modèle de dette de base (camp permanent, charge fixe).
//
// Module PUR, immuable : chaque action rend un NOUVEAU GameState.

import type { GameState } from './state';
import { makeCamp } from './camp';
import { isCampHex } from './revenue';
import { tick, actorTotalCharges, type TickResult } from './tick';

export interface GameConfig {
  horizonTurns: number;
  /** Prix d'acquisition d'un hex libre = base × ce multiple. */
  claimMultiple: number;
  /** Charge/tour d'un emprunt = ce taux × montant. */
  chargeRate: number;
  /**
   * Camp de BASE = le 1ᵉʳ EMPRUNT, posé au départ : il donne ce capital de lancement (cash)
   * ET impose sa charge permanente (chargeRate × ce montant). Son hex (le QG) ne rapporte
   * AUCUN income → on démarre avec du cash mais sous l'eau, ce qui force l'acquisition d'hexes.
   */
  baseCampLoan: number;
}

// Cœur calibré pour la PROGRESSION (ne pas rester bloqué) + une tension de départ.
// Charge de base = 0.10 × 70 = 7/tour, surmontable dès 2 hexes d'income (base 6).
export const DEFAULT_CONFIG: GameConfig = {
  horizonTurns: 20,
  claimMultiple: 4,
  chargeRate: 5 / 70, // charge camp = loan(70) × 5/70 = 5/tour (rond)
  baseCampLoan: 70,
};

// ─────────────────────── Acquisition d'un hex libre ──────────────────────────

/** Prix pour acquérir un hex LIBRE (ancré sur son revenu de base). */
export function claimCost(state: GameState, hexId: string, cfg: GameConfig): number {
  return (state.revenueCfg.baseByHex[hexId] ?? 0) * cfg.claimMultiple;
}

/** Peut-on acquérir cet hex ? Hex à income (base > 0), libre, acteur vivant, cash suffisant. */
export function canClaim(state: GameState, actorId: string, hexId: string, cfg: GameConfig): boolean {
  const actor = state.actors.find((a) => a.id === actorId);
  if (!actor || actor.bankrupt) return false;
  if (state.ownership[hexId]) return false;
  const cost = claimCost(state, hexId, cfg);
  if (cost <= 0) return false; // case stérile (0 income) ou QG → non achetable
  return actor.cash >= cost;
}

/** Acquiert un hex libre : débite le cash, pose la propriété. Sans effet si interdit. */
export function claimHex(state: GameState, actorId: string, hexId: string, cfg: GameConfig): GameState {
  if (!canClaim(state, actorId, hexId, cfg)) return state;
  const cost = claimCost(state, hexId, cfg);
  return {
    ...state,
    actors: state.actors.map((a) => (a.id === actorId ? { ...a, cash: a.cash - cost } : a)),
    ownership: { ...state.ownership, [hexId]: actorId },
  };
}

// ─────────────────────── Emprunt (camp) ──────────────────────────────────────

/** Emprunte : ouvre un camp (capital + charge permanente), crédite le cash. */
export function borrow(state: GameState, actorId: string, amount: number, cfg: GameConfig): GameState {
  const actor = state.actors.find((a) => a.id === actorId);
  if (!actor || actor.bankrupt || amount <= 0) return state;
  const camp = makeCamp(actorId, amount, cfg.chargeRate);
  return {
    ...state,
    actors: state.actors.map((a) => (a.id === actorId ? { ...a, cash: a.cash + amount } : a)),
    camps: [...state.camps, camp],
  };
}

/**
 * Pose le camp de BASE de chaque acteur = son 1ᵉʳ emprunt (capital de lancement + charge
 * permanente). Le QG (hex camp, déclaré dans `revenueCfg.campHexes`) ne rapporte aucun income.
 */
export function foundBaseCamps(state: GameState, cfg: GameConfig): GameState {
  let s = state;
  for (const a of s.actors) s = borrow(s, a.id, cfg.baseCampLoan, cfg);
  return s;
}

// ─────────────────────── Richesse nette (mesure de victoire) ──────────────────
//
// La victoire au temps va au plus riche en VALEUR NETTE — pas au plus de cash. Sinon
// emprunter = argent gratuit. Net = cash + valeur du territoire (prix de marché des hexes
// possédés) − dette restante (le principal du camp, jamais remboursé en modèle permanent).

/** Valeur de marché du territoire d'un acteur (hexes d'income ; le QG sans income vaut 0). */
export function territoryValue(state: GameState, actorId: string, cfg: GameConfig): number {
  let v = 0;
  for (const h of state.map.hexes) {
    if (state.ownership[h.id] === actorId && !isCampHex(h.id, state.revenueCfg)) {
      v += claimCost(state, h.id, cfg);
    }
  }
  return v;
}

/** Dette restante d'un acteur (somme des montants de ses camps permanents). */
export function outstandingDebt(state: GameState, actorId: string): number {
  return state.camps.filter((c) => c.ownerId === actorId).reduce((s, c) => s + c.loanAmount, 0);
}

/** Valeur nette = cash + territoire − dette. C'est le score de richesse du jeu. */
export function netWorth(state: GameState, actorId: string, cfg: GameConfig): number {
  const actor = state.actors.find((a) => a.id === actorId);
  if (!actor) return 0;
  return actor.cash + territoryValue(state, actorId, cfg) - outstandingDebt(state, actorId);
}

// ─────────────────────── IA (un adversaire vivant) ───────────────────────────

/** Hexes libres triés par meilleur revenu de base pour `actorId`. */
function freeHexesByValue(state: GameState): string[] {
  const free = state.map.hexes.filter((h) => !state.ownership[h.id]);
  const score = (hexId: string) => state.revenueCfg.baseByHex[hexId] ?? 0;
  return free.map((h) => h.id).sort((a, b) => score(b) - score(a));
}

/**
 * Tour d'IA « prudente mais expansionniste » : garde une réserve = 2 tours de charges,
 * puis achète les meilleurs hexes d'income abordables avec son capital + income accumulé.
 */
export function aiTurn(state: GameState, actorId: string, cfg: GameConfig): GameState {
  let s = state;
  const me0 = s.actors.find((a) => a.id === actorId);
  if (!me0 || me0.bankrupt) return s;

  const reserve = () => actorTotalCharges(s, actorId) * 2;
  const cash = () => s.actors.find((a) => a.id === actorId)!.cash;

  let safety = 12;
  while (safety-- > 0) {
    const target = freeHexesByValue(s).find(
      (id) => canClaim(s, actorId, id, cfg) && claimCost(s, id, cfg) <= cash() - reserve(),
    );
    if (!target) break;
    s = claimHex(s, actorId, target, cfg);
  }
  return s;
}

// ─────────────────────── Fin de tour ─────────────────────────────────────────

/** Clôt le tour : l'IA joue, PUIS le tick économique avance tout le monde. */
export function endTurn(state: GameState, aiIds: string[], cfg: GameConfig): TickResult {
  let s = state;
  for (const id of aiIds) s = aiTurn(s, id, cfg);
  return tick(s);
}
