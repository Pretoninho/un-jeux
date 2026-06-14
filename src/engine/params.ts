// Paramètres du moteur — TOUS exprimés en plages, tirés par instance.
//
// Principe anti-script (memo §24.7, §25.10, §28.1) : aucune constante de gameplay
// n'est gravée. Le type impose la discipline — un paramètre est une `Range`, et la
// valeur concrète d'une partie est tirée via `drawInstanceParams(rng)`. Câbler une
// valeur fixe demanderait min === max, ce qui se voit immédiatement.
//
// Les valeurs ci-dessous sont des POINTS DE DÉPART de calibrage (J7), pas des
// décisions finales (memo §23.8, §24.7, §25.10, §27.4).

import { makeRng, type Rng } from './rng';

export interface Range {
  min: number;
  max: number;
}

const r = (min: number, max: number): Range => ({ min, max });

/** Plages de conception. Référencées à leur section du memo. */
export const PARAM_RANGES = {
  // ── Jauge de fragilité (memo §23) ──
  f0: r(0.08, 0.36), // fragilité initiale cachée (§23.1) — < zone morte 0.40 ; plage
  //                    élargie (J7) pour étaler QUAND F entre en zone de tir → étale
  //                    la date de crise (protège le critère §28.7) et nourrit les
  //                    parties sans crise (§28.2).
  accLeverage: r(0.09, 0.18), // poids du levier (§23.2) — LE moteur de fragilité. C'est un
  //                             driver GLOBAL : il scale avec le levier AGRÉGÉ (les 2 IA +
  //                             le joueur), pas seulement le joueur → c'est lui qui cale le
  //                             taux de crise de la partie par défaut (joueur + IA standard).
  accCrowding: r(0.020, 0.035),
  // Calibrage J7 : l'étirement de valorisation (×100) dominait l'accumulation
  // (~0.10-0.19/tour) et noyait le levier → F pilotée par les IA, pas par le joueur,
  // crise quasi certaine dès le tour 4. Ramené au niveau du levier/crowding pour que
  // les TROIS termes pèsent comparablement et que le climb net soit lent (§23.2, §28.2).
  accValuation: r(0.0010, 0.0020),
  purgeDeleverage: r(0.04, 0.06), // (§23.3)
  // Plage ÉLARGIE (J7) : F est une rampe sans auto-limitation (l'accumulation ne dépend
  // pas de F), donc la seule source de parties SANS crise est une pente nette faible.
  // Une purge tirée haut (~0.05) peut égaler l'accumulation → F reste plat en zone basse
  // → pas de crise. Crée la variance de pente qui nourrit à la fois les ~20-25 % de
  // parties calmes (§28.2) et l'étalement de la date de crise (§28.7).
  purgeMeanReversion: r(0.020, 0.058),
  crisisDeadZone: r(0.40, 0.40), // seuil structurel (§23.4) — fixe assumé
  crisisCeiling: r(0.85, 0.85), // plafond déterministe (§23.4) — fixe assumé
  crisisK: r(0.7, 1.1), // raideur de la proba de crise (§23.4) — adouci (J7) : la zone
  //                       roulette tire plus graduellement → F y séjourne plus long,
  //                       la date de déclenchement s'étale et plus de parties finissent
  //                       sans crise (cibles §28.2, critère §28.7).
  resetFactor: r(0.32, 0.48), // reset post-crise ∝ amplitude (§23.5) — RELEVÉ (J7,
  //                             décision design) : le reset n'est plus « quasi-total » ;
  //                             la crise laisse un résidu de combustible notable (F revient
  //                             vers ~0.25-0.38, juste sous la zone morte 0.40) → rallumage
  //                             rapide. Assume un affaiblissement de « la crise purge le
  //                             système » au profit des tables pyromanes (2 crises 10-15 %).

  // ── Cascade de crise (memo §24.7) ──
  cascadeLeg1Turns: r(1, 2),
  cascadeBounceTurns: r(1, 2), // raccourci (J7) : la cascade entière (3-8 → 3-6 tours)
  cascadeLeg3Turns: r(1, 2),   // mangeait l'horizon → une 2ᵉ crise était impossible
  //                              (cible 2 crises ~10-15 %, §28.2). Morphologie §24 intacte.
  bounceRecovery: r(0.25, 0.55), // part de la jambe 1 récupérée au rebond
  realFloorProbability: r(0.25, 0.35), // proba que le rebond soit un vrai plancher

  // ── Moteur de prix (memo §25.10) ──
  varianceMarket: r(0.30, 0.50), // part du facteur M en régime normal (§25.1)
  varianceCluster: r(0.20, 0.35), // part du facteur C
  // (la part idiosyncratique ε = reste, normalisé)
  crisisVarianceMarket: r(0.80, 0.90), // en crise, M domine → ρ→1 émergent (§25.1)
  lambdaNormal: r(0.02, 0.06), // réversion faible en normal (§25.6, fix D)
  lambdaRecovery: r(0.08, 0.20), // réversion (stochastique) en recovery (§25.6, fix C)
  anchorNoiseFloor: r(0.04, 0.08), // plancher de bruit sur l'estimation de A (§25.2, fix B)
  anchorWalk: r(0.005, 0.015), // amplitude de la marche lente de l'ancre A (§25.2)
  // Échelle corrigée (J7) : le flux est en termes ABSOLUS (notionnel ~O(100) avec
  // START_CAPITAL=100), pas O(1). À 0.02-0.06 l'achat normal d'une IA (~140) saturait le
  // rendement au plafond +50 %/tour → marché auto-pompé, levier god-tier. Ramené pour
  // qu'un ordre normal bouge le prix de ~1-2 % et qu'une fire-sale (flux ~1000) ~10 %
  // (l'impact-prix §25.4 garde des dents pour la contagion sans pomper le marché).
  fluxImpact: r(0.0002, 0.0006), // sensibilité du prix au flux net d'ordres (§25.4)

  // ── Drifts et vols par régime (memo §25.3) — μ/σ du facteur marché M ──
  // La plage de tension CHEVAUCHE le bull (anti-leak du melt-up, §25.3).
  // Drifts quasi nuls (J7, neutralité §28.8) : une dérive haussière garantie faisait du
  // « long + levier » un distributeur de billets (le fonds leveragé battait le value dans
  // 99,8 % des parties). Marché ≈ martingale ponctuée de krachs → le levier amplifie un
  // processus à espérance ~nulle et skew négatif = pari à double tranchant (§29.3), pas un
  // gain garanti. La fragilité F est indépendante du drift (dépend de V/A, A suit le drift)
  // → le tempo §28.2 n'en est pas affecté.
  driftBull: r(0.000, 0.010),
  volBull: r(0.02, 0.04),
  driftTension: r(0.003, 0.015),
  volTension: r(0.04, 0.07),
  driftCrisis: r(-0.18, -0.08),
  volCrisis: r(0.08, 0.14),
  driftRecovery: r(-0.03, 0.05), // inclut le négatif → dead recoveries (§25.6, fix C)
  volRecovery: r(0.04, 0.08),

  // ── Levier (memo §29.3, v1.8) ──
  // Le coût et le seuil de marge sont des règles TRANSPARENTES (exception §27.3) ;
  // ces plages ne sont que leurs points de départ de calibrage.
  // Relevé (J7, neutralité §28.8) au niveau du carry (~0.025/tour) : sinon le levier
  // encaisse le carry sur tout le notionnel mais ne paie l'emprunt que sur la part
  // empruntée à taux plus bas → revenu net sans risque qui compose. À ~carry, le levier
  // devient CARRY-NEUTRE et ne fait plus qu'amplifier le risque-prix (le but, §29.3).
  // RE-CALIBRÉ (sortie du crédit du monde V) : retirer les 3 hexes crédit (β bas, carry
  // régulier) a privé le levier de son terrain défensif → il n'amplifiait plus qu'un
  // univers actions/alt volatil = pari perdant (duel levier/value tombé à 28 %). Baissé
  // (coût d'emprunt) + seuil de marge relevé (le levier survit aux creux) → duel re-centré
  // à ~50 %. α reste FIXE à 0.35 (un α négatif aurait fallu, donc on règle la dynamique).
  leverageBorrowRate: r(0.015, 0.03), // taux d'emprunt/tour par unité de levier
  marginCallThreshold: r(0.35, 0.55), // drawdown mark-to-market d'une position leveragée → liquidation forcée

  // ── Score (memo §27.4) ──
  drawdownPenalty: r(0.35, 0.35), // α — point d'équilibre du défaut #4 (§27.4). FIXE
  //                                 (score transparent §27.3, pas tiré par instance).
  //                                 Calibré J7 : centre le duel levier/value (~50 %) une
  //                                 fois l'amplitude assainie (fluxImpact). Trop haut → le
  //                                 levier devient désavantagé (mort) ; trop bas → dominant.
  // NOTE J2 : les planchers de bruit des signaux (memo §29.2, σ réductible/irréductible
  // + délais par signal) sont une STRUCTURE par signal — ils seront modélisés en données
  // au J2 (avec leurs planchers tirés en plages), pas comme scalaires plats ici.

  // ── Tempo (memo §28) ──
  // PATH B (décision : campagne multi-cycles). Horizon allongé : la partie n'est plus UN
  // cycle (~13-16t, §28.5) mais une SUITE de booms-busts. Conséquence ASSUMÉE et mesurée
  // (scripts/horizon.ts) : ~1.2-1.7 crise/partie, la branche « sans crise » se raréfie
  // (~8-11 %), le skill devient la navigation de cycles répétés. Bandes §28.2 re-ciblées
  // en conséquence (calibration.test.ts). La neutralité §28.8 tient à tout horizon (mesuré).
  horizonTurns: r(28, 40), // durée d'une CAMPAGNE multi-cycles (PATH B) — large = peu apprenable
  recoveryTurns: r(1, 3), // fenêtre de recovery après une cascade (§24) — courte → F se ré-arme
  //                         vite, ce qui nourrit les cycles suivants de la campagne.

  // ── Signaux observables (memo §23.6, §29.2) ──
  // Bruit total par signal (le plancher irréductible est inclus). Tirés en plages
  // par instance → le joueur ne peut pas mesurer son bruit résiduel (§29.2).
  signalNoiseVol: r(0.12, 0.20), // Volatilité : retard 0, bruit fort
  signalNoiseSpread: r(0.06, 0.12), // Écart de crédit : retard 1
  signalNoiseFinance: r(0.04, 0.08), // Financement : retard 2, bruit faible
  bounceDetune: r(0.15, 0.30), // détente des signaux pendant le rebond — le mensonge (§24.2)

  // ── Crédit-coupons & Banque centrale (spec docs/spec-credit-coupons.md, phase 2a) ──
  // Taux directeur BC = fonction de réaction LISIBLE à l'état caché (b) : monte en
  // surchauffe (F au-dessus de la zone morte), coupe en crise. Lissé (θ) → anticipable.
  // Points de départ ; calibrage individuel = phase 2b.
  bcRateBase: r(0.005, 0.015), // taux directeur de repos
  bcReactF: r(0.04, 0.08), // φ — sensibilité du taux cible à (F − zone morte)
  bcReactCrisis: r(0.02, 0.04), // ψ — coupe d'urgence en crise
  bcSmoothing: r(0.30, 0.50), // θ — vitesse d'ajustement vers la cible (lissage → anticipable)
  // Cadence de réunion de la BC (spec §4c, idée « FED annonce de façon planifiée », ACTIVÉE) :
  // la BC ne statue sur `r_BC` que tous les `bcMeetingEvery` tours ; le taux est FIGÉ entre
  // deux réunions, et la décision est DÉCISIVE (saut à la cible, cf. turn.ts) → événement
  // discret, anticipable par le calendrier + le forward guidance (présence FED). Tiré 4-5
  // par instance (qu'on ne mémorise pas « toujours 4 »). 1 = réaction continue (legacy/tests).
  // Mesuré (scripts/bc-cadence.ts) : sans effet sur la distribution de crises/neutralité
  // (la BC lit F, ne la pilote pas) ; dégrade le 4ᵉ signal de façon contrôlée (staleness).
  bcMeetingEvery: r(4, 5),
  // Coupon = r_BC + spread_qualité (carry de l'émetteur) + spread_F + prime de terme.
  couponSpreadF: r(0.05, 0.10), // κ — élargissement de crédit par unité de (F − zone morte)
  couponTermPremium: r(0.004, 0.010), // prime de terme : la maturité longue paie plus que la courte
  couponRceCourt: r(2, 2), // maturité courte (tours) — fixe assumé (lisibilité de la courbe)
  couponRceLong: r(5, 5), // maturité longue (tours) — fixe assumé
  // Défaut : SEULEMENT en crise touchant le crédit. Proba/tour croît avec la qualité
  // (spread structurel de l'émetteur) et avec F. TOUT-OU-RIEN (perte totale du principal).
  couponDefaultBase: r(0.05, 0.10), // proba de base/tour en crise crédit (émetteur IG de réf.)
  couponDefaultFSlope: r(0.6, 1.0), // pente de la proba en (F − zone morte)

  // ── Illiquidité (spec immobilier) ──
  // Verrou de sortie des hexes `illiquid` (immobilier). TRANSPARENT (affiché au joueur),
  // mais tiré par instance pour qu'on ne mémorise pas « toujours 3 ». Entier.
  lockupTurns: r(2, 3), // tours pendant lesquels une position illiquide ne peut être fermée

  // ── Carry du cash en réserve (viabilité du hoarder en campagne, PATH B) ──
  // La poudre sèche AU-DESSUS d'une franchise encaisse le taux directeur r_BC (le cash
  // gagne le taux sans risque). Recette « conservatrice » mesurée (scripts/cash-carry.ts) :
  // réhabilite la réserve comme pari (gagne les krachs) sans la rendre dominante (reste
  // perdante en moyenne car r_BC < carry risqué), et la franchise protège l'incitation aux
  // hexes carry (seul un hoarding ASSUMÉ, grosse réserve, est payé). Neutre (tous acteurs),
  // sans effet sur la distribution de crises (couche richesse pure). TRANSPARENT (affiché).
  // Franchise relative au capital de départ (= 100) → ~0.5× ; tirée pour ne pas mémoriser. Entier.
  cashCarryFloor: r(40, 60),

  // ── Fixes crédit (exploration : rééquilibrage du baseline coupon-long) ──
  // Flags 0/1 (défaut 0 = comportement actuel, mesurés via paramsOverride avant adoption).
  // A : exclure la richesse-coupon du dénominateur du levier agrégé (anti suppression de crises).
  //     ADOPTÉ (mesuré) : à lui seul, ramène le baseline coupon-long de 48 % à 31 % (bande neutre)
  //     et tue la boucle « je compose → j'étouffe les crises ». B/C non nécessaires (laissés off).
  fixLeverageDenom: r(1, 1),
  // B : un book de coupons agrégé (surpondéré HY) nourrit F (reach-for-yield = bulle de crédit).
  //     Poids du terme ; 0 = off. NON nécessaire (Fix A a suffi) — gardé pour exploration future.
  couponFragility: r(0, 0),
  // C : compression du rendement par la demande (le taux offert baisse quand le notionnel
  //     afflue sur un émetteur) — pente ; 0 = off. NON nécessaire (Fix A a suffi).
  couponYieldCompression: r(0, 0),
} as const;

export type ParamKey = keyof typeof PARAM_RANGES;

/** Valeurs concrètes tirées pour une partie. */
export type InstanceParams = Record<ParamKey, number>;

/**
 * Tire les paramètres d'UNE partie. Les durées de cascade et l'horizon sont des
 * entiers ; le reste sont des flottants. Reproductible : même seed ⇒ mêmes valeurs.
 */
export function drawInstanceParams(seedOrRng: number | Rng): InstanceParams {
  const rng = typeof seedOrRng === 'number' ? makeRng(seedOrRng) : seedOrRng;
  const integerKeys = new Set<ParamKey>([
    'cascadeLeg1Turns',
    'cascadeBounceTurns',
    'cascadeLeg3Turns',
    'horizonTurns',
    'recoveryTurns',
    'couponRceCourt',
    'couponRceLong',
    'lockupTurns',
    'bcMeetingEvery',
    'cashCarryFloor',
  ]);

  const out = {} as InstanceParams;
  for (const key of Object.keys(PARAM_RANGES) as ParamKey[]) {
    const { min, max } = PARAM_RANGES[key];
    out[key] = integerKeys.has(key) ? rng.int(min, max) : rng.range(min, max);
  }
  return out;
}
