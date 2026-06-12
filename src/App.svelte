<script lang="ts">
  // Vue principale — PROTOTYPE d'exploration (gameplay à l'essai).
  // Le moteur (src/engine) est INCHANGÉ : le brouillard, le déplacement et le CHAIN
  // sont une couche d'UI. Les actions du joueur sont IMMÉDIATES (pas de retour arrière).
  // Simplifications de prototype : IA non spatiales · le flux des ouvertures immédiates
  // n'alimente pas l'impact-prix du tour · carte fixe 13 hexes (la mécanique vise une
  // carte procédurale large, memo §11).
  import { buildInitialState } from './engine/init';
  import { runTurn } from './engine/turn';
  import { policyForProfile } from './engine/ai';
  import { computeSignals } from './engine/signals';
  import { actorWealth } from './engine/portfolio';
  import { trackRecord } from './engine/score';
  import { makeRng, type Rng } from './engine/rng';
  import type { GameState, SignalReading } from './engine/state';
  import type { Hex } from './engine/types';
  import type { Policy } from './engine/policy';
  import { PA_PAR_TOUR } from './data/actions';
  import { presetMvp } from './data/config-mvp';
  import { LEXICON } from './data/lexicon';
  import { HEX_POS, hexPoints, hexFill, MAP_W, MAP_H } from './lib/layout';

  let gs: GameState;
  let rng: Rng;
  let ai: Policy[];
  let prevV: Record<string, number> = {};

  let seed = $state(1);
  let selected = $state<string | null>(null);
  let hexes = $state<Hex[]>([]);
  let log = $state<string[]>([]);
  let view = $state<ReturnType<typeof buildView>>();
  let read = $state<Set<string>>(new Set());
  let showDetail = $state(false);

  // Couche d'exploration
  let playerHex = $state<string>('');
  let revealed = $state<Set<string>>(new Set());
  let paUsed = $state(0);
  let opensThisTurn = $state(0);

  const isInvestable = (h: Hex) => h.kind === 'marche';
  const paLeft = () => PA_PAR_TOUR - paUsed - read.size;
  const openCost = () => (opensThisTurn === 0 ? 1 : 2); // 1ʳᵉ ouverture = 1 PA, CHAIN = 2 PA
  const hexById = (id: string) => hexes.find((h) => h.id === id);
  const neighborsOfPlayer = () => hexById(playerHex)?.neighbors ?? [];
  const canOpen = (id: string) => {
    const h = hexById(id);
    return !!h && isInvestable(h) && revealed.has(id) && neighborsOfPlayer().includes(id);
  };

  function buildView() {
    const player = gs.actors[0]!;
    const wealth = actorWealth(player, gs.market);
    const tr = trackRecord(player, gs.benchmarkHistory, gs.params.drawdownPenalty);
    const sig: SignalReading = gs.signalsHistory.at(-1) ?? computeSignals(gs, makeRng(gs.rngSeed));
    const market: Record<string, number> = {};
    const delta: Record<string, number> = {};
    for (const [id, m] of Object.entries(gs.market)) {
      market[id] = m.V;
      delta[id] = m.V - (prevV[id] ?? m.V);
    }
    return {
      turn: gs.turn,
      horizon: gs.params.horizonTurns,
      regime: gs.regime,
      cash: player.cash,
      wealth,
      positions: new Set(player.positions.map((p) => p.hexId)),
      market,
      delta,
      signals: sig,
      track: { you: wealth / 100 - 1, market: (gs.benchmarkHistory.at(-1) ?? 1) - 1, drawdown: tr.maxDrawdown },
      over: gs.turn >= gs.params.horizonTurns,
    };
  }

  function reveal(id: string) {
    const next = new Set(revealed);
    next.add(id);
    for (const n of hexById(id)?.neighbors ?? []) next.add(n);
    revealed = next;
  }

  function newGame(s: number) {
    const cfg = presetMvp(s);
    const init = buildInitialState(cfg);
    gs = init.state;
    rng = init.rng;
    ai = cfg.adversaires.map(policyForProfile);
    hexes = gs.map.hexes;
    prevV = Object.fromEntries(Object.entries(gs.market).map(([id, m]) => [id, m.V]));
    // Spawn sur un hexe marché au hasard (reproductible par seed).
    const spawnable = hexes.filter(isInvestable).map((h) => h.id);
    const spw = makeRng(s * 7 + 1);
    playerHex = spawnable[spw.int(0, spawnable.length - 1)] ?? spawnable[0]!;
    revealed = new Set();
    reveal(playerHex);
    paUsed = 0;
    opensThisTurn = 0;
    read = new Set();
    selected = playerHex;
    showDetail = false;
    log = [`Apparition en ${hexById(playerHex)?.label} — seed ${s}`];
    view = buildView();
  }

  // Actions IMMÉDIATES (mutent l'acteur joueur ; le moteur résout le marché à Fin du tour).
  function spend(cost: number) {
    paUsed += cost;
    view = buildView();
  }

  function open(hexId: string, frac: number) {
    const cost = openCost();
    if (view?.over || !canOpen(hexId) || paLeft() < cost) return;
    const player = gs.actors[0]!;
    const equity = player.cash * frac;
    if (equity <= 0) return;
    player.cash -= equity;
    player.positions.push({ hexId, equity, leverage: 0, entryV: gs.market[hexId]!.V });
    playerHex = hexId; // déplacement
    reveal(hexId); // révèle les nouveaux voisins
    opensThisTurn += 1;
    selected = hexId;
    log = [`Ouvre ${hexById(hexId)?.label} (${cost} PA)`, ...log].slice(0, 8);
    spend(cost);
  }

  function reinforce(hexId: string) {
    if (view?.over || !view?.positions.has(hexId) || paLeft() < 1) return;
    const player = gs.actors[0]!;
    const equity = player.cash * 0.25;
    if (equity <= 0) return;
    player.cash -= equity;
    player.positions.push({ hexId, equity, leverage: 0, entryV: gs.market[hexId]!.V });
    spend(1);
  }

  function partial(hexId: string) {
    if (view?.over || !view?.positions.has(hexId) || paLeft() < 2) return;
    const player = gs.actors[0]!;
    for (const p of player.positions) {
      if (p.hexId !== hexId) continue;
      const notional = p.equity * (1 + p.leverage);
      const value = p.equity + notional * (gs.market[hexId]!.V / p.entryV - 1);
      player.cash += 0.5 * Math.max(0, value);
      p.equity *= 0.5;
    }
    spend(2);
  }

  function close(hexId: string) {
    if (view?.over || !view?.positions.has(hexId) || paLeft() < 1) return;
    const player = gs.actors[0]!;
    const kept = [];
    for (const p of player.positions) {
      if (p.hexId === hexId) {
        const notional = p.equity * (1 + p.leverage);
        player.cash += Math.max(0, p.equity + notional * (gs.market[hexId]!.V / p.entryV - 1));
      } else kept.push(p);
    }
    player.positions = kept;
    spend(1);
  }

  function readSignal(name: string) {
    if (view?.over || read.has(name) || paLeft() < 1) return;
    read = new Set(read).add(name);
  }

  function endTurn() {
    if (!view || view.over) return;
    prevV = Object.fromEntries(Object.entries(gs.market).map(([id, m]) => [id, m.V]));
    const human: Policy = { id: 'human', decide: () => [{ verb: 'RESERVER' }] };
    runTurn(gs, [human, ...ai], rng);
    paUsed = 0;
    opensThisTurn = 0;
    read = new Set();
    log = [`Tour ${gs.turn} · ${gs.regime}`, ...log].slice(0, 8);
    view = buildView();
  }

  const fmtPct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;

  newGame(1);
</script>

<main>
  <header>
    <div class="title">un-jeux <span class="sub">· Vautour · exploration (proto)</span></div>
    {#if view}
      <div class="status">
        <span>Tour <b>{view.turn}/{view.horizon}</b></span>
        <span>Régime <b class:crise={view.regime === 'crise'}>{view.regime}</b></span>
        <span class="track">
          Vous <b class:neg={view.track.you < 0}>{fmtPct(view.track.you)}</b>
          · Marché <b>{fmtPct(view.track.market)}</b>
          · Pire séquence <b class="neg">−{(view.track.drawdown * 100).toFixed(0)}%</b>
        </span>
      </div>
    {/if}
  </header>

  {#if view}
    <div class="board">
      <svg viewBox="0 0 {MAP_W} {MAP_H}" class="map">
        {#each hexes as h (h.id)}
          {@const pos = HEX_POS[h.id]}
          {#if pos}
            {@const shown = revealed.has(h.id)}
            {@const d = view.delta[h.id] ?? 0}
            <g
              class="hex"
              class:selected={selected === h.id}
              class:owned={view.positions.has(h.id)}
              class:here={playerHex === h.id}
              class:openable={canOpen(h.id)}
              role="button"
              tabindex="0"
              onclick={() => shown && (selected = h.id)}
              onkeydown={(e) => e.key === 'Enter' && shown && (selected = h.id)}
            >
              <title>{shown ? (LEXICON[h.id]?.court ?? h.label) : 'Inexploré'}</title>
              {#if shown}
                <polygon points={hexPoints(pos[0], pos[1])} fill={hexFill(h.kind, h.cluster)} class:frontier={h.kind === 'frontiere'} />
                <text x={pos[0]} y={pos[1] - 6} class="label">{h.label}</text>
                {#if isInvestable(h)}
                  <text x={pos[0]} y={pos[1] + 12} class="vval" class:up={d > 0.05} class:down={d < -0.05}>
                    {view.market[h.id]?.toFixed(0)}{d > 0.05 ? ' ▲' : d < -0.05 ? ' ▼' : ''}
                  </text>
                {/if}
                {#if playerHex === h.id}<circle cx={pos[0]} cy={pos[1] + 26} r="5" class="token" />{/if}
              {:else}
                <polygon points={hexPoints(pos[0], pos[1])} class="fog" />
                <text x={pos[0]} y={pos[1] + 4} class="fogq">?</text>
              {/if}
            </g>
          {/if}
        {/each}
      </svg>

      <aside>
        <section class="signals">
          <h3>Signaux <span class="hint">~ bruités, F cachée</span></h3>
          <div class="bar-row">
            <span>Volatilité</span>
            <div class="bar"><div class="fill" style="width:{view.signals.volatilite * 100}%"></div></div>
          </div>
          {#each [['Écart crédit', 'ecartCredit'], ['Financement', 'financement']] as [name, key]}
            <div class="bar-row">
              <span>{name}</span>
              {#if read.has(key)}
                <div class="bar"><div class="fill" style="width:{(view.signals as any)[key] * 100}%"></div></div>
              {:else}
                <button class="lire" onclick={() => readSignal(key)} disabled={view.over || paLeft() < 1}>LIRE · 1 PA</button>
              {/if}
            </div>
          {/each}
        </section>

        <section class="actions">
          <h3>Actions <span class="pa">{paLeft()} / {PA_PAR_TOUR} PA</span></h3>
          <div class="chain">Prochaine ouverture : <b>{openCost()} PA</b>{opensThisTurn > 0 ? ' (CHAIN)' : ''}</div>
          {#if selected}
            {@const h = hexById(selected)}
            {@const held = view.positions.has(selected)}
            <div class="sel">
              <b>{h?.label}</b>{#if playerHex === selected}<span class="muted small"> · vous êtes ici</span>{/if}
              <button class="qmark" onclick={() => (showDetail = !showDetail)} title="Explication">?</button>
            </div>
            <div class="court">{LEXICON[selected]?.court}</div>
            {#if showDetail}<div class="long">{LEXICON[selected]?.long}</div>{/if}

            {#if canOpen(selected)}
              <div class="open-row">
                <span>Ouvrir & aller</span>
                <button onclick={() => open(selected!, 0.25)} disabled={paLeft() < openCost()}>25%</button>
                <button onclick={() => open(selected!, 0.5)} disabled={paLeft() < openCost()}>50%</button>
                <button onclick={() => open(selected!, 1)} disabled={paLeft() < openCost()}>100%</button>
              </div>
            {/if}
            {#if held}
              <button onclick={() => reinforce(selected!)} disabled={view.over || paLeft() < 1}>Renforcer (+25%) · 1 PA</button>
              <button onclick={() => partial(selected!)} disabled={view.over || paLeft() < 2}>Clôture partielle (−50%) · 2 PA</button>
              <button onclick={() => close(selected!)} disabled={view.over || paLeft() < 1}>Fermer (totale) · 1 PA</button>
            {/if}
            {#if !canOpen(selected) && !held && playerHex !== selected}
              <div class="muted small">Pas adjacent / non investissable.</div>
            {/if}
          {:else}
            <div class="sel muted">Clique un hexe révélé.</div>
          {/if}
          <div class="cash">Réserve : <b>{view.cash.toFixed(0)}</b> · Richesse : <b>{view.wealth.toFixed(0)}</b></div>
          <button class="end" onclick={endTurn} disabled={view.over}>Fin du tour</button>
          {#if view.over}<div class="over">Partie terminée — Track Record : <b>{fmtPct(view.track.you - view.track.market)}</b> vs marché</div>{/if}
        </section>

        <section class="log">
          <h3>Journal</h3>
          {#each log as line}<div>{line}</div>{/each}
        </section>

        <section class="newgame">
          <input type="number" bind:value={seed} min="1" />
          <button onclick={() => newGame(seed)}>Nouvelle partie</button>
        </section>
      </aside>
    </div>
  {/if}
</main>

<style>
  :global(body) { margin: 0; background: #14161c; color: #cdd3df; font-family: system-ui, sans-serif; }
  main { max-width: 980px; margin: 0 auto; padding: 1rem; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #2a2f3a; padding-bottom: .5rem; }
  .title { font-size: 1.3rem; font-weight: 700; }
  .sub { color: #7a8294; font-weight: 400; font-size: .85rem; }
  .status { display: flex; gap: 1rem; font-size: .85rem; color: #9aa3b5; flex-wrap: wrap; }
  .status b { color: #e6ebf5; }
  b.crise, .neg { color: #e0564f; }
  .board { display: grid; grid-template-columns: 1fr 300px; gap: 1rem; margin-top: 1rem; }
  .map { width: 100%; background: #0e1015; border-radius: 8px; }
  .hex { cursor: pointer; }
  .hex polygon { stroke: #0e1015; stroke-width: 2; }
  .hex.owned polygon { stroke: #e8b54a; stroke-width: 3.5; }
  .hex.openable polygon { stroke: #6fae8f; stroke-width: 3; stroke-dasharray: 5 3; }
  .hex.selected polygon { stroke: #fff; stroke-width: 3.5; }
  .hex.here polygon { stroke: #f0f3f9; }
  polygon.frontier { opacity: .45; stroke-dasharray: 4 3; }
  polygon.fog { fill: #181b22; stroke: #23272f; stroke-width: 2; }
  .fogq { fill: #3c424e; font-size: 18px; text-anchor: middle; pointer-events: none; }
  .token { fill: #f0f3f9; stroke: #14161c; stroke-width: 1.5; }
  .label { fill: #eef1f7; font-size: 11px; text-anchor: middle; pointer-events: none; }
  .vval { fill: #aeb6c6; font-size: 11px; text-anchor: middle; pointer-events: none; }
  .vval.up { fill: #46b277; } .vval.down { fill: #e0564f; }
  aside { display: flex; flex-direction: column; gap: .8rem; }
  section { background: #1a1d25; border: 1px solid #2a2f3a; border-radius: 8px; padding: .7rem; }
  h3 { margin: 0 0 .5rem; font-size: .9rem; display: flex; justify-content: space-between; align-items: baseline; }
  .hint, .pa { font-weight: 400; font-size: .72rem; color: #7a8294; }
  .chain { font-size: .76rem; color: #9aa3b5; margin-bottom: .4rem; }
  .bar-row { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: .5rem; font-size: .78rem; margin: .25rem 0; }
  .bar { background: #0e1015; border-radius: 3px; height: 10px; overflow: hidden; }
  .fill { background: linear-gradient(90deg, #3a7d5a, #d9a23a, #d9543a); height: 100%; }
  button { width: 100%; margin: .25rem 0; padding: .45rem; background: #2a3140; color: #e6ebf5; border: 1px solid #39414f; border-radius: 5px; cursor: pointer; font-size: .82rem; }
  button:hover:not(:disabled) { background: #333c4d; }
  button:disabled { opacity: .4; cursor: not-allowed; }
  button.end { background: #2f5d8a; border-color: #3b6ea0; margin-top: .5rem; }
  .sel { font-size: .82rem; margin-bottom: .3rem; display: flex; justify-content: space-between; align-items: center; }
  .qmark { width: auto; margin: 0; padding: 0 .45rem; border-radius: 50%; background: #2a3140; line-height: 1.4; }
  .court { font-size: .76rem; color: #aeb6c6; margin-bottom: .3rem; }
  .long { font-size: .76rem; color: #cdd3df; background: #0e1015; border-radius: 5px; padding: .45rem; margin-bottom: .4rem; line-height: 1.35; }
  .open-row { display: grid; grid-template-columns: auto 1fr 1fr 1fr; align-items: center; gap: .3rem; font-size: .78rem; }
  .open-row button { margin: .25rem 0; }
  .lire { width: auto; margin: 0; padding: .15rem .4rem; font-size: .72rem; }
  .small { font-size: .72rem; } .muted { color: #7a8294; }
  .cash { font-size: .78rem; color: #9aa3b5; margin: .4rem 0; }
  .over { font-size: .8rem; color: #e8b54a; margin-top: .5rem; }
  .log { font-size: .76rem; color: #9aa3b5; }
  .log div { padding: .1rem 0; border-bottom: 1px solid #22262f; }
  .newgame { display: flex; gap: .4rem; }
  .newgame input { width: 70px; background: #0e1015; color: #cdd3df; border: 1px solid #39414f; border-radius: 5px; padding: .3rem; }
  .newgame button { margin: 0; }
</style>
