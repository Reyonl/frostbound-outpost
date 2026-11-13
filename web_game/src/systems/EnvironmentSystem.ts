import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig';

export class EnvironmentSystem {
  private readonly snowPoints: THREE.Points;
  private readonly positions: Float32Array;
  private readonly speeds: Float32Array;
  private readonly count = GAME_CONFIG.snow.flakeCount;
  private readonly areaW = GAME_CONFIG.snow.areaWidth;
  private readonly areaH = GAME_CONFIG.snow.areaHeight;

  private readonly daySky = new THREE.Color(0xdbeeff);
  private readonly duskSky = new THREE.Color(0x6488b8);
  private readonly nightSky = new THREE.Color(0x0f1f3d);
  private readonly blizzardSky = new THREE.Color(0x9cb8d6);
  private readonly workColor = new THREE.Color();

  cycleTime = 0;
  dayCount = 1;
  blizzardTimer = GAME_CONFIG.survival.blizzardInterval;
  blizzardActive = false;
  blizzardRemaining = 0;

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
    this.snowPoints.name = 'particles_snow';
    scene.add(this.snowPoints);
  }

  updateAtmosphere(
    dt: number,
    scene: THREE.Scene,
    fog: THREE.FogExp2,
    sunLight: THREE.DirectionalLight,
    hemiLight: THREE.HemisphereLight,
    auroraActive: boolean,
    onBlizzardStart?: () => void,
  ): void {
    const dayDur = GAME_CONFIG.survival.dayDurationSeconds;
    this.cycleTime += dt;
    if (this.cycleTime >= dayDur) {
      this.cycleTime -= dayDur;
      this.dayCount += 1;
    }

    if (this.blizzardActive) {
      this.blizzardRemaining -= dt;
      if (this.blizzardRemaining <= 0) {
        this.blizzardActive = false;
        this.blizzardTimer = GAME_CONFIG.survival.blizzardInterval;
      }
    } else {
      this.blizzardTimer -= dt;
      if (this.blizzardTimer <= 0) {
        this.blizzardActive = true;
        this.blizzardRemaining = GAME_CONFIG.survival.blizzardDuration;
        onBlizzardStart?.();
      }
    }

    // Smooth day/night curve: 0..0.55 day, 0.55..0.72 dusk, 0.72..0.95 night, 0.95..1 dawn
    const phase = this.cycleTime / dayDur;
    let nightFactor = 0;
    if (phase > 0.5 && phase < 0.85) {
      nightFactor = Math.sin(((phase - 0.5) / 0.35) * Math.PI);
    }

    if (nightFactor < 0.5) {
      this.workColor.copy(this.daySky).lerp(this.duskSky, nightFactor * 2);
    } else {
      this.workColor.copy(this.duskSky).lerp(this.nightSky, (nightFactor - 0.5) * 2);
    }

    if (this.blizzardActive) {
      this.workColor.lerp(this.blizzardSky, 0.55);
    } else if (auroraActive) {
      this.workColor.lerp(new THREE.Color(0x1e5c6b), 0.35);
    }

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(this.workColor);
    }
    fog.color.copy(this.workColor);
    fog.density = this.blizzardActive ? 0.032 : GAME_CONFIG.world.fogDensity + nightFactor * 0.006;

    sunLight.intensity = Math.max(0.45, 1.55 - nightFactor * 0.95 - (this.blizzardActive ? 0.25 : 0));
    hemiLight.intensity = Math.max(0.55, 1.05 - nightFactor * 0.45);
  }

  update(dt: number, focusX: number, focusZ: number): void {
    const windScale = this.blizzardActive ? 3.2 : 1.0;
    const half = this.areaW * 0.5;
    const fall = GAME_CONFIG.snow.fallSpeed * (0.9 + windScale * 0.3);
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
