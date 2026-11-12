import { describe, expect, it } from 'vitest';
import { computeOrderTotal } from '../src/entities/CustomerQueue';
import { stepUnlockDrain } from '../src/systems/UnlockSystem';

describe('M5 NPC orders and unlock pads', () => {
  it('computes order payout and progressive unlock cash drain accurately', () => {
    expect(computeOrderTotal(4, 6)).toBe(24);

    const p1 = stepUnlockDrain(20, 40, 4);
    expect(p1).toEqual({ spent: 4, nextCash: 16, nextRemaining: 36, completed: false });

    const p2 = stepUnlockDrain(10, 3, 4);
    expect(p2).toEqual({ spent: 3, nextCash: 7, nextRemaining: 0, completed: true });
  });
});
