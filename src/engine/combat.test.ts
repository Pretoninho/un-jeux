import { describe, it, expect } from 'vitest';
import {
  makeCombatState, reachable, moveBudget, moveUnit, attack, canAttack, defend, canDefend, damageTaken,
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
  // Écouteur dont la cellule existe À LA FOIS par classe (lourde→3) et par héros (bastion→5).
  const charListener = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ reactions: [{ id: 'ep', on: 'garde_encaissee', scope: { radius: 2 }, cooldown: 2,
        kind: 'epines', amount: 1, amountBySource: { lourde: 3 }, amountByCharacter: { bastion: 5 } }], cooldowns: {}, ...over });

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

  it('matrice « × personnage » : la cellule du héros source prime sur celle de sa classe', () => {
    const base = makeCombatState(LINE, [
      guarder({ id: 'a', owner: 'alice', hex: 'B', ap: 4, characterId: 'bastion' }), // héros identifié
      charListener({ id: 'c', owner: 'alice', hex: 'A', hp: 10, ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    expect(unitById(attack(base, 'b', 'a'), 'b')!.hp).toBe(5); // 10 − 5 (cellule héros, pas lourde→3)
  });

  it('matrice « × personnage » : repli sur la classe si le héros source n\'a pas de cellule perso', () => {
    const base = makeCombatState(LINE, [
      guarder({ id: 'a', owner: 'alice', hex: 'B', ap: 4, characterId: 'rempart' }), // absent d'amountByCharacter
      charListener({ id: 'c', owner: 'alice', hex: 'A', hp: 10, ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    expect(unitById(attack(base, 'b', 'a'), 'b')!.hp).toBe(7); // 10 − 3 (repli sur lourde)
  });

  it('duo gâté par héros (fromCharacter) : ne réagit QUE pour ce héros source', () => {
    const reac = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
      u({ reactions: [{ id: 'duo', on: 'garde_encaissee', fromCharacter: 'bastion',
          scope: { radius: 2 }, cooldown: 2, kind: 'epines', amount: 2 }], cooldowns: {}, ...over });
    const withSrc = (cid: string) => makeCombatState(LINE, [
      guarder({ id: 'a', owner: 'alice', hex: 'B', ap: 4, characterId: cid }),
      reac({ id: 'c', owner: 'alice', hex: 'A', hp: 10, ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    expect(unitById(attack(withSrc('bastion'), 'b', 'a'), 'b')!.hp).toBe(8);  // 10 − 2 : le duo part
    expect(unitById(attack(withSrc('rempart'), 'b', 'a'), 'b')!.hp).toBe(10); // autre héros : rien
  });

  it('duo gâté par classe (fromKind) : ne réagit QUE pour cet archétype source', () => {
    const reac = (k: string, over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
      u({ reactions: [{ id: 'duo', on: 'garde_encaissee', fromKind: k,
          scope: { radius: 2 }, cooldown: 2, kind: 'epines', amount: 2 }], cooldowns: {}, ...over });
    const base = (k: string) => makeCombatState(LINE, [
      guarder({ id: 'a', owner: 'alice', hex: 'B', ap: 4 }), // source = lourde
      reac(k, { id: 'c', owner: 'alice', hex: 'A', hp: 10, ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    expect(unitById(attack(base('lourde'), 'b', 'a'), 'b')!.hp).toBe(8);  // source lourde = match → 2
    expect(unitById(attack(base('tireur'), 'b', 'a'), 'b')!.hp).toBe(10); // source ≠ tireur → rien
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

describe('combat — Résonance Estoc × Mireille (marquage)', () => {
  // Mireille (Tireuse, characterId mireille) en guet ; Estoc à portée porte la Résonance marquage.
  const mireille = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ overwatch: { cost: 3 }, range: 4, damage: 2, characterId: 'mireille', ...over });
  const estoc = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ reactions: [{ id: 'mq', on: 'tir_reserve', fromCharacter: 'mireille', scope: { squad: true },
        cooldown: 2, kind: 'marquage', amount: 1, duration: 2 }], cooldowns: {}, ...over });

  // État de départ : le tir réservé de Mireille part sur la cible, Estoc la marque.
  const afterOverwatch = () => {
    const base = makeCombatState(LINE, [
      mireille({ id: 'm', owner: 'alice', hex: 'A', ap: 4 }),
      estoc({ id: 'e', owner: 'alice', hex: 'B', ap: 4 }),     // escouade : position indifférente
      u({ id: 'x', owner: 'bob', hex: 'E', ap: 4, hp: 20 }),   // cible
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'm'), 4);            // Mireille en guet, bob actif
    return resolveOverwatch(moveUnit(bobTurn, 'x', 'C'), 'x'); // E→C (dist 2 ≤ portée 4) → tir
  };

  it('le tir réservé de Mireille marque la cible (et met la Résonance en CD)', () => {
    const s = afterOverwatch();
    expect(unitById(s, 'x')!.hp).toBe(18);                                   // 20 − 2 (tir)
    expect(unitById(s, 'x')!.mark).toMatchObject({ by: 'e', bonus: 1, expiresIn: 2 });
    expect(unitById(s, 'e')!.cooldowns!.mq).toBe(2);                         // Résonance en CD 2
  });

  it('un tir réservé d\'un AUTRE tireur (pas Mireille) ne marque pas', () => {
    const base = makeCombatState(LINE, [
      mireille({ id: 'm', owner: 'alice', hex: 'A', ap: 4, characterId: 'autre_tireur' }),
      estoc({ id: 'e', owner: 'alice', hex: 'B', ap: 4 }),
      u({ id: 'x', owner: 'bob', hex: 'E', ap: 4, hp: 20 }),
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'm'), 4);
    const s = resolveOverwatch(moveUnit(bobTurn, 'x', 'C'), 'x');
    expect(unitById(s, 'x')!.mark).toBeUndefined();
  });

  it('le 1er coup d\'Estoc sur la cible marquée gagne +1, puis la marque tombe', () => {
    const aliceTurn = endTurn(afterOverwatch(), 4);    // bob finit → alice active (marque non décomptée)
    expect(unitById(aliceTurn, 'x')!.mark!.expiresIn).toBe(2);
    const hit1 = attack(aliceTurn, 'e', 'x');          // marqué : 4 + 1 = 5
    expect(unitById(hit1, 'x')!.hp).toBe(13);          // 18 − 5
    expect(unitById(hit1, 'x')!.mark).toBeUndefined(); // marque consommée
    const hit2 = attack(hit1, 'e', 'x');               // 2e coup : dégâts normaux 4
    expect(unitById(hit2, 'x')!.hp).toBe(9);           // 13 − 4
  });

  it('la marque s\'efface après 2 tours d\'Estoc si elle n\'est pas consommée', () => {
    const s = afterOverwatch();                 // bob actif, marque expiresIn 2
    const e1 = endTurn(s, 4);                    // → alice (tour 1 d'Estoc), pas de décompte
    const e2 = endTurn(e1, 4);                   // alice finit → décompte : 1
    const e3 = endTurn(e2, 4);                   // → alice (tour 2 d'Estoc)
    expect(unitById(e3, 'x')!.mark!.expiresIn).toBe(1); // encore là pendant le 2e tour
    const e4 = endTurn(e3, 4);                    // alice finit → décompte : 0 → disparaît
    expect(unitById(e4, 'x')!.mark).toBeUndefined();
  });
});

describe('combat — Résonance Estoc × Rempart (estropier)', () => {
  // Rempart (Lourde, characterId rempart) en garde ; Estoc à portée 2 porte la Résonance estropier.
  const rempart = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ kind: 'lourde', guard: { cost: 3, damageTakenMul: 0.5 }, guarding: true, hp: 16, characterId: 'rempart', ...over });
  const estoc = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ reactions: [{ id: 'es', on: 'garde_encaissee', fromCharacter: 'rempart', scope: { radius: 2 },
        cooldown: 2, kind: 'estropier', amount: 2, duration: 3 }], cooldowns: {}, ...over });

  it('Rempart encaisse + Estoc à portée → l\'attaquant est estropié (et CD posé)', () => {
    const base = makeCombatState(LINE, [
      rempart({ id: 'r', owner: 'alice', hex: 'B', ap: 4 }),
      estoc({ id: 'e', owner: 'alice', hex: 'A', hp: 10, ap: 4 }),  // A..B = 1 ≤ rayon 2
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    const s = attack(base, 'b', 'r');
    expect(unitById(s, 'b')!.cripple).toMatchObject({ amount: 2, owner: 'bob', expiresIn: 3 });
    expect(unitById(s, 'e')!.cooldowns!.es).toBe(2);
  });

  it('pas d\'estropie si Estoc est hors du rayon 2', () => {
    const base = makeCombatState(LINE, [
      rempart({ id: 'r', owner: 'alice', hex: 'B', ap: 4 }),
      estoc({ id: 'e', owner: 'alice', hex: 'E', hp: 10 }),        // E..B = 3 > rayon 2
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    expect(unitById(attack(base, 'b', 'r'), 'b')!.cripple).toBeUndefined();
  });

  it('gâté à Rempart : un autre tank en garde ne déclenche pas l\'estropie', () => {
    const base = makeCombatState(LINE, [
      rempart({ id: 'r', owner: 'alice', hex: 'B', ap: 4, characterId: 'bastion' }), // pas Rempart
      estoc({ id: 'e', owner: 'alice', hex: 'A', hp: 10 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    expect(unitById(attack(base, 'b', 'r'), 'b')!.cripple).toBeUndefined();
  });

  it('l\'estropie bride le DÉPLACEMENT (−2 pas) sans toucher l\'attaque', () => {
    const st = makeCombatState(LINE, [
      u({ id: 'a', owner: 'alice', hex: 'A', ap: 4, cripple: { amount: 2, owner: 'alice', expiresIn: 2 } }),
      u({ id: 'b', owner: 'bob', hex: 'E' }),
    ], 'alice');
    expect(moveBudget(unitById(st, 'a')!)).toBe(2);                // 4 PA − 2
    expect(moveUnit(st, 'a', 'D')).toBe(st);                       // D (dist 3) > budget 2 → refusé
    expect(unitAt(moveUnit(st, 'a', 'C'), 'C')?.id).toBe('a');     // C (dist 2) ≤ budget 2 → ok
  });

  it('l\'estropie tient les 2 tours pleins suivants de la pièce touchée (duration 3)', () => {
    const base = makeCombatState(LINE, [
      rempart({ id: 'r', owner: 'alice', hex: 'B', ap: 4 }),
      estoc({ id: 'e', owner: 'alice', hex: 'A', hp: 10 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    const s = attack(base, 'b', 'r');                      // posée pendant le tour de bob
    expect(unitById(s, 'b')!.cripple!.expiresIn).toBe(3);
    const t1 = endTurn(endTurn(s, 4), 4);                  // → bob actif : 1ᵉʳ tour plein
    expect(unitById(t1, 'b')!.cripple!.expiresIn).toBe(2);
    const t2 = endTurn(endTurn(t1, 4), 4);                 // → bob actif : 2ᵉ tour plein
    expect(unitById(t2, 'b')!.cripple!.expiresIn).toBe(1);
    const t3 = endTurn(endTurn(t2, 4), 4);                 // → bob actif : estropie disparue
    expect(unitById(t3, 'b')!.cripple).toBeUndefined();
  });
});

describe('combat — Résonance Estoc × Orso (provocation)', () => {
  // Orso (Tireur, characterId orso) en guet ; Estoc porte la Résonance provocation (tir vers lui).
  const orso = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ overwatch: { cost: 3 }, range: 4, damage: 2, characterId: 'orso', ...over });
  const estoc = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ reactions: [{ id: 'pv', on: 'tir_reserve', fromCharacter: 'orso', scope: { squad: true },
        cooldown: 2, kind: 'provocation', amount: 1 }], cooldowns: {}, ...over });

  it('le tir réservé d\'Orso tire la cible d\'1 case vers Estoc (et pose le CD)', () => {
    const base = makeCombatState(LINE, [
      estoc({ id: 'e', owner: 'alice', hex: 'A', ap: 4 }),
      orso({ id: 'o', owner: 'alice', hex: 'E', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'D', ap: 4, hp: 10 }),
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'o'), 4);          // Orso en guet, bob actif
    const s = resolveOverwatch(moveUnit(bobTurn, 'b', 'C'), 'b'); // bob D→C (dist 2 ≤ portée 4) → tir
    expect(unitById(s, 'b')!.hp).toBe(8);                    // 10 − 2 (tir d'Orso)
    expect(unitById(s, 'b')!.hex).toBe('B');                 // tiré de C vers Estoc (A)
    expect(unitById(s, 'e')!.cooldowns!.pv).toBe(2);         // CD posé
  });

  it('gâté à Orso : un tir d\'un autre tireur ne provoque pas', () => {
    const base = makeCombatState(LINE, [
      estoc({ id: 'e', owner: 'alice', hex: 'A', ap: 4 }),
      orso({ id: 'o', owner: 'alice', hex: 'E', ap: 4, characterId: 'mireille' }),
      u({ id: 'b', owner: 'bob', hex: 'D', ap: 4, hp: 10 }),
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'o'), 4);
    const s = resolveOverwatch(moveUnit(bobTurn, 'b', 'C'), 'b');
    expect(unitById(s, 'b')!.hex).toBe('C');                 // pas tiré
    expect(unitById(s, 'e')!.cooldowns!.pv ?? 0).toBe(0);    // pas déclenché
  });

  it('cible déjà collée à Estoc : pas de déplacement mais CD consommé quand même', () => {
    const base = makeCombatState(LINE, [
      estoc({ id: 'e', owner: 'alice', hex: 'A', ap: 4 }),
      orso({ id: 'o', owner: 'alice', hex: 'E', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10 }),
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'o'), 4);
    const s = resolveOverwatch(moveUnit(bobTurn, 'b', 'B'), 'b'); // bob C→B (collé à Estoc en A)
    expect(unitById(s, 'b')!.hex).toBe('B');                 // A occupé, C plus loin → pas tiré
    expect(unitById(s, 'e')!.cooldowns!.pv).toBe(2);         // CD consommé malgré tout
  });
});

describe('combat — Résonance Fil × Bastion (vendetta)', () => {
  // Bastion (Lourde, characterId bastion) en garde ; Fil à portée 2 porte la Résonance vendetta.
  const bastion = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ kind: 'lourde', guard: { cost: 3, damageTakenMul: 0.5 }, guarding: true, hp: 16, characterId: 'bastion', ...over });
  const fil = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ reactions: [{ id: 'vd', on: 'garde_encaissee', fromCharacter: 'bastion', scope: { radius: 2 },
        cooldown: 3, kind: 'vendetta', amount: 2 }], cooldowns: {}, ...over });

  it('Bastion encaisse + Fil à portée → Bastion gagne Vendetta (+2) et la Résonance passe en CD 3', () => {
    const base = makeCombatState(LINE, [
      bastion({ id: 'r', owner: 'alice', hex: 'B', ap: 4 }),
      fil({ id: 'f', owner: 'alice', hex: 'A', hp: 10, ap: 4 }),  // A..B = 1 ≤ rayon 2
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    const s = attack(base, 'b', 'r');
    expect(unitById(s, 'r')!.vendetta).toBe(2);            // le SOURCE (Bastion) est buffé, pas l'attaquant
    expect(unitById(s, 'b')!.vendetta).toBeUndefined();
    expect(unitById(s, 'f')!.cooldowns!.vd).toBe(3);
  });

  it('Bastion consomme la Vendetta à sa prochaine attaque (+2), puis elle tombe', () => {
    const base = makeCombatState(LINE, [
      bastion({ id: 'r', owner: 'alice', hex: 'B', ap: 4 }),
      fil({ id: 'f', owner: 'alice', hex: 'A', hp: 10, ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 16, damage: 4 }),
    ], 'bob');
    const s = endTurn(attack(base, 'b', 'r'), 4);          // bob frappe Bastion → Vendetta ; puis tour d'alice
    expect(unitById(s, 'r')!.vendetta).toBe(2);            // la rancune survit au passage de tour
    const hit = attack(s, 'r', 'b');                        // Bastion (dégâts 4) frappe : 4 + 2 = 6
    expect(unitById(hit, 'b')!.hp).toBe(10);               // 16 − 6
    expect(unitById(hit, 'r')!.vendetta).toBeUndefined();  // consommée
  });

  it('gâté à Bastion : un autre tank en garde ne donne pas la Vendetta', () => {
    const base = makeCombatState(LINE, [
      bastion({ id: 'r', owner: 'alice', hex: 'B', ap: 4, characterId: 'rempart' }), // pas Bastion
      fil({ id: 'f', owner: 'alice', hex: 'A', hp: 10 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    expect(unitById(attack(base, 'b', 'r'), 'r')!.vendetta).toBeUndefined();
  });

  it('pas de Vendetta si Fil est hors du rayon 2', () => {
    const base = makeCombatState(LINE, [
      bastion({ id: 'r', owner: 'alice', hex: 'B', ap: 4 }),
      fil({ id: 'f', owner: 'alice', hex: 'E', hp: 10 }),   // E..B = 3 > rayon 2
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    expect(unitById(attack(base, 'b', 'r'), 'r')!.vendetta).toBeUndefined();
  });
});

describe('combat — Résonance Fil × Mireille (râle → ralliement)', () => {
  // Fil porte la Résonance « à la mort » de Mireille : il se téléporte sur sa case et devient invulnérable.
  const fil = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ reactions: [{ id: 'ral', on: 'rale', fromCharacter: 'mireille', scope: { squad: true },
        cooldown: 3, kind: 'ralliement', duration: 4 }], cooldowns: {}, ...over });

  it('la mort de Mireille téléporte Fil sur sa case et lui donne l\'immunité (block)', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'm', owner: 'alice', hex: 'D', hp: 3, characterId: 'mireille' }), // Mireille, fragile
      fil({ id: 'f', owner: 'alice', hex: 'A', hp: 10, ap: 4 }),                // Fil, loin (escouade)
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4, damage: 4 }),                 // tueur (E adjacent D)
    ], 'bob');
    const s = attack(base, 'b', 'm');                       // bob tue Mireille (3 PV, 4 dégâts)
    expect(unitById(s, 'm')).toBeUndefined();               // Mireille morte, retirée
    expect(unitById(s, 'f')!.hex).toBe('D');                // Fil rallie sur la case de Mireille
    expect(unitById(s, 'f')!.block).toMatchObject({ owner: 'alice', expiresIn: 4 });
    expect(unitById(s, 'f')!.cooldowns!.ral).toBe(3);
  });

  it('Fil bloqué ne subit AUCUN dégât', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'm', owner: 'alice', hex: 'D', hp: 3, characterId: 'mireille' }),
      fil({ id: 'f', owner: 'alice', hex: 'A', hp: 10, ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4, damage: 4 }),
    ], 'bob');
    const s = attack(base, 'b', 'm');                       // bob a encore 2 PA ; Fil est en D (adjacent E)
    const hit = attack(s, 'b', 'f');                        // bob frappe Fil bloqué
    expect(unitById(hit, 'f')!.hp).toBe(10);               // immunité totale : 0 dégât
  });

  it('gâté à Mireille : la mort d\'un autre allié ne déclenche pas le ralliement', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'm', owner: 'alice', hex: 'D', hp: 3, characterId: 'orso' }),     // pas Mireille
      fil({ id: 'f', owner: 'alice', hex: 'A', hp: 10, ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'E', ap: 4, damage: 4 }),
    ], 'bob');
    const s = attack(base, 'b', 'm');
    expect(unitById(s, 'f')!.hex).toBe('A');                // pas de téléportation
    expect(unitById(s, 'f')!.block).toBeUndefined();        // pas d'immunité
  });

  it('le block se décompte au fil des tours de Fil et finit par tomber', () => {
    const blocked = u({ id: 'f', owner: 'alice', hex: 'A', hp: 10, block: { owner: 'alice', expiresIn: 2 } });
    const st = makeCombatState(LINE, [blocked, u({ id: 'b', owner: 'bob', hex: 'E' })], 'alice');
    expect(damageTaken(blocked, 9)).toBe(0);                // immunité tant qu'actif
    const a2 = endTurn(st, 4);                               // alice finit → décompte : 1
    expect(unitById(a2, 'f')!.block!.expiresIn).toBe(1);
    const a3 = endTurn(endTurn(a2, 4), 4);                   // bob puis alice finit → 0 → disparaît
    expect(unitById(a3, 'f')!.block).toBeUndefined();
  });
});

describe('combat — Résonance Fil × Rempart (coup étourdissant → stun)', () => {
  const rempart = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ kind: 'lourde', guard: { cost: 3, damageTakenMul: 0.5 }, guarding: true, hp: 16, characterId: 'rempart', ...over });
  const fil = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ reactions: [{ id: 'et', on: 'garde_encaissee', fromCharacter: 'rempart', scope: { radius: 2 },
        cooldown: 3, kind: 'etourdir', amount: 1, duration: 3 }], cooldowns: {}, ...over });

  it('Rempart encaisse + Fil à portée → Rempart est armé du Coup étourdissant', () => {
    const base = makeCombatState(LINE, [
      rempart({ id: 'r', owner: 'alice', hex: 'B', ap: 4 }),
      fil({ id: 'f', owner: 'alice', hex: 'A', hp: 10, ap: 4 }),  // A..B = 1 ≤ rayon 2
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    const s = attack(base, 'b', 'r');
    expect(unitById(s, 'r')!.stunCharge).toMatchObject({ owner: 'alice', expiresIn: 3, stun: 1 });
    expect(unitById(s, 'f')!.cooldowns!.et).toBe(3);
  });

  it('Rempart consomme la charge à son attaque → la cible est étourdie (et la charge tombe)', () => {
    const st = makeCombatState(LINE, [
      u({ id: 'r', owner: 'alice', hex: 'B', ap: 4, damage: 4, stunCharge: { owner: 'alice', expiresIn: 3, stun: 1 } }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10 }),
    ], 'alice');
    const hit = attack(st, 'r', 'b');
    expect(unitById(hit, 'b')!.hp).toBe(6);                       // 10 − 4 (le stun ne change pas les dégâts)
    expect(unitById(hit, 'b')!.stun).toMatchObject({ owner: 'bob', expiresIn: 1 });
    expect(unitById(hit, 'r')!.stunCharge).toBeUndefined();       // charge consommée
  });

  it('l\'étourdi a ses PA forcés à 0 son prochain tour, puis se recharge normalement', () => {
    const st = makeCombatState(LINE, [
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 0, stun: { owner: 'bob', expiresIn: 1 } }),
      u({ id: 'a', owner: 'alice', hex: 'A' }),
    ], 'alice');
    const frozen = endTurn(st, 4);                                // → bob actif : gelé
    expect(unitById(frozen, 'b')!.ap).toBe(0);
    expect(unitById(frozen, 'b')!.stun!.expiresIn).toBe(1);       // stun actif pendant le tour gelé
    const back = endTurn(endTurn(frozen, 4), 4);                  // bob finit (stun tombe) → … → bob actif
    expect(unitById(back, 'b')!.ap).toBe(4);                      // recharge normale
    expect(unitById(back, 'b')!.stun).toBeUndefined();
  });

  it('un écouteur étourdi ne déclenche aucune Résonance (silence)', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'a', owner: 'alice', hex: 'B', kind: 'lourde', guard: { cost: 3, damageTakenMul: 0.5 }, guarding: true, hp: 16, characterId: 'bastion' }),
      u({ id: 'c', owner: 'alice', hex: 'A', hp: 10, stun: { owner: 'alice', expiresIn: 1 },
         reactions: [{ id: 'ep', on: 'garde_encaissee', scope: { radius: 2 }, cooldown: 2, kind: 'epines', amount: 3 }], cooldowns: {} }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    expect(unitById(attack(base, 'b', 'a'), 'b')!.hp).toBe(10);   // 'c' étourdi → pas d'épines
  });
});

describe('combat — Résonance Fil × Orso (ruée — inverse de la provocation)', () => {
  const orso = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ overwatch: { cost: 3 }, range: 4, damage: 2, characterId: 'orso', ...over });
  const fil = (over: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit =>
    u({ reactions: [{ id: 'ru', on: 'tir_reserve', fromCharacter: 'orso', scope: { squad: true },
        cooldown: 2, kind: 'ruee', amount: 1 }], cooldowns: {}, ...over });

  it('le tir réservé d\'Orso fait avancer Fil d\'1 case vers la cible (et pose le CD)', () => {
    const base = makeCombatState(LINE, [
      fil({ id: 'f', owner: 'alice', hex: 'A', ap: 4 }),
      orso({ id: 'o', owner: 'alice', hex: 'E', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'D', ap: 4, hp: 10 }),
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'o'), 4);
    const s = resolveOverwatch(moveUnit(bobTurn, 'b', 'C'), 'b'); // bob D→C (dist 2 ≤ portée 4) → tir
    expect(unitById(s, 'b')!.hp).toBe(8);                         // 10 − 2 (tir d'Orso)
    expect(unitById(s, 'f')!.hex).toBe('B');                      // Fil avance de A vers la cible (C)
    expect(unitById(s, 'f')!.cooldowns!.ru).toBe(2);
  });

  it('gâté à Orso : un tir d\'un autre tireur ne déclenche pas la ruée', () => {
    const base = makeCombatState(LINE, [
      fil({ id: 'f', owner: 'alice', hex: 'A', ap: 4 }),
      orso({ id: 'o', owner: 'alice', hex: 'E', ap: 4, characterId: 'mireille' }),
      u({ id: 'b', owner: 'bob', hex: 'D', ap: 4, hp: 10 }),
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'o'), 4);
    const s = resolveOverwatch(moveUnit(bobTurn, 'b', 'C'), 'b');
    expect(unitById(s, 'f')!.hex).toBe('A');                      // pas d'avancée
    expect(unitById(s, 'f')!.cooldowns!.ru ?? 0).toBe(0);
  });

  it('Fil déjà au contact de la cible : pas d\'avancée mais CD posé quand même', () => {
    const base = makeCombatState(LINE, [
      fil({ id: 'f', owner: 'alice', hex: 'B', ap: 4 }),           // adjacent à la case d'arrivée C
      orso({ id: 'o', owner: 'alice', hex: 'E', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'D', ap: 4, hp: 10 }),
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'o'), 4);
    const s = resolveOverwatch(moveUnit(bobTurn, 'b', 'C'), 'b');
    expect(unitById(s, 'f')!.hex).toBe('B');                      // aucune case plus proche libre
    expect(unitById(s, 'f')!.cooldowns!.ru).toBe(2);              // CD posé malgré tout
  });
});

describe('combat — attribution du kill (lastHitBy, fondation Némésis)', () => {
  it('une attaque marque la cible comme touchée par l\'attaquant', () => {
    const s = attack(fresh('A', 'B', 4), 'a', 'b');
    expect(unitById(s, 'b')!.lastHitBy).toBe('a');
  });

  it('la riposte marque l\'attaquant comme touché par le riposteur', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'a', owner: 'alice', hex: 'B', ap: 4, hp: 10 }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4, riposting: true, riposte: { cost: 2 } }),
    ], 'alice');
    const s = attack(base, 'a', 'b');
    expect(unitById(s, 'b')!.lastHitBy).toBe('a'); // coup principal
    expect(unitById(s, 'a')!.lastHitBy).toBe('b'); // riposte
  });

  it('le tir réservé marque la cible comme touchée par le guetteur', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'w', owner: 'alice', hex: 'A', overwatch: { cost: 3 }, range: 4, damage: 2, ap: 4 }),
      u({ id: 'm', owner: 'bob', hex: 'E', ap: 4, hp: 7 }),
    ], 'alice');
    const bobTurn = endTurn(reserve(base, 'w'), 4);
    const s = resolveOverwatch(moveUnit(bobTurn, 'm', 'C'), 'm');
    expect(unitById(s, 'm')!.lastHitBy).toBe('w');
  });

  it('une réaction qui blesse (épines) compte comme les derniers dégâts', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'a', owner: 'alice', hex: 'B', kind: 'lourde', guard: { cost: 3, damageTakenMul: 0.5 }, guarding: true, hp: 16 }),
      u({ id: 'c', owner: 'alice', hex: 'A', hp: 10,
         reactions: [{ id: 'ep', on: 'garde_encaissee', scope: { radius: 2 }, cooldown: 2, kind: 'epines', amount: 3 }], cooldowns: {} }),
      u({ id: 'b', owner: 'bob', hex: 'C', ap: 4, hp: 10, damage: 4 }),
    ], 'bob');
    const s = attack(base, 'b', 'a');
    expect(unitById(s, 'b')!.lastHitBy).toBe('c'); // pincé par l'épines de 'c' après son coup
    expect(unitById(s, 'a')!.lastHitBy).toBe('b'); // le tank a été touché par 'b'
  });

  it('un coup sans dégâts (bloqué) ne change pas lastHitBy', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'a', owner: 'alice', hex: 'B', ap: 4 }),
      u({ id: 'b', owner: 'bob', hex: 'C', hp: 10, block: { owner: 'bob', expiresIn: 2 }, lastHitBy: 'x' }),
    ], 'alice');
    const s = attack(base, 'a', 'b');
    expect(unitById(s, 'b')!.hp).toBe(10);          // immunité : 0 dégât
    expect(unitById(s, 'b')!.lastHitBy).toBe('x');  // inchangé
  });
});

describe('combat — Némésis (tuer un ennemi du même archétype → élan d\'équipe)', () => {
  it('tuer son Némésis donne un élan de PA à toute l\'équipe du tueur (+ CD sur le tueur)', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'k', owner: 'alice', hex: 'B', kind: 'duelliste', ap: 4, damage: 9 }),  // tueur
      u({ id: 'mate', owner: 'alice', hex: 'A', kind: 'tireur' }),                     // coéquipier
      u({ id: 'v', owner: 'bob', hex: 'C', kind: 'duelliste', hp: 9, maxHp: 9 }),      // Némésis (même archétype)
    ], 'alice');
    const s = attack(base, 'k', 'v');
    expect(unitById(s, 'v')).toBeUndefined();              // tué
    expect(unitById(s, 'k')!.elan).toBe(1);               // Duelliste (9 PV) → +1
    expect(unitById(s, 'mate')!.elan).toBe(1);            // toute l'escouade
    expect(unitById(s, 'k')!.cooldowns!.nemesis).toBe(2); // CD sur le tueur (revival-ready)
  });

  it('échelonné sur la robustesse : tuer une Lourde Némésis donne +2', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'k', owner: 'alice', hex: 'B', kind: 'lourde', ap: 4, damage: 16 }),
      u({ id: 'v', owner: 'bob', hex: 'C', kind: 'lourde', hp: 16, maxHp: 16 }),
    ], 'alice');
    expect(unitById(attack(base, 'k', 'v'), 'k')!.elan).toBe(2);
  });

  it('tuer un ennemi d\'un AUTRE archétype ne donne aucun élan (pas un Némésis)', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'k', owner: 'alice', hex: 'B', kind: 'duelliste', ap: 4, damage: 9 }),
      u({ id: 'v', owner: 'bob', hex: 'C', kind: 'tireur', hp: 7, maxHp: 7 }),
    ], 'alice');
    expect(unitById(attack(base, 'k', 'v'), 'k')!.elan ?? 0).toBe(0);
  });

  it('récompense en cooldown → pas de nouvel élan', () => {
    const base = makeCombatState(LINE, [
      u({ id: 'k', owner: 'alice', hex: 'B', kind: 'duelliste', ap: 4, damage: 9, cooldowns: { nemesis: 1 } }),
      u({ id: 'v', owner: 'bob', hex: 'C', kind: 'duelliste', hp: 9, maxHp: 9 }),
    ], 'alice');
    expect(unitById(attack(base, 'k', 'v'), 'k')!.elan ?? 0).toBe(0);
  });

  it('l\'élan ajoute des PA au prochain rechargement, puis se consomme', () => {
    const st = makeCombatState(LINE, [
      u({ id: 'a', owner: 'alice', hex: 'A', ap: 1, elan: 2 }),
      u({ id: 'b', owner: 'bob', hex: 'E' }),
    ], 'bob');
    const aliceTurn = endTurn(st, 4);                       // → alice : 4 + 2 = 6
    expect(unitById(aliceTurn, 'a')!.ap).toBe(6);
    expect(unitById(aliceTurn, 'a')!.elan).toBeUndefined(); // consommé
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
