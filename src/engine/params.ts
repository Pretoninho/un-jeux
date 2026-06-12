// Paramètres du moteur — TOUS exprimés en plages, tirés par instance.
//
// Principe anti-script (memo §24.7, §25.10, §28.1) : aucune constante de gameplay
// n'est gravée. Le type impose la discipline — un paramètre est une `Range`, et la
// valeur concrète d'une partie est tirée via `drawInstanceParams(rng)`. Câbler une
// valeur fixe demanderait min === max, ce qui se voit immédiatement.
//
// Les valeurs ci-dessous sont des POINTS DE DÉPART de calibrage (J7), pas des
// décisions finales (memo §23.8, §24.7, §25.10, §27.4).

import { makeRng, type Rng } from './rng';

export interface Range {
  min: number;
  max: number;
}

const r = (min: number, max: number): Range => ({ min, max });

/** Plages de conception. Référencées à leur section du memo. */
export const PARAM_RANGES = {
  // ── Jauge de fragilité (memo §23) ──
  f0: r(0.10, 0.35), // fragilité initiale cachée (§23.1) — < zone morte 0.40
  accLeverage: r(0.05, 0.07), // poids du levier dans l'accumulation (§23.2)
  accCrowding: r(0.03, 0.05),
  accValuation: r(0.008, 0.012),
  purgeDeleverage: r(0.04, 0.06), // (§23.3)
  purgeMeanReversion: r(0.015, 0.025),
  crisisDeadZone: r(0.40, 0.40), // seuil structurel (§23.4) — fixe assumé
  crisisCeiling: r(0.85, 0.85), // plafond déterministe (§23.4) — fixe assumé
  crisisK: r(1.3, 1.7), // raideur de la proba de crise (§23.4)
  resetFactor: r(0.12, 0.18), // reset post-crise ∝ amplitude (§23.5)

  // ── Cascade de crise (memo §24.7) ──
  cascadeLeg1Turns: r(1, 2),
  cascadeBounceTurns: r(1, 3),
  cascadeLeg3Turns: r(1, 3),
  bounceRecovery: r(0.25, 0.55), // part de la jambe 1 récupérée au rebond
  realFloorProbability: r(0.25, 0.35), // proba que le rebond soit un vrai plancher

  // ── Moteur de prix (memo §25.10) ──
  varianceMarket: r(0.30, 0.50), // part du facteur M en régime normal (§25.1)
  varianceCluster: r(0.20, 0.35), // part du facteur C
  // (la part idiosyncratique ε = reste, normalisé)
  crisisVarianceMarket: r(0.80, 0.90), // en crise, M domine → ρ→1 émergent (§25.1)
  lambdaNormal: r(0.02, 0.06), // réversion faible en normal (§25.6, fix D)
  lambdaRecovery: r(0.08, 0.20), // réversion (stochastique) en recovery (§25.6, fix C)
  anchorNoiseFloor: r(0.04, 0.08), // plancher de bruit sur l'estimation de A (§25.2, fix B)
  anchorWalk: r(0.005, 0.015), // amplitude de la marche lente de l'ancre A (§25.2)
  fluxImpact: r(0.02, 0.06), // sensibilité du prix au flux net d'ordres (§25.4)

  // ── Drifts et vols par régime (memo §25.3) — μ/σ du facteur marché M ──
  // La plage de tension CHEVAUCHE le bull (anti-leak du melt-up, §25.3).
  driftBull: r(0.010, 0.030),
  volBull: r(0.02, 0.04),
  driftTension: r(0.010, 0.050),
  volTension: r(0.04, 0.07),
  driftCrisis: r(-0.18, -0.08),
  volCrisis: r(0.08, 0.14),
  driftRecovery: r(-0.03, 0.05), // inclut le négatif → dead recoveries (§25.6, fix C)
  volRecovery: r(0.04, 0.08),

  // ── Levier (memo §29.3, v1.8) ──
  // Le coût et le seuil de marge sont des règles TRANSPARENTES (exception §27.3) ;
  // ces plages ne sont que leurs points de départ de calibrage.
  leverageBorrowRate: r(0.01, 0.03), // taux d'emprunt/tour par unité de levier (croît avec la détresse en J2)
  marginCallThreshold: r(0.25, 0.40), // drawdown mark-to-market d'une position leveragée → liquidation forcée

  // ── Score (memo §27.4) ──
  drawdownPenalty: r(0.5, 0.5), // α — point d'équilibre du défaut #4, calibré en J7
  // NOTE J2 : les planchers de bruit des signaux (memo §29.2, σ réductible/irréductible
  // + délais par signal) sont une STRUCTURE par signal — ils seront modélisés en données
  // au J2 (avec leurs planchers tirés en plages), pas comme scalaires plats ici.

  // ── Tempo (memo §28) ──
  horizonTurns: r(12, 15), // durée d'un cycle MVP (§28.2, §28.5)
  recoveryTurns: r(2, 4), // fenêtre de recovery après une cascade (§24)

  // ── Signaux observables (memo §23.6, §29.2) ──
  // Bruit total par signal (le plancher irréductible est inclus). Tirés en plages
  // par instance → le joueur ne peut pas mesurer son bruit résiduel (§29.2).
  signalNoiseVol: r(0.12, 0.20), // Volatilité : retard 0, bruit fort
  signalNoiseSpread: r(0.06, 0.12), // Écart de crédit : retard 1
  signalNoiseFinance: r(0.04, 0.08), // Financement : retard 2, bruit faible
  bounceDetune: r(0.15, 0.30), // détente des signaux pendant le rebond — le mensonge (§24.2)
} as const;

export type ParamKey = keyof typeof PARAM_RANGES;

/** Valeurs concrètes tirées pour une partie. */
export type InstanceParams = Record<ParamKey, number>;

/**
 * Tire les paramètres d'UNE partie. Les durées de cascade et l'horizon sont des
 * entiers ; le reste sont des flottants. Reproductible : même seed ⇒ mêmes valeurs.
 */
export function drawInstanceParams(seedOrRng: number | Rng): InstanceParams {
  const rng = typeof seedOrRng === 'number' ? makeRng(seedOrRng) : seedOrRng;
  const integerKeys = new Set<ParamKey>([
    'cascadeLeg1Turns',
    'cascadeBounceTurns',
    'cascadeLeg3Turns',
    'horizonTurns',
    'recoveryTurns',
  ]);

  const out = {} as InstanceParams;
  for (const key of Object.keys(PARAM_RANGES) as ParamKey[]) {
    const { min, max } = PARAM_RANGES[key];
    out[key] = integerKeys.has(key) ? rng.int(min, max) : rng.range(min, max);
  }
  return out;
}
