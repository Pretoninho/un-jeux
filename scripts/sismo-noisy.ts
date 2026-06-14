// Panel — jauge BRUITÉE + Grand Pari (levier). La jauge parfaite rendait le levier sans risque
// (game-breaking). Avec une jauge imparfaite (F + bruit ±σ), le pari amplifié redevient un VRAI
// risque (parfois tu te trompes → tu te fais broyer). On cherche le σ (et le thêta) qui ramènent
// le Sismographe ACTIF (SHORT/LONG levier) dans la bande neutre ~33-45 %.
//
// Lancer :  npx vite-node scripts/sismo-noisy.ts [N]

import { simulate, type SimResult } from '../src/engine/simulate';
import { makeRng } from '../src/engine/rng';
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

// Jauge BRUITÉE : F̂ = F + bruit uniforme ±σ (rng dédié, dérivé du seed+tour → varie par partie,
// sans toucher le rng du monde). Le Sismographe agit sur F̂ (imparfait) → parfois à côté.
function sismoNoisy(mode: 'longLev' | 'short', L: number, sigma: number): Policy {
  return {
    id: 'sismo',
    decide(actor, state) {
      const noise = sigma > 0 ? makeRng(state.rngSeed * 1009 + state.turn * 7919).range(-sigma, sigma) : 0;
      const F = state.fragility + noise; // lecture imparfaite
      const hasLong = actor.positions.some((p) => p.direction === 'long');
      const hasShort = actor.positions.some((p) => p.direction === 'short');
      const close: PlannedAction = { verb: 'POSITIONNER', op: 'fermer', hexId: 'LC_US' };
      if (F > 0.55) {
        if (mode === 'short') {
          if (hasLong) return [close];
          if (!hasShort && actor.cash > 1) return [{ verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: actor.cash * 0.5, leverage: L, direction: 'short' } as PlannedAction];
          return [{ verb: 'RESERVER' }];
        }
        return actor.positions.length ? [close] : [{ verb: 'RESERVER' }];
      }
      if (F < 0.45) {
        if (hasShort) return [close];
        if (!hasLong && actor.cash > 1) return [{ verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: actor.cash, leverage: L, direction: 'long' } as PlannedAction];
        return [{ verb: 'RESERVER' }];
      }
      return [{ verb: 'RESERVER' }];
    },
  };
}

const top1 = (rs: SimResult[]) => rs.filter((r) => IDS.every((o) => r.trackRecords[o]!.score <= r.trackRecords['sismographe']!.score)).length / rs.length;
const excMed = (rs: SimResult[]) => med(rs.map((r) => r.playerTrackRecord.excessReturn));

function cell(mode: 'longLev' | 'short', L: number, sigma: number, theta = 0.005) {
  const rs = simulate({ ...presetMvp(SEED), archetype: { ...SISMOGRAPHE, calmTheta: theta } }, N, { policies: [sismoNoisy(mode, L, sigma), ...AIS] });
  return { top1: top1(rs), exc: excMed(rs) };
}

console.log(`\n=== PANEL jauge BRUITÉE + Grand Pari · ${N} parties · thêta 0.5 % ===`);
console.log('Le bruit σ ré-injecte le risque sur le pari amplifié. Cible top1 ~33-45 %.\n');

for (const [label, mode, L] of [['LONG amplifié ×2', 'longLev', 2], ['SHORT ×2 + LONG ×2', 'short', 2], ['SHORT ×3 + LONG ×3', 'short', 3]] as ['', 'longLev' | 'short', number][]) {
  console.log(`— ${label} —`);
  console.log(['bruit σ', 'top1', 'excédent médian'].map((s) => s.padEnd(15)).join('| '));
  for (const sigma of [0, 0.05, 0.1, 0.15, 0.2]) {
    const r = cell(mode, L, sigma);
    console.log([`±${sigma.toFixed(2)}`.padEnd(15), pct(r.top1).padEnd(15), sp(r.exc).padEnd(15)].join('| '));
  }
  console.log('');
}
