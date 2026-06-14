// Mesure du Vautour « déployeur de crise » : ressource Réserve sèche (décote d'entrée en haute
// fragilité) + contrainte noLeverage. Le joueur RÉSERVE (banque la poudre) puis DÉPLOIE son cash
// dans le marché quand une crise frappe (regime crise = il voit le krach). On compare :
//  - NEUTRE (peut leviérer, pas de ressource) = référence d'un déployeur « libre » ;
//  - Vautour SANS ressource (noLeverage seul) = coût de la CONTRAINTE ;
//  - Vautour PLEIN (noLeverage + décote) = net, et sweep de la décote.
//
// Lancer :  npx vite-node scripts/vautour-resource.ts [N]

import { simulate, type SimResult } from '../src/engine/simulate';
import { type Policy, type PlannedAction } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { VAUTOUR } from '../src/data/archetypes/vautour';
import { NEUTRE } from '../src/data/archetypes/neutre';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';
import type { Archetype } from '../src/engine/types';

const N = Number(process.argv[2] ?? 400);
const SEED = 1000;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const sp = (x: number) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(0)}%`;
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };
const IDS = ['vautour', 'fonds_leverage', 'value_patient', 'neutre'] as const;
const AIS = [policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];

// Déployeur : réserve (banque la poudre) tant que pas de crise ; déploie 50 % du cash dans
// le marché quand une crise frappe (levier 3 demandé → rogné à 0 si noLeverage).
const deployer: Policy = {
  id: 'deployer',
  decide(actor, state) {
    if (state.regime === 'crise' && actor.cash > 1) {
      return [{ verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: actor.cash * 0.5, leverage: 3, direction: 'long' } as PlannedAction];
    }
    return [{ verb: 'RESERVER' }];
  },
};

function run(arch: Archetype) {
  const rs = simulate({ ...presetMvp(SEED), archetype: arch }, N, { policies: [deployer, ...AIS] });
  const id = arch.id; // slot 0 = id de l'archétype
  const top1 = rs.filter((r) => ['fonds_leverage', 'value_patient'].every((o) => r.trackRecords[o]!.score <= r.trackRecords[id]!.score)).length / N;
  const exc = med(rs.map((r) => r.playerTrackRecord.excessReturn));
  const dd = rs.filter((r: SimResult) => r.crisisCount >= 2).length / N;
  return { top1, exc, dd };
}

console.log(`\n=== VAUTOUR « déployeur de crise » — ressource + contrainte · ${N} parties · horizon 28-40 ===`);
console.log('Cible : top1 ~33-45 % (vs 2 IA). La contrainte noLeverage doit ~compenser la décote.\n');
console.log(['config', 'top1', 'excédent médian', '2+ crises'].map((s) => s.padEnd(18)).join('| '));

const rows: [string, Archetype][] = [
  ['NEUTRE (libre, lev3)', NEUTRE],
  ['Vautour sans ressource', { ...VAUTOUR, dryPowder: undefined }],
  ['Vautour PLEIN (déc.10%)', VAUTOUR],
];
for (const [label, arch] of rows) {
  const r = run(arch);
  console.log([label.padEnd(18), pct(r.top1).padEnd(18), sp(r.exc).padEnd(18), pct(r.dd).padEnd(18)].join('| '));
}

console.log('\n— Sweep de la décote max (Vautour, noLeverage) —');
console.log(['décote max', 'top1', 'excédent médian'].map((s) => s.padEnd(18)).join('| '));
for (const maxDiscount of [0, 0.05, 0.1, 0.15, 0.2]) {
  const arch: Archetype = { ...VAUTOUR, dryPowder: { max: 8, discountPerPowder: maxDiscount / 8, maxDiscount, fThreshold: 0.55 } };
  const r = run(arch);
  console.log([`${(maxDiscount * 100).toFixed(0)} %`.padEnd(18), pct(r.top1).padEnd(18), sp(r.exc).padEnd(18)].join('| '));
}
console.log('');
