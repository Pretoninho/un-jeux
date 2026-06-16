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
 * Capacité de GARDE — le verbe « se défendre », propre à certains archétypes (les CAC).
 * Les NOMBRES vivent sur la pièce (comme portée/dégâts) → personnalisables perso par perso :
 * un autre CAC peut avoir un autre coût / une autre réduction. Une pièce sans `guard`
 * (ex. le Tireur) ne peut pas se garder du tout — sa défense reste portée/placement.
 */
export interface GuardProfile {
  cost: number;           // PA pour entrer en garde
  damageTakenMul: number; // multiplicateur des dégâts subis pendant la garde (ex. 0.5)
}

/**
 * Capacité de TIR RÉSERVÉ (overwatch) — le verbe « réflexe », propre aux pièces à distance.
 * Comme `guard`, les nombres vivent sur la pièce → personnalisables perso par perso.
 * Une pièce sans `overwatch` (ex. la Lourde) ne peut pas réserver son tir.
 */
export interface OverwatchProfile {
  cost: number; // PA pour réserver son tir
}

/**
 * Capacité de RIPOSTE — le verbe « contre », atypique (le Duelliste). Miroir mêlée du tir
 * réservé : au lieu de réagir à un ennemi qui ARRIVE à portée, la pièce arme un contre qui
 * part quand un ennemi ADJACENT l'ATTAQUE (et qu'elle survit au coup). Les nombres vivent sur
 * la pièce → personnalisables perso par perso. Le contre rend les dégâts propres de la pièce.
 */
export interface RiposteProfile {
  cost: number; // PA pour armer la riposte
}

/**
 * RÉACTIONS EN CHAÎNE — synergies d'escouade. Un événement de combat émet un SIGNAL typé ;
 * les alliés dont un passif ÉCOUTE ce type réagissent. La spécificité « possesseur × déclencheur »
 * vit dans l'effet : `amountBySource` module selon l'archétype de la SOURCE — on n'écrit que les
 * cellules utiles, jamais les N². Données PURES (sérialisables) ; le moteur dispatch sur `kind`.
 */
export type SignalType = 'garde_encaissee';
export interface Signal {
  type: SignalType;
  sourceId: string;   // la pièce qui émet (ex. la Lourde qui a encaissé en garde)
  attackerId: string; // l'ennemi à l'origine du coup (cible des effets « épines »)
}
export type Scope = { radius: number } | { squad: true };
export interface ReactionSpec {
  id: string;                              // identifiant du passif (clé de cooldown)
  on: SignalType;                          // type de signal écouté
  scope: Scope;                            // portée : rayon autour de la source, ou toute l'escouade
  cooldown: number;                        // en tours du possesseur (0 = sans CD)
  kind: 'epines';                          // effet (le moteur dispatch dessus)
  amount?: number;                         // valeur par défaut de l'effet
  amountBySource?: Record<string, number>;    // override selon l'ARCHÉTYPE de la source (Unit.kind)
  amountByCharacter?: Record<string, number>; // override selon le HÉROS de la source (Unit.characterId) — plus spécifique
}
/** Une réaction prête à partir, résolue depuis un signal (sert résolution ET prévisualisation). */
export interface PendingReaction {
  listenerId: string;
  spec: ReactionSpec;
  targetId: string;
  amount: number;
}

/**
 * Une pièce : à qui elle est, où elle est, ses PV/PA, et son PROFIL d'attaque
 * (portée/dégâts/coût). Le profil vit sur la pièce — voir engine/pieces.ts pour
 * la dérivation depuis le palier de portée (calibrage « portée + robustesse = 5 »).
 */
export interface Unit {
  id: string;
  owner: string;
  characterId?: string; // identité héros stable (clé de la matrice « × personnage », vivier/draft)
  name?: string;      // nom du personnage (identité héros) ; affichage seulement
  hex: HexId;
  hp: number;
  maxHp: number;
  ap: number;
  range: number;      // portée d'attaque (1 = adjacent)
  damage: number;     // dégâts par coup
  attackCost: number; // coût en PA d'une attaque
  kind: string;       // clé d'archétype (affichage)
  guard?: GuardProfile; // capacité de garde (absente = pièce qui ne peut pas se défendre)
  guarding?: boolean;   // posture de garde active, jusqu'au début de son prochain tour
  overwatch?: OverwatchProfile; // capacité de tir réservé (absente = pas de réflexe possible)
  watching?: boolean;   // tir réservé armé, jusqu'au début de son prochain tour
  riposte?: RiposteProfile; // capacité de riposte (absente = pas de contre possible)
  riposting?: boolean;  // riposte armée, jusqu'au prochain tour OU jusqu'au premier contre
  reactions?: ReactionSpec[];          // passifs en chaîne (écouteurs de signaux) — synergies d'escouade
  cooldowns?: Record<string, number>;  // CD restant par passif (clé = ReactionSpec.id), en tours
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

/** Dégâts effectivement subis par `target` : réduits (plancher 1) si la pièce est en garde. */
export function damageTaken(target: Unit, raw: number): number {
  if (target.guarding && target.guard) return Math.max(1, Math.floor(raw * target.guard.damageTakenMul));
  return raw;
}

/**
 * La FRAPPE nue (pure) : dégâts (réduits si la cible est en garde) + riposte éventuelle, et le
 * SIGNAL qu'elle émet le cas échéant — une pièce qui ENCAISSE en garde et survit émet
 * `garde_encaissee`. Séparer la frappe de ses réactions permet de prévisualiser une cascade
 * sans la committer (voir `previewReactions`).
 */
function strike(state: CombatState, attackerId: string, targetId: string): { state: CombatState; signal: Signal | null } {
  const attacker = unitById(state, attackerId)!;
  // 1) Le coup porté : l'attaquant dépense ses PA, la cible encaisse (réduit si en garde).
  let units = state.units.map((u) => {
    if (u.id === attackerId) return { ...u, ap: u.ap - attacker.attackCost };
    if (u.id === targetId) return { ...u, hp: u.hp - damageTaken(u, attacker.damage) };
    return u;
  });
  // 2) La riposte : seulement si la cible survit, était armée, et l'attaquant est à sa portée.
  const tgt = units.find((u) => u.id === targetId)!;
  if (tgt.hp > 0 && tgt.riposting && graphDistance(state.map, tgt.hex, attacker.hex) <= tgt.range) {
    const back = damageTaken(attacker, tgt.damage);
    units = units.map((u) => {
      if (u.id === targetId) return { ...u, riposting: false };
      if (u.id === attackerId) return { ...u, hp: u.hp - back };
      return u;
    });
  }
  const next: CombatState = { ...state, units: units.filter((u) => u.hp > 0) };
  const absorber = unitById(next, targetId);
  const signal: Signal | null =
    absorber && absorber.guarding && absorber.guard
      ? { type: 'garde_encaissee', sourceId: targetId, attackerId }
      : null;
  return { state: next, signal };
}

/**
 * `attackerId` attaque `targetId` : la frappe (coup réduit si la cible est en garde + riposte
 * éventuelle), PUIS les RÉACTIONS EN CHAÎNE — si la cible a encaissé en garde, elle émet un
 * signal que ses alliés relaient (voir `resolveReactions`). Sans effet si l'attaque est illégale.
 */
export function attack(state: CombatState, attackerId: string, targetId: string): CombatState {
  if (!canAttack(state, attackerId, targetId)) return state;
  const { state: s, signal } = strike(state, attackerId, targetId);
  return signal ? resolveReactions(s, signal) : s;
}

/**
 * Prévisualisation (lisibilité) : les réactions qui PARTIRAIENT si `attackerId` frappait
 * `targetId`, sans rien committer. Pur — rejoue la frappe puis liste les écouteurs éligibles.
 */
export function previewReactions(state: CombatState, attackerId: string, targetId: string): PendingReaction[] {
  if (!canAttack(state, attackerId, targetId)) return [];
  const { state: s, signal } = strike(state, attackerId, targetId);
  return signal ? pendingReactions(s, signal) : [];
}

// ─────────────────────── Réactions en chaîne (synergies d'escouade) ───────────

const REACTION_CHAIN_CAP = 64; // garde-fou dur, en plus du « un passif au plus une fois par chaîne »

function inScope(map: GameMap, source: Unit, listener: Unit, scope: Scope): boolean {
  return 'squad' in scope ? true : graphDistance(map, source.hex, listener.hex) <= scope.radius;
}

/**
 * Valeur de l'effet selon la SOURCE (la matrice possesseur×déclencheur). Priorité du plus
 * spécifique au plus général : héros (`characterId`) → archétype (`kind`) → défaut (`amount`) → 1.
 */
function reactionAmount(spec: ReactionSpec, source: Unit): number {
  return (
    (source.characterId !== undefined ? spec.amountByCharacter?.[source.characterId] : undefined) ??
    spec.amountBySource?.[source.kind] ??
    spec.amount ??
    1
  );
}

/**
 * Écouteurs éligibles à `signal` : alliés de la source (pas elle-même), dont un passif écoute
 * ce type, à portée (`scope`), hors cooldown, et pas déjà déclenchés dans la chaîne (`fired`).
 * Pur — sert à la fois la résolution et la prévisualisation.
 */
export function pendingReactions(state: CombatState, signal: Signal, fired: Set<string> = new Set()): PendingReaction[] {
  const source = unitById(state, signal.sourceId);
  const target = unitById(state, signal.attackerId);
  if (!source || !target) return [];
  const out: PendingReaction[] = [];
  for (const u of state.units) {
    if (u.owner !== source.owner || u.id === source.id) continue; // synergies alliées (pas soi)
    for (const spec of u.reactions ?? []) {
      if (spec.on !== signal.type) continue;
      if (fired.has(`${u.id}:${spec.id}`)) continue;
      if ((u.cooldowns?.[spec.id] ?? 0) > 0) continue;
      if (!inScope(state.map, source, u, spec.scope)) continue;
      out.push({ listenerId: u.id, spec, targetId: target.id, amount: reactionAmount(spec, source) });
    }
  }
  return out;
}

/** Applique une réaction (pur) : pose son cooldown sur l'écouteur puis joue son effet. */
function applyReaction(state: CombatState, p: PendingReaction): CombatState {
  if (!unitById(state, p.listenerId)) return state;
  const arm = (u: Unit): Unit => ({ ...u, cooldowns: { ...(u.cooldowns ?? {}), [p.spec.id]: p.spec.cooldown } });
  switch (p.spec.kind) {
    case 'epines': { // relaie des dégâts sur l'attaquant (réduits s'il est en garde)
      const target = unitById(state, p.targetId);
      const dmg = target ? damageTaken(target, p.amount) : 0;
      const units = state.units
        .map((u) => {
          if (u.id === p.listenerId) return arm(u);
          if (target && u.id === p.targetId) return { ...u, hp: u.hp - dmg };
          return u;
        })
        .filter((u) => u.hp > 0);
      return { ...state, units };
    }
    default:
      return state;
  }
}

/**
 * Résout une cascade depuis `signal` : file FIFO bornée ; chaque passif se déclenche au plus une
 * fois (`fired`) → terminaison garantie (+ garde-fou dur `REACTION_CHAIN_CAP`). Déterministe
 * (ordre des pièces stable ; on recalcule après chaque effet pour suivre morts et cooldowns).
 * Les effets peuvent émettre de nouveaux signaux (empilés) — aucun ne le fait encore en v1.
 */
export function resolveReactions(state: CombatState, signal: Signal): CombatState {
  const fired = new Set<string>();
  const queue: Signal[] = [signal];
  let s = state;
  let steps = 0;
  while (queue.length && steps < REACTION_CHAIN_CAP) {
    const sig = queue.shift()!;
    let pend = pendingReactions(s, sig, fired);
    while (pend.length && steps++ < REACTION_CHAIN_CAP) {
      const p = pend[0]!;
      fired.add(`${p.listenerId}:${p.spec.id}`);
      s = applyReaction(s, p);
      pend = pendingReactions(s, sig, fired); // l'état a changé (morts, cooldowns) → on recalcule
    }
  }
  return s;
}

// ─────────────────────── Garde / Défendre ────────────────────────────────────

/**
 * La pièce `unitId` peut-elle se mettre en garde ? Pièce du camp actif, dotée de la
 * capacité `guard`, pas déjà en garde, et assez de PA pour le coût de la garde.
 */
export function canDefend(state: CombatState, unitId: string): boolean {
  const u = unitById(state, unitId);
  if (!u || u.owner !== state.active) return false;
  if (!u.guard || u.guarding) return false;
  return u.ap >= u.guard.cost;
}

/**
 * `unitId` se met en garde : dépense le coût de sa garde et passe en posture défensive
 * jusqu'au début de son prochain tour (où `endTurn` la lève). Sans effet si illégal.
 */
export function defend(state: CombatState, unitId: string): CombatState {
  if (!canDefend(state, unitId)) return state;
  const u = unitById(state, unitId)!;
  return {
    ...state,
    units: state.units.map((x) =>
      x.id === unitId ? { ...x, ap: x.ap - u.guard!.cost, guarding: true } : x),
  };
}

// ─────────────────────── Tir réservé / Overwatch ─────────────────────────────

/**
 * La pièce `unitId` peut-elle réserver son tir ? Pièce du camp actif, dotée de la capacité
 * `overwatch`, pas déjà en guet, et assez de PA pour le coût.
 */
export function canReserve(state: CombatState, unitId: string): boolean {
  const u = unitById(state, unitId);
  if (!u || u.owner !== state.active) return false;
  if (!u.overwatch || u.watching) return false;
  return u.ap >= u.overwatch.cost;
}

/**
 * `unitId` réserve son tir : dépense le coût et s'arme jusqu'au début de son prochain tour.
 * Le tir part en réaction quand un ennemi s'arrête à portée — voir `resolveOverwatch`.
 */
export function reserve(state: CombatState, unitId: string): CombatState {
  if (!canReserve(state, unitId)) return state;
  const u = unitById(state, unitId)!;
  return {
    ...state,
    units: state.units.map((x) =>
      x.id === unitId ? { ...x, ap: x.ap - u.overwatch!.cost, watching: true } : x),
  };
}

/**
 * À appeler APRÈS un déplacement : les guetteurs ADVERSES (en `watching`) qui ont désormais
 * `movedUnitId` à portée tirent chacun UN coup (dégâts normaux), puis leur réserve est
 * consommée. Une cible à 0 PV quitte le plateau ; si elle meurt, les guetteurs restants
 * gardent leur tir. Module pur.
 */
export function resolveOverwatch(state: CombatState, movedUnitId: string): CombatState {
  const mover = unitById(state, movedUnitId);
  if (!mover) return state;
  let units = state.units;
  for (const w of state.units) {
    if (!w.watching || w.owner === mover.owner) continue;
    const cur = units.find((u) => u.id === movedUnitId);
    if (!cur) break; // la cible a déjà été abattue
    if (graphDistance(state.map, w.hex, cur.hex) > w.range) continue;
    const dmg = damageTaken(cur, w.damage);
    units = units
      .map((u) => {
        if (u.id === w.id) return { ...u, watching: false };
        if (u.id === movedUnitId) return { ...u, hp: u.hp - dmg };
        return u;
      })
      .filter((u) => u.hp > 0);
  }
  return units === state.units ? state : { ...state, units };
}

// ─────────────────────── Riposte / Contre ────────────────────────────────────

/**
 * La pièce `unitId` peut-elle armer sa riposte ? Pièce du camp actif, dotée de la capacité
 * `riposte`, pas déjà en posture, et assez de PA pour le coût.
 */
export function canRiposte(state: CombatState, unitId: string): boolean {
  const u = unitById(state, unitId);
  if (!u || u.owner !== state.active) return false;
  if (!u.riposte || u.riposting) return false;
  return u.ap >= u.riposte.cost;
}

/**
 * `unitId` arme sa riposte : dépense le coût et passe en posture de contre jusqu'au début de
 * son prochain tour OU jusqu'à ce qu'elle riposte une fois (résolu dans `attack`). Sans effet
 * si illégal.
 */
export function riposte(state: CombatState, unitId: string): CombatState {
  if (!canRiposte(state, unitId)) return state;
  const u = unitById(state, unitId)!;
  return {
    ...state,
    units: state.units.map((x) =>
      x.id === unitId ? { ...x, ap: x.ap - u.riposte!.cost, riposting: true } : x),
  };
}

// ─────────────────────── Passage de main ─────────────────────────────────────

/** Décrémente d'un tour tous les cooldowns d'une pièce (plancher 0). */
function tickCooldowns(cd: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!cd) return cd;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(cd)) out[k] = Math.max(0, v - 1);
  return out;
}

/**
 * Passe la main au camp suivant (encore en vie) et recharge SES PA ; garde, guet et riposte
 * expirent, et les cooldowns de réaction du camp entrant décomptent d'un tour.
 */
export function endTurn(state: CombatState, apPerTurn: number): CombatState {
  const owners = liveOwners(state);
  const i = owners.indexOf(state.active);
  const next = owners[(i + 1) % owners.length] ?? state.active;
  return {
    ...state,
    active: next,
    turn: state.turn + 1,
    units: state.units.map((u) =>
      u.owner === next
        ? { ...u, ap: apPerTurn, guarding: false, watching: false, riposting: false, cooldowns: tickCooldowns(u.cooldowns) }
        : u),
  };
}
