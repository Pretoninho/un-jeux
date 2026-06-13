// Expérience — impact de l'HORIZON (durée d'une partie) sur la physique calibrée.
// Le taux de crise §28.2 est calé SUR la durée d'un cycle (~13-16t). Étendre l'horizon
// déplace la distribution : on mesure de combien, pour savoir s'il faut re-caler les
// drivers d'accumulation (garder ~1 crise) ou assumer un jeu multi-cycles.
//
// Lancer :  npx vite-node scripts/horizon.ts [N]

import { simulate } from '../src/engine/simulate';
import { steadyLong, alwaysReserve, type Policy } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';

const N = Number(process.argv[2] ?? 400);
const SEED = 1000;
const HORIZONS = [15, 20, 24, 28, 32, 40];

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const fx = (x: number, d = 2) => x.toFixed(d);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const AIS = [policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];
const PROFILES: Policy[] = [
  alwaysReserve, steadyLong(0), steadyLong(2), steadyLong(4),
  policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT),
];

console.log(`\n=== EXPÉRIENCE HORIZON — ${N} parties/cellule · seed ${SEED} ===\n`);
console.log('Distribution de crises agrégée sur 6 profils joueur (cible 1-cycle : 20-25 / ~60 / 10-15)');
console.log(['horizon', 'sans crise', '1 crise', '2+ crises', '3+ crises', 'crises/partie', 'duel lev>val'].map((s) => s.padEnd(13)).join('| '));

for (const H of HORIZONS) {
  const override = { paramsOverride: { horizonTurns: H } };
  let z = 0, o = 0, two = 0, three = 0, cm = 0;
  for (const policy of PROFILES) {
    const rs = simulate({ ...presetMvp(SEED), ...override }, N, { policies: [policy, ...AIS] });
    z += rs.filter((r) => r.crisisCount === 0).length / N / PROFILES.length;
    o += rs.filter((r) => r.crisisCount === 1).length / N / PROFILES.length;
    two += rs.filter((r) => r.crisisCount >= 2).length / N / PROFILES.length;
    three += rs.filter((r) => r.crisisCount >= 3).length / N / PROFILES.length;
    cm += mean(rs.map((r) => r.crisisCount)) / PROFILES.length;
  }
  const def = simulate({ ...presetMvp(SEED), ...override }, N);
  const duel = def.filter((r) => r.trackRecords['fonds_leverage']!.score > r.trackRecords['value_patient']!.score).length / N;
  console.log([`${H}t`.padEnd(13), pct(z).padEnd(13), pct(o).padEnd(13), pct(two).padEnd(13),
    pct(three).padEnd(13), fx(cm).padEnd(13), pct(duel).padEnd(13)].join('| '));
}
console.log('');

// ── Faisabilité PATH A : étendre l'horizon MAIS ralentir l'accumulation de F pour
//    récupérer la distribution 1-cycle (§28.2). On scale les 3 drivers d'accumulation. ──
console.log('PATH A — horizon étendu + accumulation ralentie (récupère-t-on 20-25 / 60 / 10-15 ?)');
console.log(['horizon · accScale', 'sans crise', '1 crise', '2+ crises', 'crises/partie'].map((s) => s.padEnd(13)).join('| '));
const MID = { accLeverage: 0.135, accCrowding: 0.0275, accValuation: 0.0015 };
for (const [H, scale] of [[20, 0.75], [20, 0.65], [24, 0.65], [24, 0.55], [28, 0.5]] as [number, number][]) {
  const override = {
    paramsOverride: {
      horizonTurns: H,
      accLeverage: MID.accLeverage * scale,
      accCrowding: MID.accCrowding * scale,
      accValuation: MID.accValuation * scale,
    },
  };
  let z = 0, o = 0, two = 0, cm = 0;
  for (const policy of PROFILES) {
    const rs = simulate({ ...presetMvp(SEED), ...override }, N, { policies: [policy, ...AIS] });
    z += rs.filter((r) => r.crisisCount === 0).length / N / PROFILES.length;
    o += rs.filter((r) => r.crisisCount === 1).length / N / PROFILES.length;
    two += rs.filter((r) => r.crisisCount >= 2).length / N / PROFILES.length;
    cm += mean(rs.map((r) => r.crisisCount)) / PROFILES.length;
  }
  console.log([`${H}t · ×${scale}`.padEnd(13), pct(z).padEnd(13), pct(o).padEnd(13), pct(two).padEnd(13), fx(cm).padEnd(13)].join('| '));
}
console.log('');
