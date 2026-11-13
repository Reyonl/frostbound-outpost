import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GAME_CONFIG } from '../config/gameConfig';
import { ObjectPool } from '../core/ObjectPool';
import type { GraphicsQuality } from '../core/QualitySettings';
import type { AudioSynth } from '../core/AudioSynth';
import type { Enemy, EnemyManager } from './EnemyManager';
import type { ParticleSystem } from '../systems/ParticleSystem';
import type { FloatingTextSystem } from '../systems/FloatingTextSystem';

interface Bolt {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  damage: number;
}

export interface TurretSlot {
  id: string;
  position: { x: number; z: number };
  unlocked: boolean;
  group: THREE.Group;
  head: THREE.Group;
  cooldown: number;
}

export class TurretManager {
  readonly slots: TurretSlot[] = [];
  private readonly boltPool: ObjectPool<Bolt>;
  damageMultiplier = 1;

  constructor(scene: THREE.Scene) {
    const slotDefs = [
      { id: 'turret_nw', x: -5.4, z: -5.8, unlocked: true },
      { id: 'turret_ne', x: 5.4, z: -5.8, unlocked: false },
      { id: 'turret_sw', x: -5.8, z: 4.8, unlocked: false },
    ];

    const baseMat = new THREE.MeshToonMaterial({ color: 0x78350f });
    const bowMat = new THREE.MeshToonMaterial({ color: 0xf59e0b });

    for (const def of slotDefs) {
      const group = new THREE.Group();
      group.position.set(def.x, 0, def.z);

      // Merged static tower plinth (stone base + timber tower merged into 1 draw call)
      const plinthGeo = new THREE.BoxGeometry(1.2, 0.45, 1.2);
      plinthGeo.translate(0, 0.22, 0);
      const towerGeo = new THREE.CylinderGeometry(0.32, 0.46, 1.2, 6);
      towerGeo.translate(0, 1.05, 0);
      const mergedBaseGeo = mergeGeometries([plinthGeo, towerGeo]) || plinthGeo;
      const baseMesh = new THREE.Mesh(mergedBaseGeo, baseMat);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      group.add(baseMesh);

      // Swivel head with rotating turntable disc, tiller, recurve limbs, quiver, and taut string
      const head = new THREE.Group();
      head.position.y = 1.72;

      // 1. Swivel turntable plate disc (rotates with head!)
      const turntableGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.08, 10);
      turntableGeo.translate(0, -0.04, 0);

      // 2. Crossbow wooden stock / tiller
      const stockGeo = new THREE.BoxGeometry(0.24, 0.22, 0.95);
      stockGeo.translate(0, 0.1, -0.05);

      // 3. Side-mounted quiver
      const quiverGeo = new THREE.CylinderGeometry(0.09, 0.07, 0.54, 6);
      quiverGeo.rotateX(0.4);
      quiverGeo.translate(0.22, 0.12, -0.2);

      const mergedHeadWood = mergeGeometries([turntableGeo, stockGeo, quiverGeo]) || stockGeo;
      const headWoodMesh = new THREE.Mesh(mergedHeadWood, baseMat);
      headWoodMesh.castShadow = true;
      head.add(headWoodMesh);

      // 4. Bow recurve limbs
      const limbL = new THREE.BoxGeometry(0.62, 0.12, 0.12);
      limbL.rotateY(0.25);
      limbL.translate(-0.32, 0.12, 0.32);

      const limbR = new THREE.BoxGeometry(0.62, 0.12, 0.12);
      limbR.rotateY(-0.25);
      limbR.translate(0.32, 0.12, 0.32);

      // 5. Taut bowstring (connecting tips back to the trigger latch)
      const stringL = new THREE.CylinderGeometry(0.015, 0.015, 0.64, 4);
      stringL.rotateZ(1.15);
      stringL.translate(-0.31, 0.12, 0.21);

      const stringR = new THREE.CylinderGeometry(0.015, 0.015, 0.64, 4);
      stringR.rotateZ(-1.15);
      stringR.translate(0.31, 0.12, 0.21);

      // 6. Fletched arrows in quiver
      const arrowFletch = new THREE.BoxGeometry(0.08, 0.16, 0.08);
      arrowFletch.translate(0.22, 0.36, -0.32);

      const mergedBowGeo = mergeGeometries([limbL, limbR, stringL, stringR, arrowFletch]) || limbL;
      const bowMesh = new THREE.Mesh(mergedBowGeo, bowMat);
      bowMesh.castShadow = true;
      head.add(bowMesh);

      group.add(head);

      group.visible = def.unlocked;
      scene.add(group);
      this.slots.push({
        id: def.id,
        position: { x: def.x, z: def.z },
        unlocked: def.unlocked,
        group,
        head,
        cooldown: 0.2,
      });
    }

    const boltGeo = new THREE.BoxGeometry(0.1, 0.1, 0.55);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    this.boltPool = new ObjectPool<Bolt>(
      () => {
        const mesh = new THREE.Mesh(boltGeo, boltMat);
        mesh.visible = false;
        scene.add(mesh);
        return { mesh, x: 0, y: 1.75, z: 0, vx: 0, vz: 0, life: 0, damage: 24 };
      },
      (b) => {
        b.life = 0;
        b.mesh.visible = false;
      },
      18,
    );
  }

  unlockTurret(id: string): void {
    const slot = this.slots.find((s) => s.id === id);
    if (slot) {
      slot.unlocked = true;
      slot.group.visible = true;
    }
  }

  applyQuality(quality: GraphicsQuality): void {
    const isHigh = quality === 'high';
    for (const s of this.slots) {
      s.group.traverse((obj) => {
        if (obj.name === 'turret_detail') {
          obj.visible = isHigh;
        }
      });
    }
  }

  update(
    dt: number,
    enemyMgr: EnemyManager,
    particles: ParticleSystem,
    floatingText: FloatingTextSystem,
    audio: AudioSynth,
    onEnemyKilled: (e: Enemy) => void,
  ): void {
    for (const slot of this.slots) {
      slot.group.visible = slot.unlocked;
      if (!slot.unlocked) continue;

      slot.cooldown = Math.max(0, slot.cooldown - dt);

      let nearest: Enemy | null = null;
      let bestDist: number = GAME_CONFIG.combat.turretRange;
      for (const e of enemyMgr.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.group.position.x - slot.position.x, e.group.position.z - slot.position.z);
        if (d < bestDist) {
          bestDist = d;
          nearest = e;
        }
      }

      if (!nearest) continue;

      const dx = nearest.group.position.x - slot.position.x;
      const dz = nearest.group.position.z - slot.position.z;
      const targetYaw = Math.atan2(dx, dz);
      slot.head.rotation.y = targetYaw;

      if (slot.cooldown <= 0) {
        slot.cooldown = GAME_CONFIG.combat.turretCooldown;
        const dist = Math.hypot(dx, dz) || 1;
        const speed = 22;
        const bolt = this.boltPool.acquire();
        bolt.x = slot.position.x;
        bolt.y = 1.75;
        bolt.z = slot.position.z;
        bolt.vx = (dx / dist) * speed;
        bolt.vz = (dz / dist) * speed;
        bolt.life = 0.8;
        bolt.damage = Math.round(GAME_CONFIG.combat.turretDamage * this.damageMultiplier);
        bolt.mesh.position.set(bolt.x, bolt.y, bolt.z);
        bolt.mesh.rotation.y = targetYaw;
        bolt.mesh.visible = true;
        audio.playShoot();
      }
    }

    // Update pooled bolts
    this.boltPool.forEachActive((b) => {
      b.life -= dt;
      if (b.life <= 0) return true;

      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.mesh.position.set(b.x, b.y, b.z);

      for (const e of enemyMgr.enemies) {
        if (!e.alive) continue;
        const hitDist = Math.hypot(e.group.position.x - b.x, e.group.position.z - b.z);
        if (hitDist <= e.radius + 0.35) {
          e.hp -= b.damage;
          e.flashTimer = 0.1;
          particles.burst(b.x, 1.0, b.z, 0xf97316, 5, 3.8, 0.75);
          floatingText.spawn(e.group.position.x, 1.8, e.group.position.z, `-${b.damage}`, '#fb923c', 0.95);
          if (e.hp <= 0 && e.alive) {
            e.alive = false;
            onEnemyKilled(e);
          }
          return true;
        }
      }
      return false;
    });
  }
}
