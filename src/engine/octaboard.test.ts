import { describe, it, expect } from 'vitest';
import { makeOctaBoard } from './octaboard';
import { graphDistance, makeCombatState, moveUnit, reachable, unitById } from './combat';
import { makeUnit, ARCHETYPES } from './pieces';

const byId = (b: ReturnType<typeof makeOctaBoard>, id: string) => b.map.hexes.find((h) => h.id === id)!;

describe('octaboard/topologie 4.8.8 (carrés jouables)', () => {
  const b = makeOctaBoard(5);

  it('compte les cases : n² octogones + (n−1)² carrés', () => {
    const oct = b.map.hexes.filter((h) => h.id.startsWith('o:'));
    const sq = b.map.hexes.filter((h) => h.id.startsWith('s:'));
    expect(oct).toHaveLength(25); // 5×5
    expect(sq).toHaveLength(16);  // 4×4
  });

  it('un octogone intérieur a 8 voisins (4 octogones + 4 carrés)', () => {
    const nbs = byId(b, 'o:2,2').neighbors;
    expect(nbs).toHaveLength(8);
    expect(nbs.filter((id) => id.startsWith('o:'))).toHaveLength(4);
    expect(nbs.filter((id) => id.startsWith('s:'))).toHaveLength(4);
  });

  it('un carré (carrefour) borde exactement 4 octogones', () => {
    const nbs = byId(b, 's:1,1').neighbors;
    expect(nbs.sort()).toEqual(['o:1,1', 'o:1,2', 'o:2,1', 'o:2,2']);
  });

  it('adjacence symétrique (si A voisin de B, alors B voisin de A)', () => {
    for (const h of b.map.hexes) {
      for (const nb of h.neighbors) {
        expect(byId(b, nb).neighbors).toContain(h.id);
      }
    }
  });

  it('la diagonale entre deux octogones passe PAR le carré → 2 pas', () => {
    // o:1,1 et o:2,2 sont en diagonale : non adjacents, mais reliés par s:1,1.
    expect(byId(b, 'o:1,1').neighbors).not.toContain('o:2,2');
    expect(graphDistance(b.map, 'o:1,1', 'o:2,2')).toBe(2);
    expect(graphDistance(b.map, 'o:1,1', 'o:2,1')).toBe(1); // orthogonal : 1 pas
  });
});

describe('octaboard/carrés non jouables → grille carrée pure', () => {
  it('sans carrés, un octogone n\'a que ses 4 voisins orthogonaux', () => {
    const b = makeOctaBoard(5, { playableSquares: false });
    expect(b.map.hexes.every((h) => h.id.startsWith('o:'))).toBe(true);
    expect(byId(b, 'o:2,2').neighbors).toHaveLength(4);
    // la diagonale devient injoignable directement : il faut contourner (2 pas orthogonaux).
    expect(graphDistance(b.map, 'o:1,1', 'o:2,2')).toBe(2);
  });
});

describe('octaboard/le moteur tourne dessus sans modification', () => {
  it('une pièce traverse un carrefour pour atteindre l\'octogone diagonal', () => {
    const b = makeOctaBoard(5);
    const s0 = makeCombatState(b.map, [
      makeUnit('a', 'alice', 'o:1,1', ARCHETYPES.lourde!, 4),
      makeUnit('z', 'bob', 'o:4,4', ARCHETYPES.tireur!, 4),
    ], 'alice');
    // o:1,1 atteint le carré diagonal en 1 pas, et l'octogone diagonal en 2.
    const reach = reachable(s0, 'a', 4);
    expect(reach.get('s:1,1')).toBe(1);
    expect(reach.get('o:2,2')).toBe(2);
    const s1 = moveUnit(s0, 'a', 'o:2,2'); // route Lourde → carrefour → octogone
    expect(unitById(s1, 'a')!.hex).toBe('o:2,2');
    expect(unitById(s1, 'a')!.ap).toBe(2);     // PA partagés : 4 − 2 pas
    expect(unitById(s1, 'a')!.moved).toBe(2);  // 2 pas comptés sur le plafond de mobilité
  });
});
