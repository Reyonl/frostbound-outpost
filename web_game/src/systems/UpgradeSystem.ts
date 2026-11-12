import { GAME_CONFIG } from '../config/gameConfig';
import type { UpgradeLevels } from '../core/SaveSystem';

export type UpgradeKey = keyof UpgradeLevels;

export interface UpgradeDef {
  key: UpgradeKey;
  title: string;
  desc: string;
  baseCost: number;
  costMult: number;
  maxLevel: number;
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  { key: 'axeCount', title: 'Extra Axe', desc: '+1 orbiting axe blade', baseCost: 35, costMult: 1.75, maxLevel: 6 },
  { key: 'axePower', title: 'Heavy Blade', desc: '+8 damage & +12% size', baseCost: 25, costMult: 1.45, maxLevel: 10 },
  { key: 'spinSpeed', title: 'Whirlwind Spin', desc: '+18% axe spin speed', baseCost: 22, costMult: 1.42, maxLevel: 8 },
  { key: 'carryCap', title: 'Timber Pack', desc: '+6 carry stack slots', baseCost: 20, costMult: 1.4, maxLevel: 10 },
  { key: 'moveSpeed', title: 'Snow Boots', desc: '+10% sprint speed', baseCost: 24, costMult: 1.45, maxLevel: 8 },
  { key: 'turretPower', title: 'Fire Bolts', desc: '+25% turret damage', baseCost: 30, costMult: 1.5, maxLevel: 8 },
  { key: 'thermalCoat', title: 'Thermal Parka', desc: '-18% blizzard chill', baseCost: 25, costMult: 1.45, maxLevel: 5 },
];

export function getUpgradeCost(def: UpgradeDef, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costMult, currentLevel));
}

export function computeRelicsEarned(totalCashEarned: number, kills: number): number {
  return Math.max(0, Math.floor((totalCashEarned + kills * 8) / 140));
}

export function computePrestigeMultiplier(relics: number): number {
  return 1 + relics * 0.2;
}

export interface ComputedStats {
  axeCount: number;
  axeDamage: number;
  axeScale: number;
  spinSpeed: number;
  carryCapacity: number;
  moveSpeedMult: number;
  turretDamageMult: number;
  blizzardDrainMult: number;
}

export function computePlayerStats(levels: UpgradeLevels, relics: number, auroraActive: boolean): ComputedStats {
  const prestigeMult = computePrestigeMultiplier(relics);
  const auroraSpeed = auroraActive ? 1.45 : 1;
  return {
    axeCount: GAME_CONFIG.axe.baseCount + levels.axeCount,
    axeDamage: Math.round((GAME_CONFIG.axe.baseDamage + levels.axePower * 8) * prestigeMult),
    axeScale: 1 + levels.axePower * 0.1,
    spinSpeed: GAME_CONFIG.axe.spinSpeed * (1 + levels.spinSpeed * 0.18) * auroraSpeed,
    carryCapacity: GAME_CONFIG.player.baseCarryCapacity + levels.carryCap * GAME_CONFIG.player.capacityPerUpgrade,
    moveSpeedMult: 1 + levels.moveSpeed * 0.1,
    turretDamageMult: (1 + levels.turretPower * 0.25) * prestigeMult,
    blizzardDrainMult: Math.pow(0.82, levels.thermalCoat),
  };
}
