<script lang="ts">
  // Coquille de l'appli : elle monte le jeu principal — le combat tactique (CombatView).
  // NB : le jeu de DAMES (DamesView + engine/dames) est volontairement mis SOUS SILENCE pour
  // l'instant — le code reste dans le dépôt, prêt à être rebranché via un sélecteur d'onglets.
  import CombatView from './CombatView.svelte';
</script>

<main>
  <header>
    <div class="title">un-jeux</div>
  </header>

  <CombatView />
</main>

<style>
  :global(body) { margin: 0; background: #14161c; color: #cdd3df; font-family: system-ui, sans-serif; }
  main { max-width: min(1440px, 98vw); margin: 0 auto; padding: 1rem; }
  header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #2a2f3a; padding-bottom: .5rem; margin-bottom: 1rem; }
  .title { font-size: 1.3rem; font-weight: 700; }
</style>
