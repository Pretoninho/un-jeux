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
    makeCombatState, reachable, moveBudget, moveUnit, attack, canAttack, defend, canDefend,
    reserve, canReserve, resolveOverwatch, riposte, canRiposte, previewReactions, endTurn, winner,
    type Unit,
    unitAt, type CombatState,
  } from './engine/combat';
  import { makeUnitFromCharacter, ARCHETYPES, CHARACTERS } from './engine/pieces';
  import { axialToPixel, hexPointsPointy, octagonPoints, diamondPoints, genBounds } from './lib/layout';

  const RADIUS = 4;
  const OCTA_N = 23;
  const OCTA_FRAC = 0.15; // côté droit octogone (frac. de l'espacement) ; < OCTA_REGULAR → carrés plus gros
  const AP_PER_TURN = 4;
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };
  const NAMES: Record<string, string> = { alice: 'Alice', bob: 'Bob' };
  // Nom et glyphe d'affichage dérivés du registre → aucune dérive quand on ajoute un archétype.
  const KIND_NAME: Record<string, string> = Object.fromEntries(Object.values(ARCHETYPES).map((a) => [a.key, a.name]));
  const CHAR_NAME: Record<string, string> = Object.fromEntries(Object.values(CHARACTERS).map((c) => [c.id, c.name]));
  const KIND_GLYPH: Record<string, string> = Object.fromEntries(Object.values(ARCHETYPES).map((a) => [a.key, a.glyph]));
  // « Résonance » : libellés courts pour les passifs en chaîne (effet + déclencheur).
  const RESON_LABEL: Record<string, string> = { epines: 'Épines relayées', marquage: 'Marquage', estropier: 'Estropier', provocation: 'Provocation', vendetta: 'Vendetta', ralliement: 'Ralliement', etourdir: 'Coup étourdissant', ruee: 'Ruée', silence: 'Silence' };
  const SIGNAL_LABEL: Record<string, string> = { garde_encaissee: 'Allié en garde touché', tir_reserve: 'Tir réservé déclenché', rale: 'Allié tué' };
  // Matrice de Résonance : une icône par EFFET (kind) + le vivier ordonné (lignes = possesseur, colonnes = déclencheur).
  const EFFECT_ICON: Record<string, string> = { epines: '🌵', marquage: '✖', estropier: '🦿', provocation: '🧲', vendetta: '⚔', ralliement: '🚩', etourdir: '💫', ruee: '🏃', silence: '🔇' };
  const HEROES = Object.values(CHARACTERS);
  let showMatrix = $state(false);

  // États actifs d'une pièce (postures + statuts de Résonance) : une icône + une description chacun.
  // Servent à la fois les petites icônes SUR la pièce et le tooltip au survol (`<title>` natif).
  function pieceStates(u: Unit): { icon: string; label: string }[] {
    const s: { icon: string; label: string }[] = [];
    if (u.guarding) s.push({ icon: '🛡', label: 'En garde — dégâts subis réduits' });
    if (u.watching) s.push({ icon: '🎯', label: 'Tir réservé armé' });
    if (u.riposting) s.push({ icon: '🗡', label: 'Riposte armée' });
    if (u.block) s.push({ icon: '🔆', label: `Bloqué — immunité totale aux dégâts (${u.block.expiresIn} t.)` });
    if (u.mark) s.push({ icon: '✖', label: `Marqué — +${u.mark.bonus} au 1ᵉʳ coup adverse (${u.mark.expiresIn} t.)` });
    if (u.cripple) s.push({ icon: '🦿', label: `Estropié — −${u.cripple.amount} déplacement (${u.cripple.expiresIn} t.)` });
    if (u.vendetta) s.push({ icon: '⚔', label: `Vendetta — +${u.vendetta} à sa prochaine attaque` });
    if (u.stunCharge) s.push({ icon: '💫', label: `Coup étourdissant armé — sa prochaine attaque étourdit (${u.stunCharge.expiresIn} t.)` });
    if (u.stun) s.push({ icon: '😵', label: `Étourdi — ne peut rien faire ce tour` });
    if (u.elan) s.push({ icon: '⚡', label: `Élan (Némésis) — +${u.elan} PA au prochain tour` });
    if (u.silence) s.push({ icon: '🔇', label: `Silencé — déplacement uniquement` });
    return s;
  }
  function pieceTitle(u: Unit): string {
    const head = `${u.name ?? KIND_NAME[u.kind] ?? u.kind} · ${KIND_NAME[u.kind] ?? u.kind} · PV ${u.hp}/${u.maxHp}`;
    const st = pieceStates(u).map((e) => `${e.icon} ${e.label}`);
    return st.length ? `${head}\n${st.join('\n')}` : head;
  }

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
      const hb = makeBoard(RADIUS);
      map = hb.map; corners = hb.corners;
      tiles = hb.map.hexes.map((h) => {
        const [cx, cy] = axialToPixel(h.coord!.q, h.coord!.r);
        return { id: h.id, cx, cy, small: false, points: hexPointsPointy(cx, cy, 30) };
      });
    }
    const b = genBounds(tiles.map((t) => [t.cx, t.cy] as [number, number]));
    return { map, corners, tiles, bounds: { x: b.minX, y: b.minY, w: b.w, h: b.h } };
  }

  // Chaque camp aligne Lourde (mêlée-tank) + Tireur (distance-verre) + Duelliste (escarmouche).
  // Pièces 2 et 3 sur des voisins « salle » distincts (on évite les carrés-carrefours exigus).
  // (Le Soigneur — 4ᵉ pièce — arrive au Lot 1, avec son verbe de soin.)
  function initialFor(geo: Geo): CombatState {
    const [c0, c1] = geo.corners;
    const nbOf = (id: string) => geo.map.hexes.find((h) => h.id === id)!.neighbors;
    // Deux emplacements de départ distincts autour d'un coin (salles d'abord, sinon repli).
    const spots = (id: string) => {
      const rooms = nbOf(id).filter((x) => !x.startsWith('s:'));
      const pool = rooms.length >= 2 ? rooms : nbOf(id);
      return [pool[0]!, pool[1] ?? pool[0]!] as const;
    };
    const [a2, a3] = spots(c0);
    const [b2, b3] = spots(c1);
    // Line-up par défaut (vivier plat) : Lourde au coin, Tireur puis Duelliste autour.
    //   Alice = Bastion + Mireille + Estoc · Bob = Rempart + Orso + Fil.
    //   → vivants : Estoc × Bastion, Estoc × Mireille (camp Alice) ; Fil × Rempart, Fil × Orso (camp Bob).
    return makeCombatState(geo.map, [
      makeUnitFromCharacter('a1', 'alice', c0, CHARACTERS.bastion!, AP_PER_TURN),
      makeUnitFromCharacter('a2', 'alice', a2, CHARACTERS.mireille!, AP_PER_TURN),
      makeUnitFromCharacter('a3', 'alice', a3, CHARACTERS.estoc!, AP_PER_TURN),
      makeUnitFromCharacter('b1', 'bob', c1, CHARACTERS.rempart!, AP_PER_TURN),
      makeUnitFromCharacter('b2', 'bob', b2, CHARACTERS.orso!, AP_PER_TURN),
      makeUnitFromCharacter('b3', 'bob', b3, CHARACTERS.fil!, AP_PER_TURN),
    ], 'alice');
  }

  const startGeo = buildBoard('hex'); // const ordinaire → pas de capture de $state à l'init
  let boardShape = $state<Shape>('hex');
  let geo = $state<Geo>(startGeo);
  let combat = $state<CombatState>(initialFor(startGeo));
  let history = $state<CombatState[]>([]); // pile d'annulation (vidée au passage de main)
  let selectedId = $state<string>('a1');
  let inspectedId = $state<string>('');   // pièce adverse inspectée (panneau adverse + sa portée)
  let resonAlly = $state(false);          // détail « Résonance » déplié (panneau allié)
  let resonFoe = $state(false);           // détail « Résonance » déplié (panneau adverse)
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
  // Némésis = ennemi(s) du MÊME archétype présent(s) sur le plateau (rivalité automatique).
  const nemesisOf = (u: Unit): Unit[] => combat.units.filter((x) => x.kind === u.kind && x.owner !== u.owner);
  const selected = $derived(combat.units.find((u) => u.id === selectedId && u.owner === combat.active));
  const reach = $derived(over || !selected ? new Map<string, number>() : reachable(combat, selected.id, moveBudget(selected)));

  const isAttackable = (hexId: string) => {
    const t = unitAt(combat, hexId);
    return !!t && !!selected && t.owner !== combat.active && canAttack(combat, selected.id, t.id);
  };

  // Une Résonance-duo est ACTIVE seulement si son partenaire (fromCharacter/fromKind) est un allié
  // présent ; sinon elle est DORMANTE (jamais déclenchable dans ce line-up). Les passifs non gâtés
  // (sans fromCharacter/fromKind) sont toujours actifs.
  const duoActive = (unit: Unit, rx: { fromCharacter?: string; fromKind?: string }): boolean => {
    if (!rx.fromCharacter && !rx.fromKind) return true;
    return combat.units.some((u) => u.owner === unit.owner && u.id !== unit.id &&
      (rx.fromCharacter ? u.characterId === rx.fromCharacter : u.kind === rx.fromKind));
  };

  // Pièce adverse inspectée (clic sur une pièce ennemie) — alimente le panneau adverse.
  const foe = $derived(combat.units.find((u) => u.id === inspectedId && u.owner !== combat.active));
  const canHitFoe = $derived(!!selected && !!foe && !over && canAttack(combat, selected.id, foe.id));
  // Lisibilité : si frapper ce foe déclenchait une cascade (ex. son tank en garde → un allié
  // relaie des épines sur TA pièce), on l'annonce avant le coup (dry-run pur, rien n'est committé).
  const chainPreview = $derived(
    selected && foe && canHitFoe ? previewReactions(combat, selected.id, foe.id) : []);
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
  const canParry = $derived(!!selected && !over && canRiposte(combat, selected.id));

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

  function riposteSelected() {
    if (!selected || !canRiposte(combat, selected.id)) return;
    history = [...history, combat];
    combat = riposte(combat, selected.id);
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
  <div class="layout">
    <aside class="controls">
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
    </aside>

    <div class="board">
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
          {@const states = pieceStates(occ)}
          <title>{pieceTitle(occ)}</title>
          <circle cx={t.cx} cy={t.cy - 3} {r} fill={COLORS[occ.owner]} stroke={isSel ? '#f0f3f9' : '#0e1015'} stroke-width={isSel ? 3 : 2} />
          <text x={t.cx} y={t.cy + 1} class="utxt">{KIND_GLYPH[occ.kind] ?? '?'}</text>
          <!-- nom du héros, petit, juste au-dessus du pion -->
          {#if occ.name}<text x={t.cx} y={t.cy - r - 4} class="pname">{occ.name}</text>{/if}
          <!-- barre de PV (couleur = joueur, lettre = archétype) -->
          <rect x={t.cx - w / 2} y={t.cy + by} width={w} height="3.5" rx="1.5" fill="#0e1015" />
          <rect x={t.cx - w / 2} y={t.cy + by} width={w * frac} height="3.5" rx="1.5" fill={frac > 0.4 ? '#5ab0a0' : '#e0604a'} />
          <!-- PA restants (pièces du camp actif) -->
          {#if mine}<text x={t.cx + r + 2} y={t.cy - 6} class="apbadge">{occ.ap}</text>{/if}
          <!-- icônes d'état (postures + statuts), en rangée au-dessus du nom -->
          {#each states as st, i}
            <text x={t.cx + (i - (states.length - 1) / 2) * 9} y={t.cy - r - 13} class="statemark">{st.icon}</text>
          {/each}
        {:else if inReach}
          <text x={t.cx} y={t.cy + 4} class="dist">{d}</text>
        {/if}
      </g>
    {/each}
  </svg>
    </div>

    <aside class="info">
    {#snippet reson(unit: Unit, open: boolean, toggle: () => void)}
      {@const active = (unit.reactions ?? []).filter((rx) => duoActive(unit, rx))}
      {#if active.length}
        <div class="reson">
          <span class="reslabel">RÉSONANCE</span>
          {#each active as rx}
            <span class="resbadge">✦ {RESON_LABEL[rx.kind] ?? 'Résonance'}
              {#if (unit.cooldowns?.[rx.id] ?? 0) > 0}<span class="cd">⏳{unit.cooldowns?.[rx.id]}</span>{:else}<span class="rdy">prêt</span>{/if}
            </span>
          {/each}
          <button class="qbtn" class:on={open} onclick={toggle} title="Détail de la Résonance">?</button>
        </div>
        {#if open}
          <div class="resdetail">
            {#each active as rx}
              <div><b>{RESON_LABEL[rx.kind] ?? rx.id}</b> — {SIGNAL_LABEL[rx.on] ?? rx.on}
                · {'radius' in rx.scope ? `rayon ${rx.scope.radius}` : 'escouade'} · CD {rx.cooldown} tours{#if rx.fromCharacter} · duo : {CHAR_NAME[rx.fromCharacter] ?? rx.fromCharacter}{:else if rx.fromKind} · duo : {KIND_NAME[rx.fromKind] ?? rx.fromKind}{/if}
                {#if rx.kind === 'marquage'}
                  <div class="amt">+{rx.amount ?? 1} au 1ᵉʳ coup sur la cible · marque {rx.duration ?? 2} tours</div>
                {:else if rx.kind === 'estropier'}
                  <div class="amt">−{rx.amount ?? 1} déplacement sur la cible · {rx.duration ?? 2} tours</div>
                {:else if rx.kind === 'provocation'}
                  <div class="amt">tire la cible de {rx.amount ?? 1} case vers le possesseur</div>
                {:else if rx.kind === 'vendetta'}
                  <div class="amt">+{rx.amount ?? 1} à la prochaine attaque de l'allié touché</div>
                {:else if rx.kind === 'ralliement'}
                  <div class="amt">à la mort de l'allié : se téléporte sur sa case · immunité totale {rx.duration ?? 1} tours</div>
                {:else if rx.kind === 'etourdir'}
                  <div class="amt">arme l'allié : sa prochaine attaque étourdit la cible {rx.amount ?? 1} tour · charge {rx.duration ?? 3} tours</div>
                {:else if rx.kind === 'ruee'}
                  <div class="amt">le possesseur avance de {rx.amount ?? 1} case vers la cible</div>
                {:else if rx.kind === 'silence'}
                  <div class="amt">silence la cible : déplacement uniquement (ni attaque/verbe/Résonance/élan) · {rx.duration ?? 2} tours</div>
                {:else}
                  <div class="amt">Dégâts {rx.amount ?? 1}{#if rx.amountBySource} · selon classe : {Object.entries(rx.amountBySource).map(([k, v]) => `${KIND_NAME[k] ?? k} ${v}`).join(', ')}{/if}{#if rx.amountByCharacter} · selon héros : {Object.entries(rx.amountByCharacter).map(([k, v]) => `${CHAR_NAME[k] ?? k} ${v}`).join(', ')}{/if}</div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    {/snippet}
    {#if !over}
      <div class="panels">
      <div class="panel ally" style="--c:{COLORS[combat.active]}">
        {#if selected}
          <div class="phead"><span class="pdot"></span>{selected.name ?? KIND_NAME[selected.kind]} <span class="powner">· {KIND_NAME[selected.kind]} · {NAMES[selected.owner]}</span></div>
          {@const nem = nemesisOf(selected)}
          <div class="nemesis small">⚔ Némésis : <b>{nem.length ? nem.map((n) => n.name ?? KIND_NAME[n.kind]).join(', ') : '—'}</b></div>
          <div class="pv">PV <b>{selected.hp}/{selected.maxHp}</b>
            <span class="bar"><span style="width:{Math.max(0, 100 * selected.hp / selected.maxHp)}%; background:{selected.hp / selected.maxHp > 0.4 ? '#5ab0a0' : '#e0604a'}"></span></span>
          </div>
          <div class="pstats"><span>PA <b>{selected.ap}</b>/{AP_PER_TURN}</span><span>Portée <b>{selected.range}</b></span><span>Dégâts <b>{selected.damage}</b></span></div>
          {#if selected.guarding || selected.watching || selected.riposting}
            <div class="ptags">{#if selected.guarding}<span class="tag g">🛡 En garde</span>{/if}{#if selected.watching}<span class="tag w">🎯 Tir réservé</span>{/if}{#if selected.riposting}<span class="tag r">🗡 Riposte armée</span>{/if}</div>
          {/if}
          {#if selected.mark}
            {@const mk = combat.units.find((mu) => mu.id === selected.mark!.by)}
            <div class="ptags"><span class="tag m">✖ Marqué{#if mk} par {mk.name ?? KIND_NAME[mk.kind]}{/if} (+{selected.mark.bonus} au 1ᵉʳ coup · ⏳{selected.mark.expiresIn})</span></div>
          {/if}
          {#if selected.cripple}
            <div class="ptags"><span class="tag c">🦿 Estropié (−{selected.cripple.amount} dépl. · ⏳{selected.cripple.expiresIn})</span></div>
          {/if}
          {#if selected.vendetta}
            <div class="ptags"><span class="tag v">⚔ Vendetta (+{selected.vendetta} à la prochaine attaque)</span></div>
          {/if}
          {#if selected.block}
            <div class="ptags"><span class="tag b">🔆 Bloqué — immunisé (⏳{selected.block.expiresIn})</span></div>
          {/if}
          {#if selected.stunCharge}
            <div class="ptags"><span class="tag s">💫 Coup étourdissant armé (⏳{selected.stunCharge.expiresIn})</span></div>
          {/if}
          {#if selected.stun}
            <div class="ptags"><span class="tag k">😵 Étourdi — ne joue pas ce tour</span></div>
          {/if}
          {#if selected.elan}
            <div class="ptags"><span class="tag e">⚡ Élan (Némésis) — +{selected.elan} PA au prochain tour</span></div>
          {/if}
          {#if selected.silence}
            <div class="ptags"><span class="tag s">🔇 Silencé — déplacement uniquement (⏳{selected.silence.expiresIn})</span></div>
          {/if}
          {@render reson(selected, resonAlly, () => (resonAlly = !resonAlly))}
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
            {#if selected.riposte}
              <button class="riposte" class:on={selected.riposting} onclick={riposteSelected} disabled={!canParry}>
                {selected.riposting ? '🗡 Riposte armée' : `🗡 Riposter (${selected.riposte.cost})`}
              </button>
            {/if}
          </div>
        {:else}
          <div class="pempty">Clique une de <b style="color:{COLORS[combat.active]}">tes pièces</b> pour la sélectionner.</div>
        {/if}
      </div>

      <div class="panel foe" style="--c:{foe ? COLORS[foe.owner] : '#3a4150'}">
        {#if foe}
          <div class="phead"><span class="pdot"></span>{foe.name ?? KIND_NAME[foe.kind]} <span class="powner">· {KIND_NAME[foe.kind]} · {NAMES[foe.owner]}</span></div>
          {@const nem = nemesisOf(foe)}
          <div class="nemesis small">⚔ Némésis : <b>{nem.length ? nem.map((n) => n.name ?? KIND_NAME[n.kind]).join(', ') : '—'}</b></div>
          <div class="pv">PV <b>{foe.hp}/{foe.maxHp}</b>
            <span class="bar"><span style="width:{Math.max(0, 100 * foe.hp / foe.maxHp)}%; background:{foe.hp / foe.maxHp > 0.4 ? '#5ab0a0' : '#e0604a'}"></span></span>
          </div>
          <div class="pstats"><span>Portée <b>{foe.range}</b></span><span>Dégâts <b>{foe.damage}</b></span></div>
          {#if foe.guarding || foe.watching || foe.riposting}
            <div class="ptags">{#if foe.guarding}<span class="tag g">🛡 En garde</span>{/if}{#if foe.watching}<span class="tag w">🎯 Tir réservé</span>{/if}{#if foe.riposting}<span class="tag r">🗡 Riposte armée</span>{/if}</div>
          {/if}
          {#if foe.mark}
            {@const mk = combat.units.find((mu) => mu.id === foe.mark!.by)}
            <div class="ptags"><span class="tag m">✖ Marqué{#if mk} par {mk.name ?? KIND_NAME[mk.kind]}{/if} (+{foe.mark.bonus} au 1ᵉʳ coup · ⏳{foe.mark.expiresIn})</span></div>
          {/if}
          {#if foe.cripple}
            <div class="ptags"><span class="tag c">🦿 Estropié (−{foe.cripple.amount} dépl. · ⏳{foe.cripple.expiresIn})</span></div>
          {/if}
          {#if foe.vendetta}
            <div class="ptags"><span class="tag v">⚔ Vendetta (+{foe.vendetta} à la prochaine attaque)</span></div>
          {/if}
          {#if foe.block}
            <div class="ptags"><span class="tag b">🔆 Bloqué — immunisé (⏳{foe.block.expiresIn})</span></div>
          {/if}
          {#if foe.stunCharge}
            <div class="ptags"><span class="tag s">💫 Coup étourdissant armé (⏳{foe.stunCharge.expiresIn})</span></div>
          {/if}
          {#if foe.stun}
            <div class="ptags"><span class="tag k">😵 Étourdi — ne joue pas ce tour</span></div>
          {/if}
          {#if foe.elan}
            <div class="ptags"><span class="tag e">⚡ Élan (Némésis) — +{foe.elan} PA au prochain tour</span></div>
          {/if}
          {#if foe.silence}
            <div class="ptags"><span class="tag s">🔇 Silencé — déplacement uniquement (⏳{foe.silence.expiresIn})</span></div>
          {/if}
          {@render reson(foe, resonFoe, () => (resonFoe = !resonFoe))}
          {#if chainPreview.length}
            <div class="chainwarn">
              {#each chainPreview as p}
                {@const lst = combat.units.find((u) => u.id === p.listenerId)}
                <span>⚡ En chaîne : <b>{lst?.name ?? KIND_NAME[lst?.kind ?? '']}</b> (adverse) {#if p.spec.kind === 'estropier'}estropie ta pièce (−{p.amount} dépl.){:else if p.spec.kind === 'vendetta'}renforce son tank (+{p.amount} à sa prochaine attaque){:else if p.spec.kind === 'etourdir'}arme son tank (prochaine attaque étourdissante){:else if p.spec.kind === 'silence'}silence ta pièce (déplacement seul){:else}pince ta pièce (−{p.amount}){/if}</span>
              {/each}
            </div>
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
    </aside>
  </div>

  <div class="matrixbar">
    <button class="matrix-toggle" class:on={showMatrix} onclick={() => (showMatrix = !showMatrix)}>
      ✦ Matrice de Résonance {showMatrix ? '▲' : '▼'}
    </button>
    {#if showMatrix}
      <div class="matrix-panel">
        <p class="muted small">Lignes = <b>qui réagit</b> (possesseur) · Colonnes = <b>qui déclenche</b> (partenaire). Une cellule = un duo. Survole pour le détail.</p>
        <table class="matrix">
          <thead>
            <tr>
              <th class="corner">réagit ↓ / déclenché par →</th>
              {#each HEROES as col}
                <th title={KIND_NAME[col.archetype]}>{col.name}<span class="mk">{KIND_GLYPH[col.archetype]}</span></th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each HEROES as row}
              <tr>
                <th class="rowhead" title={KIND_NAME[row.archetype]}><span class="mk">{KIND_GLYPH[row.archetype]}</span> {row.name}</th>
                {#each HEROES as col}
                  {@const duo = row.id === col.id ? undefined : row.reactions?.find((r) => r.fromCharacter === col.id)}
                  <td class:self={row.id === col.id} class:has={!!duo}>
                    {#if row.id === col.id}<span class="diag">·</span>
                    {:else if duo}<span class="cell" title={`${row.name} × ${col.name} — ${RESON_LABEL[duo.kind] ?? duo.kind}\nsur « ${SIGNAL_LABEL[duo.on] ?? duo.on} » · ${'radius' in duo.scope ? `rayon ${duo.scope.radius}` : 'escouade'} · CD ${duo.cooldown}`}>{EFFECT_ICON[duo.kind] ?? '✦'}</span>{/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="matrix-legend small muted">
          {#each Object.entries(EFFECT_ICON) as [kind, icon]}
            <span><b>{icon}</b> {RESON_LABEL[kind] ?? kind}</span>
          {/each}
        </div>
      </div>
    {/if}
  </div>

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
  /* 3 colonnes : contrôles à gauche, board au centre, panneaux d'info à droite. */
  .layout { display: grid; grid-template-columns: 220px minmax(0, 1fr) 264px; gap: .8rem; align-items: start; }
  .controls { display: flex; flex-direction: column; gap: .55rem; background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: .7rem .8rem; }
  .controls > button { width: 100%; }
  .controls .shape button, .controls .zoom button { flex: 1; }
  .board { min-width: 0; }
  .board .banner { margin-bottom: .7rem; }
  .info { display: flex; flex-direction: column; gap: .7rem; }
  @media (max-width: 980px) { .layout { grid-template-columns: 1fr; } }
  .turn { font-size: .9rem; color: #9aa3b5; }
  .turn b { color: #e6ebf5; font-size: 1.05rem; }
  .active { font-size: .85rem; color: #9aa3b5; border-left: 3px solid var(--c); padding-left: .55rem; display: flex; gap: .6rem; align-items: baseline; }
  .active b { color: #e6ebf5; }
  .shape { display: flex; gap: .3rem; }
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
  .riposte { background: #2a2236; border: 1px solid #6a5288; color: #cbb6ec; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
  .riposte:hover:not(:disabled) { border-color: #9a7cc8; }
  .riposte.on { background: #342a4a; border-color: #9a7cc8; color: #e2d6ff; font-weight: 600; }
  .riposte:disabled { opacity: .4; cursor: not-allowed; }
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
  .statemark { font-size: 9px; text-anchor: middle; pointer-events: none; }
  .pname { fill: #e8ecf2; font-size: 7px; font-weight: 600; text-anchor: middle; pointer-events: none; }
  .rng-ally { fill: none; stroke: #5ab0a0; stroke-width: 2; stroke-dasharray: 4 3; opacity: .5; pointer-events: none; }
  .rng-foe { fill: none; stroke: #e0604a; stroke-width: 2; opacity: .5; pointer-events: none; }
  /* Panneaux d'info — pièce alliée sélectionnée (gauche) et pièce adverse inspectée (droite). */
  .panels { display: grid; grid-template-columns: 1fr; gap: .7rem; }
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
  .tag.r { background: #342a4a; color: #e2d6ff; }
  .tag.m { background: #4a2230; color: #ffc8d6; }
  .tag.c { background: #2a3a2a; color: #c8e6c0; }
  .tag.v { background: #3a3320; color: #ffe0a0; }
  .tag.b { background: #20303a; color: #a0d8ff; }
  .tag.s { background: #3a3320; color: #ffd98a; }
  .tag.k { background: #3a2030; color: #ffaecb; }
  .tag.e { background: #2a3320; color: #d6ffa0; }
  .pacts { display: flex; align-items: center; gap: .55rem; margin-top: .55rem; flex-wrap: wrap; }
  .pempty { color: #7a8294; font-size: .82rem; padding: .6rem 0; }
  .attack { background: #2a1a1e; border: 1px solid #7a3c44; color: #ffb0a0; border-radius: 5px; padding: .45rem .9rem; cursor: pointer; font-weight: 600; font-size: .85rem; }
  .attack:hover:not(:disabled) { border-color: #e0604a; background: #3a2226; }
  .attack:disabled { opacity: .4; cursor: not-allowed; }
  .reason { font-size: .76rem; color: #8a93a5; }
  .chainwarn { display: flex; flex-direction: column; gap: .15rem; margin: .1rem 0 .3rem; font-size: .74rem; color: #e2c66a; }
  .chainwarn b { color: #f0d886; }
  .reson { display: flex; align-items: center; gap: .35rem; flex-wrap: wrap; margin: .2rem 0; }
  .reslabel { font-size: .64rem; font-weight: 700; letter-spacing: .08em; color: #9a7cc8; }
  .resbadge { font-size: .72rem; padding: .12rem .45rem; border-radius: 4px; background: #2c2640; color: #cbb6ec; display: inline-flex; gap: .3rem; align-items: center; }
  .resbadge .cd { color: #e2c66a; }
  .resbadge .rdy { color: #7fcf9e; }
  .qbtn { width: 1.25rem; height: 1.25rem; line-height: 1; padding: 0; border-radius: 50%; border: 1px solid #4a4368; background: #221d33; color: #b7a6e0; cursor: pointer; font-size: .72rem; }
  .qbtn:hover, .qbtn.on { border-color: #9a7cc8; color: #e2d6ff; }
  .resdetail { font-size: .72rem; color: #b9afd0; background: #1d1930; border: 1px solid #352f4e; border-radius: 5px; padding: .35rem .5rem; margin: .1rem 0 .3rem; display: flex; flex-direction: column; gap: .25rem; }
  .resdetail b { color: #d8c9f5; }
  .resdetail .amt { color: #8d84a8; margin-top: .1rem; }
  .muted { color: #7a8294; }
  .small { font-size: .78rem; }
  .nemesis { color: #c98a8a; margin: .15rem 0 .35rem; }
  .nemesis b { color: #e0a0a0; }
  .hint { padding: 0 .2rem; }

  /* Matrice de Résonance (panneau dépliable, pleine largeur) */
  .matrixbar { margin: .6rem .2rem 0; }
  .matrix-toggle { background: #2c2640; color: #cbb6ec; border: 1px solid #3a3356; border-radius: 6px; padding: .35rem .7rem; font-size: .82rem; font-weight: 700; cursor: pointer; }
  .matrix-toggle.on, .matrix-toggle:hover { background: #3a3356; }
  .matrix-panel { margin-top: .5rem; padding: .6rem; background: #15171f; border: 1px solid #272c37; border-radius: 8px; overflow-x: auto; }
  .matrix-panel p { margin: 0 0 .5rem; }
  table.matrix { border-collapse: collapse; font-size: .8rem; }
  table.matrix th, table.matrix td { border: 1px solid #272c37; padding: .25rem .4rem; text-align: center; }
  table.matrix .corner { color: #7a8294; font-weight: 400; font-size: .68rem; text-align: right; }
  table.matrix thead th { color: #cdd3df; white-space: nowrap; }
  table.matrix .rowhead { color: #cdd3df; text-align: left; white-space: nowrap; }
  table.matrix .mk { color: #8a93a6; font-size: .72rem; }
  table.matrix td.self { background: #0e1015; }
  table.matrix td.has { background: #221d33; }
  table.matrix .cell { font-size: 1rem; cursor: help; }
  table.matrix .diag { color: #3a4150; }
  .matrix-legend { display: flex; flex-wrap: wrap; gap: .2rem 1rem; margin-top: .5rem; }
</style>
