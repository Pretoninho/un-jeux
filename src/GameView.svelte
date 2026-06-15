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
    evictionCost, canEvict, evict,
  } from './engine/game';
  import { axialToPixel, hexPointsPointy, genBounds } from './lib/layout';
  import type { GameMap, Hex } from './engine/types';
  import type { RevenueConfig } from './engine/revenue';

  const HUMAN = 'alice';
  const AI = 'bob';
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };

  // ── Carte : hexagone de rayon 2 = 19 hexes (centre cher, anneaux décroissants) ─
  const RADIUS = 2;
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const ringDist = (q: number, r: number) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;

  const AXIAL: Array<{ id: string; q: number; r: number; base: number }> = (() => {
    const cells: Array<{ id: string; q: number; r: number; base: number }> = [];
    let i = 0;
    for (let q = -RADIUS; q <= RADIUS; q++) {
      for (let r = Math.max(-RADIUS, -q - RADIUS); r <= Math.min(RADIUS, -q + RADIUS); r++) {
        const d = ringDist(q, r);
        const base = d === 0 ? 12 : d === 1 ? 9 : 6; // cœur = prix convoité
        cells.push({ id: LETTERS[i++]!, q, r, base });
      }
    }
    return cells;
  })();

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
    id: 'game19',
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

  // Bases de départ aux deux bouts opposés → les joueurs grandissent l'un vers l'autre.
  const ALICE_START = AXIAL.find((a) => a.q === -RADIUS && a.r === 0)!.id;
  const BOB_START = AXIAL.find((a) => a.q === RADIUS && a.r === 0)!.id;

  function initial(): GameStateV2 {
    const s = makeGameStateV2(MAP, REV, [
      makeActorV2('alice', 'Alice (toi)', 70),
      makeActorV2('bob', 'Bob (IA)', 70),
    ]);
    s.ownership[ALICE_START] = 'alice';
    s.ownership[BOB_START] = 'bob';
    return s;
  }
  let game = $state<GameStateV2>(initial());
  let reports = $state<ActorTickReport[]>([]);
  let events = $state<string[]>([]);

  const end = $derived(checkEnd(game, CFG.horizonTurns));
  const ended = $derived(end.ended);

  function label(id: string) { return game.actors.find((a) => a.id === id)?.label ?? id; }
  const income = (id: string) => actorIncome(id, game.ownership, game.map, game.revenueCfg);
  const hexRev = (hexId: string) => hexRevenue(hexId, game.ownership, game.map, game.revenueCfg);
  const hexCount = (id: string) => Object.values(game.ownership).filter((o) => o === id).length;
  const charges = (id: string) => actorCharges(id, game.camps);
  const net = (id: string) => actorNet(game, id);
  const human = $derived(game.actors.find((a) => a.id === HUMAN)!);

  const evictCost = (hexId: string) => evictionCost(game, hexId, CFG);

  // ── Actions du joueur ─────────────────────────────────────────────────────────
  // Clic sur un hex : LIBRE → l'acheter ; ADVERSE → l'évincer (rachat zéro-sum) ; à moi → rien.
  function onHex(hexId: string) {
    if (ended) return;
    const owner = game.ownership[hexId];
    if (!owner) {
      if (canClaim(game, HUMAN, hexId, CFG)) game = claimHex(game, HUMAN, hexId, CFG);
    } else if (owner !== HUMAN) {
      if (canEvict(game, HUMAN, hexId, CFG)) game = evict(game, HUMAN, hexId, CFG);
    }
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
          <i class="hc">⬡{hexCount(a.id)}</i>
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
        {@const isMine = owner === HUMAN}
        {@const isEnemy = !!owner && owner !== HUMAN}
        {@const claimable = !owner && canClaim(game, HUMAN, h.id, CFG) && !ended}
        {@const evictable = isEnemy && canEvict(game, HUMAN, h.id, CFG) && !ended}
        <g class="hex" class:claimable class:evictable role="button" tabindex="0"
           onclick={() => onHex(h.id)}
           onkeydown={(e) => e.key === 'Enter' && onHex(h.id)}>
          <polygon
            points={hexPointsPointy(c[0], c[1])}
            fill={owner ? COLORS[owner] : '#1c2029'}
            stroke={claimable ? '#5ab0a0' : evictable ? '#e0604a' : owner ? '#0e1015' : '#2a2f3a'}
            stroke-width={claimable || evictable ? 3 : 2} />
          {#if isMine}
            <text x={c[0]} y={c[1] - 4} class="hid">{h.id}</text>
            <text x={c[0]} y={c[1] + 10} class="rev">+{hexRev(h.id)}</text>
          {:else if isEnemy}
            <text x={c[0]} y={c[1] - 4} class="hid">{h.id}</text>
            <text x={c[0]} y={c[1] + 10} class="evictc">⚔{evictCost(h.id)}</text>
          {:else}
            <text x={c[0]} y={c[1] - 4} class="hid muted">{h.id}</text>
            <text x={c[0]} y={c[1] + 10} class="cost">🪙{claimCost(game, h.id, CFG)}</text>
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
        <div>• Hex libre <span style="color:#5ab0a0">vert</span> 🪙 → l'acheter</div>
        <div>• Hex de Bob <span style="color:#e0604a">rouge</span> ⚔ → l'<b>évincer</b> (rachat zéro-sum : tu paies, il encaisse, l'hex passe à toi)</div>
        <div>• Emprunte pour le capital de conquête — mais la charge te suit</div>
        <div>• <b>Finir le tour</b> → Bob joue (il évince aussi !), puis income − charges</div>
        <div>• Gagne : le plus riche au tour {CFG.horizonTurns}, ou fais couler Bob</div>
        <div class="warn">⚠️ Un hex au cœur d'un cluster coûte plus cher à prendre (sa prime d'agglo gonfle le prix = résistance visible)</div>
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
  .hex.claimable, .hex.evictable { cursor: pointer; }
  .hex.claimable:hover polygon { stroke: #b9f5cf; stroke-width: 4; }
  .hex.evictable:hover polygon { stroke: #ff8a6a; stroke-width: 4; }
  .hid { fill: #e6ebf5; font-size: 11px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .hid.muted { fill: #7a8294; }
  .rev { fill: #fff; font-size: 10px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .cost { fill: #c2a04a; font-size: 9px; text-anchor: middle; pointer-events: none; }
  .evictc { fill: #ffd0c4; font-size: 9px; font-weight: 700; text-anchor: middle; pointer-events: none; }

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
