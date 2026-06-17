// Générateur de plateau hexagonal — carte « disque » de rayon R (hexagone). Topologie PURE
// (hexes + voisins) pour le combat : le moteur ne lit que `neighbors`, il est agnostique au reste.
// Les 2 coins opposés servent de points de déploiement (un par camp).

import type { GameMap, Hex } from './types';

const DIRS: Array<[number, number]> = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

export interface Board {
  map: GameMap;
  /** Deux coins opposés (points de déploiement, un par camp). */
  corners: [string, string];
}

function hexId(q: number, r: number): string {
  return `${q},${r}`;
}

/** Plateau hexagonal de rayon `radius` (topologie pure : hexes + voisins + 2 coins de déploiement). */
export function makeBoard(radius: number): Board {
  const coords: Array<{ q: number; r: number }> = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      coords.push({ q, r });
    }
  }
  const has = (q: number, r: number) => coords.some((c) => c.q === q && c.r === r);
  const corners: [string, string] = [hexId(-radius, 0), hexId(radius, 0)];

  const hexes: Hex[] = coords.map((c) => ({
    id: hexId(c.q, c.r),
    label: hexId(c.q, c.r),
    kind: 'marche',
    neighbors: DIRS.map(([dq, dr]) => [c.q + dq, c.r + dr] as const)
      .filter(([q, r]) => has(q, r))
      .map(([q, r]) => hexId(q, r)),
    coord: { q: c.q, r: c.r },
  }));

  return { map: { id: `board-r${radius}`, hexes }, corners };
}
