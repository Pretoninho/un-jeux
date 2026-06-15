<script lang="ts">
  // Vue propre du NOUVEAU jeu — n'affiche QUE les briques en cours de construction.
  // L'ancien jeu (référence) reste accessible via un bouton, sans parasiter cette vue.
  import OrderBookDemo from './OrderBookDemo.svelte';
  import RevenueDemo from './RevenueDemo.svelte';
  import CampDemo from './CampDemo.svelte';
  import TickDemo from './TickDemo.svelte';

  let { onShowLegacy }: { onShowLegacy: () => void } = $props();

  // Une brique visible à la fois : on ne montre que ce qu'on teste.
  type Brick = 'tick' | 'revenue' | 'orderbook' | 'camp';
  let brick = $state<Brick>('tick');
</script>

<main>
  <header>
    <div class="title">un-jeux <span class="sub">· nouveau prototype</span></div>
    <button class="legacy-link" onclick={onShowLegacy}>ancien jeu (référence) →</button>
  </header>

  <nav class="bricks">
    <button class:active={brick === 'tick'} onclick={() => (brick = 'tick')}>⏩ Tick (boucle)</button>
    <button class:active={brick === 'camp'} onclick={() => (brick = 'camp')}>🏕️ Camp / emprunt</button>
    <button class:active={brick === 'revenue'} onclick={() => (brick = 'revenue')}>🏞️ Revenu &amp; agglomération</button>
    <button class:active={brick === 'orderbook'} onclick={() => (brick = 'orderbook')}>📒 Carnet d'ordres</button>
  </nav>

  <section class="stage">
    {#if brick === 'tick'}
      <TickDemo />
    {:else if brick === 'camp'}
      <CampDemo />
    {:else if brick === 'revenue'}
      <RevenueDemo />
    {:else if brick === 'orderbook'}
      <OrderBookDemo />
    {/if}
  </section>
</main>

<style>
  :global(body) { margin: 0; background: #14161c; color: #cdd3df; font-family: system-ui, sans-serif; }
  main { max-width: 880px; margin: 0 auto; padding: 1rem; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #2a2f3a; padding-bottom: .5rem; }
  .title { font-size: 1.3rem; font-weight: 700; }
  .sub { color: #7a8294; font-weight: 400; font-size: .85rem; }
  .legacy-link { background: none; border: none; color: #5a6172; font-size: .78rem; cursor: pointer; padding: .2rem .4rem; }
  .legacy-link:hover { color: #9aa3b5; }

  .bricks { display: flex; gap: .5rem; margin: 1rem 0 .5rem; }
  .bricks button { background: #1a1e28; border: 1px solid #2a2f3a; color: #9aa3b5; padding: .5rem .9rem; border-radius: 6px; cursor: pointer; font-size: .9rem; }
  .bricks button.active { background: #1e2435; border-color: #5ab0a0; color: #e6ebf5; }
  .bricks button:hover { border-color: #5ab0a0; }

  .stage { margin-top: .5rem; }
</style>
