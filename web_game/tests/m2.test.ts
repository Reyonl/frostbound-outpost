import { describe, expect, it } from 'vitest';
import { canAcceptCarryItem } from '../src/systems/StackSystem';

describe('M2 stack & chopping invariants', () => {
  it('enforces carry capacity limits', () => {
    expect(canAcceptCarryItem(0, 12)).toBe(true);
    expect(canAcceptCarryItem(11, 12)).toBe(true);
    expect(canAcceptCarryItem(12, 12)).toBe(false);
    expect(canAcceptCarryItem(15, 12)).toBe(false);
  });
});
