// FAITS — pourquoi « empiler du coupon long » gagne ~41 % sans aucun pouvoir (analyse seule).
// On joue un harvester (tout en coupon long juteux) en config défaut et on décompose.
//
// Lancer :  npx vite-node scripts/credit-baseline.ts [N]

import { buildInitialState } from '../src/engine/init';
import { runTurn } from '../src/engine/turn';
import { actorWealth } from '../src/engine/portfolio';
import { simulate } from '../src/engine/simulate';
import { alwaysReserve, steadyLong, type Policy, type PlannedAction } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';

const N = Number(process.argv[2] ?? 400);
const SEED = 1000;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const f0 = (x: number) => x.toFixed(0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

// Harvester : empile le coupon LONG le plus juteux (HY), 30 % du cash/tour. Aucun pouvoir.
const harvester: Policy = {
  id: 'harvester',
  decide(actor, state) {
    if (actor.cash < 1 || state.credit.book.length === 0) return [{ verb: 'RESERVER' }];
    const best = state.credit.book.reduce((b, c) => (c.rate > b.rate ? c : b));
    return [{ verb: 'POSITIONNER', op: 'ouvrir_coupon', issuer: best.issuer, maturity: best.maturity, notional: actor.cash * 0.3, direction: 'long' } as PlannedAction];
  },
};

// Décompose un run : richesse finale, défauts subis, flux carry vs pertes de principal.
function deep() {
  const policies = [harvester, policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];
  const wealth: number[] = [], byCrises: Record<string, number[]> = { '0': [], '1': [], '2+': [] };
  let carrySum = 0, defaultLossSum = 0, defaults = 0, blowups = 0;
  for (let i = 0; i < N; i++) {
    const { state, rng } = buildInitialState(presetMvp(SEED + i));
    const p = state.actors[0]!;
    const H = state.params.horizonTurns;
    for (let t = 1; t <= H; t++) {
      const before = p.couponPositions.map((c) => c.couponId);
      const cashBefore = p.cash, wBefore = actorWealth(p, state.market);
      runTurn(state, policies, rng);
      // Carry encaissé ce tour (proxy : somme rate·notional des longs vivants au tour).
      for (const c of p.couponPositions) carrySum += c.rate * c.notional / N;
      // Défauts subis = coupons disparus PENDANT une crise (pas une échéance : échéance rend U≥0).
      if (state.crisis.active) {
        const after = new Set(p.couponPositions.map((c) => c.couponId));
        for (const id of before) if (!after.has(id)) { defaults++; }
      }
      void cashBefore; void wBefore;
    }
    const w = actorWealth(p, state.market);
    wealth.push(w);
    if (w < 100) blowups++;
    const cc = state.crisisTurns.length;
    (byCrises[cc === 0 ? '0' : cc === 1 ? '1' : '2+']!).push(w);
  }
  void carrySum; void defaultLossSum;
  return { wealth, byCrises, defaults: defaults / N, blowups: blowups / N };
}

console.log(`\n=== FAITS — baseline « coupon long » · ${N} parties · config défaut · horizon 28-40 ===\n`);

const d = deep();
console.log('— Richesse finale du harvester (capital de départ = 100) —');
console.log(`  médiane ${f0(med(d.wealth))} · moyenne ${f0(mean(d.wealth))} · pire 10% ${f0([...d.wealth].sort((a,b)=>a-b)[Math.floor(0.1*d.wealth.length)]!)} · meilleur 10% ${f0([...d.wealth].sort((a,b)=>a-b)[Math.floor(0.9*d.wealth.length)]!)}`);
console.log(`  finit SOUS le capital (blow-up) : ${pct(d.blowups)} · défauts de coupons subis/partie : ${d.defaults.toFixed(2)}`);
console.log('\n— Richesse finale SELON le nombre de crises (la crise fait-elle mal ?) —');
for (const k of ['0', '1', '2+']) {
  const xs = d.byCrises[k]!;
  if (xs.length) console.log(`  ${k} crise(s) (${pct(xs.length / N)} des parties) : médiane ${f0(med(xs))} · moyenne ${f0(mean(xs))}`);
}

// FAIT : coupons vs autres stratégies (même config, joueur différent). Richesse médiane.
console.log('\n— Comparatif richesse médiane (même monde, joueur différent) —');
const compare: [string, Policy][] = [
  ['harvester coupon long', harvester],
  ['actions sans levier', steadyLong(0)],
  ['réserve (hoarder)', alwaysReserve],
];
for (const [label, pol] of compare) {
  const rs = simulate(presetMvp(SEED), N, { policies: [pol, policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)] });
  const exc = rs.map((r) => r.playerTrackRecord.excessReturn);
  const top1 = rs.filter((r) => ['vautour', 'fonds_leverage', 'value_patient'].every((id) => r.trackRecords['vautour']!.score >= r.trackRecords[id]!.score)).length / N;
  console.log(`  ${label.padEnd(24)} : excédent médian vs marché ${pct(med(exc))} · top1 ${pct(top1)}`);
}

// FAIT : le harvester fait-il MONTER les crises (coupons → crowding → F) ?
console.log('\n— Le harvester nourrit-il F ? (distribution de crises selon le joueur) —');
for (const [label, pol] of [['réserve', alwaysReserve], ['harvester coupon', harvester]] as [string, Policy][]) {
  const rs = simulate(presetMvp(SEED), N, { policies: [pol, policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)] });
  const z = rs.filter((r) => r.crisisCount === 0).length / N;
  const o = rs.filter((r) => r.crisisCount === 1).length / N;
  const dd = rs.filter((r) => r.crisisCount >= 2).length / N;
  console.log(`  joueur ${label.padEnd(18)} : crises ${pct(z)}/${pct(o)}/${pct(dd)}`);
}
console.log('');
