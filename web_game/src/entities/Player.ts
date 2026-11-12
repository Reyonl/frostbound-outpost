import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig';
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

  private walkPhase = 0;
  private facingYaw = 0;
  speedMultiplier = 1;

  constructor(scene: THREE.Scene) {
    const c = GAME_CONFIG.player.colors;
    const parkaMat = new THREE.MeshToonMaterial({ color: c.parka });
    const darkMat = new THREE.MeshToonMaterial({ color: c.parkaDark });
    const furMat = new THREE.MeshToonMaterial({ color: c.furTrim });
    const skinMat = new THREE.MeshToonMaterial({ color: c.skin });
    const bootMat = new THREE.MeshToonMaterial({ color: c.boots });

    // Ground selection ring
    const ringGeo = new THREE.RingGeometry(0.58, 0.72, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: c.ring,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    this.groundRing = new THREE.Mesh(ringGeo, ringMat);
    this.groundRing.position.y = 0.05;
    this.group.add(this.groundRing);

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.11, 0.22, 4, 8);
    this.leftLeg = new THREE.Mesh(legGeo, bootMat);
    this.leftLeg.position.set(-0.16, 0.24, 0);
    this.leftLeg.castShadow = true;
    this.bodyGroup.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, bootMat);
    this.rightLeg.position.set(0.16, 0.24, 0);
    this.rightLeg.castShadow = true;
    this.bodyGroup.add(this.rightLeg);

    // Parka torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.72, 10), parkaMat);
    torso.position.y = 0.72;
    torso.castShadow = true;
    this.bodyGroup.add(torso);

    // White fur trim hem & collar
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.44, 0.1, 10), furMat);
    hem.position.y = 0.4;
    this.bodyGroup.add(hem);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 6, 12), furMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.08;
    this.bodyGroup.add(collar);

    // Backpack frame (where stack sits in M2)
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.22), darkMat);
    pack.position.set(0, 0.76, -0.34);
    pack.castShadow = true;
    this.bodyGroup.add(pack);

    // Head & fur-lined hood
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), parkaMat);
    hood.position.set(0, 1.32, -0.02);
    hood.castShadow = true;
    this.bodyGroup.add(hood);

    const face = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skinMat);
    face.position.set(0, 1.31, 0.14);
    this.bodyGroup.add(face);

    const goggles = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.11, 0.1),
      new THREE.MeshToonMaterial({ color: 0x0f172a }),
    );
    goggles.position.set(0, 1.38, 0.3);
    this.bodyGroup.add(goggles);

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.09, 0.28, 4, 8);
    this.leftArm = new THREE.Mesh(armGeo, darkMat);
    this.leftArm.position.set(-0.42, 0.8, 0);
    this.leftArm.castShadow = true;
    this.bodyGroup.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, darkMat);
    this.rightArm.position.set(0.42, 0.8, 0);
    this.rightArm.castShadow = true;
    this.bodyGroup.add(this.rightArm);

    this.group.add(this.bodyGroup);
    this.group.position.set(0, 0, 2.2);
    scene.add(this.group);
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

    if (move.magnitude > 0.05) {
      const targetYaw = Math.atan2(move.x, move.z);
      let diff = targetYaw - this.facingYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facingYaw += diff * Math.min(1, 14 * dt);
      this.bodyGroup.rotation.y = this.facingYaw;

      this.walkPhase += dt * (8 + move.magnitude * 6);
      const swing = Math.sin(this.walkPhase) * 0.55;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.7;
      this.rightArm.rotation.x = swing * 0.7;
      this.bodyGroup.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.08;
      this.bodyGroup.rotation.z = -move.x * 0.06;
    } else {
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
      this.leftArm.rotation.x *= 0.8;
      this.rightArm.rotation.x *= 0.8;
      this.bodyGroup.position.y *= 0.8;
      this.bodyGroup.rotation.z *= 0.8;
    }
  }
}
