<script lang="ts">
  // Coquille de l'appli. Front de dev courant = le NOYAU TACTIQUE (déplacement).
  // La vue économique (GameView) reste dans le repo, en attente de FUSION avec le combat.
  import CombatView from './CombatView.svelte';
</script>

<main>
  <header>
    <div class="title">un-jeux <span class="sub">· noyau tactique — déplacement</span></div>
  </header>

  <CombatView />
</main>

<style>
  :global(body) { margin: 0; background: #14161c; color: #cdd3df; font-family: system-ui, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 1rem; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #2a2f3a; padding-bottom: .5rem; margin-bottom: 1rem; }
  .title { font-size: 1.3rem; font-weight: 700; }
  .sub { color: #7a8294; font-weight: 400; font-size: .85rem; }
</style>
