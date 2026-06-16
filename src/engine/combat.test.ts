import { describe, it, expect } from 'vitest';
import {
  makeCombatState, reachable, moveUnit, attack, canAttack, defend, canDefend,
  reserve, canReserve, resolveOverwatch, riposte, canRiposte, previewReactions, endTurn, winner,
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

describe('combat — garde / défendre', () => {
  // Pièce dotée de la capacité de garde (3 PA → ×0.5 dégâts subis), comme la Lourde.
  const guardian = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ guard: { cost: 3, damageTakenMul: 0.5 }, ...over });

  it('defend met la pièce en garde et dépense le coût en PA', () => {
    const s0 = makeCombatState(LINE, [
      guardian({ id: 'a', owner: 'alice', hex: 'A', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4 }),
    ], 'alice');
    const s = defend(s0, 'a');
    expect(unitById(s, 'a')!.guarding).toBe(true);
    expect(unitById(s, 'a')!.ap).toBe(1); // 4 − 3
  });

  it('une cible en garde subit des dégâts réduits (×0.5, arrondi bas)', () => {
    const base = makeCombatState(LINE, [
      guardian({ id: 'a', owner: 'alice', hex: 'A', ap: 4, hp: 16 }),
      u({ id: 'b', owner: 'bob', hex: 'B', ap: 4, damage: 5 }),
    ], 'alice');
    const s = attack(endTurn(defend(base, 'a'), 4), 'b', 'a'); // alice gardée, puis bob frappe
    expect(unitById(s, 'a')!.hp).toBe(14); // 16 − floor(5 × 0.5) = 16 − 2
  });

  it('plancher de dégâts à 1 même en garde', () => {
    const base = makeCombatState(LINE, [
      guardian({ id: 'a', owner: 'alice', hex: 'A', ap: 4, hp: 7 }),
      u({ id: 'b', owner: 'bob', hex: 'B', ap: 4, damage: 1 }),
    ], 'alice');
    const s = attack(endTurn(defend(base, 'a'), 4), 'b', 'a');
    expect(unitById(s, 'a')!.hp).toBe(6); // 7 − max(1, floor(0.5)) = 7 − 1
  });

  it('la garde protège le tour adverse puis expire au début du tour suivant', () => {
    const base = makeCombatState(LINE, [
      guardian({ id: 'a', owner: 'alice', hex: 'A', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4 }),
    ], 'alice');
    const bobTurn = endTurn(defend(base, 'a'), 4);
    expect(unitById(bobTurn, 'a')!.guarding).toBe(true); // protégée pendant le tour de bob
    const aliceAgain = endTurn(bobTurn, 4);
    expect(unitById(aliceAgain, 'a')!.guarding).toBe(false); // garde levée à son retour
  });

  it('sans la capacité de garde, le Tireur ne peut pas se défendre', () => {
    const s0 = makeCombatState(LINE, [
      u({ id: 'a', owner: 'alice', hex: 'A', ap: 4 }), // pas de `guard`
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4 }),
    ], 'alice');
    expect(canDefend(s0, 'a')).toBe(false);
    expect(defend(s0, 'a')).toBe(s0);
  });

  it('pas de garde sans assez de PA, ni deux fois', () => {
    const s0 = makeCombatState(LINE, [
      guardian({ id: 'a', owner: 'alice', hex: 'A', ap: 2 }), // 2 < coût 3
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4 }),
    ], 'alice');
    expect(canDefend(s0, 'a')).toBe(false);
    const ok = defend(makeCombatState(LINE, [
      guardian({ id: 'a', owner: 'alice', hex: 'A', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4 }),
    ], 'alice'), 'a');
    expect(canDefend(ok, 'a')).toBe(false); // déjà en garde
  });
});

describe('combat — tir réservé / overwatch', () => {
  // Pièce dotée du tir réservé (3 PA), comme le Tireur ; portée 4, dégâts 2 par défaut.
  const watcher = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ overwatch: { cost: 3 }, range: 4, damage: 2, ...over });

  it('reserve arme le guet et dépense le coût en PA', () => {
    const s0 = makeCombatState(LINE, [
      watcher({ id: 'a', owner: 'alice', hex: 'A', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4 }),
    ], 'alice');
    const s = reserve(s0, 'a');
    expect(unitById(s, 'a')!.watching).toBe(true);
    expect(unitById(s, 'a')!.ap).toBe(1); // 4 − 3
  });

  it('un ennemi qui s\'arrête à portée d\'un guetteur se prend un tir réflexe', () => {
    const base = makeCombatState(LINE, [
      watcher({ id: 'a', owner: 'alice', hex: 'A', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4, hp: 7 }),
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'a'), 4);      // alice en guet, bob actif
    const s = resolveOverwatch(moveUnit(bobTurn, 'b', 'C'), 'b'); // E→C = 2 ≤ portée 4
    expect(unitById(s, 'b')!.hp).toBe(5);                // 7 − 2
    expect(unitById(s, 'a')!.watching).toBe(false);      // réserve consommée
  });

  it('pas de réflexe si l\'ennemi reste hors de portée', () => {
    const base = makeCombatState(LINE, [
      watcher({ id: 'a', owner: 'alice', hex: 'A', ap: 4, range: 1 }), // portée 1
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4, hp: 7 }),
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'a'), 4);
    const s = resolveOverwatch(moveUnit(bobTurn, 'b', 'C'), 'b'); // C à dist 2 > portée 1
    expect(unitById(s, 'b')!.hp).toBe(7);
    expect(unitById(s, 'a')!.watching).toBe(true);       // toujours en guet
  });

  it('le tir réflexe peut être létal', () => {
    const base = makeCombatState(LINE, [
      watcher({ id: 'a', owner: 'alice', hex: 'A', ap: 4, damage: 5 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4, hp: 2 }),
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'a'), 4);
    const s = resolveOverwatch(moveUnit(bobTurn, 'b', 'B'), 'b'); // B à dist 1
    expect(unitById(s, 'b')).toBeUndefined();
    expect(winner(s)).toBe('alice');
  });

  it('la réserve protège pendant le tour adverse puis expire au retour du tireur', () => {
    const base = makeCombatState(LINE, [
      watcher({ id: 'a', owner: 'alice', hex: 'A', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4 }),
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'a'), 4);
    expect(unitById(bobTurn, 'a')!.watching).toBe(true);
    expect(unitById(endTurn(bobTurn, 4), 'a')!.watching).toBe(false);
  });

  it('refus : sans capacité, sans PA, ou déjà en guet', () => {
    const noCap = makeCombatState(LINE, [
      u({ id: 'a', owner: 'alice', hex: 'A', ap: 4 }), // pas d'`overwatch`
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4 }),
    ], 'alice');
    expect(canReserve(noCap, 'a')).toBe(false);
    expect(reserve(noCap, 'a')).toBe(noCap);

    const lowAp = makeCombatState(LINE, [
      watcher({ id: 'a', owner: 'alice', hex: 'A', ap: 2 }), // 2 < coût 3
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4 }),
    ], 'alice');
    expect(canReserve(lowAp, 'a')).toBe(false);

    const armed = reserve(makeCombatState(LINE, [
      watcher({ id: 'a', owner: 'alice', hex: 'A', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4 }),
    ], 'alice'), 'a');
    expect(canReserve(armed, 'a')).toBe(false); // déjà en guet
  });
});

describe('combat — riposte / contre', () => {
  // Pièce dotée de la riposte (2 PA), comme le Duelliste ; mêlée portée 1, dégâts 2 par défaut.
  const riposter = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ riposte: { cost: 2 }, range: 1, damage: 2, ...over });

  it('riposte arme le contre et dépense le coût en PA', () => {
    const s0 = makeCombatState(LINE, [
      riposter({ id: 'a', owner: 'alice', hex: 'B', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4 }),
    ], 'alice');
    const s = riposte(s0, 'a');
    expect(unitById(s, 'a')!.riposting).toBe(true);
    expect(unitById(s, 'a')!.ap).toBe(2); // 4 − 2
  });

  it('un attaquant adjacent que la cible encaisse se prend un contre', () => {
    const base = makeCombatState(LINE, [
      riposter({ id: 'a', owner: 'alice', hex: 'B', ap: 4, hp: 10 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 7, damage: 4 }),
    ], 'alice');
    const bobTurn = endTurn(riposte(base, 'a'), 4);          // alice armée, bob actif
    expect(unitById(bobTurn, 'a')!.riposting).toBe(true);    // endTurn n'efface pas la riposte adverse
    const s = attack(bobTurn, 'b', 'a');
    expect(unitById(s, 'a')!.hp).toBe(6);                    // 10 − 4 (coup encaissé)
    expect(unitById(s, 'b')!.hp).toBe(5);                    // 7 − 2 (contre)
    expect(unitById(s, 'a')!.riposting).toBe(false);         // posture consommée
  });

  it('pas de contre contre un attaquant hors de portée mêlée (ex. un tireur)', () => {
    const base = makeCombatState(LINE, [
      riposter({ id: 'a', owner: 'alice', hex: 'A', ap: 4, hp: 10 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 7, range: 2, damage: 4 }), // frappe à distance 2
    ], 'alice');
    const s = attack(endTurn(riposte(base, 'a'), 4), 'b', 'a');
    expect(unitById(s, 'a')!.hp).toBe(6);                    // touchée à distance
    expect(unitById(s, 'b')!.hp).toBe(7);                    // mais pas de contre (A..C = 2 > portée 1)
    expect(unitById(s, 'a')!.riposting).toBe(true);          // posture conservée
  });

  it('pas de contre si la cible meurt du coup', () => {
    const base = makeCombatState(LINE, [
      riposter({ id: 'a', owner: 'alice', hex: 'B', ap: 4, hp: 3 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 7, damage: 4 }),
    ], 'alice');
    const s = attack(endTurn(riposte(base, 'a'), 4), 'b', 'a');
    expect(unitById(s, 'a')).toBeUndefined();
    expect(unitById(s, 'b')!.hp).toBe(7);                    // indemne
    expect(winner(s)).toBe('bob');
  });

  it('le contre peut être létal', () => {
    const base = makeCombatState(LINE, [
      riposter({ id: 'a', owner: 'alice', hex: 'B', ap: 4, hp: 10, damage: 5 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 3, damage: 2 }),
    ], 'alice');
    const s = attack(endTurn(riposte(base, 'a'), 4), 'b', 'a');
    expect(unitById(s, 'a')!.hp).toBe(8);                    // 10 − 2
    expect(unitById(s, 'b')).toBeUndefined();                // 3 − 5
    expect(winner(s)).toBe('alice');
  });

  it('le contre respecte la garde de l\'attaquant (réduit)', () => {
    // Bob s'est gardé ET attaque dans le même tour → le contre qu'il encaisse est réduit.
    const s0 = makeCombatState(LINE, [
      riposter({ id: 'a', owner: 'alice', hex: 'B', hp: 10, damage: 4, riposting: true }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 2,
        guarding: true, guard: { cost: 3, damageTakenMul: 0.5 } }),
    ], 'bob');
    const s = attack(s0, 'b', 'a');
    expect(unitById(s, 'b')!.hp).toBe(8);                    // contre 4 → ×0.5 = 2
  });

  it('la posture protège pendant le tour adverse puis expire au retour du duelliste', () => {
    const base = makeCombatState(LINE, [
      riposter({ id: 'a', owner: 'alice', hex: 'B', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4 }),
    ], 'alice');
    const bobTurn = endTurn(riposte(base, 'a'), 4);
    expect(unitById(bobTurn, 'a')!.riposting).toBe(true);
    expect(unitById(endTurn(bobTurn, 4), 'a')!.riposting).toBe(false);
  });

  it('refus : sans capacité, sans PA, ou déjà armée', () => {
    const noCap = makeCombatState(LINE, [
      u({ id: 'a', owner: 'alice', hex: 'B', ap: 4 }), // pas de `riposte`
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4 }),
    ], 'alice');
    expect(canRiposte(noCap, 'a')).toBe(false);
    expect(riposte(noCap, 'a')).toBe(noCap);

    const lowAp = makeCombatState(LINE, [
      riposter({ id: 'a', owner: 'alice', hex: 'B', ap: 1 }), // 1 < coût 2
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4 }),
    ], 'alice');
    expect(canRiposte(lowAp, 'a')).toBe(false);

    const armed = riposte(makeCombatState(LINE, [
      riposter({ id: 'a', owner: 'alice', hex: 'B', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4 }),
    ], 'alice'), 'a');
    expect(canRiposte(armed, 'a')).toBe(false); // déjà armée
  });
});

describe('combat — réactions en chaîne (synergies)', () => {
  // Un « tank » (kind lourde) en garde, et un allié porteur du passif « épines » (rayon 2, CD 2 ;
  // dégâts 3 si la source est une lourde, 1 sinon).
  const guarder = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ kind: 'lourde', guard: { cost: 3, damageTakenMul: 0.5 }, guarding: true, hp: 16, ...over });
  const listener = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ reactions: [{ id: 'ep', on: 'garde_encaissee', scope: { radius: 2 }, cooldown: 2,
        kind: 'epines', amount: 1, amountBySource: { lourde: 3 } }], cooldowns: {}, ...over });

  it('garde encaissée → un allié à portée relaie des épines sur l\'attaquant (dégâts selon la source)', () => {
    const base = makeCombatState(LINE, [
      guarder({ id: 'a', owner: 'alice', hex: 'B', ap: 4 }),
      listener({ id: 'c', owner: 'alice', hex: 'A', hp: 10, ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    const s = attack(base, 'b', 'a');
    expect(unitById(s, 'a')!.hp).toBe(14);            // 16 − floor(4·0.5) = 2 (encaissé en garde)
    expect(unitById(s, 'b')!.hp).toBe(7);             // épines 3 (source = lourde)
    expect(unitById(s, 'c')!.cooldowns!.ep).toBe(2);  // passif mis en cooldown
  });

  it('pas de chaîne si l\'écouteur est hors du rayon', () => {
    const base = makeCombatState(LINE, [
      guarder({ id: 'a', owner: 'alice', hex: 'B', ap: 4 }),
      listener({ id: 'c', owner: 'alice', hex: 'E', hp: 10 }), // E..B = 3 > rayon 2
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    const s = attack(base, 'b', 'a');
    expect(unitById(s, 'b')!.hp).toBe(10);
    expect(unitById(s, 'c')!.cooldowns!.ep ?? 0).toBe(0);
  });

  it('pas de chaîne si la cible n\'était pas en garde (aucun signal émis)', () => {
    const base = makeCombatState(LINE, [
      guarder({ id: 'a', owner: 'alice', hex: 'B', ap: 4, guarding: false }),
      listener({ id: 'c', owner: 'alice', hex: 'A', hp: 10 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    const s = attack(base, 'b', 'a');
    expect(unitById(s, 'b')!.hp).toBe(10);
  });

  it('le passif ne part pas s\'il est en cooldown', () => {
    const base = makeCombatState(LINE, [
      guarder({ id: 'a', owner: 'alice', hex: 'B', ap: 4 }),
      listener({ id: 'c', owner: 'alice', hex: 'A', hp: 10, cooldowns: { ep: 1 } }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    expect(unitById(attack(base, 'b', 'a'), 'b')!.hp).toBe(10);
  });

  it('le cooldown décompte au retour du camp du possesseur', () => {
    const st = makeCombatState(LINE, [
      listener({ id: 'c', owner: 'alice', hex: 'A', cooldowns: { ep: 2 } }),
      u({ id: 'b', owner: 'bob', hex: 'E' }),
    ], 'bob');
    const a1 = endTurn(st, 4);                  // alice redevient active → décompte
    expect(unitById(a1, 'c')!.cooldowns!.ep).toBe(1);
    const a2 = endTurn(endTurn(a1, 4), 4);      // bob puis alice → re-décompte
    expect(unitById(a2, 'c')!.cooldowns!.ep).toBe(0);
  });

  it('synergie alliée seulement : un ennemi ne réagit pas à la garde adverse', () => {
    const base = makeCombatState(LINE, [
      guarder({ id: 'a', owner: 'alice', hex: 'B', ap: 4 }),
      listener({ id: 'c', owner: 'bob', hex: 'A', hp: 10 }), // écouteur du camp de l'attaquant
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    expect(unitById(attack(base, 'b', 'a'), 'b')!.hp).toBe(10);
  });

  it('la source ne réagit pas à son propre signal (synergie d\'escouade, pas auto-buff)', () => {
    const base = makeCombatState(LINE, [
      // le tank en garde porte LUI-MÊME le passif épines, et reste le seul allié présent
      guarder({ id: 'a', owner: 'alice', hex: 'B', ap: 4,
        reactions: [{ id: 'ep', on: 'garde_encaissee', scope: { radius: 2 }, cooldown: 2,
          kind: 'epines', amount: 1, amountBySource: { lourde: 3 } }], cooldowns: {} }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    const s = attack(base, 'b', 'a');
    expect(unitById(s, 'b')!.hp).toBe(10);              // aucune épine : la source s'exclut
    expect(unitById(s, 'a')!.cooldowns!.ep ?? 0).toBe(0); // son propre passif n'est pas parti
  });

  it('previewReactions annonce la cascade sans muter l\'état', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'x', owner: 'alice', hex: 'B', ap: 4, damage: 4 }),  // ton attaquant
      guarder({ id: 'g', owner: 'bob', hex: 'C', ap: 4 }),         // tank adverse en garde
      listener({ id: 'l', owner: 'bob', hex: 'D', hp: 10 }),       // allié adverse réactif
    ], 'alice');
    const pv = previewReactions(base, 'x', 'g');
    expect(pv).toHaveLength(1);
    expect(pv[0]).toMatchObject({ listenerId: 'l', targetId: 'x', amount: 3 });
    expect(unitById(base, 'x')!.hp).toBe(10); // état d'origine intact (dry-run pur)
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
