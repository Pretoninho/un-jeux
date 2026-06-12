// Moteur de prix (memo §25). Structure à facteurs : la corrélation ÉMERGE du
// partage des facteurs, et ρ→1 en crise émerge de la domination de M — rien n'est
// forcé. Tous les paramètres viennent de l'instance (tirés par seed).

import type { GameState, Regime } from './state';
import type { Hex } from './types';
import type { Rng } from './rng';
import type { InstanceParams } from './params';

/** μ/σ du facteur marché M pour le régime courant (memo §25.3). */
export function regimeDriftVol(regime: Regime, p: InstanceParams): { mu: number; sigma: number } {
  switch (regime) {
    case 'bull': return { mu: p.driftBull, sigma: p.volBull };
    case 'tension': return { mu: p.driftTension, sigma: p.volTension };
    case 'crise': return { mu: p.driftCrisis, sigma: p.volCrisis };
    case 'recovery': return { mu: p.driftRecovery, sigma: p.volRecovery };
  }
}

/**
 * μ/σ effectifs du tour. En crise, la PHASE de la cascade (memo §24) pilote :
 *   leg1   → chute · bounce → rebond (drift POSITIF, le bull trap) · leg3 → vraie jambe.
 * Sinon, le régime émergent.
 */
export function marketDriftVol(state: GameState): { mu: number; sigma: number } {
  const p = state.params;
  const c = state.crisis;
  if (c.active) {
    switch (c.phase) {
      case 'leg1': return { mu: p.driftCrisis, sigma: p.volCrisis };
      case 'bounce': return { mu: Math.abs(p.driftCrisis) * c.bounceRecovery, sigma: p.volCrisis * 0.8 };
      case 'leg3': return { mu: p.driftCrisis * 1.3, sigma: p.volCrisis * 1.2 };
      default: break;
    }
  }
  return regimeDriftVol(state.regime, p);
}

/** Fractions de variance M / C / ε. En crise, M domine → ρ→1 (memo §25.1). */
export function varianceFractions(regime: Regime, p: InstanceParams): { fM: number; fC: number; fIdio: number } {
  const fIdioNormal = Math.max(0, 1 - p.varianceMarket - p.varianceCluster);
  if (regime === 'crise') {
    const fM = p.crisisVarianceMarket;
    const rem = Math.max(0, 1 - fM);
    const denom = p.varianceCluster + fIdioNormal || 1;
    const fC = rem * (p.varianceCluster / denom);
    return { fM, fC, fIdio: Math.max(0, rem - fC) };
  }
  return { fM: p.varianceMarket, fC: p.varianceCluster, fIdio: fIdioNormal };
}

const isInvestable = (h: Hex): boolean => h.kind === 'marche' || h.kind === 'frontiere';

/**
 * Résout un tour de marché : tire les facteurs, met à jour chaque `V` et fait
 * marcher l'ancre `A`. `fluxByHex` = pression nette d'ordres du tour (memo §25.4,
 * l'impact-prix), positif = achats nets.
 */
export function resolveMarket(state: GameState, fluxByHex: Record<string, number>, rng: Rng): void {
  const p = state.params;
  const { mu, sigma } = marketDriftVol(state);
  const { fM, fC, fIdio } = varianceFractions(state.regime, p);

  // Facteur marché commun (une réalisation), et facteur de cluster (une par cluster).
  const zM = rng.gauss();
  const zCluster: Record<string, number> = {
    credit: rng.gauss(),
    actions: rng.gauss(),
    alternatifs: rng.gauss(),
  };

  const lambda = state.regime === 'recovery' ? p.lambdaRecovery : p.lambdaNormal;

  for (const hex of state.map.hexes) {
    if (!isInvestable(hex)) continue;
    const m = state.market[hex.id];
    if (!m) continue;

    const beta = hex.beta ?? 1;
    const gamma = hex.gamma ?? 0;
    const zEps = rng.gauss();
    const cl = hex.cluster ?? 'actions';

    const driftComp = mu * beta;
    const factorComp =
      sigma * (Math.sqrt(fM) * beta * zM + Math.sqrt(fC) * gamma * (zCluster[cl] ?? 0) + Math.sqrt(fIdio) * zEps);
    const reversion = -lambda * Math.log(m.V / m.A); // rappel vers l'ancre (§25.2)
    const flux = (fluxByHex[hex.id] ?? 0) * p.fluxImpact; // impact-prix (§25.4)

    const r = driftComp + factorComp + reversion + flux;
    // Borne le rendement d'un tour : un actif ne perd/gagne pas > ~50 % en un coup.
    // Évite qu'un hexe s'effondre au plancher (« bloqué à 0 ») et plafonne les pics.
    const rBounded = Math.max(-0.5, Math.min(0.5, r));
    m.V = Math.max(1e-3, m.V * (1 + rBounded));

    // Ancre `A` (juste valeur) : suit la dérive FONDAMENTALE hors crise — donc une
    // hausse calme n'étire PAS la valorisation (la fragilité doit venir des
    // comportements, pas de la dérive autonome). En CRISE, A tient : V chute sous A
    // → c'est la dislocation V≪A que la recovery peut réverser (memo §25.2, §25.6).
    const anchorDrift = state.regime === 'crise' ? 0 : driftComp;
    m.A = Math.max(1e-3, m.A * (1 + anchorDrift + p.anchorWalk * rng.gauss()));
  }
}

/** Étirement de valorisation Σ max(0, ln(V/A)) — « valorisations tendues » (§25.4). */
export function valuationStretch(state: GameState): number {
  let sum = 0;
  let n = 0;
  for (const hex of state.map.hexes) {
    if (!isInvestable(hex)) continue;
    const m = state.market[hex.id];
    if (!m) continue;
    sum += Math.max(0, Math.log(m.V / m.A));
    n++;
  }
  return n ? sum / n : 0;
}
