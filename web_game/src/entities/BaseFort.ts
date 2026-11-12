import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig';

export class BaseFort {
  readonly group = new THREE.Group();
  readonly campfirePos = new THREE.Vector3(0, 0, -0.4);
  readonly fireLight: THREE.PointLight;

  private readonly flameOuter: THREE.Mesh;
  private readonly flameInner: THREE.Mesh;
  private readonly gateBarFill: THREE.Mesh;

  gateHp = 200;
  gateMaxHp = 200;
  fenceLevel = 1;
  private fireTime = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.buildPalisade();

    // Central Campfire Hearth
    const stoneMat = new THREE.MeshToonMaterial({ color: 0x64748b });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), stoneMat);
      stone.position.set(
        this.campfirePos.x + Math.cos(a) * 0.65,
        0.14,
        this.campfirePos.z + Math.sin(a) * 0.65,
      );
      stone.castShadow = true;
      this.group.add(stone);
    }

    const logMat = new THREE.MeshToonMaterial({ color: 0x6b3d1e });
    for (let i = 0; i < 2; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.0, 6), logMat);
      log.position.set(this.campfirePos.x, 0.16, this.campfirePos.z);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = i === 0 ? 0.6 : -0.6;
      this.group.add(log);
    }

    this.flameOuter = new THREE.Mesh(
      new THREE.ConeGeometry(0.36, 0.95, 6),
      new THREE.MeshBasicMaterial({ color: 0xf97316 }),
    );
    this.flameOuter.position.set(this.campfirePos.x, 0.56, this.campfirePos.z);
    this.group.add(this.flameOuter);

    this.flameInner = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.6, 6),
      new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    );
    this.flameInner.position.set(this.campfirePos.x, 0.48, this.campfirePos.z);
    this.group.add(this.flameInner);

    this.fireLight = new THREE.PointLight(0xff9b3d, 2.2, 12, 1.6);
    this.fireLight.position.set(this.campfirePos.x, 1.4, this.campfirePos.z);
    this.group.add(this.fireLight);

    // Floating gate HP bar above north gate
    const barBg = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.18, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x0f172a }),
    );
    barBg.position.set(0, 2.35, -GAME_CONFIG.world.baseRadius);
    this.group.add(barBg);

    this.gateBarFill = new THREE.Mesh(
      new THREE.BoxGeometry(2.08, 0.12, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x22c55e }),
    );
    this.gateBarFill.position.set(0, 2.35, -GAME_CONFIG.world.baseRadius);
    this.group.add(this.gateBarFill);
  }

  private buildPalisade(): void {
    const r = GAME_CONFIG.world.baseRadius;
    const postCount = 46;
    const postGeo = new THREE.CylinderGeometry(0.14, 0.18, 1.35, 6);
    const tipGeo = new THREE.ConeGeometry(0.15, 0.35, 6);
    const postMat = new THREE.MeshToonMaterial({ color: 0x8b4a2b });
    const snowMat = new THREE.MeshToonMaterial({ color: 0xf1f5f9 });

    const postMesh = new THREE.InstancedMesh(postGeo, postMat, postCount);
    const tipMesh = new THREE.InstancedMesh(tipGeo, snowMat, postCount);
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;

    for (let i = 0; i < postCount; i++) {
      const angle = (i / postCount) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      // Leave wide open gates at South (+Z), North (-Z), and East (+X) for rail/movement
      const isSouthGate = z > r * 0.86 && Math.abs(x) < 1.95;
      const isNorthGate = z < -r * 0.86 && Math.abs(x) < 1.95;
      const isEastRailGap = x > r * 0.86 && Math.abs(z) < 2.2;
      if (isSouthGate || isNorthGate || isEastRailGap) continue;

      dummy.position.set(x, 0.67, z);
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      postMesh.setMatrixAt(placed, dummy.matrix);

      dummy.position.set(x, 1.5, z);
      dummy.updateMatrix();
      tipMesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }

    postMesh.count = placed;
    tipMesh.count = placed;
    this.group.add(postMesh, tipMesh);

    // Decorative red gate posts at North & South entrances
    const gatePostMat = new THREE.MeshToonMaterial({ color: 0xb91c1c });
    const gateCoords: [number, number][] = [
      [-1.95, r - 0.15],
      [1.95, r - 0.15],
      [-1.95, -r + 0.15],
      [1.95, -r + 0.15],
    ];
    for (const [gx, gz] of gateCoords) {
      const gp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.75, 0.45), gatePostMat);
      gp.position.set(gx, 0.87, gz);
      gp.castShadow = true;
      this.group.add(gp);
    }
  }

  upgradeFence(): void {
    this.fenceLevel++;
    this.gateMaxHp += 120;
    this.gateHp = this.gateMaxHp;
  }

  damageGate(amount: number): void {
    this.gateHp = Math.max(0, this.gateHp - amount);
  }

  repairGate(amount: number): void {
    this.gateHp = Math.min(this.gateMaxHp, this.gateHp + amount);
  }

  update(dt: number): void {
    this.fireTime += dt * 7.5;
    const f1 = 1 + Math.sin(this.fireTime) * 0.12;
    const f2 = 1 + Math.cos(this.fireTime * 1.4) * 0.15;
    this.flameOuter.scale.set(f1, 0.95 + Math.sin(this.fireTime * 1.2) * 0.18, f1);
    this.flameInner.scale.set(f2, 0.95 + Math.cos(this.fireTime * 1.7) * 0.2, f2);
    this.fireLight.intensity = 2.0 + Math.sin(this.fireTime * 1.9) * 0.35;

    const ratio = Math.max(0.02, this.gateHp / Math.max(1, this.gateMaxHp));
    this.gateBarFill.scale.x = ratio;
    this.gateBarFill.position.x = -(1 - ratio) * 1.04;
  }
}
