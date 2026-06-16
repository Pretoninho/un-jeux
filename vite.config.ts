import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// L'UI est en Svelte ; le moteur (src/engine) est du TS pur testé en environnement
// Node (sans DOM) — c'est ce découplage qui rend le harness de simulation possible.
//
// `base` : en build (GitHub Pages = project page sous /un-jeux/) on préfixe les assets ;
// en dev/preview local on reste à la racine pour ne rien casser.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/un-jeux/' : '/',
  plugins: [svelte()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
