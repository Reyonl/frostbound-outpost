import * as THREE from 'three';
import { GAME_CONFIG, type ResourceType } from '../config/gameConfig';
import { ObjectPool } from '../core/ObjectPool';

export type CarryType = Exclude<ResourceType, 'cash'>;

interface FlyingLoot {
  active: boolean;
  kind: CarryType;
  startX: number;
  startY: number;
  startZ: number;
  targetType: 'player' | 'point';
  targetX: number;
  targetY: number;
  targetZ: number;
  progress: number;
  duration: number;
  onArrive?: () => void;
}

const MAX_STACK_VISUALS = 64;
const MAX_FLYING = 48;

const STACK_COLORS: Record<CarryType, number> = {
  wood: 0x9a5b2e,
  meat: 0xef5350,
  gold: 0xfacc15,
};

export function canAcceptCarryItem(currentCount: number, maxCapacity: number): boolean {
  return currentCount < maxCapacity;
}

export class StackSystem {
  readonly items: CarryType[] = [];
  maxCapacity: number = GAME_CONFIG.player.baseCarryCapacity;

  private readonly stackMeshes: THREE.Mesh[] = [];
  private readonly stackGroup = new THREE.Group();
  private readonly dummyColor = new THREE.Color();

  private readonly flyingPool: ObjectPool<FlyingLoot>;
  private readonly flyingMeshes: Map<FlyingLoot, THREE.Mesh> = new Map();
  private readonly scene: THREE.Scene;

  private swayX = 0;
  private swayZ = 0;
  private velSwayX = 0;
  private velSwayZ = 0;
  private prevPlayerX = 0;
  private prevPlayerZ = 0;
  private popTimer = 0;

  constructor(scene: THREE.Scene, playerGroup: THREE.Group) {
    this.scene = scene;
    this.stackGroup.position.set(0, 1.08, -0.46);
    playerGroup.add(this.stackGroup);
    this.prevPlayerX = playerGroup.position.x;
    this.prevPlayerZ = playerGroup.position.z;

    const itemGeo = new THREE.BoxGeometry(0.56, 0.16, 0.28);
    for (let i = 0; i < MAX_STACK_VISUALS; i++) {
      const mat = new THREE.MeshToonMaterial({ color: STACK_COLORS.wood });
      const mesh = new THREE.Mesh(itemGeo, mat);
      mesh.visible = false;
      mesh.castShadow = true;
      this.stackMeshes.push(mesh);
      this.stackGroup.add(mesh);
    }

    const flyGeo = new THREE.BoxGeometry(0.42, 0.16, 0.24);
    this.flyingPool = new ObjectPool<FlyingLoot>(
      () => {
        const loot: FlyingLoot = {
          active: false,
          kind: 'wood',
          startX: 0,
          startY: 0,
          startZ: 0,
          targetType: 'player',
          targetX: 0,
          targetY: 0,
          targetZ: 0,
          progress: 0,
          duration: 0.32,
        };
        const mesh = new THREE.Mesh(flyGeo, new THREE.MeshToonMaterial({ color: STACK_COLORS.wood }));
        mesh.visible = false;
        this.scene.add(mesh);
        this.flyingMeshes.set(loot, mesh);
        return loot;
      },
      (item) => {
        item.active = false;
        item.progress = 0;
        item.onArrive = undefined;
        const m = this.flyingMeshes.get(item);
        if (m) m.visible = false;
      },
      16,
    );
  }

  get count(): number {
    return this.items.length;
  }

  countOf(kind: CarryType): number {
    let n = 0;
    for (const item of this.items) {
      if (item === kind) n++;
    }
    return n;
  }

  canCarryMore(): boolean {
    return canAcceptCarryItem(this.items.length, this.maxCapacity);
  }

  spawnPickupToPlayer(
    kind: CarryType,
    fromX: number,
    fromY: number,
    fromZ: number,
    onCollect?: () => void,
  ): boolean {
    if (!this.canCarryMore() || this.flyingPool.activeCount >= MAX_FLYING) {
      return false;
    }
    // Reserve slot immediately so burst drops respect capacity accurately
    const loot = this.flyingPool.acquire();
    loot.active = true;
    loot.kind = kind;
    loot.startX = fromX;
    loot.startY = fromY;
    loot.startZ = fromZ;
    loot.targetType = 'player';
    loot.duration = 0.28 + Math.random() * 0.1;
    loot.onArrive = () => {
      if (this.canCarryMore()) {
        this.pushImmediate(kind);
      }
      onCollect?.();
    };
    const mesh = this.flyingMeshes.get(loot);
    if (mesh) {
      (mesh.material as THREE.MeshToonMaterial).color.setHex(STACK_COLORS[kind]);
      mesh.position.set(fromX, fromY, fromZ);
      mesh.visible = true;
    }
    return true;
  }

  spawnFlyingToPoint(
    kind: CarryType,
    fromX: number,
    fromY: number,
    fromZ: number,
    toX: number,
    toY: number,
    toZ: number,
    onArrive?: () => void,
  ): void {
    const loot = this.flyingPool.acquire();
    loot.active = true;
    loot.kind = kind;
    loot.startX = fromX;
    loot.startY = fromY;
    loot.startZ = fromZ;
    loot.targetType = 'point';
    loot.targetX = toX;
    loot.targetY = toY;
    loot.targetZ = toZ;
    loot.duration = 0.25;
    loot.onArrive = onArrive;
    const mesh = this.flyingMeshes.get(loot);
    if (mesh) {
      (mesh.material as THREE.MeshToonMaterial).color.setHex(STACK_COLORS[kind]);
      mesh.position.set(fromX, fromY, fromZ);
      mesh.visible = true;
    }
  }

  pushImmediate(kind: CarryType): boolean {
    if (!this.canCarryMore()) return false;
    this.items.push(kind);
    this.popTimer = 0.18;
    return true;
  }

  popLastOf(kind?: CarryType): CarryType | null {
    if (this.items.length === 0) return null;
    if (!kind) {
      return this.items.pop() ?? null;
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i] === kind) {
        const [removed] = this.items.splice(i, 1);
        this.popTimer = 0.12;
        return removed;
      }
    }
    return null;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    const vx = (playerPos.x - this.prevPlayerX) / Math.max(dt, 0.001);
    const vz = (playerPos.z - this.prevPlayerZ) / Math.max(dt, 0.001);
    this.prevPlayerX = playerPos.x;
    this.prevPlayerZ = playerPos.z;

    // Spring-damper inertia opposite to player movement
    const stiffness = 36;
    const damping = 8.5;
    const targetSwayX = Math.max(-0.35, Math.min(0.35, -vx * 0.032));
    const targetSwayZ = Math.max(-0.35, Math.min(0.35, -vz * 0.032));

    this.velSwayX += ((targetSwayX - this.swayX) * stiffness - this.velSwayX * damping) * dt;
    this.velSwayZ += ((targetSwayZ - this.swayZ) * stiffness - this.velSwayZ * damping) * dt;
    this.swayX += this.velSwayX * dt;
    this.swayZ += this.velSwayZ * dt;

    if (this.popTimer > 0) {
      this.popTimer = Math.max(0, this.popTimer - dt);
    }
    const squash = this.popTimer > 0 ? 1 + Math.sin((this.popTimer / 0.18) * Math.PI) * 0.24 : 1;

    const visibleCount = Math.min(this.items.length, MAX_STACK_VISUALS);
    for (let i = 0; i < MAX_STACK_VISUALS; i++) {
      const mesh = this.stackMeshes[i];
      if (i >= visibleCount) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const heightFactor = i * 0.15;
      const bend = (i / Math.max(visibleCount, 1)) * 1.45;
      mesh.position.set(this.swayX * bend * 1.15, heightFactor, this.swayZ * bend * 1.15);
      mesh.rotation.set(this.swayZ * 0.35, (i % 2) * 0.08, -this.swayX * 0.35);

      const topBoost = i === visibleCount - 1 ? squash : 1;
      mesh.scale.set(topBoost, 1 / Math.sqrt(topBoost), topBoost);

      this.dummyColor.setHex(STACK_COLORS[this.items[i]]);
      (mesh.material as THREE.MeshToonMaterial).color.copy(this.dummyColor);
    }

    // Update flying pickups
    this.flyingPool.forEachActive((loot) => {
      loot.progress += dt / loot.duration;
      const mesh = this.flyingMeshes.get(loot);
      if (loot.progress >= 1) {
        const cb = loot.onArrive;
        if (mesh) mesh.visible = false;
        cb?.();
        return true;
      }

      const t = loot.progress;
      const tx = loot.targetType === 'player' ? playerPos.x : loot.targetX;
      const ty = loot.targetType === 'player' ? 1.2 + this.items.length * 0.15 : loot.targetY;
      const tz = loot.targetType === 'player' ? playerPos.z : loot.targetZ;

      const x = loot.startX + (tx - loot.startX) * t;
      const z = loot.startZ + (tz - loot.startZ) * t;
      const arc = Math.sin(t * Math.PI) * 2.1;
      const y = loot.startY + (ty - loot.startY) * t + arc;

      if (mesh) {
        mesh.position.set(x, y, z);
        mesh.rotation.y += dt * 11;
        mesh.rotation.x += dt * 7;
      }
      return false;
    });
  }
}
