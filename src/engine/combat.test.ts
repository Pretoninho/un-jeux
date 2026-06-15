import { describe, it, expect } from 'vitest';
import {
  makeCombatState, reachable, moveUnit, attack, canAttack, endTurn, winner,
  unitAt, unitById, graphDistance, activeUnits, type CombatState, type Unit,
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

// Fabrique une pièce de test. Défauts : portée 1, dégâts 4, attaque à 2 PA.
function u(partial: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit {
  return {
    hp: 10, maxHp: 10, ap: 10, range: 1, damage: 4, attackCost: 2, kind: 'test',
    ...partial,
  };
}

// 1v1 par défaut (alice 'a' vs bob 'b').
function fresh(aliceHex = 'A', bobHex = 'E', ap = 10, hp = 10): CombatState {
  return makeCombatState(LINE, [
    u({ id: 'a', owner: 'alice', hex: aliceHex, hp, ap }),
    u({ id: 'b', owner: 'bob', hex: bobHex, hp, ap }),
  ], 'alice');
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
  it('moveUnit déplace et déduit la distance des PA de la pièce', () => {
    const s = moveUnit(fresh('A', 'E', 4), 'a', 'C'); // distance 2
    expect(unitAt(s, 'C')?.id).toBe('a');
    expect(unitAt(s, 'A')).toBeUndefined();
    expect(unitById(s, 'a')!.ap).toBe(2); // 4 − 2
  });

  it('moveUnit sans effet si au-delà des PA', () => {
    const s0 = fresh('A', 'E', 1); // 1 PA → C (distance 2) hors d'atteinte
    expect(moveUnit(s0, 'a', 'C')).toBe(s0);
  });

  it('moveUnit sans effet vers une case occupée', () => {
    const s0 = fresh('A', 'B', 4);
    expect(moveUnit(s0, 'a', 'B')).toBe(s0);
  });

  it('on ne déplace que les pièces du camp actif', () => {
    const s0 = fresh('A', 'E', 4);
    expect(moveUnit(s0, 'b', 'D')).toBe(s0); // bob n'est pas actif
  });

  it('les pièces ont des PA indépendants', () => {
    const s0 = makeCombatState(LINE, [
      u({ id: 'a1', owner: 'alice', hex: 'A', ap: 4 }),
      u({ id: 'a2', owner: 'alice', hex: 'C', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4 }),
    ], 'alice');
    const s1 = moveUnit(s0, 'a1', 'B'); // a1 dépense 1
    expect(unitById(s1, 'a1')!.ap).toBe(3);
    expect(unitById(s1, 'a2')!.ap).toBe(4); // inchangé
    expect(activeUnits(s1)).toHaveLength(2);
  });
});

describe('combat/attaque', () => {
  it('graphDistance mesure la distance de cases', () => {
    expect(graphDistance(LINE, 'A', 'B')).toBe(1);
    expect(graphDistance(LINE, 'A', 'C')).toBe(2);
  });

  it('attaque une cible à portée : dégâts de l\'attaquant, dépense ses PA', () => {
    const s = attack(fresh('A', 'B', 4, 10), 'a', 'b');
    expect(unitById(s, 'b')!.hp).toBe(6); // 10 − 4
    expect(unitById(s, 'a')!.ap).toBe(2); // 4 − 2
  });

  it('la portée provient de l\'attaquant (un tireur frappe de loin)', () => {
    const s0 = makeCombatState(LINE, [
      u({ id: 'a', owner: 'alice', hex: 'A', range: 4, damage: 2, ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4 }), // distance 4
    ], 'alice');
    expect(canAttack(s0, 'a', 'b')).toBe(true);
    expect(unitById(attack(s0, 'a', 'b'), 'b')!.hp).toBe(8); // 10 − 2
  });

  it('pas d\'attaque hors de portée', () => {
    const s0 = fresh('A', 'C', 4, 10); // distance 2 > portée 1
    expect(canAttack(s0, 'a', 'b')).toBe(false);
    expect(attack(s0, 'a', 'b')).toBe(s0);
  });

  it('pas d\'attaque sans assez de PA', () => {
    const s0 = fresh('A', 'B', 1, 10); // 1 PA < coût 2
    expect(attack(s0, 'a', 'b')).toBe(s0);
  });

  it('coup létal : la cible quitte le plateau, le survivant gagne', () => {
    const s = attack(fresh('A', 'B', 4, 4), 'a', 'b'); // bob à 4 PV, dégâts 4
    expect(unitById(s, 'b')).toBeUndefined();
    expect(winner(s)).toBe('alice');
  });

  it('partie en cours tant que les deux camps ont une pièce', () => {
    expect(winner(fresh())).toBeNull();
  });
});

describe('combat — passage de main', () => {
  it('endTurn alterne le camp actif, incrémente le tour et recharge SES PA', () => {
    const depleted = makeCombatState(LINE, [
      u({ id: 'a', owner: 'alice', hex: 'A', ap: 0 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 0 }),
    ], 'alice');
    const s1 = endTurn(depleted, 4);
    expect(s1.active).toBe('bob');
    expect(s1.turn).toBe(2);
    expect(unitById(s1, 'b')!.ap).toBe(4); // PA du camp entrant rechargés
    expect(unitById(s1, 'a')!.ap).toBe(0); // l'autre camp inchangé
    expect(endTurn(s1, 4).active).toBe('alice');
  });
});
