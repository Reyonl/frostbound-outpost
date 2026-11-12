import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig';

export class EnvironmentSystem {
  private readonly snowPoints: THREE.Points;
  private readonly positions: Float32Array;
  private readonly speeds: Float32Array;
  private readonly count = GAME_CONFIG.snow.flakeCount;
  private readonly areaW = GAME_CONFIG.snow.areaWidth;
  private readonly areaH = GAME_CONFIG.snow.areaHeight;

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(this.count * 3);
    this.speeds = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * this.areaW;
      this.positions[i * 3 + 1] = Math.random() * this.areaH;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * this.areaW;
      this.speeds[i] = 0.75 + Math.random() * 0.65;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.19,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    this.snowPoints = new THREE.Points(geo, mat);
    scene.add(this.snowPoints);
  }

  update(dt: number, focusX: number, focusZ: number, windScale = 1): void {
    const half = this.areaW * 0.5;
    const fall = GAME_CONFIG.snow.fallSpeed * (0.9 + windScale * 0.35);
    const wind = GAME_CONFIG.snow.windX * windScale;

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      const sp = this.speeds[i];

      let x = this.positions[idx] + wind * sp * dt;
      let y = this.positions[idx + 1] - fall * sp * dt;
      let z = this.positions[idx + 2] + 0.35 * sp * dt;

      if (y < 0.1) {
        y = this.areaH;
        x = focusX + (Math.random() - 0.5) * this.areaW;
        z = focusZ + (Math.random() - 0.5) * this.areaW;
      }

      // Wrap flakes around focus volume so snow stays dense wherever player walks
      if (x - focusX > half) x -= this.areaW;
      else if (x - focusX < -half) x += this.areaW;

      if (z - focusZ > half) z -= this.areaW;
      else if (z - focusZ < -half) z += this.areaW;

      this.positions[idx] = x;
      this.positions[idx + 1] = y;
      this.positions[idx + 2] = z;
    }

    (this.snowPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
