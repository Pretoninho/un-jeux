import { describe, it, expect } from 'vitest';
import {
  initialState, legalMoves, movesForPiece, applyMove, winner,
  idx, xy, isDark, SIZE,
  type DamesState, type Piece, type Move,
} from './dames';

const emptyBoard = (): (Piece | null)[] => new Array(SIZE * SIZE).fill(null);
const stateWith = (place: (b: (Piece | null)[]) => void, turn: 'b' | 'n' = 'b'): DamesState => {
  const board = emptyBoard();
  place(board);
  return { board, turn };
};
const find = (ms: Move[], from: number, to: number) => ms.find((m) => m.from === from && m.to === to);

describe('position de départ', () => {
  it('place 12 pions par camp sur cases foncées', () => {
    const s = initialState();
    const b = s.board.filter((p) => p && p.player === 'b').length;
    const n = s.board.filter((p) => p && p.player === 'n').length;
    expect(b).toBe(12);
    expect(n).toBe(12);
    // toutes sur des cases foncées
    s.board.forEach((p, i) => {
      if (p) expect(isDark(xy(i).x, xy(i).y)).toBe(true);
    });
    expect(s.turn).toBe('b');
  });

  it('ouverture blanche = 7 coups', () => {
    expect(legalMoves(initialState()).length).toBe(7);
  });
});

describe('pion — déplacement avant uniquement', () => {
  it('avance en diagonale vers le haut (blanc)', () => {
    const s = stateWith((b) => { b[idx(2, 5)] = { player: 'b', king: false }; });
    const ms = movesForPiece(s, idx(2, 5));
    expect(ms.map((m) => m.to).sort()).toEqual([idx(1, 4), idx(3, 4)].sort());
  });

  it('ne peut pas reculer', () => {
    const s = stateWith((b) => { b[idx(2, 5)] = { player: 'b', king: false }; });
    const ms = movesForPiece(s, idx(2, 5));
    expect(ms.some((m) => xy(m.to).y > 5)).toBe(false);
  });
});

describe('pion — prise', () => {
  it('prend en avant et la prise est obligatoire', () => {
    const s = stateWith((b) => {
      b[idx(3, 4)] = { player: 'b', king: false };
      b[idx(2, 3)] = { player: 'n', king: false };
    });
    const ms = legalMoves(s);
    expect(ms.length).toBe(1);
    const m = ms[0]!;
    expect(m.from).toBe(idx(3, 4));
    expect(m.to).toBe(idx(1, 2));
    expect(m.captures).toEqual([idx(2, 3)]);
  });

  it('ne prend PAS en arrière', () => {
    const s = stateWith((b) => {
      b[idx(3, 4)] = { player: 'b', king: false };
      b[idx(4, 5)] = { player: 'n', king: false }; // derrière le pion blanc
    });
    const ms = legalMoves(s);
    expect(ms.every((m) => m.captures.length === 0)).toBe(true);
  });

  it('enchaîne une rafle (double prise)', () => {
    const s = stateWith((b) => {
      b[idx(1, 6)] = { player: 'b', king: false };
      b[idx(2, 5)] = { player: 'n', king: false };
      b[idx(2, 3)] = { player: 'n', king: false };
    });
    const ms = legalMoves(s);
    // (1,6) -> saute (2,5) -> (3,4) -> saute (2,3) -> (1,2)
    const m = find(ms, idx(1, 6), idx(1, 2));
    expect(m).toBeTruthy();
    expect(m!.captures.sort()).toEqual([idx(2, 5), idx(2, 3)].sort());
  });
});

describe('dame volante', () => {
  it('glisse sur toute la diagonale (toutes directions)', () => {
    const s = stateWith((b) => { b[idx(3, 4)] = { player: 'b', king: true }; });
    const ms = movesForPiece(s, idx(3, 4));
    expect(ms.some((m) => m.to === idx(0, 1))).toBe(true); // longue glissade haut-gauche
    expect(ms.some((m) => m.to === idx(6, 7))).toBe(true); // vers le bas (arrière) aussi
    expect(ms.length).toBeGreaterThan(4);
  });

  it('prend à distance et peut choisir où atterrir', () => {
    const s = stateWith((b) => {
      b[idx(5, 6)] = { player: 'b', king: true };
      b[idx(2, 3)] = { player: 'n', king: false };
    });
    const ms = legalMoves(s);
    const lands = ms.filter((m) => m.captures.includes(idx(2, 3))).map((m) => m.to).sort();
    expect(lands).toEqual([idx(1, 2), idx(0, 1)].sort());
  });

  it('ne saute pas deux pièces alignées', () => {
    const s = stateWith((b) => {
      b[idx(5, 6)] = { player: 'b', king: true };
      b[idx(3, 4)] = { player: 'n', king: false };
      b[idx(2, 3)] = { player: 'n', king: false };
    });
    const ms = legalMoves(s);
    expect(ms.every((m) => m.captures.length <= 1)).toBe(true);
  });
});

describe('promotion', () => {
  it('un pion qui s\'arrête sur la dernière rangée devient dame', () => {
    const s = stateWith((b) => { b[idx(2, 1)] = { player: 'b', king: false }; });
    const next = applyMove(s, { from: idx(2, 1), to: idx(1, 0), captures: [] });
    expect(next.board[idx(1, 0)]).toEqual({ player: 'b', king: true });
  });
});

describe('fin de partie', () => {
  it('victoire si l\'adversaire n\'a plus de pièces', () => {
    const s = stateWith((b) => { b[idx(2, 5)] = { player: 'b', king: false }; }, 'b');
    expect(winner(s)).toBe('b');
  });

  it('victoire si l\'adversaire au trait est bloqué', () => {
    // Noir au trait, son unique pion est coincé dans un coin par un blocage.
    const s = stateWith((b) => {
      b[idx(0, 7)] = { player: 'n', king: false }; // noir avance vers y croissant -> y=7 = mur
      b[idx(7, 0)] = { player: 'b', king: true };  // blanc existe encore (ailleurs)
    }, 'n');
    // (0,7) ne peut aller qu'en (1,8)/(−1,8) hors plateau -> aucun coup.
    expect(legalMoves(s).length).toBe(0);
    expect(winner(s)).toBe('b');
  });

  it('partie en cours = null', () => {
    expect(winner(initialState())).toBeNull();
  });
});
