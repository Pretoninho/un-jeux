import { describe, it, expect } from 'vitest';
import { makeGameStateV2, makeActorV2, type GameStateV2 } from './state2';
import { claimCost, canClaim, claimHex, borrow, aiTurn, endTurn, type GameConfig } from './game';
import type { GameMap } from './types';
import type { RevenueConfig } from './revenue';

const MAP: GameMap = {
  id: 'gametest',
  hexes: [
    { id: 'A', label: 'A', kind: 'marche', neighbors: ['B'] },
    { id: 'B', label: 'B', kind: 'marche', neighbors: ['A', 'C'] },
    { id: 'C', label: 'C', kind: 'marche', neighbors: ['B'] },
  ],
};
const CFG: RevenueConfig = { baseByHex: { A: 10, B: 10, C: 10 }, agglomerationBonus: 5 };
const GAME: GameConfig = { horizonTurns: 12, claimMultiple: 4, chargeRate: 0.1 };

function fresh(aliceCash = 100, bobCash = 100): GameStateV2 {
  return makeGameStateV2(MAP, CFG, [
    makeActorV2('alice', 'Alice', aliceCash),
    makeActorV2('bob', 'Bob', bobCash),
  ]);
}

describe('game — acquérir un hex libre', () => {
  it('coût = base × multiple', () => {
    expect(claimCost(fresh(), 'A', GAME)).toBe(40); // 10 × 4
  });

  it('canClaim vrai si libre + cash suffisant', () => {
    expect(canClaim(fresh(100), 'alice', 'A', GAME)).toBe(true);
  });

  it('canClaim faux si cash insuffisant', () => {
    expect(canClaim(fresh(30), 'alice', 'A', GAME)).toBe(false);
  });

  it('canClaim faux si déjà possédé', () => {
    const s = claimHex(fresh(), 'alice', 'A', GAME);
    expect(canClaim(s, 'bob', 'A', GAME)).toBe(false);
  });

  it('claimHex débite le cash et pose la propriété', () => {
    const s = claimHex(fresh(100), 'alice', 'A', GAME);
    expect(s.ownership['A']).toBe('alice');
    expect(s.actors.find((a) => a.id === 'alice')!.cash).toBe(60); // 100 − 40
  });

  it('claimHex sans effet si interdit (immuable)', () => {
    const s0 = fresh(30);
    const s1 = claimHex(s0, 'alice', 'A', GAME);
    expect(s1).toBe(s0); // pas de cash → état inchangé
  });
});

describe('game — emprunter', () => {
  it('borrow crédite le cash et ouvre un camp', () => {
    const s = borrow(fresh(50), 'alice', 100, 'A', GAME);
    expect(s.actors.find((a) => a.id === 'alice')!.cash).toBe(150);
    expect(s.camps).toHaveLength(1);
    expect(s.camps[0]!.tronc).toBe('A');
    expect(s.camps[0]!.chargeRate).toBe(0.1);
  });

  it('borrow sans effet si montant ≤ 0', () => {
    const s0 = fresh();
    expect(borrow(s0, 'alice', 0, 'A', GAME)).toBe(s0);
  });
});

describe('game — IA', () => {
  it('achète le meilleur hex abordable', () => {
    const s = aiTurn(fresh(100, 100), 'bob', GAME);
    // Bob a 100, garde 20 % → peut acheter des hexes à 40 tant que cash×0.8 ≥ 40
    const bobHexes = Object.values(s.ownership).filter((o) => o === 'bob').length;
    expect(bobHexes).toBeGreaterThanOrEqual(1);
  });

  it('privilégie l\'agglomération (voisins déjà à elle)', () => {
    let s = claimHex(fresh(100, 200), 'bob', 'A', GAME); // bob possède A
    s = aiTurn(s, 'bob', GAME);
    // B est adjacent à A → meilleur score → acquis avant C
    expect(s.ownership['B']).toBe('bob');
  });

  it('ne dépense pas tout (garde une réserve)', () => {
    const s = aiTurn(fresh(100, 45), 'bob', GAME);
    const bob = s.actors.find((a) => a.id === 'bob')!;
    expect(bob.cash).toBeGreaterThan(0);
  });

  it('IA faillie ne joue pas', () => {
    const s0 = fresh();
    s0.actors[1]!.bankrupt = true;
    const s1 = aiTurn(s0, 'bob', GAME);
    expect(Object.values(s1.ownership).filter((o) => o === 'bob')).toHaveLength(0);
  });
});

describe('game — fin de tour', () => {
  it('endTurn : l\'IA joue puis le tick avance le tour', () => {
    const s = claimHex(fresh(100, 100), 'alice', 'A', GAME); // alice a un hex
    const { state, reports } = endTurn(s, ['bob'], GAME);
    expect(state.turn).toBe(1);
    // bob a joué (acquis ≥ 1 hex)
    expect(Object.values(state.ownership).filter((o) => o === 'bob').length).toBeGreaterThanOrEqual(1);
    // alice encaisse son income
    expect(reports.find((r) => r.actorId === 'alice')!.income).toBe(10);
  });
});
