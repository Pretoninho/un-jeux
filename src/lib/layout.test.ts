import { describe, it, expect } from 'vitest';
import { octagonPoints, diamondPoints, OCTA_REGULAR } from './layout';

const parse = (s: string): [number, number][] =>
  s.split(' ').map((p) => p.split(',').map(Number) as [number, number]);

describe('layout/pavage 4.8.8', () => {
  const S = 60;

  it('octogone régulier : les 8 côtés sont (quasi) égaux', () => {
    const v = parse(octagonPoints(0, 0, S, OCTA_REGULAR));
    const len = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const sides = v.map((p, i) => len(p, v[(i + 1) % v.length]!));
    // points arrondis à 0,1 → on tolère le bruit d'arrondi, pas l'inégalité de forme.
    expect(Math.max(...sides) - Math.min(...sides)).toBeLessThan(0.2);
  });

  for (const frac of [OCTA_REGULAR, 0.15, 0.1, 0.3]) {
    it(`tiling sans trou : le losange du creux est calé sur les biseaux (frac=${frac.toFixed(3)})`, () => {
      // Octogone en (0,0), creux diagonal centré en (S/2, S/2).
      const oct = parse(octagonPoints(0, 0, S, frac));
      const dia = parse(diamondPoints(S / 2, S / 2, S, frac));
      // Le coin bas-droit de l'octogone = (t, h) et (h, t) ; ce sont aussi des sommets du losange.
      const has = (set: [number, number][], p: [number, number]) =>
        set.some((q) => Math.abs(q[0] - p[0]) < 0.06 && Math.abs(q[1] - p[1]) < 0.06);
      const t = S * frac, h = S / 2;
      expect(has(oct, [t, h])).toBe(true);
      expect(has(oct, [h, t])).toBe(true);
      expect(has(dia, [t, h])).toBe(true); // sommet gauche du losange
      expect(has(dia, [h, t])).toBe(true); // sommet haut du losange
    });
  }

  it('frac plus petit ⇒ carré plus gros (demi-diagonale croît)', () => {
    const dHalf = (frac: number) => Math.abs(parse(diamondPoints(0, 0, S, frac))[0]![0]);
    expect(dHalf(0.15)).toBeGreaterThan(dHalf(OCTA_REGULAR));
    expect(dHalf(0.1)).toBeGreaterThan(dHalf(0.15));
  });
});
