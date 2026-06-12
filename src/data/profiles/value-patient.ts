// Value patient — IA « stabilisateur » (spec §7, memo §16). Profil pur.
// Achète la décote (V sous son ancre estimée), petite taille, JAMAIS de levier,
// ne panique pas. Absorbe les chocs et entre en concurrence avec le Vautour pour
// les actifs bradés après un krach.

import type { ProfilIA } from '../../engine/types';

export const VALUE_PATIENT: ProfilIA = {
  id: 'value_patient',
  label: 'Value patient',
  kind: 'pur',
  behavior: {
    entrySignal: 'value',
    leverageAppetite: 0, // jamais de levier
    riskTolerance: 1, // ignore la volatilité (ne panique pas)
    deRiskRate: 0,
    sizing: 0.2,
    decoteThreshold: 0.05, // achète quand V est ≥5% sous l'ancre estimée
  },
};
