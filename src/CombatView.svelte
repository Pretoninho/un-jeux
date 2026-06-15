<script lang="ts">
  // NOYAU TACTIQUE — déplacement + attaque, budget en points d'action (PA).
  // Petite arène (rayon 4), une pièce par camp aux deux bouts.
  // À ton tour : dépense tes PA — bouger (1 PA/case) et/ou frapper (2 PA, portée 1).
  import { makeBoard } from './engine/board';
  import {
    makeCombatState, reachable, moveUnit, attack, canAttack, endTurn, winner,
    unitAt, type CombatState, type AttackConfig,
  } from './engine/combat';
  import { axialToPixel, hexPointsPointy, genBounds } from './lib/layout';

  const RADIUS = 4;
  const AP_PER_TURN = 4;
  const MAX_HP = 10;
  const ATTACK: AttackConfig = { range: 1, cost: 2, damage: 4 };
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };
  const NAMES: Record<string, string> = { alice: 'Alice', bob: 'Bob' };

  const GEO = makeBoard(RADIUS, 6, 0, 0); // on ne garde que la géométrie

  function initial(): CombatState {
    return makeCombatState(GEO.map, [
      { id: 'a', owner: 'alice', hex: GEO.corners[0], hp: MAX_HP },
      { id: 'b', owner: 'bob', hex: GEO.corners[1], hp: MAX_HP },
    ], 'alice', AP_PER_TURN);
  }

  let combat = $state<CombatState>(initial());
  // Pile d'annulation : états AVANT chaque action de ce tour (vidée au passage de main).
  let history = $state<CombatState[]>([]);
  const acted = $derived(history.length > 0);

  const champ = $derived(winner(combat));
  const over = $derived(champ !== null);
  const activeUnit = $derived(combat.units.find((u) => u.owner === combat.active));
  const reach = $derived(over || !activeUnit ? new Map<string, number>() : reachable(combat, activeUnit.id, combat.ap));

  const isAttackable = (hexId: string) => {
    const t = unitAt(combat, hexId);
    return !!t && t.owner !== combat.active && canAttack(combat, t.id, ATTACK);
  };

  function onHex(hexId: string) {
    if (over) return;
    const target = unitAt(combat, hexId);
    if (target && target.owner !== combat.active) {
      if (!canAttack(combat, target.id, ATTACK)) return;
      history = [...history, combat];
      combat = attack(combat, target.id, ATTACK);
      return;
    }
    if (reach.has(hexId) && activeUnit) {
      history = [...history, combat];
      combat = moveUnit(combat, activeUnit.id, hexId);
    }
  }

  function undo() {
    if (history.length === 0) return;
    combat = history[history.length - 1]!;
    history = history.slice(0, -1);
  }

  function finishTurn() {
    if (over) return;
    combat = endTurn(combat, AP_PER_TURN);
    history = [];
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
    {#if !over}
      <div class="active" style="--c:{COLORS[combat.active]}">
        Au tour de <b>{NAMES[combat.active]}</b>
        <span class="ap">PA <b>{combat.ap}</b>/{AP_PER_TURN}</span>
      </div>
    {/if}
    <button class="undo" onclick={undo} disabled={!acted}>↩ Annuler</button>
    <button class="end-turn" onclick={finishTurn} disabled={over}>Finir le tour ⏩</button>
    <button class="restart" onclick={restart}>Recommencer</button>
  </div>

  {#if over}
    <div class="banner" style="--c:{COLORS[champ!]}">
      🏁 <b>{NAMES[champ!]}</b> remporte le duel.
      <button class="rematch" onclick={restart}>Revanche</button>
    </div>
  {/if}

  <svg {viewBox} class="map">
    {#each combat.map.hexes as h (h.id)}
      {@const c = centers[h.id]!}
      {@const occ = unitAt(combat, h.id)}
      {@const d = reach.get(h.id)}
      {@const inReach = d !== undefined}
      {@const attackable = isAttackable(h.id)}
      <g class="hex" class:reach={inReach} class:attackable role="button" tabindex="0"
         onclick={() => onHex(h.id)}
         onkeydown={(e) => e.key === 'Enter' && onHex(h.id)}>
        <polygon
          points={hexPointsPointy(c[0], c[1], 30)}
          fill={inReach ? '#1f3340' : '#161a22'}
          stroke={attackable ? '#e0604a' : inReach ? '#5ab0a0' : '#272c37'}
          stroke-width={attackable ? 3.5 : inReach ? 2.5 : 1.5} />
        {#if occ}
          {@const isActive = occ.owner === combat.active && !over}
          <circle cx={c[0]} cy={c[1] - 3} r="12" fill={COLORS[occ.owner]} stroke={isActive ? '#f0f3f9' : '#0e1015'} stroke-width={isActive ? 2.5 : 2} />
          <text x={c[0]} y={c[1] + 1} class="utxt">{NAMES[occ.owner]![0]}</text>
          <!-- barre de PV -->
          <rect x={c[0] - 11} y={c[1] + 12} width="22" height="3.5" rx="1.5" fill="#0e1015" />
          <rect x={c[0] - 11} y={c[1] + 12} width={22 * occ.hp / MAX_HP} height="3.5" rx="1.5" fill={occ.hp / MAX_HP > 0.4 ? '#5ab0a0' : '#e0604a'} />
          {#if attackable}<text x={c[0]} y={c[1] - 14} class="atkmark">⚔</text>{/if}
        {:else if inReach}
          <text x={c[0]} y={c[1] + 4} class="dist">{d}</text>
        {/if}
      </g>
    {/each}
  </svg>

  <div class="hint muted small">
    {#if over}
      Clique <b>Revanche</b> pour rejouer.
    {:else}
      Dépense tes <b>PA</b> : clique une case verte pour <b>bouger</b> (1 PA/case), une pièce
      <b style="color:#e0604a">⚔ adverse adjacente</b> pour <b>frapper</b> (2 PA). Tu peux
      <b>↩ Annuler</b> tant que le tour n'est pas fini.
    {/if}
  </div>
</div>

<style>
  .combat { display: flex; flex-direction: column; gap: .7rem; }
  .topbar { display: flex; align-items: center; gap: 1rem; background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: .55rem .9rem; }
  .turn { font-size: .9rem; color: #9aa3b5; }
  .turn b { color: #e6ebf5; font-size: 1.05rem; }
  .active { font-size: .85rem; color: #9aa3b5; border-left: 3px solid var(--c); padding-left: .55rem; display: flex; gap: .6rem; align-items: baseline; }
  .active b { color: #e6ebf5; }
  .ap { color: #9aa3b5; } .ap b { color: #ffd479; }
  .undo { margin-left: auto; background: #2a2030; border: 1px solid #5a4055; color: #d0a0b0; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
  .undo:hover:not(:disabled) { border-color: #8a6075; }
  .undo:disabled { opacity: .35; cursor: not-allowed; }
  .end-turn { background: #1a2030; border: 1px solid #3a4060; color: #9ab0d0; border-radius: 5px; padding: .45rem .9rem; cursor: pointer; font-weight: 600; font-size: .88rem; }
  .end-turn:hover:not(:disabled) { border-color: #5a70b0; }
  .end-turn:disabled { opacity: .4; cursor: not-allowed; }
  .restart { background: #1a2030; border: 1px solid #3a4555; color: #9aa3b5; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
  .banner { background: #1e2435; border: 1px solid var(--c); border-radius: 8px; padding: .6rem 1rem; display: flex; align-items: center; gap: 1rem; }
  .banner b { color: var(--c); }
  .rematch { margin-left: auto; background: #1a2030; border: 1px solid var(--c); color: #e6ebf5; border-radius: 5px; padding: .35rem .8rem; cursor: pointer; }
  .map { width: 100%; background: #0f1117; border: 1px solid #2a2f3a; border-radius: 8px; }
  .hex { cursor: default; }
  .hex.reach, .hex.attackable { cursor: pointer; }
  .hex.reach:hover polygon { stroke: #b9f5cf; stroke-width: 3.5; }
  .hex.attackable:hover polygon { stroke: #ff8a6a; stroke-width: 4; }
  .utxt { fill: #0e1015; font-size: 12px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .dist { fill: #6fae9a; font-size: 11px; text-anchor: middle; pointer-events: none; }
  .atkmark { fill: #ff8a6a; font-size: 12px; text-anchor: middle; pointer-events: none; }
  .muted { color: #7a8294; }
  .small { font-size: .78rem; }
  .hint { padding: 0 .2rem; }
</style>
