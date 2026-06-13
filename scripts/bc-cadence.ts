// Expérience — « la BC annonce de façon planifiée » (idée : FED statue tous les N tours,
// taux FIGÉ entre deux réunions au lieu d'un réajustement continu). On MESURE l'impact,
// on ne le devine pas : cadences 1 (continu, baseline) vs 4/5/6 tours.
//
// Lancer :  npx vite-node scripts/bc-cadence.ts [N]
//
// Deux familles de métriques :
//  (A) Physique systémique (bandes §28.2 / §28.8) : la cadence ne doit pas casser le tempo.
//  (B) Qualité de la BC comme « 4ᵉ signal » : à quel point r_BC suit F en temps réel
//      (tracking) et prédit la crise (corr ≤2 tours). C'est LE rôle de la BC → c'est là
//      que la cadence mord le plus.

import { buildInitialState } from '../src/engine/init';
import { runTurn } from '../src/engine/turn';
import { simulate } from '../src/engine/simulate';
import { steadyLong, alwaysReserve, type Policy } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';

const N = Number(process.argv[2] ?? 400);
const SEED = 1000;
const CADENCES = [1, 4, 5, 6]; // 1 = continu (baseline)

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const fx = (x: number, d = 2) => x.toFixed(d);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Corrélation de Pearson |·| (sert pour tracking et point-bisériale). */
function corr(xs: number[], ys: number[]): number {
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i]! - mx, b = ys[i]! - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return dx && dy ? Math.abs(num / Math.sqrt(dx * dy)) : 0;
}

const AIS = [policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];
const PROFILES: { name: string; policy: Policy }[] = [
  { name: 'hoarder', policy: alwaysReserve },
  { name: 'long 0x', policy: steadyLong(0) },
  { name: 'levier 2x', policy: steadyLong(2) },
  { name: 'levier 4x', policy: steadyLong(4) },
  { name: 'momentum', policy: policyForProfile(FONDS_LEVERAGE) },
  { name: 'value', policy: policyForProfile(VALUE_PATIENT) },
];

// ── (A) Distribution de crises agrégée multi-profils (§28.2) + neutralité (§28.8) ──
function physics(cadence: number) {
  const override = { paramsOverride: { bcMeetingEvery: cadence } };
  // Distribution agrégée sur les 6 profils joueur (la PHYSIQUE, pas un profil).
  let z = 0, o = 0, d = 0;
  for (const { policy } of PROFILES) {
    const rs = simulate({ ...presetMvp(SEED), ...override }, N, { policies: [policy, ...AIS] });
    z += rs.filter((r) => r.crisisCount === 0).length / N / PROFILES.length;
    o += rs.filter((r) => r.crisisCount === 1).length / N / PROFILES.length;
    d += rs.filter((r) => r.crisisCount >= 2).length / N / PROFILES.length;
  }
  // Neutralité : config par défaut (joueur réserve + 2 IA).
  const def = simulate({ ...presetMvp(SEED), ...override }, N);
  const ids = ['vautour', 'fonds_leverage', 'value_patient'] as const;
  const top1 = (id: string) =>
    def.filter((r) => ids.every((o2) => r.trackRecords[o2]!.score <= r.trackRecords[id]!.score)).length / N;
  const duel = def.filter((r) => r.trackRecords['fonds_leverage']!.score > r.trackRecords['value_patient']!.score).length / N;
  return { z, o, d, duel, topVautour: top1('vautour'), topLev: top1('fonds_leverage'), topValue: top1('value_patient') };
}

// ── (B) Qualité du signal BC : on rejoue la config par défaut en enregistrant r_BC ──
// `smoothing` optionnel : θ=1 = la BC SAUTE à la cible à chaque réunion (décision décisive)
// au lieu d'un pas graduel — pour séparer la STALENESS (figé entre réunions) du ralentissement.
function bcSignal(cadence: number, smoothing?: number) {
  const bcAll: number[] = [], fAll: number[] = [];        // contemporain : r_BC vs F
  const lvl: number[] = [], dlt: number[] = [], lab: number[] = []; // prédictif : crise ≤2t
  const policies: Policy[] = [alwaysReserve, ...AIS];
  for (let i = 0; i < N; i++) {
    const override = { bcMeetingEvery: cadence, ...(smoothing != null ? { bcSmoothing: smoothing } : {}) };
    const { state, rng } = buildInitialState({ ...presetMvp(SEED + i), paramsOverride: override });
    const horizon = state.params.horizonTurns;
    const bc: number[] = [];
    for (let t = 0; t < horizon; t++) {
      runTurn(state, policies, rng);
      bc.push(state.credit.bc.rate);
    }
    const crises = new Set(state.crisisTurns);
    for (let t = 0; t < bc.length; t++) {
      const tau = t + 1; // bc[t] = taux après le tour τ=t+1 ; fragilityHistory aligné
      bcAll.push(bc[t]!); fAll.push(state.fragilityHistory[tau] ?? state.fragility);
      lvl.push(bc[t]!); dlt.push(bc[t]! - (bc[t - 1] ?? bc[t]!));
      lab.push(crises.has(tau) || crises.has(tau + 1) || crises.has(tau + 2) ? 1 : 0);
    }
  }
  return {
    tracking: corr(bcAll, fAll),     // r_BC suit-il F en temps réel ? (↑ = meilleur signal)
    predLevel: corr(lvl, lab),       // le NIVEAU du taux prédit-il la crise ≤2t ?
    predDelta: corr(dlt, lab),       // la HAUSSE récente (« la BC resserre ») prédit-elle ?
  };
}

console.log(`\n=== EXPÉRIENCE BC — annonce planifiée · ${N} parties/cellule · seed ${SEED} ===\n`);

console.log('(A) Physique systémique — distribution de crises (cible §28.2 : 20-25 / ~60 / 10-15)');
console.log(['cadence', 'sans crise', '1 crise', '2+ crises'].map((s) => s.padEnd(11)).join('| '));
const physRows = CADENCES.map((c) => ({ c, ...physics(c) }));
for (const r of physRows) {
  console.log([`${r.c === 1 ? 'continu' : 'tous ' + r.c + 't'}`.padEnd(11),
    pct(r.z).padEnd(11), pct(r.o).padEnd(11), pct(r.d).padEnd(11)].join('| '));
}

console.log('\n(A) Neutralité §28.8 — config par défaut (duel ~40-60 %, chaque profil top1 > 5 %)');
console.log(['cadence', 'duel lev>val', 'top1 vautour', 'top1 levier', 'top1 value'].map((s) => s.padEnd(13)).join('| '));
for (const r of physRows) {
  console.log([`${r.c === 1 ? 'continu' : 'tous ' + r.c + 't'}`.padEnd(13),
    pct(r.duel).padEnd(13), pct(r.topVautour).padEnd(13), pct(r.topLev).padEnd(13), pct(r.topValue).padEnd(13)].join('| '));
}

console.log('\n(B) Qualité de la BC comme 4ᵉ signal (↑ tracking = r_BC colle à F ; ↑ pred = annonce la crise)');
console.log(['cadence', 'tracking r_BC~F', 'pred niveau≤2t', 'pred hausse≤2t'].map((s) => s.padEnd(16)).join('| '));
for (const c of CADENCES) {
  const s = bcSignal(c);
  console.log([`${c === 1 ? 'continu' : 'tous ' + c + 't'}`.padEnd(16),
    fx(s.tracking).padEnd(16), fx(s.predLevel).padEnd(16), fx(s.predDelta).padEnd(16)].join('| '));
}

console.log('\n(B\') Variante DÉCISIVE — la BC saute à la cible à chaque réunion (θ=1)');
console.log(['cadence', 'tracking r_BC~F', 'pred niveau≤2t', 'pred hausse≤2t'].map((s) => s.padEnd(16)).join('| '));
for (const c of CADENCES.filter((c) => c > 1)) {
  const s = bcSignal(c, 1);
  console.log([`tous ${c}t (θ=1)`.padEnd(16),
    fx(s.tracking).padEnd(16), fx(s.predLevel).padEnd(16), fx(s.predDelta).padEnd(16)].join('| '));
}
console.log('');
