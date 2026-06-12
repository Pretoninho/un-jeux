// Le Vautour — unique archétype LIVRÉ au MVP (spec §6). Donnée pure : le moteur
// est N-archétypes, le Vautour n'est qu'une instance. En ajouter un = un fichier.

import type { Archetype } from '../../engine/types';

export const VAUTOUR: Archetype = {
  id: 'vautour',
  refDev: 'H. Marks', // jamais affiché en jeu (memo §6)
  label: 'Le Vautour',
  resource: { id: 'reserve_seche', label: 'Réserve sèche' },
  startingReserveRatio: 1.0, // démarre 100 % en réserve (memo, design-progress)
  startingHex: 'LC_US', // analyste sur le cœur de marché bien connecté (spec §4)
};
