// Mesure — « connaître le taux BC en avance » donne-t-il un avantage significatif ?
// Un joueur macro se met RISK-OFF (ferme tout, cash) quand son signal de danger dépasse un
// seuil, RISK-ON (déploie 50 % du cash en actions, SANS levier) sinon. On compare le SIGNAL :
//   - 'long'   : jamais de timing (toujours exposé) = plancher
//   - 'level'  : taux BC COURANT (public, connu de tous)
//   - 'ahead'  : taux BC de la PROCHAINE réunion (forward guidance = l'edge du Sismographe)
//   - 'oracle' : la fragilité F cachée elle-même (timing PARFAIT = plafond)
//
// Lancer :  npx vite-node scripts/sismo-bc-edge.ts [N]

import { simulate, type SimResult } from '../src/engine/simulate';
import { type Policy, type PlannedAction } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { NEUTRE } from '../src/data/archetypes/neutre';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';

const N = Number(process.argv[2] ?? 400);
const SEED = 1000;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const sp = (x: number) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(0)}%`;
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };
const AIS = [policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];

type Mode = 'long' | 'level' | 'ahead' | 'oracle';
// Seuils : taux BC élevé ≈ surchauffe ; F élevée pour l'oracle.
function macro(mode: Mode, rateThr: number, fThr: number): Policy {
  return {
    id: 'macro',
    decide(actor, state) {
      const danger =
        mode === 'long' ? false
        : mode === 'level' ? state.credit.bc.rate > rateThr
        : mode === 'ahead' ? state.credit.bc.target > rateThr // décision de la prochaine réunion
        : state.fragility > fThr; // oracle
      if (danger) {
        // risk-off : fermer toutes les positions (retour au cash).
        const hexes = [...new Set(actor.positions.map((p) => p.hexId))];
        return hexes.length ? hexes.map((h) => ({ verb: 'POSITIONNER', op: 'fermer', hexId: h } as PlannedAction)) : [{ verb: 'RESERVER' }];
      }
      // risk-on : déployer si pas exposé (actions, sans levier).
      if (actor.positions.length === 0 && actor.cash > 1) {
        return [{ verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: actor.cash * 0.5, leverage: 0, direction: 'long' } as PlannedAction];
      }
      return [{ verb: 'RESERVER' }];
    },
  };
}

const top1 = (rs: SimResult[]) => rs.filter((r) => ['fonds_leverage', 'value_patient'].every((o) => r.trackRecords[o]!.score <= r.trackRecords['neutre']!.score)).length / rs.length;
const excMed = (rs: SimResult[]) => med(rs.map((r) => r.playerTrackRecord.excessReturn));
const ddMed = (rs: SimResult[]) => med(rs.map((r) => r.playerTrackRecord.maxDrawdown));

function run(mode: Mode, rateThr: number, fThr: number) {
  return simulate({ ...presetMvp(SEED), archetype: NEUTRE }, N, { policies: [macro(mode, rateThr, fThr), ...AIS] });
}

console.log(`\n=== « Taux BC en avance » : avantage ? · ${N} parties · horizon 28-40 ===`);
console.log('Macro : risk-off si signal > seuil, risk-on sinon. On lit l\'écart ahead − level.\n');
console.log(['signal', 'top1', 'excédent médian', 'drawdown médian'].map((s) => s.padEnd(17)).join('| '));

const RATE_THR = 0.025, F_THR = 0.6;
for (const mode of ['long', 'level', 'ahead', 'oracle'] as Mode[]) {
  const rs = run(mode, RATE_THR, F_THR);
  const label = { long: 'aucun (exposé)', level: 'taux courant (public)', ahead: 'taux +1 (forward guid.)', oracle: 'F cachée (parfait)' }[mode];
  console.log([label.padEnd(17), pct(top1(rs)).padEnd(17), sp(excMed(rs)).padEnd(17), pct(ddMed(rs)).padEnd(17)].join('| '));
}

// Sensibilité au seuil (level vs ahead) — l'edge « en avance » tient-il sur la plage ?
console.log('\n— Écart ahead − level selon le seuil de taux —');
console.log(['seuil taux', 'top1 level', 'top1 ahead', 'Δ (avance)'].map((s) => s.padEnd(14)).join('| '));
for (const thr of [0.018, 0.022, 0.026, 0.03]) {
  const lvl = top1(run('level', thr, F_THR));
  const ah = top1(run('ahead', thr, F_THR));
  console.log([`${(thr * 100).toFixed(1)} %`.padEnd(14), pct(lvl).padEnd(14), pct(ah).padEnd(14), sp(ah - lvl).padEnd(14)].join('| '));
}
console.log('');
