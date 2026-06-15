// Revenu des hexes (brique income du jeu).
//
// Un hex = une place = un seul propriétaire. Posséder un hex rapporte un revenu fixe
// par tour. C'est le « farm » : la source de richesse qui finance tout le reste.
//
// SI→ALORS :
//   SI tu possèdes un hex            → +R (revenu de base, propre à l'hex)
//   SI un hex n'a pas de propriétaire → 0 (personne n'encaisse)
//
// Module PUR : aucune dépendance d'état mutable, tout passe en argument → testable
// sans navigateur, déterministe.

import type { GameMap, HexId } from './types';

/** Propriétaire de chaque hex (un seul par hex, `null` = libre). */
export type Ownership = Record<HexId, string | null>;

export interface RevenueConfig {
  /** Revenu de base par hex et par tour (un hex absent → 0). */
  baseByHex: Record<HexId, number>;
  /**
   * Hexes « camp de base » : ils ne rapportent AUCUN income
   * (pur coût stratégique = le foyer dont la charge motive l'expansion).
   */
  campHexes?: HexId[];
}

/** Cet hex est-il un camp de base (0 income) ? */
export function isCampHex(hexId: HexId, cfg: RevenueConfig): boolean {
  return cfg.campHexes?.includes(hexId) ?? false;
}

/** Liste des hexes possédés par un acteur. */
export function ownedHexes(actorId: string, ownership: Ownership): HexId[] {
  return Object.keys(ownership).filter((id) => ownership[id] === actorId);
}

/**
 * Revenu/tour que le PROPRIÉTAIRE COURANT encaisse sur cet hex.
 * 0 si l'hex est libre OU si c'est un camp de base. Sinon : le revenu de base.
 */
export function hexRevenue(hexId: HexId, ownership: Ownership, _map: GameMap, cfg: RevenueConfig): number {
  const owner = ownership[hexId];
  if (!owner) return 0;
  if (isCampHex(hexId, cfg)) return 0; // le camp de base ne rapporte rien
  return cfg.baseByHex[hexId] ?? 0;
}

/** Revenu total/tour d'un acteur = somme sur tous ses hexes. */
export function actorIncome(actorId: string, ownership: Ownership, map: GameMap, cfg: RevenueConfig): number {
  let total = 0;
  for (const id of ownedHexes(actorId, ownership)) {
    total += hexRevenue(id, ownership, map, cfg);
  }
  return total;
}
