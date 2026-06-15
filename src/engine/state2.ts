// État du NOUVEAU jeu — propre, isolé de l'ancien GameState (fragility/crisis/regime/credit).
// Brique 4 : première apparition d'un state unifié. Il assemble les organes des
// briques 1-3 (revenu, camps) en un seul corps que le tick économique fait vivre.
//
// TS pur, sans DOM. Aucune dépendance à l'ancien moteur.

import type { GameMap, HexId } from './types';
import type { Ownership, RevenueConfig } from './revenue';
import type { Camp } from './camp';

/** Un acteur du nouveau jeu : juste un porte-monnaie + une identité. */
export interface ActorV2 {
  id: string;
  label: string;
  cash: number;
  /** Éliminé = a fait faillite (ne peut plus couvrir ses charges). */
  bankrupt: boolean;
}

/** État complet d'une partie du nouveau jeu. Tout est ici, rien d'ailleurs. */
export interface GameStateV2 {
  turn: number;
  map: GameMap;
  revenueCfg: RevenueConfig;
  actors: ActorV2[];
  /** Propriétaire de chaque hex (un seul par hex, `null` = libre). */
  ownership: Ownership;
  /** Tous les camps de tous les acteurs (un acteur peut en porter plusieurs). */
  camps: Camp[];
  /**
   * Carnet d'ordres = prix de SORTIE (ask) de chaque hex possédé, fixé par son
   * propriétaire. Un hex possédé a TOUJOURS un ask ; un hex libre n'en a pas.
   * L'éviction = payer cet ask (le siège est le prix que l'occupant a déclaré).
   */
  asks: Record<HexId, number>;
  /**
   * Charge d'occupation par hex d'INCOME possédé et par tour. Fait monter la charge
   * AVEC le territoire → garde la tension income/charge stable (ratio ≈ revenu/upkeep)
   * au lieu d'exploser quand on s'étend. Le QG (camp) n'en paie pas (il a déjà sa dette).
   */
  hexUpkeep: number;
}

export function makeActorV2(id: string, label: string, cash: number): ActorV2 {
  return { id, label, cash, bankrupt: false };
}

/** Construit un état vierge : tous les hexes libres, aucun camp, aucun ordre. */
export function makeGameStateV2(
  map: GameMap,
  revenueCfg: RevenueConfig,
  actors: ActorV2[],
  hexUpkeep = 0,
): GameStateV2 {
  const ownership: Ownership = {};
  for (const h of map.hexes) ownership[h.id] = null;
  return { turn: 0, map, revenueCfg, actors, ownership, camps: [], asks: {}, hexUpkeep };
}

/** Acteurs encore en jeu (non faillis). */
export function liveActors(state: GameStateV2): ActorV2[] {
  return state.actors.filter((a) => !a.bankrupt);
}
