import { describe, it, expect } from 'vitest';
import { PARAM_RANGES, drawInstanceParams, type ParamKey } from './params';

describe('paramètres en plages (anti-script)', () => {
  it('tire des valeurs reproductibles par seed', () => {
    expect(drawInstanceParams(99)).toEqual(drawInstanceParams(99));
  });

  it('produit des parties différentes pour des seeds différents', () => {
    // L'instance n'est jamais figée : deux parties ne partagent pas leurs paramètres.
    expect(drawInstanceParams(1)).not.toEqual(drawInstanceParams(2));
  });

  it('garde chaque valeur tirée dans sa plage de conception', () => {
    for (let seed = 0; seed < 200; seed++) {
      const p = drawInstanceParams(seed);
      for (const key of Object.keys(PARAM_RANGES) as ParamKey[]) {
        const { min, max } = PARAM_RANGES[key];
        expect(p[key]).toBeGreaterThanOrEqual(min);
        expect(p[key]).toBeLessThanOrEqual(max);
      }
    }
  });

  it('tire la fragilité initiale F(0) sous la zone morte (memo §23.1/§23.4)', () => {
    // Aucune partie ne peut commencer dans la zone où une crise est possible.
    for (let seed = 0; seed < 500; seed++) {
      const p = drawInstanceParams(seed);
      expect(p.f0).toBeLessThan(p.crisisDeadZone);
    }
  });

  it('tire des durées de cascade entières', () => {
    const p = drawInstanceParams(5);
    for (const key of ['cascadeLeg1Turns', 'cascadeBounceTurns', 'cascadeLeg3Turns', 'horizonTurns'] as const) {
      expect(Number.isInteger(p[key])).toBe(true);
    }
  });
});
