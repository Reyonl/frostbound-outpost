import { GAME_CONFIG } from './config/gameConfig';
import { AudioSynth } from './core/AudioSynth';
import { Engine } from './core/Engine';
import { triggerHaptic, unlockHaptics } from './core/Haptics';
import {
  createDefaultSave,
  loadSaveFromStorage,
  writeSaveToStorage,
  type SaveState,
} from './core/SaveSystem';
import { AxeRing } from './entities/AxeRing';
import { BaseFort } from './entities/BaseFort';
import { CustomerQueue } from './entities/CustomerQueue';
import { EnemyManager } from './entities/EnemyManager';
import { HelperNPC } from './entities/HelperNPC';
import { MineRail } from './entities/MineRail';
import { Player } from './entities/Player';
import { Station } from './entities/Station';
import { TreeCluster } from './entities/TreeCluster';
import { TurretManager } from './entities/TurretManager';
import { CombatSystem } from './systems/CombatSystem';
import { EnvironmentSystem } from './systems/EnvironmentSystem';
import { FloatingTextSystem } from './systems/FloatingTextSystem';
import { InputSystem } from './systems/InputSystem';
import { ParticleSystem } from './systems/ParticleSystem';
import { RandomEventSystem } from './systems/RandomEventSystem';
import { StackSystem } from './systems/StackSystem';
import { UnlockSystem } from './systems/UnlockSystem';
import {
  computePlayerStats,
  computeRelicsEarned,
  type UpgradeKey,
} from './systems/UpgradeSystem';
import { HUD } from './ui/HUD';
import { UpgradeModal } from './ui/UpgradeModal';

declare global {
  interface Window {
    __frostboundDebug?: {
      getState: () => Record<string, unknown>;
    };
  }
}

export class FrostboundGame {
  private readonly engine: Engine;
  private readonly audio: AudioSynth;
  private readonly input: InputSystem;
  private readonly environment: EnvironmentSystem;
  private readonly baseFort: BaseFort;
  private readonly sawmill: Station;
  private readonly smokehouse: Station;
  private readonly mineRail: MineRail;
  private readonly customerQueue: CustomerQueue;
  private readonly unlockSystem: UnlockSystem;
  private readonly player: Player;
  private readonly axeRing: AxeRing;
  private readonly helperNpc: HelperNPC;
  private readonly trees: TreeCluster;
  private readonly enemyMgr: EnemyManager;
  private readonly turretMgr: TurretManager;
  private readonly particles: ParticleSystem;
  private readonly floatingText: FloatingTextSystem;
  private readonly randomEvents: RandomEventSystem;
  private readonly stack: StackSystem;
  private readonly combat: CombatSystem;
  private readonly hud: HUD;
  private readonly upgradeModal: UpgradeModal;

  private saveState: SaveState;
  private playerHp = 100;
  private readonly playerMaxHp = 100;
  private warmth: number = GAME_CONFIG.survival.maxWarmth;
  private totalCashEarned = 0;

  private rafId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private saveTimer = 2.5;
  private nextBossKillThreshold = 8;
  private paused = false;

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement, joystickZone: HTMLElement) {
    this.saveState = loadSaveFromStorage();
    this.totalCashEarned = this.saveState.totalCashEarned;

    this.engine = new Engine(canvas);
    this.audio = new AudioSynth();
    this.input = new InputSystem(joystickZone, () => {
      this.audio.unlock();
      unlockHaptics();
    });
    this.environment = new EnvironmentSystem(this.engine.scene);
    this.baseFort = new BaseFort(this.engine.scene);

    this.sawmill = new Station(this.engine.scene, {
      id: 'sawmill',
      label: 'SAWMILL',
      inputType: 'wood',
      position: { x: -3.6, z: -1.6 },
      dropOffset: { x: 0, z: 2.0 },
      accentColor: 0x0284c7,
      processDuration: GAME_CONFIG.stations.sawmillTime,
    });

    this.smokehouse = new Station(this.engine.scene, {
      id: 'smokehouse',
      label: 'BUTCHER',
      inputType: 'meat',
      position: { x: 3.6, z: -1.8 },
      dropOffset: { x: 0, z: 2.0 },
      accentColor: 0xdc2626,
      processDuration: GAME_CONFIG.stations.smokehouseTime,
    });

    this.mineRail = new MineRail(this.engine.scene);
    this.customerQueue = new CustomerQueue(this.engine.scene, hudRoot);
    this.unlockSystem = new UnlockSystem(this.engine.scene);
    this.player = new Player(this.engine.scene);
    this.axeRing = new AxeRing(this.player.group);
    this.helperNpc = new HelperNPC(this.engine.scene);
    this.trees = new TreeCluster(this.engine.scene);
    this.enemyMgr = new EnemyManager(this.engine.scene);
    this.turretMgr = new TurretManager(this.engine.scene);
    this.particles = new ParticleSystem(this.engine.scene);
    this.floatingText = new FloatingTextSystem(hudRoot);
    this.randomEvents = new RandomEventSystem(this.engine.scene);
    this.stack = new StackSystem(this.engine.scene, this.player.group);
    this.combat = new CombatSystem();

    this.upgradeModal = new UpgradeModal(
      hudRoot,
      (key, cost) => this.handleBuyUpgrade(key, cost),
      () => this.handlePrestige(),
    );

    this.hud = new HUD(
      hudRoot,
      () => {
        this.audio.muted = !this.audio.muted;
        return this.audio.muted;
      },
      () => {
        this.upgradeModal.setOpen(!this.upgradeModal.isOpen);
        this.refreshUpgradeModal();
      },
    );

    this.applySavedProgress();

    window.FrostboundLifecycle = {
      onPause: () => {
        this.paused = true;
        this.persistSave();
        this.audio.suspend();
      },
      onResume: () => {
        this.paused = false;
        this.lastTime = performance.now();
        this.audio.unlock();
      },
    };

    window.__frostboundDebug = {
      getState: () => {
        let nearestTree: { x: number; z: number } | null = null;
        let bestDist = Infinity;
        for (const t of this.trees.trees) {
          if (!t.alive) continue;
          const d = Math.hypot(t.x - this.player.position.x, t.z - this.player.position.z);
          if (d < bestDist) {
            bestDist = d;
            nearestTree = { x: Number(t.x.toFixed(2)), z: Number(t.z.toFixed(2)) };
          }
        }
        return {
          milestone: 'M6',
          elapsed: Number(this.elapsed.toFixed(2)),
          player: {
            x: Number(this.player.position.x.toFixed(2)),
            z: Number(this.player.position.z.toFixed(2)),
            hp: Math.round(this.playerHp),
            warmth: Math.round(this.warmth),
          },
          day: this.environment.dayCount,
          wave: this.enemyMgr.waveLevel,
          blizzard: this.environment.blizzardActive,
          nearestTree,
          sawmillDrop: {
            x: this.sawmill.dropWorldPos.x,
            z: this.sawmill.dropWorldPos.z,
            processed: this.sawmill.processedCount,
          },
          goldDelivered: this.mineRail.goldDelivered,
          ordersCompleted: this.customerQueue.ordersCompleted,
          unlockedPads: this.unlockSystem.getUnlockedIds(),
          relics: this.saveState.relics,
          enemyCount: this.enemyMgr.enemies.length,
          kills: this.enemyMgr.kills,
          stackCount: this.stack.count,
          counts: {
            cash: this.saveState.counts.cash,
            wood: this.saveState.counts.wood + this.stack.countOf('wood'),
            meat: this.saveState.counts.meat + this.stack.countOf('meat'),
            gold: this.saveState.counts.gold + this.stack.countOf('gold'),
          },
          treeCount: this.trees.trees.length,
          drawCalls: this.engine.renderer.info.render.calls,
        };
      },
    };
  }

  private applySavedProgress(): void {
    this.unlockSystem.setUnlockedState(this.saveState.unlockedPads);
    for (const id of this.saveState.unlockedPads) {
      this.applyUnlockEffect(id);
    }
    this.enemyMgr.waveLevel = Math.max(1, this.saveState.waveLevel);
    this.enemyMgr.kills = this.saveState.kills;
    this.customerQueue.ordersCompleted = this.saveState.ordersCompleted;
    this.nextBossKillThreshold = this.enemyMgr.kills + 8;
    this.applyComputedStats();
  }

  private applyUnlockEffect(id: string): void {
    if (id === 'turret_ne' || id === 'turret_sw') {
      this.turretMgr.unlockTurret(id);
    } else if (id === 'fence_up') {
      this.baseFort.upgradeFence();
    } else if (id === 'helper_chopper') {
      this.helperNpc.active = true;
    } else if (id === 'rail_turbo') {
      this.mineRail.speedMultiplier = 1.85;
    }
  }

  private applyComputedStats(): void {
    const stats = computePlayerStats(
      this.saveState.upgrades,
      this.saveState.relics,
      this.randomEvents.auroraTimer > 0,
    );
    this.axeRing.setCount(stats.axeCount);
    this.axeRing.damage = stats.axeDamage;
    this.axeRing.axeScale = stats.axeScale;
    this.axeRing.spinSpeed = stats.spinSpeed;
    this.stack.maxCapacity = stats.carryCapacity;
    const coldPenalty = this.warmth <= 5 ? 0.75 : 1;
    this.player.speedMultiplier = stats.moveSpeedMult * coldPenalty;
    this.turretMgr.damageMultiplier = stats.turretDamageMult;
  }

  private handleBuyUpgrade(key: UpgradeKey, cost: number): void {
    if (this.saveState.counts.cash < cost) return;
    this.saveState.counts.cash -= cost;
    this.saveState.upgrades[key] += 1;
    this.audio.playUnlock();
    triggerHaptic('medium', 40);
    this.applyComputedStats();
    this.refreshUpgradeModal();
    this.persistSave();
  }

  private handlePrestige(): void {
    const earned = computeRelicsEarned(this.totalCashEarned, this.enemyMgr.kills);
    if (earned <= 0) return;

    const nextRelics = this.saveState.relics + earned;
    const nextPrestige = this.saveState.prestigeCount + 1;
    this.saveState = createDefaultSave(nextRelics, nextPrestige);
    this.totalCashEarned = 0;
    this.stack.items.length = 0;
    this.enemyMgr.kills = 0;
    this.enemyMgr.waveLevel = 1;
    this.customerQueue.ordersCompleted = 0;
    this.helperNpc.active = false;
    this.mineRail.speedMultiplier = 1;
    for (const pad of this.unlockSystem.pads) {
      pad.paid = 0;
      pad.unlocked = false;
      pad.lastDrawnPaid = -1;
      pad.group.visible = true;
    }
    this.applyComputedStats();
    this.persistSave();
    this.hud.showBanner(`EXPEDITION #${nextPrestige + 1}: +${earned} RELICS!`);
  }

  private refreshUpgradeModal(): void {
    this.upgradeModal.render(
      this.saveState.counts.cash,
      this.saveState.upgrades,
      this.saveState.relics,
      this.saveState.prestigeCount,
      this.totalCashEarned,
      this.enemyMgr.kills,
    );
  }

  private persistSave(): void {
    this.saveState.unlockedPads = this.unlockSystem.getUnlockedIds();
    this.saveState.waveLevel = this.enemyMgr.waveLevel;
    this.saveState.kills = this.enemyMgr.kills;
    this.saveState.ordersCompleted = this.customerQueue.ordersCompleted;
    this.saveState.totalCashEarned = this.totalCashEarned;
    writeSaveToStorage(this.saveState);
  }

  private creditCash(amount: number): void {
    const bonusMult = 1 + this.saveState.relics * 0.2;
    const gained = Math.round(amount * bonusMult);
    this.saveState.counts.cash += gained;
    this.totalCashEarned += gained;
  }

  private getTutorialPrompt(): string {
    if (this.elapsed > 28 && this.customerQueue.ordersCompleted > 0) return '';
    if (this.stack.count === 0 && this.saveState.counts.wood === 0) {
      return 'Drag to chop pines & hunt bears';
    }
    if (this.stack.countOf('wood') >= 2 && this.sawmill.processedCount === 0) {
      return 'Step into SAWMILL ring to unload';
    }
    if (this.customerQueue.ordersCompleted === 0) {
      return 'Deliver resources at bottom Counters';
    }
    return '';
  }

  start(): void {
    this.lastTime = performance.now();
    const tick = (now: number): void => {
      this.rafId = requestAnimationFrame(tick);
      if (this.paused) return;

      const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;
      const dt = this.combat.consumeHitStop(rawDt);
      this.elapsed += rawDt;

      this.applyComputedStats();
      const move = this.input.getMoveVector();
      this.player.update(move, dt);
      this.axeRing.update(dt);

      this.combat.updateTreeChopping(
        dt,
        this.axeRing,
        this.trees,
        this.player,
        this.stack,
        this.particles,
        this.audio,
        this.engine,
      );
      this.combat.updateEnemyCombat(
        this.axeRing,
        this.enemyMgr,
        this.player,
        this.stack,
        this.particles,
        this.floatingText,
        this.audio,
        this.engine,
        (cash) => this.creditCash(cash),
      );
      this.trees.update(dt);
      this.helperNpc.update(dt, this.trees, this.particles, (wood) => {
        this.saveState.counts.wood += wood;
      });

      this.enemyMgr.update(
        dt,
        this.player.position,
        this.environment.blizzardActive,
        (dmg) => {
          this.playerHp = Math.max(0, this.playerHp - dmg);
          this.floatingText.spawn(this.player.position.x, 2.0, this.player.position.z, `-${Math.round(dmg)}`, '#ef4444', 1.0);
          if (this.playerHp <= 0) {
            this.player.position.set(0, 0, 1.5);
            this.playerHp = this.playerMaxHp;
            this.warmth = GAME_CONFIG.survival.maxWarmth;
          }
        },
        (dmg) => {
          this.baseFort.damageGate(dmg);
        },
      );

      // Wave scaling & Boss Polar Bear at kill milestones
      this.enemyMgr.waveLevel = 1 + Math.floor(this.enemyMgr.kills / 5);
      if (this.enemyMgr.kills >= this.nextBossKillThreshold) {
        this.nextBossKillThreshold += 10;
        this.enemyMgr.spawnEnemy('boss', 0, -15.5);
        this.hud.showBanner('⚠️ BOSS POLAR BEAR APPROACHING!');
      }

      this.turretMgr.update(
        dt,
        this.enemyMgr,
        this.particles,
        this.floatingText,
        this.audio,
        (killed) => {
          this.combat.handleEnemyKilled(
            killed,
            this.enemyMgr,
            this.stack,
            this.particles,
            this.floatingText,
            this.audio,
            this.engine,
            (cash) => this.creditCash(cash),
          );
        },
      );

      // Warmth & Campfire regeneration
      const distCamp = Math.hypot(this.player.position.x, this.player.position.z);
      if (distCamp < 4.8) {
        this.playerHp = Math.min(this.playerMaxHp, this.playerHp + dt * 14);
        this.baseFort.repairGate(dt * 4);
        this.warmth = Math.min(GAME_CONFIG.survival.maxWarmth, this.warmth + GAME_CONFIG.survival.campfireHealRate * dt);
      } else {
        const stats = computePlayerStats(this.saveState.upgrades, this.saveState.relics, false);
        const drain = (this.environment.blizzardActive ? GAME_CONFIG.survival.blizzardDrainRate : 0.7) * stats.blizzardDrainMult;
        this.warmth = Math.max(0, this.warmth - drain * dt);
      }

      this.baseFort.update(dt);
      this.sawmill.update(dt, this.player.position, this.stack, this.audio, (_k, amt) => {
        this.saveState.counts.wood += amt;
      });
      this.smokehouse.update(dt, this.player.position, this.stack, this.audio, (_k, amt) => {
        this.saveState.counts.meat += amt;
      });
      this.mineRail.update(dt, this.particles, (amt) => {
        this.saveState.counts.gold += amt;
      });

      this.unlockSystem.update(
        dt,
        this.player.position,
        () => this.saveState.counts.cash,
        (amt) => {
          this.saveState.counts.cash -= amt;
        },
        this.particles,
        this.floatingText,
        this.audio,
        (id) => {
          this.applyUnlockEffect(id);
          this.persistSave();
        },
      );

      this.randomEvents.update(
        dt,
        this.player.position,
        this.particles,
        this.floatingText,
        this.audio,
        (cash, wood) => {
          this.creditCash(cash);
          this.saveState.counts.wood += wood;
        },
        (msg) => this.hud.showBanner(msg),
      );

      this.stack.update(dt, this.player.position);
      this.particles.update(dt);
      this.environment.updateAtmosphere(
        dt,
        this.engine.scene,
        this.engine.fog,
        this.engine.sunLight,
        this.engine.hemiLight,
        this.randomEvents.auroraTimer > 0,
        () => this.hud.showBanner('❄️ BLIZZARD! Stay near Campfire!'),
      );
      this.environment.update(dt, this.player.position.x, this.player.position.z);

      this.engine.setStackZoom(this.stack.count);
      this.engine.updateCamera(this.player.position, move.x, move.z, rawDt);
      this.customerQueue.update(
        dt,
        this.player.position,
        this.engine.camera,
        this.stack,
        this.saveState.counts,
        this.particles,
        this.floatingText,
        this.audio,
      );
      this.floatingText.update(rawDt, this.engine.camera);
      this.engine.render();

      this.hud.update(
        {
          cash: this.saveState.counts.cash,
          wood: this.saveState.counts.wood + this.stack.countOf('wood'),
          meat: this.saveState.counts.meat + this.stack.countOf('meat'),
          gold: this.saveState.counts.gold + this.stack.countOf('gold'),
        },
        this.stack.count,
        this.stack.maxCapacity,
        this.warmth,
        this.environment.dayCount,
        this.enemyMgr.waveLevel,
        this.environment.blizzardActive,
        this.getTutorialPrompt(),
        rawDt,
      );

      if (this.upgradeModal.isOpen) {
        this.refreshUpgradeModal();
      }

      this.saveTimer -= rawDt;
      if (this.saveTimer <= 0) {
        this.saveTimer = 3.0;
        this.persistSave();
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.persistSave();
    this.input.dispose();
    this.engine.dispose();
  }
}

if (typeof document !== 'undefined') {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const hudRoot = document.getElementById('hud-root');
  const joystickZone = document.getElementById('joystick-zone');
  if (canvas && hudRoot && joystickZone) {
    const game = new FrostboundGame(canvas, hudRoot, joystickZone);
    game.start();
  }
}
