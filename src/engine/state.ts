// État de partie — structures du moteur (J2). TS pur, sans DOM.
//
// Le joueur et les adversaires sont tous des « acteurs » du même type : c'est ce
// qui rend le pool unifié (memo §16) et l'assertion de neutralité (§28.8) possibles.

import type { GameMap, HexId } from './types';
import type { InstanceParams } from './params';

/** Régime émergent (memo §15) — une LECTURE de F + tendance, jamais un script. */
export type Regime = 'bull' | 'tension' | 'crise' | 'recovery';

/** Une position ouverte sur un hexe. */
export interface Position {
  hexId: HexId;
  /** Capital propre engagé. */
  equity: number;
  /** Levier (0 = sans levier). Notionnel = equity × (1 + leverage). */
  leverage: number;
  /** Valorisation `V` de l'hexe à l'entrée (référence du P&L). */
  entryV: number;
}

/** État d'un acteur (joueur ou IA). */
export interface ActorState {
  id: string;
  /** Liquidités non déployées (réserve sèche). */
  cash: number;
  positions: Position[];
  /** Historique de richesse mark-to-market, par tour (pour le drawdown, §27). */
  wealthHistory: number[];
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
  /** Crise en cours ? + tour de déclenchement + amplitude (memo §23.5). */
  crisis: { active: boolean; triggeredTurn: number; amplitude: number; turnsLeft: number };

  market: Record<HexId, HexMarket>;
  actors: ActorState[];

  /** Trace pour le harness / J7 (memo §28.7) — la VRAIE courbe de F. */
  fragilityHistory: number[];
  /** Tours où une crise s'est déclenchée. */
  crisisTurns: number[];
  /** Indice de marché passif = benchmark du Track Record (memo §27.2). */
  benchmarkHistory: number[];
}
