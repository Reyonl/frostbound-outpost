import { describe, expect, it } from 'vitest';
import { APP_TITLE, bootPlaceholder } from '../src/main';

describe('Frostbound Outpost bootstrap', () => {
  it('exposes the game title', () => {
    expect(bootPlaceholder()).toBe(APP_TITLE);
  });
});
