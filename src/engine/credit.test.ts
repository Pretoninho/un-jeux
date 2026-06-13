// Tests du moteur crédit-coupons (spec docs/spec-credit-coupons.md, phase 2a).
// On vérifie les NOMBRES (flux de trésorerie, taux, défaut) et les invariants de design :
// le coupon HY paie plus mais fait plus défaut, la BC réagit à F, le risque est lisible.

import { describe, it, expect } from 'vitest';
import { makeRng } from './rng';
import { drawInstanceParams } from './params';
import {
  initCredit, refreshBook, couponRate, bcReact, emitCoupon,
  openCouponPosition, accrueCoupons, settleMatured, resolveCouponDefaults,
  defaultProbability, couponPositionValue, creditIssuers,
  type CreditState, type CouponPosition, type BCState,
} from './credit';
import type { GameMap } from './types';

const P = drawInstanceParams(42);

// Carte crédit minimale : un IG (bas carry) et un HY (haut carry).
const MAP: GameMap = {
  id: 'test',
  hexes: [
    { id: 'IG', label: 'IG', kind: 'marche', cluster: 'credit', carry: 0.03, neighbors: [] },
    { id: 'HY', label: 'HY', kind: 'frontiere', cluster: 'credit', carry: 0.07, neighbors: [] },
    { id: 'LC', label: 'LC', kind: 'marche', cluster: 'actions', carry: 0.015, neighbors: [] },
  ],
};

describe('credit — carnet & émetteurs', () => {
  it('ne retient que les hexes du cluster crédit comme émetteurs', () => {
    const iss = creditIssuers(MAP).map((i) => i.id);
    expect(iss).toEqual(['IG', 'HY']);
  });

  it('le carnet initial offre un coupon COURT et un LONG par émetteur crédit', () => {
    const s = initCredit(MAP, 0.2, P);
    expect(s.book).toHaveLength(4); // 2 émetteurs × {court, long}
    for (const iss of ['IG', 'HY']) {
      expect(s.book.filter((c) => c.issuer === iss).map((c) => c.maturity).sort())
        .toEqual(['court', 'long']);
    }
  });

  it('refreshBook réémet seulement les emplacements manquants (consommés/expirés)', () => {
    const s = initCredit(MAP, 0.2, P);
    s.book = s.book.filter((c) => !(c.issuer === 'IG' && c.maturity === 'court'));
    expect(s.book).toHaveLength(3);
    refreshBook(s, MAP, 0.2, P);
    expect(s.book).toHaveLength(4); // l'emplacement IG/court est régénéré
  });
});

describe('credit — formation du taux (spec §3)', () => {
  const s = initCredit(MAP, 0.2, P); // F sous la zone morte → spread_F nul

  it('le HY paie plus que l\'IG (spread de qualité)', () => {
    const ig = couponRate(s.bc, 0.03, 'court', 0.2, P);
    const hy = couponRate(s.bc, 0.07, 'court', 0.2, P);
    expect(hy).toBeGreaterThan(ig);
  });

  it('la maturité longue paie une prime de terme', () => {
    const court = couponRate(s.bc, 0.03, 'court', 0.2, P);
    const long = couponRate(s.bc, 0.03, 'long', 0.2, P);
    expect(long).toBeGreaterThan(court);
    expect(long - court).toBeCloseTo(P.couponTermPremium, 10);
  });

  it('le spread de crédit s\'élargit quand F dépasse la zone morte (reprice)', () => {
    const calme = couponRate(s.bc, 0.03, 'court', P.crisisDeadZone, P); // F = seuil → excès 0
    const chaud = couponRate(s.bc, 0.03, 'court', P.crisisDeadZone + 0.2, P);
    expect(chaud).toBeGreaterThan(calme);
    expect(chaud - calme).toBeCloseTo(P.couponSpreadF * 0.2, 10);
  });
});

describe('credit — la BC réagit à l\'état caché (spec §4b)', () => {
  it('monte le taux quand F est en surchauffe, vers une cible lissée', () => {
    const bcState: BCState = { rate: P.bcRateBase, target: P.bcRateBase };
    const before = bcState.rate;
    bcReact(bcState, P.crisisDeadZone + 0.3, false, P); // forte surchauffe
    expect(bcState.target).toBeGreaterThan(before);
    expect(bcState.rate).toBeGreaterThan(before);
    expect(bcState.rate).toBeLessThan(bcState.target); // ajustement graduel (θ < 1)
  });

  it('coupe en crise (soutien d\'urgence) et ne passe jamais sous zéro', () => {
    const bcState: BCState = { rate: 0.02, target: 0.02 };
    bcReact(bcState, 0.1, true, P); // F bas + crise
    expect(bcState.target).toBe(0); // base + 0 − ψ, planché à 0
    expect(bcState.rate).toBeGreaterThanOrEqual(0);
  });

  it('converge vers sa cible si F reste stable (anticipable)', () => {
    const bcState: BCState = { rate: 0, target: 0 };
    for (let i = 0; i < 50; i++) bcReact(bcState, P.crisisDeadZone + 0.2, false, P);
    const expected = P.bcRateBase + P.bcReactF * 0.2;
    expect(bcState.rate).toBeCloseTo(expected, 4);
  });
});

describe('credit — trésorerie long/short (spec §6)', () => {
  const open = (side: 'long' | 'short', U: number) => {
    const s = initCredit(MAP, 0.2, P);
    const id = s.book.find((c) => c.issuer === 'IG' && c.maturity === 'court')!.id;
    const res = openCouponPosition(s, id, side, U)!;
    return { s, ...res };
  };

  it('ouverture : le long PAIE U, le short REÇOIT U', () => {
    expect(open('long', 10).entryCash).toBe(-10);
    expect(open('short', 10).entryCash).toBe(10);
  });

  it('ouverture retire le coupon du carnet (consommé, plus repositionnable)', () => {
    const { s, position } = open('long', 10);
    expect(s.book.some((c) => c.id === position.couponId)).toBe(false);
  });

  it('la valeur de richesse = pair (+U) pour le long, dette (−U) pour le short', () => {
    expect(couponPositionValue(open('long', 10).position)).toBe(10);
    expect(couponPositionValue(open('short', 10).position)).toBe(-10);
  });

  it('portage : le long encaisse taux·U, le short le paie ; le RCE décrémente', () => {
    const { position } = open('long', 100);
    const rce0 = position.rceLeft;
    const cash = accrueCoupons([position]);
    expect(cash).toBeCloseTo(position.rate * 100, 10);
    expect(position.rceLeft).toBe(rce0 - 1);
    // miroir exact côté short
    const short = open('short', 100).position;
    expect(accrueCoupons([short])).toBeCloseTo(-short.rate * 100, 10);
  });

  it('échéance (vrai bond) : le long récupère U, le short rend U, puis le coupon disparaît', () => {
    const long = open('long', 100).position;
    long.rceLeft = 0;
    const out = settleMatured([long]);
    expect(out.cash).toBe(100);
    expect(out.survivors).toHaveLength(0);
    expect(out.settled).toEqual([long.couponId]);

    const short = open('short', 100).position;
    short.rceLeft = 0;
    expect(settleMatured([short]).cash).toBe(-100);
  });

  it('P&L de vie cohérent : long tenu à terme = somme des portages (principal neutre)', () => {
    // long U=100 : entrée −100, k portages +rate·100, échéance +100 → net = k·rate·100.
    const { position } = open('long', 100);
    let cash = -100; // entrée
    const k = position.rceLeft;
    for (let t = 0; t < k; t++) cash += accrueCoupons([position]);
    cash += settleMatured([position]).cash;
    expect(cash).toBeCloseTo(k * position.rate * 100, 8);
  });
});

describe('credit — défaut tout-ou-rien (spec §7)', () => {
  it('aucun défaut hors crise crédit, même fragilité élevée', () => {
    const pos: CouponPosition = { couponId: 'x', issuer: 'HY', side: 'long', rate: 0.1, qualitySpread: 0.07, notional: 100, rceLeft: 3 };
    const out = resolveCouponDefaults([pos], 0.9, false, makeRng(1), P);
    expect(out.defaulted).toEqual([]);
    expect(out.survivors).toHaveLength(1);
    expect(out.wealthEffect).toBe(0);
  });

  it('le HY (qualité plus risquée) fait défaut plus souvent que l\'IG, et F aggrave', () => {
    const pIgCalme = defaultProbability(0.03, P.crisisDeadZone, P); // excès F = 0
    const pHyCalme = defaultProbability(0.07, P.crisisDeadZone, P);
    const pHyChaud = defaultProbability(0.07, P.crisisDeadZone + 0.3, P);
    expect(pHyCalme).toBeGreaterThan(pIgCalme); // qualité
    expect(pHyChaud).toBeGreaterThan(pHyCalme); // fragilité
  });

  it('en défaut : le long PERD le principal, le short le GAGNE (tout-ou-rien)', () => {
    // proba forcée à ~1 via une crise très chaude + qualité élevée → rng quasi toujours sous le seuil
    const long: CouponPosition = { couponId: 'l', issuer: 'HY', side: 'long', rate: 0.1, qualitySpread: 0.07, notional: 100, rceLeft: 3 };
    const short: CouponPosition = { couponId: 's', issuer: 'HY', side: 'short', rate: 0.1, qualitySpread: 0.07, notional: 100, rceLeft: 3 };
    // défaut certain : on monte F très haut → prob plafonne à 0.95 ; on choisit un seed qui défaut.
    const out = resolveCouponDefaults([long, short], 5, true, makeRng(7), P);
    // au moins l'un des deux ; vérifions la direction de l'effet de richesse selon les défauts.
    const lostLong = out.defaulted.includes('l');
    const wonShort = out.defaulted.includes('s');
    let expected = 0;
    if (lostLong) expected -= 100; // long défaut → −U
    if (wonShort) expected += 100; // short défaut → +U
    expect(out.wealthEffect).toBe(expected);
  });
});
