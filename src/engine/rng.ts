// Générateur pseudo-aléatoire seedé (mulberry32). Sans dépendance.
//
// Pourquoi c'est structurant : TOUT l'anti-script du jeu repose sur des paramètres
// « tirés par instance » (memo §24.7, §25.10, §28). Pour que les garde-fous de J7
// (signaux > horloge, neutralité multi-profils, cibles de tempo) soient des tests
// REPRODUCTIBLES, chaque partie doit être rejouable à l'identique depuis son seed.

export interface Rng {
  /** Flottant uniforme dans [0, 1). */
  next(): number;
  /** Flottant uniforme dans [min, max). */
  range(min: number, max: number): number;
  /** Entier uniforme dans [min, max] (bornes incluses). */
  int(min: number, max: number): number;
  /** Vrai avec probabilité p. */
  chance(p: number): boolean;
  /** Tirage normal standard (moyenne 0, écart-type 1) — Box-Muller. */
  gauss(): number;
}

export function makeRng(seed: number): Rng {
  // État interne 32 bits, dérivé du seed.
  let a = seed >>> 0;

  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const gauss = (): number => {
    // Box-Muller : deux uniformes (0,1] → une normale standard.
    const u1 = 1 - next();
    const u2 = next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    gauss,
  };
}
