<script lang="ts">
  import {
    makeOrderBook,
    postOrder,
    cancelOrder,
    displayPrice,
    makeOrderId,
    type OrderBook,
    type Order,
    type Trade,
  } from './engine/orderbook';
  import type { ActorState } from './engine/state';

  const HEX = 'DEMO';
  const START_CASH = 500;
  const START_SHARES = 10;

  // ── Acteurs mockés ────────────────────────────────────────────────────────
  function makeActor(id: string): ActorState {
    return {
      id,
      cash: START_CASH,
      positions: [{ hexId: HEX, direction: 'long', equity: START_SHARES, leverage: 0, entryV: 10 }],
      couponPositions: [],
      wealthHistory: [],
    } as unknown as ActorState;
  }

  let actors = $state<ActorState[]>([makeActor('alice'), makeActor('bob')]);
  let book = $state<OrderBook>(makeOrderBook(HEX));
  let trades = $state<Array<Trade & { turn: number }>>([]);
  let turn = $state(0);

  // ── Formulaire ────────────────────────────────────────────────────────────
  let formActor = $state('alice');
  let formSide = $state<'buy' | 'sell'>('buy');
  let formPrice = $state(10);
  let formShares = $state(1);
  let lastMsg = $state('');

  function shares(a: ActorState): number {
    return Math.floor(a.positions.find(p => p.hexId === HEX && p.direction === 'long')?.equity ?? 0);
  }

  function post() {
    const actor = actors.find(a => a.id === formActor);
    if (!actor) return;

    const order: Order = {
      id: makeOrderId(),
      actorId: formActor,
      hexId: HEX,
      side: formSide,
      price: formPrice,
      shares: formShares,
    };

    const { trades: newTrades, remainder } = postOrder(book, order, actors);

    if (newTrades.length === 0 && remainder === null) {
      lastMsg = formSide === 'buy'
        ? `Refusé — cash insuffisant (${actor.cash.toFixed(0)} < ${formPrice * formShares})`
        : `Refusé — parts insuffisantes (${shares(actor)} < ${formShares})`;
      return;
    }

    turn += 1;
    for (const t of newTrades) trades = [{ ...t, turn }, ...trades].slice(0, 20);

    if (newTrades.length > 0) {
      lastMsg = `✓ ${newTrades.length} échange(s) · ${newTrades.map(t => `${t.shares}×${t.price}`).join(', ')}`;
    } else {
      lastMsg = `En attente — ${remainder!.shares} part(s) à ${remainder!.price} dans le carnet`;
    }

    // force réactivité
    actors = [...actors];
    book = { ...book };
  }

  function reset() {
    actors = [makeActor('alice'), makeActor('bob')];
    book = makeOrderBook(HEX);
    trades = [];
    turn = 0;
    lastMsg = '';
  }

  const actor = (id: string) => actors.find(a => a.id === id)!;
  const fmt = (n: number) => n.toFixed(0);
</script>

<div class="demo">
  <div class="demo-header">
    <h2>Carnet d'ordres · demo <span class="hint">hexe {HEX}</span></h2>
    <button onclick={reset} class="reset">Réinitialiser</button>
  </div>

  <!-- Acteurs -->
  <div class="actors">
    {#each actors as a}
      <div class="actor" class:alice={a.id === 'alice'} class:bob={a.id === 'bob'}>
        <div class="actor-name">{a.id}</div>
        <div class="actor-row">
          <span class="lbl">cash</span>
          <b class:neg={a.cash < 0}>{fmt(a.cash)}</b>
        </div>
        <div class="actor-row">
          <span class="lbl">parts</span>
          <b>{shares(a)}</b>
        </div>
        <div class="actor-row">
          <span class="lbl">valeur</span>
          <span class="muted">{displayPrice(book) != null ? fmt(a.cash + shares(a) * displayPrice(book)!) : '—'}</span>
        </div>
      </div>
    {/each}
    <div class="actor total">
      <div class="actor-name">total</div>
      <div class="actor-row">
        <span class="lbl">cash</span>
        <b>{fmt(actors.reduce((s, a) => s + a.cash, 0))}</b>
      </div>
      <div class="actor-row">
        <span class="lbl">parts</span>
        <b>{actors.reduce((s, a) => s + shares(a), 0)}</b>
      </div>
      <div class="actor-row zerosum">
        <span class="lbl hint">zéro-sum</span>
        <span class="muted small">transfert pur</span>
      </div>
    </div>
  </div>

  <!-- Carnet -->
  <div class="ob">
    <div class="ob-col asks">
      <div class="ob-title">VENTES <span class="muted small">(asks)</span></div>
      {#if book.asks.length === 0}
        <div class="ob-empty muted small">aucune offre</div>
      {:else}
        {#each [...book.asks].reverse() as o}
          <div class="ob-row ask">
            <span class="ob-actor">{o.actorId}</span>
            <span class="ob-qty">{o.shares} part{o.shares > 1 ? 's' : ''}</span>
            <b class="ob-price ask-color">{o.price}</b>
            <button class="cancel" title="Annuler" onclick={() => { cancelOrder(book, o.id); book = { ...book }; }}>×</button>
          </div>
        {/each}
      {/if}
    </div>

    <div class="ob-mid">
      <div class="last-price">
        {#if book.lastPrice !== null}
          <div class="lp-label">dernier échange</div>
          <div class="lp-val">{book.lastPrice}</div>
        {:else}
          <div class="lp-label muted">aucun échange</div>
        {/if}
        <div class="spread muted small">
          {#if book.asks.length > 0 && book.bids.length > 0}
            spread : {book.asks[0].price - book.bids[0].price}
          {/if}
        </div>
      </div>
    </div>

    <div class="ob-col bids">
      <div class="ob-title">ACHATS <span class="muted small">(bids)</span></div>
      {#if book.bids.length === 0}
        <div class="ob-empty muted small">aucune offre</div>
      {:else}
        {#each book.bids as o}
          <div class="ob-row bid">
            <button class="cancel" title="Annuler" onclick={() => { cancelOrder(book, o.id); book = { ...book }; }}>×</button>
            <b class="ob-price bid-color">{o.price}</b>
            <span class="ob-qty">{o.shares} part{o.shares > 1 ? 's' : ''}</span>
            <span class="ob-actor">{o.actorId}</span>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <!-- Formulaire -->
  <div class="form">
    <div class="form-row">
      <label>
        Acteur
        <select bind:value={formActor}>
          <option value="alice">alice</option>
          <option value="bob">bob</option>
        </select>
      </label>
      <label>
        Sens
        <div class="side-btns">
          <button class:active={formSide === 'buy'} onclick={() => (formSide = 'buy')}>ACHETER</button>
          <button class:active={formSide === 'sell'} onclick={() => (formSide = 'sell')}>VENDRE</button>
        </div>
      </label>
      <label>
        Prix
        <input type="number" bind:value={formPrice} min="1" step="1" />
      </label>
      <label>
        Parts
        <input type="number" bind:value={formShares} min="1" step="1" />
      </label>
      <button class="post-btn" class:buy={formSide === 'buy'} class:sell={formSide === 'sell'} onclick={post}>
        Poster l'ordre
      </button>
    </div>
    {#if lastMsg}
      <div class="msg" class:ok={lastMsg.startsWith('✓')} class:err={lastMsg.startsWith('Refusé')}>{lastMsg}</div>
    {/if}

    <div class="rules muted small">
      <b>Règles SI→ALORS :</b>
      SI prix achat ≥ meilleure vente → échange au prix de <em>l'ordre qui attendait</em> · SINON → rejoint le carnet · Prix affiché = dernier échange
    </div>
  </div>

  <!-- Log des trades -->
  {#if trades.length > 0}
    <div class="tradelog">
      <h4>Échanges <span class="hint">zéro-sum : cash envoyé = cash reçu</span></h4>
      {#each trades as t}
        <div class="trade-row">
          <span class="t-turn">#{t.turn}</span>
          <span class="t-buyer bid-color">{t.buyerId}</span>
          achète
          <b>{t.shares} part{t.shares > 1 ? 's' : ''}</b>
          à
          <b>{t.price}</b>
          à
          <span class="t-seller ask-color">{t.sellerId}</span>
          <span class="t-cash muted">({t.price * t.shares} cash transféré)</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .demo { background: #0e1015; border: 1px solid #2a2f3a; border-radius: 10px; padding: 1.2rem; margin-top: 1rem; }
  .demo-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .demo-header h2 { margin: 0; font-size: 1rem; }
  .hint { color: #7a8294; font-size: .8rem; font-weight: 400; }
  .muted { color: #7a8294; }
  .small { font-size: .8rem; }
  .neg { color: #e0564f; }

  /* Acteurs */
  .actors { display: flex; gap: .8rem; margin-bottom: 1.2rem; }
  .actor { flex: 1; background: #14161c; border-radius: 6px; padding: .6rem .8rem; border: 1px solid #2a2f3a; }
  .actor.alice { border-color: #5ab0a0; }
  .actor.bob { border-color: #e07a3a; }
  .actor.total { border-color: #444; }
  .actor-name { font-weight: 700; font-size: .85rem; margin-bottom: .3rem; text-transform: uppercase; letter-spacing: .05em; }
  .alice .actor-name { color: #5ab0a0; }
  .bob .actor-name { color: #e07a3a; }
  .total .actor-name { color: #888; }
  .actor-row { display: flex; justify-content: space-between; align-items: center; font-size: .85rem; padding: .1rem 0; }
  .lbl { color: #7a8294; }
  .zerosum { border-top: 1px solid #2a2f3a; margin-top: .3rem; padding-top: .3rem; }

  /* Carnet */
  .ob { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0; border: 1px solid #2a2f3a; border-radius: 8px; overflow: hidden; margin-bottom: 1.2rem; }
  .ob-col { padding: .6rem; }
  .ob-col.asks { background: #120e0e; border-right: 1px solid #2a2f3a; }
  .ob-col.bids { background: #0a0e12; }
  .ob-title { font-size: .75rem; font-weight: 700; letter-spacing: .06em; color: #9aa3b5; margin-bottom: .4rem; }
  .ob-empty { padding: .3rem 0; }
  .ob-row { display: flex; align-items: center; gap: .5rem; font-size: .85rem; padding: .15rem 0; }
  .ob-row.ask { justify-content: flex-end; }
  .ob-row.bid { justify-content: flex-start; }
  .ob-price { font-size: 1rem; min-width: 2.5rem; text-align: center; }
  .ask-color { color: #e0564f; }
  .bid-color { color: #5ab0a0; }
  .ob-qty { color: #9aa3b5; font-size: .8rem; }
  .ob-actor { color: #7a8294; font-size: .78rem; }
  .cancel { background: none; border: none; color: #444; cursor: pointer; padding: 0 .2rem; font-size: .9rem; line-height: 1; }
  .cancel:hover { color: #888; }

  .ob-mid { display: flex; align-items: center; justify-content: center; padding: .8rem .6rem; background: #0e1015; border-left: 1px solid #2a2f3a; border-right: 1px solid #2a2f3a; }
  .last-price { text-align: center; }
  .lp-label { font-size: .72rem; color: #7a8294; }
  .lp-val { font-size: 1.4rem; font-weight: 700; color: #e8b54a; }
  .spread { margin-top: .3rem; }

  /* Formulaire */
  .form { background: #14161c; border-radius: 8px; padding: .8rem; margin-bottom: 1rem; }
  .form-row { display: flex; gap: .8rem; align-items: flex-end; flex-wrap: wrap; }
  label { display: flex; flex-direction: column; gap: .25rem; font-size: .8rem; color: #9aa3b5; }
  select, input[type=number] { background: #0e1015; border: 1px solid #2a2f3a; color: #e6ebf5; padding: .3rem .5rem; border-radius: 4px; font-size: .9rem; width: 5rem; }
  .side-btns { display: flex; gap: .3rem; }
  .side-btns button { padding: .3rem .6rem; font-size: .85rem; background: #1a1e28; border: 1px solid #2a2f3a; color: #7a8294; border-radius: 4px; cursor: pointer; }
  .side-btns button.active { background: #1e2435; border-color: #5ab0a0; color: #e6ebf5; }
  .post-btn { padding: .4rem 1rem; border-radius: 5px; font-size: .9rem; font-weight: 700; cursor: pointer; border: none; margin-top: 1rem; }
  .post-btn.buy { background: #1a3028; color: #5ab0a0; border: 1px solid #5ab0a0; }
  .post-btn.sell { background: #2a1515; color: #e0564f; border: 1px solid #e0564f; }
  .post-btn:hover { opacity: .85; }
  .msg { margin-top: .5rem; font-size: .85rem; padding: .25rem .5rem; border-radius: 4px; }
  .msg.ok { color: #5ab0a0; background: #0d1f1a; }
  .msg.err { color: #e0564f; background: #1f0d0d; }
  .rules { margin-top: .6rem; line-height: 1.5; }
  .reset { background: none; border: 1px solid #2a2f3a; color: #7a8294; padding: .3rem .7rem; border-radius: 4px; cursor: pointer; font-size: .8rem; }
  .reset:hover { border-color: #888; color: #cdd3df; }

  /* Log */
  .tradelog { background: #14161c; border-radius: 8px; padding: .8rem; }
  .tradelog h4 { margin: 0 0 .5rem; font-size: .85rem; color: #9aa3b5; }
  .trade-row { font-size: .83rem; padding: .2rem 0; display: flex; gap: .4rem; align-items: center; flex-wrap: wrap; border-bottom: 1px solid #1c1f28; }
  .t-turn { color: #555; font-size: .75rem; min-width: 1.5rem; }
  .t-cash { font-size: .78rem; }
</style>
