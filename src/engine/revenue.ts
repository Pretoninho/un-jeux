// Revenu des hexes (brique income du nouveau jeu).
//
// Un hex = une place = un seul propriétaire. Posséder un hex rapporte un revenu
// par tour. Posséder des hexes ADJACENTS bonifie chacun d'eux (prime d'agglomération
// spatiale — le seul héritage de Civ conservé).
//
// SI→ALORS :
//   SI tu possèdes un hex            → +R (revenu de base, propre à l'hex)
//   SI un hex adjacent t'appartient  → +B par voisin possédé (agglomération)
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
  /** Prime d'agglomération : +ce montant par hex adjacent du MÊME propriétaire. */
  agglomerationBonus: number;
  /**
   * Hexes « camp de base » : ils ne rapportent AUCUN income et ne confèrent pas
   * d'agglomération (pur coût stratégique = le foyer dont la charge motive l'expansion).
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

/** Nombre de voisins de `hexId` appartenant à `ownerId` (camps exclus : ils n'agglomèrent pas). */
function ownedNeighborCount(hexId: HexId, ownerId: string, ownership: Ownership, map: GameMap, cfg: RevenueConfig): number {
  const hex = map.hexes.find((h) => h.id === hexId);
  if (!hex) return 0;
  let n = 0;
  for (const nb of hex.neighbors) {
    if (ownership[nb] === ownerId && !isCampHex(nb, cfg)) n++;
  }
  return n;
}

/**
 * Revenu/tour que le PROPRIÉTAIRE COURANT encaisse sur cet hex.
 * 0 si l'hex est libre OU si c'est un camp de base. Sinon : base + agglomération.
 */
export function hexRevenue(hexId: HexId, ownership: Ownership, map: GameMap, cfg: RevenueConfig): number {
  const owner = ownership[hexId];
  if (!owner) return 0;
  if (isCampHex(hexId, cfg)) return 0; // le camp de base ne rapporte rien
  const base = cfg.baseByHex[hexId] ?? 0;
  const bonus = cfg.agglomerationBonus * ownedNeighborCount(hexId, owner, ownership, map, cfg);
  return base + bonus;
}

/** Revenu total/tour d'un acteur = somme sur tous ses hexes (base + agglomération). */
export function actorIncome(actorId: string, ownership: Ownership, map: GameMap, cfg: RevenueConfig): number {
  let total = 0;
  for (const id of ownedHexes(actorId, ownership)) {
    total += hexRevenue(id, ownership, map, cfg);
  }
  return total;
}
