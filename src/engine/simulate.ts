// Harness de simulation — signature posée en J1, implémenté en J2.
//
// `simulate(config, n)` joue N parties headless pour n'importe quelle ConfigPartie
// (archétype, table d'IA, carte, seed). C'est l'instrument du calibrage J7 :
//   • cibles statistiques de tempo (memo §28.2)
//   • critère « les signaux battent l'horloge » (memo §28.7)
//   • assertion de neutralité multi-profils (memo §28.8)
//
// Le découplage moteur/UI (engine sans DOM) est ce qui rend ce harness possible.

import type { ConfigPartie } from './types';

export interface SimResult {
  seed: number;
  // Rempli en J2+ : nb de crises, tour(s) de déclenchement, Track Record final,
  // courbe de F, signaux observés… (mesures nécessaires aux tests anti-script).
}

export function simulate(_config: ConfigPartie, _n: number): SimResult[] {
  throw new Error('simulate: non implémenté — jalon J2 (moteur sans UI).');
}
