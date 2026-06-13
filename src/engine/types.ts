// Types du domaine — traduction de la spec §11bis (« tout est données »).
// Aucun import DOM/Svelte ici : ce module doit rester testable sans navigateur.

// ───────────────────────── Carte (memo §11, spec §4) ─────────────────────────

export type HexId = string;

/** Cluster de corrélation (facteur C, memo §25.1). */
export type Cluster = 'credit' | 'actions' | 'alternatifs';

export type HexKind = 'marche' | 'noeud' | 'frontiere';

/** Type de nœud stratégique (non-investissable, memo §11). */
export type NodeType = 'reglementaire' | 'liquidite' | 'information';

export interface Hex {
  id: HexId;
  label: string;
  kind: HexKind;
  /** Présent pour les hexes marché et frontière. */
  cluster?: Cluster;
  /** Présent pour les nœuds. */
  nodeType?: NodeType;
  /**
   * Charges factorielles (memo §25.1). Ce sont des CONNAISSANCES STRUCTURELLES :
   * le joueur les connaît (§4.4) ; ce sont les réalisations de M/C/F qui sont cachées.
   */
  beta?: number; // exposition au facteur marché M
  gamma?: number; // exposition au facteur cluster C
  /** Portage par tour (memo §25.5). */
  carry?: number;
  /**
   * Contraintes d'illiquidité (spec immobilier) — données, posées sur l'hexe :
   *  - `longOnly` : interdit le short (on ne short pas un immeuble).
   *  - `illiquid` : la sortie de position est bloquée pendant `lockupTurns` (param tiré
   *    par instance). Couple naturellement avec un carry élevé = prime d'illiquidité.
   * Un archétype avec `ignoreLockup` échappe au verrou. Pas de levier sur ces hexes.
   */
  longOnly?: boolean;
  illiquid?: boolean;
  /** Adjacence = corrélation (memo §11). Doit être symétrique (testé). */
  neighbors: HexId[];
  /** Coordonnées axiales (q, r) — présentes pour les cartes générées (géométrie =
   * adjacence). Ignorées par le moteur, utilisées par l'UI pour le pavage. */
  coord?: { q: number; r: number };
}

export interface GameMap {
  id: string;
  hexes: Hex[];
}

// ──────────────────── Profils : pool unifié humain/IA (memo §16) ─────────────

/** Un archétype jouable. Données pures — aucun comportement câblé dans le moteur. */
export interface Archetype {
  id: string;
  /** Référence de développement interne (Buffett, Soros…) — jamais affichée en jeu. */
  refDev: string;
  /** Nom in-game. */
  label: string;
  resource: { id: string; label: string };
  /** Part du capital placée en réserve sèche au départ (0..1). */
  startingReserveRatio: number;
  startingHex: HexId;
  /** Pouvoir d'archétype : échappe au verrou d'illiquidité (sortie immédiate, spec immo). */
  ignoreLockup?: boolean;
}

/**
 * Fonction de réaction d'une IA (memo §16) — PARAMÈTRES en données, interprétés
 * par une politique générique (engine/ai.ts). Ajouter une IA = un jeu de params.
 */
export interface AIBehavior {
  /** Ce qui déclenche un achat : suivre la hausse, ou acheter la décote. */
  entrySignal: 'momentum' | 'value';
  /** Levier maximal utilisé (0 = jamais de levier). */
  leverageAppetite: number;
  /** Seuil de risque PERÇU (volatilité bruitée) au-delà duquel l'IA cesse/réduit. */
  riskTolerance: number;
  /** Vitesse de désengagement quand le risque perçu est haut (bas = « trop tard »). */
  deRiskRate: number;
  /** Fraction du cash déployée par action. */
  sizing: number;
  /** Décote minimale (V sous l'ancre estimée) pour acheter — entrée 'value'. */
  decoteThreshold: number;
  /**
   * Reach-for-yield (spec crédit-coupons §8) : propension/tour, en période calme, à
   * chasser le coupon le plus juteux (HY long). 0 ou absent = ignore le crédit. Sa
   * contribution à la fragilité ÉMERGE du crowding crédit (portfolio.ts), pas codée en dur.
   */
  couponAppetite?: number;
}

/**
 * Un profil d'adversaire IA. `kind: 'archetype'` = version IA d'un archétype
 * jouable ; `kind: 'pur'` = acteur de marché sans condition de victoire (memo §16).
 */
export interface ProfilIA {
  id: string;
  label: string;
  kind: 'archetype' | 'pur';
  /** Paramètres de la fonction de réaction (memo §16). Absent = reste en réserve. */
  behavior?: AIBehavior;
}

// ───────────────────── Configuration d'une partie (spec §11bis) ──────────────

/**
 * Toute partie — jouée ou simulée — se décrit par cet objet. La partie MVP
 * auto-configurée n'est qu'un preset par défaut (spec §3). Le `seed` rend chaque
 * partie reproductible : prérequis des tests anti-script de J7.
 */
export interface ConfigPartie {
  archetype: Archetype;
  adversaires: ProfilIA[];
  carte: GameMap;
  seed: number;
}

// ──────────────────── Catalogue d'actions (memo §9, §9bis) ───────────────────

/** Verbes du MVP (les 5 du jeu complet moins CONSTRUIRE/NÉGOCIER). */
export type Verbe = 'LIRE' | 'POSITIONNER' | 'RESERVER';

/** Opérations de POSITIONNER (memo §9bis). */
export type PositionOp = 'ouvrir' | 'renforcer' | 'cloture_partielle' | 'fermer';

/**
 * Définition d'une action. Le coût est un intervalle [paMin, paMax] : fixe quand
 * paMin === paMax, variable selon l'impact-prix sinon (memo §9bis). C'est de la
 * donnée — les coûts se règlent sans toucher au moteur (calibrage J7).
 */
export interface ActionDef {
  id: string;
  verbe: Verbe;
  /** Présent uniquement pour POSITIONNER. */
  op?: PositionOp;
  label: string;
  paMin: number;
  paMax: number;
}
