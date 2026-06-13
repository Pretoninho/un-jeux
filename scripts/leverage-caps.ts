// Panel — PLAFONDS DE LEVIER PAR ACTIF (idée créateur : actions ×5 / PEVC ×2-3, mesure seule).
// Plafond appliqué en WRAPPER de politique (clamp min(demandé, plafond_du_cluster)), moteur intact.
// Subtilité : les IA standard ne demandent que ×3 → pour EXERCER le plafond actions ×5, le slot
// joueur est un steadyLong(5) (un humain qui pousse le levier max). On lit alors :
//  - la TEMPO (le levier est le moteur de F → plus de plafond actions = plus de crises ?) ;
//  - le RISQUE joueur (drawdown médian de qui exploite le max) ;
//  - la NEUTRALITÉ (duel fonds>value, IA standard en face).
//
// Lancer :  npx vite-node scripts/leverage-caps.ts [N]

import { simulate } from '../src/engine/simulate';
import { steadyLong, alwaysReserve, type Policy, type PlannedAction } from '../src/engine/policy';
import { policyForProfile } from '../src/engine/ai';
import { presetMvp } from '../src/data/config-mvp';
import { FONDS_LEVERAGE } from '../src/data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../src/data/profiles/value-patient';
import { MVP_MAP } from '../src/data/maps/mvp-16';

const N = Number(process.argv[2] ?? 400);
const SEED = 1000;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const clusterOf = new Map(MVP_MAP.hexes.map((h) => [h.id, h.cluster]));
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

// Plafonne le levier demandé selon le cluster de l'hexe (actions vs alternatifs ; crédit = hors-V).
function capLeverage(p: Policy, actionCap: number, altCap: number): Policy {
  return {
    id: p.id + '_cap',
    decide(a, s, r) {
      return p.decide(a, s, r).map((act): PlannedAction => {
        if (act.verb === 'POSITIONNER' && (act.op === 'ouvrir' || act.op === 'renforcer')) {
          const cap = clusterOf.get(act.hexId) === 'actions' ? actionCap : altCap;
          return { ...act, leverage: Math.min(act.leverage, cap) };
        }
        return act;
      });
    },
  };
}

// Joueur = steadyLong(5) (exploite le plafond actions), + 2 IA standard. Plafonds sur TOUS.
function cell(actionCap: number, altCap: number, demand = 5) {
  const wrap = (p: Policy) => capLeverage(p, actionCap, altCap);
  const policies = [
    wrap(steadyLong(demand)),
    wrap(policyForProfile(FONDS_LEVERAGE)),
    wrap(policyForProfile(VALUE_PATIENT)),
  ];
  const rs = simulate(presetMvp(SEED), N, { policies });
  const z = rs.filter((r) => r.crisisCount === 0).length / N;
  const o = rs.filter((r) => r.crisisCount === 1).length / N;
  const d = rs.filter((r) => r.crisisCount >= 2).length / N;
  const ddJoueur = med(rs.map((r) => r.playerTrackRecord.maxDrawdown));
  const duel = rs.filter((r) => r.trackRecords['fonds_leverage']!.score > r.trackRecords['value_patient']!.score).length / N;
  return { z, o, d, ddJoueur, duel };
}

console.log(`\n=== PANEL PLAFONDS DE LEVIER PAR ACTIF — joueur steadyLong(5) + 2 IA · ${N} parties · horizon 28-40 ===\n`);
console.log('Le levier = moteur de F. Plafond actions haut = plus de carburant possible sur le cœur liquide.\n');
console.log(['plafonds (act/alt)', 'crises s/1/2+', 'drawdown joueur', 'duel fonds>value'].map((s) => s.padEnd(18)).join('| '));

const schemes: [string, number, number][] = [
  ['×3 / ×3 (réf.)', 3, 3],
  ['×5 / ×5 (uniforme)', 5, 5],
  ['×5 / ×3', 5, 3],
  ['×5 / ×2', 5, 2],
  ['×3 / ×2', 3, 2],
  ['×5 / ×0 (actions seules)', 5, 0],
];
for (const [label, ac, al] of schemes) {
  const r = cell(ac, al);
  console.log([label.padEnd(18), `${pct(r.z)}/${pct(r.o)}/${pct(r.d)}`.padEnd(18),
    pct(r.ddJoueur).padEnd(18), pct(r.duel).padEnd(18)].join('| '));
}

// ── Écosystème NORMAL (config défaut : vautour réserve + 2 IA appétit 3) ──
// Ici le plafond ACTIONS (×3/×5) est dormant (l'IA ne demande que ×3) → seul le plafond
// ALT mord (clampe les achats PEVC de l'IA). Mesure l'effet RÉEL sur la partie calibrée.
function normalCell(altCap: number) {
  const wrap = (p: Policy) => capLeverage(p, 5, altCap);
  const policies = [alwaysReserve, wrap(policyForProfile(FONDS_LEVERAGE)), wrap(policyForProfile(VALUE_PATIENT))];
  const rs = simulate(presetMvp(SEED), N, { policies });
  const z = rs.filter((r) => r.crisisCount === 0).length / N;
  const o = rs.filter((r) => r.crisisCount === 1).length / N;
  const d = rs.filter((r) => r.crisisCount >= 2).length / N;
  const duel = rs.filter((r) => r.trackRecords['fonds_leverage']!.score > r.trackRecords['value_patient']!.score).length / N;
  return { z, o, d, duel };
}
console.log('\n— Écosystème NORMAL (IA appétit 3) : seul le plafond ALT (PEVC) mord —');
console.log(['plafond alt', 'crises s/1/2+', 'duel fonds>value'].map((s) => s.padEnd(18)).join('| '));
for (const al of [99, 3, 2, 0]) {
  const r = normalCell(al);
  console.log([`PEVC ×${al === 99 ? '∞ (actuel)' : al}`.padEnd(18), `${pct(r.z)}/${pct(r.o)}/${pct(r.d)}`.padEnd(18), pct(r.duel).padEnd(18)].join('| '));
}
console.log('');
