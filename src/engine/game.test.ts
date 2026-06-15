import { describe, it, expect } from 'vitest';
import { makeGameStateV2, makeActorV2, type GameStateV2 } from './state2';
import {
  claimCost, canClaim, claimHex, borrow, foundBaseCamps, aiTurn, endTurn,
  defaultAsk, askFloor, setAsk, evictionCost, canEvict, evict,
  netWorth, territoryValue, outstandingDebt, type GameConfig,
} from './game';
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
const GAME: GameConfig = {
  horizonTurns: 12, claimMultiple: 4, askDefaultMultiple: 6, askFloorMultiple: 4,
  chargeRate: 0.2, baseCampLoan: 120,
};

function fresh(aliceCash = 100, bobCash = 100): GameStateV2 {
  return makeGameStateV2(MAP, CFG, [
    makeActorV2('alice', 'Alice', aliceCash),
    makeActorV2('bob', 'Bob', bobCash),
  ]);
}

describe('game — acquérir un hex libre + ordre de vente auto', () => {
  it('coût = base × multiple', () => {
    expect(claimCost(fresh(), 'A', GAME)).toBe(40); // 10 × 4
  });

  it('claimHex débite le cash, pose la propriété ET un ask par défaut', () => {
    const s = claimHex(fresh(100), 'alice', 'A', GAME);
    expect(s.ownership['A']).toBe('alice');
    expect(s.actors.find((a) => a.id === 'alice')!.cash).toBe(60); // 100 − 40
    // ask par défaut = revenu courant (10, isolé) × askDefaultMultiple (6) = 60
    expect(s.asks['A']).toBe(60);
  });

  it('canClaim faux si cash insuffisant ou déjà possédé', () => {
    expect(canClaim(fresh(30), 'alice', 'A', GAME)).toBe(false);
    const s = claimHex(fresh(), 'alice', 'A', GAME);
    expect(canClaim(s, 'bob', 'A', GAME)).toBe(false);
  });

  it('claimHex sans effet si interdit (immuable)', () => {
    const s0 = fresh(30);
    expect(claimHex(s0, 'alice', 'A', GAME)).toBe(s0);
  });
});

describe('game — carnet d\'ordres (ask = prix de sortie)', () => {
  it('defaultAsk = revenu courant × askDefaultMultiple (agglomération comprise)', () => {
    let s = claimHex(fresh(200), 'alice', 'A', GAME);
    s = claimHex(s, 'alice', 'B', GAME); // A+B contigus → B vaut 10 + 5 = 15
    expect(defaultAsk(s, 'B', GAME)).toBe(90); // 15 × 6
  });

  it('setAsk : seul le propriétaire peut poser, borné au plancher', () => {
    const s = claimHex(fresh(200), 'alice', 'A', GAME);
    const floor = askFloor(s, 'A', GAME); // base 10 × askFloorMultiple 4 = 40
    expect(floor).toBe(40);

    const s2 = setAsk(s, 'alice', 'A', 200, GAME);
    expect(s2.asks['A']).toBe(200);

    const s3 = setAsk(s, 'alice', 'A', 5, GAME); // sous le plancher → ramené à 40
    expect(s3.asks['A']).toBe(40);

    const s4 = setAsk(s, 'bob', 'A', 1, GAME); // pas proprio → sans effet
    expect(s4).toBe(s);
  });
});

describe('game — emprunter + camp de base', () => {
  it('borrow crédite le cash et ouvre un camp permanent', () => {
    const s = borrow(fresh(50), 'alice', 100, GAME);
    expect(s.actors.find((a) => a.id === 'alice')!.cash).toBe(150);
    expect(s.camps).toHaveLength(1);
    expect(s.camps[0]!.chargeRate).toBe(0.2);
  });

  it('foundBaseCamps : chaque acteur reçoit son premier emprunt', () => {
    const s = foundBaseCamps(fresh(0, 0), GAME);
    expect(s.camps).toHaveLength(2);
    expect(s.actors.every((a) => a.cash === GAME.baseCampLoan)).toBe(true);
  });
});

describe('game — éviction = payer l\'ask de l\'occupant', () => {
  it('evictionCost = ask déclaré par l\'occupant', () => {
    const s = claimHex(fresh(0, 100), 'bob', 'A', GAME); // bob pose A, ask 60
    expect(evictionCost(s, 'A')).toBe(60);
  });

  it('canEvict vrai si hex adverse + cash ≥ ask ; faux sinon', () => {
    let s = claimHex(fresh(0, 100), 'bob', 'A', GAME); // ask 60
    s = { ...s, actors: s.actors.map((a) => a.id === 'alice' ? { ...a, cash: 60 } : a) };
    expect(canEvict(s, 'alice', 'A')).toBe(true);
    const poor = { ...s, actors: s.actors.map((a) => a.id === 'alice' ? { ...a, cash: 59 } : a) };
    expect(canEvict(poor, 'alice', 'A')).toBe(false);
  });

  it('canEvict faux si libre ou déjà à moi', () => {
    expect(canEvict(fresh(), 'alice', 'A')).toBe(false);
    const s = claimHex(fresh(200), 'alice', 'A', GAME);
    expect(canEvict(s, 'alice', 'A')).toBe(false);
  });

  it('evict : zéro-sum (acheteur paie l\'ask, occupant encaisse), l\'hex change de main + nouvel ask', () => {
    let s = claimHex(fresh(100, 100), 'bob', 'A', GAME); // bob: 60 cash, A ask 60
    s = { ...s, actors: s.actors.map((a) => a.id === 'alice' ? { ...a, cash: 100 } : a) };
    const ask = evictionCost(s, 'A'); // 60
    const totalBefore = s.actors.reduce((sum, a) => sum + a.cash, 0);

    s = evict(s, 'alice', 'A', GAME);

    expect(s.ownership['A']).toBe('alice');
    expect(s.actors.find((a) => a.id === 'alice')!.cash).toBe(100 - ask);
    expect(s.actors.find((a) => a.id === 'bob')!.cash).toBe(60 + ask);
    expect(s.actors.reduce((sum, a) => sum + a.cash, 0)).toBe(totalBefore); // zéro-sum
    expect(s.asks['A']).toBe(defaultAsk(s, 'A', GAME)); // le nouvel occupant repose un ask
  });
});

describe('game — richesse nette (mesure de victoire)', () => {
  it('territoryValue = somme des prix de marché des hexes possédés', () => {
    let s = claimHex(fresh(200), 'alice', 'A', GAME); // 40
    s = claimHex(s, 'alice', 'B', GAME); // 40
    expect(territoryValue(s, 'alice', GAME)).toBe(80);
  });

  it('outstandingDebt = somme des reliquats de camps', () => {
    const s = borrow(fresh(0), 'alice', 120, GAME);
    expect(outstandingDebt(s, 'alice')).toBe(120);
  });

  it('netWorth = cash + territoire − dette → emprunter est neutre à l\'instant T', () => {
    const s0 = fresh(0);
    const s1 = borrow(s0, 'alice', 120, GAME); // cash +120, dette +120 → net inchangé
    expect(netWorth(s1, 'alice', GAME)).toBe(netWorth(s0, 'alice', GAME));
  });
});

describe('game — IA', () => {
  it('l\'IA achète, pose ses asks, et reste solvable', () => {
    let s = foundBaseCamps(fresh(0, 0), GAME); // bob a du capital
    s = aiTurn(s, 'bob', GAME);
    const bobHexes = Object.values(s.ownership).filter((o) => o === 'bob');
    expect(bobHexes.length).toBeGreaterThanOrEqual(1);
    // tout hex possédé par bob a un ask
    for (const h of s.map.hexes) {
      if (s.ownership[h.id] === 'bob') expect(s.asks[h.id]).toBeGreaterThan(0);
    }
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
    let s = foundBaseCamps(fresh(0, 0), GAME);
    s = claimHex(s, 'alice', 'A', GAME);
    const { state, reports } = endTurn(s, ['bob'], GAME);
    expect(state.turn).toBe(1);
    expect(reports.find((r) => r.actorId === 'alice')).toBeDefined();
  });
});
