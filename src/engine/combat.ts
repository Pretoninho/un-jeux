// Combat tactique — NOYAU étape 0, brique DÉPLACEMENT.
//
// On ne traite ici QUE le mouvement (pas encore d'attaque ni de HP — ils viendront
// par-dessus, une chose à la fois). Règles posées :
//   - une pièce (unité) par case ; deux unités ne se superposent jamais ;
//   - les unités sont des OBSTACLES : on ne traverse pas une case occupée ;
//   - se déplacer = un chemin de cases adjacentes, 1 point par case (terrain uniforme) ;
//   - on peut bouger de 0 à `move` cases ; le reste est perdu.
//
// Module PUR, immuable : chaque action rend un NOUVEAU CombatState. Aucune dépendance DOM.

import type { GameMap, HexId } from './types';

/** Une unité sur le plateau : à qui elle est, où elle est. */
export interface Unit {
  id: string;
  owner: string;
  hex: HexId;
}

/** État d'un affrontement. Tout est ici. */
export interface CombatState {
  map: GameMap;
  units: Unit[];
  /** Numéro de tour (incrémenté à chaque passage de main). */
  turn: number;
  /** Propriétaire dont c'est le tour. */
  active: string;
}

export function makeCombatState(map: GameMap, units: Unit[], active: string): CombatState {
  return { map, units, turn: 1, active };
}

export function unitById(state: CombatState, unitId: string): Unit | undefined {
  return state.units.find((u) => u.id === unitId);
}

export function unitAt(state: CombatState, hexId: HexId): Unit | undefined {
  return state.units.find((u) => u.hex === hexId);
}

/**
 * Cases atteignables par une unité, avec leur distance (1..move).
 * Parcours en largeur sur les voisins ; une case OCCUPÉE par une autre unité est
 * infranchissable (on ne peut ni s'y arrêter, ni la traverser). La case de départ
 * est exclue du résultat.
 */
export function reachable(state: CombatState, unitId: string, move: number): Map<HexId, number> {
  const dist = new Map<HexId, number>();
  const unit = unitById(state, unitId);
  if (!unit || move <= 0) return dist;

  const occupied = new Set(state.units.filter((u) => u.id !== unitId).map((u) => u.hex));
  const byId = new Map(state.map.hexes.map((h) => [h.id, h] as const));

  const visited = new Set<HexId>([unit.hex]);
  let frontier: HexId[] = [unit.hex];
  for (let d = 1; d <= move; d++) {
    const next: HexId[] = [];
    for (const h of frontier) {
      for (const nb of byId.get(h)?.neighbors ?? []) {
        if (visited.has(nb) || occupied.has(nb)) continue;
        visited.add(nb);
        dist.set(nb, d);
        next.push(nb);
      }
    }
    frontier = next;
  }
  return dist;
}

/** Une unité peut-elle atteindre `dest` ce tour (dans son allocation `move`) ? */
export function canMove(state: CombatState, unitId: string, dest: HexId, move: number): boolean {
  return reachable(state, unitId, move).has(dest);
}

/** Déplace une unité vers `dest` si c'est légal. Sans effet sinon (immuable). */
export function moveUnit(state: CombatState, unitId: string, dest: HexId, move: number): CombatState {
  if (!canMove(state, unitId, dest, move)) return state;
  return {
    ...state,
    units: state.units.map((u) => (u.id === unitId ? { ...u, hex: dest } : u)),
  };
}

/** Passe la main au joueur suivant (rotation sur les propriétaires présents). */
export function endTurn(state: CombatState): CombatState {
  const owners = [...new Set(state.units.map((u) => u.owner))];
  const i = owners.indexOf(state.active);
  const next = owners[(i + 1) % owners.length] ?? state.active;
  return { ...state, active: next, turn: state.turn + 1 };
}
