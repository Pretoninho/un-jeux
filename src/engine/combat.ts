// Combat tactique — NOYAU. Déplacement + attaque, budget en POINTS D'ACTION (PA).
//
// Budget : chaque tour, l'unité active dispose d'un pool de PA qu'elle répartit librement.
//   - un pas de déplacement coûte 1 PA (terrain uniforme) ;
//   - une attaque coûte `attackCost` PA et inflige `attackDamage` à une cible à portée.
// On peut donc bouger PUIS frapper, frapper PUIS reculer (kiting), ou tout dépenser à bouger.
//
// Règles de déplacement : une pièce par case ; les unités sont des OBSTACLES (ni arrêt ni
// passage sur une case occupée). Mort = PV ≤ 0 → l'unité quitte le plateau ; le dernier
// camp avec au moins une pièce gagne.
//
// Module PUR, immuable : chaque action rend un NOUVEAU CombatState. Aucune dépendance DOM.

import type { GameMap, HexId } from './types';

/** Une unité : à qui elle est, où elle est, ses points de vie. */
export interface Unit {
  id: string;
  owner: string;
  hex: HexId;
  hp: number;
}

/** Réglages d'attaque (données → réglables sans toucher la logique). */
export interface AttackConfig {
  range: number;       // portée (1 = corps-à-corps / adjacent)
  cost: number;        // coût en PA
  damage: number;      // dégâts infligés
}

/** État d'un affrontement. `ap` = PA restants de l'unité active ce tour. */
export interface CombatState {
  map: GameMap;
  units: Unit[];
  turn: number;
  active: string;
  ap: number;
}

export function makeCombatState(map: GameMap, units: Unit[], active: string, apPerTurn: number): CombatState {
  return { map, units, turn: 1, active, ap: apPerTurn };
}

export function unitById(state: CombatState, unitId: string): Unit | undefined {
  return state.units.find((u) => u.id === unitId);
}

export function unitAt(state: CombatState, hexId: HexId): Unit | undefined {
  return state.units.find((u) => u.hex === hexId);
}

/** Camps ayant encore au moins une unité. */
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
 * Cases atteignables par une unité, avec leur distance (1..steps). Parcours en largeur ;
 * une case occupée par une AUTRE unité est infranchissable (ni arrêt, ni traversée).
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

/** Déplace l'unité active vers `dest` si atteignable avec ses PA ; déduit la distance. Immuable. */
export function moveUnit(state: CombatState, unitId: string, dest: HexId): CombatState {
  const unit = unitById(state, unitId);
  if (!unit || unit.owner !== state.active) return state;
  const d = reachable(state, unitId, state.ap).get(dest);
  if (d === undefined) return state;
  return {
    ...state,
    units: state.units.map((u) => (u.id === unitId ? { ...u, hex: dest } : u)),
    ap: state.ap - d,
  };
}

// ─────────────────────── Attaque ─────────────────────────────────────────────

/** Distance dans le graphe de cases (ignore les unités), ou Infinity si non relié. */
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

/** L'unité active peut-elle attaquer cette cible (camp adverse, à portée, assez de PA) ? */
export function canAttack(state: CombatState, targetId: string, cfg: AttackConfig): boolean {
  const attacker = state.units.find((u) => u.owner === state.active);
  const target = unitById(state, targetId);
  if (!attacker || !target || target.owner === state.active) return false;
  if (state.ap < cfg.cost) return false;
  return graphDistance(state.map, attacker.hex, target.hex) <= cfg.range;
}

/**
 * L'unité active attaque `targetId` : inflige `cfg.damage`, dépense `cfg.cost` PA.
 * Une cible à 0 PV ou moins quitte le plateau. Sans effet si l'attaque est illégale.
 */
export function attack(state: CombatState, targetId: string, cfg: AttackConfig): CombatState {
  if (!canAttack(state, targetId, cfg)) return state;
  const units = state.units
    .map((u) => (u.id === targetId ? { ...u, hp: u.hp - cfg.damage } : u))
    .filter((u) => u.hp > 0);
  return { ...state, units, ap: state.ap - cfg.cost };
}

// ─────────────────────── Passage de main ─────────────────────────────────────

/** Passe la main au camp suivant (encore en vie) et recharge ses PA. */
export function endTurn(state: CombatState, apPerTurn: number): CombatState {
  const owners = liveOwners(state);
  const i = owners.indexOf(state.active);
  const next = owners[(i + 1) % owners.length] ?? state.active;
  return { ...state, active: next, turn: state.turn + 1, ap: apPerTurn };
}
