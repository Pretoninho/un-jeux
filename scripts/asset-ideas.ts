// Panel d'exploration — DEUX idées créateur (mesure seule, AUCUN code moteur modifié) :
//  IDÉE 1 : le carry des ACTIONS = un dividende versé moins souvent (tous les 2-3 tours,
//           hold-to-collect : seul qui détient à la date de paiement encaisse). Pénalise-t-il ?
//  IDÉE 2 : réserver le LEVIER aux ACTIONS (plus de levier sur les alternatifs, ex. PEVC).
//
// Les deux sont modélisées en WRAPPERS : idée 1 par un post-traitement de la trésorerie
// (on défait le carry-actions par tour et on le re-verse en bloc), idée 2 par un wrapper de
// politique qui force leverage=0 hors actions. Moteur intact.
//
// Lancer :  npx vite-node scripts/asset-ideas.ts [N]

import { buildInitialState } from '../src/engine/init';
import { runTurn } from '../src/engine/turn';
import { simulate } from '../src/engine/simulate';
import { trackRecord } from '../src/engine/score';
import { alwaysReserve, type Policy, type PlannedAction } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';
import { MVP_MAP } from '../src/data/maps/mvp-16';

const N = Number(process.argv[2] ?? 400);
const SEED = 1000;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const sp = (x: number) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(0)}%`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const IDS = ['vautour', 'fonds_leverage', 'value_patient'] as const;
const clusterOf = new Map(MVP_MAP.hexes.map((h) => [h.id, h.cluster]));
const carryOf = new Map(MVP_MAP.hexes.map((h) => [h.id, h.carry ?? 0]));

// ───────────────────── IDÉE 1 : dividende actions tous les `freq` tours ─────────────────
// Run de la config par défaut ; on défait le carry-actions versé par le moteur chaque tour,
// et on le re-verse en BLOC (× freq) tous les `freq` tours aux détenteurs du moment.
function dividend(freq: number) {
  const policies: Policy[] = [alwaysReserve, policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];
  const top1: Record<string, number> = { vautour: 0, fonds_leverage: 0, value_patient: 0 };
  let valScore = 0, duel = 0, z = 0, o = 0, d = 0;
  for (let i = 0; i < N; i++) {
    const { state, rng } = buildInitialState(presetMvp(SEED + i));
    const H = state.params.horizonTurns;
    for (let t = 1; t <= H; t++) {
      runTurn(state, policies, rng);
      for (const a of state.actors) {
        // Carry-actions que le moteur vient de verser ce tour (notionnel × carry, hexes 'actions').
        let eqCarry = 0;
        for (const p of a.positions) {
          if (clusterOf.get(p.hexId) === 'actions') eqCarry += p.equity * (1 + p.leverage) * (carryOf.get(p.hexId) ?? 0);
        }
        a.cash -= eqCarry;                 // on le défait (le dividende n'est plus continu)
        if (t % freq === 0) a.cash += freq * eqCarry; // versé en bloc, hold-to-collect (détenteurs du moment)
      }
    }
    const alpha = state.params.drawdownPenalty;
    const tr = Object.fromEntries(state.actors.map((a) => [a.id, trackRecord(a, state.benchmarkHistory, alpha)]));
    valScore += tr['value_patient']!.score / N;
    const best = IDS.reduce((b, id) => (tr[id]!.score > tr[b]!.score ? id : b), IDS[0]);
    top1[best] += 1 / N;
    if (tr['fonds_leverage']!.score > tr['value_patient']!.score) duel += 1 / N;
    const cc = state.crisisTurns.length;
    if (cc === 0) z += 1 / N; else if (cc === 1) o += 1 / N; else d += 1 / N;
  }
  return { top1, valScore, duel, z, o, d };
}

// ───────────────────── IDÉE 2 : levier réservé aux actions ──────────────────────────────
function leverageActionsOnly(p: Policy): Policy {
  return {
    id: p.id + '_lvAct',
    decide(a, s, r) {
      return p.decide(a, s, r).map((act): PlannedAction => {
        if ((act.verb === 'POSITIONNER') && (act.op === 'ouvrir' || act.op === 'renforcer') && clusterOf.get(act.hexId) !== 'actions') {
          return { ...act, leverage: 0 };
        }
        return act;
      });
    },
  };
}
function leverageCell(restrict: boolean) {
  const wrap = (p: Policy) => (restrict ? leverageActionsOnly(p) : p);
  const policies = [alwaysReserve, wrap(policyForProfile(FONDS_LEVERAGE)), wrap(policyForProfile(VALUE_PATIENT))];
  const def = simulate(presetMvp(SEED), N, { policies });
  const top1 = (id: string) => def.filter((r) => IDS.every((o) => r.trackRecords[o]!.score <= r.trackRecords[id]!.score)).length / N;
  const duel = def.filter((r) => r.trackRecords['fonds_leverage']!.score > r.trackRecords['value_patient']!.score).length / N;
  const z = def.filter((r) => r.crisisCount === 0).length / N;
  const o = def.filter((r) => r.crisisCount === 1).length / N;
  const d = def.filter((r) => r.crisisCount >= 2).length / N;
  return { topV: top1('vautour'), topL: top1('fonds_leverage'), topVal: top1('value_patient'), duel, z, o, d };
}

console.log(`\n=== PANEL ACTIFS — config défaut (vautour réserve + 2 IA) · ${N} parties/cellule · horizon 28-40 ===\n`);

console.log('— IDÉE 1 : dividende actions versé tous les N tours (hold-to-collect) —');
console.log(['fréquence', 'score value', 'top1 value', 'top1 lev', 'duel', 'crises s/1/2+'].map((s) => s.padEnd(13)).join('| '));
for (const freq of [1, 2, 3]) {
  const r = dividend(freq);
  console.log([`${freq === 1 ? 'chaque tour' : 'tous les ' + freq + 't'}`.padEnd(13),
    sp(r.valScore).padEnd(13), pct(r.top1['value_patient']!).padEnd(13), pct(r.top1['fonds_leverage']!).padEnd(13),
    pct(r.duel).padEnd(13), `${pct(r.z)}/${pct(r.o)}/${pct(r.d)}`.padEnd(13)].join('| '));
}

console.log('\n— IDÉE 2 : réserver le levier aux actions (vs tous actifs) —');
console.log(['levier', 'top1 vautour', 'top1 lev', 'top1 value', 'duel', 'crises s/1/2+'].map((s) => s.padEnd(13)).join('| '));
for (const [label, restrict] of [['tous actifs', false], ['actions seules', true]] as [string, boolean][]) {
  const r = leverageCell(restrict);
  console.log([label.padEnd(13), pct(r.topV).padEnd(13), pct(r.topL).padEnd(13), pct(r.topVal).padEnd(13),
    pct(r.duel).padEnd(13), `${pct(r.z)}/${pct(r.o)}/${pct(r.d)}`.padEnd(13)].join('| '));
}
console.log('');
