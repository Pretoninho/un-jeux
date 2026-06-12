import { describe, it, expect } from 'vitest';
import { runGame, simulate } from './simulate';
import { steadyLong, alwaysReserve } from './policy';
import { presetMvp } from '../data/config-mvp';

describe('harness de simulation (J2)', () => {
  it('joue une partie complète sur l’horizon tiré', () => {
    const state = runGame(presetMvp(1));
    expect(state.turn).toBe(state.params.horizonTurns);
    expect(state.fragilityHistory).toHaveLength(state.turn + 1); // F(0) + un par tour
    expect(state.benchmarkHistory).toHaveLength(state.turn + 1);
  });

  it('est reproductible : même config ⇒ même résultat', () => {
    const a = simulate(presetMvp(7), 5);
    const b = simulate(presetMvp(7), 5);
    expect(a.map((r) => r.finalFragility)).toEqual(b.map((r) => r.finalFragility));
    expect(a.map((r) => r.crisisCount)).toEqual(b.map((r) => r.crisisCount));
  });

  it('produit un Track Record pour chaque acteur', () => {
    const [res] = simulate(presetMvp(1), 1);
    expect(res).toBeDefined();
    expect(Object.keys(res!.trackRecords)).toContain('vautour');
    expect(Number.isFinite(res!.playerTrackRecord.score)).toBe(true);
  });

  it('garde F dans [0,1] sur toutes les parties', () => {
    for (const res of simulate(presetMvp(0), 30, { policies: [steadyLong(3)] })) {
      for (const f of res.fragilityHistory) {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('ÉMERGENCE — les phénomènes naissent du gameplay, pas d’un script', () => {
  // Chaque acteur joue une politique ; on compare les distributions sur 60 parties.
  const N = 60;
  const crisisRate = (policies: Parameters<typeof simulate>[2]) => {
    const res = simulate(presetMvp(1000), N, policies);
    return res.filter((r) => r.crisisCount > 0).length / res.length;
  };

  it('le levier agressif engendre PLUS de crises que le tout-réserve', () => {
    // Personne ne scripte de crise : elles émergent de l'accumulation de F.
    const rateReserve = crisisRate({ policies: [alwaysReserve, alwaysReserve, alwaysReserve] });
    const rateLeverage = crisisRate({ policies: [steadyLong(4), steadyLong(4), steadyLong(4)] });
    expect(rateLeverage).toBeGreaterThan(rateReserve);
  });

  it('le tout-réserve ne déclenche quasiment jamais de crise', () => {
    // F part sous la zone morte et personne ne la nourrit → système sûr.
    const rate = crisisRate({ policies: [alwaysReserve, alwaysReserve, alwaysReserve] });
    expect(rate).toBeLessThan(0.1);
  });

  it('le nombre de crises varie d’une partie à l’autre (instance imprévisible)', () => {
    const counts = new Set(
      simulate(presetMvp(1), N, { policies: [steadyLong(4), steadyLong(4), steadyLong(4)] }).map(
        (r) => r.crisisCount,
      ),
    );
    expect(counts.size).toBeGreaterThan(1); // pas un déroulé fixe
  });
});
