import { Engine } from './core/Engine';
import { EnvironmentSystem } from './systems/EnvironmentSystem';
import { InputSystem } from './systems/InputSystem';
import { Player } from './entities/Player';
import { TreeCluster } from './entities/TreeCluster';

declare global {
  interface Window {
    __frostboundDebug?: {
      getState: () => Record<string, unknown>;
    };
  }
}

export class FrostboundGame {
  private readonly engine: Engine;
  private readonly input: InputSystem;
  private readonly environment: EnvironmentSystem;
  private readonly player: Player;
  private readonly trees: TreeCluster;

  private rafId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private paused = false;

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement, joystickZone: HTMLElement) {
    this.engine = new Engine(canvas);
    this.input = new InputSystem(joystickZone);
    this.environment = new EnvironmentSystem(this.engine.scene);
    this.player = new Player(this.engine.scene);
    this.trees = new TreeCluster(this.engine.scene);

    const badge = document.createElement('div');
    badge.className = 'title-badge';
    badge.textContent = 'FROSTBOUND OUTPOST';
    hudRoot.appendChild(badge);

    window.FrostboundLifecycle = {
      onPause: () => {
        this.paused = true;
      },
      onResume: () => {
        this.paused = false;
        this.lastTime = performance.now();
      },
    };

    window.__frostboundDebug = {
      getState: () => ({
        milestone: 'M1',
        elapsed: Number(this.elapsed.toFixed(2)),
        player: {
          x: Number(this.player.position.x.toFixed(2)),
          z: Number(this.player.position.z.toFixed(2)),
        },
        treeCount: this.trees.trees.length,
        drawCalls: this.engine.renderer.info.render.calls,
      }),
    };
  }

  start(): void {
    this.lastTime = performance.now();
    const tick = (now: number): void => {
      this.rafId = requestAnimationFrame(tick);
      if (this.paused) return;

      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this.elapsed += dt;

      const move = this.input.getMoveVector();
      this.player.update(move, dt);
      this.trees.update(dt);
      this.environment.update(dt, this.player.position.x, this.player.position.z);
      this.engine.updateCamera(this.player.position, move.x, move.z, dt);
      this.engine.render();
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
