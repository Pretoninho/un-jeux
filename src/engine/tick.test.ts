import { describe, it, expect } from 'vitest';
import { makeGameStateV2, makeActorV2, liveActors, type GameStateV2 } from './state2';
import { tick, actorNet, checkEnd } from './tick';
import { makeCamp } from './camp';
import type { GameMap } from './types';
import type { RevenueConfig } from './revenue';

// ─────────────────────── Helpers ─────────────────────────────────────────────

// Petite carte : 3 hexes en ligne A–B–C (A↔B↔C).
const MAP: GameMap = {
  id: 'tickdemo',
  hexes: [
    { id: 'A', label: 'A', kind: 'marche', neighbors: ['B'] },
    { id: 'B', label: 'B', kind: 'marche', neighbors: ['A', 'C'] },
    { id: 'C', label: 'C', kind: 'marche', neighbors: ['B'] },
  ],
};

const CFG: RevenueConfig = {
  baseByHex: { A: 10, B: 10, C: 10 },
  agglomerationBonus: 5,
};

function fresh(): GameStateV2 {
  return makeGameStateV2(MAP, CFG, [
    makeActorV2('alice', 'Alice', 100),
    makeActorV2('bob', 'Bob', 100),
  ]);
}

// ─────────────────────── actorNet ────────────────────────────────────────────

describe('tick — net par acteur', () => {
  it('net = income − charges', () => {
    const s = fresh();
    s.ownership['A'] = 'alice'; // income 10, pas de voisin → 0 bonus
    s.camps.push(makeCamp('alice', 100, 'A', 0.1)); // charge 10
    expect(actorNet(s, 'alice')).toBe(0); // 10 − 10
  });

  it('net positif quand income > charges', () => {
    const s = fresh();
    s.ownership['A'] = 'alice';
    s.ownership['B'] = 'alice'; // A+B contigus : 10+5 + 10+5 = 30
    s.camps.push(makeCamp('alice', 100, 'A', 0.1)); // charge 10
    expect(actorNet(s, 'alice')).toBe(20); // 30 − 10
  });

  it('net négatif quand charges > income', () => {
    const s = fresh();
    s.ownership['A'] = 'alice'; // income 10
    s.camps.push(makeCamp('alice', 100, 'A', 0.3)); // charge 30
    expect(actorNet(s, 'alice')).toBe(-20);
  });
});

// ─────────────────────── tick — flux de cash ─────────────────────────────────

describe('tick — flux de cash', () => {
  it('encaisse le net dans le cash, avance le tour', () => {
    const s = fresh();
    s.ownership['A'] = 'alice';
    s.ownership['B'] = 'alice'; // net +30
    const { state, reports } = tick(s);

    expect(state.turn).toBe(1);
    const alice = state.actors.find((a) => a.id === 'alice')!;
    expect(alice.cash).toBe(130); // 100 + 30
    const rep = reports.find((r) => r.actorId === 'alice')!;
    expect(rep.income).toBe(30);
    expect(rep.charges).toBe(0);
    expect(rep.net).toBe(30);
  });

  it('déduit les charges du cash', () => {
    const s = fresh();
    s.ownership['A'] = 'alice'; // income 10
    s.camps.push(makeCamp('alice', 100, 'A', 0.1)); // charge 10
    const { state } = tick(s);
    const alice = state.actors.find((a) => a.id === 'alice')!;
    expect(alice.cash).toBe(100); // 100 + (10 − 10)
  });

  it('un acteur sans hex ni camp ne bouge pas', () => {
    const s = fresh();
    const { state } = tick(s);
    const bob = state.actors.find((a) => a.id === 'bob')!;
    expect(bob.cash).toBe(100);
  });

  it('ne mute pas l\'état d\'entrée (immuabilité)', () => {
    const s = fresh();
    s.ownership['A'] = 'alice';
    tick(s);
    expect(s.turn).toBe(0); // l'original est intact
  });
});

// ─────────────────────── tick — faillite ─────────────────────────────────────

describe('tick — faillite', () => {
  it('cash négatif après le tour → faillite', () => {
    const s = fresh();
    // alice : pas d'income, grosse charge
    s.camps.push(makeCamp('alice', 1000, 'A', 0.2)); // charge 200 > cash 100
    const { state, reports } = tick(s);

    const alice = state.actors.find((a) => a.id === 'alice')!;
    expect(alice.bankrupt).toBe(true);
    expect(alice.cash).toBe(0);
    expect(reports.find((r) => r.actorId === 'alice')!.wentBankrupt).toBe(true);
  });

  it('la faillite libère les hexes du failli', () => {
    const s = fresh();
    s.ownership['A'] = 'alice';
    s.ownership['B'] = 'alice';
    s.camps.push(makeCamp('alice', 1000, 'A', 0.5)); // charge 500
    const { state } = tick(s);
    expect(state.ownership['A']).toBeNull();
    expect(state.ownership['B']).toBeNull();
  });

  it('la faillite purge les camps du failli (la dette meurt avec lui)', () => {
    const s = fresh();
    s.camps.push(makeCamp('alice', 1000, 'A', 0.2));
    const { state } = tick(s);
    expect(state.camps.filter((c) => c.ownerId === 'alice')).toHaveLength(0);
  });

  it('n\'affecte pas les autres acteurs', () => {
    const s = fresh();
    s.ownership['C'] = 'bob';
    s.camps.push(makeCamp('alice', 1000, 'A', 0.2)); // alice coule
    const { state } = tick(s);
    const bob = state.actors.find((a) => a.id === 'bob')!;
    expect(bob.bankrupt).toBe(false);
    expect(state.ownership['C']).toBe('bob'); // ses hexes intacts
  });

  it('un acteur déjà failli est ignoré (pas de rapport)', () => {
    const s = fresh();
    s.camps.push(makeCamp('alice', 1000, 'A', 0.2));
    const { state } = tick(s);          // alice coule au tour 1
    const r2 = tick(state);             // tour 2
    expect(r2.reports.find((r) => r.actorId === 'alice')).toBeUndefined();
    expect(liveActors(r2.state)).toHaveLength(1);
  });

  it('cash pile à 0 ne fait PAS faillite (seuil strict < 0)', () => {
    const s = fresh();
    s.ownership['A'] = 'alice'; // income 10
    s.camps.push(makeCamp('alice', 1100, 'A', 0.1)); // charge 110
    // net = 10 − 110 = −100 ; cash 100 − 100 = 0 → survit
    const { state } = tick(s);
    const alice = state.actors.find((a) => a.id === 'alice')!;
    expect(alice.bankrupt).toBe(false);
    expect(alice.cash).toBe(0);
  });
});

// ─────────────────────── checkEnd ────────────────────────────────────────────

describe('tick — conditions de fin', () => {
  it('partie en cours tant que ≥2 acteurs vivants et avant l\'horizon', () => {
    const s = fresh();
    expect(checkEnd(s, 10)).toEqual({ ended: false, reason: null, winnerId: null });
  });

  it('un seul survivant → last_standing', () => {
    const s = fresh();
    s.actors[1]!.bankrupt = true; // bob éliminé
    const end = checkEnd(s, 10);
    expect(end.ended).toBe(true);
    expect(end.reason).toBe('last_standing');
    expect(end.winnerId).toBe('alice');
  });

  it('horizon atteint → le plus riche gagne (time)', () => {
    const s = fresh();
    s.turn = 10;
    s.actors[0]!.cash = 50;
    s.actors[1]!.cash = 300; // bob plus riche
    const end = checkEnd(s, 10);
    expect(end.ended).toBe(true);
    expect(end.reason).toBe('time');
    expect(end.winnerId).toBe('bob');
  });

  it('tous faillis → last_standing sans gagnant', () => {
    const s = fresh();
    s.actors[0]!.bankrupt = true;
    s.actors[1]!.bankrupt = true;
    const end = checkEnd(s, 10);
    expect(end.ended).toBe(true);
    expect(end.winnerId).toBeNull();
  });
});
