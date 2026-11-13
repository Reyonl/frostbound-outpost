import * as THREE from 'three';
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
    const stoneMat = new THREE.MeshToonMaterial({ color: 0x64748b });
    const bowMat = new THREE.MeshToonMaterial({ color: 0xf59e0b });

    for (const def of slotDefs) {
      const group = new THREE.Group();
      group.position.set(def.x, 0, def.z);

      const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.45, 1.15), stoneMat);
      plinth.name = 'turret_detail';
      plinth.position.y = 0.22;
      plinth.castShadow = true;
      group.add(plinth);

      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.46, 1.2, 6), baseMat);
      tower.position.y = 1.05;
      tower.castShadow = true;
      group.add(tower);

      const head = new THREE.Group();
      head.position.y = 1.75;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.85), baseMat);
      const arms = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 0.16), bowMat);
      arms.position.z = 0.26;
      head.add(body, arms);
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
