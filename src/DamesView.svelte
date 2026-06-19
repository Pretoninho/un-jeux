<script lang="ts">
  // Vue de DAMES (présentation pure) — hotseat local. Tout le jeu vit dans le moteur pur
  // `engine/dames.ts` ; ici on rend le damier, on route les clics vers `legalMoves`/`applyMove`,
  // et on gère le CHOIX DU TYPE à la promotion. Aucune règle dupliquée.
  import {
    initialState, legalMoves, movesForPiece, applyMove, winner, isPromoting,
    idx, xy, isDark, SIZE, KINDS, PROMOTION_KINDS,
    type DamesState, type Move, type Player,
  } from './engine/dames';

  const CELL = 64;
  const BOARD = CELL * SIZE;

  let game = $state<DamesState>(initialState());
  let selected = $state<number | null>(null);
  let pendingPromo = $state<Move | null>(null); // coup en attente du choix de type

  const champ = $derived(winner(game));
  const moves = $derived(legalMoves(game));
  const mustCapture = $derived(moves.some((m) => m.captures.length > 0));
  const movableFrom = $derived(new Set(moves.map((m) => m.from)));
  const targets = $derived.by(() => {
    const map = new Map<number, Move>();
    if (selected === null) return map;
    for (const m of movesForPiece(game, selected)) if (!map.has(m.to)) map.set(m.to, m);
    return map;
  });

  const PLAYER_LABEL: Record<Player, string> = { b: 'Blancs', n: 'Noirs' };
  // Pastille affichée sur chaque dame (le pion n'a pas de marque). Couleur via le camp.
  const KIND_TAG: Record<string, string> = {
    dame: '♛', 'dame-bond': '⇕', 'dame-perce': '⇇', 'dame-equerre': '✛',
  };

  function count(p: Player): number {
    return game.board.reduce((n, c) => (c && c.player === p ? n + 1 : n), 0);
  }

  function handleCell(i: number): void {
    if (champ || pendingPromo) return;
    const mv = targets.get(i);
    if (selected !== null && mv) {
      if (isPromoting(game, mv)) { pendingPromo = mv; selected = null; return; } // attendre le choix
      game = applyMove(game, mv);
      selected = null;
      return;
    }
    const piece = game.board[i];
    if (piece && piece.player === game.turn && movableFrom.has(i)) {
      selected = selected === i ? null : i;
    } else {
      selected = null;
    }
  }

  function choosePromo(kind: string): void {
    if (!pendingPromo) return;
    game = applyMove(game, pendingPromo, kind);
    pendingPromo = null;
  }

  function newGame(): void {
    game = initialState();
    selected = null;
    pendingPromo = null;
  }

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

  <div class="boardwrap">
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
                    fill={cap ? '#d4493f' : '#39b3a6'} fill-opacity={cap ? 0.55 : 0.7}
                    stroke={cap ? '#d4493f' : '#39b3a6'} stroke-width="2" />
          {/if}

          {#if c.piece}
            {@const isWhite = c.piece.player === 'b'}
            <title>{KINDS[c.piece.kind]?.name ?? c.piece.kind}</title>
            <circle cx={cx + CELL / 2} cy={cy + CELL / 2} r={CELL * 0.36}
                    fill={isWhite ? '#f2ead6' : '#23262d'}
                    stroke={isWhite ? '#b8a06a' : '#000'} stroke-width="2" />
            {#if c.piece.kind !== 'pion'}
              <text x={cx + CELL / 2} y={cy + CELL / 2 + 7} text-anchor="middle"
                    font-size="24" font-weight="700"
                    fill={isWhite ? '#9a7d2e' : '#e7c64a'}>{KIND_TAG[c.piece.kind] ?? '♛'}</text>
            {/if}
          {/if}
        </g>
      {/each}
    </svg>

    {#if pendingPromo}
      <div class="promo">
        <div class="promo-card">
          <p>Promotion — choisis ta dame</p>
          <div class="promo-choices">
            {#each PROMOTION_KINDS as k (k)}
              <button onclick={() => choosePromo(k)} title={KINDS[k]?.name}>
                <span class="glyph">{KIND_TAG[k] ?? '♛'}</span>
                <span class="lbl">{KINDS[k]?.name}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <p class="hint">
    Hotseat. Clique une de tes pièces puis une case en surbrillance
    (<span class="dot move"></span> déplacement, <span class="dot cap"></span> prise). Prise obligatoire, rafles
    enchaînées. <strong>Pion</strong> : avant seulement. <strong>Dame</strong> (1 case avant/arrière) — à la
    promotion tu choisis : ♛ standard, ⇕ <em>bondissante</em> (2 cases), ⇇ <em>perce-ligne</em> (prend 2 alignés),
    ✛ <em>équerre</em> (prend en orthogonal).
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

  .boardwrap { position: relative; }
  .board {
    width: 100%; height: auto; display: block;
    border: 3px solid #4a352a; border-radius: 6px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, .4);
  }
  .board g { cursor: pointer; outline: none; }

  .promo {
    position: absolute; inset: 0; display: grid; place-items: center;
    background: rgba(10, 12, 16, .72); border-radius: 6px;
  }
  .promo-card {
    background: #1b1e26; border: 1px solid #3a4150; border-radius: 10px;
    padding: 1rem 1.2rem; box-shadow: 0 8px 30px rgba(0, 0, 0, .5); text-align: center;
  }
  .promo-card p { margin: 0 0 .7rem; font-weight: 600; }
  .promo-choices { display: grid; grid-template-columns: repeat(2, 1fr); gap: .5rem; }
  .promo-choices button {
    display: flex; flex-direction: column; align-items: center; gap: .2rem;
    background: #262b35; color: #cdd3df; border: 1px solid #3a4150;
    border-radius: 8px; padding: .55rem .7rem; cursor: pointer; min-width: 9rem;
  }
  .promo-choices button:hover { background: #2f5d8a; border-color: #2f5d8a; color: #fff; }
  .promo-choices .glyph { font-size: 1.5rem; color: #e7c64a; }
  .promo-choices .lbl { font-size: .78rem; }

  .hint { color: #9aa3b2; font-size: .82rem; line-height: 1.45; margin-top: .7rem; }
  .dot { display: inline-block; width: .7em; height: .7em; border-radius: 50%; vertical-align: middle; }
  .dot.move { background: #39b3a6; }
  .dot.cap { background: #d4493f; }
</style>
