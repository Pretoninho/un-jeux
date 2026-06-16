<script lang="ts">
  // NOYAU TACTIQUE — 2 pièces par camp, PA par pièce. Échecs + Divinity (esprit).
  // À ton tour : clique une de TES pièces pour la sélectionner, puis dépense ses PA —
  // bouger (1 PA/case) et/ou frapper une pièce adverse à portée. Joue tes deux pièces
  // dans l'ordre que tu veux, puis « Finir le tour ».
  //
  // La vue est AGNOSTIQUE À LA FORME : elle dessine une liste de tuiles {id, points, shape}
  // et délègue toute la logique au moteur (topologie pure). Deux plateaux interchangeables :
  // hexagonal (6 voisins) ou octogonal 4.8.8 (octogones + carrés-carrefours jouables).
  import { makeBoard } from './engine/board';
  import { makeOctaBoard } from './engine/octaboard';
  import {
    makeCombatState, reachable, moveUnit, attack, canAttack, defend, canDefend, endTurn, winner,
    unitAt, type CombatState,
  } from './engine/combat';
  import { makeUnit, ARCHETYPES } from './engine/pieces';
  import { axialToPixel, hexPointsPointy, octagonPoints, diamondPoints, genBounds } from './lib/layout';

  const RADIUS = 4;
  const OCTA_N = 5;
  const OCTA_FRAC = 0.15; // côté droit octogone (frac. de l'espacement) ; < OCTA_REGULAR → carrés plus gros
  const AP_PER_TURN = 4;
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };
  const NAMES: Record<string, string> = { alice: 'Alice', bob: 'Bob' };
  const KIND_NAME: Record<string, string> = { lourde: 'Lourde', tireur: 'Tireur' };

  type Shape = 'hex' | 'octa';
  interface Tile { id: string; cx: number; cy: number; points: string; small: boolean }
  interface Geo { map: CombatState['map']; corners: [string, string]; tiles: Tile[]; viewBox: string }

  // Construit la géométrie ET la topologie d'un plateau (le moteur ne lit que `map`).
  function buildBoard(shape: Shape): Geo {
    let map: CombatState['map'], corners: [string, string], tiles: Tile[];
    if (shape === 'octa') {
      const ob = makeOctaBoard(OCTA_N);
      map = ob.map; corners = ob.corners;
      tiles = ob.map.hexes.map((h) => {
        const L = ob.layout[h.id]!;
        return {
          id: h.id, cx: L.cx, cy: L.cy, small: L.shape === 'carre',
          points: L.shape === 'carre'
            ? diamondPoints(L.cx, L.cy, ob.spacing, OCTA_FRAC)
            : octagonPoints(L.cx, L.cy, ob.spacing, OCTA_FRAC),
        };
      });
    } else {
      const hb = makeBoard(RADIUS, 6, 0, 0);
      map = hb.map; corners = hb.corners;
      tiles = hb.map.hexes.map((h) => {
        const [cx, cy] = axialToPixel(h.coord!.q, h.coord!.r);
        return { id: h.id, cx, cy, small: false, points: hexPointsPointy(cx, cy, 30) };
      });
    }
    const b = genBounds(tiles.map((t) => [t.cx, t.cy] as [number, number]));
    return { map, corners, tiles, viewBox: `${b.minX.toFixed(1)} ${b.minY.toFixed(1)} ${b.w.toFixed(1)} ${b.h.toFixed(1)}` };
  }

  // Chaque camp aligne la paire polaire : une Lourde (mêlée-tank) + un Tireur (distance-verre).
  // 2ᵉ pièce sur un voisin « salle » (on évite de démarrer sur un carré-carrefour exigu).
  function initialFor(geo: Geo): CombatState {
    const [c0, c1] = geo.corners;
    const nbOf = (id: string) => geo.map.hexes.find((h) => h.id === id)!.neighbors;
    const roomNb = (id: string) => nbOf(id).find((x) => !x.startsWith('s:')) ?? nbOf(id)[0]!;
    return makeCombatState(geo.map, [
      makeUnit('a1', 'alice', c0, ARCHETYPES.lourde!, AP_PER_TURN),
      makeUnit('a2', 'alice', roomNb(c0), ARCHETYPES.tireur!, AP_PER_TURN),
      makeUnit('b1', 'bob', c1, ARCHETYPES.lourde!, AP_PER_TURN),
      makeUnit('b2', 'bob', roomNb(c1), ARCHETYPES.tireur!, AP_PER_TURN),
    ], 'alice');
  }

  const startGeo = buildBoard('hex'); // const ordinaire → pas de capture de $state à l'init
  let boardShape = $state<Shape>('hex');
  let geo = $state<Geo>(startGeo);
  let combat = $state<CombatState>(initialFor(startGeo));
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

  const canGuard = $derived(!!selected && !over && canDefend(combat, selected.id));

  function defendSelected() {
    if (!selected || !canDefend(combat, selected.id)) return;
    history = [...history, combat];
    combat = defend(combat, selected.id);
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
    combat = initialFor(geo);
    history = [];
    selectedId = 'a1';
  }

  function setShape(s: Shape) {
    boardShape = s;
    geo = buildBoard(s);
    restart();
  }
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
    <div class="shape">
      <button class:on={boardShape === 'hex'} onclick={() => setShape('hex')}>⬡ Hexagone</button>
      <button class:on={boardShape === 'octa'} onclick={() => setShape('octa')}>⯃ Octogone</button>
    </div>
    {#if !over && selected?.guard}
      <button class="defend" class:on={selected.guarding} onclick={defendSelected} disabled={!canGuard}>
        {selected.guarding ? '🛡 En garde' : `🛡 Défendre (${selected.guard.cost})`}
      </button>
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

  <svg viewBox={geo.viewBox} class="map">
    {#each geo.tiles as t (t.id)}
      {@const occ = unitAt(combat, t.id)}
      {@const d = reach.get(t.id)}
      {@const inReach = d !== undefined}
      {@const attackable = isAttackable(t.id)}
      {@const mine = !!occ && occ.owner === combat.active && !over}
      <g class="hex" class:reach={inReach} class:attackable class:mine role="button" tabindex="0"
         onclick={() => onHex(t.id)}
         onkeydown={(e) => e.key === 'Enter' && onHex(t.id)}>
        <polygon
          points={t.points}
          fill={inReach ? '#1f3340' : t.small ? '#10131a' : '#161a22'}
          stroke={attackable ? '#e0604a' : inReach ? '#5ab0a0' : t.small ? '#222734' : '#272c37'}
          stroke-width={attackable ? 3.5 : inReach ? 2.5 : 1.5} />
        {#if occ}
          {@const isSel = occ.id === selectedId && occ.owner === combat.active && !over}
          {@const frac = occ.hp / occ.maxHp}
          {@const r = t.small ? 9 : 12}
          {@const w = t.small ? 16 : 22}
          {@const by = t.small ? 9 : 12}
          <circle cx={t.cx} cy={t.cy - 3} {r} fill={COLORS[occ.owner]} stroke={isSel ? '#f0f3f9' : '#0e1015'} stroke-width={isSel ? 3 : 2} />
          <text x={t.cx} y={t.cy + 1} class="utxt">{occ.kind === 'lourde' ? 'L' : 'T'}</text>
          <!-- barre de PV (couleur = joueur, lettre = archétype) -->
          <rect x={t.cx - w / 2} y={t.cy + by} width={w} height="3.5" rx="1.5" fill="#0e1015" />
          <rect x={t.cx - w / 2} y={t.cy + by} width={w * frac} height="3.5" rx="1.5" fill={frac > 0.4 ? '#5ab0a0' : '#e0604a'} />
          <!-- PA restants (pièces du camp actif) -->
          {#if mine}<text x={t.cx + r + 2} y={t.cy - 6} class="apbadge">{occ.ap}</text>{/if}
          {#if occ.guarding}<text x={t.cx - r - 2} y={t.cy - 6} class="guardmark">🛡</text>{/if}
          {#if attackable}<text x={t.cx} y={t.cy - r - 3} class="atkmark">⚔</text>{/if}
        {:else if inReach}
          <text x={t.cx} y={t.cy + 4} class="dist">{d}</text>
        {/if}
      </g>
    {/each}
  </svg>

  <div class="hint muted small">
    {#if over}
      Clique <b>Revanche</b> ou change de plateau pour rejouer.
    {:else}
      Couleur = joueur. <b>L</b> = Lourde (mêlée, robuste, gros dégâts, portée 1) ·
      <b>T</b> = Tireur (distance, fragile, dégâts faibles, portée 4).
      Clique une de <b style="color:{COLORS[combat.active]}">tes pièces</b>, puis une case
      verte pour <b>bouger</b> ou une <b style="color:#e0604a">⚔ adverse à portée</b> pour <b>frapper</b>.
      La <b>Lourde</b> peut <b style="color:#aec6f0">🛡 Défendre (3 PA)</b> : dégâts subis réduits de moitié jusqu'à son prochain tour (au prix de son attaque). Le Tireur, lui, se protège par la distance.
      {#if boardShape === 'octa'}<b>Octogone 4.8.8</b> : les petits carrés sont des <b>carrefours</b> jouables — la diagonale passe par eux (2 pas). Pose ta Lourde dessus pour verrouiller 4 directions.{/if}
    {/if}
  </div>
</div>

<style>
  .combat { display: flex; flex-direction: column; gap: .7rem; }
  .topbar { display: flex; align-items: center; gap: 1rem; background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: .55rem .9rem; flex-wrap: wrap; }
  .turn { font-size: .9rem; color: #9aa3b5; }
  .turn b { color: #e6ebf5; font-size: 1.05rem; }
  .active { font-size: .85rem; color: #9aa3b5; border-left: 3px solid var(--c); padding-left: .55rem; display: flex; gap: .6rem; align-items: baseline; }
  .active b { color: #e6ebf5; }
  .ap { color: #9aa3b5; } .ap b { color: #ffd479; }
  .shape { margin-left: auto; display: flex; gap: .3rem; }
  .shape button { background: #1a2030; border: 1px solid #3a4555; color: #9aa3b5; border-radius: 5px; padding: .4rem .7rem; cursor: pointer; font-size: .8rem; }
  .shape button.on { border-color: #5a70b0; color: #cfe0ff; background: #20283a; }
  .defend { background: #1c2436; border: 1px solid #3f5a8a; color: #aec6f0; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
  .defend:hover:not(:disabled) { border-color: #6f90c8; }
  .defend.on { background: #243456; border-color: #6f90c8; color: #d6e6ff; font-weight: 600; }
  .defend:disabled { opacity: .4; cursor: not-allowed; }
  .undo { background: #2a2030; border: 1px solid #5a4055; color: #d0a0b0; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
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
  .guardmark { font-size: 11px; text-anchor: middle; pointer-events: none; }
  .atkmark { fill: #ff8a6a; font-size: 12px; text-anchor: middle; pointer-events: none; }
  .muted { color: #7a8294; }
  .small { font-size: .78rem; }
  .hint { padding: 0 .2rem; }
</style>
