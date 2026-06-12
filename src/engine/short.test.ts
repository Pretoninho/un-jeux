import { describe, it, expect } from 'vitest';
import { positionValue } from './portfolio';
import type { Position } from './state';

const mk = (direction: 'long' | 'short', leverage = 0): Position => ({
  hexId: 'X', direction, equity: 100, leverage, entryV: 100,
});

describe('P&L directionnel (primitive SHORT)', () => {
  it('long gagne quand V monte, perd quand V chute', () => {
    expect(positionValue(mk('long'), 110)).toBeCloseTo(110, 6);
    expect(positionValue(mk('long'), 90)).toBeCloseTo(90, 6);
  });

  it('short gagne quand V chute, perd quand V monte (miroir du long)', () => {
    expect(positionValue(mk('short'), 90)).toBeCloseTo(110, 6); // V −10% → short +10
    expect(positionValue(mk('short'), 110)).toBeCloseTo(90, 6); // V +10% → short −10
  });

  it('le levier amplifie le P&L du short', () => {
    // notionnel ×3 : V −10% → +30 d'équity.
    expect(positionValue(mk('short', 2), 90)).toBeCloseTo(130, 6);
    // V +20% → perte de 60, équity peut être ratiboisée.
    expect(positionValue(mk('short', 2), 120)).toBeCloseTo(40, 6);
  });
});
