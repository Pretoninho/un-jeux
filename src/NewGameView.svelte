<script lang="ts">
  // Vue du NOUVEAU jeu — rend LE jeu directement (plus de démos de briques).
  // L'ancien jeu (référence) reste accessible via un lien discret.
  import GameView from './GameView.svelte';

  let { onShowLegacy }: { onShowLegacy: () => void } = $props();
</script>

<main>
  <header>
    <div class="title">un-jeux <span class="sub">· prototype jouable</span></div>
    <button class="legacy-link" onclick={onShowLegacy}>ancien jeu (référence) →</button>
  </header>

  <GameView />
</main>

<style>
  :global(body) { margin: 0; background: #14161c; color: #cdd3df; font-family: system-ui, sans-serif; }
  main { max-width: 920px; margin: 0 auto; padding: 1rem; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #2a2f3a; padding-bottom: .5rem; margin-bottom: 1rem; }
  .title { font-size: 1.3rem; font-weight: 700; }
  .sub { color: #7a8294; font-weight: 400; font-size: .85rem; }
  .legacy-link { background: none; border: none; color: #5a6172; font-size: .78rem; cursor: pointer; padding: .2rem .4rem; }
  .legacy-link:hover { color: #9aa3b5; }
</style>
