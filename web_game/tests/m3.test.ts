import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/config/gameConfig';

describe('M3 stations & mine rail config', () => {
  it('defines positive processing and rail parameters', () => {
    expect(GAME_CONFIG.stations.dropZoneRadius).toBeGreaterThan(1);
    expect(GAME_CONFIG.stations.sawmillTime).toBeGreaterThan(0);
    expect(GAME_CONFIG.stations.smokehouseTime).toBeGreaterThan(0);
    expect(GAME_CONFIG.stations.mineCartSpeed).toBeGreaterThan(0);
  });
});
