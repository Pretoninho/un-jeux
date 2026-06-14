// Validation — la compétence « Récolte » CÂBLÉE dans le moteur reproduit-elle les ~40 %
// mesurés au wrapper ? Le joueur est le VAUTOUR (archétype porteur de la compétence), empile
// du coupon long et active la compétence dès que le moteur la dit prête (cooldown réel).
//
// Lancer :  npx vite-node scripts/vautour-skill.ts [N]

import { simulate, type SimResult } from '../src/engine/simulate';
import { type Policy, type PlannedAction } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';

const N = Number(process.argv[2] ?? 400);
const SEED = 1000;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const IDS = ['vautour', 'fonds_leverage', 'value_patient'] as const;
const AIS = [policyForProfile(FONDS_LEVERAGE), policyForProfile(VALUE_PATIENT)];

// `useSkill` = active « Récolte » dès qu'elle est prête ; sinon pure récolte (contrôle).
function vautour(useSkill: boolean): Policy {
  return {
    id: 'vautour',
    decide(actor, state) {
      if (useSkill && state.turn >= 2 && state.turn >= (actor.carrySkillReadyAt ?? 0) && actor.couponPositions.length > 0) {
        return [{ verb: 'COMPETENCE', skill: 'carry_boost' }];
      }
      if (actor.cash < 1 || state.credit.book.length === 0) return [{ verb: 'RESERVER' }];
      const best = state.credit.book.reduce((b, c) => (c.rate > b.rate ? c : b));
      return [{ verb: 'POSITIONNER', op: 'ouvrir_coupon', issuer: best.issuer, maturity: best.maturity, notional: actor.cash * 0.3, direction: 'long' } as PlannedAction];
    },
  };
}

const top1 = (rs: SimResult[], id: string) =>
  rs.filter((r) => IDS.every((o) => r.trackRecords[o]!.score <= r.trackRecords[id]!.score)).length / rs.length;
const exc = (rs: SimResult[]) => { const xs = rs.map((r) => r.playerTrackRecord.excessReturn).sort((a, b) => a - b); return xs[Math.floor(xs.length / 2)]!; };

console.log(`\n=== VALIDATION Vautour « Récolte » (moteur câblé) · ${N} parties · horizon 28-40 ===`);
console.log('Attendu : sans compétence ~31 % (baseline assaini) · avec compétence ~40 % (cible neutre).\n');
console.log(['config', 'top1 vautour', 'excédent médian', 'duel fonds>value'].map((s) => s.padEnd(16)).join('| '));
for (const [label, use] of [['récolte SANS compétence', false], ['récolte + compétence', true]] as [string, boolean][]) {
  const rs = simulate(presetMvp(SEED), N, { policies: [vautour(use), ...AIS] });
  const duel = rs.filter((r) => r.trackRecords['fonds_leverage']!.score > r.trackRecords['value_patient']!.score).length / N;
  console.log([label.padEnd(16), pct(top1(rs, 'vautour')).padEnd(16), pct(exc(rs)).padEnd(16), pct(duel).padEnd(16)].join('| '));
}
console.log('');
