// Calibrage du nouveau jeu — équilibre RENTIER vs CONQUÉRANT + ratio income/charge.
//
//   npx vite-node scripts/balance.ts
//
// Le camp de base = 1ᵉʳ emprunt (capital + charge permanente) ; son QG (hex camp) ne rapporte
// rien. On cherche : (1) aucun style ne domine (~40-60 %), (2) la tension income/charge visée
// (~3:2 à 2:1) à mi-partie, (3) la faillite possible mais pas systématique.

import { makeBoard } from '../src/engine/board';
import { makeGameStateV2, makeActorV2, type GameStateV2 } from '../src/engine/state2';
import {
  claimCost, canClaim, claimHex, borrow, foundBaseCamps,
  canEvict, evict, evictionCost, netWorth, defaultAsk, type GameConfig, DEFAULT_CONFIG,
} from '../src/engine/game';
import { tick, checkEnd } from '../src/engine/tick';
import { actorCharges } from '../src/engine/camp';
import { actorIncome, type RevenueConfig } from '../src/engine/revenue';

const RADIUS = 3;       // 37 hexes
const FLAT_BASE = 6;
const AGGLO = 2;        // prime d'agglomération modérée (l'income reste proche de la base)

type Policy = (s: GameStateV2, id: string, cfg: GameConfig) => GameStateV2;

const cash = (s: GameStateV2, id: string) => s.actors.find((a) => a.id === id)!.cash;
const reserve = (s: GameStateV2, id: string, m: number) => actorCharges(id, s.camps) * m;
const income = (s: GameStateV2, id: string) => actorIncome(id, s.ownership, s.map, s.revenueCfg);
const charges = (s: GameStateV2, id: string) => actorCharges(id, s.camps);

function affordableFree(s: GameStateV2, id: string, cfg: GameConfig, keep: number): string | undefined {
  return s.map.hexes
    .filter((h) => !s.ownership[h.id])
    .sort((a, b) => {
      const adjA = a.neighbors.filter((n) => s.ownership[n] === id).length;
      const adjB = b.neighbors.filter((n) => s.ownership[n] === id).length;
      if (adjA !== adjB) return adjB - adjA;
      return claimCost(s, a.id, cfg) - claimCost(s, b.id, cfg);
    })
    .map((h) => h.id)
    .find((hid) => canClaim(s, id, hid, cfg) && claimCost(s, hid, cfg) <= cash(s, id) - keep);
}

const rentier: Policy = (s, id, cfg) => {
  let safety = 12;
  while (safety-- > 0) {
    const t = affordableFree(s, id, cfg, reserve(s, id, 1));
    if (!t) break;
    s = claimHex(s, id, t, cfg);
  }
  return s;
};

// CONQUÉRANT : pas de ré-emprunt (supprimé) — s'étend avec son capital + évince agressivement.
const conquerant: Policy = (s, id, cfg) => {
  let safety = 16;
  while (safety-- > 0) {
    const t = affordableFree(s, id, cfg, reserve(s, id, 1));
    if (!t) break;
    s = claimHex(s, id, t, cfg);
  }
  let ev = 3;
  while (ev-- > 0) {
    const target = s.map.hexes
      .filter((h) => { const o = s.ownership[h.id]; return o && o !== id && h.neighbors.some((n) => s.ownership[n] === id); })
      .map((h) => h.id)
      .filter((hid) => canEvict(s, id, hid) && cash(s, id) - evictionCost(s, hid) >= reserve(s, id, 1))
      .sort((a, b) => evictionCost(s, a) - evictionCost(s, b))[0];
    if (!target) break;
    s = evict(s, id, target, cfg);
  }
  return s;
};

function setup(cfg: GameConfig, frac: number, seed: number, radius: number): GameStateV2 {
  const board = makeBoard(radius, FLAT_BASE, AGGLO, frac, seed);
  const [c0, c1] = board.corners;
  let s = makeGameStateV2(board.map, board.rev, [makeActorV2('alice', 'A', 0), makeActorV2('bob', 'B', 0)], cfg.hexUpkeep);
  s.ownership[c0] = 'alice';
  s.ownership[c1] = 'bob';
  s = foundBaseCamps(s, cfg); // 1ᵉʳ emprunt = capital + charge
  return s;
}

const ownedIncomeHexes = (s: GameStateV2, id: string) =>
  s.map.hexes.filter((h) => s.ownership[h.id] === id && (s.revenueCfg.baseByHex[h.id] ?? 0) > 0).length;

interface GameOut { winner: string | null; reason: string | null; turn: number; ratioMid: number; ratioEnd: number; hexes: number; }

function playGame(cfg: GameConfig, pA: Policy, pB: Policy, swap: boolean, frac: number, seed: number, radius: number): GameOut {
  let s = setup(cfg, frac, seed, radius);
  let ratioMid = 0;
  const ratioOf = (id: string) => income(s, id) / Math.max(1, charges(s, id));
  const done = (): GameOut => {
    const end = checkEnd(s, cfg.horizonTurns, (id) => netWorth(s, id, cfg));
    const hexes = (ownedIncomeHexes(s, 'alice') + ownedIncomeHexes(s, 'bob')) / 2;
    return { winner: end.winnerId, reason: end.reason, turn: s.turn, ratioMid, ratioEnd: (ratioOf('alice') + ratioOf('bob')) / 2, hexes };
  };
  for (let t = 0; t < cfg.horizonTurns; t++) {
    const order: Array<['alice' | 'bob', Policy]> = (t % 2 === 0) !== swap
      ? [['alice', pA], ['bob', pB]] : [['bob', pB], ['alice', pA]];
    for (const [id, pol] of order) s = pol(s, id, cfg);
    const res = tick(s); s = res.state;
    if (t === Math.floor(cfg.horizonTurns / 2)) ratioMid = (ratioOf('alice') + ratioOf('bob')) / 2;
    if (checkEnd(s, cfg.horizonTurns, (id) => netWorth(s, id, cfg)).ended) return done();
  }
  return done();
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]; // 8 placements différents

function evalConfig(cfg: GameConfig, frac: number, radius = RADIUS) {
  let rWins = 0, cWins = 0, draws = 0, bankrupts = 0, turns = 0, rMid = 0, rEnd = 0, hexes = 0, n = 0;
  for (const seed of SEEDS) for (const swap of [false, true]) {
    let g = playGame(cfg, rentier, conquerant, swap, frac, seed, radius); n++;
    turns += g.turn; rMid += g.ratioMid; rEnd += g.ratioEnd; hexes += g.hexes;
    if (g.winner === 'alice') rWins++; else if (g.winner === 'bob') cWins++; else draws++;
    if (g.reason === 'last_standing') bankrupts++;
    g = playGame(cfg, conquerant, rentier, swap, frac, seed, radius); n++;
    turns += g.turn; rMid += g.ratioMid; rEnd += g.ratioEnd; hexes += g.hexes;
    if (g.winner === 'bob') rWins++; else if (g.winner === 'alice') cWins++; else draws++;
    if (g.reason === 'last_standing') bankrupts++;
  }
  return { rWins, cWins, draws, bankrupts, avgTurns: turns / n, ratioMid: rMid / n, ratioEnd: rEnd / n, hexes: hexes / n, n };
}

const FRAC = 0.5; // rareté établie
const hexCount = (radius: number) => makeBoard(radius, FLAT_BASE, AGGLO, 1, 0).map.hexes.length;
console.log(`Proportions établies : base ${FLAT_BASE}, agglo ${AGGLO}, upkeep ${DEFAULT_CONFIG.hexUpkeep}, loan ${DEFAULT_CONFIG.baseCampLoan}, rareté ${FRAC}`);
console.log('AGRANDISSEMENT : on balaie le RAYON × HORIZON (proportions fixées).\n');
console.log(' rayon | hexes | horizon | rentier | conquér | nuls | faillite | tours | ratio mi | ratio fin | hex/joueur');
console.log('-------|-------|---------|---------|---------|------|----------|-------|----------|-----------|-----------');
for (const radius of [3, 4, 5, 6]) {
  for (const horizon of [14, 20, 28]) {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, horizonTurns: horizon };
    const r = evalConfig(cfg, FRAC, radius);
    const pct = (x: number) => `${Math.round((x / r.n) * 100)}%`;
    console.log(
      `${String(radius).padStart(6)} | ${String(hexCount(radius)).padStart(5)} | ${String(horizon).padStart(7)} | ${pct(r.rWins).padStart(7)} | ${pct(r.cWins).padStart(7)} | ${pct(r.draws).padStart(4)} | ${pct(r.bankrupts).padStart(8)} | ${r.avgTurns.toFixed(0).padStart(5)} | ${r.ratioMid.toFixed(2).padStart(8)} | ${r.ratioEnd.toFixed(2).padStart(9)} | ${r.hexes.toFixed(1).padStart(9)}`,
    );
  }
  console.log('');
}
