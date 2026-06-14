// Panel Sismographe — jauge de F (round-trip macro) + thêta de couverture au calme, ± frappe.
// Le thêta est modélisé DANS le script (ponction de richesse chaque tour SANS crise), comme
// le carry cash. La jauge = le joueur lit F (état caché) ; les AIs ne paient pas le thêta.
//
// Lancer :  npx vite-node scripts/sismo-panel.ts [N]

import { buildInitialState } from '../src/engine/init';
import { runTurn } from '../src/engine/turn';
import { actorWealth } from '../src/engine/portfolio';
import { trackRecord } from '../src/engine/score';
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
const IDS = ['neutre', 'fonds_leverage', 'value_patient'] as const;

// Sismographe : lit F (jauge). Risk-off (ferme tout) si F > 0.55 ; achète la reprise si F < 0.45
// (frac 100 % avec frappe, 50 % sans) ; tient entre les deux (hystérésis anti-churn). Sans levier.
function sismo(useStrike: boolean): Policy {
  return {
    id: 'sismo',
    decide(actor, state) {
      const F = state.fragility; // jauge sismique (état caché, réservé au Sismographe)
      if (F > 0.55) {
        const hexes = [...new Set(actor.positions.map((p) => p.hexId))];
        return hexes.length ? hexes.map((h) => ({ verb: 'POSITIONNER', op: 'fermer', hexId: h } as PlannedAction)) : [{ verb: 'RESERVER' }];
      }
      if (F < 0.45 && actor.positions.length === 0 && actor.cash > 1) {
        return [{ verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: actor.cash * (useStrike ? 1 : 0.5), leverage: 0, direction: 'long' } as PlannedAction];
      }
      return [{ verb: 'RESERVER' }];
    },
  };
}

// Toujours long (pas de jauge ni thêta) — référence d'exposition passive.
const passif: Policy = {
  id: 'sismo',
  decide: (a) => (a.positions.length === 0 && a.cash > 1 ? [{ verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: a.cash * 0.5, leverage: 0, direction: 'long' } as PlannedAction] : [{ verb: 'RESERVER' }]),
};

function play(seed: number, player: Policy, theta: number) {
  const { state, rng } = buildInitialState({ ...presetMvp(seed), archetype: NEUTRE });
  const me = state.actors[0]!;
  const H = state.params.horizonTurns;
  for (let t = 0; t < H; t++) {
    runTurn(state, [player, ...AIS], rng);
    if (theta > 0 && !state.crisis.active) {
      me.cash -= theta * actorWealth(me, state.market); // thêta de couverture (décale en temps calme)
      me.wealthHistory[me.wealthHistory.length - 1] = actorWealth(me, state.market); // corrige l'historique
    }
  }
  const alpha = state.params.drawdownPenalty;
  const tr = Object.fromEntries(state.actors.map((a) => [a.id, trackRecord(a, state.benchmarkHistory, alpha)]));
  return tr;
}

function cell(player: Policy, theta: number) {
  let top1 = 0; const exc: number[] = []; const dd: number[] = [];
  for (let i = 0; i < N; i++) {
    const tr = play(SEED + i, player, theta);
    if (IDS.every((o) => tr[o]!.score <= tr['neutre']!.score)) top1 += 1 / N;
    exc.push(tr['neutre']!.excessReturn); dd.push(tr['neutre']!.maxDrawdown);
  }
  return { top1, exc: med(exc), dd: med(dd) };
}

console.log(`\n=== PANEL SISMOGRAPHE — jauge F + thêta de calme (± frappe) · ${N} parties · horizon 28-40 ===`);
console.log('Cible : top1 ~33-45 % (vs 2 IA). Le thêta doit compenser le gain de la jauge.\n');

const ref = cell(passif, 0);
console.log(`Référence (long passif, sans jauge ni thêta) : top1 ${pct(ref.top1)} · excédent ${sp(ref.exc)} · drawdown ${pct(ref.dd)}\n`);

for (const strike of [false, true]) {
  console.log(`— Jauge ${strike ? '+ FRAPPE (déploie 100 % la reprise)' : 'seule (déploie 50 %)'} —`);
  console.log(['thêta/tour', 'top1', 'excédent médian', 'drawdown médian'].map((s) => s.padEnd(16)).join('| '));
  for (const theta of [0, 0.005, 0.01, 0.015, 0.02]) {
    const r = cell(sismo(strike), theta);
    console.log([`${(theta * 100).toFixed(1)} %`.padEnd(16), pct(r.top1).padEnd(16), sp(r.exc).padEnd(16), pct(r.dd).padEnd(16)].join('| '));
  }
  console.log('');
}
