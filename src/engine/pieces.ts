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

// ════════════════ RÉSONANCES SIGNATURE — « UN POSSESSEUR = UN EFFET » ════════════════
// Modèle (décidé 2026-06-18) : chaque héros-possesseur porte UN SEUL effet, le même pour TOUS ses
// duos. Le partenaire ne change que le DÉCLENCHEUR (le signal qu'il émet : `garde_encaissee` = Lourde,
// `tir_reserve` = Tireur, `riposte` = Duelliste) ; l'effet, lui, EST l'identité du possesseur.
// `fromCharacter` gâte chaque arête au bon partenaire. On abandonne la variété par-duo au profit de
// la lisibilité : « Estoc = épines, Fil = vendetta, Mireille = silence, Orso = racine, Bastion/Rempart
// = charge, Flèche = marquage, Baume = régén ».

// ── ESTOC (Duelliste) = ÉPINES relayées (pince l'agresseur d'un allié pour 2). ──
/** « Estoc × Bastion » — Bastion (en garde) encaisse → Estoc pince l'attaquant (épines 2). CD 2. */
const EPINES_ESTOC_BASTION: ReactionSpec = {
  id: 'epines_estoc_bastion', on: 'garde_encaissee', fromCharacter: 'bastion',
  scope: { radius: 2 }, cooldown: 2, kind: 'epines', amount: 2,
};

/** « Estoc × Mireille » — Tir réservé de Mireille → Estoc pince l'agresseur (épines 2). CD 2. */
const EPINES_ESTOC_MIREILLE: ReactionSpec = {
  id: 'epines_estoc_mireille', on: 'tir_reserve', fromCharacter: 'mireille',
  scope: { squad: true }, cooldown: 2, kind: 'epines', amount: 2,
};

/** « Estoc × Rempart » — Rempart (en garde) encaisse → Estoc pince l'attaquant (épines 2). CD 2. */
const EPINES_ESTOC_REMPART: ReactionSpec = {
  id: 'epines_estoc_rempart', on: 'garde_encaissee', fromCharacter: 'rempart',
  scope: { radius: 2 }, cooldown: 2, kind: 'epines', amount: 2,
};

/** « Estoc × Orso » — Tir réservé d'Orso → Estoc pince la cible touchée (épines 2). CD 2. */
const EPINES_ESTOC_ORSO: ReactionSpec = {
  id: 'epines_estoc_orso', on: 'tir_reserve', fromCharacter: 'orso',
  scope: { squad: true }, cooldown: 2, kind: 'epines', amount: 2,
};

// ── FIL (Duelliste) = VENDETTA (buffe +2 la PROCHAINE attaque de l'allié qui vient d'agir). ──
/** « Fil × Bastion » — Bastion (en garde) encaisse → Fil lui octroie la vendetta (+2 prochaine att.). CD 3. */
const VENDETTA_FIL_BASTION: ReactionSpec = {
  id: 'vendetta_fil_bastion', on: 'garde_encaissee', fromCharacter: 'bastion',
  scope: { radius: 2 }, cooldown: 3, kind: 'vendetta', amount: 2,
};

/** « Fil × Mireille » — Tir réservé de Mireille → Fil lui octroie la vendetta (+2 prochaine att.). CD 3. */
const VENDETTA_FIL_MIREILLE: ReactionSpec = {
  id: 'vendetta_fil_mireille', on: 'tir_reserve', fromCharacter: 'mireille',
  scope: { squad: true }, cooldown: 3, kind: 'vendetta', amount: 2,
};

/** « Fil × Rempart » — Rempart (en garde) encaisse → Fil lui octroie la vendetta (+2 prochaine att.). CD 3. */
const VENDETTA_FIL_REMPART: ReactionSpec = {
  id: 'vendetta_fil_rempart', on: 'garde_encaissee', fromCharacter: 'rempart',
  scope: { radius: 2 }, cooldown: 3, kind: 'vendetta', amount: 2,
};

/** « Fil × Orso » — Tir réservé d'Orso → Fil lui octroie la vendetta (+2 prochaine att.). CD 3. */
const VENDETTA_FIL_ORSO: ReactionSpec = {
  id: 'vendetta_fil_orso', on: 'tir_reserve', fromCharacter: 'orso',
  scope: { squad: true }, cooldown: 3, kind: 'vendetta', amount: 2,
};

// ── MIREILLE (Tireur) = SILENCE (l'agresseur d'un allié ne peut plus QUE se déplacer, 2 tours). ──
/** « Mireille × Bastion » — Bastion (en garde) encaisse → Mireille silence l'attaquant (2 t.). CD 3. */
const SILENCE_MIREILLE_BASTION: ReactionSpec = {
  id: 'silence_mireille_bastion', on: 'garde_encaissee', fromCharacter: 'bastion',
  scope: { squad: true }, cooldown: 3, kind: 'silence', duration: 2,
};

/** « Mireille × Estoc » — Riposte d'Estoc → Mireille silence l'attaquant (2 t.). CD 3. */
const SILENCE_MIREILLE_ESTOC: ReactionSpec = {
  id: 'silence_mireille_estoc', on: 'riposte', fromCharacter: 'estoc',
  scope: { squad: true }, cooldown: 3, kind: 'silence', duration: 2,
};

/** « Mireille × Rempart » — Rempart (en garde) encaisse → Mireille silence l'attaquant (2 t.). CD 3. */
const SILENCE_MIREILLE_REMPART: ReactionSpec = {
  id: 'silence_mireille_rempart', on: 'garde_encaissee', fromCharacter: 'rempart',
  scope: { squad: true }, cooldown: 3, kind: 'silence', duration: 2,
};

/** « Mireille × Fil » — Riposte de Fil → Mireille silence l'attaquant (2 t.). CD 3. */
const SILENCE_MIREILLE_FIL: ReactionSpec = {
  id: 'silence_mireille_fil', on: 'riposte', fromCharacter: 'fil',
  scope: { squad: true }, cooldown: 3, kind: 'silence', duration: 2,
};

// ── ORSO (Tireur) = RACINE (le déplacement de l'agresseur d'un allié tombe à 0, 2 tours). ──
/** « Orso × Bastion » — Bastion (en garde) encaisse → Orso enracine l'attaquant (dépl. → 0, 2 t.). CD 3. */
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

/** « Orso × Rempart » — Rempart (en garde) encaisse → Orso enracine l'attaquant (dépl. → 0, 2 t.). CD 3. */
const RACINE_ORSO_REMPART: ReactionSpec = {
  id: 'racine_orso_rempart', on: 'garde_encaissee', fromCharacter: 'rempart',
  scope: { squad: true }, cooldown: 3, kind: 'racine', duration: 2,
};
/** « Orso × Estoc » — Riposte d'Estoc → Orso enracine l'attaquant (dépl. → 0, 2 t.). CD 3. */
const RACINE_ORSO_ESTOC: ReactionSpec = {
  id: 'racine_orso_estoc', on: 'riposte', fromCharacter: 'estoc',
  scope: { squad: true }, cooldown: 3, kind: 'racine', duration: 2,
};
/** « Orso × Fil » — Riposte de Fil → Orso enracine l'attaquant (dépl. → 0, 2 t.). CD 3. */
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

// ── Héros FLÈCHE (Tireur) = MARQUAGE (+1 au prochain coup sur la cible). Partenaires : Lourdes + Duellistes. ──
/** « Flèche × Bastion » — Bastion (en garde) encaisse → Flèche MARQUE l'attaquant (+1 au prochain tir). CD 2. */
const MARQUAGE_FLECHE_BASTION: ReactionSpec = {
  id: 'marquage_fleche_bastion', on: 'garde_encaissee', fromCharacter: 'bastion',
  scope: { squad: true }, cooldown: 2, kind: 'marquage', amount: 1, duration: 2,
};
/** « Flèche × Rempart » — Rempart (en garde) encaisse → Flèche MARQUE l'attaquant. CD 2. */
const MARQUAGE_FLECHE_REMPART: ReactionSpec = {
  id: 'marquage_fleche_rempart', on: 'garde_encaissee', fromCharacter: 'rempart',
  scope: { squad: true }, cooldown: 2, kind: 'marquage', amount: 1, duration: 2,
};
/** « Flèche × Estoc » — Riposte d'Estoc → Flèche MARQUE l'attaquant. CD 2. */
const MARQUAGE_FLECHE_ESTOC: ReactionSpec = {
  id: 'marquage_fleche_estoc', on: 'riposte', fromCharacter: 'estoc',
  scope: { squad: true }, cooldown: 2, kind: 'marquage', amount: 1, duration: 2,
};
/** « Flèche × Fil » — Riposte de Fil → Flèche MARQUE l'attaquant. CD 2. */
const MARQUAGE_FLECHE_FIL: ReactionSpec = {
  id: 'marquage_fleche_fil', on: 'riposte', fromCharacter: 'fil',
  scope: { squad: true }, cooldown: 2, kind: 'marquage', amount: 1, duration: 2,
};

// Réciproques de l'arête « × Flèche » (Flèche émet `tir_reserve`) — chaque possesseur réagit avec SON effet.
/** « Bastion × Flèche » — Tir réservé de Flèche → Bastion se CHARGE (+2 dépl., 1 tour). CD 3. */
const CHARGE_BASTION_FLECHE: ReactionSpec = {
  id: 'charge_bastion_fleche', on: 'tir_reserve', fromCharacter: 'fleche',
  scope: { squad: true }, cooldown: 3, kind: 'charge', amount: 2, duration: 1,
};
/** « Rempart × Flèche » — Tir réservé de Flèche → Rempart se CHARGE (+2 dépl., 2 tours). CD 3. */
const CHARGE_REMPART_FLECHE: ReactionSpec = {
  id: 'charge_rempart_fleche', on: 'tir_reserve', fromCharacter: 'fleche',
  scope: { squad: true }, cooldown: 3, kind: 'charge', amount: 2, duration: 2,
};
/** « Estoc × Flèche » — Tir réservé de Flèche → Estoc pince la cible touchée (épines 2). CD 2. */
const EPINES_ESTOC_FLECHE: ReactionSpec = {
  id: 'epines_estoc_fleche', on: 'tir_reserve', fromCharacter: 'fleche',
  scope: { squad: true }, cooldown: 2, kind: 'epines', amount: 2,
};
/** « Fil × Flèche » — Tir réservé de Flèche → Fil octroie la vendetta (+2 prochaine att.). CD 3. */
const VENDETTA_FIL_FLECHE: ReactionSpec = {
  id: 'vendetta_fil_fleche', on: 'tir_reserve', fromCharacter: 'fleche',
  scope: { squad: true }, cooldown: 3, kind: 'vendetta', amount: 2,
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
/** « Baume × Rempart » — Rempart (en garde) encaisse → Baume le régénère (+2×2). CD 3. */
const REGEN_BAUME_REMPART: ReactionSpec = {
  id: 'regen_baume_rempart', on: 'garde_encaissee', fromCharacter: 'rempart',
  scope: { squad: true }, cooldown: 3, kind: 'regen', amount: 2, duration: 2,
};
/** « Baume × Mireille » — Tir réservé de Mireille → Baume la régénère (+2×2). CD 3. */
const REGEN_BAUME_MIREILLE: ReactionSpec = {
  id: 'regen_baume_mireille', on: 'tir_reserve', fromCharacter: 'mireille',
  scope: { squad: true }, cooldown: 3, kind: 'regen', amount: 2, duration: 2,
};
/** « Baume × Orso » — Tir réservé d'Orso → Baume le régénère (+2×2). CD 3. */
const REGEN_BAUME_ORSO: ReactionSpec = {
  id: 'regen_baume_orso', on: 'tir_reserve', fromCharacter: 'orso',
  scope: { squad: true }, cooldown: 3, kind: 'regen', amount: 2, duration: 2,
};
/** « Baume × Flèche » — Tir réservé de Flèche → Baume la régénère (+2×2). CD 3. */
const REGEN_BAUME_FLECHE: ReactionSpec = {
  id: 'regen_baume_fleche', on: 'tir_reserve', fromCharacter: 'fleche',
  scope: { squad: true }, cooldown: 3, kind: 'regen', amount: 2, duration: 2,
};
/** « Baume × Estoc » — Riposte d'Estoc → Baume le régénère (+2×2). CD 3. */
const REGEN_BAUME_ESTOC: ReactionSpec = {
  id: 'regen_baume_estoc', on: 'riposte', fromCharacter: 'estoc',
  scope: { squad: true }, cooldown: 3, kind: 'regen', amount: 2, duration: 2,
};
/** « Baume × Fil » — Riposte de Fil → Baume le régénère (+2×2). CD 3. */
const REGEN_BAUME_FIL: ReactionSpec = {
  id: 'regen_baume_fil', on: 'riposte', fromCharacter: 'fil',
  scope: { squad: true }, cooldown: 3, kind: 'regen', amount: 2, duration: 2,
};
// Mélisse (2ᵉ Soigneur) n'a PAS encore de Résonance — on lui en créera une (lot à venir).
// NB : le Soigneur émet AUCUN signal (Soin = burst, regen = statut) → il est possesseur-only :
// personne ne peut avoir un duo « × Baume/Mélisse » tant qu'un soin n'émet pas de signal.

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
  mireille: { id: 'mireille', name: 'Mireille', archetype: 'tireur', reactions: [SILENCE_MIREILLE_BASTION, SILENCE_MIREILLE_ESTOC, SILENCE_MIREILLE_REMPART, SILENCE_MIREILLE_FIL] },
  estoc:   { id: 'estoc',   name: 'Estoc',   archetype: 'duelliste', reactions: [EPINES_ESTOC_BASTION, EPINES_ESTOC_MIREILLE, EPINES_ESTOC_REMPART, EPINES_ESTOC_ORSO, EPINES_ESTOC_FLECHE] },
  rempart: { id: 'rempart', name: 'Rempart', archetype: 'lourde', reactions: [CHARGE_REMPART_MIREILLE, CHARGE_REMPART_ORSO, CHARGE_REMPART_ESTOC, CHARGE_REMPART_FIL, CHARGE_REMPART_FLECHE] },
  orso:    { id: 'orso',    name: 'Orso',    archetype: 'tireur', reactions: [RACINE_ORSO_BASTION, RACINE_ORSO_REMPART, RACINE_ORSO_ESTOC, RACINE_ORSO_FIL] },
  fil:     { id: 'fil',     name: 'Fil',     archetype: 'duelliste', reactions: [VENDETTA_FIL_BASTION, VENDETTA_FIL_MIREILLE, VENDETTA_FIL_REMPART, VENDETTA_FIL_ORSO, VENDETTA_FIL_FLECHE] },
  fleche:  { id: 'fleche',  name: 'Flèche',  archetype: 'tireur', reactions: [MARQUAGE_FLECHE_BASTION, MARQUAGE_FLECHE_REMPART, MARQUAGE_FLECHE_ESTOC, MARQUAGE_FLECHE_FIL] },
  baume:   { id: 'baume',   name: 'Baume',   archetype: 'soigneur', reactions: [REGEN_BAUME_BASTION, REGEN_BAUME_REMPART, REGEN_BAUME_MIREILLE, REGEN_BAUME_ORSO, REGEN_BAUME_FLECHE, REGEN_BAUME_ESTOC, REGEN_BAUME_FIL] },
  melisse: { id: 'melisse', name: 'Mélisse', archetype: 'soigneur', reactions: [] },
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
