import { describe, it, expect } from 'vitest';
import { makeCombatState, type CombatState, type Unit } from './combat';
import { detectUnlocks } from './objectives';
import type { GameMap } from './types';

// Petite carte (placements valides) — la détection ne lit que les unités, pas la topologie.
const MAP: GameMap = {
  id: 'm',
  hexes: ['A', 'B', 'C', 'D'].map((id, i, a) => ({
    id, label: id, kind: 'marche',
    neighbors: [a[i - 1], a[i + 1]].filter(Boolean) as string[],
  })),
};
function u(p: Partial<Unit> & Pick<Unit, 'id' | 'owner' | 'hex'>): Unit {
  return { hp: 10, maxHp: 10, ap: 4, range: 1, damage: 4, attackCost: 2, kind: 'test', ...p };
}
const st = (units: Unit[]): CombatState => makeCombatState(MAP, units, 'alice');

describe('objectives/detectUnlocks — détection pure par diff d\'état', () => {
  it('statut posé (marque) → m_status', () => {
    const prev = st([u({ id: 'a', owner: 'alice', hex: 'A' }), u({ id: 'e', owner: 'bob', hex: 'C' })]);
    const cur = st([u({ id: 'a', owner: 'alice', hex: 'A', mark: { by: 'x', owner: 'bob', bonus: 1, expiresIn: 2 } }), u({ id: 'e', owner: 'bob', hex: 'C' })]);
    expect(detectUnlocks(prev, cur, new Set())).toEqual(['m_status']);
  });

  it('Résonance partie (cooldown 0→>0) → m_resonance + duos (Estoc×Bastion, Mireille)', () => {
    const prev = st([
      u({ id: 'a', owner: 'alice', hex: 'A', cooldowns: {} }),
      u({ id: 'm', owner: 'alice', hex: 'B', characterId: 'mireille', cooldowns: {} }),
      u({ id: 'e', owner: 'bob', hex: 'D' }),
    ]);
    const cur = st([
      u({ id: 'a', owner: 'alice', hex: 'A', cooldowns: { epines_estoc_bastion: 2 } }),
      u({ id: 'm', owner: 'alice', hex: 'B', characterId: 'mireille', cooldowns: { silence_mireille_bastion: 3 } }),
      u({ id: 'e', owner: 'bob', hex: 'D' }),
    ]);
    const got = detectUnlocks(prev, cur, new Set());
    expect(got).toContain('m_resonance');
    expect(got).toContain('h_estoc_bastion');
    expect(got).toContain('h_mireille');
    expect(got.filter((x) => x === 'm_resonance')).toHaveLength(1); // dédupliqué
  });

  it('kill de Némésis (lastHitBy même archétype, camp adverse) → m_nemesis + h_fil_nemesis', () => {
    const prev = st([
      u({ id: 'k', owner: 'alice', hex: 'A', kind: 'duelliste', characterId: 'fil' }),
      u({ id: 'v', owner: 'bob', hex: 'B', kind: 'duelliste', lastHitBy: 'k' }),
      u({ id: 'o', owner: 'bob', hex: 'D' }), // un autre bob survit → pas de victoire
    ]);
    const cur = st([
      u({ id: 'k', owner: 'alice', hex: 'A', kind: 'duelliste', characterId: 'fil' }),
      u({ id: 'o', owner: 'bob', hex: 'D' }),
    ]);
    const got = detectUnlocks(prev, cur, new Set());
    expect(got).toContain('m_nemesis');
    expect(got).toContain('h_fil_nemesis');
  });

  it('victoire (un seul camp survit) → m_win', () => {
    const prev = st([u({ id: 'a', owner: 'alice', hex: 'A' }), u({ id: 'b', owner: 'bob', hex: 'C' })]);
    const cur = st([u({ id: 'a', owner: 'alice', hex: 'A' })]); // bob éliminé
    expect(detectUnlocks(prev, cur, new Set())).toContain('m_win');
  });

  it('filtre alreadyUnlocked : un id déjà débloqué n\'est pas renvoyé', () => {
    const prev = st([u({ id: 'a', owner: 'alice', hex: 'A' }), u({ id: 'e', owner: 'bob', hex: 'C' })]);
    const cur = st([u({ id: 'a', owner: 'alice', hex: 'A', mark: { by: 'x', owner: 'bob', bonus: 1, expiresIn: 2 } }), u({ id: 'e', owner: 'bob', hex: 'C' })]);
    expect(detectUnlocks(prev, cur, new Set(['m_status']))).toEqual([]);
  });

  it('frontière joueur : un déplacement/une attaque ne déclenchent PAS m_move/m_attack (hookés côté joueur)', () => {
    const prev = st([u({ id: 'a', owner: 'alice', hex: 'A' }), u({ id: 'e', owner: 'bob', hex: 'C', hp: 10 })]);
    const cur = st([u({ id: 'a', owner: 'alice', hex: 'B' }), u({ id: 'e', owner: 'bob', hex: 'C', hp: 6 })]); // a bougé, e a perdu des PV
    const got = detectUnlocks(prev, cur, new Set());
    expect(got).not.toContain('m_move');
    expect(got).not.toContain('m_attack');
  });
});
