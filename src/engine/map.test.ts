import { describe, it, expect } from 'vitest';
import { mapNeighborProblems, isConnected } from './map-utils';
import { MVP_MAP } from '../data/maps/mvp-16';
import { VAUTOUR } from '../data/archetypes/vautour';

describe('carte MVP — intégrité', () => {
  it('a une adjacence symétrique et sans voisin orphelin', () => {
    // adjacence = corrélation (memo §11) : une relation non symétrique serait un bug.
    expect(mapNeighborProblems(MVP_MAP)).toEqual([]);
  });

  it('est entièrement connexe (aucune île)', () => {
    expect(isConnected(MVP_MAP)).toBe(true);
  });

  it('ne contient aucune boucle sur soi-même', () => {
    for (const hex of MVP_MAP.hexes) {
      expect(hex.neighbors).not.toContain(hex.id);
    }
  });

  it('donne un cluster aux hexes investissables et un type aux nœuds', () => {
    for (const hex of MVP_MAP.hexes) {
      if (hex.kind === 'noeud') {
        expect(hex.nodeType).toBeDefined();
        expect(hex.cluster).toBeUndefined();
      } else {
        expect(hex.cluster).toBeDefined();
      }
    }
  });

  it('place l’hexe de départ de l’archétype sur un hexe réel', () => {
    const ids = new Set(MVP_MAP.hexes.map((h) => h.id));
    expect(ids.has(VAUTOUR.startingHex)).toBe(true);
  });

  it('détecte une carte volontairement cassée (test du test)', () => {
    const broken = {
      id: 'broken',
      hexes: [
        { id: 'A', label: 'A', kind: 'marche' as const, cluster: 'credit' as const, neighbors: ['B'] },
        { id: 'B', label: 'B', kind: 'marche' as const, cluster: 'credit' as const, neighbors: [] }, // asymétrique
      ],
    };
    expect(mapNeighborProblems(broken).length).toBeGreaterThan(0);
  });
});
