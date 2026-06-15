<script lang="ts">
  import { makeGameStateV2, makeActorV2, type GameStateV2 } from './engine/state2';
  import { tick, actorNet, checkEnd, type ActorTickReport } from './engine/tick';
  import { makeCamp, type Tronc } from './engine/camp';
  import { actorIncome, type RevenueConfig } from './engine/revenue';
  import { actorCharges } from './engine/camp';
  import { axialToPixel, hexPointsPointy, genBounds } from './lib/layout';
  import type { GameMap, Hex } from './engine/types';

  // ── Carte : grappe de 7 hexes (centre + 6 voisins) ───────────────────────────
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
    id: 'tickdemo',
    hexes: AXIAL.map<Hex>((a) => ({
      id: a.id, label: a.id, kind: 'marche',
      neighbors: neighborsOf(a.q, a.r), coord: { q: a.q, r: a.r },
    })),
  };
  const CFG: RevenueConfig = {
    baseByHex: Object.fromEntries(AXIAL.map((a) => [a.id, a.base])),
    agglomerationBonus: 4,
  };
  const HORIZON = 12;

  // ── Acteurs + setup ──────────────────────────────────────────────────────────
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };
  const TRONC: Record<string, Tronc> = { alice: 'A', bob: 'B' };

  function initial(): GameStateV2 {
    const s = makeGameStateV2(MAP, CFG, [
      makeActorV2('alice', 'Alice', 60),
      makeActorV2('bob', 'Bob', 60),
    ]);
    return s;
  }
  let game = $state<GameStateV2>(initial());
  let reports = $state<ActorTickReport[]>([]);
  let lastEvents = $state<string[]>([]);

  // ── Carte : clic = cycle de propriété libre → alice → bob → libre ─────────────
  const CYCLE = [null, 'alice', 'bob'] as const;
  function cycleOwner(id: string) {
    if (ended) return;
    const cur = game.ownership[id] ?? null;
    const idx = CYCLE.indexOf(cur as (typeof CYCLE)[number]);
    const next = CYCLE[(idx + 1) % CYCLE.length] ?? null;
    game.ownership = { ...game.ownership, [id]: next };
  }

  // ── Emprunt ───────────────────────────────────────────────────────────────────
  function takeLoan(actorId: string, amount: number) {
    if (ended) return;
    const tronc = TRONC[actorId]!;
    game.camps = [...game.camps, makeCamp(actorId, amount, tronc, 0.1)];
    game.actors = game.actors.map((a) =>
      a.id === actorId ? { ...a, cash: a.cash + amount } : a,
    );
  }

  // ── Tour ────────────────────────────────────────────────────────────────────
  function advance() {
    if (ended) return;
    const res = tick(game);
    game = res.state;
    reports = res.reports;
    lastEvents = res.reports
      .filter((r) => r.wentBankrupt)
      .map((r) => `💀 ${label(r.actorId)} fait faillite (charges ${r.charges} > cash)`);
  }

  function reset() {
    game = initial();
    reports = [];
    lastEvents = [];
  }

  // ── Dérivés ───────────────────────────────────────────────────────────────────
  const end = $derived(checkEnd(game, HORIZON));
  const ended = $derived(end.ended);
  function label(id: string) { return game.actors.find((a) => a.id === id)?.label ?? id; }
  const income = (id: string) => actorIncome(id, game.ownership, game.map, game.revenueCfg);
  const charges = (id: string) => actorCharges(id, game.camps);
  const net = (id: string) => actorNet(game, id);

  // Layout
  const centers: Record<string, [number, number]> = {};
  for (const a of AXIAL) centers[a.id] = axialToPixel(a.q, a.r);
  const b = genBounds(Object.values(centers));
  const viewBox = `${b.minX.toFixed(1)} ${b.minY.toFixed(1)} ${b.w.toFixed(1)} ${b.h.toFixed(1)}`;
</script>

<div class="demo">
  <div class="demo-header">
    <h2>Tick économique · demo
      <span class="hint">income − charges → cash · faillite si cash &lt; 0</span>
    </h2>
    <div class="actions">
      <button class="tick-btn" onclick={advance} disabled={ended}>⏩ Tour +1</button>
      <button class="reset" onclick={reset}>Réinitialiser</button>
    </div>
  </div>

  <div class="status">
    <span class="turn">Tour {game.turn} / {HORIZON}</span>
    {#if ended}
      <span class="end">
        🏁 Fin — {end.reason === 'last_standing' ? 'dernier debout' : 'le plus riche'} :
        <b>{end.winnerId ? label(end.winnerId) : 'personne'}</b>
      </span>
    {/if}
  </div>

  <div class="layout">
    <svg {viewBox} class="map">
      {#each game.map.hexes as h (h.id)}
        {@const c = centers[h.id]!}
        {@const owner = game.ownership[h.id]}
        <g class="hex" role="button" tabindex="0"
           onclick={() => cycleOwner(h.id)}
           onkeydown={(e) => e.key === 'Enter' && cycleOwner(h.id)}>
          <polygon
            points={hexPointsPointy(c[0], c[1])}
            fill={owner ? COLORS[owner] : '#1c2029'}
            stroke={owner ? '#0e1015' : '#2a2f3a'} stroke-width="2" />
          <text x={c[0]} y={c[1] - 6} class="hid">{h.id}</text>
          <text x={c[0]} y={c[1] + 8} class="base muted">{CFG.baseByHex[h.id]}</text>
        </g>
      {/each}
    </svg>

    <div class="panel">
      {#each game.actors as actor (actor.id)}
        {@const rep = reports.find((r) => r.actorId === actor.id)}
        <div class="actor" class:dead={actor.bankrupt} style="--c:{COLORS[actor.id]}">
          <div class="actor-top">
            <span class="name">{actor.label}</span>
            <span class="tronc">Tronc {TRONC[actor.id]}</span>
            {#if actor.bankrupt}<span class="badge-dead">faillite</span>{/if}
            <span class="cash">💰 {actor.cash}</span>
          </div>

          <div class="flow">
            <span class="pos">+{income(actor.id)} <i>income</i></span>
            <span class="neg">−{charges(actor.id)} <i>charges</i></span>
            <span class="eq">=</span>
            <span class="net" class:bad={net(actor.id) < 0}>
              {net(actor.id) >= 0 ? '+' : ''}{net(actor.id)}<i>/tour</i>
            </span>
          </div>

          {#if !actor.bankrupt && !ended}
            <div class="loans">
              <span class="muted small">Emprunter :</span>
              <button onclick={() => takeLoan(actor.id, 50)}>+50</button>
              <button onclick={() => takeLoan(actor.id, 100)}>+100</button>
              <span class="muted small">(charge +10 %/tour)</span>
            </div>
          {/if}

          {#if rep}
            <div class="report small muted">
              dernier tour : {rep.income} − {rep.charges} = {rep.net >= 0 ? '+' : ''}{rep.net}
              → cash {rep.cashAfter}
            </div>
          {/if}
        </div>
      {/each}

      {#each lastEvents as ev}
        <div class="event">{ev}</div>
      {/each}

      <div class="rules muted small">
        <b>Boucle :</b>
        <div>1. Clic sur un hex → libre → Alice → Bob (assigne le revenu)</div>
        <div>2. Emprunte → cash +montant, mais charge +10 %/tour à vie (A) ou soldable (B)</div>
        <div>3. ⏩ Tour +1 → chacun encaisse income − charges</div>
        <div>4. Cash &lt; 0 → 💀 faillite : hexes libérés, dette effacée</div>
        <div class="tip">💡 Emprunte gros sans assez d'hexes → tu coules. C'est le moteur de guerre.</div>
      </div>
    </div>
  </div>
</div>

<style>
  .demo { background: #0e1015; border: 1px solid #2a2f3a; border-radius: 10px; padding: 1.2rem; margin-top: 1rem; }
  .demo-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .6rem; }
  .demo-header h2 { margin: 0; font-size: 1rem; }
  .hint { color: #7a8294; font-size: .8rem; font-weight: 400; }
  .actions { display: flex; gap: .5rem; }

  .status { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; }
  .turn { background: #1a1e28; border: 1px solid #2a2f3a; border-radius: 4px; padding: .2rem .6rem; font-size: .82rem; color: #9aa3b5; }
  .end { font-size: .9rem; color: #e6ebf5; }

  .layout { display: grid; grid-template-columns: 1fr 320px; gap: 1rem; align-items: start; }
  .map { width: 100%; background: #14161c; border-radius: 8px; }
  .hex { cursor: pointer; }
  .hex:hover polygon { stroke: #fff; stroke-width: 3; }
  .hid { fill: #cdd3df; font-size: 11px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .base { fill: #5a6172; font-size: 10px; text-anchor: middle; pointer-events: none; }
  .muted { color: #7a8294; }
  .small { font-size: .78rem; }

  .panel { display: flex; flex-direction: column; gap: .7rem; }
  .actor { background: #14161c; border: 1px solid #2a2f3a; border-top: 3px solid var(--c); border-radius: 8px; padding: .7rem .8rem; }
  .actor.dead { opacity: .5; }
  .actor-top { display: flex; align-items: baseline; gap: .5rem; margin-bottom: .5rem; }
  .name { font-weight: 700; }
  .tronc { font-size: .72rem; color: #7a8294; }
  .badge-dead { font-size: .7rem; background: #3a1a1a; color: #e05050; border-radius: 3px; padding: .05rem .3rem; }
  .cash { margin-left: auto; font-weight: 700; }

  .flow { display: flex; align-items: baseline; gap: .5rem; font-size: .85rem; margin-bottom: .5rem; flex-wrap: wrap; }
  .flow i { font-style: normal; font-size: .68rem; color: #7a8294; }
  .pos { color: #5ab0a0; }
  .neg { color: #e07a3a; }
  .eq { color: #7a8294; }
  .net { font-weight: 700; color: #cdd3df; }
  .net.bad { color: #e05050; }

  .loans { display: flex; align-items: center; gap: .4rem; margin-bottom: .3rem; }
  .loans button { background: #1a1e28; border: 1px solid #3a4050; color: #cdd3df; border-radius: 4px; padding: .2rem .5rem; cursor: pointer; font-size: .8rem; }
  .loans button:hover { border-color: #5a8090; }

  .report { border-top: 1px solid #2a2f3a; padding-top: .4rem; }
  .event { background: #2a1a1a; border-radius: 6px; padding: .4rem .6rem; font-size: .82rem; color: #e08080; }

  .rules { background: #14161c; border-radius: 6px; padding: .6rem .8rem; line-height: 1.6; }
  .tip { margin-top: .3rem; color: #9aa3b5; }

  .tick-btn { background: #1a2030; border: 1px solid #3a4060; color: #9ab0d0; border-radius: 4px; padding: .35rem .8rem; cursor: pointer; font-size: .85rem; }
  .tick-btn:hover:not(:disabled) { border-color: #5a70b0; }
  .tick-btn:disabled { opacity: .4; cursor: not-allowed; }
  .reset { background: none; border: 1px solid #2a2f3a; color: #7a8294; padding: .35rem .7rem; border-radius: 4px; cursor: pointer; font-size: .8rem; }
  .reset:hover { border-color: #888; color: #cdd3df; }
</style>
