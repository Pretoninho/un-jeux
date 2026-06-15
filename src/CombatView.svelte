<script lang="ts">
  // NOYAU TACTIQUE — 2 pièces par camp, PA par pièce. Échecs + Divinity (esprit).
  // À ton tour : clique une de TES pièces pour la sélectionner, puis dépense ses PA —
  // bouger (1 PA/case) et/ou frapper une pièce adverse adjacente (2 PA). Joue tes deux
  // pièces dans l'ordre que tu veux, puis « Finir le tour ».
  import { makeBoard } from './engine/board';
  import {
    makeCombatState, reachable, moveUnit, attack, canAttack, endTurn, winner,
    unitAt, type CombatState,
  } from './engine/combat';
  import { makeUnit, ARCHETYPES } from './engine/pieces';
  import { axialToPixel, hexPointsPointy, genBounds } from './lib/layout';

  const RADIUS = 4;
  const AP_PER_TURN = 4;
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };
  const NAMES: Record<string, string> = { alice: 'Alice', bob: 'Bob' };
  const KIND_NAME: Record<string, string> = { lourde: 'Lourde', tireur: 'Tireur' };

  const GEO = makeBoard(RADIUS, 6, 0, 0); // on ne garde que la géométrie
  const hexOf = (id: string) => GEO.map.hexes.find((h) => h.id === id)!;

  // Chaque camp aligne la paire polaire : une Lourde (mêlée-tank) + un Tireur (distance-verre).
  function initial(): CombatState {
    const [c0, c1] = GEO.corners;
    const n0 = hexOf(c0).neighbors[0]!;
    const n1 = hexOf(c1).neighbors[0]!;
    return makeCombatState(GEO.map, [
      makeUnit('a1', 'alice', c0, ARCHETYPES.lourde!, AP_PER_TURN),
      makeUnit('a2', 'alice', n0, ARCHETYPES.tireur!, AP_PER_TURN),
      makeUnit('b1', 'bob', c1, ARCHETYPES.lourde!, AP_PER_TURN),
      makeUnit('b2', 'bob', n1, ARCHETYPES.tireur!, AP_PER_TURN),
    ], 'alice');
  }

  let combat = $state<CombatState>(initial());
  let history = $state<CombatState[]>([]); // pile d'annulation (vidée au passage de main)
  let selectedId = $state<string>('a1');
  const acted = $derived(history.length > 0);

  const champ = $derived(winner(combat));
  const over = $derived(champ !== null);
  const selected = $derived(combat.units.find((u) => u.id === selectedId && u.owner === combat.active));
  const reach = $derived(over || !selected ? new Map<string, number>() : reachable(combat, selected.id, selected.ap));

  const isAttackable = (hexId: string) => {
    const t = unitAt(combat, hexId);
    return !!t && !!selected && t.owner !== combat.active && canAttack(combat, selected.id, t.id);
  };

  function selectDefault() {
    selectedId = combat.units.find((u) => u.owner === combat.active)?.id ?? '';
  }

  function onHex(hexId: string) {
    if (over) return;
    const occ = unitAt(combat, hexId);
    // Clic sur une de mes pièces → la sélectionner.
    if (occ && occ.owner === combat.active) { selectedId = occ.id; return; }
    if (!selected) return;
    // Clic sur un adverse à portée → l'attaquer avec la pièce sélectionnée.
    if (occ && occ.owner !== combat.active) {
      if (!canAttack(combat, selected.id, occ.id)) return;
      history = [...history, combat];
      combat = attack(combat, selected.id, occ.id);
      return;
    }
    // Clic sur une case atteignable → s'y déplacer.
    if (reach.has(hexId)) {
      history = [...history, combat];
      combat = moveUnit(combat, selected.id, hexId);
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
    selectDefault();
  }

  function restart() {
    combat = initial();
    history = [];
    selectedId = 'a1';
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
        {#if selected}<span class="ap"><b>{KIND_NAME[selected.kind]}</b> · portée {selected.range} · PA <b>{selected.ap}</b>/{AP_PER_TURN}</span>{/if}
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
      {@const mine = !!occ && occ.owner === combat.active && !over}
      <g class="hex" class:reach={inReach} class:attackable class:mine role="button" tabindex="0"
         onclick={() => onHex(h.id)}
         onkeydown={(e) => e.key === 'Enter' && onHex(h.id)}>
        <polygon
          points={hexPointsPointy(c[0], c[1], 30)}
          fill={inReach ? '#1f3340' : '#161a22'}
          stroke={attackable ? '#e0604a' : inReach ? '#5ab0a0' : '#272c37'}
          stroke-width={attackable ? 3.5 : inReach ? 2.5 : 1.5} />
        {#if occ}
          {@const isSel = occ.id === selectedId && occ.owner === combat.active && !over}
          {@const frac = occ.hp / occ.maxHp}
          <circle cx={c[0]} cy={c[1] - 3} r="12" fill={COLORS[occ.owner]} stroke={isSel ? '#f0f3f9' : '#0e1015'} stroke-width={isSel ? 3 : 2} />
          <text x={c[0]} y={c[1] + 1} class="utxt">{occ.kind === 'lourde' ? 'L' : 'T'}</text>
          <!-- barre de PV (couleur = joueur, lettre = archétype) -->
          <rect x={c[0] - 11} y={c[1] + 12} width="22" height="3.5" rx="1.5" fill="#0e1015" />
          <rect x={c[0] - 11} y={c[1] + 12} width={22 * frac} height="3.5" rx="1.5" fill={frac > 0.4 ? '#5ab0a0' : '#e0604a'} />
          <!-- PA restants (pièces du camp actif) -->
          {#if mine}<text x={c[0] + 13} y={c[1] - 9} class="apbadge">{occ.ap}</text>{/if}
          {#if attackable}<text x={c[0]} y={c[1] - 15} class="atkmark">⚔</text>{/if}
        {:else if inReach}
          <text x={c[0]} y={c[1] + 4} class="dist">{d}</text>
        {/if}
      </g>
    {/each}
  </svg>

  <div class="hint muted small">
    {#if over}
      Clique <b>Revanche</b> pour rejouer.
      Couleur = joueur. <b>L</b> = Lourde (mêlée, robuste, gros dégâts, portée 1) ·
      <b>T</b> = Tireur (distance, fragile, dégâts faibles, portée 4).
      Clique une de <b style="color:{COLORS[combat.active]}">tes pièces</b>, puis une case
      verte pour <b>bouger</b> ou une <b style="color:#e0604a">⚔ adverse à portée</b> pour <b>frapper</b>.
      Joue tes deux pièces, puis <b>Finir le tour</b>. <b>↩ Annuler</b> revient en arrière.
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
  .hex.reach, .hex.attackable, .hex.mine { cursor: pointer; }
  .hex.reach:hover polygon { stroke: #b9f5cf; stroke-width: 3.5; }
  .hex.attackable:hover polygon { stroke: #ff8a6a; stroke-width: 4; }
  .utxt { fill: #0e1015; font-size: 12px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .apbadge { fill: #ffd479; font-size: 9px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .dist { fill: #6fae9a; font-size: 11px; text-anchor: middle; pointer-events: none; }
  .atkmark { fill: #ff8a6a; font-size: 12px; text-anchor: middle; pointer-events: none; }
  .muted { color: #7a8294; }
  .small { font-size: .78rem; }
  .hint { padding: 0 .2rem; }
</style>
