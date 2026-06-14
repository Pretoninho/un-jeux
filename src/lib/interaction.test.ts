// Tests des règles d'interaction PURES (src/lib/interaction.ts) — verrouille la logique UI
// tricky hors DOM : traversée du crédit, CHAIN, déplacement à l'achat de crédit, timing des
// compétences. (App.svelte délègue à ces fonctions → ce qui est testé est ce qui tourne.)

import { describe, it, expect } from 'vitest';
import type { Hex, HexKind, Cluster } from '../engine/types';
import {
  isInvestable, isCredit, isWalkable, openCost, canOpenAt, canOccupyAt, canMoveToAt,
  canTradeCouponAt, couponBuyMoves, canActOnPositionAt, activateWindow, readyInFromDisplay, activeLeftFromDisplay,
} from './interaction';

const hex = (id: string, kind: HexKind, cluster?: Cluster): Hex => ({ id, label: id, kind, cluster, neighbors: [] });
const ACT = hex('LC', 'marche', 'actions'); // marché actions (investissable, traversable)
const IG = hex('IG', 'marche', 'credit'); // crédit marché (non-V, traversable, tradable)
const HY = hex('HY', 'frontiere', 'credit'); // crédit frontière (verrouillé mais traversable/tradable)
const EXOT = hex('EXOT', 'frontiere', 'alternatifs'); // frontière non-crédit (ni investissable ni traversable)
const FED = hex('FED', 'noeud'); // nœud (s'installer, pas investir/traverser)

describe('prédicats d’hexe', () => {
  it('isInvestable : marché non-crédit seulement', () => {
    expect(isInvestable(ACT)).toBe(true);
    expect(isInvestable(IG)).toBe(false); // crédit hors monde V
    expect(isInvestable(EXOT)).toBe(false); // frontière
    expect(isInvestable(FED)).toBe(false); // nœud
    expect(isInvestable(undefined)).toBe(false);
  });
  it('isCredit : cluster crédit, marché OU frontière', () => {
    expect(isCredit(IG)).toBe(true);
    expect(isCredit(HY)).toBe(true); // frontière crédit comprise
    expect(isCredit(ACT)).toBe(false);
    expect(isCredit(FED)).toBe(false);
  });
  it('isWalkable : marché V OU crédit (frontière verrouillée comprise), pas nœud ni frontière non-crédit', () => {
    expect(isWalkable(ACT)).toBe(true);
    expect(isWalkable(IG)).toBe(true);
    expect(isWalkable(HY)).toBe(true); // on traverse le crédit verrouillé
    expect(isWalkable(EXOT)).toBe(false);
    expect(isWalkable(FED)).toBe(false);
  });
});

describe('CHAIN — coût des ouvertures', () => {
  it('1ʳᵉ ouverture = 1 PA, enchaînements = 2 PA', () => {
    expect(openCost(0)).toBe(1);
    expect(openCost(1)).toBe(2);
    expect(openCost(3)).toBe(2);
  });
});

describe('accessibilité (adjacent + révélé)', () => {
  const revealed = new Set(['LC', 'IG', 'HY', 'FED']);
  const neighbors = ['LC', 'IG', 'HY', 'FED']; // tous adjacents au joueur

  it('canOpenAt : marché investissable adjacent révélé ; PAS le crédit', () => {
    expect(canOpenAt(ACT, revealed, neighbors)).toBe(true);
    expect(canOpenAt(IG, revealed, neighbors)).toBe(false); // crédit non V-investissable
    expect(canOpenAt(ACT, revealed, [])).toBe(false); // non adjacent
    expect(canOpenAt(ACT, new Set(), neighbors)).toBe(false); // non révélé
  });
  it('canMoveToAt : marché ET crédit (frontière comprise) traversables ; pas le nœud', () => {
    expect(canMoveToAt(ACT, revealed, neighbors)).toBe(true);
    expect(canMoveToAt(IG, revealed, neighbors)).toBe(true); // déplacement sur le crédit
    expect(canMoveToAt(HY, revealed, neighbors)).toBe(true); // crédit verrouillé traversable
    expect(canMoveToAt(FED, revealed, neighbors)).toBe(false); // nœud = s'installer, pas déplacer
  });
  it('canOccupyAt : nœud adjacent révélé', () => {
    expect(canOccupyAt(FED, revealed, neighbors)).toBe(true);
    expect(canOccupyAt(ACT, revealed, neighbors)).toBe(false);
  });
  it('canTradeCouponAt : crédit révélé, SANS contrainte d’adjacence (desk obligataire)', () => {
    expect(canTradeCouponAt(IG, revealed)).toBe(true);
    expect(canTradeCouponAt(HY, revealed)).toBe(true);
    expect(canTradeCouponAt(ACT, revealed)).toBe(false); // pas un émetteur crédit
    expect(canTradeCouponAt(IG, new Set())).toBe(false); // non révélé
  });
});

describe('périmètre de clôture (verrou §9bis)', () => {
  // Carte : le joueur est en LC (cluster actions). EQ2 = même cluster (lointain), CR1 = cluster crédit (lointain).
  const clusterOf = (id: string) =>
    ({ LC: 'actions', EQ2: 'actions', CR1: 'credit', NODE: undefined } as Record<string, string | undefined>)[id];
  const neighbors = ['IG', 'FED']; // adjacents au joueur (LC)

  it('peut clôturer SUR l’hexe courant', () => {
    expect(canActOnPositionAt('LC', 'LC', neighbors, clusterOf)).toBe(true);
  });
  it('peut clôturer une position ADJACENTE', () => {
    expect(canActOnPositionAt('IG', 'LC', neighbors, clusterOf)).toBe(true);
  });
  it('peut clôturer dans le MÊME CLUSTER même non adjacent', () => {
    expect(canActOnPositionAt('EQ2', 'LC', neighbors, clusterOf)).toBe(true); // actions = actions
  });
  it('NE peut PAS clôturer un autre cluster, non adjacent (hors périmètre)', () => {
    expect(canActOnPositionAt('CR1', 'LC', neighbors, clusterOf)).toBe(false); // credit ≠ actions, lointain
  });
  it('cluster indéfini des deux côtés ne crée pas de portée (nœud sans cluster)', () => {
    expect(canActOnPositionAt('NODE', 'NODE', neighbors, clusterOf)).toBe(true); // même hexe l’emporte
    expect(canActOnPositionAt('NODE', 'CR1', neighbors, clusterOf)).toBe(false); // undefined ≠ match
  });
  it('la compétence ignorePerimeter fait SAUTER le verrou (clôture n’importe où)', () => {
    expect(canActOnPositionAt('CR1', 'LC', neighbors, clusterOf, true)).toBe(true);
  });
});

describe('déplacement à l’achat de crédit', () => {
  it('se déplace ssi l’émetteur est adjacent et qu’on n’y est pas déjà', () => {
    expect(couponBuyMoves('IG', 'LC', ['IG', 'HY'])).toBe(true); // adjacent → on y va
    expect(couponBuyMoves('IG', 'IG', ['LC'])).toBe(false); // déjà sur place
    expect(couponBuyMoves('IG', 'LC', ['HY'])).toBe(false); // lointain (desk) → pas de téléportation
  });
});

describe('timing des compétences (Récolte / Couverture)', () => {
  it('activateWindow : fenêtre d’effet + re-disponibilité (cooldown)', () => {
    expect(activateWindow(5, 2, 10)).toEqual({ activeUntil: 6, readyAt: 17 }); // actif 5-6, prête à 17
    expect(activateWindow(1, 2, 18)).toEqual({ activeUntil: 2, readyAt: 21 }); // Récolte (cd18)
  });
  it('readyInFromDisplay : décalage écran→résolution (displayTurn+1), 0 = prête', () => {
    expect(readyInFromDisplay(4, 17)).toBe(12); // prochaine résolution = 5 → 17-5
    expect(readyInFromDisplay(16, 17)).toBe(0); // 17-17 = prête
    expect(readyInFromDisplay(20, 17)).toBe(0); // jamais négatif
  });
  it('activeLeftFromDisplay : tours d’effet restants, 0 = inactif', () => {
    expect(activeLeftFromDisplay(5, 6)).toBe(1);
    expect(activeLeftFromDisplay(6, 6)).toBe(0);
    expect(activeLeftFromDisplay(9, 6)).toBe(0);
  });
});
