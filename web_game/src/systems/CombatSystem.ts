import { GAME_CONFIG } from '../config/gameConfig';
import { AudioSynth } from '../core/AudioSynth';
import { Engine } from '../core/Engine';
import { triggerHaptic } from '../core/Haptics';
import { AxeRing } from '../entities/AxeRing';
import type { Enemy, EnemyManager } from '../entities/EnemyManager';
import type { Player } from '../entities/Player';
import type { TreeCluster } from '../entities/TreeCluster';
import type { FloatingTextSystem } from './FloatingTextSystem';
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

  handleEnemyKilled(
    enemy: Enemy,
    enemyMgr: EnemyManager,
    stack: StackSystem,
    particles: ParticleSystem,
    floatingText: FloatingTextSystem,
    audio: AudioSynth,
    engine: Engine,
    onCashBounty?: (cash: number) => void,
  ): void {
    enemyMgr.kills += 1;
    const ex = enemy.group.position.x;
    const ez = enemy.group.position.z;

    particles.burst(ex, 0.9, ez, 0xef4444, 14, 5.4, 1.05);
    particles.burst(ex, 1.1, ez, 0xf8fafc, 8, 4.2, 0.85);
    floatingText.spawn(ex, 2.1, ez, `+${enemy.meatYield} MEAT`, '#fca5a5', 1.1);

    engine.addShake(enemy.kind === 'boss' ? 0.36 : 0.18);
    this.triggerHitStop(enemy.kind === 'boss' ? 0.055 : 0.028);
    triggerHaptic(enemy.kind === 'boss' ? 'heavy' : 'medium', 80);

    for (let m = 0; m < enemy.meatYield; m++) {
      const ox = (Math.random() - 0.5) * 0.9;
      const oz = (Math.random() - 0.5) * 0.9;
      stack.spawnPickupToPlayer('meat', ex + ox, 0.9, ez + oz, () => {
        audio.playPickup(stack.count);
      });
    }

    if (enemy.cashBounty > 0) {
      onCashBounty?.(enemy.cashBounty);
    }
  }

  updateEnemyCombat(
    axeRing: AxeRing,
    enemyMgr: EnemyManager,
    player: Player,
    stack: StackSystem,
    particles: ParticleSystem,
    floatingText: FloatingTextSystem,
    audio: AudioSynth,
    engine: Engine,
    onCashBounty?: (cash: number) => void,
  ): void {
    const hitRadius = GAME_CONFIG.axe.hitRadius * axeRing.axeScale;

    for (const enemy of enemyMgr.enemies) {
      if (!enemy.alive || enemy.axeHitCooldown > 0) continue;

      const broadDist = Math.hypot(
        enemy.group.position.x - player.position.x,
        enemy.group.position.z - player.position.z,
      );
      if (broadDist > axeRing.orbitRadius + hitRadius + enemy.radius + 0.3) continue;

      let hit = false;
      for (const bladePos of axeRing.bladeWorldPositions) {
        if (Math.hypot(bladePos.x - enemy.group.position.x, bladePos.z - enemy.group.position.z) <= hitRadius + enemy.radius) {
          hit = true;
          break;
        }
      }
      if (!hit) continue;

      enemy.axeHitCooldown = 0.24;
      const dmg = Math.round(axeRing.damage * (0.92 + Math.random() * 0.2));
      enemy.hp -= dmg;
      enemy.flashTimer = 0.12;

      const kx = enemy.group.position.x - player.position.x;
      const kz = enemy.group.position.z - player.position.z;
      const kLen = Math.hypot(kx, kz) || 1;
      enemy.vx += (kx / kLen) * 5.2;
      enemy.vz += (kz / kLen) * 5.2;

      particles.burst(enemy.group.position.x, 0.8, enemy.group.position.z, 0xf87171, 6, 4.0, 0.8);
      floatingText.spawn(enemy.group.position.x, 1.9, enemy.group.position.z, `-${dmg}`, '#fef08a', 1.0);
      audio.playHit();
      triggerHaptic('light', 60);

      if (enemy.hp <= 0) {
        enemy.alive = false;
        this.handleEnemyKilled(enemy, enemyMgr, stack, particles, floatingText, audio, engine, onCashBounty);
      }
    }
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
