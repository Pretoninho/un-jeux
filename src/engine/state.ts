// État du jeu — économie territoriale minimale.
// Il assemble les organes (revenu, camps) en un seul corps que le tick économique fait vivre.
//
// TS pur, sans DOM. Cœur volontairement nu : possession d'hexes → income, camp de base
// = dette de départ, valeur nette = mesure de victoire. La contestation d'un hex adverse
// (le combat) viendra se greffer par-dessus.

import type { GameMap } from './types';
import type { Ownership, RevenueConfig } from './revenue';
import type { Camp } from './camp';

/** Un acteur : un porte-monnaie + une identité. */
export interface Actor {
  id: string;
  label: string;
  cash: number;
  /** Éliminé = a fait faillite (ne peut plus couvrir ses charges). */
  bankrupt: boolean;
}

/** État complet d'une partie. Tout est ici, rien d'ailleurs. */
export interface GameState {
  turn: number;
  map: GameMap;
  revenueCfg: RevenueConfig;
  actors: Actor[];
  /** Propriétaire de chaque hex (un seul par hex, `null` = libre). */
  ownership: Ownership;
  /** Tous les camps de tous les acteurs (un acteur peut en porter plusieurs). */
  camps: Camp[];
}

export function makeActor(id: string, label: string, cash: number): Actor {
  return { id, label, cash, bankrupt: false };
}

/** Construit un état vierge : tous les hexes libres, aucun camp. */
export function makeGameState(
  map: GameMap,
  revenueCfg: RevenueConfig,
  actors: Actor[],
): GameState {
  const ownership: Ownership = {};
  for (const h of map.hexes) ownership[h.id] = null;
  return { turn: 0, map, revenueCfg, actors, ownership, camps: [] };
}

/** Acteurs encore en jeu (non faillis). */
export function liveActors(state: GameState): Actor[] {
  return state.actors.filter((a) => !a.bankrupt);
}
