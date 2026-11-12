import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/gameConfig';
import { ObjectPool } from '../src/core/ObjectPool';
import { isValidTreePlacement } from '../src/entities/TreeCluster';
import { computeJoystickVector } from '../src/systems/InputSystem';

describe('M1 core invariants', () => {
  it('computes deadzone and normalized joystick magnitude', () => {
    expect(computeJoystickVector(2, 2, 50)).toEqual({ x: 0, z: 0, magnitude: 0 });
    const full = computeJoystickVector(100, 0, 50);
    expect(full.x).toBeCloseTo(1, 5);
    expect(full.z).toBeCloseTo(0, 5);
    expect(full.magnitude).toBeCloseTo(1, 5);
  });

  it('prevents trees from spawning inside base or road clearance', () => {
    expect(isValidTreePlacement(0, 0, [])).toBe(false);
    expect(isValidTreePlacement(0, 8, [])).toBe(false);
    expect(isValidTreePlacement(14, -12, [])).toBe(true);
    expect(isValidTreePlacement(14.5, -12, [{ x: 14, z: -12 }])).toBe(false);
  });

  it('reuses objects through ObjectPool without leaking', () => {
    let created = 0;
    const pool = new ObjectPool(
      () => ({ id: ++created, life: 0 }),
      (item) => {
        item.life = 0;
      },
      3,
    );
    expect(pool.pooledCount).toBe(3);
    const a = pool.acquire();
    a.life = 2;
    expect(pool.activeCount).toBe(1);
    pool.release(a);
    expect(pool.activeCount).toBe(0);
    expect(pool.pooledCount).toBe(3);
    expect(a.life).toBe(0);
  });

  it('keeps centralized config positive', () => {
    expect(GAME_CONFIG.player.moveSpeed).toBeGreaterThan(0);
    expect(GAME_CONFIG.forest.treeCount).toBeGreaterThan(20);
  });
});
