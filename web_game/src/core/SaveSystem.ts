import type { ResourceCounts } from '../ui/HUD';

export const SAVE_STORAGE_KEY = 'frostbound_outpost_save_v1';

export interface UpgradeLevels {
  axeCount: number;
  axePower: number;
  spinSpeed: number;
  carryCap: number;
  moveSpeed: number;
  turretPower: number;
  thermalCoat: number;
}

export interface SaveState {
  version: 1;
  counts: ResourceCounts;
  upgrades: UpgradeLevels;
  unlockedPads: string[];
  relics: number;
  prestigeCount: number;
  waveLevel: number;
  kills: number;
  ordersCompleted: number;
  totalCashEarned: number;
}

export function createDefaultUpgrades(): UpgradeLevels {
  return {
    axeCount: 0,
    axePower: 0,
    spinSpeed: 0,
    carryCap: 0,
    moveSpeed: 0,
    turretPower: 0,
    thermalCoat: 0,
  };
}

export function createDefaultSave(relics = 0, prestigeCount = 0): SaveState {
  return {
    version: 1,
    counts: { cash: 20, wood: 0, meat: 0, gold: 0 },
    upgrades: createDefaultUpgrades(),
    unlockedPads: [],
    relics,
    prestigeCount,
    waveLevel: 1,
    kills: 0,
    ordersCompleted: 0,
    totalCashEarned: 0,
  };
}

export function serializeSave(state: SaveState): string {
  return JSON.stringify(state);
}

export function parseSave(raw: string | null): SaveState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SaveState>;
    if (parsed.version !== 1 || !parsed.counts || !parsed.upgrades) return null;
    return {
      ...createDefaultSave(),
      ...parsed,
      counts: { ...createDefaultSave().counts, ...parsed.counts },
      upgrades: { ...createDefaultUpgrades(), ...parsed.upgrades },
      unlockedPads: Array.isArray(parsed.unlockedPads) ? parsed.unlockedPads : [],
    };
  } catch {
    return null;
  }
}

export function loadSaveFromStorage(): SaveState {
  if (typeof localStorage === 'undefined') return createDefaultSave();
  return parseSave(localStorage.getItem(SAVE_STORAGE_KEY)) ?? createDefaultSave();
}

export function writeSaveToStorage(state: SaveState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, serializeSave(state));
  } catch {
    // Ignore storage quota errors cleanly
  }
}
