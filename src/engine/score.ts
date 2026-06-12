// Score — Track Record (memo §27). Rendement excédentaire vs le marché, pénalisé
// par le pire drawdown mark-to-market. Le score est TRANSPARENT et stable
// (exception anti-script assumée §27.3) : l'anti-gaming vient de la structure
// (benchmark endogène fixe + drawdown mark-to-market), pas de l'obscurité.

import type { ActorState } from './state';

/** Pire repli pic-à-creux d'une série de richesse (∈ [0,1]). */
export function maxDrawdown(wealthHistory: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const w of wealthHistory) {
    if (w > peak) peak = w;
    if (peak > 0) worst = Math.max(worst, (peak - w) / peak);
  }
  return worst;
}

/** Rendement total d'une série (du premier au dernier point). */
export function totalReturn(history: number[]): number {
  if (history.length < 2) return 0;
  const first = history[0]!;
  const last = history[history.length - 1]!;
  return first !== 0 ? last / first - 1 : 0;
}

export interface TrackRecord {
  excessReturn: number;
  maxDrawdown: number;
  score: number;
}

/**
 * Track Record d'un acteur. `alpha` = poids du drawdown (memo §27.4, point
 * d'équilibre du défaut #4 calibré en J7). `distress` = pénalités de détresse
 * (§14) — branché en J3 ; 0 par défaut au J2.
 */
export function trackRecord(
  actor: ActorState,
  benchmarkHistory: number[],
  alpha: number,
  distress = 0,
): TrackRecord {
  const excess = totalReturn(actor.wealthHistory) - totalReturn(benchmarkHistory);
  const dd = maxDrawdown(actor.wealthHistory);
  return { excessReturn: excess, maxDrawdown: dd, score: excess - alpha * dd - distress };
}
