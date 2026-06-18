import { describe, it, expect } from 'vitest';
import { makeCombatState, unitById, type CombatState, type Unit } from './combat';
import { planTurn, playTurn, applyAction, DIFFICULTIES, type Difficulty } from './ai';
import type { GameMap } from './types';

// Carte en ligne : P0 — P1 — P2 — P3 — P4 — P5.
const LINE: GameMap = {
  id: 'line',
  hexes: Array.from({ length: 6 }, (_, i) => ({
    id: `P${i}`, label: `P${i}`, kind: 'marche',
    neighbors: [i > 0 ? `P${i - 1}` : null, i < 5 ? `P${i + 1}` : null].filter(Boolean) as string[],
  })),
};

function u(p: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit {
  return { hp: 10, maxHp: 10, ap: 4, range: 1, damage: 4, attackCost: 2, kind: 'test', ...p };
}

describe('ai/priorité — achever plutôt que pocher', () => {
  it('attaque en priorité la cible létale', () => {
    // alice en P2 (portée 1) ; un ennemi faible en P1 (PV 3, tuable), un robuste en P3.
    const s = makeCombatState(LINE, [
      u({ id: 'a', owner: 'alice', hex: 'P2', ap: 2 }),
      u({ id: 'weak', owner: 'bob', hex: 'P1', hp: 3, damage: 0 }),
      u({ id: 'tough', owner: 'bob', hex: 'P3', hp: 12, damage: 0 }),
    ], 'alice');
    const first = planTurn(s, 'normal')[0];
    expect(first).toEqual({ type: 'attack', attackerId: 'a', targetId: 'weak' });
  });
});

// Carte « losange » : S relié à X et Y, tous deux reliés au but G ; W ne touche que X.
//   S—X—G , S—Y—G , W—X.  Un tireur sur W (portée 1) ne menace que X.
const DIAMOND: GameMap = {
  id: 'diamond',
  hexes: [
    { id: 'S', label: 'S', kind: 'marche', neighbors: ['X', 'Y'] },
    { id: 'X', label: 'X', kind: 'marche', neighbors: ['S', 'G', 'W'] },
    { id: 'Y', label: 'Y', kind: 'marche', neighbors: ['S', 'G'] },
    { id: 'G', label: 'G', kind: 'marche', neighbors: ['X', 'Y'] },
    { id: 'W', label: 'W', kind: 'marche', neighbors: ['X'] },
  ],
};

function diamond(): CombatState {
  return makeCombatState(DIAMOND, [
    u({ id: 'a', owner: 'alice', hex: 'S', ap: 1 }),          // 1 PA → un seul pas (X ou Y)
    u({ id: 'foe', owner: 'bob', hex: 'G', damage: 0 }),       // l'appât (vers lui on avance)
    u({ id: 'watch', owner: 'bob', hex: 'W', range: 1, damage: 4, watching: true }), // guette X
  ], 'alice');
}

describe('ai/tir réservé — Facile fonce, Normal contourne', () => {
  it('Facile marche sur la case guettée (X), Normal prend la sûre (Y)', () => {
    expect(planTurn(diamond(), 'facile')[0]).toEqual({ type: 'move', unitId: 'a', dest: 'X' });
    expect(planTurn(diamond(), 'normal')[0]).toEqual({ type: 'move', unitId: 'a', dest: 'Y' });
  });

  it('conséquence réelle : Facile encaisse le tir réflexe, Normal non', () => {
    const facile = playTurn(diamond(), 4, 'facile');
    const normal = playTurn(diamond(), 4, 'normal');
    expect(unitById(facile, 'a')!.hp).toBeLessThan(unitById(normal, 'a')!.hp);
  });
});

describe('ai/verbes — Garde et Tir réservé (Normal+ seulement)', () => {
  it('la Lourde menacée mais hors de portée se met en garde (Normal), Facile avance', () => {
    // Lourde en P0 (portée 1) ; tireur ennemi en P3 (portée 3) → menace sans cible à frapper.
    const lourde = (): CombatState => makeCombatState(LINE, [
      u({ id: 'L', owner: 'alice', hex: 'P0', ap: 3, range: 1, guard: { cost: 3, damageTakenMul: 0.5 } }),
      u({ id: 'sniper', owner: 'bob', hex: 'P3', range: 3, damage: 4 }),
    ], 'alice');
    expect(planTurn(lourde(), 'normal')[0]).toEqual({ type: 'guard', unitId: 'L' });
    expect(planTurn(lourde(), 'facile')[0]!.type).toBe('move'); // pas de verbe → avance
  });

  it('le Tireur réserve son tir face à un ennemi qui peut s’approcher (Normal)', () => {
    const tireur = (): CombatState => makeCombatState(LINE, [
      u({ id: 'T', owner: 'alice', hex: 'P0', ap: 3, range: 2, damage: 3, overwatch: { cost: 3 } }),
      u({ id: 'rush', owner: 'bob', hex: 'P4', range: 1, damage: 4 }),
    ], 'alice');
    expect(planTurn(tireur(), 'normal')[0]).toEqual({ type: 'reserve', unitId: 'T' });
    expect(planTurn(tireur(), 'facile')[0]!.type).toBe('move');
  });
});

describe('ai/robustesse — terminaison, déterminisme, intégrité', () => {
  const skirmish = (): CombatState => makeCombatState(LINE, [
    u({ id: 'a', owner: 'alice', hex: 'P0', ap: 4 }),
    u({ id: 'b', owner: 'bob', hex: 'P5', ap: 4 }),
  ], 'alice');

  it('le plan se termine toujours par endTurn, sans dépasser la borne', () => {
    for (const lvl of DIFFICULTIES) {
      const plan = planTurn(skirmish(), lvl);
      expect(plan.at(-1)).toEqual({ type: 'endTurn' });
      expect(plan.length).toBeLessThanOrEqual(65);
    }
  });

  it('déterministe : même entrée → même plan', () => {
    for (const lvl of DIFFICULTIES) {
      expect(planTurn(skirmish(), lvl)).toEqual(planTurn(skirmish(), lvl));
    }
  });

  it('sans ennemi, le plan est juste [endTurn]', () => {
    const alone = makeCombatState(LINE, [u({ id: 'a', owner: 'alice', hex: 'P0' })], 'alice');
    expect(planTurn(alone, 'difficile')).toEqual([{ type: 'endTurn' }]);
  });

  it('playTurn passe la main à l’adversaire et recharge ses PA', () => {
    const after = playTurn(skirmish(), 4, 'normal');
    expect(after.active).toBe('bob');
    expect(unitById(after, 'b')!.ap).toBe(4);
  });

  it('playTurn ne dépense jamais plus que les PA d’une pièce', () => {
    const after = playTurn(skirmish(), 4, 'difficile');
    for (const piece of after.units) expect(piece.ap).toBeGreaterThanOrEqual(0);
  });

  it('chaque niveau sait achever un ennemi à portée', () => {
    for (const lvl of DIFFICULTIES as Difficulty[]) {
      const s = makeCombatState(LINE, [
        u({ id: 'a', owner: 'alice', hex: 'P0', ap: 4, damage: 4 }),
        u({ id: 'b', owner: 'bob', hex: 'P1', hp: 4, damage: 0 }),
      ], 'alice');
      expect(unitById(playTurn(s, 4, lvl), 'b')).toBeUndefined(); // bob abattu
    }
  });
});
