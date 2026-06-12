<script lang="ts">
  // Coquille vide — l'UI réelle arrive en J5. J1 ne fait que prouver le câblage
  // Vite + Svelte + TS. Le moteur (src/engine) vit indépendamment de ce fichier.
  import { presetMvp } from './data/config-mvp';

  const config = presetMvp(1);
</script>

<main>
  <h1>un-jeux</h1>
  <p>Squelette J1 — moteur découplé de l'UI.</p>
  <p>
    Preset MVP : <strong>{config.archetype.label}</strong>
    vs {config.adversaires.map((a) => a.label).join(', ')}
    · carte <code>{config.carte.id}</code> ({config.carte.hexes.length} hexes)
  </p>
</main>

<style>
  main {
    font-family: system-ui, sans-serif;
    max-width: 40rem;
    margin: 4rem auto;
    padding: 0 1rem;
    line-height: 1.5;
  }
</style>
