import { describe, it, expect } from 'vitest';
import { profileFor, makeUnit, ARCHETYPES } from './pieces';

describe('pieces/calibrage — droite portée + robustesse = 5', () => {
  it('la paire polaire est aux extrêmes de la droite', () => {
    const lourde = profileFor(1); // 1/4 — mêlée-tank
    expect(lourde).toEqual({ range: 1, maxHp: 16, damage: 5, attackCost: 2 });
    const tireur = profileFor(4); // 4/1 — distance-verre
    expect(tireur).toEqual({ range: 4, maxHp: 7, damage: 2, attackCost: 2 });
  });

  it('plus la portée est longue, plus la pièce est fragile et tape doucement', () => {
    const tiers = [1, 2, 3, 4].map(profileFor);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]!.range).toBeGreaterThan(tiers[i - 1]!.range);
      expect(tiers[i]!.maxHp).toBeLessThan(tiers[i - 1]!.maxHp);   // robustesse ↓
      expect(tiers[i]!.damage).toBeLessThan(tiers[i - 1]!.damage); // dégâts ↓
    }
  });

  it('makeUnit construit une pièce à pleine vie depuis son archétype', () => {
    const v = makeUnit('a1', 'alice', 'X', ARCHETYPES.lourde!, 4);
    expect(v).toMatchObject({
      id: 'a1', owner: 'alice', hex: 'X', ap: 4,
      hp: 16, maxHp: 16, range: 1, damage: 5, attackCost: 2, kind: 'lourde',
    });
  });

  it('la paire polaire déployée : Lourde (mêlée) et Tireur (distance)', () => {
    expect(ARCHETYPES.lourde!.rangeTier).toBe(1);
    expect(ARCHETYPES.tireur!.rangeTier).toBe(4);
  });

  it('la Lourde (CAC) sait se garder, pas le Tireur (distance)', () => {
    expect(ARCHETYPES.lourde!.guard).toEqual({ cost: 3, damageTakenMul: 0.5 });
    expect(ARCHETYPES.tireur!.guard).toBeUndefined();
    const l = makeUnit('a1', 'alice', 'X', ARCHETYPES.lourde!, 4);
    expect(l.guard).toEqual({ cost: 3, damageTakenMul: 0.5 });
    expect(l.guarding).toBe(false);
    expect(makeUnit('a2', 'alice', 'Y', ARCHETYPES.tireur!, 4).guard).toBeUndefined();
  });

  it('le Tireur (distance) sait réserver son tir, pas la Lourde (CAC)', () => {
    expect(ARCHETYPES.tireur!.overwatch).toEqual({ cost: 3 });
    expect(ARCHETYPES.lourde!.overwatch).toBeUndefined();
    const t = makeUnit('a2', 'alice', 'Y', ARCHETYPES.tireur!, 4);
    expect(t.overwatch).toEqual({ cost: 3 });
    expect(t.watching).toBe(false);
    expect(makeUnit('a1', 'alice', 'X', ARCHETYPES.lourde!, 4).overwatch).toBeUndefined();
  });
});
