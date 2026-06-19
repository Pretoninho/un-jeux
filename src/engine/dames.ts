// Moteur de DAMES — module PUR et immuable (aucune dépendance DOM, testable sans navigateur),
// dans l'esprit du reste du dépôt (moteur vs présentation). Règles retenues (variante « maison ») :
//   • Pion : se déplace d'1 case en diagonale VERS L'AVANT uniquement ; prend en sautant
//     par-dessus un adversaire en diagonale AVANT (atterrit juste derrière). Capture AVANT only.
//   • Dame (VOLANTE) : glisse de plusieurs cases en diagonale, TOUTES directions ; prend à
//     distance (saute un seul adversaire sur sa diagonale, atterrit sur une case vide au-delà).
//   • RAFLE : une prise qui peut se prolonger DOIT se prolonger (avec la même pièce).
//   • Prise OBLIGATOIRE (s'il existe une prise, seules les prises sont légales) — NON majoritaire
//     (on n'est pas obligé de prendre le maximum).
//   • Promotion en dame quand un pion S'ARRÊTE sur la dernière rangée (pas en cours de rafle).
//   • Défaite : plus aucune pièce, OU plus aucun coup légal à son tour.

export const SIZE = 8;

/** 'b' = blanc (part en bas, avance vers le haut) ; 'n' = noir (part en haut, avance vers le bas). */
export type Player = 'b' | 'n';

export interface Piece {
  player: Player;
  king: boolean;
}

/** Plateau = 64 cases à plat (index = y*8 + x) ; null = vide. Les pièces ne vivent que sur les cases foncées. */
export interface DamesState {
  board: (Piece | null)[];
  turn: Player;
}

/** Un coup = de `from` à `to`, retirant éventuellement les pièces de `captures`. */
export interface Move {
  from: number;
  to: number;
  captures: number[];
}

// ---- Géométrie élémentaire ------------------------------------------------

export const idx = (x: number, y: number): number => y * SIZE + x;
export const xy = (i: number): { x: number; y: number } => ({ x: i % SIZE, y: Math.floor(i / SIZE) });
const inBounds = (x: number, y: number): boolean => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

/** Cases jouables = cases foncées (somme des coordonnées impaire). */
export const isDark = (x: number, y: number): boolean => (x + y) % 2 === 1;

const other = (p: Player): Player => (p === 'b' ? 'n' : 'b');
/** Sens « avant » selon le camp : blanc monte (y décroît), noir descend (y croît). */
const forwardDy = (p: Player): number => (p === 'b' ? -1 : 1);
/** Rangée de promotion (dernière rangée adverse). */
const lastRow = (p: Player): number => (p === 'b' ? 0 : SIZE - 1);

const DIAGS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

// ---- Position de départ ---------------------------------------------------

/** Position initiale : 3 rangées de pions par camp sur les cases foncées ; blanc joue. */
export function initialState(): DamesState {
  const board: (Piece | null)[] = new Array(SIZE * SIZE).fill(null);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!isDark(x, y)) continue;
      if (y <= 2) board[idx(x, y)] = { player: 'n', king: false };
      else if (y >= SIZE - 3) board[idx(x, y)] = { player: 'b', king: false };
    }
  }
  return { board, turn: 'b' };
}

// ---- Génération des coups -------------------------------------------------

// Occupation vue depuis une rafle en cours : la case de départ `start` est considérée vide
// (la pièce l'a quittée) ; les pièces déjà capturées restent SUR le plateau (elles bloquent et
// ne peuvent être sautées deux fois) tant que la rafle n'est pas finie.
function occupant(board: (Piece | null)[], i: number, start: number): Piece | null {
  return i === start ? null : (board[i] ?? null);
}

interface CaptureStep {
  captured: number;
  land: number;
}

/** Prises immédiates possibles depuis `pos` (une seule pièce sautée), pion OU dame. */
function captureSteps(
  board: (Piece | null)[],
  pos: number,
  player: Player,
  king: boolean,
  start: number,
  taken: Set<number>,
): CaptureStep[] {
  const { x, y } = xy(pos);
  const steps: CaptureStep[] = [];

  if (!king) {
    // Pion : saut court, VERS L'AVANT uniquement.
    const dy = forwardDy(player);
    for (const dx of [-1, 1]) {
      const ex = x + dx, ey = y + dy;       // case de l'ennemi
      const lx = x + 2 * dx, ly = y + 2 * dy; // case d'arrivée
      if (!inBounds(lx, ly)) continue;
      const eIdx = idx(ex, ey);
      const lIdx = idx(lx, ly);
      const e = occupant(board, eIdx, start);
      if (!e || e.player === player || taken.has(eIdx)) continue;
      if (occupant(board, lIdx, start) !== null) continue;
      steps.push({ captured: eIdx, land: lIdx });
    }
    return steps;
  }

  // Dame volante : glisse, saute UN ennemi, atterrit sur n'importe quelle case vide au-delà.
  for (const [dx, dy] of DIAGS) {
    let i = 1;
    // Avance sur les cases vides jusqu'à rencontrer une pièce.
    for (; ; i++) {
      const cx = x + i * dx, cy = y + i * dy;
      if (!inBounds(cx, cy)) { i = -1; break; }
      const cIdx = idx(cx, cy);
      if (occupant(board, cIdx, start) === null) continue;
      // Une pièce : on s'arrête dessus pour décider.
      break;
    }
    if (i < 0) continue; // bord atteint sans rien rencontrer
    const ex = x + i * dx, ey = y + i * dy;
    const eIdx = idx(ex, ey);
    const e = occupant(board, eIdx, start);
    if (!e || e.player === player || taken.has(eIdx)) continue; // alliée, ou déjà prise : bloque
    // Cases d'arrivée = vides consécutives au-delà de l'ennemi.
    for (let j = i + 1; ; j++) {
      const lx = x + j * dx, ly = y + j * dy;
      if (!inBounds(lx, ly)) break;
      const lIdx = idx(lx, ly);
      if (occupant(board, lIdx, start) !== null) break;
      steps.push({ captured: eIdx, land: lIdx });
    }
  }
  return steps;
}

/** Toutes les rafles MAXIMALES partant de la pièce en `start` (une prise qui peut continuer continue). */
function captureMovesFrom(board: (Piece | null)[], start: number, piece: Piece): Move[] {
  const results: Move[] = [];
  const recurse = (pos: number, taken: Set<number>) => {
    const steps = captureSteps(board, pos, piece.player, piece.king, start, taken);
    if (steps.length === 0) {
      if (taken.size > 0) results.push({ from: start, to: pos, captures: [...taken] });
      return;
    }
    for (const s of steps) {
      const next = new Set(taken);
      next.add(s.captured);
      recurse(s.land, next);
    }
  };
  recurse(start, new Set());
  return results;
}

/** Déplacements simples (sans prise) depuis `start`. */
function quietMovesFrom(board: (Piece | null)[], start: number, piece: Piece): Move[] {
  const { x, y } = xy(start);
  const moves: Move[] = [];
  if (!piece.king) {
    const dy = forwardDy(piece.player);
    for (const dx of [-1, 1]) {
      const tx = x + dx, ty = y + dy;
      if (inBounds(tx, ty) && board[idx(tx, ty)] === null) {
        moves.push({ from: start, to: idx(tx, ty), captures: [] });
      }
    }
    return moves;
  }
  // Dame volante : glisse tant que c'est vide.
  for (const [dx, dy] of DIAGS) {
    for (let i = 1; ; i++) {
      const tx = x + i * dx, ty = y + i * dy;
      if (!inBounds(tx, ty) || board[idx(tx, ty)] !== null) break;
      moves.push({ from: start, to: idx(tx, ty), captures: [] });
    }
  }
  return moves;
}

/** Coups légaux du camp au trait. Prise OBLIGATOIRE : s'il existe des prises, seules elles comptent. */
export function legalMoves(state: DamesState): Move[] {
  const captures: Move[] = [];
  const quiets: Move[] = [];
  for (let i = 0; i < state.board.length; i++) {
    const p = state.board[i];
    if (!p || p.player !== state.turn) continue;
    captures.push(...captureMovesFrom(state.board, i, p));
    if (captures.length === 0) quiets.push(...quietMovesFrom(state.board, i, p));
  }
  // Si une prise existe quelque part, on rejoue le scan (les `quiets` accumulés avant la 1ʳᵉ prise
  // sont alors caduques) — on filtre simplement.
  if (captures.length > 0) return captures;
  return quiets;
}

/** Coups légaux pour UNE pièce donnée (pratique pour l'UI). Respecte la prise obligatoire globale. */
export function movesForPiece(state: DamesState, from: number): Move[] {
  const all = legalMoves(state);
  return all.filter((m) => m.from === from);
}

// ---- Application d'un coup -------------------------------------------------

/** Applique un coup et renvoie un NOUVEL état (immuable). Gère retrait des prises + promotion. */
export function applyMove(state: DamesState, move: Move): DamesState {
  const board = state.board.slice();
  const piece = board[move.from];
  if (!piece) return state; // garde-fou
  board[move.from] = null;
  for (const c of move.captures) board[c] = null;
  let placed: Piece = piece;
  if (!piece.king && xy(move.to).y === lastRow(piece.player)) {
    placed = { ...piece, king: true }; // promotion à l'arrêt sur la dernière rangée
  }
  board[move.to] = placed;
  return { board, turn: other(state.turn) };
}

// ---- Fin de partie --------------------------------------------------------

const countPieces = (board: (Piece | null)[], p: Player): number =>
  board.reduce((n, c) => (c && c.player === p ? n + 1 : n), 0);

/** Vainqueur ('b' | 'n') ou null si la partie continue. */
export function winner(state: DamesState): Player | null {
  if (countPieces(state.board, 'b') === 0) return 'n';
  if (countPieces(state.board, 'n') === 0) return 'b';
  if (legalMoves(state).length === 0) return other(state.turn); // bloqué à son tour = perdu
  return null;
}
