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
export type SignalType = 'garde_encaissee' | 'tir_reserve' | 'rale';
export interface Signal {
  type: SignalType;
  sourceId: string;    // la pièce alliée qui émet (Lourde en garde ; Tireur dont l'OW part ; défunt pour 'rale')
  attackerId?: string; // l'ennemi ciblé par les effets offensifs ; ABSENT pour 'rale'
  sourceUnit?: Unit;   // snapshot du défunt (signal 'rale' uniquement, car il est retiré du plateau)
}
export type Scope = { radius: number } | { squad: true };
export interface ReactionSpec {
  id: string;                              // identifiant du passif (clé de cooldown)
  on: SignalType;                          // type de signal écouté
  scope: Scope;                            // portée : rayon autour de la source, ou toute l'escouade
  cooldown: number;                        // en tours du possesseur (0 = sans CD)
  kind: 'epines' | 'marquage' | 'estropier' | 'provocation' | 'vendetta' | 'ralliement' | 'etourdir' | 'ruee'; // effet (le moteur dispatch dessus)
  amount?: number;                         // valeur par défaut de l'effet
  duration?: number;                       // durée d'un effet PERSISTANT (ex. marquage), en tours du possesseur
  amountBySource?: Record<string, number>;    // override selon l'ARCHÉTYPE de la source (Unit.kind)
  amountByCharacter?: Record<string, number>; // override selon le HÉROS de la source (Unit.characterId) — plus spécifique
  fromKind?: string;      // ne réagit QU'À une source de cet archétype (duo par classe)
  fromCharacter?: string; // ne réagit QU'À une source = ce héros précis (duo par personnage) — « un duo = sa Résonance »
}
/**
 * Statut « marqué » posé sur un ennemi par un allié (ex. Estoc, via la Résonance avec Mireille).
 * Seul le marqueur (`by`) gagne le bonus, sur son PREMIER coup contre la cible (puis la marque
 * tombe). Disparaît après `expiresIn` tours du marqueur si elle n'a pas été consommée.
 */
export interface Mark {
  by: string;        // unité qui a posé la marque (seul ce marqueur profite du bonus)
  owner: string;     // camp du marqueur (sert le décompte d'expiration)
  bonus: number;     // dégâts ajoutés au 1er coup du marqueur sur la cible
  expiresIn: number; // tours du marqueur restants avant disparition
}

/**
 * Statut « estropié » : malus de DÉPLACEMENT subi par une pièce (ex. l'attaquant d'un allié en
 * garde, via Estoc × Rempart). Réduit la portée de mouvement de `amount` SANS toucher aux attaques.
 * Décompté en tours de la pièce touchée (`owner`), disparaît à `expiresIn` 0.
 */
export interface Cripple {
  amount: number;    // pas de déplacement en moins (les attaques ne sont pas affectées)
  owner: string;     // camp de la pièce touchée (sert le décompte d'expiration)
  expiresIn: number; // tours de la pièce touchée restants avant disparition
}

/** Une réaction prête à partir, résolue depuis un signal (sert résolution ET prévisualisation). */
export interface PendingReaction {
  listenerId: string;
  spec: ReactionSpec;
  sourceId: string;     // l'allié qui a émis le signal (cible des effets de SOUTIEN, ex. vendetta)
  sourceHex: HexId;     // case de la source (cible des effets de déplacement vers elle, ex. ralliement)
  targetId: string;     // l'ennemi visé (cible des effets OFFENSIFS : épines, marquage, estropie, provocation)
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
  mark?: Mark;                         // statut « marqué » subi (posé par un allié adverse, ex. Estoc)
  cripple?: Cripple;                   // statut « estropié » subi : malus de déplacement (ex. Estoc × Rempart)
  vendetta?: number;                   // bonus de dégâts en attente sur SA prochaine attaque (ex. Fil × Bastion)
  block?: { owner: string; expiresIn: number }; // immunité TOTALE aux dégâts, bornée (ex. Fil × Mireille)
  stunCharge?: { owner: string; expiresIn: number; stun: number }; // « Coup étourdissant » armé : SA prochaine attaque étourdit `stun` tour(s) (ex. Fil × Rempart)
  stun?: { owner: string; expiresIn: number };  // étourdi : PA forcés à 0 + Résonances silencées tant qu'actif
  lastHitBy?: string;                  // qui a infligé les DERNIERS dégâts → attribution du kill (Némésis, primes…)
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

/**
 * Pas de déplacement disponibles pour une pièce : ses PA, moins l'éventuel malus « estropié »
 * (plancher 0). Les attaques restent payées sur les PA pleins — seul le mouvement est bridé.
 */
export function moveBudget(unit: Unit): number {
  return Math.max(0, unit.ap - (unit.cripple?.amount ?? 0));
}

/** Déplace une pièce du camp actif vers `dest` si atteignable ; déduit la distance de SES PA. */
export function moveUnit(state: CombatState, unitId: string, dest: HexId): CombatState {
  const unit = unitById(state, unitId);
  if (!unit || unit.owner !== state.active) return state;
  const d = reachable(state, unitId, moveBudget(unit)).get(dest);
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

/** Dégâts effectivement subis par `target` : 0 si « bloqué » (immunité), sinon réduits si en garde. */
export function damageTaken(target: Unit, raw: number): number {
  if (target.block) return 0;
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
  const target0 = unitById(state, targetId)!;
  // Marque : si la cible portait une marque DE CET attaquant, son 1er coup gagne le bonus, puis tombe.
  const marked = !!target0.mark && target0.mark.by === attackerId;
  // Bonus de dégâts : marque (sur cette cible) + vendetta en attente (sur SON attaque) ; consommés.
  const raw = attacker.damage + (marked ? target0.mark!.bonus : 0) + (attacker.vendetta ?? 0);
  const stunning = attacker.stunCharge; // « Coup étourdissant » : consommé, étourdit la cible
  // 1) Le coup porté : l'attaquant dépense ses PA, la cible encaisse (réduit si en garde).
  let units = state.units.map((u) => {
    if (u.id === attackerId) return { ...u, ap: u.ap - attacker.attackCost, ...(attacker.vendetta ? { vendetta: undefined } : {}), ...(stunning ? { stunCharge: undefined } : {}) };
    if (u.id === targetId) {
      const dealt = damageTaken(u, raw);
      return { ...u, hp: u.hp - dealt, ...(marked ? { mark: undefined } : {}), ...(stunning ? { stun: { owner: u.owner, expiresIn: stunning.stun } } : {}), ...(dealt > 0 ? { lastHitBy: attackerId } : {}) };
    }
    return u;
  });
  // 2) La riposte : seulement si la cible survit, était armée, et l'attaquant est à sa portée.
  const tgt = units.find((u) => u.id === targetId)!;
  if (tgt.hp > 0 && tgt.riposting && graphDistance(state.map, tgt.hex, attacker.hex) <= tgt.range) {
    const back = damageTaken(attacker, tgt.damage);
    units = units.map((u) => {
      if (u.id === targetId) return { ...u, riposting: false };
      if (u.id === attackerId) return { ...u, hp: u.hp - back, ...(back > 0 ? { lastHitBy: targetId } : {}) };
      return u;
    });
  }
  // On ne retire PAS les morts ici : `reap` centralise le retrait + l'émission du signal `rale`.
  const absorber = units.find((u) => u.id === targetId);
  const signal: Signal | null =
    absorber && absorber.hp > 0 && absorber.guarding && absorber.guard
      ? { type: 'garde_encaissee', sourceId: targetId, attackerId }
      : null;
  return { state: { ...state, units }, signal };
}

/**
 * `attackerId` attaque `targetId` : la frappe (coup réduit si la cible est en garde + riposte
 * éventuelle), PUIS les RÉACTIONS EN CHAÎNE — si la cible a encaissé en garde, elle émet un
 * signal que ses alliés relaient (voir `resolveReactions`). Sans effet si l'attaque est illégale.
 */
export function attack(state: CombatState, attackerId: string, targetId: string): CombatState {
  if (!canAttack(state, attackerId, targetId)) return state;
  const { state: s0, signal } = strike(state, attackerId, targetId);
  const s1 = reap(s0);                                     // morts du coup (+ riposte) → signal `rale`
  const s2 = signal ? resolveReactions(s1, signal) : s1;   // cascade garde (épines…)
  return reap(s2);                                         // morts des réactions → signal `rale`
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

// Effets OFFENSIFS : ils visent un ennemi (`targetId`) → ne partent pas si la cible a disparu.
// (Les effets de soutien/soi — `vendetta`, `ralliement` — n'ont pas besoin de cible.)
const NEEDS_TARGET = new Set<ReactionSpec['kind']>(['epines', 'marquage', 'estropier', 'provocation', 'ruee']);

/**
 * Retrait CENTRALISÉ des pièces mortes (hp ≤ 0). Pour CHAQUE mort, fait émettre le signal `rale`
 * (résolu sur l'état déjà nettoyé, avec un snapshot du défunt) → permet les Résonances « à la mort »
 * (ex. Fil × Mireille). Boucle si des réactions provoquent de nouvelles morts (borne `REACTION_CHAIN_CAP`).
 * Conçu « revival-ready » : la mort devient un événement de 1ʳᵉ classe (un futur cimetière n'a qu'à
 * consommer la liste des défunts ici).
 */
function reap(state: CombatState): CombatState {
  let s = state;
  for (let guard = 0; guard < REACTION_CHAIN_CAP; guard++) {
    const dead = s.units.filter((u) => u.hp <= 0);
    if (!dead.length) return s;
    s = { ...s, units: s.units.filter((u) => u.hp > 0) };
    for (const d of dead) s = resolveReactions(s, { type: 'rale', sourceId: d.id, sourceUnit: d });
  }
  return s;
}

function inScope(map: GameMap, source: Unit, listener: Unit, scope: Scope): boolean {
  return 'squad' in scope ? true : graphDistance(map, source.hex, listener.hex) <= scope.radius;
}

/**
 * Un pas de déplacement forcé : le voisin LIBRE de `from` strictement plus proche de `toward`,
 * départage déterministe (distance puis id). `undefined` si aucun (déjà au contact / encerclé).
 * Agnostique à la forme (ne lit que `neighbors` + `graphDistance`). Sert provocation ET ruée.
 */
function stepToward(map: GameMap, from: HexId, toward: HexId, occupied: Set<HexId>): HexId | undefined {
  const byId = new Map(map.hexes.map((h) => [h.id, h] as const));
  const cur = graphDistance(map, from, toward);
  return (byId.get(from)?.neighbors ?? [])
    .filter((nb) => !occupied.has(nb))
    .map((nb) => ({ nb, d: graphDistance(map, nb, toward) }))
    .filter((c) => c.d < cur)
    .sort((a, b) => a.d - b.d || (a.nb < b.nb ? -1 : 1))[0]?.nb;
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
  const source = signal.sourceUnit ?? unitById(state, signal.sourceId); // snapshot pour `rale` (défunt retiré)
  if (!source) return [];
  const target = signal.attackerId ? unitById(state, signal.attackerId) : undefined;
  const out: PendingReaction[] = [];
  for (const u of state.units) {
    if (u.hp <= 0) continue;                                       // morts en attente de retrait : ignorés
    if ((u.stun?.expiresIn ?? 0) > 0) continue;                    // étourdi : ne réagit à rien
    if (u.owner !== source.owner || u.id === source.id) continue;  // synergies alliées (pas soi)
    for (const spec of u.reactions ?? []) {
      if (spec.on !== signal.type) continue;
      if (NEEDS_TARGET.has(spec.kind) && !target) continue;        // effet offensif sans cible → ne part pas
      if (spec.fromCharacter !== undefined && source.characterId !== spec.fromCharacter) continue; // duo gâté au héros
      if (spec.fromKind !== undefined && source.kind !== spec.fromKind) continue;                  // duo gâté à la classe
      if (fired.has(`${u.id}:${spec.id}`)) continue;
      if ((u.cooldowns?.[spec.id] ?? 0) > 0) continue;
      if (!inScope(state.map, source, u, spec.scope)) continue;
      out.push({ listenerId: u.id, spec, sourceId: source.id, sourceHex: source.hex, targetId: target?.id ?? '', amount: reactionAmount(spec, source) });
    }
  }
  return out;
}

/** Applique une réaction (pur) : pose son cooldown sur l'écouteur puis joue son effet. */
function applyReaction(state: CombatState, p: PendingReaction): CombatState {
  if (!unitById(state, p.listenerId)) return state;
  const arm = (u: Unit): Unit => ({ ...u, cooldowns: { ...(u.cooldowns ?? {}), [p.spec.id]: p.spec.cooldown } });
  switch (p.spec.kind) {
    case 'epines': { // relaie des dégâts sur l'attaquant (réduits s'il est en garde) ; `reap` nettoiera
      const target = unitById(state, p.targetId);
      const dmg = target ? damageTaken(target, p.amount) : 0;
      const units = state.units.map((u) => {
        if (u.id === p.listenerId) return arm(u);
        if (target && u.id === p.targetId) return { ...u, hp: u.hp - dmg, ...(dmg > 0 ? { lastHitBy: p.listenerId } : {}) };
        return u;
      });
      return { ...state, units };
    }
    case 'ralliement': { // SOUTIEN : se téléporte sur la case du défunt + immunité TOTALE (block) bornée
      const units = state.units.map((u) => {
        if (u.id !== p.listenerId) return u;
        return { ...arm(u), hex: p.sourceHex, block: { owner: u.owner, expiresIn: p.spec.duration ?? 1 } };
      });
      return { ...state, units };
    }
    case 'marquage': { // pose une marque sur l'ennemi : +bonus au 1er coup du possesseur, durée bornée
      const listener = unitById(state, p.listenerId)!;
      const units = state.units.map((u) => {
        if (u.id === p.listenerId) return arm(u);
        if (u.id === p.targetId)
          return { ...u, mark: { by: p.listenerId, owner: listener.owner, bonus: p.amount, expiresIn: p.spec.duration ?? 2 } };
        return u;
      });
      return { ...state, units };
    }
    case 'estropier': { // bride le déplacement de l'ennemi pendant `duration` de SES tours
      const target = unitById(state, p.targetId);
      if (!target) return state;
      const units = state.units.map((u) => {
        if (u.id === p.listenerId) return arm(u);
        if (u.id === p.targetId)
          return { ...u, cripple: { amount: p.amount, owner: target.owner, expiresIn: p.spec.duration ?? 2 } };
        return u;
      });
      return { ...state, units };
    }
    case 'vendetta': { // SOUTIEN : buffe l'allié SOURCE (ex. Bastion) → +amount à sa prochaine attaque
      const units = state.units.map((u) => {
        if (u.id === p.listenerId) return arm(u);
        if (u.id === p.sourceId) return { ...u, vendetta: p.amount };
        return u;
      });
      return { ...state, units };
    }
    case 'etourdir': { // SOUTIEN : arme l'allié SOURCE (ex. Rempart) → sa prochaine attaque étourdit `amount` tour(s)
      const source = unitById(state, p.sourceId);
      if (!source) return state;
      const units = state.units.map((u) => {
        if (u.id === p.listenerId) return arm(u);
        if (u.id === p.sourceId) return { ...u, stunCharge: { owner: source.owner, expiresIn: p.spec.duration ?? 3, stun: p.amount } };
        return u;
      });
      return { ...state, units };
    }
    case 'provocation': { // tire la CIBLE d'1 case vers le possesseur (déplacement forcé) ; CD posé même sans case libre
      const listener = unitById(state, p.listenerId);
      const target = unitById(state, p.targetId);
      if (!listener || !target) return state;
      const occupied = new Set(state.units.map((u) => u.hex)); // toutes les pièces sont des obstacles
      const dest = stepToward(state.map, target.hex, listener.hex, occupied);
      const units = state.units.map((u) => {
        if (u.id === p.listenerId) return arm(u);
        if (dest && u.id === p.targetId) return { ...u, hex: dest };
        return u;
      });
      return { ...state, units };
    }
    case 'ruee': { // le POSSESSEUR avance d'1 case VERS la cible (inverse de la provocation) ; CD posé même sans case libre
      const listener = unitById(state, p.listenerId);
      const target = unitById(state, p.targetId);
      if (!listener || !target) return state;
      const occupied = new Set(state.units.map((u) => u.hex));
      const dest = stepToward(state.map, listener.hex, target.hex, occupied);
      const units = state.units.map((u) =>
        u.id === p.listenerId ? (dest ? { ...arm(u), hex: dest } : arm(u)) : u);
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
  let s = state;
  for (const w of state.units) {
    const watcher = unitById(s, w.id);
    const mover = unitById(s, movedUnitId);
    if (!watcher || !mover) break; // plus de tireur ou cible déjà abattue
    if (!watcher.watching || watcher.owner === mover.owner) continue;
    if (graphDistance(s.map, watcher.hex, mover.hex) > watcher.range) continue;
    const dmg = damageTaken(mover, watcher.damage);
    const units = s.units.map((u) => {
      if (u.id === watcher.id) return { ...u, watching: false };
      if (u.id === movedUnitId) return { ...u, hp: u.hp - dmg, ...(dmg > 0 ? { lastHitBy: watcher.id } : {}) };
      return u;
    });
    s = reap({ ...s, units }); // retire le mover s'il meurt (+ signal `rale`)
    // Le tir réservé est parti : si la cible survit, les réactions (ex. marquage/provocation) se résolvent.
    if (unitById(s, movedUnitId)) {
      s = reap(resolveReactions(s, { type: 'tir_reserve', sourceId: watcher.id, attackerId: movedUnitId }));
    }
  }
  return s;
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
 * Vieillit un statut borné (marque, estropie…) au tour QUI S'ACHÈVE : on ne décompte qu'à la fin
 * du tour de SON `owner` → le statut tient pendant `expiresIn` tours pleins de cet owner. Renvoie
 * `undefined` quand il expire (à 0).
 */
function tickStatus<T extends { owner: string; expiresIn: number }>(st: T | undefined, endingOwner: string): T | undefined {
  if (!st || st.owner !== endingOwner) return st;
  const left = st.expiresIn - 1;
  return left > 0 ? { ...st, expiresIn: left } : undefined;
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
    units: state.units.map((u) => {
      const mark = tickStatus(u.mark, state.active);       // le tour de `state.active` s'achève
      const cripple = tickStatus(u.cripple, state.active);
      const block = tickStatus(u.block, state.active);
      const stun = tickStatus(u.stun, state.active);
      const stunCharge = tickStatus(u.stunCharge, state.active);
      let out =
        u.owner === next
          // recharge SES PA — sauf si elle est étourdie : ce tour-là, PA forcés à 0 (gel total).
          ? { ...u, ap: (u.stun?.expiresIn ?? 0) > 0 ? 0 : apPerTurn, guarding: false, watching: false, riposting: false, cooldowns: tickCooldowns(u.cooldowns) }
          : u;
      if (mark !== u.mark) out = { ...out, mark };
      if (cripple !== u.cripple) out = { ...out, cripple };
      if (block !== u.block) out = { ...out, block };
      if (stun !== u.stun) out = { ...out, stun };
      if (stunCharge !== u.stunCharge) out = { ...out, stunCharge };
      return out;
    }),
  };
}
