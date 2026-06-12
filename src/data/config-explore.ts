// Config du prototype d'exploration : carte hexagonale GÉNÉRÉE (seedée) + Vautour
// + 2 IA. Distinct de presetMvp (carte fixe) pour ne pas toucher aux tests.

import type { ConfigPartie } from '../engine/types';
import { generateHexMap } from './maps/generate';
import { NEUTRE } from './archetypes/neutre';
import { FONDS_LEVERAGE } from './profiles/fonds-leverage';
import { VALUE_PATIENT } from './profiles/value-patient';

export function presetExplore(seed: number, radius = 4): ConfigPartie {
  return {
    archetype: NEUTRE,
    adversaires: [FONDS_LEVERAGE, VALUE_PATIENT],
    carte: generateHexMap(seed, radius),
    seed,
  };
}
