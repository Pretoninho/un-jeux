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
  // Pouvoir signature « Récolte » : le Vautour, gorgé de crédit distressed à fort carry, peut
  // MILKER son rendement par à-coups. Coût 3 PA + cooldown 12 + exposition au défaut en krach
  // = trois contre-poids. Mesuré équilibré (top1 ~40 %, ~3 usages/partie) sur le baseline
  // crédit assaini (Fix A). Exagéré en magnitude (×2), neutre en espérance.
  carrySkill: { factor: 2, duration: 2, cooldown: 12, paCost: 3 },
};
