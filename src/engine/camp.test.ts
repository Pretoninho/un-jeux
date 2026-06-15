import { describe, it, expect } from 'vitest';
import {
  makeCamp,
  campCharge,
  actorCharges,
  repayDebt,
  canRepay,
  type Camp,
} from './camp';

// ─────────────────────── makeCamp ────────────────────────────────────────────

describe('camp — création', () => {
  it('crée un camp Tronc A avec debtRemaining = loanAmount', () => {
    const c = makeCamp('alice', 100, 'A', 0.1);
    expect(c.ownerId).toBe('alice');
    expect(c.loanAmount).toBe(100);
    expect(c.chargeRate).toBe(0.1);
    expect(c.tronc).toBe('A');
    expect(c.debtRemaining).toBe(100);
  });

  it('crée un camp Tronc B avec debtRemaining = loanAmount', () => {
    const c = makeCamp('bob', 80, 'B', 0.05);
    expect(c.debtRemaining).toBe(80);
    expect(c.tronc).toBe('B');
  });

  it('lève une erreur si loanAmount ≤ 0', () => {
    expect(() => makeCamp('alice', 0, 'A', 0.1)).toThrow();
    expect(() => makeCamp('alice', -10, 'A', 0.1)).toThrow();
  });

  it('lève une erreur si chargeRate ≤ 0', () => {
    expect(() => makeCamp('alice', 100, 'A', 0)).toThrow();
  });
});

// ─────────────────────── campCharge ──────────────────────────────────────────

describe('camp — charge par tour', () => {
  it('Tronc A : charge fixe = rate × loanAmount', () => {
    const c = makeCamp('alice', 100, 'A', 0.1);
    expect(campCharge(c)).toBeCloseTo(10);
  });

  it('Tronc A : charge inchangée même si on altère debtRemaining (impossible mais test)', () => {
    const c: Camp = { ...makeCamp('alice', 100, 'A', 0.1), debtRemaining: 50 };
    // Tronc A : toujours rate × loanAmount
    expect(campCharge(c)).toBeCloseTo(10);
  });

  it('Tronc B : charge = rate × debtRemaining initial', () => {
    const c = makeCamp('bob', 200, 'B', 0.05);
    expect(campCharge(c)).toBeCloseTo(10); // 0.05 × 200
  });

  it('Tronc B : charge diminue après remboursement partiel', () => {
    const c = makeCamp('bob', 200, 'B', 0.05);
    const { camp: c2 } = repayDebt(c, 100);
    expect(campCharge(c2)).toBeCloseTo(5); // 0.05 × 100
  });

  it('Tronc B : charge = 0 après remboursement total', () => {
    const c = makeCamp('bob', 200, 'B', 0.05);
    const { camp: c2 } = repayDebt(c, 200);
    expect(campCharge(c2)).toBe(0);
  });
});

// ─────────────────────── actorCharges ────────────────────────────────────────

describe('camp — charges totales', () => {
  it('somme les charges de tous les camps d\'un acteur', () => {
    const c1 = makeCamp('alice', 100, 'A', 0.1); // 10/tour
    const c2 = makeCamp('alice', 50, 'A', 0.2);  //  10/tour
    expect(actorCharges('alice', [c1, c2])).toBeCloseTo(20);
  });

  it('ne compte que les camps de l\'acteur demandé', () => {
    const c1 = makeCamp('alice', 100, 'A', 0.1);
    const c2 = makeCamp('bob', 200, 'A', 0.1);
    expect(actorCharges('alice', [c1, c2])).toBeCloseTo(10);
    expect(actorCharges('bob', [c1, c2])).toBeCloseTo(20);
  });

  it('retourne 0 si aucun camp', () => {
    expect(actorCharges('alice', [])).toBe(0);
  });
});

// ─────────────────────── repayDebt ───────────────────────────────────────────

describe('camp — remboursement', () => {
  it('Tronc A : repayDebt sans effet, repaid = 0', () => {
    const c = makeCamp('alice', 100, 'A', 0.1);
    const { camp, repaid, extinguished } = repayDebt(c, 50);
    expect(repaid).toBe(0);
    expect(extinguished).toBe(false);
    expect(camp.debtRemaining).toBe(100); // inchangé
  });

  it('Tronc B : remboursement partiel réduit debtRemaining', () => {
    const c = makeCamp('bob', 200, 'B', 0.05);
    const { camp, repaid, extinguished } = repayDebt(c, 80);
    expect(repaid).toBe(80);
    expect(camp.debtRemaining).toBe(120);
    expect(extinguished).toBe(false);
  });

  it('Tronc B : remboursement total → extinguished = true', () => {
    const c = makeCamp('bob', 200, 'B', 0.05);
    const { camp, extinguished } = repayDebt(c, 200);
    expect(camp.debtRemaining).toBe(0);
    expect(extinguished).toBe(true);
  });

  it('Tronc B : sur-remboursement plafonné à 0 (pas de dette négative)', () => {
    const c = makeCamp('bob', 100, 'B', 0.1);
    const { camp, repaid } = repayDebt(c, 500);
    expect(repaid).toBe(100);
    expect(camp.debtRemaining).toBe(0);
  });

  it('Tronc B : remboursement de 0 sans effet', () => {
    const c = makeCamp('bob', 100, 'B', 0.1);
    const { repaid } = repayDebt(c, 0);
    expect(repaid).toBe(0);
  });
});

// ─────────────────────── canRepay ────────────────────────────────────────────

describe('camp — canRepay', () => {
  it('Tronc A : toujours false', () => {
    const c = makeCamp('alice', 100, 'A', 0.1);
    expect(canRepay(c)).toBe(false);
  });

  it('Tronc B avec dette : true', () => {
    const c = makeCamp('bob', 100, 'B', 0.1);
    expect(canRepay(c)).toBe(true);
  });

  it('Tronc B éteint : false', () => {
    const c = makeCamp('bob', 100, 'B', 0.1);
    const { camp } = repayDebt(c, 100);
    expect(canRepay(camp)).toBe(false);
  });
});
