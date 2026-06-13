// Panel — POUVOIR D'ARCHÉTYPE « Compounder » (idée créateur, mesure seule, moteur intact) :
// compétence ACTIVE coût 3 PA → multiplie le carry reçu par `boost` pendant `duration` tours.
// Re-activable (on ré-up à l'expiration) → boost ~continu, mais chaque activation COÛTE un tour
// de déploiement (les 3 PA ≈ on ne place rien ce tour-là). Plus la durée est longue, moins on
// paie souvent → la durée = fréquence du coût, le boost = magnitude.
//
// Le joueur empile du COUPON LONG le plus juteux (HY = plus gros carry MAIS défaut le plus
// probable en crise) → contre-poids conditionnel intégré. On lit la part de victoires (top1)
// vs 2 IA standard : cible neutralité ~33 % (3 joueurs). Trop fort = il domine.
//
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

// Activation : tour ≥2 et (t−2) multiple de `duration` → on ré-up le boost (continu) en payant
// un tour (RESERVER). Doit être identique dans la politique ET dans la boucle d'accounting.
const isActivation = (t: number, duration: number) => t >= 2 && (t - 2) % duration === 0;

// Politique Compounder : hors activation, achète le coupon LONG le plus juteux ; sur activation, RESERVE (paie les 3 PA).
function compounder(duration: number): Policy {
  return {
    id: 'compounder',
    decide(actor, state) {
      if (isActivation(state.turn, duration)) return [{ verb: 'RESERVER' }];
      if (actor.cash < 1 || state.credit.book.length === 0) return [{ verb: 'RESERVER' }];
      const best = state.credit.book.reduce((b, c) => (c.rate > b.rate ? c : b));
      return [{ verb: 'POSITIONNER', op: 'ouvrir_coupon', issuer: best.issuer, maturity: best.maturity, notional: actor.cash * 0.3, direction: 'long' } as PlannedAction];
    },
  };
}

// Carry reçu par le joueur ce tour (V-positions + coupons longs/courts), pour le booster.
function playerCarry(actor: { positions: { hexId: string; equity: number; leverage: number }[]; couponPositions: { side: string; rate: number; notional: number }[] }) {
  let c = 0;
  for (const p of actor.positions) c += p.equity * (1 + p.leverage) * (carryOf.get(p.hexId) ?? 0);
  for (const cp of actor.couponPositions) c += (cp.side === 'long' ? 1 : -1) * cp.rate * cp.notional;
  return c;
}

function cell(boost: number, duration: number) {
  const policies: Policy[] = [compounder(duration), policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];
  let top1 = 0, score = 0, exc = 0, z = 0, o = 0, d = 0;
  for (let i = 0; i < N; i++) {
    const { state, rng } = buildInitialState(presetMvp(SEED + i));
    const player = state.actors[0]!;
    const H = state.params.horizonTurns;
    for (let t = 1; t <= H; t++) {
      runTurn(state, policies, rng);
      // Boost ~continu (on ré-up tous les `duration` tours) à partir de t≥2.
      if (boost > 1 && t >= 2) player.cash += (boost - 1) * playerCarry(player);
    }
    const alpha = state.params.drawdownPenalty;
    const tr = Object.fromEntries(state.actors.map((a) => [a.id, trackRecord(a, state.benchmarkHistory, alpha)]));
    score += tr['vautour']!.score / N;
    exc += tr['vautour']!.excessReturn / N;
    if (IDS.every((id) => tr['vautour']!.score >= tr[id]!.score)) top1 += 1 / N;
    const cc = state.crisisTurns.length;
    if (cc === 0) z += 1 / N; else if (cc === 1) o += 1 / N; else d += 1 / N;
  }
  return { top1, score, exc, z, o, d };
}

console.log(`\n=== PANEL POUVOIR « Compounder » — boost de carry × durée · ${N} parties/cellule · horizon 28-40 ===\n`);
console.log('Joueur = empile du coupon long juteux + active la compétence (3 PA, ré-up tous les `durée` tours).');
console.log('Cible neutralité : top1 ~33 % (3 joueurs). >50 % = pouvoir trop fort.\n');

// Référence : le Compounder SANS compétence (boost ×1).
const base = cell(1, 4);
console.log(`Référence (sans compétence) : top1 ${pct(base.top1)} · score ${sp(base.score)} · crises ${pct(base.z)}/${pct(base.o)}/${pct(base.d)}\n`);

console.log(['boost \\ durée', 'top1 (2t)', 'top1 (3t)', 'top1 (4t)'].map((s) => s.padEnd(13)).join('| '));
for (const boost of [2, 3, 5, 8]) {
  const row = [2, 3, 4].map((dur) => pct(cell(boost, dur).top1).padEnd(13));
  console.log([`×${boost}`.padEnd(13), ...row].join('| '));
}

console.log('\nDétail score joueur (excédent vs marché) :');
console.log(['boost \\ durée', 'exc (2t)', 'exc (3t)', 'exc (4t)'].map((s) => s.padEnd(13)).join('| '));
for (const boost of [2, 3, 5, 8]) {
  const row = [2, 3, 4].map((dur) => sp(cell(boost, dur).exc).padEnd(13));
  console.log([`×${boost}`.padEnd(13), ...row].join('| '));
}
console.log('');
