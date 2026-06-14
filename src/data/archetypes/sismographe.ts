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
  // risk-off/risk-on ET la frappe all-in au creux du krach. Lentille sur la physique neutre.
  fragilityGauge: true,
  // CONTRAINTE : « fragile au calme » — thêta de couverture, ponction de richesse/tour hors crise
  // (ses couvertures permanentes décaient dans le boom). Mesuré neutre à ~0.5 %/tour (top1 ~38 %).
  calmTheta: 0.005,
};
