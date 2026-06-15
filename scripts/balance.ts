// Calibrage du nouveau jeu — équilibre RENTIER vs CONQUÉRANT + ratio income/charge.
//
//   npx vite-node scripts/balance.ts
//
// Le camp de base = 1ᵉʳ emprunt (capital + charge permanente) ; son QG (hex camp) ne rapporte
// rien. On cherche : (1) aucun style ne domine (~40-60 %), (2) la tension income/charge visée
// (~3:2 à 2:1) à mi-partie, (3) la faillite possible mais pas systématique.

import { makeFlatBoard } from '../src/engine/board';
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

const conquerant: Policy = (s, id, cfg) => {
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

function setup(cfg: GameConfig): GameStateV2 {
  const board = makeFlatBoard(RADIUS, FLAT_BASE, AGGLO);
  const [c0, c1] = board.corners;
  const rev: RevenueConfig = {
    ...board.rev,
    baseByHex: { ...board.rev.baseByHex, [c0]: 0, [c1]: 0 }, // QG sans income
    campHexes: [c0, c1],
  };
  let s = makeGameStateV2(board.map, rev, [makeActorV2('alice', 'A', 0), makeActorV2('bob', 'B', 0)], cfg.hexUpkeep);
  s.ownership[c0] = 'alice';
  s.ownership[c1] = 'bob';
  s = foundBaseCamps(s, cfg); // 1ᵉʳ emprunt = capital + charge
  return s;
}

interface GameOut { winner: string | null; reason: string | null; turn: number; ratioMid: number; ratioEnd: number; }

function playGame(cfg: GameConfig, pA: Policy, pB: Policy, swap: boolean): GameOut {
  let s = setup(cfg);
  let ratioMid = 0;
  const ratioOf = (id: string) => income(s, id) / Math.max(1, charges(s, id));
  for (let t = 0; t < cfg.horizonTurns; t++) {
    const order: Array<['alice' | 'bob', Policy]> = (t % 2 === 0) !== swap
      ? [['alice', pA], ['bob', pB]] : [['bob', pB], ['alice', pA]];
    for (const [id, pol] of order) s = pol(s, id, cfg);
    const res = tick(s); s = res.state;
    if (t === Math.floor(cfg.horizonTurns / 2)) ratioMid = (ratioOf('alice') + ratioOf('bob')) / 2;
    const end = checkEnd(s, cfg.horizonTurns, (id) => netWorth(s, id, cfg));
    if (end.ended) return { winner: end.winnerId, reason: end.reason, turn: s.turn, ratioMid, ratioEnd: (ratioOf('alice') + ratioOf('bob')) / 2 };
  }
  const end = checkEnd(s, cfg.horizonTurns, (id) => netWorth(s, id, cfg));
  return { winner: end.winnerId, reason: end.reason, turn: s.turn, ratioMid, ratioEnd: (ratioOf('alice') + ratioOf('bob')) / 2 };
}

function evalConfig(cfg: GameConfig) {
  let rWins = 0, cWins = 0, draws = 0, bankrupts = 0, turns = 0, rMid = 0, rEnd = 0, n = 0;
  for (const swap of [false, true]) {
    let g = playGame(cfg, rentier, conquerant, swap); n++;
    turns += g.turn; rMid += g.ratioMid; rEnd += g.ratioEnd;
    if (g.winner === 'alice') rWins++; else if (g.winner === 'bob') cWins++; else draws++;
    if (g.reason === 'last_standing') bankrupts++;
    g = playGame(cfg, conquerant, rentier, swap); n++;
    turns += g.turn; rMid += g.ratioMid; rEnd += g.ratioEnd;
    if (g.winner === 'bob') rWins++; else if (g.winner === 'alice') cWins++; else draws++;
    if (g.reason === 'last_standing') bankrupts++;
  }
  return { rWins, cWins, draws, bankrupts, avgTurns: turns / n, ratioMid: rMid / n, ratioEnd: rEnd / n, n };
}

const board0 = makeFlatBoard(RADIUS, FLAT_BASE, AGGLO);
console.log(`Plateau rayon ${RADIUS} (${board0.map.hexes.length} hexes dont 2 QG sans income), base ${FLAT_BASE}, agglo ${AGGLO}`);
console.log('Camp de base = 1ᵉʳ emprunt (capital + charge). Cible : aucun style domine + ratio income/charge ~1.5-2 à mi-partie.\n');

// Panel large : hexUpkeep (cale le ratio) × baseCampLoan. chargeRate fixe 0.20.
console.log(`base income/hex = ${FLAT_BASE} → ratio asymptotique ≈ ${FLAT_BASE}/upkeep\n`);
for (const upkeep of [2, 3, 4, 5]) {
  console.log(`=== hexUpkeep ${upkeep}  (ratio cible ≈ ${(FLAT_BASE / upkeep).toFixed(2)}:1) ===`);
  console.log(' loan | rentier | conquér | nuls | faillite | tours | ratio mi | ratio fin');
  console.log('------|---------|---------|------|----------|-------|----------|----------');
  for (const loan of [40, 60, 80, 100]) {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, chargeRate: 0.20, hexUpkeep: upkeep, baseCampLoan: loan, horizonTurns: 14 };
    const r = evalConfig(cfg);
    const pct = (x: number) => `${Math.round((x / r.n) * 100)}%`;
    console.log(
      `${String(loan).padStart(5)} | ${pct(r.rWins).padStart(7)} | ${pct(r.cWins).padStart(7)} | ${pct(r.draws).padStart(4)} | ${pct(r.bankrupts).padStart(8)} | ${r.avgTurns.toFixed(0).padStart(5)} | ${r.ratioMid.toFixed(2).padStart(8)} | ${r.ratioEnd.toFixed(2).padStart(8)}`,
    );
  }
  console.log('');
}
