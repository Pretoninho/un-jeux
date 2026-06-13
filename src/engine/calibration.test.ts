// Assertions de calibrage J7 (memo §28). Transforme les cibles de tempo (§28.2), le
// « critère d'or » signaux>horloge (§28.7) et la neutralité (§28.8) en garde automatisée.
// Si un réglage futur recasse la physique (crise certaine, levier god-tier, tempo scripté),
// ces tests tombent. Ce sont des BANDES, pas des égalités — la distribution est émergente,
// on vérifie qu'elle reste dans le couloir, jamais qu'on la force.
//
// Reproductible : `simulate` est seedé (seed = config.seed + i), donc déterministe.

import { describe, it, expect } from 'vitest';
import { simulate, type SimResult } from './simulate';
import { policyForProfile } from './ai';
import { steadyLong } from './policy';
import { presetMvp } from '../data/config-mvp';
import { FONDS_LEVERAGE } from '../data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../data/profiles/value-patient';

const N = 300;
const SEED = 1000;
const AIS = [policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];

const run = (playerPolicy: ReturnType<typeof steadyLong>) =>
  simulate(presetMvp(SEED), N, { policies: [playerPolicy, ...AIS] });

const rate = (rs: SimResult[], pred: (r: SimResult) => boolean) =>
  rs.filter(pred).length / rs.length;

/** Corrélation point-bisériale |·| de X sur « crise dans ≤2 tours » (§28.7). */
function predictivePower(rs: SimResult[]): { clock: number; signal: number } {
  const turn: number[] = [], sig: number[] = [], label: number[] = [];
  for (const r of rs) {
    const crises = new Set(r.crisisTurns);
    for (let t = 0; t < r.signalsHistory.length; t++) {
      turn.push(t);
      sig.push(r.signalsHistory[t]!.volatilite);
      label.push(crises.has(t) || crises.has(t + 1) || crises.has(t + 2) ? 1 : 0);
    }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const corr = (xs: number[]) => {
    const mx = mean(xs), my = mean(label);
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < xs.length; i++) {
      const a = xs[i]! - mx, b = label[i]! - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    return dx && dy ? Math.abs(num / Math.sqrt(dx * dy)) : 0;
  };
  return { clock: corr(turn), signal: corr(sig) };
}

describe('Calibrage J7 — la fragilité est pilotée par le COMPORTEMENT (§23.2, §28.2)', () => {
  // Depuis le retrait du pump de valorisation (fluxImpact à l'échelle), F vient du
  // levier + crowding, pas d'un fond global → un monde calme reste calme, un monde
  // leveragé casse. C'est l'intention : « le hoarder peut perdre/gagner sans drame ».
  const passif = run(steadyLong(0)); // sans levier
  const pyromane = run(steadyLong(4)); // levier max

  it('un jeu prudent (sans levier) laisse un VRAI quota de parties calmes', () => {
    const calm = rate(passif, (r) => r.crisisCount === 0);
    expect(calm).toBeGreaterThan(0.30); // ni « crise certaine » (le bug baseline = 0 %)…
    expect(calm).toBeLessThan(0.70); // …ni « jamais de crise »
  });

  it('le levier agressif rend la crise quasi inévitable (le levier EST le moteur)', () => {
    const calm = rate(pyromane, (r) => r.crisisCount === 0);
    expect(calm).toBeLessThan(0.15);
  });

  it('les tables pyromanes brûlent DEUX fois, le prudent quasi jamais (§28.2)', () => {
    const dbl = (rs: SimResult[]) => rate(rs, (r) => r.crisisCount >= 2);
    expect(dbl(pyromane)).toBeGreaterThan(dbl(passif));
    expect(dbl(pyromane)).toBeGreaterThan(0.10); // cible 10-15 % réservée aux pyromanes
  });

  it('la crise précoce (avant t5) reste rare en jeu modéré — protection du débutant', () => {
    expect(rate(passif, (r) => r.crisisTurns.some((t) => t < 5))).toBeLessThan(0.05);
  });

  it('la date de crise est étalée (pas de fenêtre apprenable)', () => {
    const turns = pyromane.flatMap((r) => r.crisisTurns);
    const m = turns.reduce((a, b) => a + b, 0) / turns.length;
    const sd = Math.sqrt(turns.reduce((a, t) => a + (t - m) ** 2, 0) / turns.length);
    expect(sd).toBeGreaterThan(1.8);
  });
});

describe('Calibrage J7 — critère d\'or §28.7 (les signaux battent l\'horloge)', () => {
  it('le signal prédit la crise MIEUX que le numéro de tour (moteur non scripté)', () => {
    // Mesuré avec le signal le plus bruité (Volatilité) → borne basse conservatrice.
    const { clock, signal } = predictivePower(run(steadyLong(2)));
    expect(signal).toBeGreaterThan(clock);
  });
});

describe('Calibrage J7 — neutralité §28.8 (aucun profil ne domine les Track Records)', () => {
  // Partie PAR DÉFAUT : joueur réserve + les 2 IA réelles (momentum leveragé vs value).
  const def = simulate(presetMvp(SEED), N);
  const score = (r: SimResult, id: string) => r.trackRecords[id]!.score;

  it('le levier ne domine NI n\'est mort face au value (duel ~équilibré)', () => {
    // α (drawdownPenalty) est le bouton : il pénalise le drawdown du leveragé juste
    // assez pour que le pari soit symétrique. Cible : ni 0 % ni 100 %.
    const levBeatsValue = rate(def, (r) => score(r, 'fonds_leverage') > score(r, 'value_patient'));
    expect(levBeatsValue).toBeGreaterThan(0.30);
    expect(levBeatsValue).toBeLessThan(0.70);
  });

  it('chaque profil remporte la partie au moins parfois (personne n\'est strictement dominé)', () => {
    const ids = ['vautour', 'fonds_leverage', 'value_patient'];
    const top1 = (id: string) =>
      rate(def, (r) => ids.every((o) => score(r, o) <= score(r, id)));
    // Même le hoarder (réserve) gagne dans les parties à krach → branche « le hoarder gagne ».
    for (const id of ids) expect(top1(id)).toBeGreaterThan(0.05);
  });
});
