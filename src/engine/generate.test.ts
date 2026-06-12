import { describe, it, expect } from 'vitest';
import { generateHexMap } from '../data/maps/generate';
import { mapNeighborProblems, isConnected } from './map-utils';

describe('carte générée (géométrie = adjacence)', () => {
  it('a une adjacence symétrique et connexe (frontière = voisin)', () => {
    const map = generateHexMap(1, 3);
    expect(mapNeighborProblems(map)).toEqual([]);
    expect(isConnected(map)).toBe(true);
  });

  it('porte des coordonnées axiales sur chaque hexe', () => {
    for (const h of generateHexMap(2, 2).hexes) expect(h.coord).toBeDefined();
  });

  it('a le bon nombre d’hexes pour le rayon (1+3R(R+1))', () => {
    expect(generateHexMap(1, 2).hexes).toHaveLength(19);
    expect(generateHexMap(1, 3).hexes).toHaveLength(37);
  });

  it('est reproductible par seed et varie selon le seed', () => {
    const kinds = (s: number) => generateHexMap(s, 3).hexes.map((h) => h.kind).join('');
    expect(kinds(5)).toBe(kinds(5));
    expect(kinds(5)).not.toBe(kinds(6));
  });

  it('les voisins ne sont QUE des hexes adjacents géométriquement', () => {
    const map = generateHexMap(3, 3);
    const byId = new Map(map.hexes.map((h) => [h.id, h]));
    const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    for (const h of map.hexes) {
      const { q, r } = h.coord!;
      const geo = new Set(DIRS.map(([dq, dr]) => `h_${q + dq}_${r + dr}`).filter((id) => byId.has(id)));
      expect(new Set(h.neighbors)).toEqual(geo);
    }
  });
});
