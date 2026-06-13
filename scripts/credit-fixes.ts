// Mesure ITÉRATIVE des fixes crédit (on ajoute un fix à la fois jusqu'à ce que le baseline
// coupon retombe dans la bande neutre ~33-40 % top1). Les fixes vivent dans le moteur derrière
// des flags (défaut 0) ; ici on les active via paramsOverride. Aucun défaut de jeu changé.
//
// Lancer :  npx vite-node scripts/credit-fixes.ts [N]

import { simulate, type SimResult } from '../src/engine/simulate';
import { alwaysReserve, type Policy, type PlannedAction } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';
import type { InstanceParams } from '../src/engine/params';

const N = Number(process.argv[2] ?? 400);
const SEED = 1000;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const IDS = ['vautour', 'fonds_leverage', 'value_patient'] as const;
const AIS = [policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];

const harvester: Policy = {
  id: 'harvester',
  decide(actor, state) {
    if (actor.cash < 1 || state.credit.book.length === 0) return [{ verb: 'RESERVER' }];
    const best = state.credit.book.reduce((b, c) => (c.rate > b.rate ? c : b));
    return [{ verb: 'POSITIONNER', op: 'ouvrir_coupon', issuer: best.issuer, maturity: best.maturity, notional: actor.cash * 0.3, direction: 'long' } as PlannedAction];
  },
};

const top1 = (rs: SimResult[], id: string) =>
  rs.filter((r) => IDS.every((o) => r.trackRecords[o]!.score <= r.trackRecords[id]!.score)).length / rs.length;
const dist = (rs: SimResult[]) => ({
  z: rs.filter((r) => r.crisisCount === 0).length / rs.length,
  o: rs.filter((r) => r.crisisCount === 1).length / rs.length,
  d: rs.filter((r) => r.crisisCount >= 2).length / rs.length,
});

function row(label: string, override: Partial<InstanceParams>) {
  // (1) Baseline coupon : harvester vs 2 IA → sa part de victoires (cible ~33-40 %).
  const harv = simulate({ ...presetMvp(SEED), paramsOverride: override }, N, { policies: [harvester, ...AIS] });
  // (2) Config par défaut (neutralité §28.8) : vautour réserve + 2 IA.
  const def = simulate({ ...presetMvp(SEED), paramsOverride: override }, N, { policies: [alwaysReserve, ...AIS] });
  const hd = dist(harv), dd = dist(def);
  const duel = def.filter((r) => r.trackRecords['fonds_leverage']!.score > r.trackRecords['value_patient']!.score).length / N;
  console.log([
    label.padEnd(26),
    pct(top1(harv, 'vautour')).padStart(10),          // top1 du harvester
    `${pct(hd.z)}/${pct(hd.o)}/${pct(hd.d)}`.padStart(20), // crises quand le harvester joue
    pct(duel).padStart(7),                             // neutralité (défaut)
    `${pct(dd.z)}/${pct(dd.o)}/${pct(dd.d)}`.padStart(20), // crises config défaut
  ].join(' | '));
}

console.log(`\n=== FIXES CRÉDIT (itératif) · ${N} parties/cellule · horizon 28-40 ===`);
console.log('Cible : top1 harvester ~33-40 % · duel 40-60 % · distrib défaut ≈ 8/46/45 (inchangée)\n');
console.log(['config', 'top1 harvester', 'crises (harvester joue)', 'duel', 'crises (défaut)'].map((s, i) => i === 0 ? s.padEnd(26) : s).join(' | '));

row('baseline (Fix A off)', { fixLeverageDenom: 0 });
row('+ Fix A (dénom. levier)', { fixLeverageDenom: 1 });
console.log('');
