<script lang="ts">
  // Coquille de l'appli — monte directement LE jeu (économie territoriale).
  import GameView from './GameView.svelte';
</script>

<main>
  <header>
    <div class="title">un-jeux <span class="sub">· prototype jouable</span></div>
  </header>

  <GameView />
</main>

<style>
  :global(body) { margin: 0; background: #14161c; color: #cdd3df; font-family: system-ui, sans-serif; }
  main { max-width: 920px; margin: 0 auto; padding: 1rem; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #2a2f3a; padding-bottom: .5rem; margin-bottom: 1rem; }
  .title { font-size: 1.3rem; font-weight: 700; }
  .sub { color: #7a8294; font-weight: 400; font-size: .85rem; }
</style>
