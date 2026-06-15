import { describe, it, expect } from 'vitest';
import {
  makeCombatState, reachable, moveUnit, attack, canAttack, endTurn, winner,
  unitAt, unitById, graphDistance, type CombatState, type AttackConfig,
} from './combat';
import type { GameMap } from './types';

// Carte en ligne : A — B — C — D — E.
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
const ATK: AttackConfig = { range: 1, cost: 2, damage: 4 };

function fresh(aliceHex = 'A', bobHex = 'E', ap = 10, hp = 10): CombatState {
  return makeCombatState(LINE, [
    { id: 'a', owner: 'alice', hex: aliceHex, hp },
    { id: 'b', owner: 'bob', hex: bobHex, hp },
  ], 'alice', ap);
}

describe('combat/déplacement — portée', () => {
  it('reachable rend les cases dans l\'allocation, avec leur distance', () => {
    const r = reachable(fresh(), 'a', 2);
    expect(r.get('B')).toBe(1);
    expect(r.get('C')).toBe(2);
    expect(r.has('D')).toBe(false);
    expect(r.has('A')).toBe(false); // case de départ exclue
  });

  it('une case occupée est infranchissable (ni arrêt, ni passage)', () => {
    const r = reachable(fresh('A', 'C'), 'a', 4); // bob sur C bloque la ligne
    expect(r.get('B')).toBe(1);
    expect(r.has('C')).toBe(false);
    expect(r.has('D')).toBe(false);
  });
});

describe('combat/déplacement — appliquer + coût en PA', () => {
  it('moveUnit déplace et déduit la distance des PA', () => {
    const s = moveUnit(fresh('A', 'E', 4), 'a', 'C'); // distance 2
    expect(unitAt(s, 'C')?.id).toBe('a');
    expect(unitAt(s, 'A')).toBeUndefined();
    expect(s.ap).toBe(2); // 4 − 2
  });

  it('moveUnit sans effet si au-delà des PA', () => {
    const s0 = fresh('A', 'E', 1); // 1 PA → C (distance 2) hors d'atteinte
    expect(moveUnit(s0, 'a', 'C')).toBe(s0);
  });

  it('moveUnit sans effet vers une case occupée', () => {
    const s0 = fresh('A', 'B', 4);
    expect(moveUnit(s0, 'a', 'B')).toBe(s0);
  });

  it('on ne déplace que l\'unité du camp actif', () => {
    const s0 = fresh('A', 'E', 4);
    expect(moveUnit(s0, 'b', 'D')).toBe(s0); // bob n'est pas actif
  });
});

describe('combat/attaque', () => {
  it('graphDistance mesure la distance de cases', () => {
    expect(graphDistance(LINE, 'A', 'B')).toBe(1);
    expect(graphDistance(LINE, 'A', 'C')).toBe(2);
  });

  it('attaque une cible adjacente : inflige des dégâts, dépense des PA', () => {
    const s = attack(fresh('A', 'B', 4, 10), 'b', ATK);
    expect(unitById(s, 'b')!.hp).toBe(6); // 10 − 4
    expect(s.ap).toBe(2); // 4 − 2
  });

  it('pas d\'attaque hors de portée', () => {
    const s0 = fresh('A', 'C', 4, 10); // distance 2 > portée 1
    expect(canAttack(s0, 'b', ATK)).toBe(false);
    expect(attack(s0, 'b', ATK)).toBe(s0);
  });

  it('pas d\'attaque sans assez de PA', () => {
    const s0 = fresh('A', 'B', 1, 10); // 1 PA < coût 2
    expect(attack(s0, 'b', ATK)).toBe(s0);
  });

  it('coup létal : la cible quitte le plateau, le survivant gagne', () => {
    const s = attack(fresh('A', 'B', 4, 4), 'b', ATK); // bob à 4 PV, 4 dégâts
    expect(unitById(s, 'b')).toBeUndefined();
    expect(winner(s)).toBe('alice');
  });

  it('partie en cours tant que les deux camps ont une unité', () => {
    expect(winner(fresh())).toBeNull();
  });
});

describe('combat — passage de main', () => {
  it('endTurn alterne le camp actif, incrémente le tour et recharge les PA', () => {
    const s1 = endTurn({ ...fresh(), ap: 0 }, 4);
    expect(s1.active).toBe('bob');
    expect(s1.turn).toBe(2);
    expect(s1.ap).toBe(4);
    expect(endTurn(s1, 4).active).toBe('alice');
  });
});
