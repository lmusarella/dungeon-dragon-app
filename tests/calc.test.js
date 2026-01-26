import { describe, it, expect } from 'vitest';
import { calcTotalWeight } from '../src/lib/calc.js';

describe('calcTotalWeight', () => {
  it('sums qty * weight for items', () => {
    const items = [
      { qty: 2, weight: 1.5 },
      { qty: 1, weight: 3 },
      { qty: 4, weight: 0.25 }
    ];
    expect(calcTotalWeight(items)).toBeCloseTo(6.5, 2);
  });
});
