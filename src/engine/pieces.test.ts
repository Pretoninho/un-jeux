import { describe, it, expect } from 'vitest';
import { profileFor, makeUnit, makeUnitFromCharacter, ARCHETYPES, CHARACTERS, type Archetype } from './pieces';
import type { ReactionSpec } from './combat';

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

describe('pieces/Duelliste — pièce hors-droite via override de profil', () => {
  it('l\'override remplace les stats dérivées, en gardant la portée de la droite', () => {
    const d = makeUnit('a3', 'alice', 'Z', ARCHETYPES.duelliste!, 4);
    expect(d).toMatchObject({
      id: 'a3', owner: 'alice', hex: 'Z', ap: 4,
      hp: 9, maxHp: 9, range: 1, damage: 2, attackCost: 1, kind: 'duelliste',
    });
  });

  it('le Duelliste casse le calibrage : moins de PV/dégâts que la Lourde à portée égale, mais attaque à 1 PA', () => {
    const lourde = profileFor(ARCHETYPES.lourde!.rangeTier); // 1/4 sur la droite
    const d = makeUnit('a3', 'alice', 'Z', ARCHETYPES.duelliste!, 4);
    expect(d.range).toBe(lourde.range);            // même portée (mêlée)
    expect(d.maxHp).toBeLessThan(lourde.maxHp);    // plus fragile
    expect(d.damage).toBeLessThan(lourde.damage);  // tape plus doucement
    expect(d.attackCost).toBeLessThan(lourde.attackCost); // mais frappe deux fois par tour
  });

  it('le Duelliste a le verbe Riposte (et lui seul : ni garde ni tir réservé)', () => {
    expect(ARCHETYPES.duelliste!.riposte).toEqual({ cost: 2 });
    expect(ARCHETYPES.duelliste!.guard).toBeUndefined();
    expect(ARCHETYPES.duelliste!.overwatch).toBeUndefined();
    const d = makeUnit('a3', 'alice', 'Z', ARCHETYPES.duelliste!, 4);
    expect(d.riposte).toEqual({ cost: 2 });
    expect(d.riposting).toBe(false);
    expect(d.guard).toBeUndefined();
    expect(d.overwatch).toBeUndefined();
  });

  it('sans override, makeUnit suit toujours la droite (non-régression)', () => {
    expect(makeUnit('a1', 'alice', 'X', ARCHETYPES.lourde!, 4)).toMatchObject(
      { hp: 16, maxHp: 16, range: 1, damage: 5, attackCost: 2 });
  });
});

describe('pieces/Personnages — couche héros (socle de classe + signature)', () => {
  it('makeUnitFromCharacter applique nom + stats de classe + Résonance signature', () => {
    const d = makeUnitFromCharacter('a3', 'alice', 'Z', CHARACTERS.estoc!, 4);
    expect(d).toMatchObject({ name: 'Estoc', characterId: 'estoc', kind: 'duelliste', hp: 9, damage: 2, attackCost: 1 });
    expect(d.reactions).toHaveLength(4);                                    // quatre duos
    const ids = d.reactions!.map((r) => r.id);
    expect(ids).toContain('epines_estoc_bastion');                         // × Bastion
    expect(ids).toContain('marquage_estoc_mireille');                      // × Mireille
    expect(ids).toContain('estropier_estoc_rempart');                      // × Rempart
    expect(ids).toContain('provocation_estoc_orso');                       // × Orso
    expect(d.reactions!.find((r) => r.id === 'epines_estoc_bastion')!.fromCharacter).toBe('bastion');
    expect(d.reactions!.find((r) => r.id === 'marquage_estoc_mireille')!.fromCharacter).toBe('mireille');
    expect(d.reactions!.find((r) => r.id === 'estropier_estoc_rempart')!.fromCharacter).toBe('rempart');
    expect(d.reactions!.find((r) => r.id === 'provocation_estoc_orso')!.fromCharacter).toBe('orso');
    expect(d.riposte).toEqual({ cost: 2 }); // verbe de classe conservé
  });

  it('la Résonance est portée par le PERSONNAGE, pas par la classe', () => {
    expect(ARCHETYPES.duelliste!.reactions).toBeUndefined();
    expect(makeUnit('x', 'alice', 'Z', ARCHETYPES.duelliste!, 4).reactions).toBeUndefined();
  });

  it('la signature fusionne avec le socle de classe par id (écrase + étend)', () => {
    const socle: ReactionSpec = { id: 'r', on: 'garde_encaissee', scope: { radius: 1 }, cooldown: 1, kind: 'epines', amount: 1 };
    const base: Archetype = { key: 'k', name: 'K', glyph: 'K', rangeTier: 1, reactions: [socle] };
    const u = makeUnit('x', 'alice', 'Z', base, 4, { reactions: [{ ...socle, amount: 9 }, { ...socle, id: 'r2', amount: 2 }] });
    expect(u.reactions).toHaveLength(2);
    expect(u.reactions!.find((r) => r.id === 'r')!.amount).toBe(9);  // la signature écrase le socle
    expect(u.reactions!.some((r) => r.id === 'r2')).toBe(true);       // et l'étend
  });

  it('Estoc et Fil : stats miroir mais Résonances propres et DISSOCIÉES (héros uniques)', () => {
    const a = makeUnitFromCharacter('a3', 'alice', 'Z', CHARACTERS.estoc!, 4);
    const b = makeUnitFromCharacter('b3', 'bob', 'Z', CHARACTERS.fil!, 4);
    expect(a.name).not.toBe(b.name);
    expect({ hp: a.hp, damage: a.damage, range: a.range, attackCost: a.attackCost })
      .toEqual({ hp: b.hp, damage: b.damage, range: b.range, attackCost: b.attackCost });
    expect(a.reactions).not.toEqual(b.reactions);            // duos distincts
    expect(a.reactions!.map((r) => r.id)).toContain('epines_estoc_bastion'); // Estoc × Bastion
    expect(b.reactions!.map((r) => r.id)).toEqual(['vendetta_fil_bastion', 'ralliement_fil_mireille', 'etourdir_fil_rempart']); // Fil × Bastion, × Mireille, × Rempart
  });

  it('un personnage à l\'archétype inconnu est rejeté', () => {
    expect(() => makeUnitFromCharacter('x', 'alice', 'Z', { id: 'x', name: 'X', archetype: 'nope' }, 4)).toThrow();
  });
});
