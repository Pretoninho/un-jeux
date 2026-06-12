// Config du prototype d'exploration : carte hexagonale GÉNÉRÉE (seedée) + Vautour
// + 2 IA. Distinct de presetMvp (carte fixe) pour ne pas toucher aux tests.

import type { ConfigPartie } from '../engine/types';
import { generateHexMap } from './maps/generate';
import { VAUTOUR } from './archetypes/vautour';
import { FONDS_LEVERAGE } from './profiles/fonds-leverage';
import { VALUE_PATIENT } from './profiles/value-patient';

export function presetExplore(seed: number, radius = 3): ConfigPartie {
  return {
    archetype: VAUTOUR,
    adversaires: [FONDS_LEVERAGE, VALUE_PATIENT],
    carte: generateHexMap(seed, radius),
    seed,
  };
}
