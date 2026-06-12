import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// L'UI est en Svelte ; le moteur (src/engine) est du TS pur testé en environnement
// Node (sans DOM) — c'est ce découplage qui rend le harness de simulation possible.
export default defineConfig({
  plugins: [svelte()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
