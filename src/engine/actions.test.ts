import { describe, it, expect } from 'vitest';
import { ACTIONS, VERBES_MVP, PA_PAR_TOUR, actionById } from '../data/actions';
import type { Verbe } from './types';

describe('catalogue d’actions (memo §9bis)', () => {
  it('a des identifiants uniques', () => {
    const ids = ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('n’expose que les 3 verbes du MVP (pas CONSTRUIRE/NÉGOCIER)', () => {
    const verbes = new Set<Verbe>(ACTIONS.map((a) => a.verbe));
    expect([...verbes].sort()).toEqual([...VERBES_MVP].sort());
  });

  it('RÉSERVER est gratuit ; LIRE et POSITIONNER consomment des PA', () => {
    for (const a of ACTIONS) {
      if (a.verbe === 'RESERVER') {
        expect(a.paMin).toBe(0);
        expect(a.paMax).toBe(0);
      } else {
        expect(a.paMin).toBeGreaterThan(0);
      }
    }
  });

  it('toute action tient dans le budget d’un tour', () => {
    for (const a of ACTIONS) {
      expect(a.paMax).toBeLessThanOrEqual(PA_PAR_TOUR);
      expect(a.paMin).toBeLessThanOrEqual(a.paMax);
    }
  });

  it('la clôture partielle coûte exactement 2 PA', () => {
    const partielle = actionById('pos_cloture_partielle');
    expect(partielle?.paMin).toBe(2);
    expect(partielle?.paMax).toBe(2);
  });

  it('la sortie totale est plus rapide que la clôture partielle (décision de design §9bis)', () => {
    // Décisivité bon marché (1 PA) vs hésitation gérée (2 PA) ; et garde-fou
    // anti-gaming du drawdown : alléger précisément a un coût.
    const fermer = actionById('pos_fermer')!;
    const partielle = actionById('pos_cloture_partielle')!;
    expect(fermer.paMax).toBeLessThan(partielle.paMin);
  });

  it('chaque POSITIONNER porte une opération, les autres verbes non', () => {
    for (const a of ACTIONS) {
      if (a.verbe === 'POSITIONNER') expect(a.op).toBeDefined();
      else expect(a.op).toBeUndefined();
    }
  });

  it('couvre les 4 opérations de POSITIONNER (memo §9bis)', () => {
    const ops = ACTIONS.filter((a) => a.verbe === 'POSITIONNER').map((a) => a.op);
    expect(ops.sort()).toEqual(['cloture_partielle', 'fermer', 'ouvrir', 'renforcer']);
  });
});
