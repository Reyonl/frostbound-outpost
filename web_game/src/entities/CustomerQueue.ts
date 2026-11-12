import * as THREE from 'three';
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
  billMeshes: THREE.Mesh[];
  cashPileAmount: number;
  needed: number;
  delivered: number;
  rewardPerUnit: number;
  queueMeshes: THREE.Group[];
  bubbleEl: HTMLDivElement;
  serveCooldown: number;
  magnetCooldown: number;
}

const LANE_DEFS: { kind: CarryType; x: number; icon: string; minNeed: number; maxNeed: number; pay: number }[] = [
  { kind: 'wood', x: -2.4, icon: '🪵', minNeed: 3, maxNeed: 6, pay: 6 },
  { kind: 'meat', x: 0.0, icon: '🥩', minNeed: 2, maxNeed: 4, pay: 9 },
  { kind: 'gold', x: 2.4, icon: '🪙', minNeed: 2, maxNeed: 4, pay: 12 },
];

export function computeOrderTotal(needed: number, rewardPerUnit: number): number {
  return needed * rewardPerUnit;
}

export class CustomerQueue {
  readonly lanes: CounterLane[] = [];
  private readonly bubbleLayer: HTMLDivElement;
  private readonly projVec = new THREE.Vector3();
  ordersCompleted = 0;

  constructor(scene: THREE.Scene, hudRoot: HTMLElement) {
    this.bubbleLayer = document.createElement('div');
    this.bubbleLayer.className = 'bubble-layer';
    hudRoot.appendChild(this.bubbleLayer);

    const benchMat = new THREE.MeshToonMaterial({ color: 0xb45309 });
    const billGeo = new THREE.BoxGeometry(0.42, 0.08, 0.24);
    const billMat = new THREE.MeshToonMaterial({ color: 0x22c55e });

    for (const def of LANE_DEFS) {
      const counterZ = 5.0;
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.72, 0.8), benchMat);
      counter.position.set(def.x, 0.36, counterZ);
      counter.castShadow = true;
      counter.receiveShadow = true;
      scene.add(counter);

      // Delivery ring on player side of counter (inside base)
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
      scene.add(ringMesh);

      // Cash stack pile just beside the delivery ring
      const cashPilePos = new THREE.Vector3(def.x + 0.78, 0.08, counterZ - 0.65);
      const billMeshes: THREE.Mesh[] = [];
      for (let b = 0; b < 24; b++) {
        const bill = new THREE.Mesh(billGeo, billMat);
        bill.position.set(
          cashPilePos.x + (b % 2) * 0.22 - 0.11,
          0.08 + Math.floor(b / 2) * 0.09,
          cashPilePos.z,
        );
        bill.visible = false;
        bill.castShadow = true;
        scene.add(bill);
        billMeshes.push(bill);
      }

      // 3 queued survivor NPCs waiting outside counter along southern snow road
      const queueMeshes: THREE.Group[] = [];
      for (let q = 0; q < 3; q++) {
        const npc = this.buildNpcMesh(q);
        npc.position.set(def.x, 0, counterZ + 1.35 + q * 1.65);
        npc.rotation.y = Math.PI; // Facing counter/north
        scene.add(npc);
        queueMeshes.push(npc);
      }

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
        billMeshes,
        cashPileAmount: 0,
        needed: need,
        delivered: 0,
        rewardPerUnit: def.pay,
        queueMeshes,
        bubbleEl,
        serveCooldown: 0,
        magnetCooldown: 0,
      });
    }
  }

  private buildNpcMesh(variant: number): THREE.Group {
    const g = new THREE.Group();
    const coatHex = variant % 2 === 0 ? 0x0284c7 : 0x0ea5e9;
    const coat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.34, 0.62, 8),
      new THREE.MeshToonMaterial({ color: coatHex }),
    );
    coat.position.y = 0.45;
    coat.castShadow = true;
    g.add(coat);

    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshToonMaterial({ color: 0x38bdf8 }),
    );
    hood.position.y = 0.94;
    hood.castShadow = true;
    g.add(hood);

    const face = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshToonMaterial({ color: 0xf6c7a6 }),
    );
    face.position.set(0, 0.94, 0.11);
    g.add(face);
    return g;
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

    for (let li = 0; li < this.lanes.length; li++) {
      const lane = this.lanes[li];
      const def = LANE_DEFS[li];

      lane.serveCooldown = Math.max(0, lane.serveCooldown - dt);
      lane.magnetCooldown = Math.max(0, lane.magnetCooldown - dt);

      // Gentle idle bob on queued survivors
      for (let q = 0; q < lane.queueMeshes.length; q++) {
        lane.queueMeshes[q].position.y = Math.abs(Math.sin(performance.now() * 0.004 + q + li)) * 0.06;
      }

      const distDrop = Math.hypot(playerPos.x - lane.dropPos.x, playerPos.z - lane.dropPos.z);
      const inDrop = distDrop <= 1.45;
      lane.ringMesh.scale.setScalar(inDrop ? 1.12 : 1.0);

      if (inDrop && lane.serveCooldown <= 0 && lane.delivered < lane.needed) {
        // Pull from backpack first, otherwise from base processed stockpile
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

      const visibleBills = Math.min(lane.billMeshes.length, Math.ceil(lane.cashPileAmount / 2));
      for (let b = 0; b < lane.billMeshes.length; b++) {
        lane.billMeshes[b].visible = b < visibleBills;
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
  }
}
