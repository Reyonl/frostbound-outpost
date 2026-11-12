import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig';
import type { TreeCluster, TreeNode } from './TreeCluster';
import type { ParticleSystem } from '../systems/ParticleSystem';

export class HelperNPC {
  readonly group = new THREE.Group();
  private readonly carriedLogs: THREE.Mesh[] = [];
  private readonly axeBlade: THREE.Mesh;

  active = false;
  private carryCount = 0;
  private readonly maxCarry = 4;
  private chopTimer = 0;
  private targetTree: TreeNode | null = null;
  private readonly sawmillPos = new THREE.Vector3(-3.6, 0, 0.4);

  constructor(scene: THREE.Scene) {
    this.group.position.set(-4.5, 0, -1.2);

    const coat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.34, 0.62, 8),
      new THREE.MeshToonMaterial({ color: 0xf97316 }),
    );
    coat.position.y = 0.44;
    coat.castShadow = true;
    this.group.add(coat);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 8),
      new THREE.MeshToonMaterial({ color: 0xfdba74 }),
    );
    head.position.y = 0.94;
    this.group.add(head);

    this.axeBlade = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.45, 0.25),
      new THREE.MeshToonMaterial({ color: 0xe2e8f0 }),
    );
    this.axeBlade.position.set(0.38, 0.65, 0.25);
    this.group.add(this.axeBlade);

    const logGeo = new THREE.BoxGeometry(0.38, 0.12, 0.2);
    const logMat = new THREE.MeshToonMaterial({ color: 0x9a5b2e });
    for (let i = 0; i < this.maxCarry; i++) {
      const m = new THREE.Mesh(logGeo, logMat);
      m.position.set(0, 0.85 + i * 0.13, -0.32);
      m.visible = false;
      this.group.add(m);
      this.carriedLogs.push(m);
    }

    this.group.visible = false;
    scene.add(this.group);
  }

  update(
    dt: number,
    trees: TreeCluster,
    particles: ParticleSystem,
    onDepositWood: (amount: number) => void,
  ): void {
    this.group.visible = this.active;
    if (!this.active) return;

    this.chopTimer = Math.max(0, this.chopTimer - dt);

    // Haul back to sawmill when bag full
    if (this.carryCount >= this.maxCarry) {
      const dx = this.sawmillPos.x - this.group.position.x;
      const dz = this.sawmillPos.z - this.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= 1.2) {
        onDepositWood(this.carryCount);
        particles.burst(this.sawmillPos.x, 0.9, this.sawmillPos.z, 0x9a5b2e, 6, 3.2, 0.7);
        this.carryCount = 0;
        this.targetTree = null;
      } else {
        this.moveStep(dx, dz, dist, dt);
      }
    } else {
      if (!this.targetTree || !this.targetTree.alive) {
        this.targetTree = this.findNearestTree(trees);
      }
      if (this.targetTree) {
        const dx = this.targetTree.x - this.group.position.x;
        const dz = this.targetTree.z - this.group.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= 1.65) {
          this.axeBlade.rotation.x = Math.sin(performance.now() * 0.018) * 0.8;
          if (this.chopTimer <= 0) {
            this.chopTimer = 0.45;
            this.targetTree.hp -= 24;
            this.targetTree.shakeTimer = 0.14;
            particles.burst(this.targetTree.x, 1.0, this.targetTree.z, 0xb45309, 4, 2.8, 0.65);
            if (this.targetTree.hp <= 0) {
              this.targetTree.alive = false;
              this.targetTree.regrowTimer = GAME_CONFIG.forest.regrowSeconds;
              this.carryCount = Math.min(this.maxCarry, this.carryCount + GAME_CONFIG.forest.logsPerTree);
              this.targetTree = null;
            }
          }
        } else {
          this.moveStep(dx, dz, dist, dt);
        }
      }
    }

    for (let i = 0; i < this.carriedLogs.length; i++) {
      this.carriedLogs[i].visible = i < this.carryCount;
    }
  }

  private moveStep(dx: number, dz: number, dist: number, dt: number): void {
    const speed = 5.4;
    this.group.position.x += (dx / dist) * speed * dt;
    this.group.position.z += (dz / dist) * speed * dt;
    this.group.rotation.y = Math.atan2(dx, dz);
    this.group.position.y = Math.abs(Math.sin(performance.now() * 0.01)) * 0.06;
  }

  private findNearestTree(trees: TreeCluster): TreeNode | null {
    let best: TreeNode | null = null;
    let bestDist = Infinity;
    for (const t of trees.trees) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - this.group.position.x, t.z - this.group.position.z);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }
}
