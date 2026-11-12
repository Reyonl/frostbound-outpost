import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig';

export interface TreeNode {
  id: number;
  x: number;
  z: number;
  scale: number;
  rotY: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  regrowTimer: number;
  shakeTimer: number;
}

export function isValidTreePlacement(
  x: number,
  z: number,
  existing: Pick<TreeNode, 'x' | 'z'>[],
  minBaseDist = GAME_CONFIG.forest.minBaseClearance,
  minTreeSpacing = 2.45,
): boolean {
  const distFromCenter = Math.hypot(x, z);
  if (distFromCenter < minBaseDist) return false;
  // Keep southern road clear
  if (z > 4 && Math.abs(x) < 3.4) return false;

  for (const t of existing) {
    if (Math.hypot(t.x - x, t.z - z) < minTreeSpacing) {
      return false;
    }
  }
  return true;
}

export class TreeCluster {
  readonly trees: TreeNode[] = [];

  private readonly trunkMesh: THREE.InstancedMesh;
  private readonly lowerConeMesh: THREE.InstancedMesh;
  private readonly upperConeMesh: THREE.InstancedMesh;
  private readonly snowCapMesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const count = GAME_CONFIG.forest.treeCount;

    // Deterministic seeded-like spread so forest looks balanced on every run
    let seed = 1337;
    const rand = (): number => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const maxExtent = GAME_CONFIG.world.halfSize - 2.2;
    let attempts = 0;
    while (this.trees.length < count && attempts < 2500) {
      attempts++;
      const x = (rand() * 2 - 1) * maxExtent;
      const z = (rand() * 2 - 1) * maxExtent;
      if (!isValidTreePlacement(x, z, this.trees)) continue;

      this.trees.push({
        id: this.trees.length,
        x,
        z,
        scale: 0.85 + rand() * 0.42,
        rotY: rand() * Math.PI * 2,
        hp: GAME_CONFIG.forest.treeMaxHp,
        maxHp: GAME_CONFIG.forest.treeMaxHp,
        alive: true,
        regrowTimer: 0,
        shakeTimer: 0,
      });
    }

    const n = this.trees.length;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.0, 6);
    trunkGeo.translate(0, 0.5, 0);
    const trunkMat = new THREE.MeshToonMaterial({ color: 0x7c4a27 });
    this.trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
    this.trunkMesh.castShadow = true;
    this.trunkMesh.receiveShadow = true;

    const lowerGeo = new THREE.ConeGeometry(1.15, 1.55, 7);
    lowerGeo.translate(0, 1.5, 0);
    const pineMat = new THREE.MeshToonMaterial({ color: 0x2f7d78 });
    this.lowerConeMesh = new THREE.InstancedMesh(lowerGeo, pineMat, n);
    this.lowerConeMesh.castShadow = true;

    const upperGeo = new THREE.ConeGeometry(0.86, 1.4, 7);
    upperGeo.translate(0, 2.35, 0);
    const upperMat = new THREE.MeshToonMaterial({ color: 0x3b9690 });
    this.upperConeMesh = new THREE.InstancedMesh(upperGeo, upperMat, n);
    this.upperConeMesh.castShadow = true;

    const capGeo = new THREE.ConeGeometry(0.56, 0.82, 7);
    capGeo.translate(0, 2.86, 0);
    const snowMat = new THREE.MeshToonMaterial({ color: 0xf1f7ff });
    this.snowCapMesh = new THREE.InstancedMesh(capGeo, snowMat, n);

    scene.add(this.trunkMesh, this.lowerConeMesh, this.upperConeMesh, this.snowCapMesh);
    this.syncAllMatrices();
  }

  private syncTreeMatrix(tree: TreeNode): void {
    const idx = tree.id;
    if (!tree.alive) {
      // Show tiny sapling stump while regrowing
      const progress = 1 - Math.max(0, tree.regrowTimer) / GAME_CONFIG.forest.regrowSeconds;
      this.dummy.position.set(tree.x, 0, tree.z);
      this.dummy.rotation.set(0, tree.rotY, 0);
      this.dummy.scale.set(tree.scale, tree.scale * 0.25, tree.scale);
      this.dummy.updateMatrix();
      this.trunkMesh.setMatrixAt(idx, this.dummy.matrix);

      const sapScale = progress > 0.7 ? (progress - 0.7) * 1.4 : 0.001;
      this.dummy.scale.setScalar(sapScale * tree.scale);
      this.dummy.updateMatrix();
      this.lowerConeMesh.setMatrixAt(idx, this.dummy.matrix);
      this.upperConeMesh.setMatrixAt(idx, this.dummy.matrix);
      this.snowCapMesh.setMatrixAt(idx, this.dummy.matrix);
      return;
    }

    const shake = tree.shakeTimer > 0 ? Math.sin(tree.shakeTimer * 55) * 0.09 : 0;
    const hpRatio = 0.72 + 0.28 * (tree.hp / tree.maxHp);
    this.dummy.position.set(tree.x, 0, tree.z);
    this.dummy.rotation.set(shake, tree.rotY, shake * 0.8);
    this.dummy.scale.set(tree.scale * hpRatio, tree.scale * hpRatio, tree.scale * hpRatio);
    this.dummy.updateMatrix();

    this.trunkMesh.setMatrixAt(idx, this.dummy.matrix);
    this.lowerConeMesh.setMatrixAt(idx, this.dummy.matrix);
    this.upperConeMesh.setMatrixAt(idx, this.dummy.matrix);
    this.snowCapMesh.setMatrixAt(idx, this.dummy.matrix);
  }

  private syncAllMatrices(): void {
    for (const t of this.trees) {
      this.syncTreeMatrix(t);
    }
    this.markDirty();
  }

  private markDirty(): void {
    this.trunkMesh.instanceMatrix.needsUpdate = true;
    this.lowerConeMesh.instanceMatrix.needsUpdate = true;
    this.upperConeMesh.instanceMatrix.needsUpdate = true;
    this.snowCapMesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number): void {
    let dirty = false;
    for (const t of this.trees) {
      if (t.shakeTimer > 0) {
        t.shakeTimer = Math.max(0, t.shakeTimer - dt);
        this.syncTreeMatrix(t);
        dirty = true;
      }
      if (!t.alive) {
        t.regrowTimer -= dt;
        if (t.regrowTimer <= 0) {
          t.alive = true;
          t.hp = t.maxHp;
          t.regrowTimer = 0;
        }
        this.syncTreeMatrix(t);
        dirty = true;
      }
    }
    if (dirty) {
      this.markDirty();
    }
  }
}
