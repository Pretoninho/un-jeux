// Catalogue d'actions du MVP — données (memo §9, §9bis). Les coûts sont des
// valeurs de prototype, réglables au calibrage (J7) sans toucher au moteur.
//
// POSITIONNER se décline en 4 opérations. L'ancien « redimensionner (augmenter ou
// réduire) » a été scindé en `renforcer` (haut) et `cloture_partielle` (bas) pour
// éviter que la clôture partielle ne soit une option morte (dominée par un
// redimensionnement à la baisse moins cher). Voir memo §9bis.

import type { ActionDef, Verbe } from '../engine/types';

/** Budget d'action par tour (memo §8). Valeur de prototype. */
export const PA_PAR_TOUR = 4;

export const ACTIONS: readonly ActionDef[] = [
  { id: 'lire', verbe: 'LIRE', label: 'Lire un signal / poser un analyste', paMin: 1, paMax: 1 },

  // POSITIONNER — 4 opérations (memo §9bis)
  { id: 'pos_ouvrir', verbe: 'POSITIONNER', op: 'ouvrir', label: 'Ouvrir une position', paMin: 1, paMax: 2 },
  { id: 'pos_renforcer', verbe: 'POSITIONNER', op: 'renforcer', label: 'Renforcer une position', paMin: 1, paMax: 2 },
  // Décisivité bon marché vs hésitation gérée : Fermer (1) < Clôture partielle (2).
  { id: 'pos_cloture_partielle', verbe: 'POSITIONNER', op: 'cloture_partielle', label: 'Clôture partielle', paMin: 2, paMax: 2 },
  { id: 'pos_fermer', verbe: 'POSITIONNER', op: 'fermer', label: 'Fermer (totale)', paMin: 1, paMax: 1 },

  { id: 'reserver', verbe: 'RESERVER', label: 'Réserver (garder la réserve sèche)', paMin: 0, paMax: 0 },
] as const;

/** Verbes effectivement présents au MVP. */
export const VERBES_MVP: readonly Verbe[] = ['LIRE', 'POSITIONNER', 'RESERVER'];

export function actionById(id: string): ActionDef | undefined {
  return ACTIONS.find((a) => a.id === id);
}
