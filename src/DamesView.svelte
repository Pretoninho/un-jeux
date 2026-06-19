<script lang="ts">
  // Vue de DAMES (présentation pure) — hotseat local, deux joueurs à tour de rôle.
  // Tout le jeu vit dans le moteur pur `engine/dames.ts` ; ici on ne fait que rendre le
  // damier et router les clics vers `legalMoves`/`applyMove`. Aucune règle dupliquée.
  import {
    initialState, legalMoves, movesForPiece, applyMove, winner,
    idx, xy, isDark, SIZE,
    type DamesState, type Move, type Player,
  } from './engine/dames';

  const CELL = 64;            // côté d'une case en unités SVG
  const BOARD = CELL * SIZE;  // damier carré

  let game = $state<DamesState>(initialState());
  let selected = $state<number | null>(null); // case de la pièce sélectionnée

  const champ = $derived(winner(game));
  const moves = $derived(legalMoves(game));                 // tous les coups légaux du tour
  const mustCapture = $derived(moves.some((m) => m.captures.length > 0));
  // Cases d'origine jouables ce tour (pour guider : on n'a le droit de bouger que celles-ci).
  const movableFrom = $derived(new Set(moves.map((m) => m.from)));
  // Coups de la pièce sélectionnée, indexés par case d'arrivée (1ʳᵉ correspondance si ambiguïté).
  const targets = $derived.by(() => {
    const map = new Map<number, Move>();
    if (selected === null) return map;
    for (const m of movesForPiece(game, selected)) {
      if (!map.has(m.to)) map.set(m.to, m);
    }
    return map;
  });

  const PLAYER_LABEL: Record<Player, string> = { b: 'Blancs', n: 'Noirs' };

  function count(p: Player): number {
    return game.board.reduce((n, c) => (c && c.player === p ? n + 1 : n), 0);
  }

  function handleCell(i: number): void {
    if (champ) return;
    // 1) Si une cible légale de la pièce sélectionnée est cliquée → on joue le coup.
    const mv = targets.get(i);
    if (selected !== null && mv) {
      game = applyMove(game, mv);
      selected = null;
      return;
    }
    // 2) Sinon, (dé)sélection d'une pièce du joueur au trait qui a au moins un coup légal.
    const piece = game.board[i];
    if (piece && piece.player === game.turn && movableFrom.has(i)) {
      selected = selected === i ? null : i;
    } else {
      selected = null;
    }
  }

  function newGame(): void {
    game = initialState();
    selected = null;
  }

  // ── Helpers de rendu ──
  const cells = $derived(
    Array.from({ length: SIZE * SIZE }, (_, i) => {
      const { x, y } = xy(i);
      return { i, x, y, dark: isDark(x, y), piece: game.board[i] };
    }),
  );
</script>

<div class="dames">
  <div class="bar">
    {#if champ}
      <span class="status win">🏆 {PLAYER_LABEL[champ]} gagnent !</span>
    {:else}
      <span class="status">
        Au trait : <strong class:b={game.turn === 'b'} class:n={game.turn === 'n'}>{PLAYER_LABEL[game.turn]}</strong>
        {#if mustCapture}<em class="forced">— prise obligatoire</em>{/if}
      </span>
    {/if}
    <span class="tally">⚪ {count('b')} · {count('n')} ⚫</span>
    <button class="newgame" onclick={newGame}>↻ Nouvelle partie</button>
  </div>

  <svg class="board" viewBox="0 0 {BOARD} {BOARD}" role="group" aria-label="Damier">
    {#each cells as c (c.i)}
      {@const cx = c.x * CELL}
      {@const cy = c.y * CELL}
      <g
        role="button"
        tabindex="0"
        aria-label={`case ${c.x},${c.y}`}
        onclick={() => handleCell(c.i)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCell(c.i)}
      >
        <rect x={cx} y={cy} width={CELL} height={CELL} fill={c.dark ? '#7a4f2a' : '#e9c89a'} />

        {#if c.i === selected}
          <rect x={cx + 2} y={cy + 2} width={CELL - 4} height={CELL - 4}
                fill="none" stroke="#ffd34d" stroke-width="4" rx="4" />
        {/if}

        {#if targets.has(c.i)}
          {@const cap = (targets.get(c.i)?.captures.length ?? 0) > 0}
          <circle cx={cx + CELL / 2} cy={cy + CELL / 2} r={cap ? 14 : 9}
                  fill={cap ? '#d4493f' : '#39b3a6'}
                  fill-opacity={cap ? 0.55 : 0.7}
                  stroke={cap ? '#d4493f' : '#39b3a6'} stroke-width="2" />
        {/if}

        {#if c.piece}
          {@const isWhite = c.piece.player === 'b'}
          <circle cx={cx + CELL / 2} cy={cy + CELL / 2} r={CELL * 0.36}
                  fill={isWhite ? '#f2ead6' : '#23262d'}
                  stroke={isWhite ? '#b8a06a' : '#000'} stroke-width="2" />
          {#if c.piece.king}
            <text x={cx + CELL / 2} y={cy + CELL / 2 + 6} text-anchor="middle"
                  font-size="22" fill={isWhite ? '#9a7d2e' : '#e7c64a'}>♛</text>
          {/if}
        {/if}
      </g>
    {/each}
  </svg>

  <p class="hint">
    Hotseat : chaque joueur joue à son tour. Clique une de tes pièces, puis une case en surbrillance
    (<span class="dot move"></span> déplacement, <span class="dot cap"></span> prise). La prise est obligatoire ;
    les rafles s'enchaînent automatiquement. Les pions avancent ; une dame (♛) glisse loin dans toutes les directions.
  </p>
</div>

<style>
  .dames { max-width: 560px; margin: 0 auto; }
  .bar {
    display: flex; align-items: center; gap: .75rem; flex-wrap: wrap;
    margin-bottom: .6rem; font-size: .95rem;
  }
  .status strong { padding: 0 .25rem; }
  .status strong.b { color: #f2ead6; }
  .status strong.n { color: #cdd3df; }
  .status.win { color: #ffd34d; font-weight: 700; }
  .forced { color: #d4493f; font-style: italic; margin-left: .25rem; }
  .tally { margin-left: auto; color: #9aa3b2; font-variant-numeric: tabular-nums; }
  .newgame {
    background: #2a2f3a; color: #cdd3df; border: 1px solid #3a4150;
    border-radius: 6px; padding: .3rem .6rem; cursor: pointer;
  }
  .newgame:hover { background: #333a47; }

  .board {
    width: 100%; height: auto; display: block;
    border: 3px solid #4a352a; border-radius: 6px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, .4);
  }
  .board g { cursor: pointer; outline: none; }

  .hint { color: #9aa3b2; font-size: .82rem; line-height: 1.4; margin-top: .7rem; }
  .dot { display: inline-block; width: .7em; height: .7em; border-radius: 50%; vertical-align: middle; }
  .dot.move { background: #39b3a6; }
  .dot.cap { background: #d4493f; }
</style>
