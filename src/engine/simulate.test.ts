import { describe, it, expect } from 'vitest';
import { simulate } from './simulate';
import { presetMvp } from '../data/config-mvp';

describe('harness de simulation (frontière J1/J2)', () => {
  it('la ConfigPartie se construit sans toucher au DOM', () => {
    const config = presetMvp(1);
    expect(config.archetype.id).toBe('vautour');
    expect(config.adversaires).toHaveLength(2);
    expect(config.carte.id).toBe('mvp-16');
    expect(config.seed).toBe(1);
  });

  it('simulate() est un stub explicite jusqu’à J2', () => {
    // Le moteur sera implémenté en J2 ; la signature est posée dès J1.
    expect(() => simulate(presetMvp(1), 10)).toThrow(/J2/);
  });
});
