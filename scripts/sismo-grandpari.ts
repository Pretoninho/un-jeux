// Panel « Le Grand Pari » — geste ACTIF du Sismographe : engager avec conviction (amplifié) dans
// le sens appelé. On compare 3 jeux, thêta moteur (archétype SISMOGRAPHE) :
//   base    : risk-off cash + LONG all-in au creux SANS levier (= Sismographe actuel)
//   longLev : risk-off cash + LONG all-in au creux AVEC levier L (frappe amplifiée)
//   short   : SHORT levier L AVANT le krach (pari sur la chute) + LONG levier L au creux
// On sweepe le thêta pour ramener à la neutralité (~38 %).
//
// Lancer :  npx vite-node scripts/sismo-grandpari.ts [N]

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

type Mode = 'base' | 'longLev' | 'short';
function sismo(mode: Mode, L: number): Policy {
  return {
    id: 'sismo',
    decide(actor, state) {
      const F = state.fragility; // jauge
      const hasLong = actor.positions.some((p) => p.direction === 'long');
      const hasShort = actor.positions.some((p) => p.direction === 'short');
      const close: PlannedAction = { verb: 'POSITIONNER', op: 'fermer', hexId: 'LC_US' };
      if (F > 0.55) {
        if (mode === 'short') {
          if (hasLong) return [close]; // ferme le long d'abord
          if (!hasShort && actor.cash > 1) return [{ verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: actor.cash * 0.5, leverage: L, direction: 'short' } as PlannedAction];
          return [{ verb: 'RESERVER' }];
        }
        return actor.positions.length ? [close] : [{ verb: 'RESERVER' }]; // risk-off cash
      }
      if (F < 0.45) {
        if (hasShort) return [close]; // couvre le short
        if (!hasLong && actor.cash > 1) {
          const lev = mode === 'base' ? 0 : L; // base = frappe sans levier
          return [{ verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: actor.cash, leverage: lev, direction: 'long' } as PlannedAction];
        }
        return [{ verb: 'RESERVER' }];
      }
      return [{ verb: 'RESERVER' }];
    },
  };
}

const top1 = (rs: SimResult[]) => rs.filter((r) => IDS.every((o) => r.trackRecords[o]!.score <= r.trackRecords['sismographe']!.score)).length / rs.length;
const excMed = (rs: SimResult[]) => med(rs.map((r) => r.playerTrackRecord.excessReturn));
const ddMed = (rs: SimResult[]) => med(rs.map((r) => r.playerTrackRecord.maxDrawdown));

function cell(mode: Mode, L: number, theta: number) {
  const rs = simulate({ ...presetMvp(SEED), archetype: { ...SISMOGRAPHE, calmTheta: theta } }, N, { policies: [sismo(mode, L), ...AIS] });
  return { top1: top1(rs), exc: excMed(rs), dd: ddMed(rs) };
}

console.log(`\n=== PANEL « Le Grand Pari » — Sismographe actif (levier × thêta) · ${N} parties ===`);
console.log('Cible : top1 ~33-45 %, et un jeu plus ACTIF (short / frappe amplifiée).\n');

const variants: [string, Mode, number][] = [
  ['base (actuel, sans levier)', 'base', 0],
  ['SHORT le krach SANS levier', 'short', 0],
  ['LONG amplifié ×2', 'longLev', 2],
  ['SHORT le krach ×2 + LONG ×2', 'short', 2],
  ['SHORT le krach ×3 + LONG ×3', 'short', 3],
];
for (const [label, mode, L] of variants) {
  console.log(`— ${label} —`);
  console.log(['thêta', 'top1', 'excédent médian', 'drawdown médian'].map((s) => s.padEnd(15)).join('| '));
  for (const theta of [0.005, 0.0065, 0.008]) {
    const r = cell(mode, L, theta);
    console.log([`${(theta * 100).toFixed(1)} %`.padEnd(15), pct(r.top1).padEnd(15), sp(r.exc).padEnd(15), pct(r.dd).padEnd(15)].join('| '));
  }
  console.log('');
}
