// Profil NEUTRE — bac à sable de mécanique. Aucune spécificité : accès aux seules
// primitives (OUVRIR long/short, RÉSERVER, LIRE, RENFORCER, FERMER, PARTIAL).
// Sert à tester les mécaniques isolément. Les archétypes (Vautour, Sismographe, …)
// seront des couches de spécificités par-dessus ce socle, développées une à une.

import type { Archetype } from '../../engine/types';

export const NEUTRE: Archetype = {
  id: 'neutre',
  refDev: '—',
  label: 'Profil neutre',
  resource: { id: 'capital', label: 'Capital' },
  startingReserveRatio: 1.0,
  startingHex: '', // ignoré : le prototype d'exploration choisit le spawn
};
