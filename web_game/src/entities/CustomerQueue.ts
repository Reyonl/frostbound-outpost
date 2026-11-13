import * as THREE from 'three';
import type { GraphicsQuality } from '../core/QualitySettings';
import type { ResourceCounts } from '../ui/HUD';
import type { AudioSynth } from '../core/AudioSynth';
import { triggerHaptic } from '../core/Haptics';
import type { CarryType, StackSystem } from '../systems/StackSystem';
import type { ParticleSystem } from '../systems/ParticleSystem';
import type { FloatingTextSystem } from '../systems/FloatingTextSystem';

interface CounterLane {
  kind: CarryType;
  counterPos: THREE.Vector3;
  dropPos: THREE.Vector3;
  cashPilePos: THREE.Vector3;
  ringMesh: THREE.Mesh;
  cashPileAmount: number;
  needed: number;
  delivered: number;
  rewardPerUnit: number;
  bubbleEl: HTMLDivElement;
  serveCooldown: number;
  magnetCooldown: number;
}

const LANE_DEFS: { kind: CarryType; x: number; icon: string; minNeed: number; maxNeed: number; pay: number }[] = [
  { kind: 'wood', x: -2.4, icon: '🪵', minNeed: 3, maxNeed: 6, pay: 6 },
  { kind: 'meat', x: 0.0, icon: '🥩', minNeed: 2, maxNeed: 4, pay: 9 },
  { kind: 'gold', x: 2.4, icon: '🪙', minNeed: 2, maxNeed: 4, pay: 12 },
];

// 6 distinct Nordic coat colors for survivors
export const SURVIVOR_COAT_COLORS = [
  0x0284c7, // Slate Teal
  0x16a34a, // Forest Green
  0xd97706, // Ochre Gold
  0x9333ea, // Plum Purple
  0x0284c7, // Sky Blue
  0xb91c1c, // Rust Crimson
];

export function computeOrderTotal(needed: number, rewardPerUnit: number): number {
  return needed * rewardPerUnit;
}

export class CustomerQueue {
  readonly lanes: CounterLane[] = [];
  readonly group = new THREE.Group();
  private readonly bubbleLayer: HTMLDivElement;
  private readonly projVec = new THREE.Vector3();
  ordersCompleted = 0;

  // Instanced Meshes for massive draw-call savings (9 NPCs + counters + bills)
  readonly counterInstancedMesh: THREE.InstancedMesh;
  readonly billInstancedMesh: THREE.InstancedMesh;
  readonly npcCoatMesh: THREE.InstancedMesh;
  readonly npcHoodMesh: THREE.InstancedMesh;
  readonly npcFaceMesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, hudRoot: HTMLElement) {
    this.group.name = 'customer_queue';
    scene.add(this.group);

    this.bubbleLayer = document.createElement('div');
    this.bubbleLayer.className = 'bubble-layer';
    hudRoot.appendChild(this.bubbleLayer);

    // 1. Instanced Counter Benches (3 lanes merged into 1 draw call)
    const benchMat = new THREE.MeshToonMaterial({ color: 0xb45309 });
    const benchGeo = new THREE.BoxGeometry(1.75, 0.72, 0.8);
    this.counterInstancedMesh = new THREE.InstancedMesh(benchGeo, benchMat, LANE_DEFS.length);
    this.counterInstancedMesh.castShadow = true;
    this.counterInstancedMesh.receiveShadow = true;

    for (let i = 0; i < LANE_DEFS.length; i++) {
      this.dummy.position.set(LANE_DEFS[i].x, 0.36, 5.0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.counterInstancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.counterInstancedMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.counterInstancedMesh);

    // 2. Instanced Cash Bills (up to 72 bills across 3 lanes merged into 1 draw call)
    const billGeo = new THREE.BoxGeometry(0.42, 0.08, 0.24);
    const billMat = new THREE.MeshToonMaterial({ color: 0x22c55e });
    this.billInstancedMesh = new THREE.InstancedMesh(billGeo, billMat, 72);
    this.billInstancedMesh.castShadow = true;
    this.billInstancedMesh.count = 0; // 0 draw calls when no bills!
    this.group.add(this.billInstancedMesh);

    // 3. Instanced Survivor NPCs (9 NPCs merged into 3 draw calls)
    const coatGeo = new THREE.CylinderGeometry(0.24, 0.34, 0.62, 8);
    const coatMat = new THREE.MeshToonMaterial({ color: 0xffffff }); // Tinted via instanceColor
    this.npcCoatMesh = new THREE.InstancedMesh(coatGeo, coatMat, 9);
    this.npcCoatMesh.castShadow = true;

    const hoodGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const hoodMat = new THREE.MeshToonMaterial({ color: 0x334155 });
    this.npcHoodMesh = new THREE.InstancedMesh(hoodGeo, hoodMat, 9);
    this.npcHoodMesh.castShadow = true;

    const faceGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const faceMat = new THREE.MeshToonMaterial({ color: 0xf6c7a6 });
    this.npcFaceMesh = new THREE.InstancedMesh(faceGeo, faceMat, 9);

    const tempCol = new THREE.Color();
    for (let i = 0; i < 9; i++) {
      tempCol.setHex(SURVIVOR_COAT_COLORS[i % SURVIVOR_COAT_COLORS.length]);
      this.npcCoatMesh.setColorAt(i, tempCol);
    }
    if (this.npcCoatMesh.instanceColor) {
      this.npcCoatMesh.instanceColor.needsUpdate = true;
    }

    this.group.add(this.npcCoatMesh, this.npcHoodMesh, this.npcFaceMesh);

    for (const def of LANE_DEFS) {
      const counterZ = 5.0;
      const dropPos = new THREE.Vector3(def.x, 0.085, counterZ - 1.35);

      const ringGeo = new THREE.RingGeometry(0.82, 1.02, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0x4ade80,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
        }),
      );
      ringMesh.position.copy(dropPos);
      this.group.add(ringMesh);

      const cashPilePos = new THREE.Vector3(def.x + 0.78, 0.08, counterZ - 0.65);

      const bubbleEl = document.createElement('div');
      bubbleEl.className = 'order-bubble';
      this.bubbleLayer.appendChild(bubbleEl);

      const need = def.minNeed + Math.floor(Math.random() * (def.maxNeed - def.minNeed + 1));
      this.lanes.push({
        kind: def.kind,
        counterPos: new THREE.Vector3(def.x, 0.8, counterZ),
        dropPos,
        cashPilePos,
        ringMesh,
        cashPileAmount: 0,
        needed: need,
        delivered: 0,
        rewardPerUnit: def.pay,
        bubbleEl,
        serveCooldown: 0,
        magnetCooldown: 0,
      });
    }
  }

  applyQuality(quality: GraphicsQuality): void {
    const isHigh = quality === 'high';
    this.npcFaceMesh.visible = isHigh;
    this.npcHoodMesh.visible = isHigh;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    camera: THREE.Camera,
    stack: StackSystem,
    baseCounts: ResourceCounts,
    particles: ParticleSystem,
    floatingText: FloatingTextSystem,
    audio: AudioSynth,
  ): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const nowTime = performance.now() * 0.005;

    let totalBills = 0;

    for (let li = 0; li < this.lanes.length; li++) {
      const lane = this.lanes[li];
      const def = LANE_DEFS[li];

      lane.serveCooldown = Math.max(0, lane.serveCooldown - dt);
      lane.magnetCooldown = Math.max(0, lane.magnetCooldown - dt);

      // Animate 3 queued survivors per lane
      for (let q = 0; q < 3; q++) {
        const npcIdx = li * 3 + q;
        const baseZ = 5.0 + 1.35 + q * 1.65;
        // Idle bob & subtle shivering motion
        const bobY = Math.abs(Math.sin(nowTime + q + li)) * 0.05;
        const shiverX = (Math.sin(nowTime * 5 + npcIdx) * 0.02) * (q === 0 ? 0.5 : 1.0);

        // Coat
        this.dummy.position.set(def.x + shiverX, 0.45 + bobY, baseZ);
        this.dummy.rotation.set(0, Math.PI, 0);
        this.dummy.updateMatrix();
        this.npcCoatMesh.setMatrixAt(npcIdx, this.dummy.matrix);

        // Hood
        this.dummy.position.set(def.x + shiverX, 0.94 + bobY, baseZ);
        this.dummy.updateMatrix();
        this.npcHoodMesh.setMatrixAt(npcIdx, this.dummy.matrix);

        // Face
        this.dummy.position.set(def.x + shiverX, 0.94 + bobY, baseZ - 0.11);
        this.dummy.updateMatrix();
        this.npcFaceMesh.setMatrixAt(npcIdx, this.dummy.matrix);
      }

      const distDrop = Math.hypot(playerPos.x - lane.dropPos.x, playerPos.z - lane.dropPos.z);
      const inDrop = distDrop <= 1.45;
      lane.ringMesh.scale.setScalar(inDrop ? 1.12 : 1.0);

      if (inDrop && lane.serveCooldown <= 0 && lane.delivered < lane.needed) {
        const fromPack = stack.popLastOf(lane.kind);
        let tookItem = Boolean(fromPack);
        if (!tookItem && baseCounts[lane.kind] > 0) {
          baseCounts[lane.kind] -= 1;
          tookItem = true;
        }

        if (tookItem) {
          lane.serveCooldown = 0.14;
          audio.playDrop();
          triggerHaptic('selection', 45);
          stack.spawnFlyingToPoint(
            lane.kind,
            playerPos.x,
            1.35,
            playerPos.z,
            lane.counterPos.x,
            0.9,
            lane.counterPos.z,
            () => {
              lane.delivered += 1;
              if (lane.delivered >= lane.needed) {
                const payout = computeOrderTotal(lane.needed, lane.rewardPerUnit);
                lane.cashPileAmount += payout;
                this.ordersCompleted += 1;
                particles.burst(lane.cashPilePos.x, 0.7, lane.cashPilePos.z, 0x22c55e, 10, 4.2, 0.9);
                floatingText.spawn(lane.counterPos.x, 2.0, lane.counterPos.z, `+$${payout}`, '#4ade80', 1.15);
                lane.delivered = 0;
                lane.needed = def.minNeed + Math.floor(Math.random() * (def.maxNeed - def.minNeed + 1));
              }
            },
          );
        }
      }

      // Magnetize cash pile bills when player steps near
      const distCash = Math.hypot(playerPos.x - lane.cashPilePos.x, playerPos.z - lane.cashPilePos.z);
      if (lane.cashPileAmount > 0 && distCash <= 2.35 && lane.magnetCooldown <= 0) {
        const chunk = Math.min(lane.cashPileAmount, 6);
        lane.cashPileAmount -= chunk;
        baseCounts.cash += chunk;
        lane.magnetCooldown = 0.065;
        audio.playCash();
        triggerHaptic('light', 45);
        particles.burst(playerPos.x, 1.3, playerPos.z, 0x4ade80, 4, 2.8, 0.65);
      }

      // Populate instanced bills for this lane
      const visibleBills = Math.min(24, Math.ceil(lane.cashPileAmount / 2));
      for (let b = 0; b < visibleBills && totalBills < 72; b++) {
        this.dummy.position.set(
          lane.cashPilePos.x + (b % 2) * 0.22 - 0.11,
          0.08 + Math.floor(b / 2) * 0.09,
          lane.cashPilePos.z,
        );
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.billInstancedMesh.setMatrixAt(totalBills, this.dummy.matrix);
        totalBills++;
      }

      // Project speech bubble over front customer
      const rem = Math.max(0, lane.needed - lane.delivered);
      lane.bubbleEl.textContent = `${def.icon} ${rem}`;
      this.projVec.set(lane.counterPos.x, 2.15, lane.counterPos.z + 1.3).project(camera);
      if (this.projVec.z > 1) {
        lane.bubbleEl.style.opacity = '0';
      } else {
        const sx = (this.projVec.x * 0.5 + 0.5) * w;
        const sy = (-this.projVec.y * 0.5 + 0.5) * h;
        lane.bubbleEl.style.opacity = '1';
        lane.bubbleEl.style.transform = `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      }
    }

    this.npcCoatMesh.instanceMatrix.needsUpdate = true;
    this.npcHoodMesh.instanceMatrix.needsUpdate = true;
    this.npcFaceMesh.instanceMatrix.needsUpdate = true;

    this.billInstancedMesh.count = totalBills;
    if (totalBills > 0) {
      this.billInstancedMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
