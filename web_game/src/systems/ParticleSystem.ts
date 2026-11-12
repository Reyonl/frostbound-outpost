import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool';

interface ParticleItem {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  rot: number;
}

const MAX_PARTICLES = 180;

export class ParticleSystem {
  private readonly instanced: THREE.InstancedMesh;
  private readonly pool: ObjectPool<ParticleItem>;
  private readonly activeList: ParticleItem[] = [];
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff });
    this.instanced = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instanced.count = 0;
    this.instanced.frustumCulled = false;

    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.instanced.setColorAt(i, white);
    }
    scene.add(this.instanced);

    this.pool = new ObjectPool<ParticleItem>(
      () => ({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        size: 1,
        color: new THREE.Color(0xffffff),
        rot: 0,
      }),
      (p) => {
        p.life = 0;
        p.vx = 0;
        p.vy = 0;
        p.vz = 0;
      },
      90,
    );
  }

  burst(x: number, y: number, z: number, colorHex: number, count = 8, speed = 4.5, size = 1): void {
    for (let i = 0; i < count; i++) {
      if (this.activeList.length >= MAX_PARTICLES) break;
      const p = this.pool.acquire();
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.75);
      p.x = x + (Math.random() - 0.5) * 0.3;
      p.y = y + Math.random() * 0.3;
      p.z = z + (Math.random() - 0.5) * 0.3;
      p.vx = Math.cos(angle) * spd;
      p.vy = 2.4 + Math.random() * 3.8;
      p.vz = Math.sin(angle) * spd;
      p.maxLife = 0.28 + Math.random() * 0.28;
      p.life = p.maxLife;
      p.size = size * (0.75 + Math.random() * 0.6);
      p.color.setHex(colorHex);
      p.rot = Math.random() * Math.PI;
      this.activeList.push(p);
    }
  }

  update(dt: number): void {
    let writeIdx = 0;
    for (let i = this.activeList.length - 1; i >= 0; i--) {
      const p = this.activeList[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.activeList.splice(i, 1);
        this.pool.release(p);
        continue;
      }

      p.vy -= 14.5 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.06, p.y + p.vy * dt);
      p.z += p.vz * dt;
      p.rot += dt * 7;

      const s = p.size * Math.max(0.05, p.life / p.maxLife);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.rot, p.rot * 0.7, 0);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.instanced.setMatrixAt(writeIdx, this.dummy.matrix);
      this.instanced.setColorAt(writeIdx, p.color);
      writeIdx++;
    }

    this.instanced.count = writeIdx;
    if (writeIdx > 0) {
      this.instanced.instanceMatrix.needsUpdate = true;
      if (this.instanced.instanceColor) {
        this.instanced.instanceColor.needsUpdate = true;
      }
    }
  }
}
