import * as THREE from 'three';

interface Footprint {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export class FootprintSystem {
  private readonly scene: THREE.Scene;
  private readonly pool: Footprint[] = [];
  private poolIdx = 0;
  private enabled = true;

  constructor(scene: THREE.Scene, capacity = 36) {
    this.scene = scene;

    // Create a tiny soft oval canvas texture for footprints
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 24, 2, 16, 24, 15);
      grad.addColorStop(0, 'rgba(80, 110, 140, 0.55)');
      grad.addColorStop(0.7, 'rgba(100, 130, 160, 0.28)');
      grad.addColorStop(1, 'rgba(120, 150, 180, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(16, 24, 10, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);

    const geo = new THREE.PlaneGeometry(0.22, 0.36);
    geo.rotateX(-Math.PI / 2);

    for (let i = 0; i < capacity; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.position.set(0, -100, 0); // Hide initially
      mesh.renderOrder = 1;
      this.scene.add(mesh);
      this.pool.push({ mesh, life: 0, maxLife: 3.5 });
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      for (const fp of this.pool) {
        fp.life = 0;
        fp.mesh.visible = false;
        fp.mesh.position.y = -100;
        (fp.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  }

  spawnStep(x: number, z: number, yaw: number, isRightFoot: boolean): void {
    if (!this.enabled) return;

    const fp = this.pool[this.poolIdx];
    this.poolIdx = (this.poolIdx + 1) % this.pool.length;

    // Offset slightly left or right of the movement direction
    const sideOffset = isRightFoot ? 0.12 : -0.12;
    const perpYaw = yaw + Math.PI / 2;
    const posX = x + Math.sin(perpYaw) * sideOffset;
    const posZ = z + Math.cos(perpYaw) * sideOffset;

    fp.mesh.visible = true;
    fp.mesh.position.set(posX, 0.015, posZ);
    fp.mesh.rotation.set(0, yaw, 0);
    fp.maxLife = 3.5;
    fp.life = fp.maxLife;
    (fp.mesh.material as THREE.MeshBasicMaterial).opacity = 0.42;
  }

  update(dt: number): void {
    if (!this.enabled) return;

    for (const fp of this.pool) {
      if (fp.life > 0) {
        fp.life -= dt;
        if (fp.life <= 0) {
          fp.life = 0;
          fp.mesh.visible = false;
          fp.mesh.position.y = -100;
          (fp.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
        } else {
          const ratio = fp.life / fp.maxLife;
          (fp.mesh.material as THREE.MeshBasicMaterial).opacity = ratio * 0.42;
        }
      }
    }
  }
}
