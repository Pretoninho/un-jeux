// Fonds leveragé — IA « moteur de fragilité » (spec §7, memo §16). Profil pur.
// Momentum + levier agressif : achète ce qui monte tant que la volatilité PERÇUE
// est basse, réduit lentement quand elle monte (le « trop tard »). Sa contribution
// à F émerge de son levier — elle n'est pas codée en dur.

import type { ProfilIA } from '../../engine/types';

export const FONDS_LEVERAGE: ProfilIA = {
  id: 'fonds_leverage',
  label: 'Fonds leveragé',
  kind: 'pur',
  behavior: {
    entrySignal: 'momentum',
    leverageAppetite: 3,
    riskTolerance: 0.45, // achète tant que la volatilité perçue < 0.45
    deRiskRate: 0.2, // réduit lentement → se fait prendre en crise
    sizing: 0.35,
    decoteThreshold: 0, // n/a pour le momentum
  },
};
