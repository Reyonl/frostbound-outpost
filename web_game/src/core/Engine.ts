import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig';

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly sunLight: THREE.DirectionalLight;
  readonly hemiLight: THREE.HemisphereLight;
  readonly fog: THREE.FogExp2;

  private readonly targetLook = new THREE.Vector3();
  private readonly desiredCamPos = new THREE.Vector3();
  private readonly shakeOffset = new THREE.Vector3();
  private shakeIntensity = 0;
  private extraZoom = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(GAME_CONFIG.world.fogColor);
    this.fog = new THREE.FogExp2(GAME_CONFIG.world.fogColor, GAME_CONFIG.world.fogDensity);
    this.scene.fog = this.fog;

    const aspect = Math.max(window.innerWidth, 1) / Math.max(window.innerHeight, 1);
    this.camera = new THREE.PerspectiveCamera(GAME_CONFIG.camera.fov, aspect, 0.5, 110);
    this.camera.position.set(
      GAME_CONFIG.camera.offset.x,
      GAME_CONFIG.camera.offset.y,
      GAME_CONFIG.camera.offset.z,
    );
    this.camera.lookAt(0, 0, 0);

    this.hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x7aa2c9, 1.05);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e4, 1.55);
    this.sunLight.position.set(14, 24, 12);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 65;
    const shadowBound = 22;
    this.sunLight.shadow.camera.left = -shadowBound;
    this.sunLight.shadow.camera.right = shadowBound;
    this.sunLight.shadow.camera.top = shadowBound;
    this.sunLight.shadow.camera.bottom = -shadowBound;
    this.sunLight.shadow.bias = -0.0008;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.buildTerrain();
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  }

  private buildTerrain(): void {
    const size = GAME_CONFIG.world.halfSize * 2.5;
    const snowGeo = new THREE.PlaneGeometry(size, size, 36, 36);
    snowGeo.rotateX(-Math.PI / 2);

    // Subtle low-poly snow undulation outside the central outpost clearing
    const pos = snowGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.hypot(x, z);
      if (dist > GAME_CONFIG.world.baseRadius + 1.5) {
        const wave = Math.sin(x * 0.25) * Math.cos(z * 0.25) * 0.35;
        const rim = Math.max(0, dist - GAME_CONFIG.world.halfSize) * 0.25;
        pos.setY(i, wave + rim);
      }
    }
    snowGeo.computeVertexNormals();

    const snowMat = new THREE.MeshToonMaterial({
      color: GAME_CONFIG.world.snowColor,
    });
    const ground = new THREE.Mesh(snowGeo, snowMat);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Packed warm dirt clearing inside the base perimeter
    const basePadGeo = new THREE.CylinderGeometry(
      GAME_CONFIG.world.baseRadius - 0.3,
      GAME_CONFIG.world.baseRadius,
      0.08,
      24,
    );
    const basePadMat = new THREE.MeshToonMaterial({
      color: GAME_CONFIG.world.trailColor,
    });
    const basePad = new THREE.Mesh(basePadGeo, basePadMat);
    basePad.position.y = 0.02;
    basePad.receiveShadow = true;
    this.scene.add(basePad);

    // Southern entrance snow path leading from base gate
    const pathGeo = new THREE.BoxGeometry(3.2, 0.05, 11);
    const pathMesh = new THREE.Mesh(pathGeo, basePadMat);
    pathMesh.position.set(0, 0.015, GAME_CONFIG.world.baseRadius + 3.8);
    pathMesh.receiveShadow = true;
    this.scene.add(pathMesh);

    // Decorative arctic boulders near outer corners
    const rockGeo = new THREE.DodecahedronGeometry(1.15, 0);
    const rockMat = new THREE.MeshToonMaterial({ color: 0x64748b });
    const rockSpots: [number, number, number][] = [
      [-14, -12, 1.4],
      [15, -14, 1.2],
      [-18, 10, 1.5],
      [17, 13, 1.1],
      [8.5, 12, 0.85],
      [-9.5, -6, 0.75],
    ];
    for (const [rx, rz, scale] of rockSpots) {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(rx, 0.45 * scale, rz);
      rock.scale.set(scale * 1.2, scale * 0.75, scale);
      rock.rotation.set(0.2, rx * 0.5, 0.15);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }
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
    const lookX = focusPos.x + moveDirX * GAME_CONFIG.camera.lookAhead;
    const lookZ = focusPos.z + moveDirZ * GAME_CONFIG.camera.lookAhead;

    this.targetLook.lerp(new THREE.Vector3(lookX, 0.8, lookZ), 1 - Math.exp(-GAME_CONFIG.camera.followLerp * dt));

    this.desiredCamPos.set(
      this.targetLook.x + GAME_CONFIG.camera.offset.x * zoomScale,
      GAME_CONFIG.camera.offset.y * zoomScale,
      this.targetLook.z + GAME_CONFIG.camera.offset.z * zoomScale,
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

    // Keep directional shadow frustum centered near the player
    this.sunLight.position.set(this.targetLook.x + 14, 24, this.targetLook.z + 12);
    this.sunLight.target.position.copy(this.targetLook);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  readonly handleResize = (): void => {
    const w = Math.max(window.innerWidth, 1);
    const h = Math.max(window.innerHeight, 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}
