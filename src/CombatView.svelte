<script lang="ts">
  // NOYAU TACTIQUE — 2 pièces par camp, PA par pièce. Échecs + Divinity (esprit).
  // À ton tour : clique une de TES pièces pour la sélectionner. Le DÉPLACEMENT est gratuit
  // (gated par la mobilité `moveCap`, pas par les PA) ; les PA paient les attaques et verbes
  // → une pièce peut bouger ET agir le même tour. Joue tes pièces dans l'ordre que tu veux,
  // puis « Finir le tour » (PA rechargés, pas remis à zéro).
  //
  // La vue est AGNOSTIQUE À LA FORME : elle dessine une liste de tuiles {id, points, shape}
  // et délègue toute la logique au moteur (topologie pure). Deux plateaux interchangeables :
  // hexagonal (6 voisins) ou octogonal 4.8.8 (octogones + carrés-carrefours jouables).
  import { makeBoard } from './engine/board';
  import { makeOctaBoard } from './engine/octaboard';
  import { makeSquareBoard } from './engine/squareboard';
  import {
    makeCombatState, reachable, moveBudget, moveUnit, attack, canAttack, defend, canDefend,
    reserve, canReserve, resolveOverwatch, riposte, canRiposte, canHeal, healUnit, previewReactions, endTurn, winner,
    stepToward, type Unit,
    unitAt, type CombatState,
  } from './engine/combat';
  import { makeUnitFromCharacter, ARCHETYPES, CHARACTERS } from './engine/pieces';
  import { planTurn, applyAction, DIFFICULTIES, type Difficulty, type AiAction } from './engine/ai';
  import { OBJECTIVES, OBJ_CATS, detectUnlocks } from './engine/objectives';
  import { axialToPixel, hexPointsPointy, octagonPoints, diamondPoints, squarePoints, genBounds } from './lib/layout';

  // FORME du plateau (topologie) — le moteur ne lit que `neighbors`, il est agnostique : on peut
  // comparer librement octogone / hexagone / carré sans rien changer au combat.
  type Shape = 'octa' | 'hex' | 'square';
  type Mode = 'entrainement' | 'partie';
  // Taille du plateau par (forme × mode) : entraînement = petit/lisible, partie = grand.
  const SIZE: Record<Shape, Record<Mode, number>> = {
    octa:   { entrainement: 9, partie: 23 }, // n d'octogones (n² + (n-1)² cases)
    hex:    { entrainement: 4, partie: 8 },  // rayon du disque hexagonal
    square: { entrainement: 9, partie: 19 }, // côté de la grille n×n
  };
  const FORME_LABEL: Record<Shape, string> = { octa: '⯃ Octogone', hex: '⬡ Hexagone', square: '▢ Carré' };
  const OCTA_FRAC = 0.15; // côté droit octogone (frac. de l'espacement) ; < OCTA_REGULAR → carrés plus gros
  const AP_PER_TURN = 4;
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };
  const NAMES: Record<string, string> = { alice: 'Alice', bob: 'Bob' };
  // Nom et glyphe d'affichage dérivés du registre → aucune dérive quand on ajoute un archétype.
  const KIND_NAME: Record<string, string> = Object.fromEntries(Object.values(ARCHETYPES).map((a) => [a.key, a.name]));
  const CHAR_NAME: Record<string, string> = Object.fromEntries(Object.values(CHARACTERS).map((c) => [c.id, c.name]));
  const KIND_GLYPH: Record<string, string> = Object.fromEntries(Object.values(ARCHETYPES).map((a) => [a.key, a.glyph]));
  // « Résonance » : libellés courts pour les passifs en chaîne (effet + déclencheur).
  const RESON_LABEL: Record<string, string> = { epines: 'Épines relayées', marquage: 'Marquage', estropier: 'Estropier', provocation: 'Provocation', vendetta: 'Vendetta', ralliement: 'Ralliement', etourdir: 'Coup étourdissant', ruee: 'Ruée', silence: 'Silence', couverture: 'Couverture', appui: 'Appui-feu', racine: 'Enracinement', charge: 'Charge', regen: 'Régénération', soin: 'Soin instantané' };
  const SIGNAL_LABEL: Record<string, string> = { garde_encaissee: 'Allié en garde touché', tir_reserve: 'Tir réservé déclenché', rale: 'Allié tué', riposte: 'Riposte déclenchée' };
  // Matrice de Résonance : une icône par EFFET (kind) + le vivier ordonné (lignes = possesseur, colonnes = déclencheur).
  // Matrice : chaque EFFET de duo → un pictogramme SVG (clé du snippet `stateGlyph`) + une couleur
  // de pastille selon l'INTENTION (rouge = nuit à l'ennemi · vert = soutient un allié · bleu = déplacement).
  const EFFECT_GLYPH: Record<string, string> = { epines: 'epines', marquage: 'mark', estropier: 'cripple', provocation: 'provocation', vendetta: 'vendetta', ralliement: 'ralliement', etourdir: 'stun', ruee: 'ruee', silence: 'silence', couverture: 'cover', appui: 'appui', racine: 'root', charge: 'charge', regen: 'heal', soin: 'heal' };
  const EFFECT_COLOR: Record<string, string> = { epines: '#c9543a', marquage: '#c9543a', estropier: '#c9543a', etourdir: '#c9543a', silence: '#c9543a', racine: '#c9543a', vendetta: '#2a9d76', ralliement: '#2a9d76', couverture: '#2a9d76', appui: '#2a9d76', charge: '#2a9d76', provocation: '#3266ad', ruee: '#3266ad', regen: '#2a9d76', soin: '#2a9d76' };
  // Vivier visible — les SOIGNEURS sont exclus (mis sous silence) : ni dans le draft, ni dans la
  // matrice de Résonance. « Comme s'ils n'existaient pas » (ils restent dans CHARACTERS côté moteur).
  const HEROES = Object.values(CHARACTERS).filter((c) => c.archetype !== 'soigneur');
  // ── Pré-partie : composition d'escouade (1 héros par archétype) + adversaire (hotseat / IA) ──
  const SLOTS = ['lourde', 'tireur', 'duelliste'] as const; // une escouade = 1 de chaque archétype
  // NB : le SOIGNEUR est mis SOUS SILENCE — retiré du vivier (escouade revenue à 3 archétypes). Tout
  // le code Soin (verbe, UI ✚, effets regen/soin, héros Baume/Mélisse) reste en place, simplement
  // injoignable (ni fieldé, ni offert au setup, ni joué par l'IA). Le rebrancher = remettre 'soigneur' ici.
  type Slot = (typeof SLOTS)[number];
  type Opponent = 'hotseat' | 'ia';
  const heroesOf = (arch: string) => HEROES.filter((h) => h.archetype === arch);
  // MIROIR (décidé 2026-06-19) : les deux camps jouent la MÊME escouade (3 pièces identiques de
  // chaque côté, façon échecs). Plus de « complément » adverse ; Bob aligne exactement ton escouade.
  // → l'équité est structurelle (zéro asymétrie de roster). Le vivier/draft restent en réserve.
  const lineupOf = (p: Record<Slot, string>) => SLOTS.map((s) => p[s]);
  const DEFAULT_PICK: Record<Slot, string> = { lourde: 'bastion', tireur: 'mireille', duelliste: 'estoc' };
  const LEVEL_LABEL: Record<Difficulty, string> = { facile: 'Facile', normal: 'Normal', difficile: 'Difficile' };
  const AI_STEP_MS = 480; // délai entre deux actions de l'IA (auto-play animé)
  let showMatrix = $state(false);
  // Tuto « Comment jouer » : affiché au 1er lancement, ré-ouvrable via le bouton ? Aide.
  let showHelp = $state(typeof localStorage === 'undefined' || !localStorage.getItem('seenHelp'));
  function closeHelp() { showHelp = false; try { localStorage.setItem('seenHelp', '1'); } catch { /* noop */ } }

  // États actifs d'une pièce (postures + statuts de Résonance). Chacun porte une CLÉ (→ pictogramme
  // SVG sur mesure, cf. snippet `stateGlyph`), une FAMILLE (→ couleur de pastille : la couleur porte
  // la 1ʳᵉ lecture, même minuscule) et un libellé (tooltip au survol + panneaux).
  type StateFam = 'posture' | 'bonus' | 'malus';
  const STATE_FAM_COLOR: Record<StateFam, string> = { posture: '#3266ad', bonus: '#2a9d76', malus: '#c9543a' };
  function pieceStates(u: Unit): { key: string; fam: StateFam; label: string }[] {
    const s: { key: string; fam: StateFam; label: string }[] = [];
    if (u.guarding) s.push({ key: 'guard', fam: 'posture', label: 'En garde — dégâts subis réduits' });
    if (u.watching) s.push({ key: 'watch', fam: 'posture', label: 'Tir réservé armé' });
    if (u.riposting) s.push({ key: 'riposte', fam: 'posture', label: 'Riposte armée' });
    if (u.block) s.push({ key: 'block', fam: 'bonus', label: `Bloqué — immunité totale aux dégâts (${u.block.expiresIn} t.)` });
    if (u.vendetta) s.push({ key: 'vendetta', fam: 'bonus', label: `Vendetta — +${u.vendetta} à sa prochaine attaque` });
    if (u.cover) s.push({ key: 'cover', fam: 'bonus', label: `Couverture — +${u.cover.amount} PA/tour (${u.cover.expiresIn} t.)` });
    if (u.appui) s.push({ key: 'appui', fam: 'bonus', label: `Appui-feu — +${u.appui.amount} dégâts (${u.appui.expiresIn} t.)` });
    if (u.haste) s.push({ key: 'charge', fam: 'bonus', label: `Chargé — +${u.haste.amount} déplacement (${u.haste.expiresIn} t.)` });
    if (u.stunCharge) s.push({ key: 'stuncharge', fam: 'bonus', label: `Coup étourdissant armé — sa prochaine attaque étourdit (${u.stunCharge.expiresIn} t.)` });
    if (u.mark) s.push({ key: 'mark', fam: 'malus', label: `Marqué — +${u.mark.bonus} au 1ᵉʳ coup adverse (${u.mark.expiresIn} t.)` });
    if (u.cripple) s.push({ key: 'cripple', fam: 'malus', label: `Estropié — −${u.cripple.amount} déplacement (${u.cripple.expiresIn} t.)` });
    if (u.stun) s.push({ key: 'stun', fam: 'malus', label: `Étourdi — ne peut rien faire ce tour` });
    if (u.silence) s.push({ key: 'silence', fam: 'malus', label: `Silencé — déplacement uniquement` });
    if (u.root) s.push({ key: 'root', fam: 'malus', label: `Enraciné — ne peut pas se déplacer (${u.root.expiresIn} t.)` });
    return s;
  }
  function pieceTitle(u: Unit): string {
    const head = `${u.name ?? KIND_NAME[u.kind] ?? u.kind} · ${KIND_NAME[u.kind] ?? u.kind} · PV ${u.hp}/${u.maxHp}`;
    const st = pieceStates(u).map((e) => `• ${e.label}`);
    return st.length ? `${head}\n${st.join('\n')}` : head;
  }

  interface Tile { id: string; cx: number; cy: number; points: string; small: boolean }
  interface Geo { map: CombatState['map']; corners: [string, string]; tiles: Tile[]; bounds: { x: number; y: number; w: number; h: number } }

  // Construit la géométrie ET la topologie d'un plateau (le moteur ne lit que `map`).
  // `n` = taille selon la forme : n d'octogones / rayon hexagonal / côté de la grille carrée.
  function buildBoard(shape: Shape, n: number): Geo {
    let map: CombatState['map'], corners: [string, string], tiles: Tile[];
    if (shape === 'octa') {
      const ob = makeOctaBoard(n);
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
    } else if (shape === 'square') {
      const sb = makeSquareBoard(n);
      map = sb.map; corners = sb.corners;
      const S = 60; // espacement (pas de la grille)
      tiles = sb.map.hexes.map((h) => {
        const cx = h.coord!.q * S, cy = h.coord!.r * S;
        return { id: h.id, cx, cy, small: false, points: squarePoints(cx, cy, S) };
      });
    } else {
      const hb = makeBoard(n);
      map = hb.map; corners = hb.corners;
      tiles = hb.map.hexes.map((h) => {
        const [cx, cy] = axialToPixel(h.coord!.q, h.coord!.r);
        return { id: h.id, cx, cy, small: false, points: hexPointsPointy(cx, cy, 30) };
      });
    }
    const b = genBounds(tiles.map((t) => [t.cx, t.cy] as [number, number]));
    return { map, corners, tiles, bounds: { x: b.minX, y: b.minY, w: b.w, h: b.h } };
  }

  // Chaque camp aligne Lourde + Tireur + Duelliste + Soigneur (4 pièces). La 1ʳᵉ est au coin,
  // les suivantes sur les cases libres les plus proches (salles d'abord, on évite les carrefours `s:`).
  // Déploie deux escouades choisies au setup : `alice`/`bob` = [Lourde, Tireur, Duelliste, Soigneur].
  // Alice joue toujours en premier.
  function initialFor(geo: Geo, alice: string[], bob: string[]): CombatState {
    const [c0, c1] = geo.corners;
    const nbOf = (id: string) => geo.map.hexes.find((h) => h.id === id)!.neighbors;
    // `n` cases de départ proches d'un coin (BFS, salles d'abord), distinctes du coin et des autres camps.
    const spots = (corner: string, n: number, taken: Set<string>): string[] => {
      const out: string[] = [];
      const seen = new Set<string>([corner, ...taken]);
      let frontier = [corner];
      while (frontier.length && out.length < n) {
        const next: string[] = [];
        for (const f of frontier) for (const nb of nbOf(f)) {
          if (seen.has(nb)) continue;
          seen.add(nb); next.push(nb);
          if (!nb.startsWith('s:')) out.push(nb);   // préfère les salles
        }
        frontier = next;
      }
      while (out.length < n) out.push(corner);       // repli (très petit plateau) : empilable
      return out.slice(0, n);
    };
    const ch = (id: string) => CHARACTERS[id]!;
    const taken = new Set<string>([c0, c1]);
    const place = (camp: string, corner: string, lineup: string[]): Unit[] => {
      const rest = spots(corner, lineup.length - 1, taken);
      rest.forEach((h) => taken.add(h));
      const cells = [corner, ...rest];
      return lineup.map((id, i) => makeUnitFromCharacter(`${camp[0]}${i + 1}`, camp, cells[i]!, ch(id), AP_PER_TURN));
    };
    return makeCombatState(geo.map, [...place('alice', c0, alice), ...place('bob', c1, bob)], 'alice');
  }

  const startGeo = buildBoard('hex', SIZE.hex.entrainement); // démarrage sur l'hexagone resserré (r=4)
  // PHASE : l'appli démarre DIRECTEMENT en combat (config par défaut : Entraînement, vs IA normal,
  // escouade par défaut). L'écran de pré-partie (setup) reste accessible via « ⚙ Nouvelle partie ».
  let phase = $state<'setup' | 'combat'>('combat');
  let opponent = $state<Opponent>('ia');
  let aiLevel = $state<Difficulty>('normal');
  let pick = $state<Record<Slot, string>>({ ...DEFAULT_PICK }); // escouade choisie ; jouée À L'IDENTIQUE par les deux camps
  let aiThinking = $state(false);                                // l'IA joue son tour → entrées gelées
  let mode = $state<Mode>('entrainement');
  let shape = $state<Shape>('hex'); // forme du plateau — hexagone (forme retenue pour le tuto et les parties)
  let geo = $state<Geo>(startGeo);
  let combat = $state<CombatState>(initialFor(startGeo, lineupOf(DEFAULT_PICK), lineupOf(DEFAULT_PICK)));
  let history = $state<CombatState[]>([]); // pile d'annulation (vidée au passage de main)
  let selectedId = $state<string>('a1');
  let inspectedId = $state<string>('');   // pièce adverse inspectée (panneau adverse + sa portée)
  let resonAlly = $state(false);          // détail « Résonance » déplié (panneau allié)
  let resonFoe = $state(false);           // détail « Résonance » déplié (panneau adverse)
  let healMode = $state(false);           // Soigneur : ciblage d'un allié à soigner (clic = soigne)
  const acted = $derived(history.length > 0);

  // ── Journal des actions + flash d'attaque sur le board ──────────────────────
  interface LogEntry { text: string; owner?: string; sub?: boolean; sep?: boolean }
  let log = $state<LogEntry[]>([]);
  let logMarks: number[] = [];              // longueur du journal à chaque coup (pour l'annulation)
  let logBox = $state<HTMLDivElement>();
  interface AttackFx { x1: number; y1: number; x2: number; y2: number; color: string; marker: string; n: number }
  let attacks = $state<AttackFx[]>([]);     // flèches transitoires (attaque rouge/teal · soin vert)
  let atkSeq = 0;
  const tileById = $derived(new Map(geo.tiles.map((t) => [t.id, t] as const)));
  const unitName = (un: Unit) => un.name ?? KIND_NAME[un.kind] ?? un.kind;

  function pushLog(text: string, owner?: string, opts: { sub?: boolean; sep?: boolean } = {}) {
    log = [...log, { text, owner, ...opts }];
    if (log.length > 200) log = log.slice(-200);
  }
  // Conséquences d'une action (dégâts / soins / morts) par DIFF d'état → robuste : couvre aussi
  // le tir réservé et les Résonances (épines…), pas seulement l'attaque directe.
  function diffLog(before: CombatState, after: CombatState) {
    for (const b of before.units) {
      const a = after.units.find((un) => un.id === b.id);
      if (!a) { pushLog(`✶ ${unitName(b)} éliminé`, b.owner, { sub: true }); continue; }
      const d = a.hp - b.hp;
      if (d < 0) pushLog(`${unitName(a)} −${-d} PV`, a.owner, { sub: true });
      else if (d > 0) pushLog(`${unitName(a)} +${d} PV`, a.owner, { sub: true });
    }
  }
  function flashFx(fromHex: string, toHex: string, color: string, marker: string) {
    const f = tileById.get(fromHex), t = tileById.get(toHex);
    if (!f || !t) return;
    const n = ++atkSeq;
    attacks = [...attacks, { x1: f.cx, y1: f.cy, x2: t.cx, y2: t.cy, color, marker, n }];
    setTimeout(() => { attacks = attacks.filter((a) => a.n !== n); }, 1500);
  }
  const flashAttack = (fromHex: string, toHex: string, owner: string) => flashFx(fromHex, toHex, COLORS[owner] ?? '#888', `atkhead-${owner}`);
  const flashHeal = (fromHex: string, toHex: string) => flashFx(fromHex, toHex, '#2a9d76', 'atkhead-heal');
  // Tirs réservés déclenchés par un déplacement : flèche de chaque guetteur qui a tiré → la cible.
  function flashOverwatch(before: CombatState, after: CombatState, targetHex: string) {
    for (const b of before.units) {
      const a = after.units.find((un) => un.id === b.id);
      if (b.watching && a && !a.watching) flashAttack(b.hex, targetHex, b.owner);
    }
  }
  // Snapshot pour l'annulation : empile l'état ET la longueur courante du journal.
  function snapshot() { history = [...history, combat]; logMarks = [...logMarks, log.length]; }
  function clearLog() { log = []; logMarks = []; attacks = []; }
  function newTurnLog() { pushLog(`— Tour de ${NAMES[combat.active]} —`, combat.active, { sep: true }); }
  // Journalise une action de l'IA (miroir des handlers humains).
  function logAiAction(before: CombatState, after: CombatState, act: AiAction) {
    if (act.type === 'move') {
      const m = before.units.find((u) => u.id === act.unitId);
      if (m) { pushLog(`${unitName(m)} se déplace`, m.owner); flashOverwatch(before, after, act.dest); }
      diffLog(before, after);
    } else if (act.type === 'attack') {
      const atk = before.units.find((u) => u.id === act.attackerId);
      const def = before.units.find((u) => u.id === act.targetId);
      if (atk && def) { flashAttack(atk.hex, def.hex, atk.owner); pushLog(`⚔ ${unitName(atk)} → ${unitName(def)}`, atk.owner); }
      diffLog(before, after);
    } else if (act.type === 'guard') {
      const u = before.units.find((x) => x.id === act.unitId); if (u) pushLog(`🛡 ${unitName(u)} se met en garde`, u.owner);
    } else if (act.type === 'reserve') {
      const u = before.units.find((x) => x.id === act.unitId); if (u) pushLog(`🎯 ${unitName(u)} réserve son tir`, u.owner);
    } else if (act.type === 'heal') {
      const h = before.units.find((x) => x.id === act.healerId);
      const tg = before.units.find((x) => x.id === act.targetId);
      if (h && tg) { flashHeal(h.hex, tg.hex); pushLog(`✚ ${unitName(h)} soigne ${unitName(tg)}`, h.owner); }
      diffLog(before, after);
    } else if (act.type === 'endTurn') {
      pushLog(`— Tour de ${NAMES[after.active]} —`, after.active, { sep: true });
    }
  }
  // Auto-scroll du journal vers le bas à chaque nouvelle ligne.
  $effect(() => { void log.length; if (logBox) logBox.scrollTop = logBox.scrollHeight; });
  // Sort du mode soin dès qu'il n'est plus pertinent (sélection changée, tour passé, plus de cible).
  $effect(() => { if (healMode && !canHealVerb) healMode = false; });

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
  const reach = $derived(over || aiThinking || !selected ? new Map<string, number>() : reachable(combat, selected.id, moveBudget(selected)));

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
  const canHitFoe = $derived(!!selected && !!foe && !over && !aiThinking && canAttack(combat, selected.id, foe.id));
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

  // SOIN : la pièce sélectionnée peut-elle soigner (verbe Soigneur) ? + cibles alliées valides.
  const canHealVerb = $derived(!!selected && !over && !aiThinking && !!selected.heal
    && combat.units.some((a) => canHeal(combat, selected!.id, a.id)));
  const healReach = $derived.by(() => {
    const set = new Set<string>();
    if (!healMode || !selected) return set;
    for (const a of combat.units) if (canHeal(combat, selected.id, a.id)) set.add(a.hex);
    return set;
  });

  function toggleHeal() { if (canHealVerb) healMode = !healMode; }

  function healAlly(targetHex: string) {
    const target = unitAt(combat, targetHex);
    if (!selected || !target || !canHeal(combat, selected.id, target.id)) return;
    snapshot();
    const before = combat;
    const healerHex = selected.hex, owner = selected.owner;
    const healerName = unitName(selected), targetName = unitName(target);
    combat = healUnit(combat, selected.id, target.id);
    flashHeal(healerHex, targetHex);
    pushLog(`✚ ${healerName} soigne ${targetName}`, owner);
    diffLog(before, combat);
    healMode = false;
  }

  function attackFoe() {
    if (!selected || !foe || !canAttack(combat, selected.id, foe.id)) return;
    snapshot();
    const before = combat;
    const who = selected.characterId;                                  // capturés avant la mutation d'état
    const atkHex = selected.hex, defHex = foe.hex, owner = selected.owner;
    const atkName = unitName(selected), defName = unitName(foe);
    combat = attack(combat, selected.id, foe.id);
    flashAttack(atkHex, defHex, owner);
    pushLog(`⚔ ${atkName} → ${defName}`, owner);
    diffLog(before, combat);
    unlock('m_attack');
    if (who === 'bastion' && ++bastionHits >= 3) unlock('h_bastion3');  // objectif « 3 attaques avec Bastion »
  }

  function selectDefault() {
    selectedId = combat.units.find((u) => u.owner === combat.active)?.id ?? '';
  }

  function onHex(hexId: string) {
    if (dragMoved) { dragMoved = false; return; } // glissé en cours → on n'interprète pas le clic
    if (over || aiThinking) return;
    // MODE SOIN (Soigneur) : un clic sur un allié à portée le soigne ; ailleurs → annule le mode.
    if (healMode) {
      if (selected && healReach.has(hexId)) { healAlly(hexId); return; }
      healMode = false;
    }
    const occ = unitAt(combat, hexId);
    // Clic sur une de mes pièces → la sélectionner.
    if (occ && occ.owner === combat.active) { selectedId = occ.id; return; }
    // Clic sur une pièce adverse → l'inspecter (panneau adverse + sa portée) ; l'attaque
    // se déclenche ensuite via le bouton ⚔ Attaquer du panneau.
    if (occ && occ.owner !== combat.active) { inspectedId = occ.id; return; }
    if (!selected) return;
    // Clic sur une case atteignable → s'y déplacer (puis tirs réflexes des guetteurs adverses).
    if (reach.has(hexId)) {
      snapshot();
      const before = combat;
      const moverName = unitName(selected), moverOwner = selected.owner, moverId = selected.id;
      combat = resolveOverwatch(moveUnit(combat, moverId, hexId), moverId);
      pushLog(`${moverName} se déplace`, moverOwner);
      flashOverwatch(before, combat, hexId);   // tirs réservés adverses déclenchés à l'arrivée
      diffLog(before, combat);
      unlock('m_move');
    }
  }

  const canGuard = $derived(!!selected && !over && !aiThinking && canDefend(combat, selected.id));
  const canWatch = $derived(!!selected && !over && !aiThinking && canReserve(combat, selected.id));
  const canParry = $derived(!!selected && !over && !aiThinking && canRiposte(combat, selected.id));

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
    snapshot();
    const n = unitName(selected), o = selected.owner;
    combat = defend(combat, selected.id);
    pushLog(`🛡 ${n} se met en garde`, o);
  }

  function reserveSelected() {
    if (!selected || !canReserve(combat, selected.id)) return;
    snapshot();
    const n = unitName(selected), o = selected.owner;
    combat = reserve(combat, selected.id);
    pushLog(`🎯 ${n} réserve son tir`, o);
  }

  function riposteSelected() {
    if (!selected || !canRiposte(combat, selected.id)) return;
    snapshot();
    const n = unitName(selected), o = selected.owner;
    combat = riposte(combat, selected.id);
    pushLog(`🗡 ${n} arme sa riposte`, o);
  }

  function undo() {
    if (history.length === 0) return;
    combat = history[history.length - 1]!;
    history = history.slice(0, -1);
    const mark = logMarks.pop();
    if (mark !== undefined) { log = log.slice(0, mark); attacks = []; }
  }

  function finishTurn() {
    if (over || aiThinking) return;
    combat = endTurn(combat, AP_PER_TURN);
    history = []; logMarks = [];
    newTurnLog();
    inspectedId = '';
    // UNIQUEMENT EN TUTO : l'adversaire est scripté (le moteur, lui, reste neutre).
    if (tutoActive && combat.active === 'bob') tutoEnemyTurn();
    // VS IA : le moteur d'IA joue le tour de Bob, action par action (animé).
    else if (opponent === 'ia' && combat.active === 'bob' && !winner(combat)) { runAiTurn(); return; }
    selectDefault();
  }

  // Auto-play du tour adverse : on planifie tout le tour (pur), puis on rejoue les actions une
  // par une avec un court délai → on voit l'IA bouger. Entrées gelées via `aiThinking`.
  let aiTimer: ReturnType<typeof setTimeout> | undefined;
  function cancelAi() { if (aiTimer) { clearTimeout(aiTimer); aiTimer = undefined; } aiThinking = false; }
  function runAiTurn() {
    aiThinking = true;
    selectedId = '';
    inspectedId = '';
    const actions = planTurn(combat, aiLevel); // suite d'actions terminée par endTurn
    let i = 0;
    const step = () => {
      aiTimer = undefined;
      if (i >= actions.length || winner(combat)) { aiThinking = false; selectDefault(); return; }
      const before = combat;
      const act = actions[i++]!;
      combat = applyAction(combat, act, AP_PER_TURN);
      logAiAction(before, combat, act);
      aiTimer = setTimeout(step, AI_STEP_MS);
    };
    aiTimer = setTimeout(step, AI_STEP_MS);
  }

  function restart() {
    cancelAi();
    combat = initialFor(geo, lineupOf(pick), lineupOf(pick));
    history = [];
    selectedId = 'a1';
    inspectedId = '';
    clearLog();
    newTurnLog();
  }

  function setMode(m: Mode) {
    mode = m;
    geo = buildBoard(shape, SIZE[shape][m]);
    resetView();
    restart();
  }

  // Change la FORME du plateau (comparaison live) : reconstruit la topologie + redéploie.
  function setShape(s: Shape) {
    shape = s;
    geo = buildBoard(s, SIZE[s][mode]);
    resetView();
    restart();
  }

  // Lance une partie depuis l'écran de setup (plateau + escouades choisies).
  function startGame() {
    cancelAi();
    geo = buildBoard(shape, SIZE[shape][mode]);
    resetView();
    combat = initialFor(geo, lineupOf(pick), lineupOf(pick));
    history = [];
    selectedId = 'a1';
    inspectedId = '';
    clearLog();
    newTurnLog();
    phase = 'combat';
  }
  function newGame() { cancelAi(); phase = 'setup'; }
  // Aperçu des deux escouades dans l'écran de setup.
  const aliceLineup = $derived(lineupOf(pick).map((id) => CHAR_NAME[id] ?? id));
  const bobLineup = $derived(lineupOf(pick).map((id) => CHAR_NAME[id] ?? id));

  // ── TUTORIEL JOUABLE ───────────────────────────────────────────────────────
  // Mini-scénario RÉEL (vraie CombatState, mêmes handlers que la partie) : la Lourde
  // + le Tireur d'Alice face à un ennemi robuste. 6 étapes guidées, chacune détectée
  // sur l'état du jeu (pas de mode spécial dans le moteur — on observe, on n'impose pas).
  let tutoStep = $state(-1);  // -1 = tuto inactif ; 0..N-1 = étape courante ; N = terminé
  let tuto = $state<{ lourde: string; tireur: string; enemy: string; enemyHp: number } | null>(null);
  let tutoEnemyTurns = $state(0);  // nb de tours adverses scriptés déjà joués (détecte les étapes « finir le tour »)
  const tutoActive = $derived(tutoStep >= 0);

  // Place Bastion (Lourde) au coin, Mireille (Tireur) à côté, un ennemi robuste à 2 cases
  // (la Lourde le rejoint en 1 pas) — BFS déterministe, agnostique à la forme du plateau.
  function tutorialState(g: Geo): CombatState {
    const c0 = g.corners[0];
    const byId = new Map(g.map.hexes.map((h) => [h.id, h] as const));
    const nb = (id: string) => byId.get(id)?.neighbors ?? [];
    const dist = new Map<string, number>([[c0, 0]]);
    const order: string[] = [c0];
    let frontier = [c0];
    for (let d = 1; d <= 4; d++) {
      const next: string[] = [];
      for (const h of frontier) for (const x of nb(h)) if (!dist.has(x)) { dist.set(x, d); order.push(x); next.push(x); }
      frontier = next;
    }
    const d1 = order.filter((id) => dist.get(id) === 1);
    const tireurHex = d1.find((id) => !id.startsWith('s:')) ?? d1[0]!;
    // Ennemi à 2 cases AVEC un voisin libre à 1 case (≠ Tireur) → la Lourde peut le rejoindre.
    const enemyHex = order.find((id) => dist.get(id) === 2 && nb(id).some((x) => dist.get(x) === 1 && x !== tireurHex))
      ?? order.find((id) => dist.get(id) === 2) ?? d1[0]!;
    return makeCombatState(g.map, [
      makeUnitFromCharacter('a1', 'alice', c0, CHARACTERS.bastion!, AP_PER_TURN),
      makeUnitFromCharacter('a2', 'alice', tireurHex, CHARACTERS.mireille!, AP_PER_TURN),
      makeUnitFromCharacter('b1', 'bob', enemyHex, CHARACTERS.rempart!, AP_PER_TURN),
    ], 'alice');
  }

  const tunit = (id: string | undefined) => combat.units.find((u) => u.id === id);
  const tunitHex = (id: string) => tunit(id)?.hex ?? '';
  const lourdeAtContact = () => {
    const l = tunit(tuto?.lourde), e = tunit(tuto?.enemy);
    return !!l && !!e && rangeSet(l.hex, l.range).has(e.hex);
  };

  // TOUR ADVERSE SCRIPTÉ — uniquement appelé pendant le tuto (via finishTurn). Pilote les
  // fonctions PUBLIQUES du moteur, comme un humain : avance d'un pas si besoin, puis frappe
  // UNE fois (un seul coup → dégâts prévisibles), puis rend la main à Alice.
  function tutoEnemyTurn() {
    const eId = tuto?.enemy, lId = tuto?.lourde;
    if (eId && lId) {
      if (!canAttack(combat, eId, lId)) {               // pas au contact → s'approcher (avance)
        const e = tunit(eId);
        const step = e ? stepToward(combat.map, e.hex, tunitHex(lId), new Set(combat.units.map((u) => u.hex))) : undefined;
        if (step) { const b = combat; const nm = unitName(tunit(eId)!); combat = resolveOverwatch(moveUnit(combat, eId, step), eId); pushLog(`${nm} se déplace`, 'bob'); diffLog(b, combat); }
      }
      if (canAttack(combat, eId, lId)) {                // frappe
        const b = combat; const atk = tunit(eId)!, def = tunit(lId)!;
        const ah = atk.hex, dh = def.hex, an = unitName(atk), dn = unitName(def);
        combat = attack(combat, eId, lId);
        flashAttack(ah, dh, 'bob'); pushLog(`⚔ ${an} → ${dn}`, 'bob'); diffLog(b, combat);
      }
    }
    tutoEnemyTurns += 1;
    combat = endTurn(combat, AP_PER_TURN);              // repasse à Alice
    newTurnLog();
  }

  type TutoBtn = 'attack' | 'watch' | 'guard' | 'end';
  interface TutoStep { text: string; done: () => boolean; focus: () => string[]; btn?: TutoBtn }
  const TUTO_STEPS: TutoStep[] = [
    { text: '1 / 8 — Clique ta Lourde 🛡 (le pion qui clignote) pour la sélectionner.',
      done: () => selectedId === tuto?.lourde, focus: () => (tuto ? [tunitHex(tuto.lourde)] : []) },
    { text: '2 / 8 — Amène-la au contact : clique une case verte collée à l’ennemi.',
      done: () => lourdeAtContact(), focus: () => (tuto ? [tunitHex(tuto.enemy)] : []) },
    { text: '3 / 8 — Clique la pièce adverse pour l’inspecter (sa portée s’affiche).',
      done: () => inspectedId === tuto?.enemy, focus: () => (tuto ? [tunitHex(tuto.enemy)] : []) },
    { text: '4 / 8 — Frappe-la : bouton ⚔ Attaquer (il brille) dans le panneau de droite.',
      done: () => !!tuto && (tunit(tuto.enemy)?.hp ?? 0) < tuto.enemyHp, focus: () => (tuto ? [tunitHex(tuto.enemy)] : []), btn: 'attack' },
    { text: '5 / 8 — Sélectionne ton Tireur 🎯 puis clique « 🎯 Réserver » (tir réflexe).',
      done: () => !!tunit(tuto?.tireur)?.watching, focus: () => (tuto ? [tunitHex(tuto.tireur)] : []), btn: 'watch' },
    { text: '6 / 8 — Termine avec « Finir le tour ⏩ » : ton adversaire va jouer.',
      done: () => tutoEnemyTurns >= 1, focus: () => [], btn: 'end' },
    { text: '7 / 8 — L’ennemi a frappé ta Lourde ! Sélectionne-la et clique « 🛡 Garder » pour diviser les dégâts.',
      done: () => !!tunit(tuto?.lourde)?.guarding, focus: () => (tuto ? [tunitHex(tuto.lourde)] : []), btn: 'guard' },
    { text: '8 / 8 — Finis ton tour : la Garde encaisse le prochain coup à moitié.',
      done: () => tutoEnemyTurns >= 2, focus: () => [], btn: 'end' },
  ];
  const tutoDone = $derived(tutoActive && tutoStep >= TUTO_STEPS.length);
  const tutoFocus = $derived.by(() =>
    tutoActive && tutoStep < TUTO_STEPS.length ? new Set(TUTO_STEPS[tutoStep]!.focus()) : new Set<string>());
  // Bouton à faire briller pour l'étape courante (undefined si l'action est un clic sur le plateau).
  const tutoBtn = $derived(tutoActive && tutoStep < TUTO_STEPS.length ? TUTO_STEPS[tutoStep]!.btn : undefined);

  // Avance d'une étape dès que sa condition est remplie (peut enchaîner si déjà satisfaite).
  $effect(() => {
    if (tutoStep < 0 || !tuto || tutoStep >= TUTO_STEPS.length) return;
    if (TUTO_STEPS[tutoStep]!.done()) tutoStep += 1;
  });

  function startTutorial() {
    // Le tuto se joue toujours sur le petit hexagone d'Entraînement (plateau resserré, lisible).
    if (mode !== 'entrainement' || shape !== 'hex') {
      mode = 'entrainement'; shape = 'hex'; geo = buildBoard('hex', SIZE.hex.entrainement); resetView();
    }
    combat = tutorialState(geo);
    history = [];
    inspectedId = '';
    selectedId = '';  // l'étape 1 EST de sélectionner la Lourde
    clearLog();
    newTurnLog();
    tutoEnemyTurns = 0;
    tuto = { lourde: 'a1', tireur: 'a2', enemy: 'b1', enemyHp: tunit('b1')!.hp };
    tutoStep = 0;
  }
  function endTutorial() {
    tutoStep = -1;
    tuto = null;
    restart();  // bascule sur une vraie partie (line-up complet)
  }

  // ── OBJECTIFS / SUCCÈS ─────────────────────────────────────────────────────
  // Checklist d'onboarding : la DÉTECTION est pure (`engine/objectives.ts`, diff d'état) ; la vue ne
  // garde que l'effet de bord (localStorage + toast). `m_move`/`m_attack`/`h_bastion3` restent hookés
  // sur TES actions (handlers + compteur `bastionHits`) → on ne crédite jamais un coup adverse.
  function loadAch(): Set<string> {
    try { const r = localStorage.getItem('achievements'); return new Set<string>(r ? JSON.parse(r) : []); }
    catch { return new Set<string>(); }
  }
  let achievements = $state<Set<string>>(loadAch());
  let showObjectives = $state(false);
  let justUnlocked = $state<string | null>(null);
  let bastionHits = 0;           // compteur (non réactif) — attaques portées par Bastion
  const objDone = $derived(OBJECTIVES.filter((o) => achievements.has(o.id)).length);
  $effect(() => { try { localStorage.setItem('achievements', JSON.stringify([...achievements])); } catch { /* noop */ } });
  // Toast éphémère au déblocage.
  $effect(() => { if (justUnlocked) { const t = setTimeout(() => { justUnlocked = null; }, 2800); return () => clearTimeout(t); } });

  function unlock(id: string) {
    if (achievements.has(id)) return;
    achievements = new Set(achievements).add(id);
    justUnlocked = id;
  }
  function resetAchievements() {
    achievements = new Set();
    bastionHits = 0;
    justUnlocked = null;
  }

  // Observateur : diff de `combat` à chaque coup → la détection PURE (`detectUnlocks`) rend les ids
  // nouvellement atteints ; la vue ne fait que les `unlock` (toast + archivage).
  let prevSnap: CombatState | undefined;
  $effect(() => {
    const cur = combat;             // dépendance suivie
    const prev = prevSnap;
    prevSnap = cur;
    if (!prev || prev === cur) return;
    for (const id of detectUnlocks(prev, cur, achievements)) unlock(id);
  });
</script>

<div class="combat">
  <!-- Pictogrammes SVG d'état / d'effet — partagés par le plateau ET la matrice de Résonance.
       Définis au niveau racine pour être visibles des deux. À rendre DANS un <svg>. -->
  {#snippet stateGlyph(key: string)}
    {#if key === 'guard'}
      <path d="M12 2 L20 5.5 V12 C20 16.5 16.5 19.8 12 21.5 C7.5 19.8 4 16.5 4 12 V5.5 Z" fill="#fff" />
      <path d="M12 5.2 L17.2 7.5 V12 C17.2 15.2 15 17.2 12 18.4 C9 17.2 6.8 15.2 6.8 12 V7.5 Z" fill="none" stroke="#3266ad" stroke-width="1.5" />
    {:else if key === 'watch'}
      <circle cx="12" cy="12" r="6.8" fill="none" stroke="#fff" stroke-width="2.2" />
      <path d="M12 2.5 V5.4 M12 18.6 V21.5 M2.5 12 H5.4 M18.6 12 H21.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="12" cy="12" r="1.7" fill="#fff" />
    {:else if key === 'riposte'}
      <path d="M17 9 H7 M11 5.5 L6.5 9 L11 12.5" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M7 15 H17 M13 11.5 L17.5 15 L13 18.5" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
    {:else if key === 'block'}
      <path d="M12 2.5 L20 7 V16.5 L12 21 L4 16.5 V7 Z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round" />
    {:else if key === 'vendetta'}
      <path d="M12 3 V14 M8.4 14 H15.6 M12 14 V18" stroke="#fff" stroke-width="2.4" stroke-linecap="round" />
      <circle cx="12" cy="19.6" r="1.7" fill="#fff" />
    {:else if key === 'cover'}
      <rect x="4" y="8" width="13.5" height="8" rx="1.6" fill="none" stroke="#fff" stroke-width="2" />
      <rect x="18.4" y="10.4" width="2.6" height="3.2" rx="0.6" fill="#fff" />
      <rect x="6.2" y="10" width="2.6" height="4" fill="#fff" />
      <rect x="9.8" y="10" width="2.6" height="4" fill="#fff" />
    {:else if key === 'appui'}
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="#fff" stroke-width="2" />
      <circle cx="12" cy="12" r="4.6" fill="none" stroke="#fff" stroke-width="2" />
      <circle cx="12" cy="12" r="1.7" fill="#fff" />
    {:else if key === 'stuncharge'}
      <path d="M12 2 L13.8 10.2 L22 12 L13.8 13.8 L12 22 L10.2 13.8 L2 12 L10.2 10.2 Z" fill="#fff" />
    {:else if key === 'mark'}
      <path d="M12 3.2 L19.5 12 L12 20.8 L4.5 12 Z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" />
      <path d="M7 12 H17" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="12" cy="12" r="1.7" fill="#fff" />
    {:else if key === 'cripple'}
      <ellipse cx="12" cy="10.2" rx="4.3" ry="3.4" fill="#fff" />
      <ellipse cx="12" cy="16.2" rx="2.7" ry="2.9" fill="#fff" />
      <circle cx="8.9" cy="6.1" r="1.05" fill="#fff" />
      <circle cx="11" cy="5.3" r="1.15" fill="#fff" />
      <circle cx="13.2" cy="5.5" r="1.05" fill="#fff" />
      <circle cx="15" cy="6.4" r="0.95" fill="#fff" />
      <path d="M5.6 14.6 L14.4 8.2 M7.1 17.4 L16.6 10.4 M9 19.8 L18.2 13" stroke="#c9543a" stroke-width="2" stroke-linecap="round" />
    {:else if key === 'stun'}
      <path d="M12 4 A8 8 0 1 1 4 12 A5 5 0 1 1 14 12 A2.2 2.2 0 1 1 10 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" />
    {:else if key === 'silence'}
      <circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="2.2" />
      <path d="M6.3 6.3 L17.7 17.7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" />
    {:else if key === 'root'}
      <circle cx="12" cy="4.5" r="2.1" fill="none" stroke="#fff" stroke-width="2" />
      <path d="M12 6.6 V20 M12 12 C9 15 7.5 16.5 6 20 M12 12 C15 15 16.5 16.5 18 20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    {:else if key === 'charge'}
      <path d="M5 13 L12 7 L19 13 M5 19 L12 13 L19 19" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    {:else if key === 'epines'}
      <path d="M12 2 L13.4 8.6 L18.5 5.5 L15.4 10.6 L22 12 L15.4 13.4 L18.5 18.5 L13.4 15.4 L12 22 L10.6 15.4 L5.5 18.5 L8.6 13.4 L2 12 L8.6 10.6 L5.5 5.5 L10.6 8.6 Z" fill="#fff" />
    {:else if key === 'provocation'}
      <circle cx="8" cy="12" r="2.1" fill="#fff" />
      <path d="M21 12 H12 M15 8.4 L11.4 12 L15 15.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    {:else if key === 'ralliement'}
      <path d="M7 3 V21" stroke="#fff" stroke-width="2.2" stroke-linecap="round" />
      <path d="M7.8 4 H17 L14 7.5 L17 11 H7.8 Z" fill="#fff" />
    {:else if key === 'ruee'}
      <path d="M5 5 L12 12 L5 19 M12 5 L19 12 L12 19" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    {:else if key === 'heal'}
      <path d="M9.5 4 H14.5 V9.5 H20 V14.5 H14.5 V20 H9.5 V14.5 H4 V9.5 H9.5 Z" fill="#fff" />
    {/if}
  {/snippet}
  <div class="layout">
    <aside class="controls">
    <div class="turn">Tour <b>{combat.turn}</b></div>
    {#if !over}
      <div class="active" style="--c:{COLORS[combat.active]}">
        Au tour de <b>{NAMES[combat.active]}</b>
        {#if opponent === 'ia' && combat.active === 'bob'}<span class="aitag">🤖 {aiThinking ? 'réfléchit…' : 'IA'}</span>{/if}
      </div>
    {/if}
    <div class="shape">
      <button class:on={mode === 'entrainement'} onclick={() => setMode('entrainement')} disabled={aiThinking} title="Petit plateau — tuto & practice">🎓 Entraînement</button>
      <button class:on={mode === 'partie'} onclick={() => setMode('partie')} disabled={aiThinking} title="Grand plateau — vraie partie">⚔ Partie</button>
    </div>
    <div class="shape">
      {#each ['octa', 'hex', 'square'] as const as sh}
        <button class:on={shape === sh} onclick={() => setShape(sh)} disabled={aiThinking} title="Comparer la forme du plateau">{FORME_LABEL[sh]}</button>
      {/each}
    </div>
    <div class="zoom">
      <button onclick={() => zoomCenter(1 / 1.3)} title="Dézoomer" aria-label="Dézoomer">−</button>
      <button onclick={() => zoomCenter(1.3)} title="Zoomer" aria-label="Zoomer">+</button>
      <button onclick={resetView} title="Ajuster à l'écran" aria-label="Ajuster à l'écran">⤢</button>
    </div>
    <button class="undo" onclick={undo} disabled={!acted || aiThinking}>↩ Annuler</button>
    <button class="end-turn" class:tutoglow={tutoBtn === 'end'} onclick={finishTurn} disabled={over || aiThinking}>Finir le tour ⏩</button>
    <button class="restart" onclick={restart} disabled={aiThinking}>Recommencer</button>
    <button class="newgame" onclick={newGame} disabled={aiThinking}>⚙ Nouvelle partie</button>
    {#if tutoActive}
      <button class="tuto-btn on" onclick={endTutorial}>✕ Quitter le tuto</button>
    {:else}
      <button class="tuto-btn" onclick={startTutorial}>▶ Tutoriel jouable</button>
    {/if}
    <details class="settings">
      <summary>⚙ Menu</summary>
      <button class="menu-link" onclick={() => (showHelp = true)}>❔ Comment jouer</button>
    </details>
    </aside>

    <div class="board">
    {#if over}
      <div class="banner" style="--c:{COLORS[champ!]}">
        🏁 <b>{NAMES[champ!]}</b> remporte le duel.
        <button class="rematch" onclick={restart}>Revanche</button>
      </div>
    {/if}
    {#if tutoActive && !tutoDone}
      <div class="tutobar">
        <span class="tutostep">{TUTO_STEPS[tutoStep]!.text}</span>
        <button class="tutoskip" onclick={endTutorial}>Passer ✕</button>
      </div>
    {/if}
    {#if tutoDone}
      <div class="tutodone">
        🎉 <b>Tu sais jouer&nbsp;!</b> Déplacement, attaque, tir réservé, et la <b>Garde</b> qui a divisé les dégâts du contre adverse.
        <button class="tutogo" onclick={endTutorial}>Commencer une vraie partie ▶</button>
      </div>
    {/if}

    <svg bind:this={svgEl} viewBox="{view.x} {view.y} {view.w} {view.h}" class="map" style={mapStyle}
       role="application" aria-label="Plateau de jeu — molette pour zoomer, glisser pour déplacer"
       onwheel={onWheel} onpointerdown={onPointerDown} onpointermove={onPointerMove}
       onpointerup={onPointerUp} onpointercancel={onPointerUp}>
    <defs>
      <marker id="atkhead-alice" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" refX="7" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill={COLORS.alice} /></marker>
      <marker id="atkhead-bob" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" refX="7" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill={COLORS.bob} /></marker>
      <marker id="atkhead-heal" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" refX="7" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#2a9d76" /></marker>
    </defs>
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
        {#if tutoFocus.has(t.id)}<polygon points={t.points} class="tutoring" />{/if}
        {#if inAlly}<polygon points={t.points} class="rng-ally" />{/if}
        {#if inFoe}<polygon points={t.points} class="rng-foe" />{/if}
        {#if healReach.has(t.id)}<polygon points={t.points} class="heal-target" />{/if}
        {#if occ}
          {@const isSel = occ.id === selectedId && occ.owner === combat.active && !over}
          {@const frac = occ.hp / occ.maxHp}
          {@const r = t.small ? 9 : 12}
          {@const w = t.small ? 16 : 22}
          {@const by = t.small ? 9 : 12}
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
        {:else if inReach}
          <text x={t.cx} y={t.cy + 4} class="dist">{d}</text>
        {/if}
      </g>
    {/each}
    <!-- OVERLAY : marqueurs d'état — pastilles colorées (famille) + pictogramme SVG sur mesure.
         Rendus APRÈS tous les hexes → jamais masqués par un voisin. -->
    {#each geo.tiles as t (t.id)}
      {@const occ = unitAt(combat, t.id)}
      {#if occ && !over}
        {@const states = pieceStates(occ)}
        {@const r = t.small ? 9 : 12}
        {@const cs = t.small ? 11 : 13}
        {@const gap = 2.5}
        {@const cyc = t.cy - r - 12}
        {#each states as st, i}
          {@const cxc = t.cx + (i - (states.length - 1) / 2) * (cs + gap)}
          <g class="stchip">
            <circle cx={cxc} cy={cyc} r={cs / 2} fill={STATE_FAM_COLOR[st.fam]} stroke="#0e1015" stroke-width="1" />
            <g transform="translate({cxc - cs / 2} {cyc - cs / 2}) scale({cs / 24})">
              {@render stateGlyph(st.key)}
            </g>
          </g>
        {/each}
      {/if}
    {/each}
    <!-- OVERLAY : flèches d'attaque transitoires (origine → cible) + halo sur la victime. -->
    {#each attacks as a (a.n)}
      <line class="atkfx" x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={a.color} marker-end="url(#{a.marker})" />
      <circle class="atkpulse" cx={a.x2} cy={a.y2} stroke={a.color} />
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
                  <div class="amt">silence la cible : déplacement uniquement (ni attaque/verbe/Résonance) · {rx.duration ?? 2} tours</div>
                {:else if rx.kind === 'racine'}
                  <div class="amt">enracine la cible : déplacement → 0 (attaques/verbes intacts) · {rx.duration ?? 2} tours</div>
                {:else if rx.kind === 'couverture'}
                  <div class="amt">le possesseur gagne +{rx.amount ?? 1} PA/tour · {rx.duration ?? 2} tours</div>
                {:else if rx.kind === 'charge'}
                  <div class="amt">le possesseur gagne +{rx.amount ?? 1} déplacement · {rx.duration ?? 1} tour(s)</div>
                {:else if rx.kind === 'appui'}
                  <div class="amt">+{rx.amount ?? 1} dégâts aux attaques de l'allié · {rx.duration ?? 2} tours</div>
                {:else if rx.kind === 'regen'}
                  <div class="amt">régénère l'allié de +{rx.amount ?? 1} PV/tour · {rx.duration ?? 2} tours (plafonné)</div>
                {:else if rx.kind === 'soin'}
                  <div class="amt">soigne l'allié de +{rx.amount ?? 1} PV instantanément (plafonné)</div>
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
          <div class="pv">PV <b>{selected.hp}/{selected.maxHp}</b>
            <span class="bar"><span style="width:{Math.max(0, 100 * selected.hp / selected.maxHp)}%; background:{selected.hp / selected.maxHp > 0.4 ? '#5ab0a0' : '#e0604a'}"></span></span>
          </div>
          <div class="pstats"><span>PA <b>{selected.ap}</b>/{AP_PER_TURN}</span><span>Mobilité <b>{moveBudget(selected)}</b> pas</span><span>Portée <b>{selected.range}</b></span><span>Dégâts <b>{selected.damage}</b></span></div>
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
          {#if selected.silence}
            <div class="ptags"><span class="tag s">🔇 Silencé — déplacement uniquement (⏳{selected.silence.expiresIn})</span></div>
          {/if}
          {#if selected.cover}
            <div class="ptags"><span class="tag e">🔋 Couverture — +{selected.cover.amount} PA/tour (⏳{selected.cover.expiresIn})</span></div>
          {/if}
          {#if selected.appui}
            <div class="ptags"><span class="tag v">🔥 Appui-feu — +{selected.appui.amount} dégâts (⏳{selected.appui.expiresIn})</span></div>
          {/if}
          {@render reson(selected, resonAlly, () => (resonAlly = !resonAlly))}
          <div class="pacts">
            {#if selected.guard}
              <button class="defend" class:on={selected.guarding} class:tutoglow={tutoBtn === 'guard'} onclick={defendSelected} disabled={!canGuard}
                title={`GARDE (${selected.guard.cost} PA) : posture défensive jusqu'à ton prochain tour — dégâts subis réduits (×${selected.guard.damageTakenMul}). Encaisser une attaque en garde déclenche les Résonances de tes alliés.`}>
                {selected.guarding ? '🛡 En garde' : `🛡 Garder (${selected.guard.cost})`}
              </button>
            {/if}
            {#if selected.overwatch}
              <button class="watch" class:on={selected.watching} class:tutoglow={tutoBtn === 'watch'} onclick={reserveSelected} disabled={!canWatch}
                title={`TIR RÉSERVÉ (${selected.overwatch.cost} PA) : prépare un tir réflexe jusqu'à ton prochain tour — frappe la 1ʳᵉ pièce ennemie qui s'arrête dans ta zone de menace. Déclenche les Résonances « tir réservé ».`}>
                {selected.watching ? '🎯 Tir réservé' : `🎯 Réserver (${selected.overwatch.cost})`}
              </button>
            {/if}
            {#if selected.riposte}
              <button class="riposte" class:on={selected.riposting} onclick={riposteSelected} disabled={!canParry}
                title={`RIPOSTE (${selected.riposte.cost} PA) : arme un contre jusqu'à ton prochain tour ou ton 1ᵉʳ contre — si un ennemi adjacent t'attaque et que tu survis, tu le frappes en retour. Déclenche les Résonances « riposte ».`}>
                {selected.riposting ? '🗡 Riposte armée' : `🗡 Riposter (${selected.riposte.cost})`}
              </button>
            {/if}
            {#if selected.heal}
              <button class="heal" class:on={healMode} onclick={toggleHeal} disabled={!canHealVerb}
                title={`SOIN (${selected.heal.cost} PA) : rend ${selected.heal.amount} PV à un allié à ≤${selected.heal.range} cases (plafonné). Clique le bouton puis une case verte.`}>
                {healMode ? '✚ Choisis un allié…' : `✚ Soigner (${selected.heal.cost})`}
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
          {#if foe.silence}
            <div class="ptags"><span class="tag s">🔇 Silencé — déplacement uniquement (⏳{foe.silence.expiresIn})</span></div>
          {/if}
          {#if foe.cover}
            <div class="ptags"><span class="tag e">🔋 Couverture — +{foe.cover.amount} PA/tour (⏳{foe.cover.expiresIn})</span></div>
          {/if}
          {#if foe.appui}
            <div class="ptags"><span class="tag v">🔥 Appui-feu — +{foe.appui.amount} dégâts (⏳{foe.appui.expiresIn})</span></div>
          {/if}
          {@render reson(foe, resonFoe, () => (resonFoe = !resonFoe))}
          {#if chainPreview.length}
            <div class="chainwarn">
              {#each chainPreview as p}
                {@const lst = combat.units.find((u) => u.id === p.listenerId)}
                <span>⚡ En chaîne : <b>{lst?.name ?? KIND_NAME[lst?.kind ?? '']}</b> (adverse) {#if p.spec.kind === 'estropier'}estropie ta pièce (−{p.amount} dépl.){:else if p.spec.kind === 'vendetta'}renforce son tank (+{p.amount} à sa prochaine attaque){:else if p.spec.kind === 'etourdir'}arme son tank (prochaine attaque étourdissante){:else if p.spec.kind === 'silence'}silence ta pièce (déplacement seul){:else if p.spec.kind === 'couverture'}couvre son tireur (+{p.amount} PA/tour){:else if p.spec.kind === 'appui'}renforce son duelliste (+{p.amount} dégâts){:else}pince ta pièce (−{p.amount}){/if}</span>
              {/each}
            </div>
          {/if}
          <div class="pacts">
            <button class="attack" class:tutoglow={tutoBtn === 'attack'} onclick={attackFoe} disabled={!canHitFoe}>⚔ Attaquer{#if selected} ({selected.attackCost} PA){/if}</button>
            {#if attackBlock}<span class="reason">{attackBlock}</span>{/if}
          </div>
        {:else}
          <div class="pempty">Clique une pièce <b style="color:#e0604a">adverse</b> pour l'inspecter.</div>
        {/if}
      </div>
    </div>
    {/if}
      <div class="journal">
        <div class="jhead">📜 Journal</div>
        <div class="jbody" bind:this={logBox}>
          {#each log as e}
            <div class="jline" class:sub={e.sub} class:sep={e.sep} style={e.owner && !e.sep ? `--jc:${COLORS[e.owner]}` : ''}>{e.text}</div>
          {/each}
        </div>
      </div>
    </aside>
  </div>

  <div class="objbar">
    <button class="obj-toggle" class:on={showObjectives} onclick={() => (showObjectives = !showObjectives)}>
      🎯 Objectifs <b>{objDone}/{OBJECTIVES.length}</b> {showObjectives ? '▲' : '▼'}
    </button>
    {#if showObjectives}
      <div class="obj-panel">
        <p class="muted small">Petits défis pour découvrir les mécaniques. Débloqués une fois pour toutes (archivés sur cet appareil).</p>
        {#each OBJ_CATS as cat}
          <div class="obj-cat">{cat}</div>
          <ul class="obj-list">
            {#each OBJECTIVES.filter((o) => o.cat === cat) as o}
              {@const done = achievements.has(o.id)}
              <li class:done>
                <span class="obj-check">{done ? '✓' : '☐'}</span>{o.label}
              </li>
            {/each}
          </ul>
        {/each}
        <button class="obj-reset" onclick={resetAchievements}>↺ Réinitialiser les succès</button>
      </div>
    {/if}
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
                    {:else if duo}<svg class="cellico" viewBox="0 0 24 24" width="22" height="22" role="img" aria-label={RESON_LABEL[duo.kind] ?? duo.kind}><title>{`${row.name} × ${col.name} — ${RESON_LABEL[duo.kind] ?? duo.kind}\nsur « ${SIGNAL_LABEL[duo.on] ?? duo.on} » · ${'radius' in duo.scope ? `rayon ${duo.scope.radius}` : 'escouade'} · CD ${duo.cooldown}`}</title><circle cx="12" cy="12" r="11.5" fill={EFFECT_COLOR[duo.kind] ?? '#3a8a76'} stroke="#0e1015" stroke-width="1" />{@render stateGlyph(EFFECT_GLYPH[duo.kind] ?? duo.kind)}</svg>{/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="matrix-legend small muted">
          {#each Object.entries(EFFECT_GLYPH) as [kind, gk]}
            <span class="legico"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="11.5" fill={EFFECT_COLOR[kind] ?? '#3a8a76'} />{@render stateGlyph(gk)}</svg> {RESON_LABEL[kind] ?? kind}</span>
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
      La <b>Lourde</b> peut <b style="color:#aec6f0">🛡 Garder (3 PA)</b> : dégâts subis réduits de moitié jusqu'à son prochain tour (au prix de son attaque).
      Le <b>Tireur</b> peut <b style="color:#f0c0a0">🎯 Réserver (3 PA)</b> son tir : il <b>tire en réflexe</b> sur la première pièce qui s'arrête dans sa <b style="color:#c07a6a">zone de menace</b> (teintée pendant ton tour).
      <b>Octogone 4.8.8</b> : les petits carrés sont des <b>carrefours</b> jouables — la diagonale passe par eux (2 pas). Pose ta Lourde dessus pour verrouiller 4 directions.
      <b>🎓 Entraînement</b> = petit plateau (tuto & practice) · <b>⚔ Partie</b> = grand plateau.
    {/if}
  </div>
</div>

{#if justUnlocked}
  {@const o = OBJECTIVES.find((x) => x.id === justUnlocked)}
  <div class="obj-toast">🎯 Objectif débloqué — <b>{o?.label}</b></div>
{/if}

{#if phase === 'setup' && !showHelp}
  <div class="modal-backdrop">
    <div class="modal setup" role="dialog" aria-modal="true" aria-label="Préparer la partie">
      <h2>Préparer la partie</h2>

      <h3>Plateau</h3>
      <div class="seg">
        <button class:on={mode === 'entrainement'} onclick={() => (mode = 'entrainement')}>🎓 Entraînement <span class="muted small">petit</span></button>
        <button class:on={mode === 'partie'} onclick={() => (mode = 'partie')}>⚔ Partie <span class="muted small">grand</span></button>
      </div>

      <h3>Forme <span class="muted small">— même moteur, formes comparables</span></h3>
      <div class="seg">
        {#each ['octa', 'hex', 'square'] as const as sh}
          <button class:on={shape === sh} onclick={() => (shape = sh)}>{FORME_LABEL[sh]}</button>
        {/each}
      </div>

      <h3>Adversaire</h3>
      <div class="seg">
        <button class:on={opponent === 'hotseat'} onclick={() => (opponent = 'hotseat')}>🤝 Hotseat <span class="muted small">2 joueurs</span></button>
        <button class:on={opponent === 'ia'} onclick={() => (opponent = 'ia')}>🤖 vs IA</button>
      </div>
      {#if opponent === 'ia'}
        <div class="seg levels">
          {#each DIFFICULTIES as lvl}
            <button class:on={aiLevel === lvl} onclick={() => (aiLevel = lvl)}>{LEVEL_LABEL[lvl]}</button>
          {/each}
        </div>
      {/if}

      <h3>L'escouade <span class="muted small">— miroir : les deux camps jouent les MÊMES 3 pièces</span></h3>
      {#each SLOTS as slot}
        <div class="pickrow">
          <span class="slotname">{KIND_GLYPH[slot]} {KIND_NAME[slot]}</span>
          <div class="seg">
            {#each heroesOf(slot) as h}
              <button class:on={pick[slot] === h.id} onclick={() => (pick = { ...pick, [slot]: h.id })}
                title="{KIND_NAME[h.archetype]}{h.reactions?.length ? ` · ${h.reactions.length} Résonance(s)` : ''}">
                {h.name}{#if h.reactions?.length}<span class="reso">✦</span>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}

      <div class="vs-preview">
        <span style="color:{COLORS.alice}"><b>Toi</b> · {aliceLineup.join(' · ')}</span>
        <span class="vs">⚔</span>
        <span style="color:{COLORS.bob}">{bobLineup.join(' · ')} · <b>{opponent === 'ia' ? `IA ${LEVEL_LABEL[aiLevel]}` : 'Joueur 2'}</b></span>
      </div>

      <button class="modal-ok" onclick={startGame}>⚔ Commencer</button>
    </div>
  </div>
{/if}

{#if showHelp}
  <div class="modal-backdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-label="Comment jouer">
      <button class="modal-close" onclick={closeHelp} aria-label="Fermer">✕</button>
      <h2>Comment jouer</h2>
      <p class="lead">Combat tactique <b>tour par tour</b>, en <b>hotseat</b> (2 joueurs) ou <b>contre l'IA</b> (3 niveaux) — choix à l'écran de préparation. <b>Information parfaite, aucun hasard</b> — pure stratégie.</p>

      <h3>🎯 But</h3>
      <p>Éliminer <b>toutes</b> les pièces adverses.</p>

      <h3>🕹 Le tour de jeu</h3>
      <ul>
        <li><b>Se déplacer est gratuit</b> : chaque pièce a un <b>plafond de pas par tour</b> (sa <i>mobilité</i>) — elle peut donc <b>bouger ET agir le même tour</b>.</li>
        <li>Les <b>PA</b> paient les <b>actions</b> : attaquer et les verbes (Garde, Tir réservé, Riposte) coûtent des PA. Tu joues tes pièces dans <b>l'ordre que tu veux</b>.</li>
        <li>Les <b>pièces sont des obstacles</b> — on ne les traverse pas.</li>
        <li><b>Finir le tour</b> passe la main à l'autre joueur ; les PA <b>rechargent</b> et les pas se <b>remettent à zéro</b>.</li>
      </ul>

      <h3>🖱 Agir</h3>
      <ul>
        <li>Clique <b>ta pièce</b> → une <b>case verte</b> pour <b>bouger</b>.</li>
        <li>Clique une <b>pièce adverse</b> pour l'<b>inspecter</b> (sa portée / sa zone de menace), puis <b>⚔ Attaquer</b> si elle est à portée.</li>
      </ul>

      <h3>♟ Les archétypes</h3>
      <ul>
        <li><b>Lourde</b> (L) — robuste, mêlée, <b>lente (3 pas)</b> · verbe <b>Garde</b>.</li>
        <li><b>Tireur</b> (T) — fragile, longue portée, <b>mobile (4 pas) → kite</b> · verbe <b>Tir réservé</b>.</li>
        <li><b>Duelliste</b> (D) — frappe 2×/tour, <b>4 pas</b> · verbe <b>Riposte</b>.</li>
      </ul>
      <p class="muted small">Le détail d'un verbe s'affiche en <b>survolant son bouton</b> dans le panneau.</p>

      <h3>✦ Résonance</h3>
      <ul>
        <li><b>Résonance</b> : des <b>synergies entre alliés</b> se déclenchent automatiquement (panneau <b>✦ Matrice</b> en bas).</li>
      </ul>

      <h3>🔍 Repères</h3>
      <p>Molette = <b>zoom</b> · glisser = <b>déplacer</b> la carte · <b>⤢</b> = tout réafficher.</p>
      <p class="lead">Le reste se découvre en jouant — <b>teste les personnages !</b></p>

      <button class="modal-ok" onclick={closeHelp}>Compris, jouer&nbsp;!</button>
    </div>
  </div>
{/if}

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
  .heal { background: #1c2e26; border: 1px solid #2a7d5e; color: #9fe0c4; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
  .heal:hover:not(:disabled) { border-color: #3fae84; }
  .heal.on { background: #234e3c; border-color: #3fae84; color: #d6ffec; font-weight: 600; }
  .heal:disabled { opacity: .4; cursor: not-allowed; }
  .undo { background: #2a2030; border: 1px solid #5a4055; color: #d0a0b0; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
  .undo:hover:not(:disabled) { border-color: #8a6075; }
  .undo:disabled { opacity: .35; cursor: not-allowed; }
  .end-turn { background: #1a2030; border: 1px solid #3a4060; color: #9ab0d0; border-radius: 5px; padding: .45rem .9rem; cursor: pointer; font-weight: 600; font-size: .88rem; }
  .end-turn:hover:not(:disabled) { border-color: #5a70b0; }
  .end-turn:disabled { opacity: .4; cursor: not-allowed; }
  .restart { background: #1a2030; border: 1px solid #3a4555; color: #9aa3b5; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
  .tuto-btn { background: #1f3a33; border: 1px solid #3a8a76; color: #b8f0e2; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; font-weight: 600; }
  .tuto-btn:hover { border-color: #5fae9a; }
  .tuto-btn.on { background: #3a2030; border-color: #8a6075; color: #e0b0c0; }
  .tutobar { display: flex; align-items: center; gap: 1rem; background: #1b2a26; border: 1px solid #3a8a76; border-radius: 8px; padding: .55rem .9rem; margin-bottom: .7rem; }
  .tutostep { color: #d6fff2; font-size: .92rem; font-weight: 600; }
  .tutoskip { margin-left: auto; background: #14201d; border: 1px solid #3a5a52; color: #9ad0c2; border-radius: 5px; padding: .3rem .7rem; cursor: pointer; font-size: .8rem; white-space: nowrap; }
  .tutoskip:hover { border-color: #5fae9a; }
  .tutodone { display: flex; align-items: center; gap: 1rem; background: #1e2435; border: 1px solid #5a70b0; border-radius: 8px; padding: .7rem 1rem; margin-bottom: .7rem; }
  .tutodone b { color: #cfe0ff; }
  .tutogo { margin-left: auto; background: #2a6f5e; border: 1px solid #3a8a76; color: #eafff7; border-radius: 6px; padding: .45rem .9rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .tutogo:hover { background: #348973; }
  .tutoring { fill: none; stroke: #ffd479; stroke-width: 4; pointer-events: none; animation: tutopulse 1.1s ease-in-out infinite; }
  @keyframes tutopulse { 0%, 100% { opacity: .35; stroke-width: 3; } 50% { opacity: 1; stroke-width: 5.5; } }
  /* Bouton à cliquer pendant le tuto : halo doré pulsé (passe outre l'état désactivé visuel). */
  .tutoglow { animation: tutoglow 1.1s ease-in-out infinite; border-color: #ffd479 !important; }
  @keyframes tutoglow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 212, 121, 0); }
    50% { box-shadow: 0 0 10px 3px rgba(255, 212, 121, .65); }
  }
  .settings { font-size: .8rem; color: #9aa3b5; }
  .settings summary { cursor: pointer; padding: .25rem 0; user-select: none; }
  .menu-link { width: 100%; margin-top: .4rem; background: #1c2438; border: 1px solid #3a4860; color: #aec6f0; border-radius: 5px; padding: .4rem .6rem; cursor: pointer; font-size: .82rem; text-align: left; }
  .menu-link:hover { background: #243150; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(6, 8, 12, 0.72); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
  .modal { position: relative; background: #161a22; border: 1px solid #2a2f3a; border-radius: 12px; padding: 1.4rem 1.6rem; max-width: 560px; width: 100%; max-height: 88vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0, 0, 0, .5); }
  .modal h2 { margin: 0 0 .3rem; font-size: 1.35rem; }
  .modal h3 { margin: 1rem 0 .25rem; font-size: .95rem; color: #aec6f0; }
  .modal p { margin: .2rem 0; line-height: 1.45; }
  .modal .lead { color: #cdd3df; }
  .modal ul { margin: .2rem 0; padding-left: 1.2rem; }
  .modal li { margin: .25rem 0; line-height: 1.4; }
  .modal-close { position: absolute; top: .55rem; right: .7rem; background: none; border: none; color: #8a93a6; font-size: 1.15rem; cursor: pointer; line-height: 1; }
  .modal-close:hover { color: #e8ecf2; }
  .modal-ok { margin-top: 1.1rem; width: 100%; background: #2a6f5e; border: 1px solid #3a8a76; color: #eafff7; border-radius: 6px; padding: .6rem; font-size: .95rem; font-weight: 700; cursor: pointer; }
  .modal-ok:hover { background: #348973; }
  /* Écran de setup (pré-partie) */
  .modal.setup .seg { display: flex; gap: .4rem; margin: .15rem 0; }
  .modal.setup .seg button { flex: 1; background: #1a2030; border: 1px solid #3a4555; color: #b6c0d2; border-radius: 6px; padding: .5rem .6rem; cursor: pointer; font-size: .86rem; display: flex; align-items: center; justify-content: center; gap: .35rem; }
  .modal.setup .seg button:hover { border-color: #5a70b0; }
  .modal.setup .seg button.on { border-color: #5a70b0; background: #20283a; color: #dce8ff; font-weight: 600; }
  .modal.setup .seg.levels button { padding: .35rem; font-size: .82rem; }
  .pickrow { display: flex; align-items: center; gap: .6rem; margin: .35rem 0; }
  .pickrow .slotname { flex: 0 0 96px; color: #9aa3b5; font-size: .85rem; }
  .pickrow .seg { flex: 1; }
  .pickrow .reso { color: #ffd27a; margin-left: .3rem; }
  .vs-preview { display: flex; align-items: center; justify-content: center; gap: .6rem; flex-wrap: wrap; margin-top: 1rem; padding: .55rem; background: #11141b; border: 1px solid #2a2f3a; border-radius: 6px; font-size: .85rem; }
  .vs-preview .vs { color: #6a7384; }
  .aitag { color: #c9b06a; font-size: .8rem; }
  .newgame { background: #1f2a3a; border: 1px solid #3f5a8a; color: #aec6f0; border-radius: 5px; padding: .45rem .8rem; cursor: pointer; font-size: .82rem; }
  .newgame:hover:not(:disabled) { border-color: #6f90c8; }
  .newgame:disabled, .restart:disabled, .shape button:disabled { opacity: .4; cursor: not-allowed; }
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
  .stchip { pointer-events: none; }
  .pname { fill: #e8ecf2; font-size: 7px; font-weight: 600; text-anchor: middle; pointer-events: none; }
  .rng-ally { fill: none; stroke: #5ab0a0; stroke-width: 2; stroke-dasharray: 4 3; opacity: .5; pointer-events: none; }
  .rng-foe { fill: none; stroke: #e0604a; stroke-width: 2; opacity: .5; pointer-events: none; }
  .heal-target { fill: #1d3a2e; stroke: #3fae84; stroke-width: 3; pointer-events: none; animation: healpulse 1.1s ease-in-out infinite; }
  @keyframes healpulse { 0%, 100% { opacity: .45; } 50% { opacity: .9; } }
  /* Panneaux d'info — pièce alliée sélectionnée (gauche) et pièce adverse inspectée (droite). */
  /* Flèches d'attaque transitoires sur le board (origine → cible). */
  .atkfx { stroke-width: 3.5; stroke-linecap: round; pointer-events: none; animation: atkfade 1.5s ease-out forwards; }
  .atkpulse { fill: none; stroke-width: 3; pointer-events: none; animation: atkpulse 1.5s ease-out forwards; }
  @keyframes atkfade { 0% { opacity: 0; } 12% { opacity: .95; } 100% { opacity: 0; } }
  @keyframes atkpulse { 0% { r: 5; opacity: .9; } 100% { r: 22; opacity: 0; } }

  /* Journal des actions (colonne de droite). */
  .journal { background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; display: flex; flex-direction: column; min-height: 0; }
  .jhead { font-weight: 700; font-size: .82rem; color: #aec6f0; padding: .45rem .7rem; border-bottom: 1px solid #2a2f3a; }
  .jbody { overflow-y: auto; max-height: 38vh; padding: .35rem .55rem; display: flex; flex-direction: column; gap: 1px; font-size: .8rem; }
  .jline { color: #cdd3df; border-left: 2px solid var(--jc, transparent); padding: .08rem .45rem; line-height: 1.3; }
  .jline.sub { color: #8b93a4; font-size: .74rem; padding-left: 1.1rem; }
  .jline.sep { color: #aec6f0; font-weight: 700; text-align: center; border-left: none; margin: .25rem 0 .1rem; border-top: 1px dashed #333a47; padding-top: .25rem; }

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
  .hint { padding: 0 .2rem; }

  /* Matrice de Résonance (panneau dépliable, pleine largeur) */
  .objbar { margin: .6rem .2rem 0; }
  .obj-toggle { background: #1f3a33; color: #b8f0e2; border: 1px solid #2f6f5e; border-radius: 6px; padding: .35rem .7rem; font-size: .82rem; font-weight: 700; cursor: pointer; }
  .obj-toggle.on, .obj-toggle:hover { background: #2a5249; }
  .obj-toggle b { color: #eafff7; }
  .obj-panel { margin-top: .5rem; padding: .6rem .8rem; background: #15171f; border: 1px solid #272c37; border-radius: 8px; }
  .obj-cat { font-size: .72rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #6fae9a; margin: .5rem 0 .2rem; }
  .obj-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: .15rem .9rem; }
  .obj-list li { font-size: .82rem; color: #9aa3b5; display: flex; align-items: baseline; gap: .45rem; }
  .obj-list li.done { color: #cfe0ea; }
  .obj-check { color: #4a5468; font-weight: 700; }
  .obj-list li.done .obj-check { color: #5fc99a; }
  .obj-reset { margin-top: .7rem; background: #221a22; border: 1px solid #4a3340; color: #c69ab0; border-radius: 5px; padding: .35rem .7rem; font-size: .78rem; cursor: pointer; }
  .obj-reset:hover { border-color: #7a5065; }
  .obj-toast { position: fixed; left: 50%; bottom: 1.4rem; transform: translateX(-50%); background: #1f3a33; border: 1px solid #3a8a76; color: #eafff7; border-radius: 8px; padding: .55rem 1rem; font-size: .9rem; box-shadow: 0 6px 24px rgba(0, 0, 0, .45); z-index: 40; animation: objpop .25s ease-out; }
  .obj-toast b { color: #b8f0e2; }
  @keyframes objpop { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
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
  .cellico { display: block; margin: 0 auto; cursor: help; }
  table.matrix .diag { color: #3a4150; }
  .matrix-legend { display: flex; flex-wrap: wrap; gap: .2rem 1rem; margin-top: .5rem; }
  .legico { display: inline-flex; align-items: center; gap: .3rem; }
</style>
