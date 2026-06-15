<script lang="ts">
  // LE JEU — vue unique jouable, sur GameState. Carte hexagonale, camp de base posé au
  // départ. Cœur économique nu : on acquiert des hexes d'income LIBRES, on couvre la charge
  // de sa dette de base, et le plus riche en valeur nette à l'horizon gagne.
  //
  // La prise d'un hex ADVERSE se fera par le COMBAT (couche à venir) — pas d'éviction
  // économique ici. Les ~185 cases stériles sont le canevas réservé au champ de bataille.
  import { makeBoard } from './engine/board';
  import { makeGameState, makeActor, type GameState } from './engine/state';
  import { actorNet, actorTotalCharges, checkEnd, type ActorTickReport } from './engine/tick';
  import { actorIncome, hexRevenue, isCampHex } from './engine/revenue';
  import {
    claimCost, canClaim, claimHex, foundBaseCamps, netWorth, endTurn,
    DEFAULT_CONFIG, type GameConfig,
  } from './engine/game';
  import { axialToPixel, hexPointsPointy, genBounds } from './lib/layout';

  const HUMAN = 'alice';
  const AI = 'bob';
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };

  // ── Grande map rayon 8 = 217 hexes ; hexes à income TRÈS RARES (~0.15) ──────────
  //    Le reste (~185 cases stériles) = canevas réservé au futur champ de bataille.
  const RADIUS = 8;
  const INCOME_FRACTION = 0.15;  // income très rare : ~32 hexes à income sur 217
  const GEO = makeBoard(RADIUS, 6, 1, 0); // géométrie fixe (mêmes coords quel que soit le seed)
  const CFG: GameConfig = { ...DEFAULT_CONFIG }; // horizon 20 inclus dans DEFAULT_CONFIG

  let seed = $state(Math.floor(Math.random() * 1e9)); // un plateau différent à chaque partie

  function initial(): GameState {
    const board = makeBoard(RADIUS, 6, INCOME_FRACTION, seed);
    let s = makeGameState(board.map, board.rev, [
      makeActor('alice', 'Alice (toi)', 0),
      makeActor('bob', 'Bob (IA)', 0),
    ]);
    s.ownership[board.corners[0]] = 'alice'; // QG d'Alice
    s.ownership[board.corners[1]] = 'bob';   // QG de Bob
    s = foundBaseCamps(s, CFG); // camp de base = 1ᵉʳ emprunt (capital + charge), QG sans income
    return s;
  }

  let game = $state<GameState>(initial());
  let reports = $state<ActorTickReport[]>([]);
  let journal = $state<string[]>([]);

  const end = $derived(checkEnd(game, CFG.horizonTurns, (id) => netWorth(game, id, CFG)));
  const ended = $derived(end.ended);

  function label(id: string) { return game.actors.find((a) => a.id === id)?.label ?? id; }
  const income = (id: string) => actorIncome(id, game.ownership, game.map, game.revenueCfg);
  const charges = (id: string) => actorTotalCharges(game, id);
  const ratio = (id: string) => { const c = charges(id); return c > 0 ? income(id) / c : 0; };
  const net = (id: string) => actorNet(game, id);
  const worth = (id: string) => netWorth(game, id, CFG);
  const hexCount = (id: string) => game.map.hexes.filter((h) => game.ownership[h.id] === id && !isCampHex(h.id, game.revenueCfg)).length;
  const hexRev = (hexId: string) => hexRevenue(hexId, game.ownership, game.map, game.revenueCfg);
  const isCamp = (hexId: string) => isCampHex(hexId, game.revenueCfg);
  const human = $derived(game.actors.find((a) => a.id === HUMAN)!);

  function log(msg: string) { journal = [msg, ...journal].slice(0, 8); }

  // ── Clic sur un hex : libre → acheter. Adverse/mien → rien (le combat viendra). ─
  function onHex(hexId: string) {
    if (ended) return;
    if (game.ownership[hexId]) return; // occupé : pas de prise économique (combat à venir)
    if (!canClaim(game, HUMAN, hexId, CFG)) return;
    const cost = claimCost(game, hexId, CFG);
    game = claimHex(game, HUMAN, hexId, CFG);
    log(`🪙 Achat de ${hexId} (−${cost})`);
  }

  function finishTurn() {
    if (ended) return;
    const res = endTurn(game, [AI], CFG);
    game = res.state;
    reports = res.reports;
    for (const r of res.reports) {
      if (r.wentBankrupt) log(`💀 ${label(r.actorId)} fait faillite !`);
    }
    log(`⏩ Tour ${game.turn} — chacun encaisse income − charges`);
  }

  function restart() {
    seed = Math.floor(Math.random() * 1e9); // nouveau plateau
    game = initial(); reports = []; journal = [];
  }

  const baseOf = (id: string) => game.revenueCfg.baseByHex[id] ?? 0;

  // ── Layout pixel (géométrie fixe) ──────────────────────────────────────────────
  const centers: Record<string, [number, number]> = {};
  for (const h of GEO.map.hexes) centers[h.id] = axialToPixel(h.coord!.q, h.coord!.r);
  const bnds = genBounds(Object.values(centers));
  const viewBox = `${bnds.minX.toFixed(1)} ${bnds.minY.toFixed(1)} ${bnds.w.toFixed(1)} ${bnds.h.toFixed(1)}`;
</script>

<div class="game">
  <!-- Bandeau : tour + valeur nette des joueurs -->
  <div class="topbar">
    <div class="turn">Tour <b>{game.turn}</b>/{CFG.horizonTurns}</div>
    <div class="scores">
      {#each game.actors as a (a.id)}
        <span class="score" class:dead={a.bankrupt} style="--c:{COLORS[a.id]}">
          <span class="snm">{a.label}</span>
          <b class="nw">{worth(a.id)}</b><span class="nwl">val. nette</span>
          <i class:bad={net(a.id) < 0}>{net(a.id) >= 0 ? '+' : ''}{net(a.id)}/t</i>
          <i class="hc">⬡{hexCount(a.id)}</i>
        </span>
      {/each}
    </div>
    <button class="end-turn" onclick={finishTurn} disabled={ended}>Finir le tour ⏩</button>
  </div>

  {#if ended}
    <div class="banner">
      🏁 {end.reason === 'last_standing' ? 'Dernier debout' : 'Le plus riche'} :
      <b>{end.winnerId ? label(end.winnerId) : 'personne'}</b>
      <button class="restart" onclick={restart}>Rejouer</button>
    </div>
  {/if}

  <div class="layout">
    <!-- Carte -->
    <svg {viewBox} class="map">
      {#each game.map.hexes as h (h.id)}
        {@const c = centers[h.id]!}
        {@const owner = game.ownership[h.id]}
        {@const camp = isCamp(h.id)}
        {@const isMine = owner === HUMAN}
        {@const isEnemy = !!owner && owner !== HUMAN}
        {@const barren = !owner && !camp && baseOf(h.id) === 0}
        {@const claimable = !owner && canClaim(game, HUMAN, h.id, CFG) && !ended}
        <g class="hex" class:claimable role="button" tabindex="0"
           onclick={() => onHex(h.id)}
           onkeydown={(e) => e.key === 'Enter' && onHex(h.id)}>
          <polygon
            points={hexPointsPointy(c[0], c[1], 26)}
            fill={owner ? COLORS[owner] : barren ? '#0e1014' : '#1d2330'}
            stroke={claimable ? '#5ab0a0' : owner ? '#0e1015' : '#262b36'}
            stroke-width={claimable ? 3 : 1.5} />
          {#if camp && owner}
            <text x={c[0]} y={c[1] - 1} class="qg">🏕</text>
            <text x={c[0]} y={c[1] + 12} class="qgl">QG</text>
          {:else if isMine}
            <text x={c[0]} y={c[1] + 4} class="rev">+{hexRev(h.id)}</text>
          {:else if isEnemy}
            <text x={c[0]} y={c[1] + 4} class="rev">+{hexRev(h.id)}</text>
          {:else if barren}
            <text x={c[0]} y={c[1] + 4} class="barren">·</text>
          {:else}
            <text x={c[0]} y={c[1] + 4} class="cost">🪙{claimCost(game, h.id, CFG)}</text>
          {/if}
        </g>
      {/each}
    </svg>

    <!-- Panneaux -->
    <aside class="panel">
      <!-- TOI -->
      <section class="card" style="--c:{COLORS[HUMAN]}">
        <h3>{human.label}</h3>
        <div class="grid">
          <div><span>Cash</span><b>💰{human.cash}</b></div>
          <div><span>Valeur nette</span><b>{worth(HUMAN)}</b></div>
          <div><span>Income</span><b class="pos">+{income(HUMAN)}</b></div>
          <div><span>Charges</span><b class="neg">−{charges(HUMAN)}</b></div>
          <div><span>Ratio I/C</span><b class:bad={ratio(HUMAN) < 1}>{ratio(HUMAN).toFixed(2)}:1</b></div>
          <div><span>Net / tour</span><b class:bad={net(HUMAN) < 0}>{net(HUMAN) >= 0 ? '+' : ''}{net(HUMAN)}</b></div>
        </div>
        <div class="muted small tip2">⬡ {hexCount(HUMAN)} hex d'income (rares !) · cases grises = stériles (canevas du futur champ de bataille)</div>
      </section>

      <!-- CAMP -->
      <section class="card">
        <h3>Camp de base (dette)</h3>
        <div class="muted small">
          dette {game.camps.filter((c) => c.ownerId === HUMAN).reduce((s, c) => s + c.loanAmount, 0)} ·
          charge −{game.camps.filter((c) => c.ownerId === HUMAN).reduce((s, c) => s + c.chargeRate * c.loanAmount, 0)}/tour
        </div>
        <div class="muted small tip2">Dette fixe : ton seul levier est d'acquérir des hexes d'income pour couvrir cette charge.</div>
      </section>

      <!-- JOURNAL -->
      <section class="card">
        <h3>Journal</h3>
        {#if journal.length === 0}
          <div class="muted small">Achète une case d'income (libre, en vert), puis finis le tour.</div>
        {:else}
          {#each journal as j}<div class="jrow small">{j}</div>{/each}
        {/if}
      </section>
    </aside>
  </div>
</div>

<style>
  .game { display: flex; flex-direction: column; gap: .7rem; position: relative; }

  .topbar { display: flex; align-items: center; gap: 1rem; background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: .55rem .9rem; }
  .turn { font-size: .9rem; color: #9aa3b5; }
  .turn b { color: #e6ebf5; font-size: 1.05rem; }
  .scores { display: flex; gap: 1.2rem; margin-left: auto; }
  .score { display: flex; align-items: baseline; gap: .4rem; border-left: 3px solid var(--c); padding-left: .55rem; font-size: .82rem; }
  .score.dead { opacity: .45; text-decoration: line-through; }
  .snm { color: #cdd3df; }
  .nw { font-size: 1.05rem; color: #e6ebf5; }
  .nwl { font-size: .62rem; color: #7a8294; }
  .score i { font-style: normal; color: #7a8294; font-size: .76rem; }
  .score i.bad { color: #e05050; }

  .end-turn { background: #1a2030; border: 1px solid #3a4060; color: #9ab0d0; border-radius: 5px; padding: .45rem .9rem; cursor: pointer; font-weight: 600; font-size: .88rem; }
  .end-turn:hover:not(:disabled) { border-color: #5a70b0; }
  .end-turn:disabled { opacity: .4; cursor: not-allowed; }

  .banner { background: #1e2435; border: 1px solid #5ab0a0; border-radius: 8px; padding: .6rem 1rem; display: flex; align-items: center; gap: 1rem; }
  .restart { margin-left: auto; background: #1a2030; border: 1px solid #5ab0a0; color: #b9f5cf; border-radius: 5px; padding: .35rem .8rem; cursor: pointer; }

  .layout { display: grid; grid-template-columns: 1fr 300px; gap: 1rem; align-items: start; }
  .map { width: 100%; background: #0f1117; border: 1px solid #2a2f3a; border-radius: 8px; }
  .hex { cursor: default; }
  .hex.claimable { cursor: pointer; }
  .hex.claimable:hover polygon { stroke: #b9f5cf; stroke-width: 4; }
  .rev { fill: #fff; font-size: 10px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .cost { fill: #c2a04a; font-size: 9px; text-anchor: middle; pointer-events: none; }
  .barren { fill: #3a4150; font-size: 12px; text-anchor: middle; pointer-events: none; }
  .qg { font-size: 13px; text-anchor: middle; pointer-events: none; }
  .qgl { fill: #fff; font-size: 8px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .tip2 { margin-top: .4rem; }

  .panel { display: flex; flex-direction: column; gap: .6rem; }
  .card { background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: .6rem .75rem; }
  .card h3 { margin: 0 0 .5rem; font-size: .82rem; font-weight: 700; color: #cdd3df; border-bottom: 1px solid #2a2f3a; padding-bottom: .35rem; }
  .card[style] h3 { border-color: var(--c); }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem .6rem; }
  .grid div { display: flex; justify-content: space-between; align-items: baseline; font-size: .8rem; }
  .grid span { color: #7a8294; }
  .grid b { font-weight: 700; }
  .pos { color: #5ab0a0; }
  .neg { color: #e07a3a; }
  .bad { color: #e05050; }

  .jrow { padding: .12rem 0; border-bottom: 1px solid #1a1e28; color: #9aa3b5; }

  .muted { color: #7a8294; }
  .small { font-size: .76rem; }
</style>
