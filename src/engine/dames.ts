// Moteur de DAMES (variante « exagérée ») — module PUR et immuable (aucune dépendance DOM,
// testable sans navigateur), dans l'esprit du dépôt (moteur vs présentation).
//
// IDÉE CENTRALE — un REGISTRE DE CAPACITÉS (`KINDS`). Chaque type de pièce décrit ses pouvoirs
// en DONNÉES (directions / portée / saut) ; le générateur de coups est agnostique au type, comme
// le moteur de combat est agnostique à l'archétype. Les dames spéciales ÉMERGENT en réglant ces
// primitives (additif : une spéciale = le standard + sa brique en plus).
//
// Standard :
//   • Pion : se déplace et prend 1 case en diagonale, VERS L'AVANT uniquement. Promotion → dame.
//   • Dame : se déplace et prend 1 case en diagonale, AVANT *et* ARRIÈRE (dame « courte »).
// Dames spéciales (additif sur la dame) :
//   • Bondissante : se déplace de 2 cases (au lieu d'1).
//   • Perce-ligne : prend 2 ennemis ALIGNÉS d'un coup (saut span 2) — garde aussi la prise simple.
//   • Équerre : prend aussi ORTHOGONALEMENT (pas seulement en diagonale).
//
// Règles transverses : RAFLE (une prise qui peut se prolonger DOIT se prolonger) ; prise
// OBLIGATOIRE (non majoritaire) ; promotion à l'arrêt d'un pion sur la dernière rangée (type
// CHOISI) ; défaite = plus aucune pièce OU plus aucun coup légal à son tour.

export const SIZE = 8;

/** 'b' = blanc (part en bas, avance vers le haut) ; 'n' = noir (part en haut, avance vers le bas). */
export type Player = 'b' | 'n';

/** Une pièce porte son TYPE (`kind`, clé dans `KINDS`) — plus de booléen `king`. */
export interface Piece {
  player: Player;
  kind: string;
}

/** Plateau = 64 cases à plat (index = y*8 + x) ; null = vide. */
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

// ---- Registre de capacités ------------------------------------------------

/** Direction élémentaire (dx, dy). */
export type Vec = readonly [number, number];

const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const satisfies readonly Vec[];
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const satisfies readonly Vec[];

/** Règle de DÉPLACEMENT simple : glisse de `range` cases vides dans chaque direction. */
export interface MoveRule {
  dirs: readonly Vec[];
  range: number;
  forwardOnly: boolean;
}

/** Règle de PRISE : saute `jumpSpan` ennemis consécutifs, atterrit dans `landRange` cases au-delà. */
export interface CaptureRule {
  dirs: readonly Vec[];
  jumpSpan: number;
  landRange: number;
  forwardOnly: boolean;
}

/** Définition d'un type de pièce (capacités unionnées : plusieurs règles = additif). */
export interface PieceKind {
  id: string;
  name: string;
  moves: MoveRule[];
  captures: CaptureRule[];
  /** Cible de promotion par défaut (pion → dame). */
  promotesTo?: string;
  /** Proposé au joueur comme choix de promotion ? */
  promotable?: boolean;
}

// Briques réutilisées.
const DIAG_MOVE_1: MoveRule = { dirs: DIAG, range: 1, forwardOnly: false };
const DIAG_CAP_1: CaptureRule = { dirs: DIAG, jumpSpan: 1, landRange: 1, forwardOnly: false };

export const KINDS: Record<string, PieceKind> = {
  pion: {
    id: 'pion', name: 'Pion',
    moves: [{ dirs: DIAG, range: 1, forwardOnly: true }],
    captures: [{ dirs: DIAG, jumpSpan: 1, landRange: 1, forwardOnly: true }],
    promotesTo: 'dame',
  },
  dame: {
    id: 'dame', name: 'Dame', promotable: true,
    moves: [DIAG_MOVE_1],
    captures: [DIAG_CAP_1],
  },
  'dame-bond': {
    id: 'dame-bond', name: 'Dame bondissante (porte 2 cases)', promotable: true,
    moves: [{ dirs: DIAG, range: 2, forwardOnly: false }],
    captures: [DIAG_CAP_1],
  },
  'dame-perce': {
    id: 'dame-perce', name: 'Dame perce-ligne (double prise)', promotable: true,
    moves: [DIAG_MOVE_1],
    // additif : prise simple (standard) + prise de 2 ennemis alignés.
    captures: [DIAG_CAP_1, { dirs: DIAG, jumpSpan: 2, landRange: 1, forwardOnly: false }],
  },
  'dame-equerre': {
    id: 'dame-equerre', name: 'Dame équerre (prise orthogonale)', promotable: true,
    moves: [DIAG_MOVE_1],
    // additif : prise diagonale (standard) + prise orthogonale.
    captures: [DIAG_CAP_1, { dirs: ORTHO, jumpSpan: 1, landRange: 1, forwardOnly: false }],
  },
};

/** Types proposés au choix de promotion (dans l'ordre du registre). */
export const PROMOTION_KINDS: string[] = Object.values(KINDS)
  .filter((k) => k.promotable)
  .map((k) => k.id);

// ---- Géométrie élémentaire ------------------------------------------------

export const idx = (x: number, y: number): number => y * SIZE + x;
export const xy = (i: number): { x: number; y: number } => ({ x: i % SIZE, y: Math.floor(i / SIZE) });
const inBounds = (x: number, y: number): boolean => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

/** Cases « foncées » (somme des coordonnées impaire) — sert au damier décoratif et à l'orientation. */
export const isDark = (x: number, y: number): boolean => (x + y) % 2 === 1;

const other = (p: Player): Player => (p === 'b' ? 'n' : 'b');
/** Sens « avant » selon le camp : blanc monte (y décroît), noir descend (y croît). */
const forwardDy = (p: Player): number => (p === 'b' ? -1 : 1);
/** Rangée de promotion (dernière rangée adverse). */
const lastRow = (p: Player): number => (p === 'b' ? 0 : SIZE - 1);

/** Filtre les directions selon l'orientation du camp si la règle est « avant uniquement ». */
function orient(dirs: readonly Vec[], player: Player, forwardOnly: boolean): readonly Vec[] {
  if (!forwardOnly) return dirs;
  const f = forwardDy(player);
  return dirs.filter(([, dy]) => Math.sign(dy) === f);
}

// ---- Position de départ ---------------------------------------------------

/** Nombre de rangées PLEINES déployées par camp (plateau « toutes cases »). */
export const START_ROWS = 2;

/**
 * Position initiale — plateau « TOUTES CASES » (variante exagérée) : les pièces occupent les 64
 * cases, pas seulement les foncées. `START_ROWS` rangées pleines par camp (toutes colonnes) ; le
 * déplacement reste diagonal → les pions vivent sur deux trames de couleur entrelacées, et seule
 * la dame ÉQUERRE (prise orthogonale) franchit la frontière de couleur. Blanc joue.
 */
export function initialState(): DamesState {
  const board: (Piece | null)[] = new Array(SIZE * SIZE).fill(null);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (y < START_ROWS) board[idx(x, y)] = { player: 'n', kind: 'pion' };
      else if (y >= SIZE - START_ROWS) board[idx(x, y)] = { player: 'b', kind: 'pion' };
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
  captured: number[];
  land: number;
}

/** Prises immédiates depuis `pos` (toutes les règles de prise du type, unionnées). */
function captureSteps(
  board: (Piece | null)[],
  pos: number,
  piece: Piece,
  start: number,
  taken: Set<number>,
): CaptureStep[] {
  const kind = KINDS[piece.kind];
  if (!kind) return [];
  const { x, y } = xy(pos);
  const steps: CaptureStep[] = [];

  for (const rule of kind.captures) {
    for (const [dx, dy] of orient(rule.dirs, piece.player, rule.forwardOnly)) {
      // `jumpSpan` ennemis consécutifs, adjacents à partir du pas 1.
      const enemies: number[] = [];
      let ok = true;
      for (let s = 1; s <= rule.jumpSpan; s++) {
        const ex = x + dx * s, ey = y + dy * s;
        if (!inBounds(ex, ey)) { ok = false; break; }
        const eIdx = idx(ex, ey);
        const e = occupant(board, eIdx, start);
        if (!e || e.player === piece.player || taken.has(eIdx)) { ok = false; break; }
        enemies.push(eIdx);
      }
      if (!ok) continue;
      // Atterrissages : cases vides au-delà des ennemis, dans la limite de `landRange`.
      for (let j = rule.jumpSpan + 1; j <= rule.jumpSpan + rule.landRange; j++) {
        const lx = x + dx * j, ly = y + dy * j;
        if (!inBounds(lx, ly)) break;
        if (occupant(board, idx(lx, ly), start) !== null) break;
        steps.push({ captured: [...enemies], land: idx(lx, ly) });
      }
    }
  }
  return steps;
}

/** Toutes les rafles MAXIMALES partant de la pièce en `start` (une prise qui peut continuer continue). */
function captureMovesFrom(board: (Piece | null)[], start: number, piece: Piece): Move[] {
  const results: Move[] = [];
  const recurse = (pos: number, taken: Set<number>) => {
    const steps = captureSteps(board, pos, piece, start, taken);
    if (steps.length === 0) {
      if (taken.size > 0) results.push({ from: start, to: pos, captures: [...taken] });
      return;
    }
    for (const s of steps) {
      const next = new Set(taken);
      s.captured.forEach((c) => next.add(c));
      recurse(s.land, next);
    }
  };
  recurse(start, new Set());
  return results;
}

/** Déplacements simples (sans prise) depuis `start`, selon les règles de déplacement du type. */
function quietMovesFrom(board: (Piece | null)[], start: number, piece: Piece): Move[] {
  const kind = KINDS[piece.kind];
  if (!kind) return [];
  const { x, y } = xy(start);
  const moves: Move[] = [];
  for (const rule of kind.moves) {
    for (const [dx, dy] of orient(rule.dirs, piece.player, rule.forwardOnly)) {
      for (let i = 1; i <= rule.range; i++) {
        const tx = x + dx * i, ty = y + dy * i;
        if (!inBounds(tx, ty) || board[idx(tx, ty)] !== null) break; // glisse sur du vide
        moves.push({ from: start, to: idx(tx, ty), captures: [] });
      }
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
  return captures.length > 0 ? captures : quiets;
}

/** Coups légaux pour UNE pièce donnée (pratique pour l'UI). Respecte la prise obligatoire globale. */
export function movesForPiece(state: DamesState, from: number): Move[] {
  return legalMoves(state).filter((m) => m.from === from);
}

// ---- Application d'un coup -------------------------------------------------

/** Ce coup promeut-il un pion (arrêt sur la dernière rangée) ? Utile à l'UI pour le choix du type. */
export function isPromoting(state: DamesState, move: Move): boolean {
  const p = state.board[move.from];
  if (!p) return false;
  const kind = KINDS[p.kind];
  return !!kind?.promotesTo && xy(move.to).y === lastRow(p.player);
}

/**
 * Applique un coup → NOUVEL état (immuable). Gère retrait des prises + promotion.
 * `promoteTo` = type choisi à la promotion (sinon défaut `promotesTo` du type).
 */
export function applyMove(state: DamesState, move: Move, promoteTo?: string): DamesState {
  const board = state.board.slice();
  const piece = board[move.from];
  if (!piece) return state; // garde-fou
  board[move.from] = null;
  for (const c of move.captures) board[c] = null;
  let placed: Piece = piece;
  if (isPromoting(state, move)) {
    const def = KINDS[piece.kind]!.promotesTo!;
    const target = promoteTo && KINDS[promoteTo]?.promotable ? promoteTo : def;
    placed = { player: piece.player, kind: target };
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
