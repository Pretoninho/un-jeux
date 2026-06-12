// Preset par défaut du MVP (spec §3). Ce n'est qu'UNE valeur de ConfigPartie —
// la partie auto-configurée. Rien n'est câblé : changer d'archétype, d'adversaires
// ou de carte = construire une autre ConfigPartie (spec §11bis).

import type { ConfigPartie } from '../engine/types';
import { MVP_MAP } from './maps/mvp-16';
import { VAUTOUR } from './archetypes/vautour';
import { FONDS_LEVERAGE } from './profiles/fonds-leverage';
import { VALUE_PATIENT } from './profiles/value-patient';

export function presetMvp(seed: number): ConfigPartie {
  return {
    archetype: VAUTOUR,
    adversaires: [FONDS_LEVERAGE, VALUE_PATIENT],
    carte: MVP_MAP,
    seed,
  };
}
