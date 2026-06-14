// Règles d'interaction de l'UI (prototype d'exploration) — fonctions PURES extraites de
// App.svelte pour être testables HORS DOM (la couche Svelte ne fait plus que déléguer ici).
// Tout en entrée explicite, aucun état réactif : on verrouille la logique tricky (traversée,
// CHAIN, déplacement à l'achat de crédit, timing des compétences) contre les régressions.

import type { Hex, HexId } from '../engine/types';

/** Hexe marché V-investissable : marché (pas frontière) et hors cluster crédit (le crédit a
 *  quitté le monde V → coupons, donc pas de prix `V`). */
export function isInvestable(h?: Hex): boolean {
  return !!h && h.kind === 'marche' && h.cluster !== 'credit';
}

/** Émetteur de crédit (coupons) : cluster crédit, marché OU frontière (HY_US comprise). */
export function isCredit(h?: Hex): boolean {
  return !!h && h.cluster === 'credit' && (h.kind === 'marche' || h.kind === 'frontiere');
}

/** Hexe TRAVERSABLE (« se déplacer sans investir ») : marché V OU crédit (frontière verrouillée
 *  comprise — on traverse le crédit pour atteindre les nœuds derrière, ex. IG_US → BC). */
export function isWalkable(h?: Hex): boolean {
  return isInvestable(h) || isCredit(h);
}

/** Coût PA de la prochaine ouverture : 1ʳᵉ = 1 PA, enchaînements suivants = 2 PA (CHAIN). */
export function openCost(opensThisTurn: number): number {
  return opensThisTurn === 0 ? 1 : 2;
}

/** Adjacent au joueur ET révélé — préalable commun à ouvrir / s'installer / se déplacer. */
function reachable(h: Hex | undefined, revealed: Set<HexId>, neighbors: HexId[]): h is Hex {
  return !!h && revealed.has(h.id) && neighbors.includes(h.id);
}

/** Peut OUVRIR une position-V : hexe marché investissable, adjacent, révélé. */
export function canOpenAt(h: Hex | undefined, revealed: Set<HexId>, neighbors: HexId[]): boolean {
  return reachable(h, revealed, neighbors) && isInvestable(h);
}

/** Peut S'INSTALLER : nœud adjacent révélé. */
export function canOccupyAt(h: Hex | undefined, revealed: Set<HexId>, neighbors: HexId[]): boolean {
  return reachable(h, revealed, neighbors) && h.kind === 'noeud';
}

/** Peut SE DÉPLACER (sans investir) : hexe traversable adjacent révélé. */
export function canMoveToAt(h: Hex | undefined, revealed: Set<HexId>, neighbors: HexId[]): boolean {
  return reachable(h, revealed, neighbors) && isWalkable(h);
}

/**
 * PÉRIMÈTRE D'ACTION sur une position EXISTANTE (memo §9bis) — verrou de clôture.
 * On peut agir sur une position détenue en `posHex` (FERMER / clôture partielle) si on est
 * « assez proche » : SUR l'hexe, ADJACENT, ou dans le MÊME CLUSTER (adjacence = corrélation,
 * cluster = voisinage corrélé élargi, §11). Au-delà → trop loin pour piloter la sortie.
 * Asymétrie voulue avec l'OUVERTURE (qui exige l'adjacence stricte) : on sort d'un peu plus
 * loin qu'on n'entre. `ignorePerimeter` (compétence d'archétype) FAIT SAUTER le verrou →
 * clôture n'importe où (desk de trading à distance).
 */
export function canActOnPositionAt(
  posHex: HexId,
  playerHex: HexId,
  neighbors: HexId[],
  clusterOf: (id: HexId) => string | undefined,
  ignorePerimeter = false,
): boolean {
  if (ignorePerimeter) return true;
  if (posHex === playerHex) return true; // on est dessus
  if (neighbors.includes(posHex)) return true; // adjacent = assez proche
  const here = clusterOf(playerHex);
  return here !== undefined && here === clusterOf(posHex); // même cluster
}

/** Peut TRADER un coupon : émetteur crédit révélé (pas d'adjacence requise — « desk obligataire »). */
export function canTradeCouponAt(h: Hex | undefined, revealed: Set<HexId>): boolean {
  return isCredit(h) && !!h && revealed.has(h.id);
}

/** Acheter un coupon DÉPLACE le joueur ssi l'émetteur est adjacent (et qu'on n'y est pas déjà).
 *  Sinon (émetteur lointain révélé = desk à distance) : trade en place, sans téléportation. */
export function couponBuyMoves(issuer: HexId, playerHex: HexId, neighbors: HexId[]): boolean {
  return issuer !== playerHex && neighbors.includes(issuer);
}

/** Activation d'une compétence au tour-moteur `turn` : fenêtre d'effet + tour de re-disponibilité
 *  (cooldown). Vaut pour Récolte (duration) comme Couverture (window). */
export function activateWindow(turn: number, duration: number, cooldown: number): { activeUntil: number; readyAt: number } {
  return { activeUntil: turn + duration - 1, readyAt: turn + duration + cooldown };
}

/** Tours avant re-disponibilité, vus de l'AFFICHAGE (la prochaine résolution = displayTurn+1).
 *  0 = prête. (Décalage d'un tour entre l'écran et la résolution moteur.) */
export function readyInFromDisplay(displayTurn: number, readyAt: number): number {
  return Math.max(0, readyAt - (displayTurn + 1));
}

/** Tours d'effet restants à venir, vus de l'affichage. 0 = inactif. */
export function activeLeftFromDisplay(displayTurn: number, activeUntil: number): number {
  return Math.max(0, activeUntil - displayTurn);
}
