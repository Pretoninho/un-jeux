// Calibrage du NOUVEAU jeu — trouve le point d'équilibre income/charge.
// Non couplé à l'UI : rejoue des parties RENTIER vs CONQUÉRANT et mesure qui gagne.
// On règle le « facteur de pondération » = camp de base (baseCampLoan) + chargeRate.
//
// Lancer :  npx vite-node scripts/balance.ts
//
// Cible : aucun style ne DOMINE (idéalement 40-60 % chacun), parties qui vont au bout
// (~peu de faillites précoces mais la faillite reste possible), frontière disputée.

import { makeFlatBoard } from '../src/engine/board';
import { makeGameStateV2, makeActorV2, type GameStateV2 } from '../src/engine/state2';
import {
  claimCost, canClaim, claimHex, borrow, foundBaseCamps,
  canEvict, evict, evictionCost, netWorth, type GameConfig, DEFAULT_CONFIG,
} from '../src/engine/game';
import { tick, checkEnd } from '../src/engine/tick';
import { actorCharges } from '../src/engine/camp';

const RADIUS = 3;       // 37 hexes
const FLAT_BASE = 6;    // revenu plat
const AGGLO = 3;
const START_CASH = 0;   // le capital vient du camp de base

type Policy = (s: GameStateV2, id: string, cfg: GameConfig) => GameStateV2;

const cash = (s: GameStateV2, id: string) => s.actors.find((a) => a.id === id)!.cash;
const reserve = (s: GameStateV2, id: string, mult: number) => actorCharges(id, s.camps) * mult;

function affordableFree(s: GameStateV2, id: string, cfg: GameConfig, keep: number): string | undefined {
  return s.map.hexes
    .filter((h) => !s.ownership[h.id])
    // priorité : adjacent à moi (agglomération), puis moins cher
    .sort((a, b) => {
      const adjA = a.neighbors.filter((n) => s.ownership[n] === id).length;
      const adjB = b.neighbors.filter((n) => s.ownership[n] === id).length;
      if (adjA !== adjB) return adjB - adjA;
      return claimCost(s, a.id, cfg) - claimCost(s, b.id, cfg);
    })
    .map((h) => h.id)
    .find((hid) => canClaim(s, id, hid, cfg) && claimCost(s, hid, cfg) <= cash(s, id) - keep);
}

// RENTIER : pas de dette supplémentaire, s'étend avec son cash, n'évince pas.
const rentier: Policy = (s, id, cfg) => {
  let safety = 12;
  while (safety-- > 0) {
    const t = affordableFree(s, id, cfg, reserve(s, id, 1));
    if (!t) break;
    s = claimHex(s, id, t, cfg);
  }
  return s;
};

// CONQUÉRANT : emprunte pour le capital, s'étend, évince agressivement.
const conquerant: Policy = (s, id, cfg) => {
  // emprunte s'il manque de cash pour saisir des opportunités
  const cheapest = Math.min(...s.map.hexes.filter((h) => !s.ownership[h.id]).map((h) => claimCost(s, h.id, cfg)), Infinity);
  if (cash(s, id) < cheapest * 2 && s.camps.filter((c) => c.ownerId === id).length < 4) {
    s = borrow(s, id, cfg.baseCampLoan, cfg);
  }
  let safety = 16;
  while (safety-- > 0) {
    const t = affordableFree(s, id, cfg, reserve(s, id, 1));
    if (!t) break;
    s = claimHex(s, id, t, cfg);
  }
  // évince les hexes adverses adjacents abordables (du moins cher au plus cher)
  let ev = 3;
  while (ev-- > 0) {
    const target = s.map.hexes
      .filter((h) => {
        const o = s.ownership[h.id];
        return o && o !== id && h.neighbors.some((n) => s.ownership[n] === id);
      })
      .map((h) => h.id)
      .filter((hid) => canEvict(s, id, hid) && cash(s, id) - evictionCost(s, hid) >= reserve(s, id, 1))
      .sort((a, b) => evictionCost(s, a) - evictionCost(s, b))[0];
    if (!target) break;
    s = evict(s, id, target, cfg);
  }
  return s;
};

function playGame(cfg: GameConfig, pA: Policy, pB: Policy, swapOrder: boolean) {
  const board = makeFlatBoard(RADIUS, FLAT_BASE, AGGLO);
  let s = makeGameStateV2(board.map, board.rev, [
    makeActorV2('alice', 'A', START_CASH),
    makeActorV2('bob', 'B', START_CASH),
  ]);
  s.ownership[board.corners[0]] = 'alice';
  s.ownership[board.corners[1]] = 'bob';
  s = foundBaseCamps(s, cfg);
  // asks de départ sur les hexes initiaux
  s = { ...s, asks: { ...s.asks } };
  for (const hid of board.corners) {
    const rev = board.rev.baseByHex[hid]!;
    s.asks[hid] = Math.round(rev * cfg.askDefaultMultiple);
  }

  for (let t = 0; t < cfg.horizonTurns; t++) {
    const order: Array<['alice' | 'bob', Policy]> = (t % 2 === 0) !== swapOrder
      ? [['alice', pA], ['bob', pB]]
      : [['bob', pB], ['alice', pA]];
    for (const [id, pol] of order) s = pol(s, id, cfg);
    const res = tick(s);
    s = res.state;
    const end = checkEnd(s, cfg.horizonTurns, (id) => netWorth(s, id, cfg));
    if (end.ended) return { winner: end.winnerId, reason: end.reason, turn: s.turn, s };
  }
  const end = checkEnd(s, cfg.horizonTurns, (id) => netWorth(s, id, cfg));
  return { winner: end.winnerId, reason: end.reason, turn: s.turn, s };
}

function evalConfig(cfg: GameConfig) {
  // alice = rentier vs bob = conquérant, et l'inverse, ordre permuté → 4 parties
  let rentierWins = 0, conquerantWins = 0, draws = 0, bankrupts = 0, totalTurns = 0, n = 0;
  for (const swap of [false, true]) {
    // partie 1 : alice rentier, bob conquérant
    let g = playGame(cfg, rentier, conquerant, swap); n++;
    totalTurns += g.turn;
    if (g.winner === 'alice') rentierWins++; else if (g.winner === 'bob') conquerantWins++; else draws++;
    if (g.reason === 'last_standing') bankrupts++;
    // partie 2 : alice conquérant, bob rentier
    g = playGame(cfg, conquerant, rentier, swap); n++;
    totalTurns += g.turn;
    if (g.winner === 'bob') rentierWins++; else if (g.winner === 'alice') conquerantWins++; else draws++;
    if (g.reason === 'last_standing') bankrupts++;
  }
  return { rentierWins, conquerantWins, draws, bankrupts, avgTurns: totalTurns / n, n };
}

const board0 = makeFlatBoard(RADIUS, FLAT_BASE, AGGLO);
console.log(`Plateau rayon ${RADIUS} (${board0.map.hexes.length} hexes), base plate ${FLAT_BASE}, agglo ${AGGLO}`);
console.log(`income d'un capital emprunté ≈ ${(FLAT_BASE / (DEFAULT_CONFIG.claimMultiple)).toFixed(2)}·L/tour → la charge doit s'en approcher\n`);

// Balayage 1 : le TAUX DE CHARGE (le vrai levier d'équilibre).
console.log('=== balayage chargeRate (baseCampLoan=120) ===');
console.log('chargeRate | rentier | conquérant | nuls | faillites | tours moy');
console.log('-----------|---------|------------|------|-----------|----------');
for (const rate of [0.10, 0.15, 0.20, 0.25, 0.30]) {
  const cfg: GameConfig = { ...DEFAULT_CONFIG, chargeRate: rate, baseCampLoan: 120, horizonTurns: 14 };
  const r = evalConfig(cfg);
  const pct = (x: number) => `${Math.round((x / r.n) * 100)}%`;
  console.log(
    `${rate.toFixed(2).padStart(10)} | ${pct(r.rentierWins).padStart(7)} | ${pct(r.conquerantWins).padStart(10)} | ${pct(r.draws).padStart(4)} | ${pct(r.bankrupts).padStart(9)} | ${r.avgTurns.toFixed(1).padStart(8)}`,
  );
}

// Balayage 2 : le prix de SORTIE par défaut (rend l'éviction rentable ou neutre).
console.log('\n=== balayage askDefaultMultiple (chargeRate=0.20, baseCampLoan=120) ===');
console.log('askMult | rentier | conquérant | nuls | faillites | tours moy');
console.log('--------|---------|------------|------|-----------|----------');
for (const am of [5, 6, 8, 10, 12]) {
  const cfg: GameConfig = { ...DEFAULT_CONFIG, chargeRate: 0.20, baseCampLoan: 120, askDefaultMultiple: am, horizonTurns: 14 };
  const r = evalConfig(cfg);
  const pct = (x: number) => `${Math.round((x / r.n) * 100)}%`;
  console.log(
    `${String(am).padStart(7)} | ${pct(r.rentierWins).padStart(7)} | ${pct(r.conquerantWins).padStart(10)} | ${pct(r.draws).padStart(4)} | ${pct(r.bankrupts).padStart(9)} | ${r.avgTurns.toFixed(1).padStart(8)}`,
  );
}
