import { describe, it, expect } from 'vitest';
import { applyMoneyDelta } from '../src/lib/calc.js';

describe('applyMoneyDelta', () => {
  it('applies deltas to wallet', () => {
    const wallet = { cp: 10, sp: 5, gp: 2 };
    const delta = { cp: -5, gp: 3 };
    expect(applyMoneyDelta(wallet, delta)).toEqual({ cp: 5, sp: 5, gp: 5 });
  });
});
