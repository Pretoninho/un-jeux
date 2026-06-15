// Le JEU — actions jouables sur GameStateV2.
//
// Il y a UN jeu, et chaque mécanique s'y branche. Verbes sur l'état unifié :
//   - acquérir un hex LIBRE (achat au marché)
//   - placer un ordre de vente (ASK) sur un hex possédé — OBLIGATOIRE à l'acquisition
//   - emprunter (camp = capital + charge) ; camp de BASE posé au départ
//   - évincer un hex adverse = PAYER son ask (le carnet d'ordres rend le siège visible)
//   - finir le tour (l'IA joue, puis le tick économique avance tout le monde)
//
// CARNET D'ORDRES (décision concepteur 2026-06-15) : le propriétaire d'un hex ne peut
// poser QU'UN ordre de VENTE (son ask = son prix de sortie). L'éviction consiste à payer
// cet ask. Le prix n'est plus une formule : c'est l'occupant qui le déclare publiquement.
//
// TRONC (décision concepteur 2026-06-15) : UN seul modèle de dette de base (camp de base
// permanent, charge fixe) — la différenciation (branches de revenus/charges) viendra plus
// tard, une à la fois (leçon §30 : primitives d'abord, spécificités par-dessus).
//
// Module PUR, immuable : chaque action rend un NOUVEAU GameStateV2.

import type { GameStateV2 } from './state2';
import { makeCamp } from './camp';
import { hexRevenue, isCampHex } from './revenue';
import { tick, actorTotalCharges, type TickResult } from './tick';

export interface GameConfig {
  horizonTurns: number;
  /** Prix d'acquisition d'un hex libre = base × ce multiple. */
  claimMultiple: number;
  /** Ask par défaut suggéré à l'acquisition = revenu courant × ce multiple. */
  askDefaultMultiple: number;
  /** Plancher d'un ask (on ne brade pas un hex sous son prix d'achat). */
  askFloorMultiple: number;
  /** Charge/tour d'un emprunt = ce taux × montant. */
  chargeRate: number;
  /**
   * Camp de BASE = le 1ᵉʳ EMPRUNT, posé au départ : il donne ce capital de lancement (cash)
   * ET impose sa charge permanente (chargeRate × ce montant). Son hex (le QG) ne rapporte
   * AUCUN income → on démarre avec du cash mais sous l'eau, ce qui force l'acquisition du 1ᵉʳ hex.
   */
  baseCampLoan: number;
  /**
   * Upkeep/tour par hex d'income possédé. Fait monter la charge AVEC le territoire → tension
   * income/charge STABLE : le ratio asymptotique ≈ revenu de base / upkeep (ex. 6/3 = 2:1).
   */
  hexUpkeep: number;
}

// Calibré par scripts/balance.ts avec hexes à income RARES (incomeFraction ~0.5). Avec la
// rareté, la tension vient surtout de la CHARGE du camp de base (le ratio income/charge réalisé
// est ~1.2, très tendu) ; l'upkeep par hex devient léger (1). loan 70 = survivable + disputé (50/50).
export const DEFAULT_CONFIG: GameConfig = {
  horizonTurns: 14,
  claimMultiple: 4,
  askDefaultMultiple: 12,
  askFloorMultiple: 4,
  chargeRate: 0.2,
  baseCampLoan: 70,
  hexUpkeep: 1,
};

// ─────────────────────── Acquisition d'un hex libre ──────────────────────────

/** Prix pour acquérir un hex LIBRE (ancré sur son revenu de base). */
export function claimCost(state: GameStateV2, hexId: string, cfg: GameConfig): number {
  return (state.revenueCfg.baseByHex[hexId] ?? 0) * cfg.claimMultiple;
}

/** Peut-on acquérir cet hex ? Hex à income (base > 0), libre, acteur vivant, cash suffisant. */
export function canClaim(state: GameStateV2, actorId: string, hexId: string, cfg: GameConfig): boolean {
  const actor = state.actors.find((a) => a.id === actorId);
  if (!actor || actor.bankrupt) return false;
  if (state.ownership[hexId]) return false;
  const cost = claimCost(state, hexId, cfg);
  if (cost <= 0) return false; // case stérile (0 income) ou QG → non achetable
  return actor.cash >= cost;
}

/**
 * Acquiert un hex libre : débite le cash, pose la propriété ET un ask par défaut
 * (le jeu force ensuite le joueur à confirmer/ajuster son prix de sortie). Sans effet si interdit.
 */
export function claimHex(state: GameStateV2, actorId: string, hexId: string, cfg: GameConfig): GameStateV2 {
  if (!canClaim(state, actorId, hexId, cfg)) return state;
  const cost = claimCost(state, hexId, cfg);
  const next: GameStateV2 = {
    ...state,
    actors: state.actors.map((a) => (a.id === actorId ? { ...a, cash: a.cash - cost } : a)),
    ownership: { ...state.ownership, [hexId]: actorId },
    asks: { ...state.asks },
  };
  next.asks[hexId] = defaultAsk(next, hexId, cfg);
  return next;
}

// ─────────────────────── Carnet d'ordres (ask = prix de sortie) ───────────────

/** Ask par défaut suggéré pour un hex (revenu courant × askDefaultMultiple). */
export function defaultAsk(state: GameStateV2, hexId: string, cfg: GameConfig): number {
  const rev = hexRevenue(hexId, state.ownership, state.map, state.revenueCfg);
  return Math.round(rev * cfg.askDefaultMultiple);
}

/** Plancher autorisé d'un ask (on ne vend pas sous une fraction du prix d'achat). */
export function askFloor(state: GameStateV2, hexId: string, cfg: GameConfig): number {
  const base = state.revenueCfg.baseByHex[hexId] ?? 0;
  return Math.round(base * cfg.askFloorMultiple);
}

/** Pose/ajuste l'ordre de VENTE d'un hex. Seul le propriétaire le peut ; borné au plancher. */
export function setAsk(state: GameStateV2, actorId: string, hexId: string, price: number, cfg: GameConfig): GameStateV2 {
  if (state.ownership[hexId] !== actorId) return state;
  const floor = askFloor(state, hexId, cfg);
  return { ...state, asks: { ...state.asks, [hexId]: Math.max(floor, Math.round(price)) } };
}

// ─────────────────────── Emprunt (camp) ──────────────────────────────────────

/** Emprunte : ouvre un camp (capital + charge permanente), crédite le cash. */
export function borrow(state: GameStateV2, actorId: string, amount: number, cfg: GameConfig): GameStateV2 {
  const actor = state.actors.find((a) => a.id === actorId);
  if (!actor || actor.bankrupt || amount <= 0) return state;
  const camp = makeCamp(actorId, amount, 'A', cfg.chargeRate); // un seul modèle : dette de base permanente
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
export function foundBaseCamps(state: GameStateV2, cfg: GameConfig): GameStateV2 {
  let s = state;
  for (const a of s.actors) s = borrow(s, a.id, cfg.baseCampLoan, cfg);
  return s;
}

// ─────────────────────── Éviction = payer l'ask de l'occupant ─────────────────

/** Prix pour évincer = l'ask déclaré par l'occupant (∞ si pas d'ask : pas à vendre). */
export function evictionCost(state: GameStateV2, hexId: string): number {
  return state.asks[hexId] ?? Infinity;
}

/** Peut-on évincer ? Hex occupé par un AUTRE (jamais un camp de base), assaillant vivant, cash ≥ ask. */
export function canEvict(state: GameStateV2, buyerId: string, hexId: string): boolean {
  const occ = state.ownership[hexId];
  if (!occ || occ === buyerId) return false;
  if (isCampHex(hexId, state.revenueCfg)) return false; // le QG ne se rachète pas
  const buyer = state.actors.find((a) => a.id === buyerId);
  if (!buyer || buyer.bankrupt) return false;
  return buyer.cash >= evictionCost(state, hexId);
}

/**
 * Évince l'occupant : transfert ZÉRO-SUM (acheteur paie l'ask, occupant encaisse),
 * l'hex change de main. Le NOUVEAU propriétaire doit reposer un ask (mis au défaut ici ;
 * l'UI force la confirmation). Sans effet si interdit.
 */
export function evict(state: GameStateV2, buyerId: string, hexId: string, cfg: GameConfig): GameStateV2 {
  if (!canEvict(state, buyerId, hexId)) return state;
  const occ = state.ownership[hexId]!;
  const cost = evictionCost(state, hexId);
  const next: GameStateV2 = {
    ...state,
    actors: state.actors.map((a) => {
      if (a.id === buyerId) return { ...a, cash: a.cash - cost };
      if (a.id === occ) return { ...a, cash: a.cash + cost };
      return a;
    }),
    ownership: { ...state.ownership, [hexId]: buyerId },
    asks: { ...state.asks },
  };
  next.asks[hexId] = defaultAsk(next, hexId, cfg); // nouvel occupant → nouvel ask
  return next;
}

// ─────────────────────── Richesse nette (mesure de victoire) ──────────────────
//
// La victoire au temps va au plus riche en VALEUR NETTE — pas au plus de cash. Sinon
// emprunter = argent gratuit. Net = cash + valeur du territoire (prix de marché des hexes
// possédés) − dette restante (le principal du camp, jamais remboursé en modèle permanent).

/** Valeur de marché du territoire d'un acteur (hexes d'income ; le QG sans income vaut 0). */
export function territoryValue(state: GameStateV2, actorId: string, cfg: GameConfig): number {
  let v = 0;
  for (const h of state.map.hexes) {
    if (state.ownership[h.id] === actorId && !isCampHex(h.id, state.revenueCfg)) {
      v += claimCost(state, h.id, cfg);
    }
  }
  return v;
}

/** Dette restante d'un acteur (somme des reliquats de ses camps). */
export function outstandingDebt(state: GameStateV2, actorId: string): number {
  return state.camps.filter((c) => c.ownerId === actorId).reduce((s, c) => s + c.debtRemaining, 0);
}

/** Valeur nette = cash + territoire − dette. C'est le score de richesse du jeu. */
export function netWorth(state: GameStateV2, actorId: string, cfg: GameConfig): number {
  const actor = state.actors.find((a) => a.id === actorId);
  if (!actor) return 0;
  return actor.cash + territoryValue(state, actorId, cfg) - outstandingDebt(state, actorId);
}

// ─────────────────────── IA (un adversaire vivant) ───────────────────────────

/** Hexes libres triés par meilleur revenu potentiel (agglomération comprise) pour `actorId`. */
function freeHexesByValue(state: GameStateV2, actorId: string): string[] {
  const free = state.map.hexes.filter((h) => !state.ownership[h.id]);
  const score = (hexId: string) => {
    const base = state.revenueCfg.baseByHex[hexId] ?? 0;
    const hex = state.map.hexes.find((h) => h.id === hexId)!;
    const adj = hex.neighbors.filter((nb) => state.ownership[nb] === actorId).length;
    return base + state.revenueCfg.agglomerationBonus * adj;
  };
  return free.map((h) => h.id).sort((a, b) => score(b) - score(a));
}

/** Garantit que chaque hex d'income possédé par `actorId` a un ask (le QG n'en a pas). */
function ensureAsks(state: GameStateV2, actorId: string, cfg: GameConfig): GameStateV2 {
  let s = state;
  for (const h of s.map.hexes) {
    if (s.ownership[h.id] === actorId && !isCampHex(h.id, s.revenueCfg) && s.asks[h.id] == null) {
      s = { ...s, asks: { ...s.asks, [h.id]: defaultAsk(s, h.id, cfg) } };
    }
  }
  return s;
}

/**
 * Tour d'IA « prudente mais expansionniste » : se garde une réserve = 2 tours de charges.
 *  1. emprunte si elle a de la marge de revenu et peu de cash pour s'étendre,
 *  2. achète les meilleurs hexes abordables (priorité agglomération),
 *  3. tente UNE éviction adjacente rentable (paie l'ask),
 *  4. pose ses ordres de vente.
 */
export function aiTurn(state: GameStateV2, actorId: string, cfg: GameConfig): GameStateV2 {
  let s = state;
  const me0 = s.actors.find((a) => a.id === actorId);
  if (!me0 || me0.bankrupt) return s;

  const reserve = () => actorTotalCharges(s, actorId) * 2;
  const cash = () => s.actors.find((a) => a.id === actorId)!.cash;

  // 1. Emprunter si le cash est trop bas pour saisir une opportunité ET que le revenu
  //    couvre confortablement les charges (marge pour servir la dette supplémentaire).
  const cheapest = freeHexesByValue(s, actorId).map((id) => claimCost(s, id, cfg)).sort((a, b) => a - b)[0];
  if (cheapest != null && cash() < cheapest && s.camps.filter((c) => c.ownerId === actorId).length < 3) {
    s = borrow(s, actorId, cfg.baseCampLoan, cfg);
  }

  // 2. Acheter en boucle (garde la réserve).
  let safety = 12;
  while (safety-- > 0) {
    const target = freeHexesByValue(s, actorId).find((id) => claimCost(s, id, cfg) <= cash() - reserve());
    if (!target) break;
    s = claimHex(s, actorId, target, cfg);
  }

  // 3. Une éviction rentable adjacente (paie l'ask de l'occupant).
  const targets = s.map.hexes
    .filter((h) => {
      const owner = s.ownership[h.id];
      return owner && owner !== actorId && h.neighbors.some((nb) => s.ownership[nb] === actorId);
    })
    .map((h) => h.id)
    .filter((id) => canEvict(s, actorId, id) && cash() - evictionCost(s, id) >= reserve())
    // cible le moins cher (meilleur rapport) en premier
    .sort((a, b) => evictionCost(s, a) - evictionCost(s, b));
  if (targets[0]) s = evict(s, actorId, targets[0], cfg);

  // 4. Ordres de vente sur tout ce que je possède.
  s = ensureAsks(s, actorId, cfg);
  return s;
}

// ─────────────────────── Fin de tour ─────────────────────────────────────────

/** Clôt le tour : l'IA joue, PUIS le tick économique avance tout le monde. */
export function endTurn(state: GameStateV2, aiIds: string[], cfg: GameConfig): TickResult {
  let s = state;
  for (const id of aiIds) s = aiTurn(s, id, cfg);
  return tick(s);
}
