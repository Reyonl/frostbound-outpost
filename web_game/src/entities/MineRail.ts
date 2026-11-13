import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GAME_CONFIG } from '../config/gameConfig';
import type { ParticleSystem } from '../systems/ParticleSystem';

export class MineRail {
  readonly group = new THREE.Group();
  readonly curve: THREE.CatmullRomCurve3;
  readonly depotPos = new THREE.Vector3(3.8, 0, 1.8);

  private readonly cartGroup = new THREE.Group();
  private readonly cartGoldMesh: THREE.Mesh;
  private readonly depotBarsInstanced: THREE.InstancedMesh;

  unlocked = true;
  speedMultiplier = 1;
  goldDelivered = 0;

  private progress = 0.05;
  private hasOre = false;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);

    // Closed mine-cart loop from Gold Depot inside base -> East gate -> Gold Ore Vein
    this.curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(3.8, 0.12, 1.8),
        new THREE.Vector3(7.4, 0.12, 0.6),
        new THREE.Vector3(12.2, 0.12, -2.5),
        new THREE.Vector3(12.8, 0.12, -6.4),
        new THREE.Vector3(9.4, 0.12, -4.4),
        new THREE.Vector3(6.8, 0.12, -0.9),
      ],
      true,
    );

    // Build wooden sleepers & steel rails along spline using InstancedMesh
    const sleeperMat = new THREE.MeshToonMaterial({ color: 0x78350f });
    const railMat = new THREE.MeshToonMaterial({ color: 0x94a3b8 });
    const steps = 42;
    const sleeperGeo = new THREE.BoxGeometry(1.15, 0.07, 0.22);
    const sleeperMesh = new THREE.InstancedMesh(sleeperGeo, sleeperMat, steps);
    sleeperMesh.castShadow = true;
    sleeperMesh.receiveShadow = true;
    const dummy = new THREE.Object3D();

    const railPointsL: THREE.Vector3[] = [];
    const railPointsR: THREE.Vector3[] = [];
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pt = this.curve.getPointAt(t % 1);
      const tan = this.curve.getTangentAt(t % 1).normalize();
      const side = new THREE.Vector3().crossVectors(tan, up).normalize();

      if (i < steps) {
        dummy.position.copy(pt);
        dummy.rotation.set(0, Math.atan2(tan.x, tan.z), 0);
        dummy.updateMatrix();
        sleeperMesh.setMatrixAt(i, dummy.matrix);
      }

      railPointsL.push(pt.clone().addScaledVector(side, -0.35).add(new THREE.Vector3(0, 0.06, 0)));
      railPointsR.push(pt.clone().addScaledVector(side, 0.35).add(new THREE.Vector3(0, 0.06, 0)));
    }
    sleeperMesh.instanceMatrix.needsUpdate = true;
    this.group.add(sleeperMesh);

    const railCurveL = new THREE.CatmullRomCurve3(railPointsL, true);
    const railCurveR = new THREE.CatmullRomCurve3(railPointsR, true);
    const geoL = new THREE.TubeGeometry(railCurveL, 64, 0.045, 5, true);
    const geoR = new THREE.TubeGeometry(railCurveR, 64, 0.045, 5, true);
    const mergedRails = mergeGeometries([geoL, geoR]);
    this.group.add(new THREE.Mesh(mergedRails || geoL, railMat));

    // Gold Ore Vein at the far end of the rail
    const vein = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.45, 0),
      new THREE.MeshToonMaterial({ color: 0xfacc15 }),
    );
    vein.position.set(13.8, 0.9, -7.2);
    vein.castShadow = true;
    this.group.add(vein);

    // Depot platform inside base
    const depot = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.35, 1.4),
      new THREE.MeshToonMaterial({ color: 0x475569 }),
    );
    depot.position.set(this.depotPos.x, 0.18, this.depotPos.z);
    depot.receiveShadow = true;
    this.group.add(depot);

    // Depot gold bars merged into 1 InstancedMesh (saves 13 draw calls)
    const barGeo = new THREE.BoxGeometry(0.42, 0.14, 0.22);
    const barMat = new THREE.MeshToonMaterial({ color: 0xfacc15 });
    this.depotBarsInstanced = new THREE.InstancedMesh(barGeo, barMat, 14);
    this.depotBarsInstanced.castShadow = true;
    this.depotBarsInstanced.count = 0;
    for (let i = 0; i < 14; i++) {
      dummy.position.set(
        this.depotPos.x + ((i % 2) - 0.5) * 0.5,
        0.43 + Math.floor(i / 2) * 0.15,
        this.depotPos.z,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      this.depotBarsInstanced.setMatrixAt(i, dummy.matrix);
    }
    this.depotBarsInstanced.instanceMatrix.needsUpdate = true;
    this.group.add(this.depotBarsInstanced);

    // Detailed Mine Cart Vehicle with flanged iron wheels & metal brackets
    const cartParts: THREE.BufferGeometry[] = [];
    const hopper = new THREE.BoxGeometry(0.85, 0.46, 1.15);
    hopper.translate(0, 0.45, 0);
    const rimLip = new THREE.BoxGeometry(0.92, 0.08, 1.22);
    rimLip.translate(0, 0.68, 0);
    cartParts.push(hopper, rimLip);

    // 4 flanged iron wheels
    const wheelPositions: [number, number][] = [
      [-0.46, -0.38],
      [0.46, -0.38],
      [-0.46, 0.38],
      [0.46, 0.38],
    ];
    for (const [wx, wz] of wheelPositions) {
      const wGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 8);
      wGeo.rotateZ(Math.PI / 2);
      wGeo.translate(wx, 0.16, wz);
      cartParts.push(wGeo);
    }
    // 2 axles
    for (const az of [-0.38, 0.38]) {
      const aGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.94, 6);
      aGeo.rotateZ(Math.PI / 2);
      aGeo.translate(0, 0.16, az);
      cartParts.push(aGeo);
    }

    const mergedCartGeo = mergeGeometries(cartParts) || hopper;
    const cartMesh = new THREE.Mesh(
      mergedCartGeo,
      new THREE.MeshToonMaterial({ color: 0x334155 }),
    );
    cartMesh.castShadow = true;
    this.cartGroup.add(cartMesh);

    // Visible gleaming gold ingots stacked in cart when loaded
    const goldIngotsGeo: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.BoxGeometry(0.36, 0.12, 0.22);
      if (i < 3) {
        g.translate(((i % 2) - 0.5) * 0.38, 0.52, (i - 1) * 0.26);
      } else {
        g.translate(0, 0.65, (i - 3.5) * 0.28);
      }
      goldIngotsGeo.push(g);
    }
    const mergedCartGold = mergeGeometries(goldIngotsGeo) || goldIngotsGeo[0];
    this.cartGoldMesh = new THREE.Mesh(mergedCartGold, barMat);
    this.cartGoldMesh.castShadow = true;
    this.cartGoldMesh.visible = false;
    this.cartGroup.add(this.cartGoldMesh);

    this.group.add(this.cartGroup);
    this.group.visible = this.unlocked;
  }

  update(
    dt: number,
    particles: ParticleSystem,
    onGoldDelivered: (amount: number) => void,
  ): void {
    if (!this.unlocked) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    const prev = this.progress;
    const cycleRate = (GAME_CONFIG.stations.mineCartSpeed * this.speedMultiplier) / 34;
    this.progress = (this.progress + cycleRate * dt) % 1;

    // Load gold ore near far point (t ~ 0.5)
    if (!this.hasOre && prev < 0.5 && this.progress >= 0.5) {
      this.hasOre = true;
      const p = this.curve.getPointAt(0.5);
      particles.burst(p.x, 1.0, p.z, 0xfacc15, 8, 4.2, 0.85);
    }

    // Deliver gold bars when wrapping back to depot (t wraps past 1 -> 0)
    if (this.hasOre && this.progress < prev) {
      this.hasOre = false;
      this.goldDelivered += 2;
      particles.burst(this.depotPos.x, 0.9, this.depotPos.z, 0xfacc15, 7, 3.6, 0.8);
      onGoldDelivered(2);
    }

    const pt = this.curve.getPointAt(this.progress);
    const tan = this.curve.getTangentAt(this.progress).normalize();
    this.cartGroup.position.copy(pt);
    this.cartGroup.rotation.y = Math.atan2(tan.x, tan.z);

    this.cartGoldMesh.visible = this.hasOre;
    this.depotBarsInstanced.count = Math.min(14, this.goldDelivered);
    if (this.goldDelivered > 0) {
      this.depotBarsInstanced.instanceMatrix.needsUpdate = true;
    }
  }
}
