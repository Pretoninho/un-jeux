// Crédit-coupons & Banque centrale — moteur (spec docs/spec-credit-coupons.md, phase 2a).
//
// Le crédit quitte le monde des prix-`V` : chaque hexe crédit devient un ÉMETTEUR de
// coupons. Un coupon = un taux fixé à l'émission + une maturité (RCE) + un principal.
// Le joueur s'y positionne LONG (parier no-défaut, encaisser le portage) ou SHORT
// (parier sur le défaut, payer le portage), UNE seule fois, taille choisie une fois.
//
// Principe non négociable (spec §0) : le coupon porte un risque LISIBLE, sinon c'est un
// sous-jeu résolu. Deux risques, tous deux branchés sur l'état caché F :
//   1. défaut en crise (tout-ou-rien, perte du principal) — croît avec F et la qualité ;
//   2. risque de taux au rollover — le taux du prochain coupon dépend de la BC, qui
//      réagit à F (fonction de réaction LISIBLE → le ton de la BC trahit F).
//
// ⚠️ Module AUTONOME et testé (phase 2a, étape 1). L'intégration dans la boucle de tour
// (sortie du crédit du monde V, benchmark alpha-pur, IA) est l'étape suivante.
//
// Modèle de trésorerie (cohérent avec `positionValue`, portfolio.ts) :
//   LONG  : ouverture cash −U, valeur position +U (pair) ; +taux·U/tour ; échéance +U ;
//           défaut → la valeur +U disparaît = perte du principal.
//   SHORT : ouverture cash +U, valeur position −U (dette) ; −taux·U/tour ; échéance −U ;
//           défaut → la dette −U disparaît = gain du principal.

import type { HexId, GameMap } from './types';
import type { InstanceParams } from './params';
import type { Rng } from './rng';

export type CouponMaturity = 'court' | 'long';
export type CouponSide = 'long' | 'short';

/** Un coupon OFFERT au carnet d'un émetteur. */
export interface Coupon {
  id: string;
  issuer: HexId;
  maturity: CouponMaturity;
  /** Rendement/tour, fixé à l'émission (ne bouge plus). */
  rate: number;
  /** Spread STRUCTUREL de l'émetteur (carry de l'hexe) — pilote le risque de défaut,
   *  indépendamment du taux directeur. IG faible, HY élevé. */
  qualitySpread: number;
  /** Rounds until Coupon Expires à l'émission. */
  rce: number;
}

/** Une position prise sur un coupon (long XOR short, une fois, taille verrouillée). */
export interface CouponPosition {
  couponId: string;
  issuer: HexId;
  side: CouponSide;
  /** Taux verrouillé à l'entrée. */
  rate: number;
  qualitySpread: number;
  /** Notionnel `U` — choisi une fois à l'ouverture, VERROUILLÉ. */
  notional: number;
  /** Tours restants avant échéance (décrémenté chaque tour). */
  rceLeft: number;
}

/** État de la Banque centrale (nœud FED). */
export interface BCState {
  /** Taux directeur courant r_BC. */
  rate: number;
  /** Cible de la fonction de réaction (visible 1 tour à l'avance si présence FED). */
  target: number;
}

/** État du sous-système crédit. */
export interface CreditState {
  bc: BCState;
  /** Coupons offerts (un court + un long par émetteur crédit). */
  book: Coupon[];
  /** Compteur d'identifiants de coupons émis. */
  seq: number;
}

/** Émetteurs crédit de la carte (hexes du cluster crédit). */
export function creditIssuers(map: GameMap): { id: HexId; carry: number }[] {
  return map.hexes
    .filter((h) => h.cluster === 'credit')
    .map((h) => ({ id: h.id, carry: h.carry ?? 0 }));
}

/** Surplus de fragilité au-dessus de la zone morte (0 sous le seuil). */
function excessF(fragility: number, p: InstanceParams): number {
  return Math.max(0, fragility - p.crisisDeadZone);
}

/**
 * Réunion de la BC ce tour-ci ? (spec §4c, idée « annonce planifiée ».) `every <= 1` =
 * réaction continue (un réajustement par tour, comportement historique). Sinon la BC ne
 * statue qu'aux tours multiples de `every` : entre deux réunions, `r_BC` reste FIGÉ → le
 * taux devient une décision discrète et anticipable (forward guidance sous présence FED).
 */
export function bcMeets(turn: number, every: number): boolean {
  return every <= 1 || turn % every === 0;
}

/**
 * Cible de la fonction de réaction de la BC (spec §4b) : où la BC veut poser le taux vu l'état
 * caché courant. Monte avec la surchauffe (F au-dessus de la zone morte), plonge en crise.
 * Plancher à 0 (pas de taux négatif). PURE — sert au forward guidance (cible recalculée chaque
 * tour) ET à la réaction (le taux y converge / y saute).
 */
export function bcReactionTarget(fragility: number, inCrisis: boolean, p: InstanceParams): number {
  return Math.max(0, p.bcRateBase + p.bcReactF * excessF(fragility, p) - (inCrisis ? p.bcReactCrisis : 0));
}

/**
 * Fonction de réaction de la BC (spec §4b). La cible monte avec la surchauffe (F
 * au-dessus de la zone morte) et plonge en crise ; le taux s'y ajuste GRADUELLEMENT
 * (lissage θ) → partiellement anticipable. Mute `bc`. Plancher à 0 (pas de taux négatif).
 */
export function bcReact(
  bc: BCState,
  fragility: number,
  inCrisis: boolean,
  p: InstanceParams,
  smoothing: number = p.bcSmoothing,
): void {
  bc.target = bcReactionTarget(fragility, inCrisis, p);
  bc.rate = Math.max(0, bc.rate + smoothing * (bc.target - bc.rate));
}

/**
 * Taux d'un coupon à l'émission (spec §3) :
 *   r = r_BC + spread_qualité (carry émetteur) + spread_F + prime de terme (si long).
 */
export function couponRate(
  bc: BCState,
  qualitySpread: number,
  maturity: CouponMaturity,
  fragility: number,
  p: InstanceParams,
): number {
  const termPremium = maturity === 'long' ? p.couponTermPremium : 0;
  return bc.rate + qualitySpread + p.couponSpreadF * excessF(fragility, p) + termPremium;
}

/** Émet un coupon (taux + RCE figés au contexte BC/F du moment). Mute `state.seq`. */
export function emitCoupon(
  state: CreditState,
  issuer: HexId,
  qualitySpread: number,
  maturity: CouponMaturity,
  fragility: number,
  p: InstanceParams,
): Coupon {
  const rce = maturity === 'long' ? p.couponRceLong : p.couponRceCourt;
  return {
    id: `${issuer}:${maturity}:${state.seq++}`,
    issuer,
    maturity,
    rate: couponRate(state.bc, qualitySpread, maturity, fragility, p),
    qualitySpread,
    rce,
  };
}

/** Carnet initial : taux directeur au repos + un court & un long par émetteur. */
export function initCredit(map: GameMap, fragility: number, p: InstanceParams): CreditState {
  const state: CreditState = { bc: { rate: p.bcRateBase, target: p.bcRateBase }, book: [], seq: 0 };
  refreshBook(state, map, fragility, p);
  return state;
}

/**
 * Garantit qu'on offre toujours un coupon COURT et un LONG par émetteur. Émet les
 * manquants (consommés ou expirés) au contexte courant → ils reflètent la BC et F du
 * moment (c'est ce qui crée le risque de réinvestissement au rollover). Mute `state.book`.
 */
export function refreshBook(
  state: CreditState,
  map: GameMap,
  fragility: number,
  p: InstanceParams,
): void {
  for (const { id, carry } of creditIssuers(map)) {
    for (const maturity of ['court', 'long'] as CouponMaturity[]) {
      const present = state.book.some((c) => c.issuer === id && c.maturity === maturity);
      if (!present) state.book.push(emitCoupon(state, id, carry, maturity, fragility, p));
    }
  }
}

/**
 * Ouvre une position sur un coupon offert (long XOR short, taille `notional` verrouillée).
 * Retire le coupon du carnet (consommé) et renvoie la position + le flux de trésorerie
 * d'entrée (long paie U, short reçoit U). Renvoie `null` si le coupon n'est pas/plus offert.
 */
export function openCouponPosition(
  state: CreditState,
  couponId: string,
  side: CouponSide,
  notional: number,
): { position: CouponPosition; entryCash: number } | null {
  const idx = state.book.findIndex((c) => c.id === couponId);
  if (idx < 0) return null;
  const c = state.book[idx]!;
  state.book.splice(idx, 1);
  const position: CouponPosition = {
    couponId: c.id,
    issuer: c.issuer,
    side,
    rate: c.rate,
    qualitySpread: c.qualitySpread,
    notional,
    rceLeft: c.rce,
  };
  return { position, entryCash: side === 'long' ? -notional : notional };
}

/** Contribution d'une position vivante à la richesse (pair pour le long, dette pour le short). */
export function couponPositionValue(pos: CouponPosition): number {
  return pos.side === 'long' ? pos.notional : -pos.notional;
}

/**
 * Portage du tour : long encaisse `taux·U`, short le paie. Décrémente le RCE.
 * Mute les RCE. Renvoie le flux de trésorerie net (somme sur les positions).
 */
export function accrueCoupons(positions: CouponPosition[]): number {
  let cash = 0;
  for (const pos of positions) {
    cash += (pos.side === 'long' ? 1 : -1) * pos.rate * pos.notional;
    pos.rceLeft -= 1;
  }
  return cash;
}

/** Proba de défaut/tour d'un coupon en crise crédit (spec §7) — 0 hors crise crédit. */
export function defaultProbability(
  qualitySpread: number,
  fragility: number,
  p: InstanceParams,
): number {
  // Ancre IG : le plus petit carry crédit de la carte MVP (IG = 0.03). Un coupon de
  // qualité 2× plus risquée (HY 0.06-0.07) a une proba de base ~2× plus élevée.
  const IG_ANCHOR = 0.03;
  const prob = p.couponDefaultBase * (qualitySpread / IG_ANCHOR) + p.couponDefaultFSlope * excessF(fragility, p);
  return Math.min(0.95, Math.max(0, prob));
}

/**
 * Défauts (spec §7) : SEULEMENT si une crise touche le crédit. Tout-ou-rien. Pour chaque
 * position, tirage au sort ; en défaut, la position disparaît (la valeur de richesse
 * `couponPositionValue` part avec elle → long perd U, short gagne U). Renvoie les
 * survivants, les ids en défaut et l'effet de richesse net (négatif = perte agrégée).
 */
export function resolveCouponDefaults(
  positions: CouponPosition[],
  fragility: number,
  inCreditCrisis: boolean,
  rng: Rng,
  p: InstanceParams,
): { survivors: CouponPosition[]; defaulted: string[]; wealthEffect: number } {
  if (!inCreditCrisis) return { survivors: positions, defaulted: [], wealthEffect: 0 };
  const survivors: CouponPosition[] = [];
  const defaulted: string[] = [];
  let wealthEffect = 0;
  for (const pos of positions) {
    const prob = defaultProbability(pos.qualitySpread, fragility, p);
    if (rng.chance(prob)) {
      defaulted.push(pos.couponId);
      // La richesse perd la valeur de la position : long −U, short +U.
      wealthEffect -= couponPositionValue(pos);
    } else {
      survivors.push(pos);
    }
  }
  return { survivors, defaulted, wealthEffect };
}

/**
 * Règlement des coupons arrivés à échéance (RCE ≤ 0) : long récupère U, short rend U.
 * Renvoie les survivants, les ids réglés et le flux de trésorerie net.
 */
export function settleMatured(
  positions: CouponPosition[],
): { survivors: CouponPosition[]; settled: string[]; cash: number } {
  const survivors: CouponPosition[] = [];
  const settled: string[] = [];
  let cash = 0;
  for (const pos of positions) {
    if (pos.rceLeft <= 0) {
      settled.push(pos.couponId);
      cash += (pos.side === 'long' ? 1 : -1) * pos.notional;
    } else {
      survivors.push(pos);
    }
  }
  return { survivors, settled, cash };
}
