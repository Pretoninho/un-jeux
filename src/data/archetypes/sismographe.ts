// Le Sismographe (réf. dev : Soros — jamais affiché en jeu, memo §6). Trader macro qui sent
// les secousses avant tout le monde et frappe au retournement. Donnée pure : un fichier de plus.

import type { Archetype } from '../../engine/types';

export const SISMOGRAPHE: Archetype = {
  id: 'sismographe',
  refDev: 'Soros', // jamais affiché (memo §6)
  label: 'Le Sismographe',
  resource: { id: 'conviction', label: 'Conviction' },
  startingReserveRatio: 1.0, // démarre en cash, déploie tactiquement au bon régime
  startingHex: 'LC_US', // cœur de marché (ignoré par la carte générée du proto)
  // POUVOIR : jauge sismique innée — voit la fragilité `F` cachée (exclusif). Débloque le timing
  // risk-off/risk-on ET le GRAND PARI : shorter le krach (geste directionnel de conviction, à la
  // Soros). Lentille sur la physique neutre.
  fragilityGauge: true,
  // CONTRAINTE 1 : « pas de levier ». Mesuré : levier + jauge = sans risque (on n'amplifie que
  // quand on SAIT) → game-breaking (top1 90-99 %, robuste au bruit). Le Sismographe parie sur la
  // DIRECTION (short), pas sur l'amplification. (Empêche aussi d'écraser le créneau du fonds leveragé.)
  noLeverage: true,
  // CONTRAINTE 2 : « fragile au calme » — thêta de couverture, ponction de richesse/tour hors crise
  // (couvertures qui décaient dans le boom). Mesuré neutre à 0.7 %/tour avec le short (top1 ~39 %).
  calmTheta: 0.007,
};
