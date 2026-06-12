<script lang="ts">
  // Vue principale (J5). Le moteur (src/engine) est inchangé : le joueur humain est
  // une Policy alimentée par l'UI. F reste cachée — on n'affiche que les signaux.
  import { buildInitialState } from './engine/init';
  import { runTurn } from './engine/turn';
  import { policyForProfile } from './engine/ai';
  import { computeSignals } from './engine/signals';
  import { actorWealth } from './engine/portfolio';
  import { trackRecord } from './engine/score';
  import { makeRng, type Rng } from './engine/rng';
  import type { GameState, SignalReading } from './engine/state';
  import type { Hex } from './engine/types';
  import type { Policy, PlannedAction } from './engine/policy';
  import { PA_PAR_TOUR } from './data/actions';
  import { presetMvp } from './data/config-mvp';
  import { HEX_POS, hexPoints, hexFill, MAP_W, MAP_H, HEX_R } from './lib/layout';

  // État non réactif (le moteur) ; l'UI lit des snapshots réactifs.
  let gs: GameState;
  let rng: Rng;
  let ai: Policy[];

  let queued = $state<PlannedAction[]>([]);
  let seed = $state(1);
  let selected = $state<string | null>(null);
  let hexes = $state<Hex[]>([]);
  let log = $state<string[]>([]);
  let view = $state<ReturnType<typeof buildView>>();

  const paCost = (a: PlannedAction) => (a.verb === 'RESERVER' ? 0 : 1);
  const fmtPct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;

  function buildView() {
    const player = gs.actors[0]!;
    const wealth = actorWealth(player, gs.market);
    const tr = trackRecord(player, gs.benchmarkHistory, gs.params.drawdownPenalty);
    const sig: SignalReading = gs.signalsHistory.at(-1) ?? computeSignals(gs, makeRng(gs.rngSeed));
    const market: Record<string, number> = {};
    for (const [id, m] of Object.entries(gs.market)) market[id] = m.V;
    return {
      turn: gs.turn,
      horizon: gs.params.horizonTurns,
      regime: gs.regime,
      cash: player.cash,
      wealth,
      positions: new Set(player.positions.map((p) => p.hexId)),
      market,
      signals: sig,
      track: {
        you: wealth / 100 - 1,
        market: (gs.benchmarkHistory.at(-1) ?? 1) - 1,
        drawdown: tr.maxDrawdown,
      },
      paUsed: queued.reduce((a, act) => a + paCost(act), 0),
      over: gs.turn >= gs.params.horizonTurns,
    };
  }

  function newGame(s: number) {
    const cfg = presetMvp(s);
    const init = buildInitialState(cfg);
    gs = init.state;
    rng = init.rng;
    ai = cfg.adversaires.map(policyForProfile);
    queued = [];
    hexes = gs.map.hexes;
    selected = null;
    log = [`Nouvelle partie — seed ${s}`];
    view = buildView();
  }

  const paLeft = () => PA_PAR_TOUR - (view?.paUsed ?? 0);

  function queueAction(a: PlannedAction) {
    if (!view || view.over || paCost(a) > paLeft()) return;
    queued.push(a);
    view = buildView();
  }

  function open(hexId: string) {
    queueAction({ verb: 'POSITIONNER', op: 'ouvrir', hexId, equity: gs.actors[0]!.cash * 0.25, leverage: 0 });
  }
  function close(hexId: string) {
    queueAction({ verb: 'POSITIONNER', op: 'fermer', hexId });
  }

  function endTurn() {
    if (!view || view.over) return;
    const human: Policy = { id: 'human', decide: () => (queued.length ? queued : [{ verb: 'RESERVER' }]) };
    runTurn(gs, [human, ...ai], rng);
    queued = [];
    log = [`Tour ${gs.turn} · ${gs.regime}`, ...log].slice(0, 8);
    view = buildView();
  }

  function isInvestable(h: Hex) {
    return h.kind === 'marche';
  }

  newGame(1); // seed initial (le champ « Nouvelle partie » permet d'en changer)
</script>

<main>
  <header>
    <div class="title">un-jeux <span class="sub">· Vautour</span></div>
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
      <!-- CARTE -->
      <svg viewBox="0 0 {MAP_W} {MAP_H}" class="map">
        {#each hexes as h (h.id)}
          {@const pos = HEX_POS[h.id]}
          {#if pos}
            <g
              class="hex"
              class:selected={selected === h.id}
              class:owned={view.positions.has(h.id)}
              role="button"
              tabindex="0"
              onclick={() => (selected = h.id)}
              onkeydown={(e) => e.key === 'Enter' && (selected = h.id)}
            >
              <polygon
                points={hexPoints(pos[0], pos[1])}
                fill={hexFill(h.kind, h.cluster)}
                class:frontier={h.kind === 'frontiere'}
              />
              <text x={pos[0]} y={pos[1] - 6} class="label">{h.label}</text>
              {#if isInvestable(h)}
                <text x={pos[0]} y={pos[1] + 12} class="vval">{view.market[h.id]?.toFixed(0)}</text>
              {/if}
            </g>
          {/if}
        {/each}
      </svg>

      <!-- PANNEAU -->
      <aside>
        <section class="signals">
          <h3>Signaux <span class="hint">~ bruités, F cachée</span></h3>
          {#each [['Volatilité', view.signals.volatilite], ['Écart crédit', view.signals.ecartCredit], ['Financement', view.signals.financement]] as [name, val]}
            <div class="bar-row">
              <span>{name}</span>
              <div class="bar"><div class="fill" style="width:{(val as number) * 100}%"></div></div>
            </div>
          {/each}
        </section>

        <section class="actions">
          <h3>Actions <span class="pa">{paLeft()} / {PA_PAR_TOUR} PA</span></h3>
          {#if selected}
            {@const h = hexes.find((x) => x.id === selected)}
            <div class="sel">Sélection : <b>{h?.label}</b></div>
            <button onclick={() => open(selected!)} disabled={view.over || paLeft() < 1 || !!h && !isInvestable(h)}>
              Ouvrir (déployer 25%) · 1 PA
            </button>
            <button onclick={() => close(selected!)} disabled={view.over || paLeft() < 1 || !view.positions.has(selected!)}>
              Fermer · 1 PA
            </button>
          {:else}
            <div class="sel muted">Clique un hexe.</div>
          {/if}
          <div class="cash">Réserve : <b>{view.cash.toFixed(0)}</b> · Richesse : <b>{view.wealth.toFixed(0)}</b></div>
          <button class="end" onclick={endTurn} disabled={view.over}>
            {queued.length ? `Valider le tour (${queued.length})` : 'Réserver & passer'}
          </button>
          {#if view.over}<div class="over">Partie terminée — Track Record final : <b>{fmtPct(view.track.you - view.track.market)}</b> vs marché</div>{/if}
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
  .sub { color: #7a8294; font-weight: 400; font-size: .9rem; }
  .status { display: flex; gap: 1rem; font-size: .85rem; color: #9aa3b5; flex-wrap: wrap; }
  .status b { color: #e6ebf5; }
  b.crise { color: #e0564f; }
  .neg { color: #e0564f; }
  .board { display: grid; grid-template-columns: 1fr 300px; gap: 1rem; margin-top: 1rem; }
  .map { width: 100%; background: #0e1015; border-radius: 8px; }
  .hex { cursor: pointer; }
  .hex polygon { stroke: #0e1015; stroke-width: 2; transition: stroke .1s; }
  .hex.owned polygon { stroke: #e8b54a; stroke-width: 3.5; }
  .hex.selected polygon { stroke: #fff; stroke-width: 3.5; }
  polygon.frontier { opacity: .45; stroke-dasharray: 4 3; }
  .label { fill: #eef1f7; font-size: 11px; text-anchor: middle; pointer-events: none; }
  .vval { fill: #aeb6c6; font-size: 11px; text-anchor: middle; pointer-events: none; }
  aside { display: flex; flex-direction: column; gap: .8rem; }
  section { background: #1a1d25; border: 1px solid #2a2f3a; border-radius: 8px; padding: .7rem; }
  h3 { margin: 0 0 .5rem; font-size: .9rem; display: flex; justify-content: space-between; align-items: baseline; }
  .hint, .pa { font-weight: 400; font-size: .72rem; color: #7a8294; }
  .bar-row { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: .5rem; font-size: .78rem; margin: .25rem 0; }
  .bar { background: #0e1015; border-radius: 3px; height: 10px; overflow: hidden; }
  .fill { background: linear-gradient(90deg, #3a7d5a, #d9a23a, #d9543a); height: 100%; }
  button { width: 100%; margin: .25rem 0; padding: .45rem; background: #2a3140; color: #e6ebf5; border: 1px solid #39414f; border-radius: 5px; cursor: pointer; font-size: .82rem; }
  button:hover:not(:disabled) { background: #333c4d; }
  button:disabled { opacity: .4; cursor: not-allowed; }
  button.end { background: #2f5d8a; border-color: #3b6ea0; margin-top: .5rem; }
  .sel { font-size: .82rem; margin-bottom: .4rem; }
  .muted { color: #7a8294; }
  .cash { font-size: .78rem; color: #9aa3b5; margin: .4rem 0; }
  .over { font-size: .8rem; color: #e8b54a; margin-top: .5rem; }
  .log { font-size: .76rem; color: #9aa3b5; }
  .log div { padding: .1rem 0; border-bottom: 1px solid #22262f; }
  .newgame { display: flex; gap: .4rem; }
  .newgame input { width: 70px; background: #0e1015; color: #cdd3df; border: 1px solid #39414f; border-radius: 5px; padding: .3rem; }
  .newgame button { margin: 0; }
</style>
