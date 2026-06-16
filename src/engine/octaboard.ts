// Générateur de plateau OCTOGONAL — pavage 4.8.8 (octogones + carrés), carrés JOUABLES.
//
// Géométrie : les octogones sont sur une trame carrée n×n ; dans chaque creux diagonal
// entre quatre octogones se loge un petit carré (carrefour). Topologie :
//   - un OCTOGONE touche 4 octogones (côtés droits, orthogonaux) + 4 carrés (coins) = 8 voisins ;
//   - un CARRÉ touche les 4 octogones qui l'entourent = 4 voisins.
// Conséquence clé : deux octogones en diagonale ne sont PAS adjacents — on passe PAR le carré
// (2 pas). La diagonale coûte donc 2, ce qui colle à sa longueur réelle (~1,41×) et évite le
// biais diagonal d'une grille « roi » à 8 voisins. Les carrés deviennent des goulets tactiques.
//
// La FORME des tuiles vit dans `layout` (présentation) ; le `GameMap` ne porte que l'adjacence
// → le moteur de combat (combat.ts) fonctionne dessus sans la moindre modification.

import type { GameMap, Hex } from './types';

export type TileShape = 'octogone' | 'carre';

export interface OctaBoard {
  map: GameMap;
  /** Deux octogones opposés (QG / camps de base). */
  corners: [string, string];
  /** Forme + centre pixel de chaque case (présentation pure). */
  layout: Record<string, { cx: number; cy: number; shape: TileShape }>;
  /** Espacement des centres d'octogones (px) — sert à dessiner les polygones. */
  spacing: number;
}

const oid = (i: number, j: number) => `o:${i},${j}`;
const sid = (i: number, j: number) => `s:${i},${j}`;

/**
 * Plateau 4.8.8 de `n`×`n` octogones (+ (n−1)×(n−1) carrés intercalés).
 *  - `spacing`         : distance entre centres d'octogones (px).
 *  - `playableSquares` : si false, les carrés disparaissent → grille carrée pure (4 voisins).
 */
export function makeOctaBoard(
  n: number,
  opts: { spacing?: number; playableSquares?: boolean } = {},
): OctaBoard {
  const S = opts.spacing ?? 58;
  const playable = opts.playableSquares ?? true;
  const inGrid = (i: number, j: number) => i >= 0 && i < n && j >= 0 && j < n;
  const isSquare = (i: number, j: number) => i >= 0 && i < n - 1 && j >= 0 && j < n - 1;

  const layout: Record<string, { cx: number; cy: number; shape: TileShape }> = {};
  const hexes: Hex[] = [];

  // Octogones : 4 voisins octogones (orthogonaux) + 4 voisins carrés (coins, si jouables).
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const neighbors: string[] = [];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (inGrid(i + di, j + dj)) neighbors.push(oid(i + di, j + dj));
      }
      if (playable) {
        for (const [si, sj] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]] as const) {
          if (isSquare(si, sj)) neighbors.push(sid(si, sj));
        }
      }
      hexes.push({ id: oid(i, j), label: oid(i, j), kind: 'marche', neighbors });
      layout[oid(i, j)] = { cx: i * S, cy: j * S, shape: 'octogone' };
    }
  }

  // Carrés (carrefours) : entourés des 4 octogones du bloc 2×2.
  if (playable) {
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const neighbors = [oid(i, j), oid(i + 1, j), oid(i, j + 1), oid(i + 1, j + 1)];
        hexes.push({ id: sid(i, j), label: sid(i, j), kind: 'marche', neighbors });
        layout[sid(i, j)] = { cx: (i + 0.5) * S, cy: (j + 0.5) * S, shape: 'carre' };
      }
    }
  }

  return {
    map: { id: `octa-${n}`, hexes },
    corners: [oid(0, 0), oid(n - 1, n - 1)],
    layout,
    spacing: S,
  };
}
