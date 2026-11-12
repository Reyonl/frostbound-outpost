import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/gameConfig';

describe('M4 combat & turret config', () => {
  it('defines balanced bear, wolf, boss, and turret stats', () => {
    expect(GAME_CONFIG.combat.bearHp).toBeGreaterThan(GAME_CONFIG.combat.wolfHp);
    expect(GAME_CONFIG.combat.bossHp).toBeGreaterThan(GAME_CONFIG.combat.bearHp * 3);
    expect(GAME_CONFIG.combat.turretRange).toBeGreaterThan(GAME_CONFIG.world.baseRadius);
  });
});
