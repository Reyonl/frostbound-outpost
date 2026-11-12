import { GAME_CONFIG } from '../config/gameConfig';
import { AudioSynth } from '../core/AudioSynth';
import { Engine } from '../core/Engine';
import { triggerHaptic } from '../core/Haptics';
import { AxeRing } from '../entities/AxeRing';
import type { Player } from '../entities/Player';
import type { TreeCluster } from '../entities/TreeCluster';
import type { ParticleSystem } from './ParticleSystem';
import type { StackSystem } from './StackSystem';

export class CombatSystem {
  private readonly treeCooldowns = new Map<number, number>();
  private hitStopTimer = 0;

  onWoodCollected?: (amount: number) => void;

  consumeHitStop(dt: number): number {
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      return dt * 0.2;
    }
    return dt;
  }

  triggerHitStop(duration = 0.032): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, duration);
  }

  updateTreeChopping(
    dt: number,
    axeRing: AxeRing,
    trees: TreeCluster,
    player: Player,
    stack: StackSystem,
    particles: ParticleSystem,
    audio: AudioSynth,
    engine: Engine,
  ): void {
    for (const [id, rem] of this.treeCooldowns) {
      if (rem - dt <= 0) this.treeCooldowns.delete(id);
      else this.treeCooldowns.set(id, rem - dt);
    }

    const hitRadius = GAME_CONFIG.axe.hitRadius * axeRing.axeScale + 0.65;

    for (const tree of trees.trees) {
      if (!tree.alive || this.treeCooldowns.has(tree.id)) continue;

      // Fast broadphase check against player center before testing individual blades
      if (Math.hypot(tree.x - player.position.x, tree.z - player.position.z) > axeRing.orbitRadius + hitRadius + 0.5) {
        continue;
      }

      let hit = false;
      for (const bladePos of axeRing.bladeWorldPositions) {
        if (Math.hypot(bladePos.x - tree.x, bladePos.z - tree.z) <= hitRadius) {
          hit = true;
          break;
        }
      }

      if (!hit) continue;

      this.treeCooldowns.set(tree.id, GAME_CONFIG.axe.chopCooldown);
      tree.hp -= axeRing.damage;
      tree.shakeTimer = 0.16;
      particles.burst(tree.x, 1.0, tree.z, 0xb45309, 6, 3.8, 0.85);
      particles.burst(tree.x, 2.2, tree.z, 0xeaf4ff, 4, 3.0, 0.7);
      audio.playChop();
      triggerHaptic('light', 70);

      if (tree.hp <= 0) {
        tree.alive = false;
        tree.regrowTimer = GAME_CONFIG.forest.regrowSeconds;
        particles.burst(tree.x, 1.3, tree.z, 0x9a5b2e, 14, 5.2, 1.1);
        audio.playTreeFall();
        engine.addShake(0.14);
        this.triggerHitStop(0.025);

        for (let l = 0; l < GAME_CONFIG.forest.logsPerTree; l++) {
          const ox = (Math.random() - 0.5) * 0.8;
          const oz = (Math.random() - 0.5) * 0.8;
          stack.spawnPickupToPlayer('wood', tree.x + ox, 0.9, tree.z + oz, () => {
            audio.playPickup(stack.count);
            this.onWoodCollected?.(1);
          });
        }
      }
    }
  }
}
