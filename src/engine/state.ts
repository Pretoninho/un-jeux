// État de partie — structures du moteur (J2). TS pur, sans DOM.
//
// Le joueur et les adversaires sont tous des « acteurs » du même type : c'est ce
// qui rend le pool unifié (memo §16) et l'assertion de neutralité (§28.8) possibles.

import type { GameMap, HexId } from './types';
import type { InstanceParams } from './params';
import type { CouponPosition, CreditState } from './credit';

/** Régime émergent (memo §15) — une LECTURE de F + tendance, jamais un script. */
export type Regime = 'bull' | 'tension' | 'crise' | 'recovery';

/** Phase de la cascade de crise (memo §24). */
export type CrisisPhase = 'none' | 'leg1' | 'bounce' | 'leg3';

/** État d'une crise en cours (forme tirée PAR CRISE au déclenchement, §24.7). */
export interface CrisisState {
  active: boolean;
  phase: CrisisPhase;
  triggeredTurn: number;
  amplitude: number;
  phaseTurnsLeft: number;
  durations: { leg1: number; bounce: number; leg3: number };
  bounceRecovery: number;
  /** Le rebond est-il un vrai plancher (pas de leg3) ? (memo §24.2) */
  isRealFloor: boolean;
  recoveryTurnsLeft: number;
}

/** Lecture observable des 3 signaux MVP (memo §23.6). Valeurs ∈ [0,1]. */
export interface SignalReading {
  volatilite: number;
  ecartCredit: number;
  financement: number;
}

/** Une position ouverte sur un hexe. */
export interface Position {
  hexId: HexId;
  /** Sens : long (gagne si V monte) ou short (gagne si V chute). */
  direction: 'long' | 'short';
  /** Capital propre engagé. */
  equity: number;
  /** Levier (0 = sans levier). Notionnel = equity × (1 + leverage). */
  leverage: number;
  /** Valorisation `V` de l'hexe à l'entrée (référence du P&L). */
  entryV: number;
  /** Tour d'ouverture — sert au verrou d'illiquidité (spec immobilier). */
  entryTurn?: number;
}

/** État d'un acteur (joueur ou IA). */
export interface ActorState {
  id: string;
  /** Liquidités non déployées (réserve sèche). */
  cash: number;
  positions: Position[];
  /** Positions sur coupons de crédit (hors monde `V`, spec crédit-coupons). */
  couponPositions: CouponPosition[];
  /** Historique de richesse mark-to-market, par tour (pour le drawdown, §27). */
  wealthHistory: number[];
  /** Multiplicateur du coût d'emprunt (1 = normal ; <1 = levier moins cher, ex. présence PB). */
  borrowMultiplier?: number;
  /** Pouvoir d'archétype : échappe au verrou d'illiquidité (spec immobilier). */
  ignoreLockup?: boolean;
  /** Compétence « Récolte » (Vautour) : copiée de l'archétype à l'init. */
  carrySkill?: { factor: number; duration: number; cooldown: number; paCost: number };
  /** Boost de carry actif tant que `state.turn <= carryBoostUntil`. */
  carryBoostUntil?: number;
  /** Compétence réutilisable quand `state.turn >= carrySkillReadyAt`. */
  carrySkillReadyAt?: number;
  /** Compétence « Couverture » (Vautour) : copiée de l'archétype à l'init. */
  coverSkill?: { window: number; cooldown: number; paCost: number };
  /** Couverture armée (coupons protégés du défaut) tant que `state.turn <= coverArmedUntil`. */
  coverArmedUntil?: number;
  /** « Couverture » ré-armable quand `state.turn >= coverReadyAt`. */
  coverReadyAt?: number;
  /** Contrainte permanente (Vautour) : jamais de levier (copiée à l'init). */
  noLeverage?: boolean;
  /** Config de la ressource « Réserve sèche » (Vautour) : décote de déploiement (copiée à l'init). */
  dryPowderCfg?: { max: number; discountPerPowder: number; maxDiscount: number; fThreshold: number };
  /** Réserve sèche accumulée (+1/tour patient, plafonnée) ; consommée à l'ouverture en haute F. */
  dryPowder?: number;
}

/** État par hexe : valorisation publique `V` et ancre cachée `A` (memo §25.2). */
export interface HexMarket {
  V: number;
  A: number;
}

export interface GameState {
  turn: number;
  rngSeed: number;
  params: InstanceParams;
  map: GameMap;

  /** Jauge de fragilité — CACHÉE (memo §23). */
  fragility: number;
  regime: Regime;
  /** Tours consécutifs en bull (entrée du melt-up). */
  bullStreak: number;
  /** Crise en cours — machine à phases de la cascade (memo §24). */
  crisis: CrisisState;

  market: Record<HexId, HexMarket>;
  /** Sous-système crédit : Banque centrale + carnet de coupons (hors monde `V`). */
  credit: CreditState;
  actors: ActorState[];

  /** Trace pour le harness / J7 (memo §28.7) — la VRAIE courbe de F. */
  fragilityHistory: number[];
  /** Tours où une crise s'est déclenchée. */
  crisisTurns: number[];
  /** Indice de marché passif = benchmark du Track Record (memo §27.2). */
  benchmarkHistory: number[];
  /** Signaux observés par tour (memo §23.6) — pour l'UI (J5) et le critère J7. */
  signalsHistory: SignalReading[];
}
