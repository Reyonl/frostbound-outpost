import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig';
import type { GraphicsQuality } from '../core/QualitySettings';

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
  private currentQuality: GraphicsQuality = 'high';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Seed 3 initial bears just north/east outside base so action is immediately visible
    this.spawnEnemy('bear', -3.5, -11.5);
    this.spawnEnemy('bear', 4.5, -12.0);
    this.spawnEnemy('wolf', 10.5, 4.0);
  }

  applyQuality(quality: GraphicsQuality): void {
    this.currentQuality = quality;
    const isHigh = quality === 'high';
    for (const e of this.enemies) {
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
  } {
    const group = new THREE.Group();
    group.name = 'characters';
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
    snout.name = 'enemy_detail';
    snout.position.set(0, 0.72, 1.16);
    snout.visible = this.currentQuality === 'high';
    group.add(snout);

    // Ears or horns for elite/boss
    const earMat = isElite || isBoss ? new THREE.MeshToonMaterial({ color: 0xdc2626 }) : coatMat;
    const earGeo = isElite || isBoss ? new THREE.ConeGeometry(0.12, 0.42, 5) : new THREE.BoxGeometry(0.16, 0.16, 0.12);
    for (const sx of [-0.24, 0.24]) {
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.name = 'enemy_detail';
      ear.position.set(sx, 1.15, 0.76);
      ear.visible = this.currentQuality === 'high';
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
      leg.name = 'enemy_detail';
      leg.position.set(lx, 0.2, lz);
      leg.castShadow = true;
      leg.visible = this.currentQuality === 'high';
      group.add(leg);
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
      if (e.flashTimer > 0) {
        e.flashTimer = Math.max(0, e.flashTimer - dt);
        if (e.flashTimer === 0) {
          e.group.traverse((c) => {
            if ((c as THREE.Mesh).isMesh && c !== e.hpBarFill && c !== e.telegraphRing) {
              const m = (c as THREE.Mesh).material as THREE.MeshToonMaterial;
              if (m && 'color' in m) {
                const hex = e.kind === 'wolf' ? 0x94a3b8 : e.kind === 'boss' ? 0xf1f5f9 : 0xf8fafc;
                m.color.setHex(hex);
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
        // Nearest gate (South or North)
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
    enemy.flashTimer = 0.12;

    // Red hit flash
    enemy.group.traverse((c) => {
      if ((c as THREE.Mesh).isMesh && c !== enemy.hpBarFill && c !== enemy.telegraphRing) {
        const m = (c as THREE.Mesh).material as THREE.MeshToonMaterial;
        if (m && 'color' in m) {
          m.color.setHex(0xef4444);
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
