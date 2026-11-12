import { GAME_CONFIG } from './config/gameConfig';
import { AudioSynth } from './core/AudioSynth';
import { Engine } from './core/Engine';
import { unlockHaptics } from './core/Haptics';
import { AxeRing } from './entities/AxeRing';
import { BaseFort } from './entities/BaseFort';
import { EnemyManager } from './entities/EnemyManager';
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
import { StackSystem } from './systems/StackSystem';
import { HUD, type ResourceCounts } from './ui/HUD';

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
  private readonly player: Player;
  private readonly axeRing: AxeRing;
  private readonly trees: TreeCluster;
  private readonly enemyMgr: EnemyManager;
  private readonly turretMgr: TurretManager;
  private readonly particles: ParticleSystem;
  private readonly floatingText: FloatingTextSystem;
  private readonly stack: StackSystem;
  private readonly combat: CombatSystem;
  private readonly hud: HUD;

  private readonly baseCounts: ResourceCounts = { cash: 0, wood: 0, meat: 0, gold: 0 };
  private playerHp = 100;
  private playerMaxHp = 100;

  private rafId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private paused = false;

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement, joystickZone: HTMLElement) {
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
    this.player = new Player(this.engine.scene);
    this.axeRing = new AxeRing(this.player.group);
    this.trees = new TreeCluster(this.engine.scene);
    this.enemyMgr = new EnemyManager(this.engine.scene);
    this.turretMgr = new TurretManager(this.engine.scene);
    this.particles = new ParticleSystem(this.engine.scene);
    this.floatingText = new FloatingTextSystem(hudRoot);
    this.stack = new StackSystem(this.engine.scene, this.player.group);
    this.combat = new CombatSystem();
    this.hud = new HUD(hudRoot, () => {
      this.audio.muted = !this.audio.muted;
      return this.audio.muted;
    });

    window.FrostboundLifecycle = {
      onPause: () => {
        this.paused = true;
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
          milestone: 'M4',
          elapsed: Number(this.elapsed.toFixed(2)),
          player: {
            x: Number(this.player.position.x.toFixed(2)),
            z: Number(this.player.position.z.toFixed(2)),
            hp: Math.round(this.playerHp),
          },
          nearestTree,
          sawmillDrop: {
            x: this.sawmill.dropWorldPos.x,
            z: this.sawmill.dropWorldPos.z,
            processed: this.sawmill.processedCount,
          },
          goldDelivered: this.mineRail.goldDelivered,
          enemyCount: this.enemyMgr.enemies.length,
          kills: this.enemyMgr.kills,
          stackCount: this.stack.count,
          counts: {
            cash: this.baseCounts.cash,
            wood: this.baseCounts.wood + this.stack.countOf('wood'),
            meat: this.baseCounts.meat + this.stack.countOf('meat'),
            gold: this.baseCounts.gold + this.stack.countOf('gold'),
          },
          treeCount: this.trees.trees.length,
          drawCalls: this.engine.renderer.info.render.calls,
        };
      },
    };
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
        (cash) => {
          this.baseCounts.cash += cash;
        },
      );
      this.trees.update(dt);

      this.enemyMgr.update(
        dt,
        this.player.position,
        false,
        (dmg) => {
          this.playerHp = Math.max(0, this.playerHp - dmg);
          this.floatingText.spawn(this.player.position.x, 2.0, this.player.position.z, `-${Math.round(dmg)}`, '#ef4444', 1.0);
          if (this.playerHp <= 0) {
            // Respawn safely inside base campfire without losing upgrades
            this.player.position.set(0, 0, 1.5);
            this.playerHp = this.playerMaxHp;
          }
        },
        (dmg) => {
          this.baseFort.damageGate(dmg);
        },
      );

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
            (cash) => {
              this.baseCounts.cash += cash;
            },
          );
        },
      );

      // Heal player & slowly mend gate inside campfire safety aura
      if (Math.hypot(this.player.position.x, this.player.position.z) < 4.5) {
        this.playerHp = Math.min(this.playerMaxHp, this.playerHp + dt * 14);
        this.baseFort.repairGate(dt * 4);
      }

      this.baseFort.update(dt);
      this.sawmill.update(dt, this.player.position, this.stack, this.audio, (_k, amt) => {
        this.baseCounts.wood += amt;
      });
      this.smokehouse.update(dt, this.player.position, this.stack, this.audio, (_k, amt) => {
        this.baseCounts.meat += amt;
      });
      this.mineRail.update(dt, this.particles, (amt) => {
        this.baseCounts.gold += amt;
      });

      this.stack.update(dt, this.player.position);
      this.particles.update(dt);
      this.environment.update(dt, this.player.position.x, this.player.position.z);

      this.engine.setStackZoom(this.stack.count);
      this.engine.updateCamera(this.player.position, move.x, move.z, rawDt);
      this.floatingText.update(rawDt, this.engine.camera);
      this.engine.render();

      this.hud.update(
        {
          cash: this.baseCounts.cash,
          wood: this.baseCounts.wood + this.stack.countOf('wood'),
          meat: this.baseCounts.meat + this.stack.countOf('meat'),
          gold: this.baseCounts.gold + this.stack.countOf('gold'),
        },
        this.stack.count,
        this.stack.maxCapacity,
      );
    };
    this.rafId = requestAnimationFrame(tick);
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
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
