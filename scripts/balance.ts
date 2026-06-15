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
import { tick, checkEnd, actorTotalCharges } from '../src/engine/tick';
import { actorIncome } from '../src/engine/revenue';

const RADIUS = 3;       // 37 hexes
const FLAT_BASE = 6;
const AGGLO = 2;        // prime d'agglomération modérée (l'income reste proche de la base)

type Policy = (s: GameStateV2, id: string, cfg: GameConfig) => GameStateV2;

const cash = (s: GameStateV2, id: string) => s.actors.find((a) => a.id === id)!.cash;
const income = (s: GameStateV2, id: string) => actorIncome(id, s.ownership, s.map, s.revenueCfg);
const charges = (s: GameStateV2, id: string) => actorTotalCharges(s, id); // dette + upkeep
// Réserve réaliste : seulement le DÉFICIT (si net négatif). Net positif → on peut tout dépenser.
const deficit = (s: GameStateV2, id: string) => Math.max(0, charges(s, id) - income(s, id));

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
  let safety = 24;
  while (safety-- > 0) {
    const t = affordableFree(s, id, cfg, deficit(s, id));
    if (!t) break;
    s = claimHex(s, id, t, cfg);
  }
  return s;
};

// CONQUÉRANT : pas de ré-emprunt — s'étend avec son capital + évince agressivement.
const conquerant: Policy = (s, id, cfg) => {
  let safety = 24;
  while (safety-- > 0) {
    const t = affordableFree(s, id, cfg, deficit(s, id));
    if (!t) break;
    s = claimHex(s, id, t, cfg);
  }
  let ev = 3;
  while (ev-- > 0) {
    const target = s.map.hexes
      .filter((h) => { const o = s.ownership[h.id]; return o && o !== id && h.neighbors.some((n) => s.ownership[n] === id); })
      .map((h) => h.id)
      .filter((hid) => canEvict(s, id, hid) && cash(s, id) - evictionCost(s, hid) >= deficit(s, id))
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

interface GameOut { winner: string | null; reason: string | null; turn: number; ratioEnd: number; hexes: number; hexesT2: number; netT2: number; negT2: boolean; }

function playGame(cfg: GameConfig, pA: Policy, pB: Policy, swap: boolean, frac: number, seed: number, radius: number): GameOut {
  let s = setup(cfg, frac, seed, radius);
  let hexesT2 = 0, netT2 = 0, negT2 = false;
  const ratioOf = (id: string) => income(s, id) / Math.max(1, charges(s, id));
  const netOf = (id: string) => income(s, id) - charges(s, id);
  const done = (): GameOut => {
    const end = checkEnd(s, cfg.horizonTurns, (id) => netWorth(s, id, cfg));
    const hexes = (ownedIncomeHexes(s, 'alice') + ownedIncomeHexes(s, 'bob')) / 2;
    // négatif au T2 pour AU MOINS un joueur = début « bloqué » ressenti (la moyenne seule trompe)
    return { winner: end.winnerId, reason: end.reason, turn: s.turn, ratioEnd: (ratioOf('alice') + ratioOf('bob')) / 2, hexes, hexesT2, netT2, negT2 };
  };
  for (let t = 0; t < cfg.horizonTurns; t++) {
    const order: Array<['alice' | 'bob', Policy]> = (t % 2 === 0) !== swap
      ? [['alice', pA], ['bob', pB]] : [['bob', pB], ['alice', pA]];
    for (const [id, pol] of order) s = pol(s, id, cfg);
    const res = tick(s); s = res.state;
    if (s.turn === 2) { // bilan « début de partie » : combien d'hexes et quel net après 2 tours
      hexesT2 = (ownedIncomeHexes(s, 'alice') + ownedIncomeHexes(s, 'bob')) / 2;
      netT2 = (netOf('alice') + netOf('bob')) / 2;
      negT2 = netOf('alice') < 0 || netOf('bob') < 0;
    }
    if (checkEnd(s, cfg.horizonTurns, (id) => netWorth(s, id, cfg)).ended) return done();
  }
  return done();
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]; // 8 placements différents

function evalConfig(cfg: GameConfig, frac: number, radius = RADIUS) {
  let rWins = 0, cWins = 0, draws = 0, bankrupts = 0, rEnd = 0, hexes = 0, hexesT2 = 0, netT2 = 0, negT2 = 0, n = 0;
  for (const seed of SEEDS) for (const swap of [false, true]) {
    let g = playGame(cfg, rentier, conquerant, swap, frac, seed, radius); n++;
    rEnd += g.ratioEnd; hexes += g.hexes; hexesT2 += g.hexesT2; netT2 += g.netT2; if (g.negT2) negT2++;
    if (g.winner === 'alice') rWins++; else if (g.winner === 'bob') cWins++; else draws++;
    if (g.reason === 'last_standing') bankrupts++;
    g = playGame(cfg, conquerant, rentier, swap, frac, seed, radius); n++;
    rEnd += g.ratioEnd; hexes += g.hexes; hexesT2 += g.hexesT2; netT2 += g.netT2; if (g.negT2) negT2++;
    if (g.winner === 'bob') rWins++; else if (g.winner === 'alice') cWins++; else draws++;
    if (g.reason === 'last_standing') bankrupts++;
  }
  return { rWins, cWins, draws, bankrupts, ratioEnd: rEnd / n, hexes: hexes / n, hexesT2: hexesT2 / n, netT2: netT2 / n, negT2, n };
}

const HZ = 20;
// TRÈS GRANDE MAP + hexes à income RARES (le reste = canevas réservé aux futurs hexes spéciaux).
// Ce qui pilote l'économie = le nombre ABSOLU d'hexes à income, pas la taille du plateau.
console.log(`Proportions v1.44 : base ${FLAT_BASE}, agglo ${AGGLO}, upkeep ${DEFAULT_CONFIG.hexUpkeep}, loan ${DEFAULT_CONFIG.baseCampLoan}, charge ${(DEFAULT_CONFIG.baseCampLoan * DEFAULT_CONFIG.chargeRate).toFixed(0)}, horizon ${HZ}`);
console.log('GRANDE MAP × RARETÉ : on balaie rayon (taille) × incomeFraction (rareté). Reste = futurs hexes spéciaux.\n');
console.log(' rayon | hexes | frac | income | hex fin/j | % income pris | rentier | conquér | faillite | netT2 | %net<0 T2 | ratio fin');
console.log('-------|-------|------|--------|-----------|---------------|---------|---------|----------|-------|-----------|----------');
for (const radius of [6, 8, 10]) {
  for (const frac of [0.15, 0.25, 0.35]) {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, horizonTurns: HZ };
    const r = evalConfig(cfg, frac, radius);
    const total = makeBoard(radius, FLAT_BASE, AGGLO, 1, 0).map.hexes.length;
    const incomeHexes = Math.max(2, Math.round((total - 2) * frac));
    const fill = `${Math.round((2 * r.hexes / incomeHexes) * 100)}%`;
    const pct = (x: number) => `${Math.round((x / r.n) * 100)}%`;
    console.log(
      `${String(radius).padStart(6)} | ${String(total).padStart(5)} | ${frac.toFixed(2).padStart(4)} | ${String(incomeHexes).padStart(6)} | ${r.hexes.toFixed(1).padStart(9)} | ${fill.padStart(13)} | ${pct(r.rWins).padStart(7)} | ${pct(r.cWins).padStart(7)} | ${pct(r.bankrupts).padStart(8)} | ${r.netT2.toFixed(1).padStart(5)} | ${pct(r.negT2).padStart(9)} | ${r.ratioEnd.toFixed(2).padStart(8)}`,
    );
  }
  console.log('');
}
