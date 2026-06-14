// Sweep de la FENÊTRE ARMÉE W de « Couverture » (Vautour, armer + auto-tir). On mesure le
// Vautour qui porte LES DEUX compétences (Récolte + Couverture) : il arme la couverture quand
// la BC resserre (proxy de danger lisible), active Récolte sinon, et récolte du coupon.
// coverSkill n'est PAS encore dans la donnée VAUTOUR : on l'injecte via un archétype custom.
//
// Lancer :  npx vite-node scripts/vautour-cover.ts [N]

import { simulate, type SimResult } from '../src/engine/simulate';
import { type Policy, type PlannedAction } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { VAUTOUR } from '../src/data/archetypes/vautour';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';
import type { Archetype } from '../src/engine/types';

const N = Number(process.argv[2] ?? 400);
const SEED = 1000;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const sp = (x: number) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(0)}%`;
const IDS = ['vautour', 'fonds_leverage', 'value_patient'] as const;
const AIS = [policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

// Vautour aux deux compétences. `mode` : 'off' (Récolte seule), 'greedy' (arme dès que prête =
// borne haute, non timé), 'danger' (arme quand le taux BC est élevé = surchauffe lisible).
type Mode = 'off' | 'greedy' | 'danger';
function vautour(mode: Mode): Policy {
  return {
    id: 'vautour',
    decide(actor, state) {
      const acts: PlannedAction[] = [];
      const coverReady = !!actor.coverSkill && state.turn >= (actor.coverReadyAt ?? 0);
      const carryReady = !!actor.carrySkill && state.turn >= (actor.carrySkillReadyAt ?? 0) && actor.couponPositions.length > 0;
      const wantCover = mode === 'greedy' ? coverReady
        : mode === 'danger' ? coverReady && state.credit.bc.rate > 0.025 // BC élevé = surchauffe
        : false;
      if (wantCover) acts.push({ verb: 'COMPETENCE', skill: 'cover_arm' });
      else if (carryReady) acts.push({ verb: 'COMPETENCE', skill: 'carry_boost' });
      if (actor.cash >= 1 && state.credit.book.length) {
        const best = state.credit.book.reduce((b, c) => (c.rate > b.rate ? c : b));
        acts.push({ verb: 'POSITIONNER', op: 'ouvrir_coupon', issuer: best.issuer, maturity: best.maturity, notional: actor.cash * 0.3, direction: 'long' });
      }
      return acts.length ? acts : [{ verb: 'RESERVER' }];
    },
  };
}

const top1 = (rs: SimResult[]) => rs.filter((r) => IDS.every((o) => r.trackRecords[o]!.score <= r.trackRecords['vautour']!.score)).length / rs.length;
const duel = (rs: SimResult[]) => rs.filter((r) => r.trackRecords['fonds_leverage']!.score > r.trackRecords['value_patient']!.score).length / rs.length;
const excMed = (rs: SimResult[]) => med(rs.map((r) => r.playerTrackRecord.excessReturn));

function run(arch: Archetype, mode: Mode) {
  return simulate({ ...presetMvp(SEED), archetype: arch }, N, { policies: [vautour(mode), ...AIS] });
}

console.log(`\n=== SWEEP fenêtre armée W — « Couverture » (Vautour, armer + auto-tir) · ${N} parties ===`);
console.log('Cooldown 10, coût 2 PA. Cible : top1 Vautour ~33-45 % (la paire ne doit pas dominer).\n');

// Référence : Récolte SEULE (pas de coverSkill).
const ref = run(VAUTOUR, 'off');
console.log(`Récolte seule (sans Couverture) : top1 ${pct(top1(ref))} · excédent médian ${sp(excMed(ref))} · duel ${pct(duel(ref))}\n`);

for (const mode of ['greedy', 'danger'] as Mode[]) {
  console.log(`— Armement « ${mode === 'greedy' ? 'glouton (borne haute, non timé)' : 'sur danger (taux BC élevé)'} » —`);
  console.log(['fenêtre W', 'top1 Vautour', 'excédent médian', 'duel', '2+ crises'].map((s) => s.padEnd(15)).join('| '));
  for (const W of [1, 2, 3, 4, 6]) {
    const arch: Archetype = { ...VAUTOUR, coverSkill: { window: W, cooldown: 10, paCost: 2 } };
    const rs = run(arch, mode);
    const dd = rs.filter((r) => r.crisisCount >= 2).length / N;
    console.log([`W=${W}`.padEnd(15), pct(top1(rs)).padEnd(15), sp(excMed(rs)).padEnd(15), pct(duel(rs)).padEnd(15), pct(dd).padEnd(15)].join('| '));
  }
  console.log('');
}

// ── Paire RÉÉQUILIBRÉE : on affaiblit Récolte (factor / cooldown) pour faire de la place à
//    Couverture (danger-armée), et on vise top1 ~40 %. ──
console.log('— Paire rééquilibrée (Récolte affaiblie + Couverture danger) — cible top1 ~40 % —');
console.log(['Récolte · Couv', 'top1 Vautour', 'excédent médian', 'duel', '2+ crises'].map((s) => s.padEnd(17)).join('| '));
const combos: [string, number, number, number][] = [
  // label, recolteFactor, recolteCooldown, coverWindow
  ['×1.5 cd12 · W2', 1.5, 12, 2],
  ['×1.5 cd12 · W3', 1.5, 12, 3],
  ['×2 cd18 · W2', 2, 18, 2],
  ['×2 cd18 · W3', 2, 18, 3],
  ['×1.5 cd16 · W3', 1.5, 16, 3],
];
for (const [label, f, cd, W] of combos) {
  const arch: Archetype = { ...VAUTOUR, carrySkill: { factor: f, duration: 2, cooldown: cd, paCost: 3 }, coverSkill: { window: W, cooldown: 10, paCost: 2 } };
  const rs = run(arch, 'danger');
  const dd = rs.filter((r) => r.crisisCount >= 2).length / N;
  console.log([label.padEnd(17), pct(top1(rs)).padEnd(17), sp(excMed(rs)).padEnd(17), pct(duel(rs)).padEnd(17), pct(dd).padEnd(17)].join('| '));
}
console.log('');
