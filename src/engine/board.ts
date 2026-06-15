// Générateur de plateau hexagonal — partagé par l'UI et les scripts de calibrage.
// Carte « disque » de rayon R (hexagone), revenu PLAT (tous les hexes au même prix)
// pour isoler le facteur d'équilibre income/charge (décision concepteur 2026-06-15).

import type { GameMap, Hex } from './types';
import type { RevenueConfig } from './revenue';

const DIRS: Array<[number, number]> = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

export interface Board {
  map: GameMap;
  rev: RevenueConfig;
  /** Deux coins opposés (positions de départ des deux joueurs). */
  corners: [string, string];
}

/** Identifiant court et stable d'un hex à partir de ses coordonnées axiales. */
function hexId(q: number, r: number): string {
  return `${q},${r}`;
}

/**
 * Plateau hexagonal de rayon `radius`, revenu de base PLAT = `base` pour tous les hexes.
 * `agglomerationBonus` = prime par voisin du même propriétaire.
 */
export function makeFlatBoard(radius: number, base: number, agglomerationBonus: number): Board {
  const coords: Array<{ q: number; r: number }> = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      coords.push({ q, r });
    }
  }
  const has = (q: number, r: number) => coords.some((c) => c.q === q && c.r === r);

  const hexes: Hex[] = coords.map((c) => ({
    id: hexId(c.q, c.r),
    label: hexId(c.q, c.r),
    kind: 'marche',
    neighbors: DIRS.map(([dq, dr]) => [c.q + dq, c.r + dr] as const)
      .filter(([q, r]) => has(q, r))
      .map(([q, r]) => hexId(q, r)),
    coord: { q: c.q, r: c.r },
  }));

  const baseByHex: Record<string, number> = {};
  for (const c of coords) baseByHex[hexId(c.q, c.r)] = base;

  return {
    map: { id: `flat-r${radius}`, hexes },
    rev: { baseByHex, agglomerationBonus },
    corners: [hexId(-radius, 0), hexId(radius, 0)],
  };
}
