import * as THREE from 'three';
import type { AudioSynth } from '../core/AudioSynth';
import { triggerHaptic } from '../core/Haptics';
import type { FloatingTextSystem } from './FloatingTextSystem';
import type { ParticleSystem } from './ParticleSystem';

export type RandomEventKind = 'supply_drop' | 'aurora';

export class RandomEventSystem {
  private readonly crateGroup = new THREE.Group();
  private crateActive = false;
  private cratePos = new THREE.Vector3();
  private eventTimer = 26;
  auroraTimer = 0;

  constructor(scene: THREE.Scene) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.95, 0.95),
      new THREE.MeshToonMaterial({ color: 0xf59e0b }),
    );
    crate.position.y = 0.5;
    crate.castShadow = true;
    this.crateGroup.add(crate);

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.35, 3.2, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.42 }),
    );
    beacon.position.y = 1.9;
    this.crateGroup.add(beacon);

    this.crateGroup.visible = false;
    scene.add(this.crateGroup);
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    particles: ParticleSystem,
    floatingText: FloatingTextSystem,
    audio: AudioSynth,
    onSupplyReward: (cash: number, wood: number) => void,
    onEventBanner: (msg: string) => void,
  ): void {
    if (this.auroraTimer > 0) {
      this.auroraTimer = Math.max(0, this.auroraTimer - dt);
    }

    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this.eventTimer = 34;
      if (!this.crateActive && Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        this.cratePos.set(Math.cos(a) * 9.5, 0, Math.sin(a) * 9.5);
        this.crateGroup.position.copy(this.cratePos);
        this.crateActive = true;
        this.crateGroup.visible = true;
        onEventBanner('SUPPLY DROP LANDED!');
      } else {
        this.auroraTimer = 12;
        onEventBanner('AURORA BONUS: +45% SPIN SPEED!');
      }
    }

    if (this.crateActive) {
      this.crateGroup.rotation.y += dt * 1.4;
      const dist = Math.hypot(playerPos.x - this.cratePos.x, playerPos.z - this.cratePos.z);
      if (dist <= 1.55) {
        this.crateActive = false;
        this.crateGroup.visible = false;
        audio.playUnlock();
        triggerHaptic('medium', 80);
        particles.burst(this.cratePos.x, 1.1, this.cratePos.z, 0xf59e0b, 14, 5.0, 1.0);
        floatingText.spawn(this.cratePos.x, 2.0, this.cratePos.z, '+$25 +4 WOOD', '#fbbf24', 1.15);
        onSupplyReward(25, 4);
      }
    }
  }
}
