import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GAME_CONFIG } from '../config/gameConfig';
import type { GraphicsQuality } from '../core/QualitySettings';

export type EnemyKind = 'bear' | 'wolf' | 'elite' | 'boss';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  group: THREE.Group;
  hpBarFill: THREE.Mesh;
  telegraphRing?: THREE.Mesh;
  frontLeftLeg: THREE.Mesh;
  frontRightLeg: THREE.Mesh;
  backLeftLeg: THREE.Mesh;
  backRightLeg: THREE.Mesh;
  headMesh: THREE.Mesh;
  tailMesh?: THREE.Mesh;
  outlineMesh?: THREE.Mesh;
  originalCoatHex: number;
  walkPhase: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  meatYield: number;
  cashBounty: number;
  radius: number;
  vx: number;
  vz: number;
  attackCooldown: number;
  axeHitCooldown: number;
  flashTimer: number;
  chargeTimer: number;
  charging: boolean;
  alive: boolean;
}

export class EnemyManager {
  readonly enemies: Enemy[] = [];
  private readonly scene: THREE.Scene;
  private nextId = 1;
  private spawnTimer = 2.0;
  waveLevel = 1;
  kills = 0;
  private currentQuality: GraphicsQuality = 'high';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Seed 3 initial enemies outside fort gates
    this.spawnEnemy('bear', -3.5, -11.5);
    this.spawnEnemy('bear', 4.5, -12.0);
    this.spawnEnemy('wolf', 10.5, 4.0);
  }

  applyQuality(quality: GraphicsQuality): void {
    this.currentQuality = quality;
    const isHigh = quality === 'high';
    for (const e of this.enemies) {
      if (e.outlineMesh) {
        e.outlineMesh.visible = isHigh;
      }
      e.group.traverse((obj) => {
        if (obj.name === 'enemy_detail') {
          obj.visible = isHigh;
        }
        if (obj.name === 'enemy_bar') {
          obj.visible = isHigh || e.hp < e.maxHp || e.kind === 'boss' || e.kind === 'elite';
        }
      });
    }
  }

  private buildEnemyMesh(kind: EnemyKind): {
    group: THREE.Group;
    hpBarFill: THREE.Mesh;
    telegraphRing?: THREE.Mesh;
    frontLeftLeg: THREE.Mesh;
    frontRightLeg: THREE.Mesh;
    backLeftLeg: THREE.Mesh;
    backRightLeg: THREE.Mesh;
    headMesh: THREE.Mesh;
    tailMesh?: THREE.Mesh;
    outlineMesh?: THREE.Mesh;
    originalCoatHex: number;
  } {
    const group = new THREE.Group();
    group.name = 'characters';
    const isWolf = kind === 'wolf';
    const isElite = kind === 'elite';
    const isBoss = kind === 'boss';

    const scale = isBoss ? 1.85 : isElite ? 1.32 : isWolf ? 0.82 : 1.0;
    // Distinct coloration: Bears ivory/off-white, Wolves dark slate/charcoal
    const coatHex = isBoss ? 0xf8fafc : isElite ? 0xe2e8f0 : isWolf ? 0x334155 : 0xf1f5f9;
    const coatMat = new THREE.MeshToonMaterial({ color: coatHex });
    const darkMat = new THREE.MeshToonMaterial({ color: 0x0f172a });

    let frontLeftLeg: THREE.Mesh;
    let frontRightLeg: THREE.Mesh;
    let backLeftLeg: THREE.Mesh;
    let backRightLeg: THREE.Mesh;
    let headMesh: THREE.Mesh;
    let tailMesh: THREE.Mesh | undefined;
    let outlineMesh: THREE.Mesh | undefined;

    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x090d16,
      side: THREE.BackSide,
    });

    if (isWolf) {
      // Sleek low predator body
      const bodyGeo = new THREE.BoxGeometry(0.52, 0.44, 1.25);
      const body = new THREE.Mesh(bodyGeo, coatMat);
      body.position.y = 0.48;
      body.castShadow = true;
      group.add(body);

      outlineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.5, 1.31), outlineMat);
      outlineMesh.position.y = 0.48;
      outlineMesh.visible = this.currentQuality === 'high';
      group.add(outlineMesh);

      // Lowered stalk head
      const headGeo = new THREE.BoxGeometry(0.38, 0.34, 0.48);
      headMesh = new THREE.Mesh(headGeo, coatMat);
      headMesh.position.set(0, 0.62, 0.72);
      headMesh.castShadow = true;
      group.add(headMesh);

      // Long predator muzzle
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.38), darkMat);
      snout.name = 'enemy_detail';
      snout.position.set(0, -0.06, 0.36);
      snout.visible = this.currentQuality === 'high';
      headMesh.add(snout);

      // Pointed alert wolf ears merged into 1 mesh
      const earL = new THREE.ConeGeometry(0.09, 0.24, 4);
      earL.rotateX(-0.25);
      earL.translate(-0.14, 0.22, -0.05);
      const earR = new THREE.ConeGeometry(0.09, 0.24, 4);
      earR.rotateX(-0.25);
      earR.translate(0.14, 0.22, -0.05);
      const wolfEarsGeo = mergeGeometries([earL, earR]) || earL;
      const wolfEarsMesh = new THREE.Mesh(wolfEarsGeo, darkMat);
      wolfEarsMesh.name = 'enemy_detail';
      wolfEarsMesh.visible = this.currentQuality === 'high';
      headMesh.add(wolfEarsMesh);

      // Bushy tail with pivot at base
      const tailGeo = new THREE.CylinderGeometry(0.06, 0.13, 0.62, 5);
      tailGeo.translate(0, -0.28, 0); // pivot at root
      tailMesh = new THREE.Mesh(tailGeo, coatMat);
      tailMesh.position.set(0, 0.54, -0.6);
      tailMesh.rotation.x = Math.PI * 0.24;
      group.add(tailMesh);

      // 4 articulated stalk legs
      const legGeo = new THREE.BoxGeometry(0.14, 0.42, 0.16);
      legGeo.translate(0, -0.19, 0); // pivot at hip/shoulder

      frontLeftLeg = new THREE.Mesh(legGeo, darkMat);
      frontLeftLeg.name = 'enemy_detail';
      frontLeftLeg.position.set(-0.22, 0.42, 0.45);
      frontLeftLeg.visible = this.currentQuality === 'high';
      group.add(frontLeftLeg);

      frontRightLeg = new THREE.Mesh(legGeo, darkMat);
      frontRightLeg.name = 'enemy_detail';
      frontRightLeg.position.set(0.22, 0.42, 0.45);
      frontRightLeg.visible = this.currentQuality === 'high';
      group.add(frontRightLeg);

      backLeftLeg = new THREE.Mesh(legGeo, darkMat);
      backLeftLeg.name = 'enemy_detail';
      backLeftLeg.position.set(-0.22, 0.42, -0.45);
      backLeftLeg.visible = this.currentQuality === 'high';
      group.add(backLeftLeg);

      backRightLeg = new THREE.Mesh(legGeo, darkMat);
      backRightLeg.name = 'enemy_detail';
      backRightLeg.position.set(0.22, 0.42, -0.45);
      backRightLeg.visible = this.currentQuality === 'high';
      group.add(backRightLeg);
    } else {
      // Polar Bear (heavy torso + shoulder hump merged into 1 geometry)
      const bodyBase = new THREE.BoxGeometry(0.96, 0.82, 1.48);
      bodyBase.translate(0, 0.68, 0);
      const humpGeo = new THREE.BoxGeometry(0.82, 0.28, 0.58);
      humpGeo.translate(0, 1.05, 0.22);
      const bearBodyMerged = mergeGeometries([bodyBase, humpGeo]) || bodyBase;
      const body = new THREE.Mesh(bearBodyMerged, coatMat);
      body.castShadow = true;
      group.add(body);

      outlineMesh = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.88, 1.54), outlineMat);
      outlineMesh.position.y = 0.68;
      outlineMesh.visible = this.currentQuality === 'high';
      group.add(outlineMesh);

      // Heavy bear head with neck pivot
      const headGeo = new THREE.BoxGeometry(0.64, 0.56, 0.68);
      headMesh = new THREE.Mesh(headGeo, coatMat);
      headMesh.position.set(0, 0.86, 0.84);
      headMesh.castShadow = true;
      group.add(headMesh);

      // Dark snout with black nose tip
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), darkMat);
      snout.name = 'enemy_detail';
      snout.position.set(0, -0.08, 0.42);
      snout.visible = this.currentQuality === 'high';
      headMesh.add(snout);

      // Rounded bear ears merged into 1 mesh
      const earMat = isElite || isBoss ? new THREE.MeshToonMaterial({ color: 0xdc2626 }) : coatMat;
      const earGeoL = isElite || isBoss ? new THREE.ConeGeometry(0.12, 0.42, 5) : new THREE.SphereGeometry(0.13, 6, 6);
      earGeoL.translate(-0.26, 0.32, -0.06);
      const earGeoR = isElite || isBoss ? new THREE.ConeGeometry(0.12, 0.42, 5) : new THREE.SphereGeometry(0.13, 6, 6);
      earGeoR.translate(0.26, 0.32, -0.06);
      const bearEarsGeo = mergeGeometries([earGeoL, earGeoR]) || earGeoL;
      const earsMesh = new THREE.Mesh(bearEarsGeo, earMat);
      earsMesh.name = 'enemy_detail';
      earsMesh.visible = this.currentQuality === 'high';
      headMesh.add(earsMesh);

      // 4 heavy articulated bear paws/legs
      const legGeo = new THREE.BoxGeometry(0.26, 0.46, 0.28);
      legGeo.translate(0, -0.21, 0); // pivot at hip/shoulder

      frontLeftLeg = new THREE.Mesh(legGeo, coatMat);
      frontLeftLeg.name = 'enemy_detail';
      frontLeftLeg.position.set(-0.35, 0.48, 0.48);
      frontLeftLeg.castShadow = true;
      frontLeftLeg.visible = this.currentQuality === 'high';
      group.add(frontLeftLeg);

      frontRightLeg = new THREE.Mesh(legGeo, coatMat);
      frontRightLeg.name = 'enemy_detail';
      frontRightLeg.position.set(0.35, 0.48, 0.48);
      frontRightLeg.castShadow = true;
      frontRightLeg.visible = this.currentQuality === 'high';
      group.add(frontRightLeg);

      backLeftLeg = new THREE.Mesh(legGeo, coatMat);
      backLeftLeg.name = 'enemy_detail';
      backLeftLeg.position.set(-0.35, 0.48, -0.48);
      backLeftLeg.castShadow = true;
      backLeftLeg.visible = this.currentQuality === 'high';
      group.add(backLeftLeg);

      backRightLeg = new THREE.Mesh(legGeo, coatMat);
      backRightLeg.name = 'enemy_detail';
      backRightLeg.position.set(0.35, 0.48, -0.48);
      backRightLeg.castShadow = true;
      backRightLeg.visible = this.currentQuality === 'high';
      group.add(backRightLeg);
    }

    group.scale.setScalar(scale);

    // World HP bar
    const barBg = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.13, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x0f172a }),
    );
    barBg.name = 'enemy_bar';
    barBg.position.set(0, 1.55, 0);
    barBg.visible = this.currentQuality === 'high' || isBoss || isElite;
    group.add(barBg);

    const hpBarFill = new THREE.Mesh(
      new THREE.BoxGeometry(1.08, 0.08, 0.08),
      new THREE.MeshBasicMaterial({ color: isBoss || isElite ? 0xf59e0b : 0xef4444 }),
    );
    hpBarFill.name = 'enemy_bar';
    hpBarFill.position.set(0, 1.55, 0.01);
    hpBarFill.visible = this.currentQuality === 'high' || isBoss || isElite;
    group.add(hpBarFill);

    let telegraphRing: THREE.Mesh | undefined;
    if (isElite || isBoss) {
      telegraphRing = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1.35, 24),
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
        }),
      );
      telegraphRing.position.y = 0.08;
      group.add(telegraphRing);
    }

    this.scene.add(group);
    return {
      group,
      hpBarFill,
      telegraphRing,
      frontLeftLeg,
      frontRightLeg,
      backLeftLeg,
      backRightLeg,
      headMesh,
      tailMesh,
      outlineMesh,
      originalCoatHex: coatHex,
    };
  }

  spawnEnemy(kind: EnemyKind, x: number, z: number): Enemy {
    const meshData = this.buildEnemyMesh(kind);
    meshData.group.position.set(x, 0, z);

    const waveScale = 1 + (this.waveLevel - 1) * 0.22;
    let maxHp = GAME_CONFIG.combat.bearHp * waveScale;
    let speed: number = GAME_CONFIG.combat.bearSpeed;
    let damage: number = GAME_CONFIG.combat.bearDamage;
    let meatYield = 2;
    let cashBounty = 5;
    let radius = 0.85;

    if (kind === 'wolf') {
      maxHp = GAME_CONFIG.combat.wolfHp * waveScale;
      speed = GAME_CONFIG.combat.wolfSpeed;
      damage = GAME_CONFIG.combat.wolfDamage;
      meatYield = 1;
      cashBounty = 4;
      radius = 0.65;
    } else if (kind === 'elite') {
      maxHp = GAME_CONFIG.combat.bearHp * 2.3 * waveScale;
      speed = GAME_CONFIG.combat.bearSpeed * 1.18;
      damage = GAME_CONFIG.combat.bearDamage * 1.5;
      meatYield = 4;
      cashBounty = 16;
      radius = 1.1;
    } else if (kind === 'boss') {
      maxHp = GAME_CONFIG.combat.bossHp * waveScale;
      speed = GAME_CONFIG.combat.bearSpeed * 0.92;
      damage = GAME_CONFIG.combat.bearDamage * 2.1;
      meatYield = 8;
      cashBounty = 45;
      radius = 1.45;
    }

    const enemy: Enemy = {
      id: this.nextId++,
      kind,
      group: meshData.group,
      hpBarFill: meshData.hpBarFill,
      telegraphRing: meshData.telegraphRing,
      frontLeftLeg: meshData.frontLeftLeg,
      frontRightLeg: meshData.frontRightLeg,
      backLeftLeg: meshData.backLeftLeg,
      backRightLeg: meshData.backRightLeg,
      headMesh: meshData.headMesh,
      tailMesh: meshData.tailMesh,
      outlineMesh: meshData.outlineMesh,
      originalCoatHex: meshData.originalCoatHex,
      walkPhase: Math.random() * Math.PI * 2,
      hp: maxHp,
      maxHp,
      speed,
      damage,
      meatYield,
      cashBounty,
      radius,
      vx: 0,
      vz: 0,
      attackCooldown: 0,
      axeHitCooldown: 0,
      flashTimer: 0,
      chargeTimer: 0,
      charging: false,
      alive: true,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    blizzardActive: boolean,
    onAttackPlayer: (damage: number) => void,
    onAttackGate: (damage: number) => void,
  ): void {
    // Spawn pacing
    this.spawnTimer -= dt;
    const maxActive = Math.min(8, 3 + Math.floor(this.waveLevel * 0.8));
    if (this.spawnTimer <= 0 && this.enemies.filter((e) => e.alive).length < maxActive) {
      this.spawnTimer = Math.max(2.4, 5.0 - this.waveLevel * 0.35);
      const angle = Math.random() * Math.PI * 2;
      const dist = GAME_CONFIG.world.baseRadius + 5.5 + Math.random() * 8;
      const ex = Math.cos(angle) * dist;
      const ez = Math.sin(angle) * dist;
      const isWolf = Math.random() < 0.45;
      this.spawnEnemy(isWolf ? 'wolf' : 'bear', ex, ez);
    }

    const speedBuff = blizzardActive ? 1.25 : 1.0;
    const baseR = GAME_CONFIG.world.baseRadius;

    for (const e of this.enemies) {
      if (!e.alive) continue;

      e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      e.axeHitCooldown = Math.max(0, e.axeHitCooldown - dt);

      // Hit flash restore
      if (e.flashTimer > 0) {
        e.flashTimer = Math.max(0, e.flashTimer - dt);
        if (e.flashTimer === 0) {
          e.group.traverse((c) => {
            if ((c as THREE.Mesh).isMesh && c !== e.hpBarFill && c !== e.telegraphRing && c !== e.outlineMesh) {
              const m = (c as THREE.Mesh).material as THREE.MeshToonMaterial;
              if (m && 'color' in m) {
                m.color.setHex(e.originalCoatHex);
              }
            }
          });
        }
      }

      // Target selection: player if outside or near gate, otherwise gate
      const distPlayer = Math.hypot(playerPos.x - e.group.position.x, playerPos.z - e.group.position.z);
      const distFromCenter = Math.hypot(e.group.position.x, e.group.position.z);

      let targetX = playerPos.x;
      let targetZ = playerPos.z;

      // If player is deep inside base, enemies converge on nearest gate entrance
      if (distFromCenter > baseR + 0.4 && Math.hypot(playerPos.x, playerPos.z) < baseR - 1.2) {
        targetX = 0;
        targetZ = e.group.position.z > 0 ? baseR : -baseR;
      }

      const dx = targetX - e.group.position.x;
      const dz = targetZ - e.group.position.z;
      const d = Math.hypot(dx, dz) || 1;

      // Charge attack for Elite & Boss
      if (e.kind === 'elite' || e.kind === 'boss') {
        e.chargeTimer += dt;
        if (e.chargeTimer >= 4.2 && !e.charging) {
          e.charging = true;
          e.chargeTimer = 0;
          if (e.telegraphRing) {
            (e.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0.75;
          }
        }
      }

      const curSpeed = (e.charging ? e.speed * 2.1 : e.speed) * speedBuff;
      e.vx = (dx / d) * curSpeed;
      e.vz = (dz / d) * curSpeed;

      e.group.position.x += e.vx * dt;
      e.group.position.z += e.vz * dt;
      e.group.rotation.y = Math.atan2(e.vx, e.vz);

      // Walk cycle animation: 4-leg articulated trot + head sway
      e.walkPhase += dt * (curSpeed * 5.2);
      const legSwing = Math.sin(e.walkPhase) * 0.58;

      e.frontLeftLeg.rotation.x = legSwing;
      e.backRightLeg.rotation.x = legSwing;
      e.frontRightLeg.rotation.x = -legSwing;
      e.backLeftLeg.rotation.x = -legSwing;

      // Head sway
      e.headMesh.rotation.y = Math.sin(e.walkPhase * 0.6) * 0.14;
      e.headMesh.rotation.z = Math.cos(e.walkPhase * 0.6) * 0.06;

      // Wolf tail wagging motion
      if (e.tailMesh) {
        e.tailMesh.rotation.y = Math.sin(e.walkPhase * 2.0) * 0.42;
        e.tailMesh.rotation.x = Math.PI * 0.24 + Math.sin(e.walkPhase) * 0.12;
      }

      // Attack player check
      if (distPlayer <= e.radius + 0.55 && e.attackCooldown <= 0) {
        e.attackCooldown = 0.95;
        onAttackPlayer(e.damage);
        if (e.charging) {
          e.charging = false;
          if (e.telegraphRing) {
            (e.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0.0;
          }
        }
      }

      // Attack gate if close to perimeter and blocked
      if (Math.abs(distFromCenter - baseR) < 0.8 && e.attackCooldown <= 0 && distPlayer > 2.8) {
        e.attackCooldown = 1.1;
        onAttackGate(e.damage * 0.75);
      }

      // Update HP bar visual
      const ratio = Math.max(0.01, e.hp / Math.max(1, e.maxHp));
      e.hpBarFill.scale.x = ratio;
      e.hpBarFill.position.x = -(1 - ratio) * 0.54;
    }
  }

  takeDamage(
    enemy: Enemy,
    damage: number,
    onDied: (e: Enemy) => void,
  ): boolean {
    if (!enemy.alive) return false;

    enemy.hp = Math.max(0, enemy.hp - damage);
    if (this.currentQuality === 'low') {
      enemy.group.traverse((obj) => {
        if (obj.name === 'enemy_bar') obj.visible = true;
      });
    }
    enemy.flashTimer = 0.14;

    // White hit flash
    enemy.group.traverse((c) => {
      if ((c as THREE.Mesh).isMesh && c !== enemy.hpBarFill && c !== enemy.telegraphRing && c !== enemy.outlineMesh) {
        const m = (c as THREE.Mesh).material as THREE.MeshToonMaterial;
        if (m && 'color' in m) {
          m.color.setHex(0xffffff);
        }
      }
    });

    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.kills += 1;
      this.scene.remove(enemy.group);
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) {
        this.enemies.splice(idx, 1);
      }
      onDied(enemy);
      return true;
    }
    return false;
  }
}
