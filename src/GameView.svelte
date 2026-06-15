<script lang="ts">
  // LE JEU — vue unique, jouable. Plus de démos de briques : tout est ici, sur GameStateV2.
  // Tu es Alice (Tronc A). Bob (Tronc B) est piloté par l'IA. Acquiers des hexes, emprunte,
  // finis le tour → income − charges → cash. Le plus riche à la fin gagne, ou fais couler Bob.
  import { makeGameStateV2, makeActorV2, type GameStateV2 } from './engine/state2';
  import { actorNet, checkEnd, type ActorTickReport } from './engine/tick';
  import { actorIncome, hexRevenue } from './engine/revenue';
  import { actorCharges } from './engine/camp';
  import {
    claimCost, canClaim, claimHex, borrow, endTurn, DEFAULT_CONFIG, type GameConfig,
  } from './engine/game';
  import { axialToPixel, hexPointsPointy, genBounds } from './lib/layout';
  import type { GameMap, Hex } from './engine/types';
  import type { RevenueConfig } from './engine/revenue';

  const HUMAN = 'alice';
  const AI = 'bob';
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };

  // ── Carte : grappe de 7 hexes (centre A + 6 voisins) ──────────────────────────
  const AXIAL: Array<{ id: string; q: number; r: number; base: number }> = [
    { id: 'A', q: 0, r: 0, base: 12 },
    { id: 'B', q: 1, r: 0, base: 8 },
    { id: 'C', q: 0, r: 1, base: 8 },
    { id: 'D', q: -1, r: 1, base: 8 },
    { id: 'E', q: -1, r: 0, base: 8 },
    { id: 'F', q: 0, r: -1, base: 8 },
    { id: 'G', q: 1, r: -1, base: 8 },
  ];
  const DIRS: Array<[number, number]> = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  function neighborsOf(q: number, r: number): string[] {
    const ids: string[] = [];
    for (const [dq, dr] of DIRS) {
      const f = AXIAL.find((a) => a.q === q + dq && a.r === r + dr);
      if (f) ids.push(f.id);
    }
    return ids;
  }
  const MAP: GameMap = {
    id: 'game7',
    hexes: AXIAL.map<Hex>((a) => ({
      id: a.id, label: a.id, kind: 'marche',
      neighbors: neighborsOf(a.q, a.r), coord: { q: a.q, r: a.r },
    })),
  };
  const REV: RevenueConfig = {
    baseByHex: Object.fromEntries(AXIAL.map((a) => [a.id, a.base])),
    agglomerationBonus: 4,
  };
  const CFG: GameConfig = { ...DEFAULT_CONFIG, horizonTurns: 12 };

  function initial(): GameStateV2 {
    return makeGameStateV2(MAP, REV, [
      makeActorV2('alice', 'Alice (toi)', 50),
      makeActorV2('bob', 'Bob (IA)', 50),
    ]);
  }
  let game = $state<GameStateV2>(initial());
  let reports = $state<ActorTickReport[]>([]);
  let events = $state<string[]>([]);

  const end = $derived(checkEnd(game, CFG.horizonTurns));
  const ended = $derived(end.ended);

  function label(id: string) { return game.actors.find((a) => a.id === id)?.label ?? id; }
  const income = (id: string) => actorIncome(id, game.ownership, game.map, game.revenueCfg);
  const hexRev = (hexId: string) => hexRevenue(hexId, game.ownership, game.map, game.revenueCfg);
  const charges = (id: string) => actorCharges(id, game.camps);
  const net = (id: string) => actorNet(game, id);
  const human = $derived(game.actors.find((a) => a.id === HUMAN)!);

  // ── Actions du joueur ─────────────────────────────────────────────────────────
  function tryClaim(hexId: string) {
    if (ended) return;
    if (game.ownership[hexId]) return; // occupé → éviction (brique suivante : carnet)
    if (!canClaim(game, HUMAN, hexId, CFG)) return;
    game = claimHex(game, HUMAN, hexId, CFG);
  }

  function takeLoan(amount: number) {
    if (ended) return;
    game = borrow(game, HUMAN, amount, 'A', CFG); // Alice = Tronc A (dette permanente)
  }

  function finishTurn() {
    if (ended) return;
    const res = endTurn(game, [AI], CFG);
    game = res.state;
    reports = res.reports;
    events = res.reports
      .filter((r) => r.wentBankrupt)
      .map((r) => `💀 ${label(r.actorId)} fait faillite (charges ${r.charges} > cash)`);
  }

  function restart() {
    game = initial();
    reports = [];
    events = [];
  }

  // Layout
  const centers: Record<string, [number, number]> = {};
  for (const a of AXIAL) centers[a.id] = axialToPixel(a.q, a.r);
  const b = genBounds(Object.values(centers));
  const viewBox = `${b.minX.toFixed(1)} ${b.minY.toFixed(1)} ${b.w.toFixed(1)} ${b.h.toFixed(1)}`;
</script>

<div class="game">
  <div class="topbar">
    <div class="turn">Tour <b>{game.turn}</b> / {CFG.horizonTurns}</div>
    <div class="scores">
      {#each game.actors as a (a.id)}
        <span class="score" class:dead={a.bankrupt} style="--c:{COLORS[a.id]}">
          {a.label} <b>💰{a.cash}</b>
          <i class:bad={net(a.id) < 0}>{net(a.id) >= 0 ? '+' : ''}{net(a.id)}/t</i>
        </span>
      {/each}
    </div>
    <button class="end-turn" onclick={finishTurn} disabled={ended}>Finir le tour ⏩</button>
  </div>

  {#if ended}
    <div class="banner">
      🏁 Partie terminée — {end.reason === 'last_standing' ? 'dernier debout' : 'le plus riche'} :
      <b>{end.winnerId ? label(end.winnerId) : 'personne'}</b>
      <button class="restart" onclick={restart}>Rejouer</button>
    </div>
  {/if}

  <div class="layout">
    <svg {viewBox} class="map">
      {#each game.map.hexes as h (h.id)}
        {@const c = centers[h.id]!}
        {@const owner = game.ownership[h.id]}
        {@const cost = claimCost(game, h.id, CFG)}
        {@const claimable = !owner && canClaim(game, HUMAN, h.id, CFG) && !ended}
        <g class="hex" class:claimable role="button" tabindex="0"
           onclick={() => tryClaim(h.id)}
           onkeydown={(e) => e.key === 'Enter' && tryClaim(h.id)}>
          <polygon
            points={hexPointsPointy(c[0], c[1])}
            fill={owner ? COLORS[owner] : '#1c2029'}
            stroke={claimable ? '#5ab0a0' : owner ? '#0e1015' : '#2a2f3a'}
            stroke-width={claimable ? 3 : 2} />
          {#if owner}
            <text x={c[0]} y={c[1] - 4} class="hid">{h.id}</text>
            <text x={c[0]} y={c[1] + 10} class="rev">+{hexRev(h.id)}</text>
          {:else}
            <text x={c[0]} y={c[1] - 4} class="hid muted">{h.id}</text>
            <text x={c[0]} y={c[1] + 10} class="cost">🪙{cost}</text>
          {/if}
        </g>
      {/each}
    </svg>

    <aside class="panel">
      <div class="you" style="--c:{COLORS[HUMAN]}">
        <div class="you-head">
          <span class="you-name">{human.label}</span>
          <span class="cash">💰 {human.cash}</span>
        </div>
        <div class="flow">
          <span class="pos">+{income(HUMAN)}</span>
          <span class="sep">income</span>
          <span class="neg">−{charges(HUMAN)}</span>
          <span class="sep">charges</span>
          <span class="eq">=</span>
          <span class="net" class:bad={net(HUMAN) < 0}>{net(HUMAN) >= 0 ? '+' : ''}{net(HUMAN)}/tour</span>
        </div>
      </div>

      <div class="acts">
        <div class="act-title">Emprunter <span class="muted small">(Tronc A · charge 10 %/tour, permanente)</span></div>
        <div class="loan-btns">
          <button onclick={() => takeLoan(50)} disabled={ended}>+50 <i>(−5/t)</i></button>
          <button onclick={() => takeLoan(100)} disabled={ended}>+100 <i>(−10/t)</i></button>
        </div>
      </div>

      <div class="hint-box muted small">
        <b>Comment jouer :</b>
        <div>• Clic sur un hex libre <span style="color:#5ab0a0">vert</span> → l'acheter (coût 🪙)</div>
        <div>• Emprunte pour avoir le capital de conquérir — mais la charge te suit</div>
        <div>• <b>Finir le tour</b> → Bob joue, puis chacun encaisse income − charges</div>
        <div>• Gagne : le plus riche au tour {CFG.horizonTurns}, ou fais couler Bob</div>
        <div class="warn">⚠️ Emprunte trop sans hexes → charges &gt; income → faillite</div>
      </div>

      {#if reports.length > 0}
        <div class="reports">
          <div class="act-title">Dernier tour</div>
          {#each reports as r (r.actorId)}
            <div class="rep small">
              <span style="color:{COLORS[r.actorId]}">{label(r.actorId)}</span> :
              {r.income} − {r.charges} = <b class:bad={r.net < 0}>{r.net >= 0 ? '+' : ''}{r.net}</b>
            </div>
          {/each}
        </div>
      {/if}

      {#each events as ev}
        <div class="event">{ev}</div>
      {/each}
    </aside>
  </div>
</div>

<style>
  .game { display: flex; flex-direction: column; gap: .8rem; }
  .topbar { display: flex; align-items: center; gap: 1rem; background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: .6rem .9rem; }
  .turn { font-size: .9rem; color: #9aa3b5; }
  .turn b { color: #e6ebf5; font-size: 1.1rem; }
  .scores { display: flex; gap: 1rem; margin-left: auto; }
  .score { font-size: .85rem; border-left: 3px solid var(--c); padding-left: .5rem; }
  .score.dead { opacity: .45; text-decoration: line-through; }
  .score i { font-style: normal; color: #7a8294; font-size: .78rem; margin-left: .2rem; }
  .score i.bad { color: #e05050; }
  .end-turn { background: #1a2030; border: 1px solid #3a4060; color: #9ab0d0; border-radius: 5px; padding: .45rem .9rem; cursor: pointer; font-size: .9rem; font-weight: 600; }
  .end-turn:hover:not(:disabled) { border-color: #5a70b0; }
  .end-turn:disabled { opacity: .4; cursor: not-allowed; }

  .banner { background: #1e2435; border: 1px solid #5ab0a0; border-radius: 8px; padding: .7rem 1rem; font-size: 1rem; display: flex; align-items: center; gap: 1rem; }
  .restart { margin-left: auto; background: #1a2030; border: 1px solid #5ab0a0; color: #b9f5cf; border-radius: 5px; padding: .35rem .8rem; cursor: pointer; }

  .layout { display: grid; grid-template-columns: 1fr 320px; gap: 1rem; align-items: start; }
  .map { width: 100%; background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; }
  .hex { cursor: default; }
  .hex.claimable { cursor: pointer; }
  .hex.claimable:hover polygon { stroke: #b9f5cf; stroke-width: 4; }
  .hid { fill: #e6ebf5; font-size: 12px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .hid.muted { fill: #7a8294; }
  .rev { fill: #fff; font-size: 11px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .cost { fill: #c2a04a; font-size: 10px; text-anchor: middle; pointer-events: none; }

  .panel { display: flex; flex-direction: column; gap: .8rem; }
  .you { background: #14161c; border: 1px solid #2a2f3a; border-top: 3px solid var(--c); border-radius: 8px; padding: .7rem .8rem; }
  .you-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: .5rem; }
  .you-name { font-weight: 700; }
  .cash { font-weight: 700; }
  .flow { display: flex; align-items: baseline; gap: .35rem; font-size: .85rem; flex-wrap: wrap; }
  .flow .sep { font-size: .68rem; color: #7a8294; }
  .pos { color: #5ab0a0; font-weight: 700; }
  .neg { color: #e07a3a; font-weight: 700; }
  .eq { color: #7a8294; }
  .net { font-weight: 700; }
  .net.bad { color: #e05050; }

  .acts { background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: .7rem .8rem; }
  .act-title { font-size: .85rem; font-weight: 600; margin-bottom: .5rem; }
  .loan-btns { display: flex; gap: .5rem; }
  .loan-btns button { flex: 1; background: #1a1e28; border: 1px solid #3a4050; color: #cdd3df; border-radius: 5px; padding: .4rem; cursor: pointer; font-size: .85rem; }
  .loan-btns button i { font-style: normal; color: #e08a5a; font-size: .72rem; }
  .loan-btns button:hover:not(:disabled) { border-color: #5a8090; }
  .loan-btns button:disabled { opacity: .4; cursor: not-allowed; }

  .hint-box { background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: .6rem .8rem; line-height: 1.6; }
  .warn { margin-top: .3rem; color: #e0a070; }

  .reports { background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: .6rem .8rem; }
  .rep { padding: .1rem 0; }
  .rep b.bad { color: #e05050; }
  .event { background: #2a1a1a; border-radius: 6px; padding: .4rem .6rem; font-size: .82rem; color: #e08080; }

  .muted { color: #7a8294; }
  .small { font-size: .78rem; }
</style>
