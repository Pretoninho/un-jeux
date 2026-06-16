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
    makeCombatState, reachable, moveUnit, attack, canAttack, defend, canDefend,
    reserve, canReserve, resolveOverwatch, endTurn, winner,
    unitAt, type CombatState,
  } from './engine/combat';
  import { makeUnit, ARCHETYPES } from './engine/pieces';
  import { axialToPixel, hexPointsPointy, octagonPoints, diamondPoints, genBounds } from './lib/layout';

  const RADIUS = 4;
  const OCTA_N = 19;
  const OCTA_FRAC = 0.15; // côté droit octogone (frac. de l'espacement) ; < OCTA_REGULAR → carrés plus gros
  const AP_PER_TURN = 4;
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };
  const NAMES: Record<string, string> = { alice: 'Alice', bob: 'Bob' };
  const KIND_NAME: Record<string, string> = { lourde: 'Lourde', tireur: 'Tireur' };

  type Shape = 'hex' | 'octa';
  interface Tile { id: string; cx: number; cy: number; points: string; small: boolean }
  interface Geo { map: CombatState['map']; corners: [string, string]; tiles: Tile[]; bounds: { x: number; y: number; w: number; h: number } }

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
    return { map, corners, tiles, bounds: { x: b.minX, y: b.minY, w: b.w, h: b.h } };
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
  let inspectedId = $state<string>('');   // pièce adverse inspectée (panneau adverse + sa portée)
  const acted = $derived(history.length > 0);

  // ── Navigation de la carte (zoom + pan) — pur SVG via le viewBox, sans dépendance ──
  const MAXZOOM = 8;
  let svgEl: SVGSVGElement | undefined;
  let view = $state({ ...startGeo.bounds }); // fenêtre visible (x, y, w, h)
  function resetView() { view = { ...geo.bounds }; }

  // Taille à l'écran : aussi grande que possible, bornée par la hauteur du
  // navigateur (≈ 82vh) et la largeur dispo, en respectant le ratio du plateau.
  const mapStyle = $derived(
    `aspect-ratio:${geo.bounds.w} / ${geo.bounds.h};` +
    `width:min(100%, ${((geo.bounds.w / geo.bounds.h) * 88).toFixed(1)}vh)`,
  );

  // Garde la fenêtre à l'intérieur du plateau (jamais de vide hors-carte).
  function clampPan(x: number, y: number, w: number, h: number) {
    const nx = Math.min(geo.bounds.x + geo.bounds.w - w, Math.max(geo.bounds.x, x));
    const ny = Math.min(geo.bounds.y + geo.bounds.h - h, Math.max(geo.bounds.y, y));
    return { nx, ny };
  }
  // Zoom centré sur un point écran : le point sous le curseur reste fixe.
  function zoomAt(clientX: number, clientY: number, factor: number) {
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    const px = view.x + fx * view.w, py = view.y + fy * view.h;
    const zoom = geo.bounds.w / view.w;
    const nz = Math.min(MAXZOOM, Math.max(1, zoom * factor));
    const nw = geo.bounds.w / nz, nh = geo.bounds.h / nz;
    const { nx, ny } = clampPan(px - fx * nw, py - fy * nh, nw, nh);
    view = { x: nx, y: ny, w: nw, h: nh };
  }
  function zoomCenter(factor: number) {
    if (!svgEl) return;
    const r = svgEl.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
  }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.pow(1.0015, -e.deltaY));
  }

  // Pan au glisser : on ne capture le pointeur qu'au-delà d'un seuil → un clic simple
  // passe normalement à la tuile (onHex) ; un vrai glissé déplace la carte et annule le clic.
  let dragging = false, dragMoved = false, lastX = 0, lastY = 0, startX = 0, startY = 0, pointerId = -1;
  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    dragging = true; dragMoved = false;
    lastX = startX = e.clientX; lastY = startY = e.clientY; pointerId = e.pointerId;
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging || !svgEl) return;
    if (!dragMoved && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
    if (!dragMoved) { dragMoved = true; try { svgEl.setPointerCapture(pointerId); } catch { /* noop */ } }
    const rect = svgEl.getBoundingClientRect();
    const dx = (e.clientX - lastX) * (view.w / rect.width);
    const dy = (e.clientY - lastY) * (view.h / rect.height);
    lastX = e.clientX; lastY = e.clientY;
    const { nx, ny } = clampPan(view.x - dx, view.y - dy, view.w, view.h);
    view = { ...view, x: nx, y: ny };
  }
  function onPointerUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    if (svgEl) try { svgEl.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }

  const champ = $derived(winner(combat));
  const over = $derived(champ !== null);
  const selected = $derived(combat.units.find((u) => u.id === selectedId && u.owner === combat.active));
  const reach = $derived(over || !selected ? new Map<string, number>() : reachable(combat, selected.id, selected.ap));

  const isAttackable = (hexId: string) => {
    const t = unitAt(combat, hexId);
    return !!t && !!selected && t.owner !== combat.active && canAttack(combat, selected.id, t.id);
  };

  // Pièce adverse inspectée (clic sur une pièce ennemie) — alimente le panneau adverse.
  const foe = $derived(combat.units.find((u) => u.id === inspectedId && u.owner !== combat.active));
  const canHitFoe = $derived(!!selected && !!foe && !over && canAttack(combat, selected.id, foe.id));
  const attackBlock = $derived.by(() => {
    if (!foe || over) return '';
    if (!selected) return 'Sélectionne une de tes pièces.';
    if (canHitFoe) return '';
    if (selected.ap < selected.attackCost) return 'PA insuffisants.';
    return 'Hors de portée.';
  });

  // BFS de portée (distance de graphe pure, occupation ignorée) — une passe par pièce.
  function rangeSet(from: string, range: number): Set<string> {
    const byId = new Map(combat.map.hexes.map((h) => [h.id, h] as const));
    const seen = new Set<string>([from]);
    let frontier = [from];
    for (let d = 1; d <= range; d++) {
      const next: string[] = [];
      for (const h of frontier)
        for (const nb of byId.get(h)?.neighbors ?? [])
          if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
      frontier = next;
    }
    seen.delete(from);
    return seen;
  }

  // Portées d'attaque affichées : la tienne (sélection) et celle de l'adverse inspecté.
  const allyRange = $derived(selected && !over ? rangeSet(selected.hex, selected.range) : new Set<string>());
  const foeRange = $derived(foe && !over ? rangeSet(foe.hex, foe.range) : new Set<string>());

  function attackFoe() {
    if (!selected || !foe || !canAttack(combat, selected.id, foe.id)) return;
    history = [...history, combat];
    combat = attack(combat, selected.id, foe.id);
  }

  function selectDefault() {
    selectedId = combat.units.find((u) => u.owner === combat.active)?.id ?? '';
  }

  function onHex(hexId: string) {
    if (dragMoved) { dragMoved = false; return; } // glissé en cours → on n'interprète pas le clic
    if (over) return;
    const occ = unitAt(combat, hexId);
    // Clic sur une de mes pièces → la sélectionner.
    if (occ && occ.owner === combat.active) { selectedId = occ.id; return; }
    // Clic sur une pièce adverse → l'inspecter (panneau adverse + sa portée) ; l'attaque
    // se déclenche ensuite via le bouton ⚔ Attaquer du panneau.
    if (occ && occ.owner !== combat.active) { inspectedId = occ.id; return; }
    if (!selected) return;
    // Clic sur une case atteignable → s'y déplacer (puis tirs réflexes des guetteurs adverses).
    if (reach.has(hexId)) {
      history = [...history, combat];
      combat = resolveOverwatch(moveUnit(combat, selected.id, hexId), selected.id);
    }
  }

  const canGuard = $derived(!!selected && !over && canDefend(combat, selected.id));
  const canWatch = $derived(!!selected && !over && canReserve(combat, selected.id));

  // Cases sous le feu d'un guetteur ADVERSE (zone de menace affichée pendant ton tour).
  const threat = $derived.by(() => {
    const set = new Set<string>();
    if (over) return set;
    for (const w of combat.units) {
      if (!w.watching || w.owner === combat.active) continue;
      for (const id of rangeSet(w.hex, w.range)) set.add(id);
      set.add(w.hex);
    }
    return set;
  });

  function defendSelected() {
    if (!selected || !canDefend(combat, selected.id)) return;
    history = [...history, combat];
    combat = defend(combat, selected.id);
  }

  function reserveSelected() {
    if (!selected || !canReserve(combat, selected.id)) return;
    history = [...history, combat];
    combat = reserve(combat, selected.id);
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
    inspectedId = '';
    selectDefault();
  }

  function restart() {
    combat = initialFor(geo);
    history = [];
    selectedId = 'a1';
    inspectedId = '';
  }

  function setShape(s: Shape) {
    boardShape = s;
    geo = buildBoard(s);
    resetView();
    restart();
  }
</script>

<div class="combat">
  <div class="topbar">
    <div class="turn">Tour <b>{combat.turn}</b></div>
    {#if !over}
      <div class="active" style="--c:{COLORS[combat.active]}">
        Au tour de <b>{NAMES[combat.active]}</b>
      </div>
    {/if}
    <div class="shape">
      <button class:on={boardShape === 'hex'} onclick={() => setShape('hex')}>⬡ Hexagone</button>
      <button class:on={boardShape === 'octa'} onclick={() => setShape('octa')}>⯃ Octogone</button>
    </div>
    <div class="zoom">
      <button onclick={() => zoomCenter(1 / 1.3)} title="Dézoomer" aria-label="Dézoomer">−</button>
      <button onclick={() => zoomCenter(1.3)} title="Zoomer" aria-label="Zoomer">+</button>
      <button onclick={resetView} title="Ajuster à l'écran" aria-label="Ajuster à l'écran">⤢</button>
    </div>
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

  <svg bind:this={svgEl} viewBox="{view.x} {view.y} {view.w} {view.h}" class="map" style={mapStyle}
       role="application" aria-label="Plateau de jeu — molette pour zoomer, glisser pour déplacer"
       onwheel={onWheel} onpointerdown={onPointerDown} onpointermove={onPointerMove}
       onpointerup={onPointerUp} onpointercancel={onPointerUp}>
    {#each geo.tiles as t (t.id)}
      {@const occ = unitAt(combat, t.id)}
      {@const d = reach.get(t.id)}
      {@const inReach = d !== undefined}
      {@const attackable = isAttackable(t.id)}
      {@const threatened = threat.has(t.id)}
      {@const mine = !!occ && occ.owner === combat.active && !over}
      {@const inAlly = allyRange.has(t.id)}
      {@const inFoe = foeRange.has(t.id)}
      <g class="hex" class:reach={inReach} class:attackable class:mine role="button" tabindex="0"
         onclick={() => onHex(t.id)}
         onkeydown={(e) => e.key === 'Enter' && onHex(t.id)}>
        <polygon
          points={t.points}
          fill={inReach ? '#1f3340' : threatened ? '#2a1a1e' : t.small ? '#10131a' : '#161a22'}
          stroke={attackable ? '#e0604a' : inReach ? '#5ab0a0' : threatened ? '#7a3c44' : t.small ? '#222734' : '#272c37'}
          stroke-width={attackable ? 3.5 : inReach ? 2.5 : threatened ? 2 : 1.5} />
        {#if inAlly}<polygon points={t.points} class="rng-ally" />{/if}
        {#if inFoe}<polygon points={t.points} class="rng-foe" />{/if}
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
          {#if occ.watching}<text x={t.cx - r - 2} y={t.cy - 6} class="guardmark">🎯</text>{/if}
        {:else if inReach}
          <text x={t.cx} y={t.cy + 4} class="dist">{d}</text>
        {/if}
      </g>
    {/each}
  </svg>

  {#if !over}
    <div class="panels">
      <div class="panel ally" style="--c:{COLORS[combat.active]}">
        {#if selected}
          <div class="phead"><span class="pdot"></span>{KIND_NAME[selected.kind]} <span class="powner">· {NAMES[selected.owner]}</span></div>
          <div class="pv">PV <b>{selected.hp}/{selected.maxHp}</b>
            <span class="bar"><span style="width:{Math.max(0, 100 * selected.hp / selected.maxHp)}%; background:{selected.hp / selected.maxHp > 0.4 ? '#5ab0a0' : '#e0604a'}"></span></span>
          </div>
          <div class="pstats"><span>PA <b>{selected.ap}</b>/{AP_PER_TURN}</span><span>Portée <b>{selected.range}</b></span><span>Dégâts <b>{selected.damage}</b></span></div>
          {#if selected.guarding || selected.watching}
            <div class="ptags">{#if selected.guarding}<span class="tag g">🛡 En garde</span>{/if}{#if selected.watching}<span class="tag w">🎯 Tir réservé</span>{/if}</div>
          {/if}
          <div class="pacts">
            {#if selected.guard}
              <button class="defend" class:on={selected.guarding} onclick={defendSelected} disabled={!canGuard}>
                {selected.guarding ? '🛡 En garde' : `🛡 Défendre (${selected.guard.cost})`}
              </button>
            {/if}
            {#if selected.overwatch}
              <button class="watch" class:on={selected.watching} onclick={reserveSelected} disabled={!canWatch}>
                {selected.watching ? '🎯 Tir réservé' : `🎯 Réserver (${selected.overwatch.cost})`}
              </button>
            {/if}
          </div>
        {:else}
          <div class="pempty">Clique une de <b style="color:{COLORS[combat.active]}">tes pièces</b> pour la sélectionner.</div>
        {/if}
      </div>

      <div class="panel foe" style="--c:{foe ? COLORS[foe.owner] : '#3a4150'}">
        {#if foe}
          <div class="phead"><span class="pdot"></span>{KIND_NAME[foe.kind]} <span class="powner">· {NAMES[foe.owner]}</span></div>
          <div class="pv">PV <b>{foe.hp}/{foe.maxHp}</b>
            <span class="bar"><span style="width:{Math.max(0, 100 * foe.hp / foe.maxHp)}%; background:{foe.hp / foe.maxHp > 0.4 ? '#5ab0a0' : '#e0604a'}"></span></span>
          </div>
          <div class="pstats"><span>Portée <b>{foe.range}</b></span><span>Dégâts <b>{foe.damage}</b></span></div>
          {#if foe.guarding || foe.watching}
            <div class="ptags">{#if foe.guarding}<span class="tag g">🛡 En garde</span>{/if}{#if foe.watching}<span class="tag w">🎯 Tir réservé</span>{/if}</div>
          {/if}
          <div class="pacts">
            <button class="attack" onclick={attackFoe} disabled={!canHitFoe}>⚔ Attaquer{#if selected} ({selected.attackCost} PA){/if}</button>
            {#if attackBlock}<span class="reason">{attackBlock}</span>{/if}
          </div>
        {:else}
          <div class="pempty">Clique une pièce <b style="color:#e0604a">adverse</b> pour l'inspecter.</div>
        {/if}
      </div>
    </div>
  {/if}

  <div class="hint muted small">
    {#if over}
      Clique <b>Revanche</b> ou change de plateau pour rejouer.
    {:else}
      Couleur = joueur. <b>L</b> = Lourde (mêlée, robuste, gros dégâts, portée 1) ·
      <b>T</b> = Tireur (distance, fragile, dégâts faibles, portée 4).
      Clique une de <b style="color:{COLORS[combat.active]}">tes pièces</b> (sa <b style="color:#5ab0a0">portée</b> s'affiche) puis une case
      verte pour <b>bouger</b>. Clique une <b style="color:#e0604a">pièce adverse</b> pour l'inspecter
      (panneau + <b style="color:#e0604a">sa portée</b>), puis <b>⚔ Attaquer</b> si elle est à portée.
      <br/>🔍 <b>Molette</b> pour zoomer, <b>glisse</b> pour déplacer la carte, <b>⤢</b> pour tout réafficher.
      La <b>Lourde</b> peut <b style="color:#aec6f0">🛡 Défendre (3 PA)</b> : dégâts subis réduits de moitié jusqu'à son prochain tour (au prix de son attaque).
      Le <b>Tireur</b> peut <b style="color:#f0c0a0">🎯 Réserver (3 PA)</b> son tir : il <b>tire en réflexe</b> sur la première pièce qui s'arrête dans sa <b style="color:#c07a6a">zone de menace</b> (teintée pendant ton tour).
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
  .shape { margin-left: auto; display: flex; gap: .3rem; }
  .shape button { background: #1a2030; border: 1px solid #3a4555; color: #9aa3b5; border-radius: 5px; padding: .4rem .7rem; cursor: pointer; font-size: .8rem; }
  .shape button.on { border-color: #5a70b0; color: #cfe0ff; background: #20283a; }
  .defend { background: #1c2436; border: 1px solid #3f5a8a; color: #aec6f0; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
  .defend:hover:not(:disabled) { border-color: #6f90c8; }
  .defend.on { background: #243456; border-color: #6f90c8; color: #d6e6ff; font-weight: 600; }
  .defend:disabled { opacity: .4; cursor: not-allowed; }
  .watch { background: #2a2230; border: 1px solid #8a5a44; color: #f0c0a0; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
  .watch:hover:not(:disabled) { border-color: #c08056; }
  .watch.on { background: #3a2a22; border-color: #c08056; color: #ffd9b8; font-weight: 600; }
  .watch:disabled { opacity: .4; cursor: not-allowed; }
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
  .map { display: block; margin: 0 auto; height: auto; background: #0f1117; border: 1px solid #2a2f3a; border-radius: 8px; cursor: grab; touch-action: none; }
  .map:active { cursor: grabbing; }
  .zoom { display: flex; gap: .3rem; }
  .zoom button { background: #1a2030; border: 1px solid #3a4555; color: #9aa3b5; border-radius: 5px; padding: .4rem .6rem; cursor: pointer; font-size: .9rem; min-width: 32px; line-height: 1; }
  .zoom button:hover { border-color: #5a70b0; color: #cfe0ff; }
  .hex { cursor: default; }
  .hex.reach, .hex.attackable, .hex.mine { cursor: pointer; }
  .hex.reach:hover polygon { stroke: #b9f5cf; stroke-width: 3.5; }
  .hex.attackable:hover polygon { stroke: #ff8a6a; stroke-width: 4; }
  .utxt { fill: #0e1015; font-size: 12px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .apbadge { fill: #ffd479; font-size: 9px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .dist { fill: #6fae9a; font-size: 11px; text-anchor: middle; pointer-events: none; }
  .guardmark { font-size: 11px; text-anchor: middle; pointer-events: none; }
  .rng-ally { fill: none; stroke: #5ab0a0; stroke-width: 2; stroke-dasharray: 4 3; opacity: .5; pointer-events: none; }
  .rng-foe { fill: none; stroke: #e0604a; stroke-width: 2; opacity: .5; pointer-events: none; }
  /* Panneaux d'info — pièce alliée sélectionnée (gauche) et pièce adverse inspectée (droite). */
  .panels { display: grid; grid-template-columns: 1fr 1fr; gap: .7rem; }
  .panel { background: #14161c; border: 1px solid #2a2f3a; border-left: 3px solid var(--c); border-radius: 8px; padding: .6rem .85rem; min-height: 96px; }
  .phead { display: flex; align-items: center; gap: .45rem; font-weight: 700; color: #e6ebf5; font-size: .95rem; }
  .pdot { width: 10px; height: 10px; border-radius: 50%; background: var(--c); display: inline-block; }
  .powner { color: #8a93a5; font-weight: 400; font-size: .82rem; }
  .pv { display: flex; align-items: center; gap: .55rem; margin-top: .45rem; font-size: .82rem; color: #9aa3b5; }
  .pv b { color: #e6ebf5; font-size: .95rem; }
  .pv .bar { flex: 1; height: 6px; background: #0e1015; border-radius: 3px; overflow: hidden; }
  .pv .bar span { display: block; height: 100%; border-radius: 3px; }
  .pstats { display: flex; gap: 1rem; margin-top: .4rem; font-size: .8rem; color: #9aa3b5; }
  .pstats b { color: #e6ebf5; }
  .ptags { display: flex; gap: .4rem; margin-top: .4rem; }
  .tag { font-size: .72rem; padding: .12rem .4rem; border-radius: 4px; }
  .tag.g { background: #243456; color: #d6e6ff; }
  .tag.w { background: #3a2a22; color: #ffd9b8; }
  .pacts { display: flex; align-items: center; gap: .55rem; margin-top: .55rem; flex-wrap: wrap; }
  .pempty { color: #7a8294; font-size: .82rem; padding: .6rem 0; }
  .attack { background: #2a1a1e; border: 1px solid #7a3c44; color: #ffb0a0; border-radius: 5px; padding: .45rem .9rem; cursor: pointer; font-weight: 600; font-size: .85rem; }
  .attack:hover:not(:disabled) { border-color: #e0604a; background: #3a2226; }
  .attack:disabled { opacity: .4; cursor: not-allowed; }
  .reason { font-size: .76rem; color: #8a93a5; }
  .muted { color: #7a8294; }
  .small { font-size: .78rem; }
  .hint { padding: 0 .2rem; }
</style>
