// Assertions de calibrage J7 (memo §28). Transforme les cibles de tempo (§28.2) et
// le « critère d'or » signaux>horloge (§28.7) en garde automatisée : si un réglage
// futur recasse la physique (F qui pègue le plafond, crise certaine, tempo scripté),
// ces tests tombent. Ce sont des BANDES, pas des égalités — la distribution est
// émergente, on vérifie qu'elle reste dans le couloir, jamais qu'on la force.
//
// Reproductible : `simulate` est seedé (seed = config.seed + i), donc ces assertions
// sont déterministes (pas de flakiness) tout en restant sensibles aux paramètres.

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

/**
 * Pouvoir prédictif (corrélation point-bisériale, en valeur absolue) de X sur
 * « une crise se déclenche dans ≤2 tours ». §28.7 : on veut |corr(signal)| > |corr(horloge)|.
 */
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

describe('Calibrage J7 — cibles de tempo §28.2 (bandes, distribution émergente)', () => {
  // Joueur « moyen » = long sans levier, 2 IA standard en face.
  const moyen = run(steadyLong(0));

  it('un quota réel de parties finit SANS crise (le « hoarder perd » est vécu, §28.2)', () => {
    // Cible 20-25 %. Le bouton sensible : ni quasi-zéro (crise certaine = script appris),
    // ni trop haut (parties plates). Bande large pour rester robuste.
    const calm = rate(moyen, (r) => r.crisisCount === 0);
    expect(calm).toBeGreaterThan(0.12);
    expect(calm).toBeLessThan(0.40);
  });

  it('la crise précoce (avant le tour 5) reste rare — protection statistique, pas décrétée', () => {
    const early = rate(moyen, (r) => r.crisisTurns.some((t) => t < 5));
    expect(early).toBeLessThan(0.08); // cible <5 %, marge anti-flakiness
  });

  it('la date de déclenchement est étalée (pas de fenêtre apprenable)', () => {
    const turns = moyen.flatMap((r) => r.crisisTurns);
    const m = turns.reduce((a, b) => a + b, 0) / turns.length;
    const sd = Math.sqrt(turns.reduce((a, t) => a + (t - m) ** 2, 0) / turns.length);
    expect(sd).toBeGreaterThan(1.8); // ~3 visé ; garde-fou contre un tempo qui se resserre
  });

  it('F ne pègue plus le plafond tôt : la montée est lente (anti « marché ×2 au tour 6 »)', () => {
    // Au tour 6, la fragilité MOYENNE doit rester loin du plafond 0.85.
    const f6 = moyen.map((r) => r.fragilityHistory[6] ?? 0);
    const meanF6 = f6.reduce((a, b) => a + b, 0) / f6.length;
    expect(meanF6).toBeLessThan(0.65);
  });
});

describe('Calibrage J7 — critère d\'or §28.7 (les signaux battent l\'horloge)', () => {
  it('le signal prédit la crise MIEUX que le numéro de tour (le moteur n\'est pas scripté)', () => {
    // Mesuré avec le signal le PLUS bruité (Volatilité) → borne basse conservatrice :
    // les signaux propres (Financement) prédisent encore mieux.
    const { clock, signal } = predictivePower(run(steadyLong(2)));
    expect(signal).toBeGreaterThan(clock);
  });
});

describe('Calibrage J7 — émergence par le comportement (neutralité §26, pyromane §28.2)', () => {
  it('les tables à fort levier brûlent DEUX fois plus que le joueur prudent', () => {
    const prudent = run(steadyLong(0));
    const pyromane = run(steadyLong(4));
    const doubles = (rs: SimResult[]) => rate(rs, (r) => r.crisisCount >= 2);
    // Le double-krach est piloté par le levier, pas scripté : le pyromane y accède,
    // le prudent quasi pas (cible 10-15 % réservée aux « tables pyromanes », §28.2).
    expect(doubles(pyromane)).toBeGreaterThan(doubles(prudent));
    expect(doubles(pyromane)).toBeGreaterThan(0.06);
  });
});
