// Intégration du crédit-coupons dans la boucle de tour (spec crédit-coupons §5).
// On exerce le VRAI runTurn : un joueur scripté ouvre un coupon, et on vérifie que le
// cycle de vie (portage → échéance), la sortie du monde V et la réaction BC sont câblés.

import { describe, it, expect } from 'vitest';
import { buildInitialState } from './init';
import { runTurn } from './turn';
import { alwaysReserve, steadyLong, type Policy, type PlannedAction } from './policy';
import { presetMvp } from '../data/config-mvp';

function scripted(actions: PlannedAction[]): Policy {
  let done = false;
  return { id: 'scripted', decide: () => (done ? [{ verb: 'RESERVER' }] : ((done = true), actions)) };
}

describe('intégration crédit-coupons dans le tour', () => {
  it('le crédit a quitté le monde V : aucun hexe crédit n’a de prix `V`', () => {
    const { state } = buildInitialState(presetMvp(1));
    for (const hex of state.map.hexes) {
      if (hex.cluster === 'credit') expect(state.market[hex.id]).toBeUndefined();
    }
    // ...mais le marché actions/alternatifs existe bien.
    expect(state.market['LC_US']).toBeDefined();
  });

  it('le carnet offre des coupons court+long par émetteur dès l’init', () => {
    const { state } = buildInitialState(presetMvp(1));
    const issuers = new Set(state.credit.book.map((c) => c.issuer));
    expect(issuers).toContain('IG_US');
    expect(issuers).toContain('HY_US'); // la frontière émet aussi
  });

  it('ouvrir un coupon LONG ponctionne le cash, crée la position, et réémet le slot', () => {
    const { state, rng } = buildInitialState(presetMvp(1));
    const before = state.credit.book.find((c) => c.issuer === 'IG_US' && c.maturity === 'court')!;
    runTurn(state, [
      scripted([{ verb: 'POSITIONNER', op: 'ouvrir_coupon', issuer: 'IG_US', maturity: 'court', notional: 20, direction: 'long' }]),
      alwaysReserve, alwaysReserve,
    ], rng);
    const player = state.actors[0]!;
    expect(player.couponPositions).toHaveLength(1);
    expect(player.couponPositions[0]!.issuer).toBe('IG_US');
    // Le coupon consommé n’est plus offert ; un nouveau slot IG_US/court a été réémis.
    expect(state.credit.book.some((c) => c.id === before.id)).toBe(false);
    expect(state.credit.book.some((c) => c.issuer === 'IG_US' && c.maturity === 'court')).toBe(true);
  });

  it('un coupon LONG court arrive à échéance (vrai bond) : principal rendu, position close', () => {
    const { state, rng } = buildInitialState(presetMvp(1));
    const policies: Policy[] = [
      scripted([{ verb: 'POSITIONNER', op: 'ouvrir_coupon', issuer: 'IG_US', maturity: 'court', notional: 20, direction: 'long' }]),
      alwaysReserve, alwaysReserve,
    ];
    const wealth0 = state.actors[0]!.wealthHistory[0]!;
    runTurn(state, policies, rng); // ouverture + 1er portage
    runTurn(state, policies, rng); // 2e portage + échéance (RCE court = 2)
    const player = state.actors[0]!;
    // Pas de crise sur ces 2 premiers tours (F bas) → pas de défaut : le coupon se règle.
    expect(player.couponPositions).toHaveLength(0);
    // Tenu à terme, long sans défaut = gain net (somme des portages) → richesse ≥ départ.
    const wealthEnd = player.wealthHistory[player.wealthHistory.length - 1]!;
    expect(wealthEnd).toBeGreaterThan(wealth0);
  });

  it('la Banque centrale réagit : son taux MONTE quand le levier pousse F en surchauffe', () => {
    // On teste la FONCTION DE RÉACTION (câblage bcReact), donc en mode continu : avec des
    // réunions espacées, la surchauffe peut tomber ENTRE deux réunions et se résoudre en
    // crise avant la suivante (comportement réel, couvert par le test de cadence ci-dessous).
    const { state, rng } = buildInitialState({ ...presetMvp(7), paramsOverride: { bcMeetingEvery: 1 } });
    const base = state.credit.bc.rate;
    // Trois fonds leveragés poussent F au-dessus de la zone morte → la BC doit resserrer.
    const policies = [steadyLong(4), steadyLong(4), steadyLong(4)];
    let maxRate = base;
    for (let t = 0; t < 8; t++) {
      runTurn(state, policies, rng);
      maxRate = Math.max(maxRate, state.credit.bc.rate);
    }
    expect(maxRate).toBeGreaterThan(base + 1e-3); // la fonction de réaction a resserré
  });

  it('réunions planifiées : le taux est FIGÉ entre deux réunions et ne bouge qu’aux réunions', () => {
    // Cadence forcée à 4. Trois fonds leveragés chauffent F → la BC voudrait resserrer,
    // mais ne le peut QU’aux tours 4 et 8. Entre deux, r_BC ne doit pas bouger d’un iota.
    const { state, rng } = buildInitialState({ ...presetMvp(7), paramsOverride: { bcMeetingEvery: 4 } });
    const policies = [steadyLong(4), steadyLong(4), steadyLong(4)];
    const rates: number[] = [state.credit.bc.rate];
    for (let t = 0; t < 8; t++) {
      runTurn(state, policies, rng);
      rates.push(state.credit.bc.rate);
    }
    // rates[i] = taux après le tour i. Hors réunion (tours 1-3, 5-7) → identique au précédent.
    for (const t of [1, 2, 3, 5, 6, 7]) expect(rates[t]).toBe(rates[t - 1]);
    // Au moins une réunion (t4 ou t8) a effectivement bougé le taux.
    expect(rates[4] !== rates[3] || rates[8] !== rates[7]).toBe(true);
  });
});
