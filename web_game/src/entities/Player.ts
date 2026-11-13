import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GAME_CONFIG } from '../config/gameConfig';
import type { GraphicsQuality } from '../core/QualitySettings';
import type { MoveVector } from '../systems/InputSystem';

export class Player {
  readonly group = new THREE.Group();
  readonly bodyGroup = new THREE.Group();
  readonly position = this.group.position;

  private readonly leftLeg: THREE.Mesh;
  private readonly rightLeg: THREE.Mesh;
  private readonly leftArm: THREE.Mesh;
  private readonly rightArm: THREE.Mesh;
  private readonly groundRing: THREE.Mesh;
  private readonly scarfTail1: THREE.Mesh;
  private readonly scarfTail2: THREE.Mesh;
  private hem!: THREE.Mesh;
  private collar!: THREE.Mesh;
  private goggles!: THREE.Mesh;
  private outlineMesh!: THREE.Mesh;
  private scarfCollar!: THREE.Mesh;

  private walkPhase = 0;
  private facingYaw = 0;
  private wasMoving = false;
  private squashFactor = 0;
  speedMultiplier = 1;

  constructor(scene: THREE.Scene) {
    // Distinct vibrant orange-red parka (#ea580c) for high visibility against snow
    const parkaMat = new THREE.MeshToonMaterial({ color: 0xea580c });
    const darkMat = new THREE.MeshToonMaterial({ color: 0x9a3412 });
    const furMat = new THREE.MeshToonMaterial({ color: 0xf8fafc });
    const skinMat = new THREE.MeshToonMaterial({ color: 0xfcd34d });
    const bootMat = new THREE.MeshToonMaterial({ color: 0x451a03 });
    const scarfMat = new THREE.MeshToonMaterial({ color: 0xf59e0b });

    // Ground selection ring
    const ringGeo = new THREE.RingGeometry(0.58, 0.74, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    this.groundRing = new THREE.Mesh(ringGeo, ringMat);
    this.groundRing.position.y = 0.05;
    this.group.add(this.groundRing);

    // Legs with articulated pivots
    const legGeo = new THREE.CapsuleGeometry(0.12, 0.24, 4, 8);
    this.leftLeg = new THREE.Mesh(legGeo, bootMat);
    this.leftLeg.position.set(-0.17, 0.24, 0);
    this.leftLeg.castShadow = true;
    this.bodyGroup.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, bootMat);
    this.rightLeg.position.set(0.17, 0.24, 0);
    this.rightLeg.castShadow = true;
    this.bodyGroup.add(this.rightLeg);

    // Parka torso
    const torsoGeo = new THREE.CylinderGeometry(0.33, 0.44, 0.74, 10);
    const torso = new THREE.Mesh(torsoGeo, parkaMat);
    torso.position.y = 0.72;
    torso.castShadow = true;
    this.bodyGroup.add(torso);

    // Inverted hull toon outline for sharp silhouette against bright snow
    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x090d16,
      side: THREE.BackSide,
    });
    const outlineGeo = new THREE.CylinderGeometry(0.36, 0.48, 0.77, 10);
    this.outlineMesh = new THREE.Mesh(outlineGeo, outlineMat);
    this.outlineMesh.position.y = 0.72;
    this.bodyGroup.add(this.outlineMesh);

    // White fur trim hem & collar
    this.hem = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.46, 0.11, 10), furMat);
    this.hem.position.y = 0.39;
    this.bodyGroup.add(this.hem);

    this.collar = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.08, 6, 12), furMat);
    this.collar.rotation.x = Math.PI / 2;
    this.collar.position.y = 1.07;
    this.bodyGroup.add(this.collar);

    // Warm golden knitted scarf around neck
    this.scarfCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.12, 10),
      scarfMat,
    );
    this.scarfCollar.position.y = 1.04;
    this.bodyGroup.add(this.scarfCollar);

    // Animated trailing scarf ribbons
    const scarfTailGeo = new THREE.BoxGeometry(0.13, 0.32, 0.05);
    scarfTailGeo.translate(0, -0.14, 0); // pivot at top
    this.scarfTail1 = new THREE.Mesh(scarfTailGeo, scarfMat);
    this.scarfTail1.position.set(0.11, 1.04, -0.32);
    this.bodyGroup.add(this.scarfTail1);

    const scarfTail2Geo = new THREE.BoxGeometry(0.11, 0.26, 0.05);
    scarfTail2Geo.translate(0, -0.11, 0);
    this.scarfTail2 = new THREE.Mesh(scarfTail2Geo, scarfMat);
    this.scarfTail2.position.set(-0.09, 1.06, -0.31);
    this.bodyGroup.add(this.scarfTail2);

    // Backpack frame
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.24), darkMat);
    pack.position.set(0, 0.76, -0.36);
    pack.castShadow = true;
    this.bodyGroup.add(pack);

    // Head & fur-lined hood
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 8), parkaMat);
    hood.position.set(0, 1.33, -0.02);
    hood.castShadow = true;
    this.bodyGroup.add(hood);

    const face = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), skinMat);
    face.position.set(0, 1.32, 0.14);
    this.bodyGroup.add(face);

    this.goggles = new THREE.Mesh(
      new THREE.BoxGeometry(0.33, 0.12, 0.11),
      new THREE.MeshToonMaterial({ color: 0x0f172a }),
    );
    this.goggles.position.set(0, 1.38, 0.31);
    this.bodyGroup.add(this.goggles);

    // Arms with integrated mitten geometry (merged to minimize draw calls)
    const armPart = new THREE.CapsuleGeometry(0.09, 0.28, 4, 8);
    armPart.translate(0, -0.12, 0); // pivot at shoulder
    const mittenPart = new THREE.SphereGeometry(0.11, 6, 6);
    mittenPart.translate(0, -0.28, 0.04);
    const fullArmGeo = mergeGeometries([armPart, mittenPart]) || armPart;

    this.leftArm = new THREE.Mesh(fullArmGeo, darkMat);
    this.leftArm.position.set(-0.43, 0.95, 0);
    this.leftArm.castShadow = true;
    this.bodyGroup.add(this.leftArm);

    this.rightArm = new THREE.Mesh(fullArmGeo, darkMat);
    this.rightArm.position.set(0.43, 0.95, 0);
    this.rightArm.castShadow = true;
    this.bodyGroup.add(this.rightArm);

    this.group.add(this.bodyGroup);
    this.group.position.set(0, 0, 2.2);
    scene.add(this.group);
  }

  applyQuality(quality: GraphicsQuality): void {
    const isHigh = quality === 'high';
    if (this.hem) this.hem.visible = isHigh;
    if (this.collar) this.collar.visible = isHigh;
    if (this.goggles) this.goggles.visible = isHigh;
    if (this.groundRing) this.groundRing.visible = isHigh;
    if (this.outlineMesh) this.outlineMesh.visible = isHigh;
    if (this.scarfTail1) this.scarfTail1.visible = isHigh;
    if (this.scarfTail2) this.scarfTail2.visible = isHigh;
    if (this.scarfCollar) this.scarfCollar.visible = isHigh;
  }

  update(move: MoveVector, dt: number): void {
    const speed = GAME_CONFIG.player.moveSpeed * this.speedMultiplier;
    const vx = move.x * speed;
    const vz = move.z * speed;

    this.position.x += vx * dt;
    this.position.z += vz * dt;

    // Clamp inside snowy arena bounds
    const limit = GAME_CONFIG.world.halfSize - 1.5;
    this.position.x = Math.max(-limit, Math.min(limit, this.position.x));
    this.position.z = Math.max(-limit, Math.min(limit, this.position.z));

    const isMoving = move.magnitude > 0.05;

    // Squash-and-stretch on stop transition
    if (this.wasMoving && !isMoving) {
      this.squashFactor = 0.32;
    }
    this.wasMoving = isMoving;

    if (isMoving) {
      const targetYaw = Math.atan2(move.x, move.z);
      let diff = targetYaw - this.facingYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facingYaw += diff * Math.min(1, 15 * dt);
      this.bodyGroup.rotation.y = this.facingYaw;

      // Dynamic walk cycle cadence based on movement speed
      this.walkPhase += dt * (9 + move.magnitude * 6);
      const swing = Math.sin(this.walkPhase) * 0.72;

      // Arm swing alternating with legs
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.88;
      this.rightArm.rotation.x = swing * 0.88;

      // Vertical walk bob
      this.bodyGroup.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.12;

      // Lean into the movement direction: forward lean + lateral banking
      this.bodyGroup.rotation.x = move.magnitude * 0.22;
      this.bodyGroup.rotation.z = -move.x * 0.14;

      // Scarf ribbon fluttering dynamically in wind
      const tailSwing = Math.sin(this.walkPhase * 2) * 0.28;
      this.scarfTail1.rotation.x = Math.PI * 0.42 + tailSwing;
      this.scarfTail1.rotation.y = Math.sin(this.walkPhase * 1.6) * 0.24;

      this.scarfTail2.rotation.x = Math.PI * 0.46 + Math.cos(this.walkPhase * 2) * 0.26;
      this.scarfTail2.rotation.y = -Math.cos(this.walkPhase * 1.6) * 0.22;
    } else {
      // Smooth decay towards resting idle
      this.leftLeg.rotation.x *= Math.exp(-12 * dt);
      this.rightLeg.rotation.x *= Math.exp(-12 * dt);
      this.leftArm.rotation.x *= Math.exp(-12 * dt);
      this.rightArm.rotation.x *= Math.exp(-12 * dt);
      this.bodyGroup.position.y *= Math.exp(-10 * dt);
      this.bodyGroup.rotation.x *= Math.exp(-10 * dt);
      this.bodyGroup.rotation.z *= Math.exp(-10 * dt);

      // Gentle resting scarf sway
      const idleTime = performance.now() * 0.003;
      this.scarfTail1.rotation.x = 0.12 + Math.sin(idleTime) * 0.08;
      this.scarfTail1.rotation.y = Math.sin(idleTime * 0.8) * 0.06;
      this.scarfTail2.rotation.x = 0.16 + Math.cos(idleTime * 1.1) * 0.07;
      this.scarfTail2.rotation.y = -Math.cos(idleTime * 0.9) * 0.05;
    }

    // Apply squash and stretch decay
    if (this.squashFactor > 0.001) {
      this.squashFactor *= Math.exp(-14 * dt);
      const sy = 1 - this.squashFactor * 0.42;
      const sxz = 1 + this.squashFactor * 0.25;
      this.bodyGroup.scale.set(sxz, sy, sxz);
    } else {
      this.bodyGroup.scale.set(1, 1, 1);
    }
  }
}
