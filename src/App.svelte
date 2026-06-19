<script lang="ts">
  // Coquille de l'appli : elle monte le jeu choisi — combat tactique OU dames.
  import CombatView from './CombatView.svelte';
  import DamesView from './DamesView.svelte';

  type Game = 'combat' | 'dames';
  let game = $state<Game>('combat');
</script>

<main>
  <header>
    <div class="title">un-jeux</div>
    <nav class="games">
      <button class:on={game === 'combat'} onclick={() => (game = 'combat')}>⚔ Combat tactique</button>
      <button class:on={game === 'dames'} onclick={() => (game = 'dames')}>⛀ Dames</button>
    </nav>
  </header>

  {#if game === 'combat'}
    <CombatView />
  {:else}
    <DamesView />
  {/if}
</main>

<style>
  :global(body) { margin: 0; background: #14161c; color: #cdd3df; font-family: system-ui, sans-serif; }
  main { max-width: min(1440px, 98vw); margin: 0 auto; padding: 1rem; }
  header { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; border-bottom: 1px solid #2a2f3a; padding-bottom: .5rem; margin-bottom: 1rem; }
  .title { font-size: 1.3rem; font-weight: 700; }
  .games { display: flex; gap: .4rem; }
  .games button {
    background: #20242d; color: #aab2c0; border: 1px solid #2a2f3a;
    border-radius: 6px; padding: .35rem .7rem; cursor: pointer; font-size: .9rem;
  }
  .games button:hover { background: #272c37; }
  .games button.on { background: #2f5d8a; color: #fff; border-color: #2f5d8a; }
</style>
