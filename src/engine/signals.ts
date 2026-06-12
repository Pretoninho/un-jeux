// Signaux observables (memo §23.6, §17) : lectures BRUITÉES et RETARDÉES de la
// jauge cachée. Le skill central = inférer F à partir d'eux. Trois garde-fous
// anti-script (§29.2) : plancher de bruit irréductible, planchers tirés en plages
// par instance, et le MENSONGE du rebond (§24.2). Observationnels : ils n'altèrent
// pas la dynamique (les vraies IA les liront en J4, l'UI en J5).

import type { GameState, SignalReading } from './state';
import type { Rng } from './rng';
import type { SimResult } from './simulate';

const DELAYS = { volatilite: 0, ecartCredit: 1, financement: 2 } as const;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** F observée avec `delay` tours de retard. */
function fAtDelay(state: GameState, delay: number): number {
  const h = state.fragilityHistory;
  const idx = h.length - 1 - delay;
  return h[Math.max(0, idx)] ?? state.fragility;
}

/**
 * Calcule les 3 signaux du tour. Pendant le rebond (phase bounce), tous se
 * DÉTENDENT (lisent plus bas que F réel) — le mensonge (§24.2). Comme le rebond
 * est parfois un vrai plancher, cette détente est ambiguë, jamais une preuve.
 */
export function computeSignals(state: GameState, rng: Rng): SignalReading {
  const p = state.params;
  const detune = state.crisis.active && state.crisis.phase === 'bounce' ? p.bounceDetune : 0;
  const read = (delay: number, sigma: number): number =>
    clamp01(fAtDelay(state, delay) - detune + rng.gauss() * sigma);
  return {
    volatilite: read(DELAYS.volatilite, p.signalNoiseVol),
    ecartCredit: read(DELAYS.ecartCredit, p.signalNoiseSpread),
    financement: read(DELAYS.financement, p.signalNoiseFinance),
  };
}

// ──────── Critère « les signaux battent l'horloge » (memo §28.7) ────────
// Instrument de mesure. L'ASSERTION stricte est posée en J7 (params calibrés) ;
// ici on fournit la fonction et un test souple.

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const d = Math.sqrt(sxx * syy);
  return d === 0 ? 0 : sxy / d;
}

export interface ClockVsSignal {
  n: number;
  clockCorr: number; // |corr| du n° de tour avec « crise imminente »
  signalCorr: number; // |corr| du signal max avec « crise imminente »
}

/**
 * Compare le pouvoir prédictif de l'HORLOGE (n° de tour) vs des SIGNAUX sur la
 * survenue d'une crise dans les `within` tours. Le design veut signalCorr ≫
 * clockCorr (sinon le tempo est scripté, §28.7). Vérification stricte en J7.
 */
export function clockVsSignalPower(results: SimResult[], within = 2): ClockVsSignal {
  const clock: number[] = [];
  const signal: number[] = [];
  const label: number[] = [];
  for (const res of results) {
    const sig = res.signalsHistory;
    for (let i = 0; i < sig.length; i++) {
      const turn = i + 1; // signalsHistory[i] = tour i+1
      const imminent = res.crisisTurns.some((t) => t > turn && t <= turn + within) ? 1 : 0;
      const s = sig[i]!;
      clock.push(turn);
      signal.push(Math.max(s.volatilite, s.ecartCredit, s.financement));
      label.push(imminent);
    }
  }
  return {
    n: label.length,
    clockCorr: Math.abs(pearson(clock, label)),
    signalCorr: Math.abs(pearson(signal, label)),
  };
}
