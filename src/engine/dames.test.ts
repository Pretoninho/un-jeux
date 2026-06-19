import { describe, it, expect } from 'vitest';
import {
  initialState, legalMoves, movesForPiece, applyMove, winner, isPromoting,
  idx, xy, SIZE, KINDS, PROMOTION_KINDS,
  type DamesState, type Piece, type Move,
} from './dames';

const emptyBoard = (): (Piece | null)[] => new Array(SIZE * SIZE).fill(null);
const stateWith = (place: (b: (Piece | null)[]) => void, turn: 'b' | 'n' = 'b'): DamesState => {
  const board = emptyBoard();
  place(board);
  return { board, turn };
};
const find = (ms: Move[], from: number, to: number) => ms.find((m) => m.from === from && m.to === to);

describe('position de départ (plateau « toutes cases »)', () => {
  it('place 16 pions par camp sur 2 rangées pleines', () => {
    const s = initialState();
    expect(s.board.filter((p) => p && p.player === 'b').length).toBe(16); // 2 rangées × 8 colonnes
    expect(s.board.filter((p) => p && p.player === 'n').length).toBe(16);
    expect(s.board.every((p) => !p || p.kind === 'pion')).toBe(true);
    expect(s.turn).toBe('b');
  });

  it('ouverture blanche = 14 coups (la rangée de front avance en diagonale)', () => {
    expect(legalMoves(initialState()).length).toBe(14);
  });
});

describe('pion — avant uniquement', () => {
  it('avance en diagonale vers le haut (blanc)', () => {
    const s = stateWith((b) => { b[idx(2, 5)] = { player: 'b', kind: 'pion' }; });
    expect(movesForPiece(s, idx(2, 5)).map((m) => m.to).sort()).toEqual([idx(1, 4), idx(3, 4)].sort());
  });

  it('ne recule pas et ne prend pas en arrière', () => {
    const s = stateWith((b) => {
      b[idx(3, 4)] = { player: 'b', kind: 'pion' };
      b[idx(4, 5)] = { player: 'n', kind: 'pion' }; // derrière
    });
    const ms = legalMoves(s);
    expect(ms.every((m) => m.captures.length === 0 && xy(m.to).y < 4)).toBe(true);
  });

  it('prend en avant, prise obligatoire, et enchaîne une rafle', () => {
    const s = stateWith((b) => {
      b[idx(1, 6)] = { player: 'b', kind: 'pion' };
      b[idx(2, 5)] = { player: 'n', kind: 'pion' };
      b[idx(2, 3)] = { player: 'n', kind: 'pion' };
    });
    const ms = legalMoves(s);
    expect(ms.every((m) => m.captures.length > 0)).toBe(true); // obligatoire
    const m = find(ms, idx(1, 6), idx(1, 2));
    expect(m?.captures.sort()).toEqual([idx(2, 5), idx(2, 3)].sort());
  });
});

describe('dame STANDARD (courte, avant + arrière)', () => {
  it('se déplace d\'1 case dans les 4 diagonales', () => {
    const s = stateWith((b) => { b[idx(3, 4)] = { player: 'b', kind: 'dame' }; });
    const ms = movesForPiece(s, idx(3, 4));
    expect(ms.length).toBe(4);
    expect(ms.map((m) => m.to).sort()).toEqual([idx(2, 3), idx(4, 3), idx(2, 5), idx(4, 5)].sort());
  });

  it('ne glisse PAS au loin (plus volante)', () => {
    const s = stateWith((b) => { b[idx(3, 4)] = { player: 'b', kind: 'dame' }; });
    expect(movesForPiece(s, idx(3, 4)).some((m) => m.to === idx(0, 1))).toBe(false);
  });

  it('prend en ARRIÈRE (1 case)', () => {
    const s = stateWith((b) => {
      b[idx(3, 4)] = { player: 'b', kind: 'dame' };
      b[idx(4, 5)] = { player: 'n', kind: 'pion' }; // en arrière du blanc
    });
    const m = find(legalMoves(s), idx(3, 4), idx(5, 6));
    expect(m?.captures).toEqual([idx(4, 5)]);
  });
});

describe('dame BONDISSANTE (porte 2)', () => {
  it('se déplace jusqu\'à 2 cases en diagonale', () => {
    const s = stateWith((b) => { b[idx(3, 4)] = { player: 'b', kind: 'dame-bond' }; });
    const ms = movesForPiece(s, idx(3, 4));
    expect(ms.length).toBe(8); // 4 directions × 2 cases (toutes dans le plateau)
    expect(ms.some((m) => m.to === idx(1, 2))).toBe(true); // 2 cases haut-gauche
    expect(ms.some((m) => m.to === idx(5, 6))).toBe(true); // 2 cases bas-droite
  });

  it('un obstacle borne la glissade', () => {
    const s = stateWith((b) => {
      b[idx(3, 4)] = { player: 'b', kind: 'dame-bond' };
      b[idx(2, 3)] = { player: 'b', kind: 'pion' }; // bloque la diagonale haut-gauche dès la 1ʳᵉ
    });
    expect(movesForPiece(s, idx(3, 4)).some((m) => m.to === idx(1, 2))).toBe(false);
  });
});

describe('dame PERCE-LIGNE (double prise, additif)', () => {
  it('prend 2 ennemis alignés d\'un coup', () => {
    const s = stateWith((b) => {
      b[idx(5, 6)] = { player: 'b', kind: 'dame-perce' };
      b[idx(4, 5)] = { player: 'n', kind: 'pion' };
      b[idx(3, 4)] = { player: 'n', kind: 'pion' };
    });
    const m = find(legalMoves(s), idx(5, 6), idx(2, 3));
    expect(m?.captures.sort()).toEqual([idx(4, 5), idx(3, 4)].sort());
  });

  it('garde la prise SIMPLE (additif)', () => {
    const s = stateWith((b) => {
      b[idx(4, 5)] = { player: 'b', kind: 'dame-perce' };
      b[idx(3, 4)] = { player: 'n', kind: 'pion' }; // un seul ennemi, vide derrière
    });
    const m = find(legalMoves(s), idx(4, 5), idx(2, 3));
    expect(m?.captures).toEqual([idx(3, 4)]);
  });
});

describe('dame ÉQUERRE (prise orthogonale, additif)', () => {
  it('prend orthogonalement (par-dessus une case adjacente)', () => {
    // NB : sur le damier d'origine les ennemis sont sur cases foncées (orthogonale = case claire,
    // vide) → on place ici l'ennemi sur la case orthogonale pour valider la MÉCANIQUE.
    const s = stateWith((b) => {
      b[idx(3, 4)] = { player: 'b', kind: 'dame-equerre' };
      b[idx(3, 5)] = { player: 'n', kind: 'pion' }; // juste en dessous (orthogonal)
    });
    const m = find(legalMoves(s), idx(3, 4), idx(3, 6));
    expect(m?.captures).toEqual([idx(3, 5)]);
  });

  it('garde la prise diagonale (additif)', () => {
    const s = stateWith((b) => {
      b[idx(3, 4)] = { player: 'b', kind: 'dame-equerre' };
      b[idx(2, 3)] = { player: 'n', kind: 'pion' };
    });
    const m = find(legalMoves(s), idx(3, 4), idx(1, 2));
    expect(m?.captures).toEqual([idx(2, 3)]);
  });
});

describe('promotion — choix du type', () => {
  it('détecte la promotion d\'un pion sur la dernière rangée', () => {
    const s = stateWith((b) => { b[idx(2, 1)] = { player: 'b', kind: 'pion' }; });
    const mv = { from: idx(2, 1), to: idx(1, 0), captures: [] };
    expect(isPromoting(s, mv)).toBe(true);
  });

  it('promeut vers le type CHOISI', () => {
    const s = stateWith((b) => { b[idx(2, 1)] = { player: 'b', kind: 'pion' }; });
    const mv = { from: idx(2, 1), to: idx(1, 0), captures: [] };
    expect(applyMove(s, mv, 'dame-perce').board[idx(1, 0)]).toEqual({ player: 'b', kind: 'dame-perce' });
    // défaut = dame standard si aucun choix
    expect(applyMove(s, mv).board[idx(1, 0)]).toEqual({ player: 'b', kind: 'dame' });
  });

  it('le registre expose 4 dames promouvables', () => {
    expect(PROMOTION_KINDS).toEqual(['dame', 'dame-bond', 'dame-perce', 'dame-equerre']);
    expect(KINDS['pion']?.promotable).toBeFalsy();
  });
});

describe('fin de partie', () => {
  it('victoire si l\'adversaire n\'a plus de pièces', () => {
    const s = stateWith((b) => { b[idx(2, 5)] = { player: 'b', kind: 'pion' }; }, 'b');
    expect(winner(s)).toBe('b');
  });

  it('victoire si l\'adversaire au trait est bloqué', () => {
    const s = stateWith((b) => {
      b[idx(0, 7)] = { player: 'n', kind: 'pion' }; // noir avance vers y croissant -> y=7 = mur
      b[idx(7, 0)] = { player: 'b', kind: 'dame' };
    }, 'n');
    expect(legalMoves(s).length).toBe(0);
    expect(winner(s)).toBe('b');
  });

  it('partie en cours = null', () => {
    expect(winner(initialState())).toBeNull();
  });
});
