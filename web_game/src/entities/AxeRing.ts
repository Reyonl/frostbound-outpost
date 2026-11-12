import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig';

export class AxeRing {
  readonly group = new THREE.Group();
  readonly bladeWorldPositions: THREE.Vector3[] = [];

  private readonly axeMeshes: THREE.Group[] = [];
  private readonly slashRing: THREE.Mesh;

  axeCount: number = GAME_CONFIG.axe.baseCount;
  orbitRadius: number = GAME_CONFIG.axe.orbitRadius;
  spinSpeed: number = GAME_CONFIG.axe.spinSpeed;
  axeScale = 1;
  damage: number = GAME_CONFIG.axe.baseDamage;

  private angle = 0;

  constructor(playerGroup: THREE.Group) {
    this.group.position.y = 0.85;
    playerGroup.add(this.group);

    // Subtle glowing slash ring showing axe reach
    const ringGeo = new THREE.RingGeometry(this.orbitRadius - 0.18, this.orbitRadius + 0.12, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.slashRing = new THREE.Mesh(ringGeo, ringMat);
    this.slashRing.position.y = -0.35;
    this.group.add(this.slashRing);

    this.rebuildAxes();
  }

  setCount(nextCount: number): void {
    const clamped = Math.max(1, Math.min(10, Math.round(nextCount)));
    if (clamped !== this.axeCount) {
      this.axeCount = clamped;
      this.rebuildAxes();
    }
  }

  private rebuildAxes(): void {
    for (const m of this.axeMeshes) {
      this.group.remove(m);
    }
    this.axeMeshes.length = 0;
    this.bladeWorldPositions.length = 0;

    const handleMat = new THREE.MeshToonMaterial({ color: 0xb45309 });
    const steelMat = new THREE.MeshToonMaterial({ color: 0xf1f5f9 });
    const edgeMat = new THREE.MeshToonMaterial({ color: 0xbae6fd });

    for (let i = 0; i < this.axeCount; i++) {
      const axe = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.72), handleMat);
      handle.position.z = -0.1;
      axe.add(handle);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.34), steelMat);
      blade.position.set(0.14, 0, 0.24);
      axe.add(blade);

      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.36), edgeMat);
      edge.position.set(0.32, 0, 0.24);
      axe.add(edge);

      axe.scale.setScalar(this.axeScale);
      this.group.add(axe);
      this.axeMeshes.push(axe);
      this.bladeWorldPositions.push(new THREE.Vector3());
    }
  }

  update(dt: number): void {
    this.angle += this.spinSpeed * dt;
    this.slashRing.scale.setScalar((this.orbitRadius / GAME_CONFIG.axe.orbitRadius) * (0.97 + Math.sin(this.angle * 2) * 0.03));

    for (let i = 0; i < this.axeMeshes.length; i++) {
      const a = this.angle + (i / this.axeMeshes.length) * Math.PI * 2;
      const axe = this.axeMeshes[i];
      axe.position.set(Math.cos(a) * this.orbitRadius, 0, Math.sin(a) * this.orbitRadius);
      axe.rotation.y = -a + Math.PI * 0.1;
      axe.scale.setScalar(this.axeScale);
      axe.getWorldPosition(this.bladeWorldPositions[i]);
    }
  }
}
