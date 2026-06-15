<script lang="ts">
  // LE JEU — vue unique jouable, sur GameStateV2. Carte plate 37 hexes, camp de base
  // posé au départ, carnet d'ordres (chaque achat force un ordre de vente), éviction = payer l'ask.
  import { makeFlatBoard } from './engine/board';
  import { makeGameStateV2, makeActorV2, type GameStateV2 } from './engine/state2';
  import { actorNet, checkEnd, type ActorTickReport } from './engine/tick';
  import { actorIncome, hexRevenue } from './engine/revenue';
  import { actorCharges } from './engine/camp';
  import {
    claimCost, canClaim, claimHex, borrow, foundBaseCamps,
    defaultAsk, askFloor, setAsk, evictionCost, canEvict, evict, netWorth, endTurn,
    DEFAULT_CONFIG, type GameConfig,
  } from './engine/game';
  import { axialToPixel, hexPointsPointy, genBounds } from './lib/layout';

  const HUMAN = 'alice';
  const AI = 'bob';
  const COLORS: Record<string, string> = { alice: '#5ab0a0', bob: '#e07a3a' };

  // ── Plateau plat 37 hexes (rayon 3), revenu de base = 6 partout ───────────────
  const RADIUS = 3;
  const BOARD = makeFlatBoard(RADIUS, 6, 3);
  const CFG: GameConfig = { ...DEFAULT_CONFIG };

  function initial(): GameStateV2 {
    let s = makeGameStateV2(BOARD.map, BOARD.rev, [
      makeActorV2('alice', 'Alice (toi)', 0),
      makeActorV2('bob', 'Bob (IA)', 0),
    ]);
    s.ownership[BOARD.corners[0]] = 'alice';
    s.ownership[BOARD.corners[1]] = 'bob';
    s = foundBaseCamps(s, CFG); // premier emprunt déjà effectué (camp de base)
    // ordres de vente de départ sur les hexes initiaux
    for (const hid of BOARD.corners) s.asks[hid] = defaultAsk(s, hid, CFG);
    return s;
  }

  let game = $state<GameStateV2>(initial());
  let reports = $state<ActorTickReport[]>([]);
  let journal = $state<string[]>([]);
  // Ordre de vente en attente de validation (carnet) : { hexId, prix saisi }.
  let pending = $state<{ hexId: string; price: number } | null>(null);

  const end = $derived(checkEnd(game, CFG.horizonTurns, (id) => netWorth(game, id, CFG)));
  const ended = $derived(end.ended);
  const blocked = $derived(pending !== null); // tant qu'un ordre n'est pas validé, on bloque

  function label(id: string) { return game.actors.find((a) => a.id === id)?.label ?? id; }
  const income = (id: string) => actorIncome(id, game.ownership, game.map, game.revenueCfg);
  const charges = (id: string) => actorCharges(id, game.camps);
  const net = (id: string) => actorNet(game, id);
  const worth = (id: string) => netWorth(game, id, CFG);
  const hexCount = (id: string) => Object.values(game.ownership).filter((o) => o === id).length;
  const hexRev = (hexId: string) => hexRevenue(hexId, game.ownership, game.map, game.revenueCfg);
  const human = $derived(game.actors.find((a) => a.id === HUMAN)!);
  const myHexes = $derived(game.map.hexes.filter((h) => game.ownership[h.id] === HUMAN));

  function log(msg: string) { journal = [msg, ...journal].slice(0, 8); }

  // ── Clic sur un hex : libre → acheter ; adverse → évincer ; puis ordre de vente ─
  function onHex(hexId: string) {
    if (ended || blocked) return;
    const owner = game.ownership[hexId];
    if (!owner) {
      if (!canClaim(game, HUMAN, hexId, CFG)) return;
      const cost = claimCost(game, hexId, CFG);
      game = claimHex(game, HUMAN, hexId, CFG);
      log(`🪙 Achat de ${hexId} (−${cost})`);
      openOrder(hexId);
    } else if (owner !== HUMAN) {
      if (!canEvict(game, HUMAN, hexId)) return;
      const cost = evictionCost(game, hexId);
      game = evict(game, HUMAN, hexId, CFG);
      log(`⚔ Éviction de ${hexId} (−${cost} à ${label(owner)})`);
      openOrder(hexId);
    }
  }

  // Ouvre la demande d'ordre de vente OBLIGATOIRE (le moteur a déjà mis un défaut).
  function openOrder(hexId: string) {
    pending = { hexId, price: game.asks[hexId] ?? defaultAsk(game, hexId, CFG) };
  }
  function validateOrder() {
    if (!pending) return;
    game = setAsk(game, HUMAN, pending.hexId, pending.price, CFG);
    log(`📒 Ordre de vente ${pending.hexId} à ${game.asks[pending.hexId]}`);
    pending = null;
  }
  // Réajuster l'ask d'un hex déjà possédé (depuis le carnet).
  function editOrder(hexId: string) {
    if (ended || blocked) return;
    pending = { hexId, price: game.asks[hexId] ?? defaultAsk(game, hexId, CFG) };
  }

  function takeLoan(amount: number) {
    if (ended || blocked) return;
    game = borrow(game, HUMAN, amount, CFG);
    log(`🏦 Emprunt +${amount} (charge +${Math.round(amount * CFG.chargeRate)}/tour)`);
  }

  function finishTurn() {
    if (ended || blocked) return;
    const res = endTurn(game, [AI], CFG);
    game = res.state;
    reports = res.reports;
    for (const r of res.reports) {
      if (r.wentBankrupt) log(`💀 ${label(r.actorId)} fait faillite !`);
    }
    log(`⏩ Tour ${game.turn} — chacun encaisse income − charges`);
  }

  function restart() {
    game = initial(); reports = []; journal = []; pending = null;
  }

  // ── Layout pixel ──────────────────────────────────────────────────────────────
  const centers: Record<string, [number, number]> = {};
  for (const h of BOARD.map.hexes) centers[h.id] = axialToPixel(h.coord!.q, h.coord!.r);
  const bnds = genBounds(Object.values(centers));
  const viewBox = `${bnds.minX.toFixed(1)} ${bnds.minY.toFixed(1)} ${bnds.w.toFixed(1)} ${bnds.h.toFixed(1)}`;

  const floor = $derived(pending ? askFloor(game, pending.hexId, CFG) : 0);
</script>

<div class="game" class:blocked>
  <!-- Bandeau : tour + valeur nette des joueurs -->
  <div class="topbar">
    <div class="turn">Tour <b>{game.turn}</b>/{CFG.horizonTurns}</div>
    <div class="scores">
      {#each game.actors as a (a.id)}
        <span class="score" class:dead={a.bankrupt} style="--c:{COLORS[a.id]}">
          <span class="snm">{a.label}</span>
          <b class="nw">{worth(a.id)}</b><span class="nwl">val. nette</span>
          <i class:bad={net(a.id) < 0}>{net(a.id) >= 0 ? '+' : ''}{net(a.id)}/t</i>
          <i class="hc">⬡{hexCount(a.id)}</i>
        </span>
      {/each}
    </div>
    <button class="end-turn" onclick={finishTurn} disabled={ended || blocked}>Finir le tour ⏩</button>
  </div>

  {#if ended}
    <div class="banner">
      🏁 {end.reason === 'last_standing' ? 'Dernier debout' : 'Le plus riche'} :
      <b>{end.winnerId ? label(end.winnerId) : 'personne'}</b>
      <button class="restart" onclick={restart}>Rejouer</button>
    </div>
  {/if}

  <div class="layout">
    <!-- Carte -->
    <svg {viewBox} class="map">
      {#each game.map.hexes as h (h.id)}
        {@const c = centers[h.id]!}
        {@const owner = game.ownership[h.id]}
        {@const isMine = owner === HUMAN}
        {@const isEnemy = !!owner && owner !== HUMAN}
        {@const claimable = !owner && canClaim(game, HUMAN, h.id, CFG) && !ended && !blocked}
        {@const evictable = isEnemy && canEvict(game, HUMAN, h.id) && !ended && !blocked}
        {@const isPending = pending?.hexId === h.id}
        <g class="hex" class:claimable class:evictable role="button" tabindex="0"
           onclick={() => onHex(h.id)}
           onkeydown={(e) => e.key === 'Enter' && onHex(h.id)}>
          <polygon
            points={hexPointsPointy(c[0], c[1], 26)}
            fill={owner ? COLORS[owner] : '#171a22'}
            stroke={isPending ? '#ffd479' : claimable ? '#5ab0a0' : evictable ? '#e0604a' : owner ? '#0e1015' : '#262b36'}
            stroke-width={isPending || claimable || evictable ? 3 : 1.5} />
          {#if isMine}
            <text x={c[0]} y={c[1] + 2} class="rev">+{hexRev(h.id)}</text>
            <text x={c[0]} y={c[1] + 13} class="ask">📒{game.asks[h.id]}</text>
          {:else if isEnemy}
            <text x={c[0]} y={c[1] + 2} class="rev">+{hexRev(h.id)}</text>
            <text x={c[0]} y={c[1] + 13} class="evictc">⚔{evictionCost(game, h.id)}</text>
          {:else}
            <text x={c[0]} y={c[1] + 4} class="cost">🪙{claimCost(game, h.id, CFG)}</text>
          {/if}
        </g>
      {/each}
    </svg>

    <!-- Panneaux (façon ancien jeu : sections denses) -->
    <aside class="panel">
      <!-- TOI -->
      <section class="card" style="--c:{COLORS[HUMAN]}">
        <h3>{human.label}</h3>
        <div class="grid">
          <div><span>Cash</span><b>💰{human.cash}</b></div>
          <div><span>Valeur nette</span><b>{worth(HUMAN)}</b></div>
          <div><span>Income</span><b class="pos">+{income(HUMAN)}</b></div>
          <div><span>Charges</span><b class="neg">−{charges(HUMAN)}</b></div>
          <div><span>Net / tour</span><b class:bad={net(HUMAN) < 0}>{net(HUMAN) >= 0 ? '+' : ''}{net(HUMAN)}</b></div>
          <div><span>Hexes</span><b>⬡{hexCount(HUMAN)}</b></div>
        </div>
      </section>

      <!-- CAMPS -->
      <section class="card">
        <h3>Camps (dette)</h3>
        <div class="muted small">
          {game.camps.filter((c) => c.ownerId === HUMAN).length} camp(s) ·
          dette {game.camps.filter((c) => c.ownerId === HUMAN).reduce((s, c) => s + c.debtRemaining, 0)} ·
          charge −{charges(HUMAN)}/tour
        </div>
        <div class="loan-btns">
          <button onclick={() => takeLoan(80)} disabled={ended || blocked}>Emprunter +80 <i>(−{Math.round(80 * CFG.chargeRate)}/t)</i></button>
          <button onclick={() => takeLoan(150)} disabled={ended || blocked}>+150 <i>(−{Math.round(150 * CFG.chargeRate)}/t)</i></button>
        </div>
      </section>

      <!-- CARNET D'ORDRES -->
      <section class="card">
        <h3>📒 Carnet d'ordres (tes prix de sortie)</h3>
        {#if myHexes.length === 0}
          <div class="muted small">Aucun hex. Achète une case sur la carte.</div>
        {:else}
          <div class="asks">
            {#each myHexes as h (h.id)}
              <button class="ask-row" onclick={() => editOrder(h.id)} disabled={ended || blocked}>
                <span class="hid">{h.id}</span>
                <span class="muted small">rev +{hexRev(h.id)}</span>
                <b>📒 {game.asks[h.id]}</b>
              </button>
            {/each}
          </div>
          <div class="muted small tip">Clic = ajuster. Plus l'ask est haut, plus tu résistes — mais l'éviction reste possible si l'adversaire paie.</div>
        {/if}
      </section>

      <!-- JOURNAL -->
      <section class="card">
        <h3>Journal</h3>
        {#if journal.length === 0}
          <div class="muted small">Achète une case, emprunte, puis finis le tour.</div>
        {:else}
          {#each journal as j}<div class="jrow small">{j}</div>{/each}
        {/if}
      </section>
    </aside>
  </div>

  <!-- Modale OBLIGATOIRE : poser l'ordre de vente après un achat / une éviction -->
  {#if pending}
    {@const hid = pending.hexId}
    <div class="modal-bg">
      <div class="modal">
        <h3>📒 Place ton ordre de vente — {hid}</h3>
        <p class="muted small">
          Tu viens de prendre <b>{hid}</b> (revenu +{hexRev(hid)}/tour). Déclare ton <b>prix de sortie</b> :
          c'est ce que l'adversaire devra payer pour t'évincer. Plancher {floor}.
        </p>
        <div class="modal-input">
          <input type="number" min={floor} bind:value={pending.price} />
          <span class="muted small">défaut suggéré : {defaultAsk(game, hid, CFG)}</span>
        </div>
        <button class="validate" onclick={validateOrder}>Valider l'ordre ✓</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .game { display: flex; flex-direction: column; gap: .7rem; position: relative; }

  .topbar { display: flex; align-items: center; gap: 1rem; background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: .55rem .9rem; }
  .turn { font-size: .9rem; color: #9aa3b5; }
  .turn b { color: #e6ebf5; font-size: 1.05rem; }
  .scores { display: flex; gap: 1.2rem; margin-left: auto; }
  .score { display: flex; align-items: baseline; gap: .4rem; border-left: 3px solid var(--c); padding-left: .55rem; font-size: .82rem; }
  .score.dead { opacity: .45; text-decoration: line-through; }
  .snm { color: #cdd3df; }
  .nw { font-size: 1.05rem; color: #e6ebf5; }
  .nwl { font-size: .62rem; color: #7a8294; }
  .score i { font-style: normal; color: #7a8294; font-size: .76rem; }
  .score i.bad { color: #e05050; }

  .end-turn { background: #1a2030; border: 1px solid #3a4060; color: #9ab0d0; border-radius: 5px; padding: .45rem .9rem; cursor: pointer; font-weight: 600; font-size: .88rem; }
  .end-turn:hover:not(:disabled) { border-color: #5a70b0; }
  .end-turn:disabled { opacity: .4; cursor: not-allowed; }

  .banner { background: #1e2435; border: 1px solid #5ab0a0; border-radius: 8px; padding: .6rem 1rem; display: flex; align-items: center; gap: 1rem; }
  .restart { margin-left: auto; background: #1a2030; border: 1px solid #5ab0a0; color: #b9f5cf; border-radius: 5px; padding: .35rem .8rem; cursor: pointer; }

  .layout { display: grid; grid-template-columns: 1fr 300px; gap: 1rem; align-items: start; }
  .map { width: 100%; background: #0f1117; border: 1px solid #2a2f3a; border-radius: 8px; }
  .hex { cursor: default; }
  .hex.claimable, .hex.evictable { cursor: pointer; }
  .hex.claimable:hover polygon { stroke: #b9f5cf; stroke-width: 4; }
  .hex.evictable:hover polygon { stroke: #ff8a6a; stroke-width: 4; }
  .rev { fill: #fff; font-size: 10px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .ask { fill: #cfe0ff; font-size: 8px; text-anchor: middle; pointer-events: none; }
  .evictc { fill: #ffd0c4; font-size: 8px; font-weight: 700; text-anchor: middle; pointer-events: none; }
  .cost { fill: #c2a04a; font-size: 9px; text-anchor: middle; pointer-events: none; }

  .panel { display: flex; flex-direction: column; gap: .6rem; }
  .card { background: #14161c; border: 1px solid #2a2f3a; border-radius: 8px; padding: .6rem .75rem; }
  .card h3 { margin: 0 0 .5rem; font-size: .82rem; font-weight: 700; color: #cdd3df; border-bottom: 1px solid #2a2f3a; padding-bottom: .35rem; }
  .card[style] h3 { border-color: var(--c); }

  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem .6rem; }
  .grid div { display: flex; justify-content: space-between; align-items: baseline; font-size: .8rem; }
  .grid span { color: #7a8294; }
  .grid b { font-weight: 700; }
  .pos { color: #5ab0a0; }
  .neg { color: #e07a3a; }
  .bad { color: #e05050; }

  .loan-btns { display: flex; gap: .4rem; margin-top: .5rem; }
  .loan-btns button { flex: 1; background: #1a1e28; border: 1px solid #3a4050; color: #cdd3df; border-radius: 5px; padding: .35rem; cursor: pointer; font-size: .78rem; }
  .loan-btns button i { font-style: normal; color: #e08a5a; font-size: .68rem; }
  .loan-btns button:hover:not(:disabled) { border-color: #5a8090; }
  .loan-btns button:disabled { opacity: .4; cursor: not-allowed; }

  .asks { display: flex; flex-direction: column; gap: .25rem; max-height: 160px; overflow: auto; }
  .ask-row { display: flex; align-items: baseline; gap: .5rem; background: #1a1e28; border: 1px solid #2a2f3a; border-radius: 5px; padding: .3rem .5rem; cursor: pointer; text-align: left; color: #cdd3df; font-size: .8rem; }
  .ask-row:hover:not(:disabled) { border-color: #5a8090; }
  .ask-row:disabled { opacity: .5; cursor: not-allowed; }
  .ask-row .hid { font-weight: 700; min-width: 34px; }
  .ask-row b { margin-left: auto; color: #cfe0ff; }
  .tip { margin-top: .4rem; }

  .jrow { padding: .12rem 0; border-bottom: 1px solid #1a1e28; color: #9aa3b5; }

  .muted { color: #7a8294; }
  .small { font-size: .76rem; }

  .modal-bg { position: fixed; inset: 0; background: rgba(8,9,12,.72); display: flex; align-items: center; justify-content: center; z-index: 10; }
  .modal { background: #161922; border: 1px solid #ffd479; border-radius: 10px; padding: 1.2rem 1.4rem; max-width: 380px; }
  .modal h3 { margin: 0 0 .5rem; font-size: 1rem; }
  .modal p { margin: 0 0 .8rem; line-height: 1.5; }
  .modal-input { display: flex; align-items: center; gap: .6rem; margin-bottom: 1rem; }
  .modal-input input { background: #0f1117; border: 1px solid #3a4050; color: #e6ebf5; border-radius: 5px; padding: .45rem .6rem; width: 110px; font-size: 1rem; }
  .validate { background: #1f3a2e; border: 1px solid #5ab0a0; color: #b9f5cf; border-radius: 6px; padding: .5rem 1rem; cursor: pointer; font-weight: 600; width: 100%; }
  .validate:hover { background: #244538; }
</style>
