// Config du prototype d'exploration : carte hexagonale GÉNÉRÉE (seedée) + archétype au choix
// + 2 IA. Distinct de presetMvp (carte fixe) pour ne pas toucher aux tests.

import type { ConfigPartie, Archetype } from '../engine/types';
import { generateHexMap } from './maps/generate';
import { NEUTRE } from './archetypes/neutre';
import { VAUTOUR } from './archetypes/vautour';
import { SISMOGRAPHE } from './archetypes/sismographe';
import { FONDS_LEVERAGE } from './profiles/fonds-leverage';
import { VALUE_PATIENT } from './profiles/value-patient';

/** Archétypes jouables proposés dans l'UI (sélecteur de nouvelle partie). */
export const PLAYABLE_ARCHETYPES: readonly Archetype[] = [VAUTOUR, SISMOGRAPHE, NEUTRE];

export function presetExplore(seed: number, radius = 4, archetype: Archetype = VAUTOUR): ConfigPartie {
  return {
    archetype,
    adversaires: [FONDS_LEVERAGE, VALUE_PATIENT],
    carte: generateHexMap(seed, radius),
    seed,
  };
}
