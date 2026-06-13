// Panel — POUVOIR « Compounder » AVEC COOLDOWN (idée créateur, mesure seule, moteur intact).
// Compétence active (3 PA) : multiplie le carry par `boost` pendant `duration` tours, puis
// INDISPONIBLE `cooldown` tours. Le cooldown réduit la FRACTION de temps boostée → bride le
// compounding qui rendait la version « continue » game-breaking. On cherche le cooldown qui
// ramène la part de victoires dans la bande neutre (~33-45 %, 3 joueurs).
//
// Joueur = empile du coupon long juteux ; sur le tour d'activation il RESERVE (paie les 3 PA).
// Lancer :  npx vite-node scripts/archetype-carry-skill.ts [N]

import { buildInitialState } from '../src/engine/init';
import { runTurn } from '../src/engine/turn';
import { trackRecord } from '../src/engine/score';
import { type Policy, type PlannedAction } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';
import { MVP_MAP } from '../src/data/maps/mvp-16';

const N = Number(process.argv[2] ?? 300);
const SEED = 1000;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const sp = (x: number) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(0)}%`;
const carryOf = new Map(MVP_MAP.hexes.map((h) => [h.id, h.carry ?? 0]));
const IDS = ['vautour', 'fonds_leverage', 'value_patient'] as const;

// Cycle = durée (actif) + cooldown (indispo). Activation au début de chaque cycle (t≥2).
const cycleLen = (duration: number, cooldown: number) => duration + cooldown;
const isActivation = (t: number, duration: number, cooldown: number) => t >= 2 && (t - 2) % cycleLen(duration, cooldown) === 0;
const isBoosted = (t: number, duration: number, cooldown: number) => t >= 2 && (t - 2) % cycleLen(duration, cooldown) < duration;

function compounder(duration: number, cooldown: number): Policy {
  return {
    id: 'compounder',
    decide(actor, state) {
      if (isActivation(state.turn, duration, cooldown)) return [{ verb: 'RESERVER' }]; // paie les 3 PA
      if (actor.cash < 1 || state.credit.book.length === 0) return [{ verb: 'RESERVER' }];
      const best = state.credit.book.reduce((b, c) => (c.rate > b.rate ? c : b));
      return [{ verb: 'POSITIONNER', op: 'ouvrir_coupon', issuer: best.issuer, maturity: best.maturity, notional: actor.cash * 0.3, direction: 'long' } as PlannedAction];
    },
  };
}

function playerCarry(actor: { positions: { hexId: string; equity: number; leverage: number }[]; couponPositions: { side: string; rate: number; notional: number }[] }) {
  let c = 0;
  for (const p of actor.positions) c += p.equity * (1 + p.leverage) * (carryOf.get(p.hexId) ?? 0);
  for (const cp of actor.couponPositions) c += (cp.side === 'long' ? 1 : -1) * cp.rate * cp.notional;
  return c;
}

function cell(boost: number, duration: number, cooldown: number) {
  const policies: Policy[] = [compounder(duration, cooldown), policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];
  let top1 = 0, exc = 0, uses = 0;
  for (let i = 0; i < N; i++) {
    const { state, rng } = buildInitialState(presetMvp(SEED + i));
    const player = state.actors[0]!;
    const H = state.params.horizonTurns;
    for (let t = 1; t <= H; t++) {
      runTurn(state, policies, rng);
      if (boost > 1 && isBoosted(t, duration, cooldown)) player.cash += (boost - 1) * playerCarry(player);
      if (i === 0 && isActivation(t, duration, cooldown)) uses++;
    }
    const alpha = state.params.drawdownPenalty;
    const tr = Object.fromEntries(state.actors.map((a) => [a.id, trackRecord(a, state.benchmarkHistory, alpha)]));
    exc += tr['vautour']!.excessReturn / N;
    if (IDS.every((id) => tr['vautour']!.score >= tr[id]!.score)) top1 += 1 / N;
  }
  return { top1, exc, uses };
}

console.log(`\n=== PANEL POUVOIR « Compounder » + COOLDOWN — ${N} parties/cellule · horizon 28-40 ===\n`);
console.log('Boost de carry `duration` tours puis indispo `cooldown` tours. Cible neutre top1 ~33-45 %.');
const baseTop = cell(1, 2, 0).top1;
console.log(`Référence (sans compétence) : top1 ${pct(baseTop)}\n`);

for (const duration of [2, 3]) {
  console.log(`— durée d'effet = ${duration} tours —  (colonnes = cooldown ; « ~U » = nb d'activations/partie)`);
  const cooldowns = [0, 4, 8, 12, 16];
  console.log(['boost'.padEnd(8), ...cooldowns.map((c) => `cd ${c}`.padEnd(13))].join('| '));
  for (const boost of [2, 3, 5]) {
    const cells = cooldowns.map((cd) => { const r = cell(boost, duration, cd); return `${pct(r.top1)} ~${r.uses}u`.padEnd(13); });
    console.log([`×${boost}`.padEnd(8), ...cells].join('| '));
  }
  console.log('');
}

// Zoom excédent sur quelques cellules « cooldown long » pour juger la santé du score.
console.log('Excédent vs marché (durée 2t) sur cooldown longs :');
console.log(['boost'.padEnd(8), 'cd 8'.padEnd(12), 'cd 12'.padEnd(12), 'cd 16'.padEnd(12)].join('| '));
for (const boost of [2, 3, 5]) {
  const r = [8, 12, 16].map((cd) => sp(cell(boost, 2, cd).exc).padEnd(12));
  console.log([`×${boost}`.padEnd(8), ...r].join('| '));
}
console.log('');
