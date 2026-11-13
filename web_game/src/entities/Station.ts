import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GAME_CONFIG } from '../config/gameConfig';
import type { GraphicsQuality } from '../core/QualitySettings';
import type { CarryType, StackSystem } from '../systems/StackSystem';
import type { AudioSynth } from '../core/AudioSynth';
import { triggerHaptic } from '../core/Haptics';

export interface StationConfig {
  id: 'sawmill' | 'smokehouse';
  label: string;
  inputType: CarryType;
  position: { x: number; z: number };
  dropOffset: { x: number; z: number };
  accentColor: number;
  processDuration: number;
}

interface SmokePuff {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
}

export class Station {
  readonly config: StationConfig;
  readonly group = new THREE.Group();
  readonly dropWorldPos = new THREE.Vector3();

  unlocked = true;
  rawQueue = 0;
  processedCount = 0;

  private readonly ringMesh: THREE.Mesh;
  private readonly activeSpinner: THREE.Mesh;
  private readonly outputInstanced: THREE.InstancedMesh;
  private readonly badgeCanvas: HTMLCanvasElement;
  private readonly badgeCtx: CanvasRenderingContext2D;
  private readonly badgeTexture: THREE.CanvasTexture;

  private readonly smokeInstanced: THREE.InstancedMesh;
  private readonly smokePuffs: SmokePuff[] = [];
  private readonly chimneyPos: THREE.Vector3;
  private readonly sawdustInstanced?: THREE.InstancedMesh;
  private readonly sawdustPuffs: { x: number; y: number; z: number; vy: number; vx: number }[] = [];
  private readonly windowMat?: THREE.MeshToonMaterial;

  private unloadTimer = 0;
  private processTimer = 0;
  private badgeLastValue = -1;
  private animTime = 0;
  private quality: GraphicsQuality = 'high';
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, config: StationConfig) {
    this.config = config;
    this.group.position.set(config.position.x, 0, config.position.z);
    scene.add(this.group);

    this.dropWorldPos.set(
      config.position.x + config.dropOffset.x,
      0.06,
      config.position.z + config.dropOffset.z,
    );

    const timberGeoList: THREE.BufferGeometry[] = [];
    const stoneGeoList: THREE.BufferGeometry[] = [];

    // Station workbench platform
    const benchGeo = new THREE.BoxGeometry(2.3, 0.55, 1.6);
    benchGeo.translate(0, 0.28, 0);
    timberGeoList.push(benchGeo);

    const steelMat = new THREE.MeshToonMaterial({ color: 0x94a3b8 });

    if (config.id === 'sawmill') {
      this.chimneyPos = new THREE.Vector3(-0.85, 2.35, 0.45);

      // 1. Toothed circular saw blade (cylinder disk + 8 sharp radial teeth merged)
      const diskGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.05, 12);
      diskGeo.rotateZ(Math.PI / 2);
      const teethList: THREE.BufferGeometry[] = [diskGeo];
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const tooth = new THREE.BoxGeometry(0.06, 0.12, 0.12);
        tooth.rotateX(ang);
        tooth.translate(0, Math.sin(ang) * 0.42, Math.cos(ang) * 0.42);
        teethList.push(tooth);
      }
      const axleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.28, 8);
      axleGeo.rotateZ(Math.PI / 2);
      teethList.push(axleGeo);

      const mergedBladeGeo = mergeGeometries(teethList) || diskGeo;
      this.activeSpinner = new THREE.Mesh(mergedBladeGeo, steelMat);
      this.activeSpinner.position.set(-0.35, 0.88, 0);
      this.activeSpinner.castShadow = true;
      this.group.add(this.activeSpinner);

      // 2. Timber roof & support posts
      const awningGeo = new THREE.BoxGeometry(2.4, 0.16, 1.7);
      awningGeo.translate(0, 1.55, 0);
      timberGeoList.push(awningGeo);

      const post1 = new THREE.BoxGeometry(0.14, 1.1, 0.14);
      post1.translate(-1.05, 1.05, -0.72);
      const post2 = new THREE.BoxGeometry(0.14, 1.1, 0.14);
      post2.translate(-1.05, 1.05, 0.72);
      timberGeoList.push(post1, post2);

      // 3. Stacked log pile beside the sawmill
      for (let i = 0; i < 3; i++) {
        const log = new THREE.CylinderGeometry(0.16, 0.16, 1.25, 7);
        log.rotateX(Math.PI / 2);
        if (i === 0) log.translate(1.22, 0.16, 0.35);
        else if (i === 1) log.translate(1.22, 0.16, -0.35);
        else log.translate(1.22, 0.42, 0);
        timberGeoList.push(log);
      }

      // 4. Stone chimney on roof
      const chimneyGeo = new THREE.BoxGeometry(0.38, 1.1, 0.38);
      chimneyGeo.translate(-0.85, 1.85, 0.45);
      const chimneyRim = new THREE.BoxGeometry(0.46, 0.12, 0.46);
      chimneyRim.translate(-0.85, 2.38, 0.45);
      stoneGeoList.push(chimneyGeo, chimneyRim);

      // 5. Instanced sawdust particles
      const sawdustGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      const sawdustMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      this.sawdustInstanced = new THREE.InstancedMesh(sawdustGeo, sawdustMat, 8);
      this.sawdustInstanced.name = 'particles_sawdust';
      this.sawdustInstanced.visible = false;
      this.group.add(this.sawdustInstanced);
      for (let i = 0; i < 8; i++) {
        this.sawdustPuffs.push({
          x: -0.35 + (Math.random() - 0.5) * 0.2,
          y: 0.85,
          z: (Math.random() - 0.5) * 0.2,
          vx: (Math.random() - 0.5) * 1.4,
          vy: 0.8 + Math.random() * 1.2,
        });
      }
    } else {
      this.chimneyPos = new THREE.Vector3(-0.45, 2.15, -0.35);

      // 1. Smokehouse enclosure
      const houseGeo = new THREE.BoxGeometry(1.25, 1.35, 1.15);
      houseGeo.translate(-0.4, 0.95, 0);
      timberGeoList.push(houseGeo);

      // Roof peak
      const roofPeak = new THREE.ConeGeometry(1.05, 0.55, 4);
      roofPeak.rotateY(Math.PI / 4);
      roofPeak.translate(-0.4, 1.85, 0);
      timberGeoList.push(roofPeak);

      // 2. Hanging cured meats under front awning
      const meatGeoList: THREE.BufferGeometry[] = [];
      const meatMat = new THREE.MeshToonMaterial({ color: 0x991b1b });
      for (let i = 0; i < 3; i++) {
        const mx = -0.15 - i * 0.28;
        const ham = new THREE.BoxGeometry(0.16, 0.32, 0.18);
        ham.translate(mx, 0.72 + (i % 2) * 0.08, 0.62);
        meatGeoList.push(ham);
      }
      const mergedMeatGeo = mergeGeometries(meatGeoList) || meatGeoList[0];
      this.activeSpinner = new THREE.Mesh(mergedMeatGeo, meatMat);
      this.activeSpinner.castShadow = true;
      this.group.add(this.activeSpinner);

      // 3. Warm glowing window (emissive material, NO dynamic lights!)
      const winGeo = new THREE.PlaneGeometry(0.48, 0.42);
      this.windowMat = new THREE.MeshToonMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.2,
      });
      const winMesh = new THREE.Mesh(winGeo, this.windowMat);
      winMesh.position.set(-0.4, 1.05, 0.59);
      this.group.add(winMesh);

      // 4. Stone chimney on roof
      const chimneyGeo = new THREE.BoxGeometry(0.36, 1.05, 0.36);
      chimneyGeo.translate(-0.45, 1.75, -0.35);
      const chimneyRim = new THREE.BoxGeometry(0.44, 0.12, 0.44);
      chimneyRim.translate(-0.45, 2.25, -0.35);
      stoneGeoList.push(chimneyGeo, chimneyRim);
    }

    // Merge static timber geometry
    const timberMat = new THREE.MeshToonMaterial({ color: 0x78350f });
    const mergedTimber = mergeGeometries(timberGeoList) || timberGeoList[0];
    const timberMesh = new THREE.Mesh(mergedTimber, timberMat);
    timberMesh.castShadow = true;
    timberMesh.receiveShadow = true;
    this.group.add(timberMesh);

    // Merge static stone geometry
    if (stoneGeoList.length > 0) {
      const stoneMat = new THREE.MeshToonMaterial({ color: 0x64748b });
      const mergedStone = mergeGeometries(stoneGeoList) || stoneGeoList[0];
      const stoneMesh = new THREE.Mesh(mergedStone, stoneMat);
      stoneMesh.castShadow = true;
      stoneMesh.receiveShadow = true;
      this.group.add(stoneMesh);
    }

    // Instanced chimney smoke puffs (6 puffs per station merged into 1 draw call)
    const smokeGeo = new THREE.DodecahedronGeometry(0.18, 0);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.smokeInstanced = new THREE.InstancedMesh(smokeGeo, smokeMat, 6);
    this.smokeInstanced.name = 'particles_smoke';
    this.group.add(this.smokeInstanced);
    for (let i = 0; i < 6; i++) {
      this.smokePuffs.push({
        x: this.chimneyPos.x + (Math.random() - 0.5) * 0.12,
        y: this.chimneyPos.y + i * 0.28,
        z: this.chimneyPos.z + (Math.random() - 0.5) * 0.12,
        vx: (Math.random() - 0.5) * 0.12,
        vy: 0.38 + Math.random() * 0.25,
        vz: (Math.random() - 0.5) * 0.12,
        life: i * 0.45,
        maxLife: 2.8,
        scale: 0.6 + Math.random() * 0.5,
      });
    }

    // Output shelf stack visuals merged into InstancedMesh (saves up to 22 draw calls)
    const outGeo = new THREE.BoxGeometry(0.55, 0.14, 0.32);
    const outColor = config.inputType === 'wood' ? 0xd97706 : 0xf87171;
    const outMat = new THREE.MeshToonMaterial({ color: outColor });
    this.outputInstanced = new THREE.InstancedMesh(outGeo, outMat, 12);
    this.outputInstanced.castShadow = true;
    this.outputInstanced.count = 0;
    const dummyOut = new THREE.Object3D();
    for (let i = 0; i < 12; i++) {
      dummyOut.position.set(0.62, 0.64 + i * 0.15, 0);
      dummyOut.updateMatrix();
      this.outputInstanced.setMatrixAt(i, dummyOut.matrix);
    }
    this.outputInstanced.instanceMatrix.needsUpdate = true;
    this.group.add(this.outputInstanced);

    // Glowing ring drop zone on ground
    const ringGeo = new THREE.RingGeometry(
      GAME_CONFIG.stations.dropZoneRadius - 0.25,
      GAME_CONFIG.stations.dropZoneRadius,
      28,
    );
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      }),
    );
    this.ringMesh.position.set(config.dropOffset.x, 0.085, config.dropOffset.z);
    this.group.add(this.ringMesh);

    // Canvas floor badge showing station name & queued/processed count
    this.badgeCanvas = document.createElement('canvas');
    this.badgeCanvas.width = 256;
    this.badgeCanvas.height = 128;
    const ctx = this.badgeCanvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.badgeCtx = ctx;
    this.badgeTexture = new THREE.CanvasTexture(this.badgeCanvas);

    const badgePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 1.05),
      new THREE.MeshBasicMaterial({ map: this.badgeTexture, transparent: true }),
    );
    badgePlane.rotation.x = -Math.PI / 2;
    badgePlane.position.set(config.dropOffset.x, 0.095, config.dropOffset.z);
    this.group.add(badgePlane);
    this.redrawBadge();
  }

  applyQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    const isHigh = quality === 'high';
    this.smokeInstanced.visible = isHigh;
    if (this.sawdustInstanced) {
      this.sawdustInstanced.visible = isHigh && this.rawQueue > 0;
    }
  }

  private redrawBadge(): void {
    const val = this.processedCount;
    if (val === this.badgeLastValue) return;
    this.badgeLastValue = val;

    const ctx = this.badgeCtx;
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(16, 16, 224, 96, 24);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.config.label, 128, 54);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(`${this.processedCount} READY`, 128, 94);
    this.badgeTexture.needsUpdate = true;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    stack: StackSystem,
    audio: AudioSynth,
    onProduced: (kind: CarryType, amount: number) => void,
  ): void {
    if (!this.unlocked) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.animTime += dt;

    const dist = Math.hypot(playerPos.x - this.dropWorldPos.x, playerPos.z - this.dropWorldPos.z);
    const playerInside = dist <= GAME_CONFIG.stations.dropZoneRadius;

    this.ringMesh.scale.setScalar(playerInside ? 1.08 : 1 + Math.sin(this.animTime * 4.0) * 0.04);
    (this.ringMesh.material as THREE.MeshBasicMaterial).color.setHex(playerInside ? 0x4ade80 : 0x38bdf8);

    if (playerInside) {
      this.unloadTimer -= dt;
      if (this.unloadTimer <= 0) {
        const popped = stack.popLastOf(this.config.inputType);
        if (popped) {
          this.unloadTimer = GAME_CONFIG.stations.unloadInterval;
          audio.playDrop();
          triggerHaptic('selection', 45);
          stack.spawnFlyingToPoint(
            popped,
            playerPos.x,
            1.4,
            playerPos.z,
            this.config.position.x,
            0.9,
            this.config.position.z,
            () => {
              this.rawQueue += 1;
            },
          );
        }
      }
    } else {
      this.unloadTimer = 0;
    }

    const isProcessing = this.rawQueue > 0;
    if (isProcessing) {
      this.processTimer += dt;
      if (this.config.id === 'sawmill') {
        this.activeSpinner.rotation.x += dt * 32;
      } else {
        // Hanging meat gentle swaying
        this.activeSpinner.rotation.z = Math.sin(this.animTime * 3.5) * 0.12;
      }

      if (this.processTimer >= this.config.processDuration) {
        this.processTimer -= this.config.processDuration;
        this.rawQueue -= 1;
        this.processedCount += 1;
        onProduced(this.config.inputType, 1);
      }
    } else if (this.config.id === 'smokehouse') {
      this.activeSpinner.rotation.z = Math.sin(this.animTime * 1.5) * 0.04;
    }

    // Warm pulsing window glow on smokehouse
    if (this.windowMat) {
      this.windowMat.emissiveIntensity = 1.1 + Math.sin(this.animTime * 2.8) * 0.25;
    }

    // Update chimney smoke puffs on High Quality
    if (this.quality === 'high') {
      for (let i = 0; i < this.smokePuffs.length; i++) {
        const p = this.smokePuffs[i];
        p.life += dt;
        p.y += p.vy * dt;
        p.x += p.vx * dt + Math.sin(p.life * 2.2) * 0.015;
        p.z += p.vz * dt + Math.cos(p.life * 1.8) * 0.015;
        p.scale += dt * 0.22;

        if (p.life >= p.maxLife || p.y > this.chimneyPos.y + 1.8) {
          p.life = 0;
          p.x = this.chimneyPos.x + (Math.random() - 0.5) * 0.12;
          p.y = this.chimneyPos.y;
          p.z = this.chimneyPos.z + (Math.random() - 0.5) * 0.12;
          p.scale = 0.55 + Math.random() * 0.3;
        }

        this.dummy.position.set(p.x, p.y, p.z);
        this.dummy.rotation.set(p.life, p.life * 0.8, 0);
        this.dummy.scale.setScalar(p.scale);
        this.dummy.updateMatrix();
        this.smokeInstanced.setMatrixAt(i, this.dummy.matrix);
      }
      this.smokeInstanced.instanceMatrix.needsUpdate = true;

      // Update sawdust spray if sawmill is processing
      if (this.sawdustInstanced) {
        this.sawdustInstanced.visible = isProcessing;
        if (isProcessing) {
          for (let i = 0; i < this.sawdustPuffs.length; i++) {
            const s = this.sawdustPuffs[i];
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.vy -= 9.8 * dt * 0.65; // gravity arc

            if (s.y < 0.3) {
              s.x = -0.35 + (Math.random() - 0.5) * 0.18;
              s.y = 0.88;
              s.z = (Math.random() - 0.5) * 0.18;
              s.vx = (Math.random() - 0.5) * 1.5;
              s.vy = 0.8 + Math.random() * 1.4;
            }

            this.dummy.position.set(s.x, s.y, s.z);
            this.dummy.scale.setScalar(0.7 + Math.random() * 0.5);
            this.dummy.updateMatrix();
            this.sawdustInstanced.setMatrixAt(i, this.dummy.matrix);
          }
          this.sawdustInstanced.instanceMatrix.needsUpdate = true;
        }
      }
    }

    this.outputInstanced.count = Math.min(12, this.processedCount);
    this.redrawBadge();
  }
}
