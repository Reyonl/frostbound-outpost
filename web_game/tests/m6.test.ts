import { describe, expect, it } from 'vitest';
import {
  createDefaultSave,
  parseSave,
  serializeSave,
} from '../src/core/SaveSystem';
import {
  UPGRADE_DEFS,
  computePlayerStats,
  computePrestigeMultiplier,
  computeRelicsEarned,
  getUpgradeCost,
} from '../src/systems/UpgradeSystem';

describe('M6 progression, prestige, and save serialization', () => {
  it('scales upgrade costs and computes stats with prestige & aurora', () => {
    const axeDef = UPGRADE_DEFS[0];
    expect(getUpgradeCost(axeDef, 0)).toBe(35);
    expect(getUpgradeCost(axeDef, 1)).toBeGreaterThan(35);

    expect(computeRelicsEarned(280, 10)).toBe(2);
    expect(computePrestigeMultiplier(2)).toBeCloseTo(1.4, 5);

    const base = createDefaultSave();
    const stats = computePlayerStats({ ...base.upgrades, axeCount: 2, carryCap: 1 }, 2, true);
    expect(stats.axeCount).toBe(4);
    expect(stats.carryCapacity).toBe(18);
    expect(stats.spinSpeed).toBeGreaterThan(6);
  });

  it('round-trips SaveState safely and rejects invalid JSON', () => {
    const s = createDefaultSave(3, 1);
    s.counts.cash = 140;
    s.unlockedPads.push('turret_ne');
    const parsed = parseSave(serializeSave(s));
    expect(parsed?.relics).toBe(3);
    expect(parsed?.counts.cash).toBe(140);
    expect(parsed?.unlockedPads).toEqual(['turret_ne']);
    expect(parseSave('not-json')).toBeNull();
  });
});
