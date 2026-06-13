// Panel d'exploration — CARRY SUR LE CASH EN RÉSERVE (idée à l'étude, NON gravée dans le
// moteur). On modélise le carry ICI, dans l'expérience : après chaque tour, chaque acteur
// encaisse  k · r_BC · clamp(réserve − R_min, 0, cap)  sur sa trésorerie (cash = poudre sèche).
// r_BC est lu sur l'état réel (réunions BC comprises). But : caler les chiffres avant tout code.
//
// Lancer :  npx vite-node scripts/cash-carry.ts [N]
//
// Questions mesurées :
//  1. VIABILITÉ HOARDER : la réserve redevient-elle un win-con (top1 ↑) sans dominer ?
//  2. CANNIBALISATION : le value (qui tient des actifs carry) s'effondre-t-il ? (top1 value)
//  3. NEUTRALITÉ §28.8 : duel levier~value reste 40-60 % ?
//  4. FUITE PHYSIQUE : la distribution de crises bouge-t-elle (cash gonflé → notionnels IA) ?

import { buildInitialState } from '../src/engine/init';
import { runTurn } from '../src/engine/turn';
import { actorWealth } from '../src/engine/portfolio';
import { trackRecord } from '../src/engine/score';
import { alwaysReserve, type Policy } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';

const N = Number(process.argv[2] ?? 300);
const SEED = 1000;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const sp = (x: number) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(0)}%`;
const fx = (x: number, d = 2) => x.toFixed(d);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

interface Carry { k: number; rMin: number; cap: number } // k·r_BC sur clamp(cash−rMin, 0, cap)
const IDS = ['vautour', 'fonds_leverage', 'value_patient'] as const;

// Joue la config par DÉFAUT (vautour réserve + 2 IA) en injectant le carry cash post-tour.
function cell(c: Carry) {
  const policies: Policy[] = [alwaysReserve, policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];
  const top1: Record<string, number> = { vautour: 0, fonds_leverage: 0, value_patient: 0 };
  const scoreSum: Record<string, number> = { vautour: 0, fonds_leverage: 0, value_patient: 0 };
  let duel = 0, z = 0, o = 0, d = 0, bcSum = 0, bcCount = 0, vautourExc = 0;

  for (let i = 0; i < N; i++) {
    const { state, rng } = buildInitialState(presetMvp(SEED + i));
    const H = state.params.horizonTurns;
    for (let t = 0; t < H; t++) {
      runTurn(state, policies, rng);
      const r = state.credit.bc.rate;
      bcSum += r; bcCount++;
      for (const a of state.actors) {
        const base = Math.min(c.cap, Math.max(0, a.cash - c.rMin));
        a.cash += c.k * r * base;
        // Corrige la dernière entrée d'historique pour inclure le carry (sinon drawdown/score laggent).
        a.wealthHistory[a.wealthHistory.length - 1] = actorWealth(a, state.market);
      }
    }
    const alpha = state.params.drawdownPenalty;
    const tr = Object.fromEntries(state.actors.map((a) => [a.id, trackRecord(a, state.benchmarkHistory, alpha)]));
    for (const id of IDS) scoreSum[id] += tr[id]!.score / N;
    vautourExc += tr['vautour']!.excessReturn / N;
    const best = IDS.reduce((b, id) => (tr[id]!.score > tr[b]!.score ? id : b), IDS[0]);
    top1[best] += 1 / N;
    if (tr['fonds_leverage']!.score > tr['value_patient']!.score) duel += 1 / N;
    const cc = state.crisisTurns.length;
    if (cc === 0) z += 1 / N; else if (cc === 1) o += 1 / N; else d += 1 / N;
  }
  return { top1, scoreSum, duel, z, o, d, meanBC: bcSum / bcCount, vautourExc };
}

function row(label: string, c: Carry) {
  const r = cell(c);
  return [
    label.padEnd(22),
    pct(r.top1['vautour']!).padStart(8),
    sp(r.scoreSum['vautour']!).padStart(9),
    sp(r.vautourExc).padStart(9),
    pct(r.top1['value_patient']!).padStart(8),
    pct(r.top1['fonds_leverage']!).padStart(8),
    pct(r.duel).padStart(6),
    `${pct(r.z)}/${pct(r.o)}/${pct(r.d)}`.padStart(20),
    fx(r.meanBC * 100, 2).padStart(7),
  ].join(' | ');
}

const HEAD = ['config carry', 'top1 hoard', 'score hoard', 'exc hoard', 'top1 val', 'top1 lev', 'duel', 'crises s/1/2+', 'r_BC moy'].join(' | ');
console.log(`\n=== PANEL CARRY CASH — config défaut (vautour réserve + 2 IA) · ${N} parties/cellule · horizon 28-40 ===\n`);
console.log('Rappel carry hexes : LC 1.5-2% · IG 3% · IMMO 4% · IG_EM 5% · HY 7%. r_BC doit rester SOUS cette bande.\n');

console.log('— PANEL A : taux plat (R_min=0, sans plafond) — pur effet de niveau —');
console.log(HEAD);
console.log(row('baseline (k=0)', { k: 0, rMin: 0, cap: Infinity }));
for (const k of [0.5, 1.0, 1.5]) console.log(row(`k=${k}·r_BC`, { k, rMin: 0, cap: Infinity }));

console.log('\n— PANEL B : franchise (k=1·r_BC, plafond ∞) — effet du SEUIL R_min —');
console.log(HEAD);
for (const rMin of [0, 30, 50, 70]) console.log(row(`R_min=${rMin}`, { k: 1, rMin, cap: Infinity }));

console.log('\n— PANEL C : plafond (k=1·r_BC, R_min=30) — borne le carry sans risque —');
console.log(HEAD);
for (const cap of [Infinity, 80, 50, 30]) console.log(row(`cap=${cap === Infinity ? '∞' : cap}`, { k: 1, rMin: 30, cap }));
console.log('');
