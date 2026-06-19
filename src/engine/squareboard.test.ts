import { describe, it, expect } from 'vitest';
import { makeSquareBoard } from './squareboard';
import { makeCombatState, reachable, moveBudget, moveUnit, unitById, type Unit } from './combat';

const board = (n: number) => makeSquareBoard(n);
const byId = (b: ReturnType<typeof makeSquareBoard>, id: string) => b.map.hexes.find((h) => h.id === id)!;

describe('squareboard — topologie pure (grille n×n, 8 voisins)', () => {
  it('génère n² cases et 2 coins opposés', () => {
    const b = board(5);
    expect(b.map.hexes).toHaveLength(25);
    expect(b.corners).toEqual(['0,0', '4,4']);
  });

  it('un coin a 3 voisins, le centre en a 8 (diagonales incluses)', () => {
    const b = board(5);
    expect(byId(b, '0,0').neighbors.sort()).toEqual(['0,1', '1,0', '1,1']);
    expect(byId(b, '2,2').neighbors).toHaveLength(8);
  });

  it('la diagonale compte pour 1 pas (déplacement « roi »)', () => {
    const b = board(5);
    expect(byId(b, '2,2').neighbors).toContain('3,3');
  });
});

describe('squareboard — le moteur tourne dessus sans modification', () => {
  const u = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    ({ hp: 10, maxHp: 10, ap: 10, range: 1, damage: 4, attackCost: 2, kind: 'test', ...over });

  it('une pièce traverse la grille en diagonale (8 voisins)', () => {
    const b = board(5);
    const s0 = makeCombatState(b.map, [u({ id: 'a', owner: 'alice', hex: '0,0', moveCap: 4 })], 'alice');
    const reach = reachable(s0, 'a', moveBudget(unitById(s0, 'a')!));
    expect(reach.get('2,2')).toBe(2);                  // 2 pas en diagonale
    const s1 = moveUnit(s0, 'a', '2,2');
    expect(unitById(s1, 'a')!.hex).toBe('2,2');
  });
});
