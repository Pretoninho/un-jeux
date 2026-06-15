<script lang="ts">
  // NOYAU TACTIQUE — étape 0, brique DÉPLACEMENT (combat à venir par-dessus).
  // Petite arène (rayon 4), une pièce par camp aux deux bouts, 3 cases/tour.
  // À ton tour : clique une case en surbrillance pour t'y déplacer, puis « Finir le tour ».
  import { makeBoard } from './engine/board';
  import {
    makeCombatState, reachable, moveUnit, endTurn, unitAt, unitById, type CombatState,
  } from './engine/combat';
  import { axialToPixel, hexPointsPointy, genBounds } from './lib/layout';

  const RADIUS = 4;     // petite arène lisible (~61 cases, 8 de bout en bout)
  const MOVE = 3;       // allure modérée → rencontre en ~2 tours
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };
  const NAMES: Record<string, string> = { alice: 'Alice', bob: 'Bob' };

  const GEO = makeBoard(RADIUS, 6, 0, 0); // on ne garde que la géométrie (coords + voisins)

  function initial(): CombatState {
    return makeCombatState(GEO.map, [
      { id: 'a', owner: 'alice', hex: GEO.corners[0] },
      { id: 'b', owner: 'bob', hex: GEO.corners[1] },
    ], 'alice');
  }

  let combat = $state<CombatState>(initial());
  // Pile d'annulation : états AVANT chaque action de ce tour (vidée au passage de main).
  let history = $state<CombatState[]>([]);
  const acted = $derived(history.length > 0);

  const activeUnit = $derived(combat.units.find((u) => u.owner === combat.active)!);
  const reach = $derived(acted ? new Map<string, number>() : reachable(combat, activeUnit.id, MOVE));

  function onHex(hexId: string) {
    if (acted || !reach.has(hexId)) return;
    history = [...history, combat]; // mémorise avant d'agir → annulable
    combat = moveUnit(combat, activeUnit.id, hexId, MOVE);
  }

  function undo() {
    if (history.length === 0) return;
    combat = history[history.length - 1]!; // restaure l'état d'avant la dernière action
    history = history.slice(0, -1);
  }

  function finishTurn() {
    combat = endTurn(combat);
    history = []; // l'annulation ne traverse pas les tours : finir le tour VALIDE
  }

  function restart() {
    combat = initial();
    history = [];
  }

  // ── Layout pixel (géométrie fixe) ──────────────────────────────────────────────
  const centers: Record<string, [number, number]> = {};
  for (const h of GEO.map.hexes) centers[h.id] = axialToPixel(h.coord!.q, h.coord!.r);
  const bnds = genBounds(Object.values(centers));
  const viewBox = `${bnds.minX.toFixed(1)} ${bnds.minY.toFixed(1)} ${bnds.w.toFixed(1)} ${bnds.h.toFixed(1)}`;
</script>

<div class="combat">
  <div class="topbar">
    <div class="turn">Tour <b>{combat.turn}</b></div>
    <div class="active" style="--c:{COLORS[combat.active]}">
      Au tour de <b>{NAMES[combat.active]}</b>
      <span class="muted small">{acted ? '· déplacement fait' : `· ${MOVE} cases`}</span>
    </div>
    <button class="undo" onclick={undo} disabled={!acted}>↩ Annuler</button>
    <button class="end-turn" onclick={finishTurn}>Finir le tour ⏩</button>
    <button class="restart" onclick={restart}>Recommencer</button>
  </div>

  <svg {viewBox} class="map">
    {#each combat.map.hexes as h (h.id)}
      {@const c = centers[h.id]!}
      {@const occ = unitAt(combat, h.id)}
      {@const d = reach.get(h.id)}
      {@const inReach = d !== undefined}
      <g class="hex" class:reach={inReach} role="button" tabindex="0"
         onclick={() => onHex(h.id)}
         onkeydown={(e) => e.key === 'Enter' && onHex(h.id)}>
        <polygon
          points={hexPointsPointy(c[0], c[1], 30)}
          fill={inReach ? '#1f3340' : '#161a22'}
          stroke={inReach ? '#5ab0a0' : '#272c37'}
          stroke-width={inReach ? 2.5 : 1.5} />
        {#if occ}
          <circle cx={c[0]} cy={c[1]} r="13" fill={COLORS[occ.owner]} stroke="#0e1015" stroke-width="2"
                  class:current={occ.id === activeUnit.id} />
          <text x={c[0]} y={c[1] + 4} class="utxt">{NAMES[occ.owner]![0]}</text>
        {:else if inReach}
          <text x={c[0]} y={c[1] + 4} class="dist">{d}</text>
        {/if}
      </g>
    {/each}
  </svg>

  <div class="hint muted small">
    Clique une case en surbrillance pour déplacer <b style="color:{COLORS[combat.active]}">{NAMES[combat.active]}</b>
    (jusqu'à {MOVE} cases, les pièces bloquent le passage), puis <b>Finir le tour</b>.
    Tu peux <b>↩ Annuler</b> tant que le tour n'est pas fini.
  </div>
</div>

<style>
  .combat { display: flex; flex-direction: column; gap: .7rem; }
  .topbar { display: flex; align-items: center; gap: 1rem; background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: .55rem .9rem; }
  .turn { font-size: .9rem; color: #9aa3b5; }
  .turn b { color: #e6ebf5; font-size: 1.05rem; }
  .active { font-size: .85rem; color: #9aa3b5; border-left: 3px solid var(--c); padding-left: .55rem; }
  .active b { color: #e6ebf5; }
  .undo { margin-left: auto; background: #2a2030; border: 1px solid #5a4055; color: #d0a0b0; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
  .undo:hover:not(:disabled) { border-color: #8a6075; }
  .undo:disabled { opacity: .35; cursor: not-allowed; }
  .end-turn { background: #1a2030; border: 1px solid #3a4060; color: #9ab0d0; border-radius: 5px; padding: .45rem .9rem; cursor: pointer; font-weight: 600; font-size: .88rem; }
  .end-turn:hover { border-color: #5a70b0; }
  .restart { background: #1a2030; border: 1px solid #3a4555; color: #9aa3b5; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
  .map { width: 100%; background: #0f1117; border: 1px solid #2a2f3a; border-radius: 8px; }
  .hex { cursor: default; }
  .hex.reach { cursor: pointer; }
  .hex.reach:hover polygon { stroke: #b9f5cf; stroke-width: 3.5; }
  circle.current { stroke: #f0f3f9; stroke-width: 2.5; }
  .utxt { fill: #0e1015; font-size: 13px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .dist { fill: #6fae9a; font-size: 11px; text-anchor: middle; pointer-events: none; }
  .muted { color: #7a8294; }
  .small { font-size: .78rem; }
  .hint { padding: 0 .2rem; }
</style>
