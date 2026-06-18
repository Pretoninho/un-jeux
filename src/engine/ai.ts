// Adversaire — CERVEAU. Module PUR, immuable, sans DOM : décide le tour d'un camp et rend
// soit la liste d'actions (`planTurn`, rejouable une par une → futur auto-play animé), soit
// directement l'état après le tour (`playTurn`). Aucun hasard : à entrée égale, plan égal.
//
// Stratégie : greedy 1-ply. À chaque pas, on énumère les actions légales des pièces actives,
// on les SCORE (en simulant sur le moteur pur), on joue la meilleure, on recommence ; on
// `endTurn` quand plus rien ne vaut le coup. Trois niveaux = même moteur, finesse croissante.

import type { HexId } from './types';
import {
  type CombatState, type Unit,
  reachable, moveBudget, moveUnit, attack, canAttack, canDefend, defend, canReserve, reserve,
  resolveOverwatch, endTurn, winner, unitById, graphDistance, previewReactions,
} from './combat';

export type Difficulty = 'facile' | 'normal' | 'difficile';
export const DIFFICULTIES: Difficulty[] = ['facile', 'normal', 'difficile'];

/** Une action atomique du tour (le format liste permet de la rejouer/animer plus tard). */
export type AiAction =
  | { type: 'move'; unitId: string; dest: HexId }
  | { type: 'attack'; attackerId: string; targetId: string }
  | { type: 'guard'; unitId: string }      // Lourde : se mettre en garde
  | { type: 'reserve'; unitId: string }    // Tireur : réserver son tir
  | { type: 'endTurn' };

// ─────────────────────── Réglages (calibrage = terrain de PLAYTEST) ───────────
const ALIVE = 1000;        // valeur d'une pièce en vie (un kill pèse ≫ un coup)
const HP_W = 10;           // valeur d'un point de vie
const CLOSE_W = 1;         // attrait d'un pas vers l'ennemi (≪ HP : ne sacrifie jamais des PV pour avancer)
const FAR = 9999;          // distance d'une case non reliée (ne devrait pas arriver)
const GUARD_VALUE = 45;    // valeur d'une garde quand la pièce est menacée
const RESERVE_VALUE = 35;  // valeur d'un tir réservé quand un ennemi peut s'approcher dans la zone
const RESONANCE_NUDGE = 3; // malus par Résonance adverse nourrie (départage : Difficile évite les gardes/ripostes ennemies)
const PROTECT_W = 4;       // pénalité (Difficile) pour une pièce exposée, accrue si elle est entamée
const THREAT_HORIZON = 4;  // mobilité ennemie supposée pour juger une menace (≈ PA d'un tour)
const MIN_GAIN = 0.5;      // en-dessous, l'action ne « vaut pas le coup » → on s'arrête
const EPS = 1e-6;
const MAX_ACTIONS = 64;    // garde-fou de terminaison

/** Réglages de finesse par niveau — c'est ICI que les trois IA diffèrent. */
interface Brain {
  seeOverwatch: boolean;   // anticiper le tir réservé en notant un déplacement (Facile : aveugle → fonce dedans)
  useVerbs: boolean;       // peut se mettre en garde / réserver son tir
  valueResonance: boolean; // conscient des Résonances : ÉVITE de frapper dans la garde/riposte adverse
  naiveAttacks: boolean;   // score une attaque sur les seuls dégâts infligés (ignore riposte/contre subis)
  protectWeak: boolean;    // pénalise l'exposition de ses pièces (surtout entamées)
}
const BRAINS: Record<Difficulty, Brain> = {
  facile:    { seeOverwatch: false, useVerbs: false, valueResonance: false, naiveAttacks: true,  protectWeak: false },
  normal:    { seeOverwatch: true,  useVerbs: true,  valueResonance: false, naiveAttacks: false, protectWeak: false },
  difficile: { seeOverwatch: true,  useVerbs: true,  valueResonance: true,  naiveAttacks: false, protectWeak: true  },
};

// ─────────────────────── Évaluation d'un état (du point de vue du camp `me`) ───
function pieceValue(u: Unit): number {
  return ALIVE + HP_W * Math.max(0, u.hp);
}
function material(state: CombatState, me: string): number {
  let m = 0;
  for (const u of state.units) m += (u.owner === me ? 1 : -1) * pieceValue(u);
  return m;
}
function enemyMaterial(state: CombatState, me: string): number {
  let m = 0;
  for (const u of state.units) if (u.owner !== me) m += pieceValue(u);
  return m;
}
/** Champ de distance multi-source (1 seul BFS) depuis les cases `sources` ; ignore l'occupation. */
function distanceField(map: CombatState['map'], sources: HexId[]): Map<HexId, number> {
  const dist = new Map<HexId, number>();
  const byId = new Map(map.hexes.map((h) => [h.id, h] as const));
  let frontier: HexId[] = [];
  for (const s of sources) if (!dist.has(s)) { dist.set(s, 0); frontier.push(s); }
  for (let d = 1; frontier.length; d++) {
    const next: HexId[] = [];
    for (const h of frontier) for (const nb of byId.get(h)?.neighbors ?? []) {
      if (dist.has(nb)) continue;
      dist.set(nb, d);
      next.push(nb);
    }
    frontier = next;
  }
  return dist;
}
/** Terme positionnel : récompense la proximité de mes pièces aux ennemis (via le champ `efield`). */
function positional(state: CombatState, me: string, efield: Map<HexId, number>): number {
  let p = 0;
  for (const u of state.units) if (u.owner === me) p -= CLOSE_W * (efield.get(u.hex) ?? FAR);
  return p;
}
/** Un ennemi (qui frappe) peut-il atteindre la case de `u` en un tour ? (portée + mobilité supposée) */
function threatened(state: CombatState, u: Unit): boolean {
  return state.units.some((e) =>
    e.owner !== u.owner && e.hp > 0 && e.damage > 0 &&
    graphDistance(state.map, e.hex, u.hex) <= e.range + THREAT_HORIZON);
}
/** Un ennemi hors de MA portée mais capable de s'y approcher (cible idéale d'un tir réservé). */
function approaching(state: CombatState, u: Unit): boolean {
  return state.units.some((e) => {
    if (e.owner === u.owner || e.hp <= 0 || e.damage <= 0) return false;
    const d = graphDistance(state.map, u.hex, e.hex);
    return d > u.range && d <= u.range + THREAT_HORIZON;
  });
}
function protect(state: CombatState, me: string, brain: Brain): number {
  if (!brain.protectWeak) return 0;
  let pen = 0;
  for (const u of state.units) {
    if (u.owner !== me || !threatened(state, u)) continue;
    pen -= PROTECT_W * (1 + (u.maxHp - Math.max(0, u.hp)) / u.maxHp); // plus la pièce est entamée, plus on la protège
  }
  return pen;
}
function evalState(state: CombatState, me: string, efield: Map<HexId, number>, brain: Brain): number {
  return material(state, me) + positional(state, me, efield) + protect(state, me, brain);
}

// ─────────────────────── Exécution d'une action (miroir du jeu réel) ──────────
/**
 * Applique une action comme le ferait l'UI : un déplacement déclenche le tir réservé adverse
 * (`resolveOverwatch`), une attaque résout frappe + riposte + Résonances. `apPerTurn` ne sert
 * qu'à `endTurn`. Une action illégale est un no-op (le moteur rend l'état inchangé).
 */
export function applyAction(state: CombatState, action: AiAction, apPerTurn = 0): CombatState {
  switch (action.type) {
    case 'move': {
      const moved = moveUnit(state, action.unitId, action.dest);
      return moved === state ? state : resolveOverwatch(moved, action.unitId);
    }
    case 'attack':  return attack(state, action.attackerId, action.targetId);
    case 'guard':   return defend(state, action.unitId);
    case 'reserve': return reserve(state, action.unitId);
    case 'endTurn': return endTurn(state, apPerTurn);
  }
}

// ─────────────────────── Énumération + scoring ────────────────────────────────
function candidates(state: CombatState, brain: Brain): AiAction[] {
  const out: AiAction[] = [];
  for (const u of state.units) {
    if (u.owner !== state.active) continue;
    for (const e of state.units)
      if (e.owner !== state.active && canAttack(state, u.id, e.id))
        out.push({ type: 'attack', attackerId: u.id, targetId: e.id });
    const budget = moveBudget(u);
    if (budget > 0) for (const dest of reachable(state, u.id, budget).keys())
      out.push({ type: 'move', unitId: u.id, dest });
    if (brain.useVerbs) {
      if (canDefend(state, u.id)) out.push({ type: 'guard', unitId: u.id });
      if (canReserve(state, u.id)) out.push({ type: 'reserve', unitId: u.id });
    }
  }
  return out;
}
/** Prévision d'un déplacement pour le SCORING : Facile ignore le tir réservé, les autres non. */
function foreseeMove(state: CombatState, unitId: string, dest: HexId, brain: Brain): CombatState {
  const moved = moveUnit(state, unitId, dest);
  return brain.seeOverwatch && moved !== state ? resolveOverwatch(moved, unitId) : moved;
}
function score(state: CombatState, action: AiAction, efield: Map<HexId, number>, brain: Brain): number {
  const me = state.active;
  switch (action.type) {
    case 'guard':
      return threatened(state, unitById(state, action.unitId)!) ? GUARD_VALUE : -1;
    case 'reserve':
      return approaching(state, unitById(state, action.unitId)!) ? RESERVE_VALUE : -1;
    case 'attack': {
      const after = attack(state, action.attackerId, action.targetId);
      // Naïf (Facile) : seuls les dégâts infligés comptent (aveugle aux ripostes/contres subis).
      let g = brain.naiveAttacks
        ? enemyMaterial(state, me) - enemyMaterial(after, me)
        : evalState(after, me, efield, brain) - evalState(state, me, efield, brain);
      if (brain.valueResonance) {
        // Un coup ne déclenche QUE les Résonances du DÉFENSEUR (sa garde/riposte) → elles NUISENT à
        // l'attaquant (épines, enracinement, silence…). Difficile ÉVITE donc de les nourrir (malus).
        const enemyReactions = previewReactions(state, action.attackerId, action.targetId)
          .filter((r) => unitById(state, r.listenerId)?.owner !== me).length;
        g -= RESONANCE_NUDGE * enemyReactions;
      }
      return g;
    }
    case 'move': {
      const after = foreseeMove(state, action.unitId, action.dest, brain);
      return evalState(after, me, efield, brain) - evalState(state, me, efield, brain);
    }
    case 'endTurn':
      return -Infinity;
  }
}
/** Clé de départage déterministe : on préfère attaque > déplacement > garde > tir réservé, puis ids. */
function tieKey(a: AiAction): string {
  switch (a.type) {
    case 'attack':  return `0:${a.attackerId}:${a.targetId}`;
    case 'move':    return `1:${a.unitId}:${a.dest}`;
    case 'guard':   return `2:${a.unitId}:`;
    case 'reserve': return `3:${a.unitId}:`;
    case 'endTurn': return `9::`;
  }
}

// ─────────────────────── Plan d'un tour ───────────────────────────────────────
/**
 * Décide la suite d'actions du camp actif pour ce tour (terminée par `endTurn`). Pur : ne
 * modifie pas `state`. Greedy borné → terminaison garantie.
 */
export function planTurn(state: CombatState, level: Difficulty): AiAction[] {
  const brain = BRAINS[level];
  const out: AiAction[] = [];
  let work = state;
  for (let i = 0; i < MAX_ACTIONS; i++) {
    if (winner(work)) break;
    const enemyHexes = work.units.filter((u) => u.owner !== work.active).map((u) => u.hex);
    if (!enemyHexes.length) break;
    const efield = distanceField(work.map, enemyHexes);
    let best: AiAction | null = null;
    let bestScore = -Infinity;
    for (const c of candidates(work, brain)) {
      const s = score(work, c, efield, brain);
      if (s > bestScore + EPS) { best = c; bestScore = s; }
      else if (best && Math.abs(s - bestScore) <= EPS && tieKey(c) < tieKey(best)) best = c;
    }
    if (!best || bestScore <= MIN_GAIN) break;
    work = applyAction(work, best);
    out.push(best);
  }
  out.push({ type: 'endTurn' });
  return out;
}

/** Joue le tour complet du camp actif et rend l'état résultant (plan replié sur le moteur). */
export function playTurn(state: CombatState, apPerTurn: number, level: Difficulty): CombatState {
  let s = state;
  for (const a of planTurn(state, level)) s = applyAction(s, a, apPerTurn);
  return s;
}
