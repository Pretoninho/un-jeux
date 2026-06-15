import { describe, it, expect } from 'vitest';
import { hexRevenue, actorIncome, ownedHexes, type Ownership, type RevenueConfig } from './revenue';
import type { GameMap, Hex } from './types';

// ── Carte de test : une ligne A — B — C — D (adjacence symétrique) ────────────
function hex(id: string, neighbors: string[]): Hex {
  return { id, label: id, kind: 'marche', neighbors };
}

const MAP: GameMap = {
  id: 'test',
  hexes: [
    hex('A', ['B']),
    hex('B', ['A', 'C']),
    hex('C', ['B', 'D']),
    hex('D', ['C']),
  ],
};

const cfg: RevenueConfig = {
  baseByHex: { A: 10, B: 10, C: 10, D: 10 },
  agglomerationBonus: 5,
};

describe('revenue — hex isolé', () => {
  it('hex libre → 0', () => {
    const own: Ownership = { A: null, B: null, C: null, D: null };
    expect(hexRevenue('A', own, MAP, cfg)).toBe(0);
  });

  it('hex possédé sans voisin possédé → base seule', () => {
    const own: Ownership = { A: 'alice', B: null, C: null, D: null };
    expect(hexRevenue('A', own, MAP, cfg)).toBe(10);
  });

  it('base différente selon l\'hex', () => {
    const own: Ownership = { A: 'alice', B: null, C: null, D: null };
    const cfg2: RevenueConfig = { baseByHex: { A: 3, B: 10, C: 10, D: 10 }, agglomerationBonus: 5 };
    expect(hexRevenue('A', own, MAP, cfg2)).toBe(3);
  });
});

describe('revenue — agglomération', () => {
  it('un voisin possédé → base + 1×bonus', () => {
    const own: Ownership = { A: 'alice', B: 'alice', C: null, D: null };
    // A a 1 voisin (B) possédé ; B a 1 voisin (A) possédé
    expect(hexRevenue('A', own, MAP, cfg)).toBe(15);
    expect(hexRevenue('B', own, MAP, cfg)).toBe(15);
  });

  it('deux voisins possédés → base + 2×bonus', () => {
    const own: Ownership = { A: 'alice', B: 'alice', C: 'alice', D: null };
    // B a 2 voisins possédés (A et C)
    expect(hexRevenue('B', own, MAP, cfg)).toBe(20);
    // A et C n'ont qu'un voisin possédé (B)
    expect(hexRevenue('A', own, MAP, cfg)).toBe(15);
    expect(hexRevenue('C', own, MAP, cfg)).toBe(15);
  });

  it('voisin possédé par un AUTRE → aucun bonus', () => {
    const own: Ownership = { A: 'alice', B: 'bob', C: null, D: null };
    // A est adjacent à B mais B est à bob → pas de prime pour alice
    expect(hexRevenue('A', own, MAP, cfg)).toBe(10);
    expect(hexRevenue('B', own, MAP, cfg)).toBe(10);
  });

  it('agglomération symétrique : un cluster rapporte des deux côtés', () => {
    const own: Ownership = { A: 'alice', B: 'alice', C: null, D: null };
    // total du cluster A+B = (10+5) + (10+5) = 30
    expect(hexRevenue('A', own, MAP, cfg) + hexRevenue('B', own, MAP, cfg)).toBe(30);
  });
});

describe('revenue — revenu de l\'acteur', () => {
  it('somme sur tous les hexes possédés, agglomération comprise', () => {
    const own: Ownership = { A: 'alice', B: 'alice', C: 'alice', D: null };
    // A:15, B:20, C:15 → 50
    expect(actorIncome('alice', own, MAP, cfg)).toBe(50);
  });

  it('acteur sans hex → 0', () => {
    const own: Ownership = { A: 'bob', B: null, C: null, D: null };
    expect(actorIncome('alice', own, MAP, cfg)).toBe(0);
  });

  it('deux acteurs adjacents : chacun sa base, aucun ne bonifie l\'autre', () => {
    const own: Ownership = { A: 'alice', B: 'bob', C: 'bob', D: null };
    expect(actorIncome('alice', own, MAP, cfg)).toBe(10); // A seul
    // bob : B a 1 voisin bob (C), C a 1 voisin bob (B) → 15 + 15 = 30
    expect(actorIncome('bob', own, MAP, cfg)).toBe(30);
  });

  it('un cluster contigu rapporte plus que les mêmes hexes dispersés', () => {
    // Contigu A+B (adjacents) vs dispersé A+D (non adjacents)
    const contigu: Ownership = { A: 'alice', B: 'alice', C: null, D: null };
    const disperse: Ownership = { A: 'alice', B: null, C: null, D: 'alice' };
    expect(actorIncome('alice', contigu, MAP, cfg)).toBe(30); // 15 + 15
    expect(actorIncome('alice', disperse, MAP, cfg)).toBe(20); // 10 + 10, aucune prime
  });
});

describe('revenue — ownedHexes', () => {
  it('liste les hexes d\'un acteur', () => {
    const own: Ownership = { A: 'alice', B: 'bob', C: 'alice', D: null };
    expect(ownedHexes('alice', own).sort()).toEqual(['A', 'C']);
    expect(ownedHexes('bob', own)).toEqual(['B']);
    expect(ownedHexes('carol', own)).toEqual([]);
  });
});
