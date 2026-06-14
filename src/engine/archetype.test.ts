// Compétences d'archétype du Vautour : « Récolte » (offensive, carry ×factor N tours) et
// « Couverture » (défensive, armer + auto-tir : anti-défaut des coupons pendant `window` tours).

import { describe, it, expect } from 'vitest';
import { buildInitialState } from './init';
import { runTurn } from './turn';
import { alwaysReserve, type Policy } from './policy';
import { presetMvp } from '../data/config-mvp';
import type { ActorState } from './state';
import type { CouponPosition } from './credit';

// Donne au joueur une position V à carry connu (LC_US, carry 0.015) sans toucher au cash.
function seed(s: number) {
  const { state, rng } = buildInitialState(presetMvp(s));
  const player = state.actors[0]!;
  player.positions.push({ hexId: 'LC_US', direction: 'long', equity: 100, leverage: 0, entryV: state.market['LC_US']!.V, entryTurn: 0 });
  return { state, rng, player };
}

const reserveAll: Policy[] = [alwaysReserve, alwaysReserve, alwaysReserve];
const activateThenReserve: Policy = {
  id: 'activate',
  decide: (actor: ActorState, state) =>
    actor.carrySkill && state.turn >= (actor.carrySkillReadyAt ?? 0)
      ? [{ verb: 'COMPETENCE', skill: 'carry_boost' }]
      : [{ verb: 'RESERVER' }],
};

describe('Vautour — compétence offensive « Récolte »', () => {
  it('le Vautour porte les deux compétences (données copiées à l’init)', () => {
    const { player } = seed(1);
    expect(player.carrySkill).toEqual({ factor: 2, duration: 2, cooldown: 18, paCost: 3 });
    expect(player.coverSkill).toEqual({ window: 2, cooldown: 10, paCost: 2 });
  });

  it('activée, elle MULTIPLIE le carry encaissé (×factor) au tour résolu', () => {
    const off = seed(5);
    runTurn(off.state, reserveAll, off.rng);
    const on = seed(5);
    runTurn(on.state, [activateThenReserve, alwaysReserve, alwaysReserve], on.rng);
    // ~1.5 (= 100 × 0.015 × (2−1)) + un cheveu de carry cash gagné sur ce surplus → tolérance large.
    const extra = on.player.cash - off.player.cash;
    expect(extra).toBeCloseTo(100 * 0.015 * (2 - 1), 1);
  });

  it('pose un cooldown : indisponible juste après l’activation', () => {
    const { state, rng, player } = seed(5);
    runTurn(state, [activateThenReserve, alwaysReserve, alwaysReserve], rng); // active au tour 1
    expect(player.carrySkillReadyAt).toBe(1 + 2 + 18); // activation + duration + cooldown = 21
    expect(player.carryBoostUntil).toBe(2); // boost actif tours 1 et 2
  });
});

describe('Vautour — compétence défensive « Couverture »', () => {
  // Charge un book de coupons HY (fort risque de défaut) qui ne vient pas à échéance.
  function withCoupons(s: number, armed: boolean) {
    const { state, rng } = buildInitialState(presetMvp(s));
    const p = state.actors[0]!;
    for (let i = 0; i < 30; i++) {
      const cp: CouponPosition = { couponId: `c${i}`, issuer: 'HY_US', side: 'long', rate: 0.07, qualitySpread: 0.07, notional: 3, rceLeft: 80 };
      p.couponPositions.push(cp);
    }
    state.fragility = 0.95; // force une crise quasi certaine → défauts crédit
    if (armed) p.coverArmedUntil = 999; // armée en continu
    return { state, rng, p };
  }

  it('armée, elle PROTÈGE les coupons du défaut en crise (le contrôle, lui, défaut)', () => {
    const armed = withCoupons(3, true);
    const ctrl = withCoupons(3, false);
    for (let t = 0; t < 15; t++) {
      runTurn(armed.state, reserveAll, armed.rng);
      runTurn(ctrl.state, reserveAll, ctrl.rng);
    }
    expect(armed.p.couponPositions.length).toBe(30); // aucun défaut, aucune échéance (rce>15)
    expect(ctrl.p.couponPositions.length).toBeLessThan(30); // le non-couvert a subi des défauts
  });

  it('armer pose la fenêtre et le cooldown', () => {
    const { state, rng, player } = seed(5);
    const arm: Policy = { id: 'arm', decide: (a) => (a.coverSkill && (a.coverReadyAt ?? 0) <= 1 ? [{ verb: 'COMPETENCE', skill: 'cover_arm' }] : [{ verb: 'RESERVER' }]) };
    runTurn(state, [arm, alwaysReserve, alwaysReserve], rng); // arme au tour 1
    expect(player.coverArmedUntil).toBe(1 + 2 - 1); // armée tours 1 et 2 → jusqu'à 2
    expect(player.coverReadyAt).toBe(1 + 2 + 10); // activation + window + cooldown = 13
  });
});

describe('Vautour — contrainte (noLeverage) & ressource (Réserve sèche)', () => {
  const openLC = (leverage: number): Policy => ({
    id: 'open',
    decide: (a) => (a.positions.length === 0 ? [{ verb: 'POSITIONNER', op: 'ouvrir', hexId: 'LC_US', equity: 50, leverage, direction: 'long' }] : [{ verb: 'RESERVER' }]),
  });

  it('contrainte : le levier demandé est rogné à 0 (capital patient)', () => {
    const { state, rng } = buildInitialState(presetMvp(1));
    runTurn(state, [openLC(3), alwaysReserve, alwaysReserve], rng);
    const pos = state.actors[0]!.positions.find((p) => p.hexId === 'LC_US');
    expect(pos?.leverage).toBe(0); // ×3 demandé → 0 (noLeverage)
  });

  it('ressource : +1 par tour patient, plafonnée à `max`', () => {
    const { state, rng } = buildInitialState(presetMvp(1));
    for (let t = 0; t < 12; t++) runTurn(state, reserveAll, rng); // 12 tours de réserve
    expect(state.actors[0]!.dryPowder).toBe(8); // plafond (max = 8)
  });

  it('ressource : déployer en haute fragilité DÉCOTE l’entrée et consomme la poudre', () => {
    const { state, rng } = buildInitialState(presetMvp(1));
    const p = state.actors[0]!;
    p.dryPowder = 8; // poudre pleine
    state.fragility = 0.95; // haute (> fThreshold 0.55)
    const V = state.market['LC_US']!.V;
    runTurn(state, [openLC(0), alwaysReserve, alwaysReserve], rng);
    const pos = p.positions.find((x) => x.hexId === 'LC_US')!;
    expect(pos.entryV).toBeCloseTo(V * (1 - 0.1), 6); // décote 8 × 0.0125 = 10 %
    expect(p.dryPowder).toBe(0); // poudre dépensée
  });

  it('ressource : PAS de décote au calme (fragilité basse)', () => {
    const { state, rng } = buildInitialState(presetMvp(1));
    const p = state.actors[0]!;
    p.dryPowder = 8;
    state.fragility = 0.2; // basse (< fThreshold)
    const V = state.market['LC_US']!.V;
    runTurn(state, [openLC(0), alwaysReserve, alwaysReserve], rng);
    expect(p.positions.find((x) => x.hexId === 'LC_US')!.entryV).toBe(V); // entrée au prix plein
  });
});

describe('Sismographe — contrainte « fragile au calme » (thêta de couverture)', () => {
  it('au calme (hors crise), il fond — sans thêta, il ne fond pas', () => {
    // Deux runs identiques (même seed), seul le thêta diffère ; on reste au calme (réserve,
    // f0 < zone morte → pas de crise tour 1). Le run avec thêta doit avoir MOINS de cash.
    const sans = buildInitialState(presetMvp(1));
    runTurn(sans.state, reserveAll, sans.rng);
    const avec = buildInitialState(presetMvp(1));
    avec.state.actors[0]!.calmTheta = 0.02; // 2 %/tour
    runTurn(avec.state, reserveAll, avec.rng);
    // L'écart ≈ 2 % de la richesse (~2 sur 100), le reste (carry cash) étant identique.
    expect(avec.state.actors[0]!.cash).toBeLessThan(sans.state.actors[0]!.cash - 1.5);
  });
});
