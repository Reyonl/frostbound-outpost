import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig';
import type { GraphicsQuality } from '../core/QualitySettings';

export class BaseFort {
  readonly group = new THREE.Group();
  readonly campfirePos = new THREE.Vector3(0, 0, -0.4);
  readonly fireLight: THREE.PointLight;

  private readonly flameOuter: THREE.Mesh;
  private readonly flameInner: THREE.Mesh;
  private readonly gateBarFill: THREE.Mesh;
  private readonly glowSprite: THREE.Sprite;
  private readonly emberPoints: THREE.Points;
  private readonly emberPositions: Float32Array;
  private readonly emberVels: Float32Array;
  private readonly emberCount = 24;

  gateHp = 200;
  gateMaxHp = 200;
  fenceLevel = 1;
  private fireTime = 0;
  private quality: GraphicsQuality = 'high';
  private stoneMesh!: THREE.InstancedMesh;
  private logMesh!: THREE.InstancedMesh;
  private tipMesh!: THREE.InstancedMesh;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.buildPalisade();

    // Central Campfire Hearth (Instanced stones to minimize draw calls)
    const stoneMat = new THREE.MeshToonMaterial({ color: 0x64748b });
    const stoneGeo = new THREE.DodecahedronGeometry(0.24, 0);
    this.stoneMesh = new THREE.InstancedMesh(stoneGeo, stoneMat, 8);
    this.stoneMesh.castShadow = true;
    this.stoneMesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      dummy.position.set(
        this.campfirePos.x + Math.cos(a) * 0.72,
        0.14,
        this.campfirePos.z + Math.sin(a) * 0.72,
      );
      dummy.rotation.set(0.2, a, 0.1);
      dummy.updateMatrix();
      this.stoneMesh.setMatrixAt(i, dummy.matrix);
    }
    this.stoneMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.stoneMesh);

    // Instanced campfire logs
    const logMat = new THREE.MeshToonMaterial({ color: 0x5c3317 });
    const logGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.1, 6);
    this.logMesh = new THREE.InstancedMesh(logGeo, logMat, 2);
    this.logMesh.castShadow = true;
    this.logMesh.receiveShadow = true;
    for (let i = 0; i < 2; i++) {
      dummy.position.set(this.campfirePos.x, 0.16, this.campfirePos.z);
      dummy.rotation.set(0, i === 0 ? 0.6 : -0.6, Math.PI / 2);
      dummy.updateMatrix();
      this.logMesh.setMatrixAt(i, dummy.matrix);
    }
    this.logMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.logMesh);

    this.flameOuter = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 1.05, 7),
      new THREE.MeshBasicMaterial({ color: 0xf97316 }),
    );
    this.flameOuter.position.set(this.campfirePos.x, 0.58, this.campfirePos.z);
    this.group.add(this.flameOuter);

    this.flameInner = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.68, 7),
      new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    );
    this.flameInner.position.set(this.campfirePos.x, 0.5, this.campfirePos.z);
    this.group.add(this.flameInner);

    this.fireLight = new THREE.PointLight(0xffa347, 2.4, 13, 1.5);
    this.fireLight.position.set(this.campfirePos.x, 1.4, this.campfirePos.z);
    this.group.add(this.fireLight);

    // Additive glow sprite faking campfire bloom
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 64;
    glowCanvas.height = 64;
    const gctx = glowCanvas.getContext('2d');
    if (gctx) {
      const grad = gctx.createRadialGradient(32, 32, 4, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 200, 90, 0.95)');
      grad.addColorStop(0.35, 'rgba(249, 115, 22, 0.55)');
      grad.addColorStop(0.7, 'rgba(234, 88, 12, 0.2)');
      grad.addColorStop(1, 'rgba(234, 88, 12, 0)');
      gctx.fillStyle = grad;
      gctx.beginPath();
      gctx.arc(32, 32, 32, 0, Math.PI * 2);
      gctx.fill();
    }
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffb554,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glowSprite = new THREE.Sprite(glowMat);
    this.glowSprite.position.set(this.campfirePos.x, 0.95, this.campfirePos.z);
    this.glowSprite.scale.set(2.8, 2.8, 1);
    this.group.add(this.glowSprite);

    // Drifting campfire embers
    this.emberPositions = new Float32Array(this.emberCount * 3);
    this.emberVels = new Float32Array(this.emberCount * 3);
    for (let i = 0; i < this.emberCount; i++) {
      this.resetEmber(i, true);
    }
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(this.emberPositions, 3));
    const emberMat = new THREE.PointsMaterial({
      color: 0xfdba74,
      size: 0.16,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.emberPoints = new THREE.Points(emberGeo, emberMat);
    this.group.add(this.emberPoints);

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

  private resetEmber(i: number, randomHeight = false): void {
    const idx = i * 3;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.35;
    this.emberPositions[idx] = this.campfirePos.x + Math.cos(angle) * r;
    this.emberPositions[idx + 1] = randomHeight ? 0.35 + Math.random() * 1.5 : 0.35;
    this.emberPositions[idx + 2] = this.campfirePos.z + Math.sin(angle) * r;

    this.emberVels[idx] = (Math.random() - 0.5) * 0.22;
    this.emberVels[idx + 1] = 0.55 + Math.random() * 0.65;
    this.emberVels[idx + 2] = (Math.random() - 0.5) * 0.22;
  }

  applyQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    const isHigh = quality === 'high';
    this.glowSprite.visible = isHigh;
    this.emberPoints.visible = isHigh;
    if (this.tipMesh) this.tipMesh.visible = isHigh;
    if (this.stoneMesh) this.stoneMesh.visible = isHigh;
    if (this.logMesh) this.logMesh.visible = isHigh;
    if (this.flameInner) this.flameInner.visible = isHigh;
  }

  private buildPalisade(): void {
    const r = GAME_CONFIG.world.baseRadius;
    const postCount = 46;
    const postGeo = new THREE.CylinderGeometry(0.14, 0.18, 1.35, 6);
    const tipGeo = new THREE.ConeGeometry(0.15, 0.35, 6);
    const postMat = new THREE.MeshToonMaterial({ color: 0x8b4a2b });
    const snowMat = new THREE.MeshToonMaterial({ color: 0xf1f5f9 });

    const postMesh = new THREE.InstancedMesh(postGeo, postMat, postCount);
    this.tipMesh = new THREE.InstancedMesh(tipGeo, snowMat, postCount);
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;

    for (let i = 0; i < postCount; i++) {
      const angle = (i / postCount) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

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
      this.tipMesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }

    postMesh.count = placed;
    this.tipMesh.count = placed;
    this.group.add(postMesh, this.tipMesh);

    // Instanced gate posts at North & South entrances (saves 6 draw calls)
    const gatePostMat = new THREE.MeshToonMaterial({ color: 0xb91c1c });
    const gateCoords: [number, number][] = [
      [-1.95, r - 0.15],
      [1.95, r - 0.15],
      [-1.95, -r + 0.15],
      [1.95, -r + 0.15],
    ];
    const gateMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.45, 1.75, 0.45),
      gatePostMat,
      gateCoords.length,
    );
    gateMesh.castShadow = true;
    gateMesh.receiveShadow = true;
    for (let i = 0; i < gateCoords.length; i++) {
      dummy.position.set(gateCoords[i][0], 0.87, gateCoords[i][1]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      gateMesh.setMatrixAt(i, dummy.matrix);
    }
    gateMesh.instanceMatrix.needsUpdate = true;
    this.group.add(gateMesh);
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
    this.fireLight.intensity = 2.2 + Math.sin(this.fireTime * 1.9) * 0.45;

    if (this.quality === 'high') {
      const glowScale = 2.6 + Math.sin(this.fireTime * 1.6) * 0.35;
      this.glowSprite.scale.set(glowScale, glowScale, 1);
      (this.glowSprite.material as THREE.SpriteMaterial).opacity = 0.72 + Math.cos(this.fireTime * 2.1) * 0.16;

      const posAttr = this.emberPoints.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < this.emberCount; i++) {
        const idx = i * 3;
        this.emberPositions[idx] += this.emberVels[idx] * dt;
        this.emberPositions[idx + 1] += this.emberVels[idx + 1] * dt;
        this.emberPositions[idx + 2] += this.emberVels[idx + 2] * dt;
        if (this.emberPositions[idx + 1] > 2.3) {
          this.resetEmber(i);
        }
      }
      posAttr.needsUpdate = true;
    }

    const ratio = Math.max(0.02, this.gateHp / Math.max(1, this.gateMaxHp));
    this.gateBarFill.scale.x = ratio;
    this.gateBarFill.position.x = -(1 - ratio) * 1.04;
  }
}
