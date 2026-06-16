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

/**
 * Résonance DUO « Estoc × Bastion » — un duo = sa propre Résonance (gâtée à la source par
 * `fromCharacter`). Quand Bastion (en garde, rayon 2) encaisse, Estoc pince l'attaquant pour 2.
 * Ne se déclenche QUE pour Bastion (`bastion`), pas un tank quelconque. CD 2 tours.
 */
const EPINES_ESTOC_BASTION: ReactionSpec = {
  id: 'epines_estoc_bastion', on: 'garde_encaissee', fromCharacter: 'bastion',
  scope: { radius: 2 }, cooldown: 2, kind: 'epines', amount: 2,
};

/**
 * Résonance DUO « Estoc × Mireille » — quand le Tir Réservé de Mireille (`mireille`) part, Estoc
 * MARQUE la cible touchée : son 1er coup sur elle gagne +1 dégât. La marque dure 2 tours d'Estoc
 * (sinon s'efface), et la Résonance passe en CD 2. Portée `escouade` (toute l'équipe) : Mireille
 * tire de loin et Estoc est au contact → ils ne seront quasiment jamais à portée l'un de l'autre.
 */
const MARQUAGE_ESTOC_MIREILLE: ReactionSpec = {
  id: 'marquage_estoc_mireille', on: 'tir_reserve', fromCharacter: 'mireille',
  scope: { squad: true }, cooldown: 2, kind: 'marquage', amount: 1, duration: 2,
};

/**
 * Résonance DUO « Estoc × Rempart » — si Estoc est à portée 2 de Rempart quand celui-ci (en garde)
 * encaisse, Estoc ESTROPIE l'attaquant : −2 en déplacement. `duration: 3` = le reste de son tour
 * courant + ses 2 tours pleins suivants (l'estropie est posée pendant SON tour). CD 2 tours.
 */
const ESTROPIER_ESTOC_REMPART: ReactionSpec = {
  id: 'estropier_estoc_rempart', on: 'garde_encaissee', fromCharacter: 'rempart',
  scope: { radius: 2 }, cooldown: 2, kind: 'estropier', amount: 2, duration: 3,
};

/**
 * Résonance DUO « Estoc × Orso » — quand le Tir Réservé d'Orso (`orso`) part, Estoc PROVOQUE la
 * cible touchée : elle est tirée d'1 case VERS Estoc (déplacement forcé). Portée `escouade` (Orso
 * tire de loin). CD 2 (= 1 tour plein réel). Le CD est posé même si la cible ne peut pas bouger.
 */
const PROVOCATION_ESTOC_ORSO: ReactionSpec = {
  id: 'provocation_estoc_orso', on: 'tir_reserve', fromCharacter: 'orso',
  scope: { squad: true }, cooldown: 2, kind: 'provocation', amount: 1,
};

/**
 * Résonance générique (provisoire) de Fil, en attendant son propre façonnage : tout allié en
 * garde (rayon 2) qui encaisse → Fil pince l'attaquant (Lourde → 2, défaut 1). CD 2 tours.
 */
const EPINES_RELAYEES: ReactionSpec = {
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
 * VIVIER PLAT : un pool commun de héros uniques, découplé des camps. N'importe quel héros peut être
 * assigné à n'importe quel camp au déploiement (cf. line-up dans CombatView). Ids = noms neutres.
 * NOMS = PLACEHOLDERS provisoires. Le draft (qui choisit quoi) reste une couche au-dessus, ajournée.
 */
export const CHARACTERS: Record<string, Character> = {
  bastion: { id: 'bastion', name: 'Bastion', archetype: 'lourde' },
  mireille: { id: 'mireille', name: 'Mireille', archetype: 'tireur' },
  estoc:   { id: 'estoc',   name: 'Estoc',   archetype: 'duelliste', reactions: [EPINES_ESTOC_BASTION, MARQUAGE_ESTOC_MIREILLE, ESTROPIER_ESTOC_REMPART, PROVOCATION_ESTOC_ORSO] },
  rempart: { id: 'rempart', name: 'Rempart', archetype: 'lourde' },
  orso:    { id: 'orso',    name: 'Orso',    archetype: 'tireur' },
  fil:     { id: 'fil',     name: 'Fil',     archetype: 'duelliste', reactions: [EPINES_RELAYEES] },
};

/** Calque d'un personnage par-dessus le socle de classe (nom, stats, Résonances signature). */
export interface Overlay {
  id?: string;                // identité héros stable, reportée sur `Unit.characterId`
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
    characterId: overlay?.id,
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
