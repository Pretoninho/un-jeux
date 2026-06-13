// Instrument de calibrage J7 (memo §28). NON couplé au moteur : il ne fait que
// REJOUER des parties via le harness `simulate` et mesurer des distributions, pour
// les comparer aux cibles §28.2 / §28.7. On ne force jamais le timing — on lit, on
// règle les paramètres générateurs (params.ts), on relit.
//
// Lancer :  npx vite-node scripts/calibrate.ts [N]
//
// Rappel des cibles (memo §28.2, sur ~1000 parties, multi-profils §28.8) :
//   • exactement 1 crise        ~60 %
//   • 2 crises                  ~10-15 %
//   • AUCUNE crise              ~20-25 %   (le « hoarder perd » doit être vécu)
//   • crise avant le tour 5     < 5 % mais jamais impossible
//   • écart-type de la date     large (~3 tours)
//   • montée/chute              ≥ 2:1 (§28.6)
//   • §28.7 : l'horloge prédit la crise BIEN MOINS que les signaux

import { simulate, type SimResult } from '../src/engine/simulate';
import { steadyLong, alwaysReserve, type Policy } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';
import { maxDrawdown, totalReturn } from '../src/engine/score';

const N = Number(process.argv[2] ?? 1000);
const SEED = 1000;

// Le slot 0 (« joueur ») est rejoué avec plusieurs profils : on calibre la PHYSIQUE,
// pas un profil (§28.8). Les deux IA standard restent en face.
const playerProfiles: { name: string; policy: Policy }[] = [
  { name: 'hoarder (tout-réserve)', policy: alwaysReserve },
  { name: 'long sans levier', policy: steadyLong(0) },
  { name: 'levier 2x', policy: steadyLong(2) },
  { name: 'levier 4x', policy: steadyLong(4) },
  { name: 'momentum (IA leverage)', policy: policyForProfile(FONDS_LEVERAGE) },
  { name: 'value (IA patient)', policy: policyForProfile(VALUE_PATIENT) },
];

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const fx = (x: number, d = 2) => x.toFixed(d);

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
}

/**
 * Critère §28.7 — « les signaux battent l'horloge ». Corrélation point-bisériale
 * entre « une crise se déclenche dans ≤2 tours » et (a) le numéro de tour,
 * (b) le signal Volatilité (proxy observable de F). On veut |corr_signal| nettement
 * > |corr_horloge| : sinon le tempo est devenu un script.
 */
function clockVsSignal(results: SimResult[]): { clock: number; signal: number } {
  const turn: number[] = [];
  const sig: number[] = [];
  const label: number[] = [];
  for (const r of results) {
    const crisisSet = new Set(r.crisisTurns);
    // signalsHistory[t] correspond à l'état observé au tour t.
    for (let t = 0; t < r.signalsHistory.length; t++) {
      const willCrise = crisisSet.has(t) || crisisSet.has(t + 1) || crisisSet.has(t + 2) ? 1 : 0;
      turn.push(t);
      sig.push(r.signalsHistory[t]!.volatilite);
      label.push(willCrise);
    }
  }
  const corr = (xs: number[]) => {
    const mx = mean(xs), my = mean(label);
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < xs.length; i++) {
      const a = xs[i]! - mx, b = label[i]! - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    return dx && dy ? num / Math.sqrt(dx * dy) : 0;
  };
  return { clock: Math.abs(corr(turn)), signal: Math.abs(corr(sig)) };
}

interface Row {
  name: string;
  zero: number; one: number; twoPlus: number;
  early: number; // crise avant tour 5
  turnMean: number; turnStd: number;
  benchRet: number; // amplitude marché (médiane)
  ddPlayer: number; // drawdown joueur médian
  clock: number; signal: number;
}

function measure(name: string, policy: Policy): Row {
  const results = simulate(presetMvp(SEED), N, {
    policies: [policy, policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)],
  });
  const counts = results.map((r) => r.crisisCount);
  const zero = results.filter((r) => r.crisisCount === 0).length / N;
  const one = results.filter((r) => r.crisisCount === 1).length / N;
  const twoPlus = results.filter((r) => r.crisisCount >= 2).length / N;
  const allTurns = results.flatMap((r) => r.crisisTurns);
  const early = allTurns.length ? allTurns.filter((t) => t < 5).length / allTurns.length : 0;
  const dds = results.map((r) => r.playerTrackRecord.maxDrawdown);
  const { clock, signal } = clockVsSignal(results);
  void counts;
  return {
    name,
    zero, one, twoPlus, early,
    turnMean: mean(allTurns), turnStd: stddev(allTurns),
    benchRet: quantile(results.map((r) => r.benchmarkReturn), 0.5),
    ddPlayer: quantile(dds, 0.5),
    clock, signal,
  };
}

console.log(`\n=== CALIBRAGE J7 — ${N} parties/profil, seed ${SEED}, 2 IA standard en face ===\n`);
console.log(
  ['profil joueur', '0 crise', '1 crise', '2+', 'crise<t5', 'date moy', 'date σ', 'marché', 'DD joueur', 'corr horl', 'corr sig'].join(' | '),
);
const rows: Row[] = [];
for (const { name, policy } of playerProfiles) {
  const row = measure(name, policy);
  rows.push(row);
  console.log(
    [
      name.padEnd(22),
      pct(row.zero).padStart(7),
      pct(row.one).padStart(7),
      pct(row.twoPlus).padStart(5),
      pct(row.early).padStart(8),
      fx(row.turnMean, 1).padStart(8),
      fx(row.turnStd, 1).padStart(6),
      pct(row.benchRet).padStart(7),
      pct(row.ddPlayer).padStart(9),
      fx(row.clock).padStart(9),
      fx(row.signal).padStart(8),
    ].join(' | '),
  );
}

// Agrégat multi-profils (§28.8) : la cible doit tenir SUR L'ENSEMBLE.
const agg = {
  zero: mean(rows.map((r) => r.zero)),
  one: mean(rows.map((r) => r.one)),
  twoPlus: mean(rows.map((r) => r.twoPlus)),
};
console.log(`\n--- Agrégat multi-profils (cible §28.2) ---`);
console.log(`  sans crise : ${pct(agg.zero)}   (cible 20-25%)`);
console.log(`  1 crise    : ${pct(agg.one)}   (cible ~60%)`);
console.log(`  2+ crises  : ${pct(agg.twoPlus)}   (cible 10-15%)`);

// Trajectoire MOYENNE de F (vraie courbe cachée) — pour voir la vitesse de montée.
// On la calcule sur deux profils contrastés. La zone morte est à 0.40.
function fTrajectory(policy: Policy): number[] {
  const results = simulate(presetMvp(SEED), N, {
    policies: [policy, policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)],
  });
  const maxLen = Math.max(...results.map((r) => r.fragilityHistory.length));
  const out: number[] = [];
  for (let t = 0; t < maxLen; t++) {
    const vals = results.map((r) => r.fragilityHistory[t]).filter((x): x is number => x != null);
    out.push(mean(vals));
  }
  return out;
}
console.log(`\n--- Trajectoire moyenne de F par tour (zone morte=0.40, plafond=0.85) ---`);
for (const name of ['hoarder (tout-réserve)', 'levier 4x']) {
  const policy = playerProfiles.find((p) => p.name === name)!.policy;
  const traj = fTrajectory(policy);
  console.log(`  ${name.padEnd(22)} : ${traj.map((f) => f.toFixed(2)).join(' ')}`);
}
console.log('');
