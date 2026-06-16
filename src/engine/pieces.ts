// PROFILS DE PIÈCES — la « ligne de calibrage » de l'escouade (esprit échecs).
//
// Une pièce est définie par UN seul paramètre : son palier de PORTÉE r ∈ {1,2,3,4}.
// On pose t = 5 − r (palier de robustesse/puissance) → portée + robustesse = 5.
//   - courte portée  (r=1, t=4) ⇒ beaucoup de PV, gros dégâts, mais doit s'approcher ;
//   - longue portée  (r=4, t=1) ⇒ fragile, dégâts qui grattent, mais frappe à l'abri.
// Tous les archétypes vivent sur cette même droite : aucun n'est strictement meilleur,
// tout est positionnel. Les valeurs ci-dessous sont des LEVIERS, à affiner au jeu.

import type { GuardProfile, OverwatchProfile, RiposteProfile, ReactionSpec, Unit } from './combat';

export interface Profile {
  range: number;      // portée d'attaque (cases)
  maxHp: number;      // PV
  damage: number;     // dégâts par coup
  attackCost: number; // coût en PA d'une attaque
}

/** Dérive un profil du seul palier de portée (ton calibrage : portée + robustesse = 5). */
export function profileFor(rangeTier: number): Profile {
  const t = 5 - rangeTier; // palier de robustesse/puissance
  return { range: rangeTier, maxHp: 4 + t * 3, damage: 1 + t, attackCost: 2 };
}

export interface Archetype {
  key: string;
  name: string;
  glyph: string;     // marqueur affiché sur la pièce
  rangeTier: number; // position sur la droite de calibrage
  profile?: Partial<Profile>;   // override des stats dérivées — pour les pièces HORS-DROITE (ex. Duelliste)
  guard?: GuardProfile;         // verbe « se défendre » — propre aux CAC ; nombres par perso
  overwatch?: OverwatchProfile; // verbe « tir réservé » — propre aux pièces à distance
  riposte?: RiposteProfile;     // verbe « riposte » — atypique (Duelliste) ; contre en mêlée
  reactions?: ReactionSpec[];   // passifs en chaîne (synergies d'escouade) ; déclenchés par signaux
}

/**
 * Le registre des archétypes. On déploie d'abord la PAIRE POLAIRE ;
 * les exotiques (2/3, 3/2) restent prêts à brancher mais ne sont pas placés.
 */
export const ARCHETYPES: Record<string, Archetype> = {
  // La Lourde (CAC) sait se garder : 3 PA (→ pas d'attaque le même tour) pour ×0.5 dégâts subis.
  lourde: { key: 'lourde', name: 'Lourde', glyph: 'L', rangeTier: 1, guard: { cost: 3, damageTakenMul: 0.5 } }, // 1/4 — mêlée-tank
  // Le Tireur (distance) réserve son tir : 3 PA (→ pas d'attaque le même tour) pour un réflexe.
  tireur: { key: 'tireur', name: 'Tireur', glyph: 'T', rangeTier: 4, overwatch: { cost: 3 } }, // 4/1 — distance-verre
  // Le Duelliste : pièce HORS-DROITE. Mêlée (portée 1) mais fragile et qui gratte (PV 9, dégâts 2),
  // en échange d'une attaque à 1 PA → frappe deux fois par tour. Verbe atypique : Riposte (2 PA →
  // contre tout attaquant adjacent jusqu'au prochain coup). Escarmouche/harcèlement.
  // (Ses Résonances sont portées au niveau PERSONNAGE — voir CHARACTERS — pas au niveau classe.)
  duelliste: {
    key: 'duelliste', name: 'Duelliste', glyph: 'D', rangeTier: 1,
    profile: { maxHp: 9, damage: 2, attackCost: 1 },
    riposte: { cost: 2 },
  },
  // Exotiques (réserve, sur la même droite) :
  // hallebardier: { key:'hallebardier', name:'Hallebardier', glyph:'H', rangeTier:2 }, // 2/3
  // eclaireur:    { key:'eclaireur',    name:'Éclaireur',    glyph:'É', rangeTier:3 }, // 3/2
};

// ─────────────────────── Personnages (couche héros) ──────────────────────────
//
// Un PERSONNAGE = un archétype (socle : calibrage, verbes, Résonances de classe) + un calque
// PERSO : nom, override de stats éventuel, et surtout sa Résonance SIGNATURE. La signature
// fusionne avec le socle de classe PAR `id` (elle l'étend ou l'écrase). Les deux camps alignent
// des héros DISTINCTS (noms propres) mais aux stats MIROIR → équité préservée (esprit échecs).

/** Résonance signature partagée par les deux Duellistes (mêmes nombres → miroir équitable). */
const EPINES_RELAYEES: ReactionSpec = {
  // Quand un allié en garde (rayon 2) ENCAISSE un coup, le Duelliste pince l'attaquant —
  // dégâts selon la SOURCE (Lourde → 2, défaut 1). Première cellule de la matrice ; CD 2 tours.
  id: 'epines_relayees', on: 'garde_encaissee', scope: { radius: 2 }, cooldown: 2,
  kind: 'epines', amount: 1, amountBySource: { lourde: 2 },
};

export interface Character {
  id: string;                 // identifiant unique du héros
  name: string;               // nom affiché (identité)
  archetype: string;          // clé dans ARCHETYPES (socle)
  profile?: Partial<Profile>; // override de stats perso (rare ; mêmes règles que le hook de classe)
  reactions?: ReactionSpec[]; // Résonances SIGNATURE du personnage
}

/**
 * Le registre des héros déployés. NOMS = PLACEHOLDERS provisoires (modifiables en une string).
 * Stats miroir entre camps ; seuls les noms (et, plus tard, des signatures) diffèrent.
 */
export const CHARACTERS: Record<string, Character> = {
  // Camp A (Alice)
  a_lourde:    { id: 'a_lourde',    name: 'Bastion', archetype: 'lourde' },
  a_tireur:    { id: 'a_tireur',    name: 'Mireille', archetype: 'tireur' },
  a_duelliste: { id: 'a_duelliste', name: 'Estoc', archetype: 'duelliste', reactions: [EPINES_RELAYEES] },
  // Camp B (Bob)
  b_lourde:    { id: 'b_lourde',    name: 'Rempart', archetype: 'lourde' },
  b_tireur:    { id: 'b_tireur',    name: 'Orso', archetype: 'tireur' },
  b_duelliste: { id: 'b_duelliste', name: 'Fil', archetype: 'duelliste', reactions: [EPINES_RELAYEES] },
};

/** Calque d'un personnage par-dessus le socle de classe (nom, stats, Résonances signature). */
export interface Overlay {
  name?: string;
  profile?: Partial<Profile>;
  reactions?: ReactionSpec[];
}

/** Fusionne socle de classe + signature perso PAR `id` (la signature étend ou écrase le socle). */
function mergeReactions(base?: ReactionSpec[], extra?: ReactionSpec[]): ReactionSpec[] | undefined {
  if (!base?.length && !extra?.length) return undefined;
  const byId = new Map<string, ReactionSpec>();
  for (const r of base ?? []) byId.set(r.id, r);
  for (const r of extra ?? []) byId.set(r.id, r);
  return [...byId.values()];
}

/**
 * Fabrique une pièce d'un archétype, à pleine vie et avec `ap` points d'action. Un `overlay`
 * (personnage) peut surcharger nom/stats et apporter des Résonances signature (cf. `makeUnitFromCharacter`).
 */
export function makeUnit(id: string, owner: string, hex: string, archetype: Archetype, ap: number, overlay?: Overlay): Unit {
  // Stats : droite → override de classe (hors-droite) → override perso.
  const p = { ...profileFor(archetype.rangeTier), ...archetype.profile, ...overlay?.profile };
  return {
    id, owner, hex, ap,
    name: overlay?.name,
    hp: p.maxHp, maxHp: p.maxHp,
    range: p.range, damage: p.damage, attackCost: p.attackCost,
    kind: archetype.key,
    guard: archetype.guard, guarding: false,
    overwatch: archetype.overwatch, watching: false,
    riposte: archetype.riposte, riposting: false,
    reactions: mergeReactions(archetype.reactions, overlay?.reactions), cooldowns: {},
  };
}

/** Déploie un PERSONNAGE : résout son archétype et applique son calque (nom, stats, signature). */
export function makeUnitFromCharacter(pieceId: string, owner: string, hex: string, character: Character, ap: number): Unit {
  const archetype = ARCHETYPES[character.archetype];
  if (!archetype) throw new Error(`Archétype inconnu : ${character.archetype}`);
  return makeUnit(pieceId, owner, hex, archetype, ap, character);
}
