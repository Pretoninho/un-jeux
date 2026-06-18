// PROFILS DE PIÈCES — la « ligne de calibrage » de l'escouade (esprit échecs).
//
// Une pièce est définie par UN seul paramètre : son palier de PORTÉE r ∈ {1,2,3,4}.
// On pose t = 5 − r (palier de robustesse/puissance) → portée + robustesse = 5.
//   - courte portée  (r=1, t=4) ⇒ beaucoup de PV, gros dégâts, mais doit s'approcher ;
//   - longue portée  (r=4, t=1) ⇒ fragile, dégâts qui grattent, mais frappe à l'abri.
// Tous les archétypes vivent sur cette même droite : aucun n'est strictement meilleur,
// tout est positionnel. Les valeurs ci-dessous sont des LEVIERS, à affiner au jeu.

import type { GuardProfile, OverwatchProfile, RiposteProfile, HealProfile, ReactionSpec, Unit } from './combat';

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
  moveCap?: number;  // plafond de pas/tour (axe MOBILITÉ, indépendant de la droite) — ex. Lourde lente
  profile?: Partial<Profile>;   // override des stats dérivées — pour les pièces HORS-DROITE (ex. Duelliste)
  guard?: GuardProfile;         // verbe « se défendre » — propre aux CAC ; nombres par perso
  overwatch?: OverwatchProfile; // verbe « tir réservé » — propre aux pièces à distance
  riposte?: RiposteProfile;     // verbe « riposte » — atypique (Duelliste) ; contre en mêlée
  heal?: HealProfile;           // verbe « soigner » — propre au Soigneur ; soin pur d'un allié
  reactions?: ReactionSpec[];   // passifs en chaîne (synergies d'escouade) ; déclenchés par signaux
}

/**
 * Le registre des archétypes. On déploie d'abord la PAIRE POLAIRE ;
 * les exotiques (2/3, 3/2) restent prêts à brancher mais ne sont pas placés.
 */
export const ARCHETYPES: Record<string, Archetype> = {
  // La Lourde (CAC) sait se garder : 3 PA (→ pas d'attaque le même tour) pour ×0.5 dégâts subis.
  lourde: { key: 'lourde', name: 'Lourde', glyph: 'L', rangeTier: 1, moveCap: 3, guard: { cost: 3, damageTakenMul: 0.5 } }, // 1/4 — mêlée-tank, LENTE (3 pas/tour) → le Tireur peut kiter
  // Le Tireur (distance) réserve son tir : 3 PA (→ pas d'attaque le même tour) pour un réflexe.
  tireur: { key: 'tireur', name: 'Tireur', glyph: 'T', rangeTier: 4, moveCap: 4, overwatch: { cost: 3 } }, // 4/1 — distance-verre, 4 pas/tour
  // Le Duelliste : pièce HORS-DROITE. Mêlée (portée 1) mais fragile et qui gratte (PV 9, dégâts 2),
  // en échange d'une attaque à 1 PA → frappe deux fois par tour. Verbe atypique : Riposte (2 PA →
  // contre tout attaquant adjacent jusqu'au prochain coup). Escarmouche/harcèlement.
  // (Ses Résonances sont portées au niveau PERSONNAGE — voir CHARACTERS — pas au niveau classe.)
  duelliste: {
    key: 'duelliste', name: 'Duelliste', glyph: 'D', rangeTier: 1, moveCap: 4,
    profile: { maxHp: 9, damage: 2, attackCost: 1 },
    riposte: { cost: 2 },
  },
  // Le Soigneur (distance, support) : 4ᵉ archétype. Sur-droite tier 3 (portée 3 · PV 10 · dégâts 3),
  // `moveCap: 4`. Verbe SOIN : 3 PA → +4 PV à un allié à ≤2 cases (plafonné). IDENTITÉ DE RANGÉE =
  // PUR SOIN : son verbe et toutes ses Résonances ne font QUE soigner (jamais de contrôle/dégâts/buff).
  // EN RÉSERVE pour l'instant (présent dans le vivier, mais pas dans les SLOTS de l'escouade par défaut).
  soigneur: { key: 'soigneur', name: 'Soigneur', glyph: 'S', rangeTier: 3, moveCap: 4, heal: { cost: 3, amount: 4, range: 2 } },
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
 * Résonance DUO « Fil × Bastion » — quand Bastion (en garde, rayon 2) encaisse et que Fil est à
 * portée, Fil octroie à Bastion la VENDETTA : +2 à sa PROCHAINE attaque (garde sa rancune jusqu'à
 * frapper, pas d'expiration). 1ᵉʳ effet de SOUTIEN (buff d'un allié). CD 3 (= 2 tours pleins réels).
 */
const VENDETTA_FIL_BASTION: ReactionSpec = {
  id: 'vendetta_fil_bastion', on: 'garde_encaissee', fromCharacter: 'bastion',
  scope: { radius: 2 }, cooldown: 3, kind: 'vendetta', amount: 2,
};

/**
 * Résonance DUO « Fil × Mireille » — quand Mireille **meurt** (signal `rale`), Fil RALLIE : il se
 * téléporte sur sa case et reçoit `block` (immunité TOTALE aux dégâts) 4 tours (≈ 3 pleins). Portée
 * escouade. CD 3 (cosmétique pour un déclencheur de mort — Mireille ne meurt qu'une fois — mais prêt
 * si une réapparition arrive un jour). 1ᵉʳ signal de mort + 1ᵉʳ effet qui vise le possesseur.
 */
const RALLIEMENT_FIL_MIREILLE: ReactionSpec = {
  id: 'ralliement_fil_mireille', on: 'rale', fromCharacter: 'mireille',
  scope: { squad: true }, cooldown: 3, kind: 'ralliement', duration: 4,
};

/**
 * Résonance DUO « Fil × Rempart » — quand Rempart (en garde, rayon 2) encaisse et que Fil est à
 * portée, Fil arme un **COUP ÉTOURDISSANT** sur Rempart : sa PROCHAINE attaque ÉTOURDIT la cible
 * `amount` tour (PA à 0 + Résonances silencées). La charge dure `duration` tours puis se dissipe.
 * CD 3 (= 2 tours pleins). Effet à deux temps (charge puis stun).
 */
const ETOURDIR_FIL_REMPART: ReactionSpec = {
  id: 'etourdir_fil_rempart', on: 'garde_encaissee', fromCharacter: 'rempart',
  scope: { radius: 2 }, cooldown: 3, kind: 'etourdir', amount: 1, duration: 3,
};

/**
 * Résonance DUO « Fil × Orso » — INVERSE de la Provocation (Estoc × Orso) : quand le Tir Réservé
 * d'Orso part, **Fil avance d'1 case VERS la cible** touchée (gap-closer, déplacement forcé de soi).
 * Portée escouade. CD 2 (= 1 tour plein réel). CD posé même si Fil ne peut pas avancer.
 */
const RUEE_FIL_ORSO: ReactionSpec = {
  id: 'ruee_fil_orso', on: 'tir_reserve', fromCharacter: 'orso',
  scope: { squad: true }, cooldown: 2, kind: 'ruee', amount: 1,
};

/**
 * Résonance DUO « Mireille × Bastion » (1ᵉʳ Tireur-possesseur) — quand Bastion (en garde) encaisse,
 * Mireille **SILENCE** l'attaquant : il ne peut plus QUE se déplacer (ni attaque, ni verbe, ni
 * Résonance, ni élan Némésis). Portée escouade (Mireille tire de loin). `duration: 2` = immédiat +
 * son prochain tour plein. CD 3 (= 2 tours pleins).
 */
const SILENCE_MIREILLE_BASTION: ReactionSpec = {
  id: 'silence_mireille_bastion', on: 'garde_encaissee', fromCharacter: 'bastion',
  scope: { squad: true }, cooldown: 3, kind: 'silence', duration: 2,
};

/**
 * Résonance DUO « Mireille × Estoc » — 1ᵉʳ duo sur un signal de DUELLISTE. Quand la Riposte d'Estoc
 * part (signal `riposte`), Mireille la **soutient d'un tir** : 1 dégât sur l'attaquant (réutilise
 * `kind: 'epines'`). Portée escouade (Mireille tire de loin). Effet immédiat. CD 3 (= 2 tours pleins).
 */
const REPLIQUE_MIREILLE_ESTOC: ReactionSpec = {
  id: 'replique_mireille_estoc', on: 'riposte', fromCharacter: 'estoc',
  scope: { squad: true }, cooldown: 3, kind: 'epines', amount: 1,
};

/**
 * Résonance DUO « Mireille × Rempart » — quand Rempart (en garde) encaisse, Mireille entre en
 * COUVERTURE : +1 PA à chaque tour pendant 2 tours (soutien-soi, statut `Unit.cover` lu au
 * rechargement). « Le tank tient → Mireille opère plus librement. » Portée escouade. CD 3.
 */
const COUVERTURE_MIREILLE_REMPART: ReactionSpec = {
  id: 'couverture_mireille_rempart', on: 'garde_encaissee', fromCharacter: 'rempart',
  scope: { squad: true }, cooldown: 3, kind: 'couverture', amount: 1, duration: 2,
};

/**
 * Résonance DUO « Mireille × Fil » — quand la Riposte de Fil part, Mireille l'**APPUIE** (appui-feu) :
 * +1 dégât à ses attaques pendant 2 tours (soutien persistant sur l'allié source, `Unit.appui`).
 * Portée escouade. CD 3. Dort si Estoc est le Duelliste fieldé (1 Duelliste/escouade).
 */
const APPUI_MIREILLE_FIL: ReactionSpec = {
  id: 'appui_mireille_fil', on: 'riposte', fromCharacter: 'fil',
  scope: { squad: true }, cooldown: 3, kind: 'appui', amount: 1, duration: 2,
};

/**
 * Résonance DUO « Orso × Bastion » — 1ᵉʳ façonnage d'Orso, thème **CONTRÔLE du Tireur**. Quand Bastion
 * (en garde) encaisse, Orso **ENRACINE** l'attaquant (`kind: 'racine'`) : son déplacement tombe à **0**
 * (attaques/verbes intacts) — « silence de mobilité ». Posée pendant le tour de la cible → `duration: 2`
 * = reste collée ce tour-ci + tout son prochain tour plein. Portée escouade (Orso tire de loin). CD 3.
 * Contre direct de la mêlée : un bruiser qui frappe ta Lourde en garde se retrouve **cloué** → ton
 * Tireur kite, ton escouade focus/désengage.
 */
const RACINE_ORSO_BASTION: ReactionSpec = {
  id: 'racine_orso_bastion', on: 'garde_encaissee', fromCharacter: 'bastion',
  scope: { squad: true }, cooldown: 3, kind: 'racine', duration: 2,
};

/**
 * Résonance DUO « Bastion × Mireille » (1ᵉʳ façonnage de Bastion, thème **MOBILITÉ de la Lourde** —
 * 3ᵉ côté du triangle anti-mêlée). Quand le Tir réservé de Mireille part (signal `tir_reserve`),
 * Bastion gagne une **CHARGE** (`kind: 'charge'`, auto-buff) : +2 à son plafond de déplacement pendant
 * `duration: 1` (son prochain tour plein) → la Lourde lente (3) **s'engage à pleine vitesse** pour
 * profiter du contrôle de la Tireuse. Portée escouade (Mireille tire de loin). CD 3.
 */
const CHARGE_BASTION_MIREILLE: ReactionSpec = {
  id: 'charge_bastion_mireille', on: 'tir_reserve', fromCharacter: 'mireille',
  scope: { squad: true }, cooldown: 3, kind: 'charge', amount: 2, duration: 1,
};

// ── Rangée ORSO (Tireur) = CONTRÔLE : ralentir (`estropier`) / enraciner (`racine`) l'agresseur d'un allié.
/** « Orso × Rempart » — Rempart (en garde) encaisse → Orso ESTROPIE l'attaquant (−2 dépl., 3 tours). CD 2. */
const ESTROPIER_ORSO_REMPART: ReactionSpec = {
  id: 'estropier_orso_rempart', on: 'garde_encaissee', fromCharacter: 'rempart',
  scope: { squad: true }, cooldown: 2, kind: 'estropier', amount: 2, duration: 3,
};
/** « Orso × Estoc » — la Riposte d'Estoc part → Orso ESTROPIE l'attaquant (−1 dépl., léger). CD 2. */
const ESTROPIER_ORSO_ESTOC: ReactionSpec = {
  id: 'estropier_orso_estoc', on: 'riposte', fromCharacter: 'estoc',
  scope: { squad: true }, cooldown: 2, kind: 'estropier', amount: 1, duration: 2,
};
/** « Orso × Fil » — la Riposte de Fil part → Orso ENRACINE l'attaquant (dépl. → 0). CD 3. */
const RACINE_ORSO_FIL: ReactionSpec = {
  id: 'racine_orso_fil', on: 'riposte', fromCharacter: 'fil',
  scope: { squad: true }, cooldown: 3, kind: 'racine', duration: 2,
};

// ── Rangée BASTION (Lourde) = MOBILITÉ : se CHARGER quand un allié agit (kite/engage à pleine vitesse).
/** « Bastion × Orso » — le Tir réservé d'Orso part → Bastion se CHARGE (+2 dépl., 1 tour). CD 3. */
const CHARGE_BASTION_ORSO: ReactionSpec = {
  id: 'charge_bastion_orso', on: 'tir_reserve', fromCharacter: 'orso',
  scope: { squad: true }, cooldown: 3, kind: 'charge', amount: 2, duration: 1,
};
/** « Bastion × Estoc » — la Riposte d'Estoc part → Bastion se CHARGE (+2 dépl., 1 tour). CD 3. */
const CHARGE_BASTION_ESTOC: ReactionSpec = {
  id: 'charge_bastion_estoc', on: 'riposte', fromCharacter: 'estoc',
  scope: { squad: true }, cooldown: 3, kind: 'charge', amount: 2, duration: 1,
};
/** « Bastion × Fil » — la Riposte de Fil part → Bastion se CHARGE (+2 dépl., 1 tour). CD 3. */
const CHARGE_BASTION_FIL: ReactionSpec = {
  id: 'charge_bastion_fil', on: 'riposte', fromCharacter: 'fil',
  scope: { squad: true }, cooldown: 3, kind: 'charge', amount: 2, duration: 1,
};

// ── Rangée REMPART (Lourde) = MOBILITÉ, variante SOUTENUE : même `charge` que Bastion mais `duration: 2`
//    (Bastion = charge-éclair 1 tour ; Rempart = mobilité prolongée 2 tours) → deux Lourdes distinctes.
/** « Rempart × Mireille » — Tir réservé de Mireille → Rempart se CHARGE (+2 dépl., 2 tours). CD 3. */
const CHARGE_REMPART_MIREILLE: ReactionSpec = {
  id: 'charge_rempart_mireille', on: 'tir_reserve', fromCharacter: 'mireille',
  scope: { squad: true }, cooldown: 3, kind: 'charge', amount: 2, duration: 2,
};
/** « Rempart × Orso » — Tir réservé d'Orso → Rempart se CHARGE (+2 dépl., 2 tours). CD 3. */
const CHARGE_REMPART_ORSO: ReactionSpec = {
  id: 'charge_rempart_orso', on: 'tir_reserve', fromCharacter: 'orso',
  scope: { squad: true }, cooldown: 3, kind: 'charge', amount: 2, duration: 2,
};
/** « Rempart × Estoc » — Riposte d'Estoc → Rempart se CHARGE (+2 dépl., 2 tours). CD 3. */
const CHARGE_REMPART_ESTOC: ReactionSpec = {
  id: 'charge_rempart_estoc', on: 'riposte', fromCharacter: 'estoc',
  scope: { squad: true }, cooldown: 3, kind: 'charge', amount: 2, duration: 2,
};
/** « Rempart × Fil » — Riposte de Fil → Rempart se CHARGE (+2 dépl., 2 tours). CD 3. */
const CHARGE_REMPART_FIL: ReactionSpec = {
  id: 'charge_rempart_fil', on: 'riposte', fromCharacter: 'fil',
  scope: { squad: true }, cooldown: 3, kind: 'charge', amount: 2, duration: 2,
};

// ── Héros FLÈCHE (Tireur, thème « focus / exécution ») — fiche : docs/heros/fleche.md ──
/** « Flèche × Bastion » — Bastion (en garde) encaisse → Flèche MARQUE l'attaquant (+1 à son prochain tir). CD 2. */
const MARQUAGE_FLECHE_BASTION: ReactionSpec = {
  id: 'marquage_fleche_bastion', on: 'garde_encaissee', fromCharacter: 'bastion',
  scope: { squad: true }, cooldown: 2, kind: 'marquage', amount: 1, duration: 2,
};
/** « Bastion × Flèche » (réciprocité de l'arête) — Tir réservé de Flèche → Bastion se CHARGE (+2 dépl., 1 tour). CD 3. */
const CHARGE_BASTION_FLECHE: ReactionSpec = {
  id: 'charge_bastion_fleche', on: 'tir_reserve', fromCharacter: 'fleche',
  scope: { squad: true }, cooldown: 3, kind: 'charge', amount: 2, duration: 1,
};

// ── Rangée SOIGNEUR (support) = PUR SOIN (jamais de contrôle/dégâts). Signature des héros soigneurs. ──
/**
 * Résonance signature « Baume × Bastion » (1ᵉʳ Soigneur). Quand Bastion (en garde) encaisse, Baume lui
 * pose une RÉGÉNÉRATION (`kind: 'regen'`, soin réactif) : +2 PV au début de chacun de ses 2 prochains
 * tours, plafonné au maxHp. « Le tank encaisse, le médecin recolle. » Portée escouade, CD 3. Soin réactif
 * « court » (miroir thématique du burst de Bastion) — Mélisse portera la variante sustain plus longue.
 */
const REGEN_BAUME_BASTION: ReactionSpec = {
  id: 'regen_baume_bastion', on: 'garde_encaissee', fromCharacter: 'bastion',
  scope: { squad: true }, cooldown: 3, kind: 'regen', amount: 2, duration: 2,
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
  bastion: { id: 'bastion', name: 'Bastion', archetype: 'lourde', reactions: [CHARGE_BASTION_MIREILLE, CHARGE_BASTION_ORSO, CHARGE_BASTION_ESTOC, CHARGE_BASTION_FIL, CHARGE_BASTION_FLECHE] },
  mireille: { id: 'mireille', name: 'Mireille', archetype: 'tireur', reactions: [SILENCE_MIREILLE_BASTION, REPLIQUE_MIREILLE_ESTOC, COUVERTURE_MIREILLE_REMPART, APPUI_MIREILLE_FIL] },
  estoc:   { id: 'estoc',   name: 'Estoc',   archetype: 'duelliste', reactions: [EPINES_ESTOC_BASTION, MARQUAGE_ESTOC_MIREILLE, ESTROPIER_ESTOC_REMPART, PROVOCATION_ESTOC_ORSO] },
  rempart: { id: 'rempart', name: 'Rempart', archetype: 'lourde', reactions: [CHARGE_REMPART_MIREILLE, CHARGE_REMPART_ORSO, CHARGE_REMPART_ESTOC, CHARGE_REMPART_FIL] },
  orso:    { id: 'orso',    name: 'Orso',    archetype: 'tireur', reactions: [RACINE_ORSO_BASTION, ESTROPIER_ORSO_REMPART, ESTROPIER_ORSO_ESTOC, RACINE_ORSO_FIL] },
  fil:     { id: 'fil',     name: 'Fil',     archetype: 'duelliste', reactions: [VENDETTA_FIL_BASTION, RALLIEMENT_FIL_MIREILLE, ETOURDIR_FIL_REMPART, RUEE_FIL_ORSO] },
  fleche:  { id: 'fleche',  name: 'Flèche',  archetype: 'tireur', reactions: [MARQUAGE_FLECHE_BASTION] },
  baume:   { id: 'baume',   name: 'Baume',   archetype: 'soigneur', reactions: [REGEN_BAUME_BASTION] },
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
    moveCap: archetype.moveCap,
    range: p.range, damage: p.damage, attackCost: p.attackCost,
    kind: archetype.key,
    guard: archetype.guard, guarding: false,
    overwatch: archetype.overwatch, watching: false,
    riposte: archetype.riposte, riposting: false,
    heal: archetype.heal,
    reactions: mergeReactions(archetype.reactions, overlay?.reactions), cooldowns: {},
  };
}

/** Déploie un PERSONNAGE : résout son archétype et applique son calque (nom, stats, signature). */
export function makeUnitFromCharacter(pieceId: string, owner: string, hex: string, character: Character, ap: number): Unit {
  const archetype = ARCHETYPES[character.archetype];
  if (!archetype) throw new Error(`Archétype inconnu : ${character.archetype}`);
  return makeUnit(pieceId, owner, hex, archetype, ap, character);
}
