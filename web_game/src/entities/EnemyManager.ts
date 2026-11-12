import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig';

export type EnemyKind = 'bear' | 'wolf' | 'elite' | 'boss';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  group: THREE.Group;
  hpBarFill: THREE.Mesh;
  telegraphRing?: THREE.Mesh;
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

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Seed 3 initial bears just north/east outside base so action is immediately visible
    this.spawnEnemy('bear', -3.5, -11.5);
    this.spawnEnemy('bear', 4.5, -12.0);
    this.spawnEnemy('wolf', 10.5, 4.0);
  }

  private buildEnemyMesh(kind: EnemyKind): {
    group: THREE.Group;
    hpBarFill: THREE.Mesh;
    telegraphRing?: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const isWolf = kind === 'wolf';
    const isElite = kind === 'elite';
    const isBoss = kind === 'boss';

    const scale = isBoss ? 1.85 : isElite ? 1.32 : isWolf ? 0.82 : 1.0;
    const coatHex = isBoss ? 0xf1f5f9 : isElite ? 0xe2e8f0 : isWolf ? 0x94a3b8 : 0xf8fafc;
    const coatMat = new THREE.MeshToonMaterial({ color: coatHex });
    const darkMat = new THREE.MeshToonMaterial({ color: 0x1e293b });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.78, 1.45), coatMat);
    body.position.y = 0.62;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.56, 0.62), coatMat);
    head.position.set(0, 0.82, 0.82);
    head.castShadow = true;
    group.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.28), darkMat);
    snout.position.set(0, 0.72, 1.16);
    group.add(snout);

    // Ears or horns for elite/boss
    const earMat = isElite || isBoss ? new THREE.MeshToonMaterial({ color: 0xdc2626 }) : coatMat;
    const earGeo = isElite || isBoss ? new THREE.ConeGeometry(0.12, 0.42, 5) : new THREE.BoxGeometry(0.16, 0.16, 0.12);
    for (const sx of [-0.24, 0.24]) {
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(sx, 1.15, 0.76);
      group.add(ear);
    }

    // 4 stubby legs
    const legGeo = new THREE.BoxGeometry(0.24, 0.4, 0.24);
    for (const [lx, lz] of [
      [-0.32, 0.46],
      [0.32, 0.46],
      [-0.32, -0.46],
      [0.32, -0.46],
    ]) {
      const leg = new THREE.Mesh(legGeo, coatMat);
      leg.position.set(lx, 0.2, lz);
      leg.castShadow = true;
      group.add(leg);
    }

    group.scale.setScalar(scale);

    // World HP bar
    const barBg = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.13, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x0f172a }),
    );
    barBg.position.set(0, 1.55, 0);
    group.add(barBg);

    const hpBarFill = new THREE.Mesh(
      new THREE.BoxGeometry(1.08, 0.08, 0.08),
      new THREE.MeshBasicMaterial({ color: isBoss || isElite ? 0xf59e0b : 0xef4444 }),
    );
    hpBarFill.position.set(0, 1.55, 0.01);
    group.add(hpBarFill);

    let telegraphRing: THREE.Mesh | undefined;
    if (isElite || isBoss) {
      const ringGeo = new THREE.RingGeometry(0.95, 1.22, 24);
      ringGeo.rotateX(-Math.PI / 2);
      telegraphRing = new THREE.Mesh(
        ringGeo,
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
    return { group, hpBarFill, telegraphRing };
  }

  spawnEnemy(kind: EnemyKind, x: number, z: number): Enemy {
    const { group, hpBarFill, telegraphRing } = this.buildEnemyMesh(kind);
    group.position.set(x, 0, z);

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
      group,
      hpBarFill,
      telegraphRing,
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
      chargeTimer: 3.5,
      charging: false,
      alive: true,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  spawnWavePerimeter(isBlizzard = false): void {
    const aliveCount = this.enemies.length;
    const cap = isBlizzard ? 11 : 7;
    if (aliveCount >= cap) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 16 + Math.random() * 8;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;

    const roll = Math.random();
    const kind: EnemyKind =
      roll < 0.16 && this.waveLevel >= 2 ? 'elite' : roll < 0.48 ? 'wolf' : 'bear';
    this.spawnEnemy(kind, x, z);
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    isBlizzard: boolean,
    onAttackPlayer: (dmg: number) => void,
    onAttackGate: (dmg: number) => void,
  ): void {
    this.spawnTimer -= dt * (isBlizzard ? 1.7 : 1.0);
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(2.2, 5.2 - this.waveLevel * 0.35);
      this.spawnWavePerimeter(isBlizzard);
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) {
        this.scene.remove(e.group);
        this.enemies.splice(i, 1);
        continue;
      }

      if (e.axeHitCooldown > 0) e.axeHitCooldown = Math.max(0, e.axeHitCooldown - dt);
      if (e.attackCooldown > 0) e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      if (e.flashTimer > 0) {
        e.flashTimer = Math.max(0, e.flashTimer - dt);
        const s = e.kind === 'boss' ? 1.85 : e.kind === 'elite' ? 1.32 : e.kind === 'wolf' ? 0.82 : 1;
        e.group.scale.setScalar(s * (e.flashTimer > 0 ? 1.12 : 1));
      }

      const distPlayer = Math.hypot(playerPos.x - e.group.position.x, playerPos.z - e.group.position.z);
      const distCenter = Math.hypot(e.group.position.x, e.group.position.z);

      // Telegraph lunge for Elite & Boss enemies
      let moveMult = 1;
      if (e.telegraphRing && (e.kind === 'elite' || e.kind === 'boss')) {
        e.chargeTimer -= dt;
        const mat = e.telegraphRing.material as THREE.MeshBasicMaterial;
        if (e.chargeTimer <= 1.0 && e.chargeTimer > 0) {
          e.charging = true;
          moveMult = 0.2;
          mat.opacity = 0.72;
          e.telegraphRing.scale.setScalar(1 + (1 - e.chargeTimer) * 0.55);
        } else if (e.chargeTimer <= 0) {
          e.charging = false;
          moveMult = 2.6;
          mat.opacity = 0;
          if (e.chargeTimer <= -0.45) {
            e.chargeTimer = 4.2;
          }
        } else {
          mat.opacity = 0;
        }
      }

      // Target player if within aggro radius (11m), otherwise pressure base palisade gate
      const targetX = distPlayer < 11 ? playerPos.x : 0;
      const targetZ = distPlayer < 11 ? playerPos.z : -GAME_CONFIG.world.baseRadius;
      const dx = targetX - e.group.position.x;
      const dz = targetZ - e.group.position.z;
      const d = Math.hypot(dx, dz) || 1;

      if (d > e.radius + 0.55) {
        e.group.position.x += ((dx / d) * e.speed * moveMult + e.vx) * dt;
        e.group.position.z += ((dz / d) * e.speed * moveMult + e.vz) * dt;
        e.group.rotation.y = Math.atan2(dx, dz);
      }

      // Knockback decay
      e.vx *= Math.exp(-9 * dt);
      e.vz *= Math.exp(-9 * dt);

      // Prevent enemies from walking through solid base perimeter except if close to gate
      const newDistCenter = Math.hypot(e.group.position.x, e.group.position.z);
      if (newDistCenter < GAME_CONFIG.world.baseRadius + 0.35 && distCenter >= GAME_CONFIG.world.baseRadius - 0.1) {
        if (e.attackCooldown <= 0) {
          e.attackCooldown = 1.1;
          onAttackGate(e.damage * 0.65);
        }
      }

      if (distPlayer <= e.radius + 0.7 && e.attackCooldown <= 0) {
        e.attackCooldown = 1.05;
        onAttackPlayer(e.damage);
      }

      const ratio = Math.max(0.02, e.hp / e.maxHp);
      e.hpBarFill.scale.x = ratio;
      e.hpBarFill.position.x = -(1 - ratio) * 0.54;
    }
  }
}
