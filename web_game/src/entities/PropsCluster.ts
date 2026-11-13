import * as THREE from 'three';
import type { GraphicsQuality } from '../core/QualitySettings';

export class PropsCluster {
  readonly group = new THREE.Group();

  private readonly crateMesh: THREE.InstancedMesh;
  private readonly barrelMesh: THREE.InstancedMesh;
  private readonly boulderMesh: THREE.InstancedMesh;
  private readonly boulderSnowMesh: THREE.InstancedMesh;
  private readonly lanternPostMesh: THREE.InstancedMesh;
  private readonly lanternGlassMesh: THREE.InstancedMesh;

  private readonly totalCrates: number;
  private readonly totalBarrels: number;
  private readonly totalBoulders: number;
  private readonly totalLanterns: number;

  constructor(scene: THREE.Scene) {
    this.group.name = 'props';
    const dummy = new THREE.Object3D();

    // 1. Wooden Supply Crates (Instanced)
    const crateGeo = new THREE.BoxGeometry(0.72, 0.72, 0.72);
    const crateMat = new THREE.MeshToonMaterial({ color: 0x92400e });
    const cratePositions: [number, number, number, number][] = [
      // x, z, rotY, scale
      [-2.2, 1.6, 0.25, 1.0],
      [-2.8, 1.8, -0.4, 0.88],
      [-2.4, 2.3, 0.8, 0.95],
      [2.6, 1.2, -0.2, 1.05],
      [2.9, 1.8, 0.5, 0.85],
      [-5.2, -2.2, 0.15, 1.1],
      [-5.8, -1.8, -0.6, 0.9],
      [5.2, -1.4, 0.4, 1.0],
      [1.4, -4.8, -0.3, 0.95],
      [-1.4, -4.8, 0.35, 1.0],
    ];
    this.totalCrates = cratePositions.length;
    this.crateMesh = new THREE.InstancedMesh(crateGeo, crateMat, this.totalCrates);
    this.crateMesh.castShadow = true;
    this.crateMesh.receiveShadow = true;

    for (let i = 0; i < this.totalCrates; i++) {
      const [x, z, r, s] = cratePositions[i];
      dummy.position.set(x, 0.36 * s, z);
      dummy.rotation.set(0, r, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      this.crateMesh.setMatrixAt(i, dummy.matrix);
    }
    this.crateMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.crateMesh);

    // 2. Iron-Banded Barrels (Instanced)
    const barrelGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.82, 8);
    const barrelMat = new THREE.MeshToonMaterial({ color: 0x78350f });
    const barrelPositions: [number, number, number][] = [
      [-1.6, 2.1, 0.3],
      [-3.2, 1.3, -0.5],
      [2.2, 2.1, 0.1],
      [3.4, 1.4, -0.2],
      [-5.4, 1.2, 0.4],
      [5.4, -2.4, -0.3],
      [-4.8, -4.2, 0.2],
      [4.8, -4.2, -0.4],
    ];
    this.totalBarrels = barrelPositions.length;
    this.barrelMesh = new THREE.InstancedMesh(barrelGeo, barrelMat, this.totalBarrels);
    this.barrelMesh.castShadow = true;
    this.barrelMesh.receiveShadow = true;

    for (let i = 0; i < this.totalBarrels; i++) {
      const [x, z, r] = barrelPositions[i];
      dummy.position.set(x, 0.41, z);
      dummy.rotation.set(0, r, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.barrelMesh.setMatrixAt(i, dummy.matrix);
    }
    this.barrelMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.barrelMesh);

    // 3. Snow-Capped Boulders (Instanced)
    const boulderGeo = new THREE.DodecahedronGeometry(0.72, 0);
    const boulderMat = new THREE.MeshToonMaterial({ color: 0x64748b });
    const snowCapGeo = new THREE.DodecahedronGeometry(0.62, 0);
    const snowCapMat = new THREE.MeshToonMaterial({ color: 0xf8fafc });

    const boulderPositions: [number, number, number, number][] = [
      // Outside north gate
      [-3.8, -9.5, 0.3, 1.2],
      [3.8, -9.8, -0.4, 1.15],
      [-6.5, -8.2, 0.8, 1.4],
      [6.8, -8.4, -0.6, 1.3],
      // Outside south gate
      [-3.6, 9.4, 0.2, 1.1],
      [3.6, 9.6, -0.3, 1.25],
      // Outer perimeter borders
      [-9.8, 2.5, 0.5, 1.5],
      [-10.5, -3.2, -0.7, 1.35],
      [10.2, 5.4, 0.9, 1.45],
      [11.5, -0.5, -0.2, 1.2],
    ];
    this.totalBoulders = boulderPositions.length;
    this.boulderMesh = new THREE.InstancedMesh(boulderGeo, boulderMat, this.totalBoulders);
    this.boulderMesh.castShadow = true;
    this.boulderMesh.receiveShadow = true;

    this.boulderSnowMesh = new THREE.InstancedMesh(snowCapGeo, snowCapMat, this.totalBoulders);
    this.boulderSnowMesh.castShadow = true;

    for (let i = 0; i < this.totalBoulders; i++) {
      const [x, z, r, s] = boulderPositions[i];
      // Rock
      dummy.position.set(x, 0.42 * s, z);
      dummy.rotation.set(0.2, r, -0.15);
      dummy.scale.set(s * 1.1, s * 0.75, s * 1.05);
      dummy.updateMatrix();
      this.boulderMesh.setMatrixAt(i, dummy.matrix);

      // Snow Cap
      dummy.position.set(x, 0.68 * s, z);
      dummy.rotation.set(0.1, r + 0.3, -0.05);
      dummy.scale.set(s * 0.95, s * 0.35, s * 0.92);
      dummy.updateMatrix();
      this.boulderSnowMesh.setMatrixAt(i, dummy.matrix);
    }
    this.boulderMesh.instanceMatrix.needsUpdate = true;
    this.boulderSnowMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.boulderMesh, this.boulderSnowMesh);

    // 4. Standing Warm Path Lanterns (Instanced, emissive, NO dynamic lights!)
    const lanternPostGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6);
    const lanternPostMat = new THREE.MeshToonMaterial({ color: 0x334155 });
    const lanternGlassGeo = new THREE.BoxGeometry(0.24, 0.32, 0.24);
    const lanternGlassMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

    const lanternPositions: [number, number][] = [
      [-1.8, -0.8],
      [1.8, -0.8],
      [-1.2, 3.6],
      [1.2, 3.6],
      [-1.2, -6.4],
      [1.2, -6.4],
    ];
    this.totalLanterns = lanternPositions.length;
    this.lanternPostMesh = new THREE.InstancedMesh(lanternPostGeo, lanternPostMat, this.totalLanterns);
    this.lanternPostMesh.castShadow = true;

    this.lanternGlassMesh = new THREE.InstancedMesh(lanternGlassGeo, lanternGlassMat, this.totalLanterns);

    for (let i = 0; i < this.totalLanterns; i++) {
      const [x, z] = lanternPositions[i];
      // Post
      dummy.position.set(x, 0.75, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.lanternPostMesh.setMatrixAt(i, dummy.matrix);

      // Glass lighthead
      dummy.position.set(x, 1.42, z);
      dummy.updateMatrix();
      this.lanternGlassMesh.setMatrixAt(i, dummy.matrix);
    }
    this.lanternPostMesh.instanceMatrix.needsUpdate = true;
    this.lanternGlassMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.lanternPostMesh, this.lanternGlassMesh);

    scene.add(this.group);
  }

  applyQuality(quality: GraphicsQuality): void {
    const isHigh = quality === 'high';
    this.boulderSnowMesh.visible = isHigh;
    if (isHigh) {
      this.crateMesh.count = this.totalCrates;
      this.barrelMesh.count = this.totalBarrels;
      this.boulderMesh.count = this.totalBoulders;
      this.lanternPostMesh.count = this.totalLanterns;
      this.lanternGlassMesh.count = this.totalLanterns;
    } else {
      // Fewer props on Low quality to save vertex processing
      this.crateMesh.count = Math.floor(this.totalCrates * 0.5);
      this.barrelMesh.count = Math.floor(this.totalBarrels * 0.5);
      this.boulderMesh.count = Math.floor(this.totalBoulders * 0.6);
      this.lanternPostMesh.count = Math.floor(this.totalLanterns * 0.5);
      this.lanternGlassMesh.count = Math.floor(this.totalLanterns * 0.5);
    }
  }
}
