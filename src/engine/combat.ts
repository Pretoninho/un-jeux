// Combat tactique — NOYAU. Plusieurs pièces par camp ; chaque PIÈCE a ses propres PA.
//
// Budget : à ton tour, chacune de tes pièces dispose d'un pool de PA.
//   - un pas de déplacement coûte 1 PA (terrain uniforme) ;
//   - une attaque coûte `attackCost` PA et inflige `attackDamage` à une cible à portée.
// Tu joues tes pièces dans l'ordre que tu veux ; « finir le tour » recharge les PA du camp
// suivant. On peut donc concentrer le feu (focus-fire), faire écran, kiter, etc.
//
// Règles de déplacement : une pièce par case ; les pièces sont des OBSTACLES (ni arrêt ni
// passage). Mort = PV ≤ 0 → la pièce quitte le plateau ; le dernier camp avec au moins une
// pièce gagne.
//
// Module PUR, immuable : chaque action rend un NOUVEAU CombatState. Aucune dépendance DOM.

import type { GameMap, HexId } from './types';

/**
 * Une pièce : à qui elle est, où elle est, ses PV/PA, et son PROFIL d'attaque
 * (portée/dégâts/coût). Le profil vit sur la pièce — voir engine/pieces.ts pour
 * la dérivation depuis le palier de portée (calibrage « portée + robustesse = 5 »).
 */
export interface Unit {
  id: string;
  owner: string;
  hex: HexId;
  hp: number;
  maxHp: number;
  ap: number;
  range: number;      // portée d'attaque (1 = adjacent)
  damage: number;     // dégâts par coup
  attackCost: number; // coût en PA d'une attaque
  kind: string;       // clé d'archétype (affichage)
}

export interface CombatState {
  map: GameMap;
  units: Unit[];
  turn: number;
  active: string; // camp dont c'est le tour
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

/** Pièces du camp actif. */
export function activeUnits(state: CombatState): Unit[] {
  return state.units.filter((u) => u.owner === state.active);
}

/** Camps ayant encore au moins une pièce. */
export function liveOwners(state: CombatState): string[] {
  return [...new Set(state.units.map((u) => u.owner))];
}

/** Vainqueur si un seul camp subsiste, sinon `null` (partie en cours). */
export function winner(state: CombatState): string | null {
  const owners = liveOwners(state);
  return owners.length === 1 ? owners[0]! : null;
}

// ─────────────────────── Déplacement ─────────────────────────────────────────

/**
 * Cases atteignables par une pièce, avec leur distance (1..steps). Parcours en largeur ;
 * une case occupée par une AUTRE pièce est infranchissable (ni arrêt, ni traversée).
 * La case de départ est exclue. `steps` = PA disponibles (1 PA / pas).
 */
export function reachable(state: CombatState, unitId: string, steps: number): Map<HexId, number> {
  const dist = new Map<HexId, number>();
  const unit = unitById(state, unitId);
  if (!unit || steps <= 0) return dist;

  const occupied = new Set(state.units.filter((u) => u.id !== unitId).map((u) => u.hex));
  const byId = new Map(state.map.hexes.map((h) => [h.id, h] as const));

  const visited = new Set<HexId>([unit.hex]);
  let frontier: HexId[] = [unit.hex];
  for (let d = 1; d <= steps; d++) {
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

/** Déplace une pièce du camp actif vers `dest` si atteignable ; déduit la distance de SES PA. */
export function moveUnit(state: CombatState, unitId: string, dest: HexId): CombatState {
  const unit = unitById(state, unitId);
  if (!unit || unit.owner !== state.active) return state;
  const d = reachable(state, unitId, unit.ap).get(dest);
  if (d === undefined) return state;
  return {
    ...state,
    units: state.units.map((u) => (u.id === unitId ? { ...u, hex: dest, ap: u.ap - d } : u)),
  };
}

// ─────────────────────── Attaque ─────────────────────────────────────────────

/** Distance dans le graphe de cases (ignore les pièces), ou Infinity si non relié. */
export function graphDistance(map: GameMap, from: HexId, to: HexId): number {
  if (from === to) return 0;
  const byId = new Map(map.hexes.map((h) => [h.id, h] as const));
  const seen = new Set<HexId>([from]);
  let frontier: HexId[] = [from];
  let d = 0;
  while (frontier.length) {
    d++;
    const next: HexId[] = [];
    for (const h of frontier) {
      for (const nb of byId.get(h)?.neighbors ?? []) {
        if (seen.has(nb)) continue;
        if (nb === to) return d;
        seen.add(nb);
        next.push(nb);
      }
    }
    frontier = next;
  }
  return Infinity;
}

/**
 * `attackerId` (du camp actif) peut-il attaquer `targetId` ? Cible adverse, dans la portée
 * DE L'ATTAQUANT, et assez de PA pour son coût d'attaque.
 */
export function canAttack(state: CombatState, attackerId: string, targetId: string): boolean {
  const attacker = unitById(state, attackerId);
  const target = unitById(state, targetId);
  if (!attacker || attacker.owner !== state.active) return false;
  if (!target || target.owner === state.active) return false;
  if (attacker.ap < attacker.attackCost) return false;
  return graphDistance(state.map, attacker.hex, target.hex) <= attacker.range;
}

/**
 * `attackerId` attaque `targetId` : inflige les dégâts de l'attaquant, dépense son coût en PA.
 * Une cible à 0 PV ou moins quitte le plateau. Sans effet si l'attaque est illégale.
 */
export function attack(state: CombatState, attackerId: string, targetId: string): CombatState {
  if (!canAttack(state, attackerId, targetId)) return state;
  const attacker = unitById(state, attackerId)!;
  const units = state.units
    .map((u) => {
      if (u.id === attackerId) return { ...u, ap: u.ap - attacker.attackCost };
      if (u.id === targetId) return { ...u, hp: u.hp - attacker.damage };
      return u;
    })
    .filter((u) => u.hp > 0);
  return { ...state, units };
}

// ─────────────────────── Passage de main ─────────────────────────────────────

/** Passe la main au camp suivant (encore en vie) et recharge SES PA. */
export function endTurn(state: CombatState, apPerTurn: number): CombatState {
  const owners = liveOwners(state);
  const i = owners.indexOf(state.active);
  const next = owners[(i + 1) % owners.length] ?? state.active;
  return {
    ...state,
    active: next,
    turn: state.turn + 1,
    units: state.units.map((u) => (u.owner === next ? { ...u, ap: apPerTurn } : u)),
  };
}
