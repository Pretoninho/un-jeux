// Validation — le Sismographe CÂBLÉ (archétype SISMOGRAPHE : jauge + thêta moteur) reproduit-il
// les ~38 % neutres du panel ? Politique : lit F (jauge), risk-off si F>0.55, frappe (100 %) si
// F<0.45. Le thêta est appliqué par le MOTEUR (calmTheta), pas par le script.
//
// Lancer :  npx vite-node scripts/sismo-validate.ts [N]

import { simulate, type SimResult } from '../src/engine/simulate';
import { type Policy, type PlannedAction } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { SISMOGRAPHE } from '../src/data/archetypes/sismographe';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';

const N = Number(process.argv[2] ?? 400);
const SEED = 1000;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const sp = (x: number) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(0)}%`;
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };
const AIS = [policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];
const IDS = ['sismographe', 'fonds_leverage', 'value_patient'] as const;

const sismo: Policy = {
  id: 'sismo',
  decide(actor, state) {
    const F = state.fragility;
    if (F > 0.55) {
      const hexes = [...new Set(actor.positions.map((p) => p.hexId))];
      return hexes.length ? hexes.map((h) => ({ verb: 'POSITIONNER', op: 'fermer', hexId: h } as PlannedAction)) : [{ verb: 'RESERVER' }];
    }
    if (F < 0.45 && actor.positions.length === 0 && actor.cash > 1) {
      return [{ verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: actor.cash, leverage: 0, direction: 'long' } as PlannedAction];
    }
    return [{ verb: 'RESERVER' }];
  },
};

const top1 = (rs: SimResult[]) => rs.filter((r) => IDS.every((o) => r.trackRecords[o]!.score <= r.trackRecords['sismographe']!.score)).length / rs.length;
const duel = (rs: SimResult[]) => rs.filter((r) => r.trackRecords['fonds_leverage']!.score > r.trackRecords['value_patient']!.score).length / rs.length;

console.log(`\n=== VALIDATION Sismographe (moteur) · ${N} parties · horizon 28-40 ===`);
console.log('Attendu : sans thêta ~50 % (jauge+frappe) · avec thêta 0.5 % ~38 % (neutre).\n');
console.log(['config', 'top1', 'excédent médian', 'duel fonds>value'].map((s) => s.padEnd(16)).join('| '));
for (const [label, theta] of [['sans thêta (θ=0)', 0], ['LIVE (θ=0.5 %)', 0.005]] as [string, number][]) {
  const rs = simulate({ ...presetMvp(SEED), archetype: { ...SISMOGRAPHE, calmTheta: theta } }, N, { policies: [sismo, ...AIS] });
  const exc = med(rs.map((r) => r.playerTrackRecord.excessReturn));
  console.log([label.padEnd(16), pct(top1(rs)).padEnd(16), sp(exc).padEnd(16), pct(duel(rs)).padEnd(16)].join('| '));
}
console.log('');
