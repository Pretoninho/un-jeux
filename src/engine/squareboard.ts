// Générateur de plateau CARRÉ — grille n×n, voisinage 8 directions (déplacement « roi » avec
// diagonales, esprit échecs/Divinity). Topologie PURE (le moteur ne lit que `neighbors`, il est
// agnostique à la forme). Les 2 coins opposés servent de points de déploiement (un par camp).

import type { GameMap, Hex } from './types';

// 8 voisins : orthogonaux + diagonales (la diagonale compte pour 1 pas — choix « roi »).
const DIRS8: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export interface SquareBoard {
  map: GameMap;
  /** Deux coins opposés (points de déploiement, un par camp). */
  corners: [string, string];
}

function sqId(x: number, y: number): string {
  return `${x},${y}`;
}

/** Plateau carré `n`×`n` (voisinage 8 dirs) ; 2 coins opposés pour le déploiement. */
export function makeSquareBoard(n: number): SquareBoard {
  const has = (x: number, y: number) => x >= 0 && x < n && y >= 0 && y < n;
  const hexes: Hex[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      hexes.push({
        id: sqId(x, y),
        label: sqId(x, y),
        kind: 'marche',
        neighbors: DIRS8.map(([dx, dy]) => [x + dx, y + dy] as const)
          .filter(([px, py]) => has(px, py))
          .map(([px, py]) => sqId(px, py)),
        coord: { q: x, r: y },
      });
    }
  }
  const corners: [string, string] = [sqId(0, 0), sqId(n - 1, n - 1)];
  return { map: { id: `square-${n}`, hexes }, corners };
}
