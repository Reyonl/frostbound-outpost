import * as THREE from 'three';
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

export class Station {
  readonly config: StationConfig;
  readonly group = new THREE.Group();
  readonly dropWorldPos = new THREE.Vector3();

  unlocked = true;
  rawQueue = 0;
  processedCount = 0;

  private readonly ringMesh: THREE.Mesh;
  private readonly activeSpinner: THREE.Mesh;
  private awning?: THREE.Mesh;
  private readonly outputInstanced: THREE.InstancedMesh;
  private readonly badgeCanvas: HTMLCanvasElement;
  private readonly badgeCtx: CanvasRenderingContext2D;
  private readonly badgeTexture: THREE.CanvasTexture;

  private unloadTimer = 0;
  private processTimer = 0;
  private badgeLastValue = -1;

  constructor(scene: THREE.Scene, config: StationConfig) {
    this.config = config;
    this.group.position.set(config.position.x, 0, config.position.z);
    scene.add(this.group);

    this.dropWorldPos.set(
      config.position.x + config.dropOffset.x,
      0.06,
      config.position.z + config.dropOffset.z,
    );

    // Station workbench platform
    const benchMat = new THREE.MeshToonMaterial({ color: 0x92400e });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 1.6), benchMat);
    bench.position.y = 0.28;
    bench.castShadow = true;
    bench.receiveShadow = true;
    this.group.add(bench);

    // Roof/awning or chimney detail depending on station type
    const roofMat = new THREE.MeshToonMaterial({ color: config.accentColor });
    if (config.id === 'sawmill') {
      const saw = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12),
        new THREE.MeshToonMaterial({ color: 0xe2e8f0 }),
      );
      saw.rotation.z = Math.PI / 2;
      saw.position.set(-0.35, 0.85, 0);
      this.group.add(saw);
      this.activeSpinner = saw;

      this.awning = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.7), roofMat);
      this.awning.position.set(0, 1.55, 0);
      this.awning.castShadow = true;
      this.group.add(this.awning);
    } else {
      const smoker = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 1.0), roofMat);
      smoker.position.set(-0.4, 0.9, 0);
      smoker.castShadow = true;
      this.group.add(smoker);

      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.35, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xf97316 }),
      );
      glow.position.set(-0.4, 0.65, 0.52);
      this.group.add(glow);
      this.activeSpinner = glow;
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
    if (this.awning) this.awning.visible = quality === 'high';
  }

  private redrawBadge(): void {
    const val = this.rawQueue + this.processedCount * 1000;
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

    const dist = Math.hypot(playerPos.x - this.dropWorldPos.x, playerPos.z - this.dropWorldPos.z);
    const playerInside = dist <= GAME_CONFIG.stations.dropZoneRadius;

    this.ringMesh.scale.setScalar(playerInside ? 1.08 : 1 + Math.sin(performance.now() * 0.004) * 0.04);
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

    if (this.rawQueue > 0) {
      this.processTimer += dt;
      if (this.config.id === 'sawmill') {
        this.activeSpinner.rotation.x += dt * 16;
      } else {
        this.activeSpinner.scale.setScalar(1 + Math.sin(performance.now() * 0.02) * 0.14);
      }

      if (this.processTimer >= this.config.processDuration) {
        this.processTimer -= this.config.processDuration;
        this.rawQueue -= 1;
        this.processedCount += 1;
        onProduced(this.config.inputType, 1);
      }
    }

    this.outputInstanced.count = Math.min(12, this.processedCount);
    this.redrawBadge();
  }
}
