import { describe, it, expect } from 'vitest';
import { makeGameStateV2, makeActorV2, type GameStateV2 } from './state2';
import {
  claimCost, canClaim, claimHex, borrow, foundBaseCamps, aiTurn, endTurn,
  defaultAsk, askFloor, setAsk, evictionCost, canEvict, evict,
  netWorth, territoryValue, outstandingDebt, type GameConfig,
} from './game';
import { actorTotalCharges } from './tick';
import { makeBoard } from './board';
import type { GameMap } from './types';
import type { RevenueConfig } from './revenue';

// Carte : A (QG d'alice, 0 income) — B — C — D, + E (QG de bob).
const MAP: GameMap = {
  id: 'gametest',
  hexes: [
    { id: 'A', label: 'A', kind: 'marche', neighbors: ['B'] },
    { id: 'B', label: 'B', kind: 'marche', neighbors: ['A', 'C'] },
    { id: 'C', label: 'C', kind: 'marche', neighbors: ['B', 'D'] },
    { id: 'D', label: 'D', kind: 'marche', neighbors: ['C', 'E'] },
    { id: 'E', label: 'E', kind: 'marche', neighbors: ['D'] },
  ],
};
const CFG: RevenueConfig = { baseByHex: { A: 0, B: 10, C: 10, D: 10, E: 0 }, agglomerationBonus: 5, campHexes: ['A', 'E'] };
const GAME: GameConfig = {
  horizonTurns: 12, claimMultiple: 4, askDefaultMultiple: 6, askFloorMultiple: 4,
  chargeRate: 0.2, baseCampLoan: 100, hexUpkeep: 3,
};

function fresh(aliceCash = 100, bobCash = 100, upkeep = 3): GameStateV2 {
  const s = makeGameStateV2(MAP, CFG, [
    makeActorV2('alice', 'Alice', aliceCash),
    makeActorV2('bob', 'Bob', bobCash),
  ], upkeep);
  return s;
}

describe('game — camp de base = QG sans income + 1er emprunt', () => {
  it('foundBaseCamps : chaque acteur reçoit capital ET une charge permanente', () => {
    const s = foundBaseCamps(fresh(0, 0), GAME);
    expect(s.actors.every((a) => a.cash === GAME.baseCampLoan)).toBe(true); // capital reçu
    expect(s.camps).toHaveLength(2);
    // charge du camp de base = chargeRate × loan
    expect(actorTotalCharges(s, 'alice')).toBeCloseTo(GAME.chargeRate * GAME.baseCampLoan);
  });

  it('le QG (hex camp) ne rapporte aucun income', () => {
    let s = fresh(0, 0);
    s.ownership['A'] = 'alice'; // QG
    expect(netWorth(s, 'alice', GAME)).toBe(0); // QG sans valeur de marché ni income
  });

  it('le QG ne peut pas être évincé', () => {
    let s = fresh(0, 100);
    s.ownership['A'] = 'alice';
    s.asks['A'] = 30;
    expect(canEvict(s, 'bob', 'A')).toBe(false);
  });
});

describe('game — charge totale = camps + upkeep par hex d\'income', () => {
  it('upkeep s\'ajoute par hex d\'income possédé (QG exclu)', () => {
    let s = foundBaseCamps(fresh(0, 0), GAME); // charge de base 20
    s = claimHex(s, 'alice', 'B', GAME); // +1 hex income → +3 upkeep
    s = claimHex(s, 'alice', 'C', GAME); // +1 hex income → +3 upkeep
    expect(actorTotalCharges(s, 'alice')).toBeCloseTo(20 + 2 * 3); // 26
  });

  it('le QG ne paie pas d\'upkeep', () => {
    let s = fresh(0, 0, 3);
    s.ownership['A'] = 'alice'; // seulement le QG
    expect(actorTotalCharges(s, 'alice')).toBe(0); // pas de camp, pas d'upkeep sur le QG
  });
});

describe('game — rareté des hexes à income', () => {
  it('une case stérile (base 0) n\'est pas achetable, même libre', () => {
    const s = fresh(500);
    // B a une base > 0 → achetable ; fabriquons une case stérile en mettant sa base à 0
    const sterile: GameStateV2 = { ...s, revenueCfg: { ...s.revenueCfg, baseByHex: { ...s.revenueCfg.baseByHex, B: 0 } } };
    expect(canClaim(sterile, 'alice', 'B', GAME)).toBe(false);
  });

  it('makeBoard : incomeFraction 1 → toutes les cases (hors QG) produisent', () => {
    const full = makeBoard(2, 6, 2, 1, 1);
    const incomeFull = full.map.hexes.filter((h) => (full.rev.baseByHex[h.id] ?? 0) > 0).length;
    expect(incomeFull).toBe(full.map.hexes.length - 2); // tous sauf les 2 QG
  });

  it('makeBoard : même à fraction 0, chaque QG a ≥1 hex d\'income adjacent (départ jouable)', () => {
    const b = makeBoard(3, 6, 2, 0, 1);
    const income = b.map.hexes.filter((h) => (b.rev.baseByHex[h.id] ?? 0) > 0).map((h) => h.id);
    expect(income.length).toBe(2); // un hex garanti par QG (+ son miroir)
    for (const corner of b.corners) {
      const hex = b.map.hexes.find((h) => h.id === corner)!;
      expect(hex.neighbors.some((nb) => income.includes(nb))).toBe(true);
    }
  });

  it('makeBoard : les QG (coins) sont des camps sans income', () => {
    const b = makeBoard(3, 6, 2, 0.5, 7);
    expect(b.rev.campHexes).toEqual(b.corners);
    for (const c of b.corners) expect(b.rev.baseByHex[c]).toBe(0);
  });

  it('makeBoard : placement symétrique (rotation 180°)', () => {
    const b = makeBoard(3, 6, 2, 0.5, 42);
    const isIncome = (q: number, r: number) => (b.rev.baseByHex[`${q},${r}`] ?? 0) > 0;
    // chaque hex income a son miroir income (hors QG)
    for (const h of b.map.hexes) {
      const { q, r } = h.coord!;
      if (isIncome(q, r)) expect(isIncome(-q, -r) || b.corners.includes(`${-q},${-r}`)).toBe(true);
    }
  });
});

describe('game — acquérir un hex libre + ordre de vente auto', () => {
  it('coût = base × multiple, débite le cash, pose la propriété + ask par défaut', () => {
    const s = claimHex(fresh(100), 'alice', 'B', GAME);
    expect(s.ownership['B']).toBe('alice');
    expect(s.actors.find((a) => a.id === 'alice')!.cash).toBe(60); // 100 − 40
    expect(s.asks['B']).toBe(defaultAsk(s, 'B', GAME));
  });

  it('claimHex sans effet si interdit (immuable)', () => {
    const s0 = fresh(30);
    expect(claimHex(s0, 'alice', 'B', GAME)).toBe(s0);
  });
});

describe('game — carnet d\'ordres (ask = prix de sortie)', () => {
  it('defaultAsk = revenu courant × askDefaultMultiple', () => {
    const s = claimHex(fresh(200), 'alice', 'B', GAME); // B isolé : revenu 10
    expect(defaultAsk(s, 'B', GAME)).toBe(60); // 10 × 6
  });

  it('setAsk : seul le propriétaire peut poser, borné au plancher', () => {
    const s = claimHex(fresh(200), 'alice', 'B', GAME);
    expect(askFloor(s, 'B', GAME)).toBe(40); // base 10 × 4
    expect(setAsk(s, 'alice', 'B', 200, GAME).asks['B']).toBe(200);
    expect(setAsk(s, 'alice', 'B', 5, GAME).asks['B']).toBe(40); // sous le plancher
    expect(setAsk(s, 'bob', 'B', 1, GAME)).toBe(s); // pas proprio
  });
});

describe('game — éviction = payer l\'ask de l\'occupant', () => {
  it('evict : zéro-sum + l\'hex change de main + nouvel ask', () => {
    let s = claimHex(fresh(100, 100), 'bob', 'B', GAME); // bob: 60, B ask 60
    s = { ...s, actors: s.actors.map((a) => a.id === 'alice' ? { ...a, cash: 100 } : a) };
    const ask = evictionCost(s, 'B');
    const totalBefore = s.actors.reduce((sum, a) => sum + a.cash, 0);

    s = evict(s, 'alice', 'B', GAME);

    expect(s.ownership['B']).toBe('alice');
    expect(s.actors.find((a) => a.id === 'alice')!.cash).toBe(100 - ask);
    expect(s.actors.find((a) => a.id === 'bob')!.cash).toBe(60 + ask);
    expect(s.actors.reduce((sum, a) => sum + a.cash, 0)).toBe(totalBefore);
    expect(s.asks['B']).toBe(defaultAsk(s, 'B', GAME));
  });

  it('canEvict faux si libre, à moi, ou cash insuffisant', () => {
    expect(canEvict(fresh(), 'alice', 'B')).toBe(false); // libre
    let s = claimHex(fresh(0, 100), 'bob', 'B', GAME); // ask 60
    const poor = { ...s, actors: s.actors.map((a) => a.id === 'alice' ? { ...a, cash: 59 } : a) };
    expect(canEvict(poor, 'alice', 'B')).toBe(false);
  });
});

describe('game — richesse nette', () => {
  it('territoryValue ignore le QG (sans valeur de marché)', () => {
    let s = fresh(200);
    s.ownership['A'] = 'alice'; // QG
    s = claimHex(s, 'alice', 'B', GAME); // hex income, prix 40
    expect(territoryValue(s, 'alice', GAME)).toBe(40);
  });

  it('netWorth = cash + territoire − dette → emprunter est neutre à l\'instant T', () => {
    const s0 = fresh(0);
    const s1 = borrow(s0, 'alice', 100, GAME);
    expect(netWorth(s1, 'alice', GAME)).toBe(netWorth(s0, 'alice', GAME));
    expect(outstandingDebt(s1, 'alice')).toBe(100);
  });
});

describe('game — IA & fin de tour', () => {
  it('l\'IA achète des hexes d\'income et pose ses asks', () => {
    let s = foundBaseCamps(fresh(0, 0), GAME);
    s.ownership['E'] = 'bob'; // QG de bob
    s = aiTurn(s, 'bob', GAME);
    const bobIncomeHexes = s.map.hexes.filter((h) => s.ownership[h.id] === 'bob' && !CFG.campHexes!.includes(h.id));
    expect(bobIncomeHexes.length).toBeGreaterThanOrEqual(1);
    for (const h of bobIncomeHexes) expect(s.asks[h.id]).toBeGreaterThan(0);
  });

  it('endTurn : l\'IA joue puis le tick avance le tour', () => {
    let s = foundBaseCamps(fresh(0, 0), GAME);
    s.ownership['E'] = 'bob';
    const { state, reports } = endTurn(s, ['bob'], GAME);
    expect(state.turn).toBe(1);
    expect(reports.length).toBeGreaterThan(0);
  });
});
