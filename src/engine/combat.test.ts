import { describe, it, expect } from 'vitest';
import {
  makeCombatState, reachable, canMove, moveUnit, endTurn, unitAt, type CombatState,
} from './combat';
import type { GameMap } from './types';

// Carte en ligne : A — B — C — D — E (chaque case voisine de ses adjacentes).
const LINE: GameMap = {
  id: 'line',
  hexes: [
    { id: 'A', label: 'A', kind: 'marche', neighbors: ['B'] },
    { id: 'B', label: 'B', kind: 'marche', neighbors: ['A', 'C'] },
    { id: 'C', label: 'C', kind: 'marche', neighbors: ['B', 'D'] },
    { id: 'D', label: 'D', kind: 'marche', neighbors: ['C', 'E'] },
    { id: 'E', label: 'E', kind: 'marche', neighbors: ['D'] },
  ],
};

function fresh(aliceHex = 'A', bobHex = 'E'): CombatState {
  return makeCombatState(LINE, [
    { id: 'a', owner: 'alice', hex: aliceHex },
    { id: 'b', owner: 'bob', hex: bobHex },
  ], 'alice');
}

describe('combat/déplacement — portée', () => {
  it('reachable rend les cases dans l\'allocation, avec leur distance', () => {
    const r = reachable(fresh(), 'a', 2);
    expect(r.get('B')).toBe(1);
    expect(r.get('C')).toBe(2);
    expect(r.has('D')).toBe(false); // hors portée
    expect(r.has('A')).toBe(false); // case de départ exclue
  });

  it('move ≤ 0 → aucune case', () => {
    expect(reachable(fresh(), 'a', 0).size).toBe(0);
  });
});

describe('combat/déplacement — les unités bloquent', () => {
  it('une case occupée est infranchissable (ni arrêt, ni passage)', () => {
    // bob sur C : alice en A avec 4 de move ne peut atteindre que B (C bloque la ligne).
    const r = reachable(fresh('A', 'C'), 'a', 4);
    expect(r.get('B')).toBe(1);
    expect(r.has('C')).toBe(false); // occupée
    expect(r.has('D')).toBe(false); // derrière l'obstacle
    expect(r.has('E')).toBe(false);
  });
});

describe('combat/déplacement — appliquer un mouvement', () => {
  it('moveUnit déplace si légal (immuable)', () => {
    const s = moveUnit(fresh(), 'a', 'C', 3);
    expect(unitAt(s, 'C')?.id).toBe('a');
    expect(unitAt(s, 'A')).toBeUndefined();
  });

  it('moveUnit sans effet si hors portée', () => {
    const s0 = fresh();
    expect(moveUnit(s0, 'a', 'D', 2)).toBe(s0); // D est à distance 3
  });

  it('moveUnit sans effet vers une case occupée', () => {
    const s0 = fresh('A', 'B');
    expect(moveUnit(s0, 'a', 'B', 3)).toBe(s0);
  });

  it('canMove reflète la légalité', () => {
    expect(canMove(fresh(), 'a', 'C', 3)).toBe(true);
    expect(canMove(fresh(), 'a', 'E', 3)).toBe(false);
  });
});

describe('combat — passage de main', () => {
  it('endTurn alterne le joueur actif et incrémente le tour', () => {
    const s1 = endTurn(fresh());
    expect(s1.active).toBe('bob');
    expect(s1.turn).toBe(2);
    const s2 = endTurn(s1);
    expect(s2.active).toBe('alice'); // retour à alice
    expect(s2.turn).toBe(3);
  });
});
