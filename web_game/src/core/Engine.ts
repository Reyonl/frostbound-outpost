import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig';
import { FootprintSystem } from './FootprintSystem';
import type { GraphicsQuality } from './QualitySettings';

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly sunLight: THREE.DirectionalLight;
  readonly hemiLight: THREE.HemisphereLight;
  readonly rimLight: THREE.DirectionalLight;
  readonly fog: THREE.FogExp2;
  readonly footprints: FootprintSystem;

  private readonly targetLook = new THREE.Vector3();
  private readonly desiredCamPos = new THREE.Vector3();
  private readonly shakeOffset = new THREE.Vector3();
  private shakeIntensity = 0;
  private extraZoom = 0;
  private aspectFactor = 1.0;
  private currentQuality: GraphicsQuality = 'high';
  private rockMesh!: THREE.InstancedMesh;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(GAME_CONFIG.world.fogColor);
    this.fog = new THREE.FogExp2(GAME_CONFIG.world.fogColor, GAME_CONFIG.world.fogDensity);
    this.scene.fog = this.fog;

    const aspect = Math.max(window.innerWidth, 1) / Math.max(window.innerHeight, 1);
    this.camera = new THREE.PerspectiveCamera(GAME_CONFIG.camera.fov, aspect, 0.5, 130);
    this.updateAspectFactor(aspect);

    // Three-point lighting + subtle icy rim light
    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x64748b, 0.95);
    this.scene.add(this.hemiLight);

    // Warm sun key directional light
    this.sunLight = new THREE.DirectionalLight(0xfff2dc, 1.65);
    this.sunLight.position.set(16, 26, 14);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 70;
    const shadowBound = 22;
    this.sunLight.shadow.camera.left = -shadowBound;
    this.sunLight.shadow.camera.right = shadowBound;
    this.sunLight.shadow.camera.top = shadowBound;
    this.sunLight.shadow.camera.bottom = -shadowBound;
    this.sunLight.shadow.bias = -0.0006;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Cool rim light from opposing quadrant for character/edge separation
    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    this.rimLight.position.set(-16, 18, -14);
    this.rimLight.castShadow = false;
    this.scene.add(this.rimLight);

    this.buildAtmosphereDome();
    this.buildTerrain();
    this.footprints = new FootprintSystem(this.scene);

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  }

  get quality(): GraphicsQuality {
    return this.currentQuality;
  }

  applyQuality(quality: GraphicsQuality): void {
    this.currentQuality = quality;
    if (quality === 'high') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.footprints.setEnabled(true);
      if (this.rockMesh) this.rockMesh.visible = true;
    } else {
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
      this.footprints.setEnabled(false);
      if (this.rockMesh) this.rockMesh.visible = false;
    }
    if (this.sunLight.shadow.map) {
      this.sunLight.shadow.map.dispose();
      (this.sunLight.shadow as unknown as { map: null }).map = null;
    }
  }

  private updateAspectFactor(aspect: number): void {
    const baseline = 0.62;
    this.aspectFactor = Math.max(1.0, Math.min(1.42, Math.sqrt(baseline / Math.max(aspect, 0.35))));
  }

  private buildAtmosphereDome(): void {
    const domeGeo = new THREE.SphereGeometry(75, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    domeGeo.scale(-1, 1, 1);

    const count = domeGeo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const horizonColor = new THREE.Color(GAME_CONFIG.world.fogColor);
    const zenithColor = new THREE.Color(0x507ea8);
    const col = new THREE.Color();

    const pos = domeGeo.attributes.position;
    for (let i = 0; i < count; i++) {
      const y = pos.getY(i);
      const t = Math.max(0, Math.min(1, y / 55));
      col.copy(horizonColor).lerp(zenithColor, t * t);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    domeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const domeMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = -2;
    this.scene.add(dome);
  }

  private buildTerrain(): void {
    const size = GAME_CONFIG.world.halfSize * 2.6;
    const segments = 56;
    const terrainGeo = new THREE.PlaneGeometry(size, size, segments, segments);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const count = pos.count;
    const colors = new Float32Array(count * 3);

    const dirtColor = new THREE.Color(0xb07646);
    const dirtDark = new THREE.Color(0x8a542b);
    const snowColor = new THREE.Color(0xf2f7fc);
    const snowShadow = new THREE.Color(0xd7e6f5);
    const col = new THREE.Color();

    const baseR = GAME_CONFIG.world.baseRadius;

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.hypot(x, z);

      let height = 0;
      if (dist < baseR - 0.7) {
        height = 0;
      } else if (dist <= baseR + 1.2) {
        const isSouthGate = z > baseR * 0.82 && Math.abs(x) < 2.2;
        const isNorthGate = z < -baseR * 0.82 && Math.abs(x) < 2.2;
        const isEastGap = x > baseR * 0.82 && Math.abs(z) < 2.4;
        if (!isSouthGate && !isNorthGate && !isEastGap) {
          const moundT = Math.sin(((dist - (baseR - 0.7)) / 1.9) * Math.PI);
          height = moundT * 0.32;
        }
      } else {
        const drift1 = Math.sin(x * 0.16 + z * 0.14) * 0.38;
        const drift2 = Math.cos(x * 0.26 - z * 0.22) * 0.24;
        const rim = Math.max(0, dist - GAME_CONFIG.world.halfSize) * 0.35;
        height = drift1 + drift2 + rim;
      }
      pos.setY(i, height);

      const isSouthTrail = z >= baseR - 1.2 && z <= baseR + 8.5 && Math.abs(x) < 2.1;

      if (dist < baseR - 1.8) {
        const varT = (Math.sin(x * 1.5) * Math.cos(z * 1.5) + 1) * 0.5;
        col.copy(dirtColor).lerp(dirtDark, varT * 0.35);
      } else if (dist <= baseR + 0.4) {
        const t = (dist - (baseR - 1.8)) / (baseR + 0.4 - (baseR - 1.8));
        const smoothT = t * t * (3 - 2 * t);
        col.copy(dirtColor).lerp(snowColor, smoothT);
      } else if (isSouthTrail) {
        const trailFade = (z - (baseR + 0.4)) / 8.0;
        const edgeFade = Math.abs(x) / 2.1;
        const dirtRatio = Math.max(0, (1 - trailFade) * (1 - edgeFade * 0.8));
        col.copy(snowColor).lerp(dirtColor, dirtRatio * 0.75);
      } else {
        const shade = Math.max(0, Math.min(1, (height + 0.5) / 1.2));
        col.copy(snowShadow).lerp(snowColor, shade);
      }

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshToonMaterial({
      vertexColors: true,
    });
    const ground = new THREE.Mesh(terrainGeo, terrainMat);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Decorative arctic boulders merged into InstancedMesh (saves 10 draw calls)
    const rockGeo = new THREE.DodecahedronGeometry(1.2, 0);
    const rockMat = new THREE.MeshToonMaterial({ color: 0x5b6b82 });
    const rockSpots: [number, number, number][] = [
      [-14.5, -12.5, 1.45],
      [15.5, -14.0, 1.3],
      [-18.2, 10.5, 1.55],
      [17.5, 13.5, 1.2],
      [8.8, 12.2, 0.9],
      [-9.8, -6.5, 0.8],
    ];
    this.rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockSpots.length);
    this.rockMesh.castShadow = true;
    this.rockMesh.receiveShadow = true;
    const dummyRock = new THREE.Object3D();
    for (let i = 0; i < rockSpots.length; i++) {
      const [rx, rz, scale] = rockSpots[i];
      dummyRock.position.set(rx, 0.48 * scale, rz);
      dummyRock.scale.set(scale * 1.25, scale * 0.78, scale);
      dummyRock.rotation.set(0.2, rx * 0.5, 0.15);
      dummyRock.updateMatrix();
      this.rockMesh.setMatrixAt(i, dummyRock.matrix);
    }
    this.rockMesh.instanceMatrix.needsUpdate = true;
    this.rockMesh.visible = this.currentQuality === 'high';
    this.scene.add(this.rockMesh);
  }

  addShake(amount: number): void {
    this.shakeIntensity = Math.min(0.65, this.shakeIntensity + amount);
  }

  setStackZoom(stackCount: number): void {
    const target = Math.min(
      GAME_CONFIG.camera.maxExtraZoom,
      stackCount * GAME_CONFIG.camera.zoomPerStackItem,
    );
    this.extraZoom += (target - this.extraZoom) * 0.1;
  }

  updateCamera(
    focusPos: THREE.Vector3,
    moveDirX: number,
    moveDirZ: number,
    dt: number,
  ): void {
    const zoomScale = 1 + this.extraZoom * 0.055;
    const aspectMult = this.aspectFactor;
    const lookX = focusPos.x + moveDirX * GAME_CONFIG.camera.lookAhead;
    const lookZ = focusPos.z + moveDirZ * GAME_CONFIG.camera.lookAhead;

    this.targetLook.lerp(new THREE.Vector3(lookX, 0.8, lookZ), 1 - Math.exp(-GAME_CONFIG.camera.followLerp * dt));

    this.desiredCamPos.set(
      this.targetLook.x + GAME_CONFIG.camera.offset.x * zoomScale * aspectMult,
      GAME_CONFIG.camera.offset.y * zoomScale * aspectMult,
      this.targetLook.z + GAME_CONFIG.camera.offset.z * zoomScale * aspectMult,
    );

    if (this.shakeIntensity > 0.002) {
      this.shakeOffset.set(
        (Math.random() - 0.5) * this.shakeIntensity,
        (Math.random() - 0.5) * this.shakeIntensity * 0.5,
        (Math.random() - 0.5) * this.shakeIntensity,
      );
      this.shakeIntensity *= Math.exp(-12 * dt);
    } else {
      this.shakeOffset.set(0, 0, 0);
      this.shakeIntensity = 0;
    }

    this.camera.position.copy(this.desiredCamPos).add(this.shakeOffset);
    this.camera.lookAt(this.targetLook);

    this.sunLight.position.set(this.targetLook.x + 16, 26, this.targetLook.z + 14);
    this.sunLight.target.position.copy(this.targetLook);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  readonly handleResize = (): void => {
    const w = Math.max(window.innerWidth, 1);
    const h = Math.max(window.innerHeight, 1);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.updateAspectFactor(aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}
