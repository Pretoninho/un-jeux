// Générateur de plateau hexagonal — partagé par l'UI et les scripts de calibrage.
// Carte « disque » de rayon R (hexagone). Les hexes à income sont RARES : seule une
// fraction des cases produit un revenu, les autres sont STÉRILES (base 0, non achetables).
// Les hexes à income sont placés de façon SYMÉTRIQUE (rotation 180°) → plateau équitable
// pour les deux joueurs. Les 2 coins opposés sont les QG (camps de base, 0 income).

import type { GameMap, Hex } from './types';
import type { RevenueConfig } from './revenue';
import { makeRng } from './rng';

const DIRS: Array<[number, number]> = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

export interface Board {
  map: GameMap;
  rev: RevenueConfig;
  /** Deux coins opposés (QG / camps de base). */
  corners: [string, string];
  /** Hexes qui produisent un revenu (hors QG). */
  incomeHexes: string[];
}

function hexId(q: number, r: number): string {
  return `${q},${r}`;
}

/**
 * Plateau hexagonal de rayon `radius`.
 *  - `base`             : revenu d'un hex à income.
 *  - `agglomerationBonus` : prime par voisin du même propriétaire.
 *  - `incomeFraction`   : part des cases (hors QG) qui produisent un revenu (rareté).
 *  - `seed`             : graine du placement (reproductible).
 */
export function makeBoard(
  radius: number,
  base: number,
  agglomerationBonus: number,
  incomeFraction: number,
  seed: number,
): Board {
  const coords: Array<{ q: number; r: number }> = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      coords.push({ q, r });
    }
  }
  const has = (q: number, r: number) => coords.some((c) => c.q === q && c.r === r);

  const corners: [string, string] = [hexId(-radius, 0), hexId(radius, 0)];
  const cornerSet = new Set(corners);

  // Placement symétrique (q,r) ↔ (-q,-r) : on décide une moitié, on miroite l'autre.
  const rng = makeRng(seed);
  const incomeSet = new Set<string>();
  const decided = new Set<string>();
  for (const { q, r } of coords) {
    const id = hexId(q, r);
    if (cornerSet.has(id) || decided.has(id)) continue;
    const mirror = hexId(-q, -r);
    const isIncome = rng.chance(incomeFraction);
    if (isIncome) {
      incomeSet.add(id);
      if (has(-q, -r) && !cornerSet.has(mirror)) incomeSet.add(mirror);
    }
    decided.add(id);
    decided.add(mirror);
  }

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
  for (const c of coords) {
    const id = hexId(c.q, c.r);
    baseByHex[id] = incomeSet.has(id) ? base : 0; // QG et cases stériles → 0
  }

  return {
    map: { id: `board-r${radius}`, hexes },
    rev: { baseByHex, agglomerationBonus, campHexes: corners },
    corners,
    incomeHexes: [...incomeSet],
  };
}

/** Plateau « tout income » (rétro-compat / cas dégénéré incomeFraction = 1). */
export function makeFlatBoard(radius: number, base: number, agglomerationBonus: number): Board {
  return makeBoard(radius, base, agglomerationBonus, 1, 0);
}
