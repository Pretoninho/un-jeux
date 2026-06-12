import { describe, it, expect } from 'vitest';
import { policyForProfile } from './ai';
import { alwaysReserve } from './policy';
import { buildInitialState } from './init';
import { simulate } from './simulate';
import { makeRng } from './rng';
import { presetMvp } from '../data/config-mvp';
import { FONDS_LEVERAGE } from '../data/profiles/fonds-leverage';
import { VALUE_PATIENT } from '../data/profiles/value-patient';
import type { GameState } from './state';

function freshState(seed: number): GameState {
  const { state } = buildInitialState(presetMvp(seed));
  return state;
}

describe('Fonds leveragé (momentum + levier, spec §7)', () => {
  const policy = policyForProfile(FONDS_LEVERAGE);

  it('ouvre des positions LEVERAGÉES quand la volatilité perçue est basse', () => {
    const state = freshState(1);
    state.fragility = 0.15; // bas → volatilité perçue basse
    const actor = state.actors[1]!;
    let leveragedOpens = 0;
    for (let s = 0; s < 50; s++) {
      const [a] = policy.decide(actor, state, makeRng(s + 1));
      if (a?.verb === 'POSITIONNER' && a.op === 'ouvrir') {
        expect(a.leverage).toBeGreaterThan(0); // jamais un open sans levier
        leveragedOpens++;
      }
    }
    expect(leveragedOpens).toBeGreaterThan(25); // l'essentiel du temps il charge
  });
});

describe('Value patient (valeur, sans levier, spec §7)', () => {
  const policy = policyForProfile(VALUE_PATIENT);

  it('achète la décote SANS levier, et jamais avec levier', () => {
    const state = freshState(2);
    state.market['LC_US'] = { V: 75, A: 100 }; // forte décote
    const actor = state.actors[2]!;
    let boughtTheDip = 0;
    for (let s = 0; s < 50; s++) {
      const [a] = policy.decide(actor, state, makeRng(s + 1));
      if (a?.verb === 'POSITIONNER' && a.op === 'ouvrir') {
        expect(a.leverage).toBe(0); // JAMAIS de levier
        if (a.hexId === 'LC_US') boughtTheDip++;
      }
    }
    expect(boughtTheDip).toBeGreaterThan(20); // vise bien l'actif bradé
  });

  it('n’achète pas un marché survalorisé (V au-dessus de l’ancre)', () => {
    const state = freshState(3);
    for (const id of Object.keys(state.market)) state.market[id] = { V: 120, A: 100 }; // tout cher
    const actor = state.actors[2]!;
    let reserves = 0;
    for (let s = 0; s < 50; s++) {
      if (policy.decide(actor, state, makeRng(s + 1))[0]?.verb === 'RESERVER') reserves++;
    }
    expect(reserves).toBe(50); // jamais d'achat quand tout est cher (au-delà du bruit d'estimation)
  });
});

describe('ÉMERGENCE avec les vraies IA', () => {
  const N = 60;
  const fl = policyForProfile(FONDS_LEVERAGE);
  // Pic de fragilité moyen atteint sur une partie : mesure combien chaque table
  // « chauffe » le système (le taux de crise sature et ne discrimine pas).
  const meanPeakF = (policies: Parameters<typeof simulate>[2]) => {
    const res = simulate(presetMvp(2000), N, policies);
    return res.reduce((a, r) => a + Math.max(...r.fragilityHistory), 0) / N;
  };

  it('une table de Fonds leveragés chauffe le système plus qu’une table tout-réserve', () => {
    // Le levier nourrit F directement (memo §23.2) ; la contribution émerge, pas codée.
    // (vs Value patient : non discriminant aux paramètres non calibrés — les deux saturent
    //  via le crowding ; à départager en J7.)
    expect(meanPeakF({ policies: [fl, fl, fl] })).toBeGreaterThan(
      meanPeakF({ policies: [alwaysReserve, alwaysReserve, alwaysReserve] }),
    );
  });

  it('le preset MVP par défaut (Vautour + 2 IA) tourne et score tous les acteurs', () => {
    const [res] = simulate(presetMvp(1), 1); // politiques par défaut = vraies IA
    expect(Object.keys(res!.trackRecords).sort()).toEqual(
      ['fonds_leverage', 'value_patient', 'vautour'].sort(),
    );
  });
});
