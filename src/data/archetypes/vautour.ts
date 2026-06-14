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
  // Pouvoir OFFENSIF « Récolte » : le Vautour, gorgé de crédit distressed à fort carry, MILKE
  // son rendement par à-coups. ×2 (punch préservé) mais RARE (cooldown 18) pour laisser la
  // place à la défensive. Contre-poids : 3 PA + cooldown + défaut crédit en krach.
  carrySkill: { factor: 2, duration: 2, cooldown: 18, paCost: 3 },
  // Pouvoir DÉFENSIF « Couverture » (armer + auto-tir) : ARMER (2 PA) → anti-défaut des coupons
  // pendant une fenêtre de 2 tours → cooldown 10. L'auto-tir « consomme » la fenêtre quand une
  // crise frappe. Conditionnelle (nulle au calme, vitale en krach) → auto-équilibrée. Mesuré :
  // la PAIRE (Récolte ×2/cd18 + Couverture W2) reste neutre (top1 ~42 %, duel ~50 %).
  coverSkill: { window: 2, cooldown: 10, paCost: 2 },
};
