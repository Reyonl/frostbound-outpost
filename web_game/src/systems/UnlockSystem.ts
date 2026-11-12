import * as THREE from 'three';
import type { AudioSynth } from '../core/AudioSynth';
import { triggerHaptic } from '../core/Haptics';
import type { ParticleSystem } from '../systems/ParticleSystem';
import type { FloatingTextSystem } from '../systems/FloatingTextSystem';

export interface UnlockPad {
  id: 'turret_ne' | 'turret_sw' | 'fence_up' | 'helper_chopper' | 'rail_turbo';
  label: string;
  cost: number;
  paid: number;
  unlocked: boolean;
  position: { x: number; z: number };
  group: THREE.Group;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  lastDrawnPaid: number;
}

export function stepUnlockDrain(
  playerCash: number,
  remainingCost: number,
  chunk: number,
): { spent: number; nextCash: number; nextRemaining: number; completed: boolean } {
  const spent = Math.max(0, Math.min(playerCash, remainingCost, chunk));
  const nextCash = playerCash - spent;
  const nextRemaining = remainingCost - spent;
  return {
    spent,
    nextCash,
    nextRemaining,
    completed: nextRemaining <= 0,
  };
}

export class UnlockSystem {
  readonly pads: UnlockPad[] = [];
  private drainTimer = 0;

  constructor(scene: THREE.Scene) {
    const defs: {
      id: UnlockPad['id'];
      label: string;
      cost: number;
      x: number;
      z: number;
    }[] = [
      { id: 'turret_ne', label: 'TURRET NE', cost: 40, x: 5.1, z: -4.2 },
      { id: 'turret_sw', label: 'TURRET SW', cost: 60, x: -5.1, z: 3.6 },
      { id: 'fence_up', label: 'FORT WALL', cost: 50, x: 0.0, z: -5.2 },
      { id: 'helper_chopper', label: 'HELPER BOT', cost: 70, x: -5.4, z: -0.6 },
      { id: 'rail_turbo', label: 'TURBO RAIL', cost: 75, x: 5.4, z: 0.4 },
    ];

    for (const d of defs) {
      const group = new THREE.Group();
      group.position.set(d.x, 0.085, d.z);

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('2D canvas context unavailable');
      const texture = new THREE.CanvasTexture(canvas);

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2.15, 1.6),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
      );
      mesh.rotation.x = -Math.PI / 2;
      group.add(mesh);
      scene.add(group);

      const pad: UnlockPad = {
        id: d.id,
        label: d.label,
        cost: d.cost,
        paid: 0,
        unlocked: false,
        position: { x: d.x, z: d.z },
        group,
        canvas,
        ctx,
        texture,
        lastDrawnPaid: -1,
      };
      this.redrawPad(pad);
      this.pads.push(pad);
    }
  }

  private redrawPad(pad: UnlockPad): void {
    if (pad.paid === pad.lastDrawnPaid) return;
    pad.lastDrawnPaid = pad.paid;

    const ctx = pad.ctx;
    ctx.clearRect(0, 0, 256, 192);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.beginPath();
    ctx.roundRect(14, 14, 228, 164, 22);
    ctx.fill();

    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 6;
    ctx.setLineDash([16, 10]);
    ctx.beginPath();
    ctx.roundRect(18, 18, 220, 156, 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Progress bar inside pad
    const pct = Math.min(1, pad.paid / Math.max(1, pad.cost));
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.fillRect(34, 128, 188, 22);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(34, 128, 188 * pct, 22);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pad.label, 128, 64);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(`$${pad.cost - pad.paid}`, 128, 108);

    pad.texture.needsUpdate = true;
  }

  setUnlockedState(unlockedIds: string[]): void {
    for (const pad of this.pads) {
      if (unlockedIds.includes(pad.id)) {
        pad.paid = pad.cost;
        pad.unlocked = true;
        pad.group.visible = false;
      }
    }
  }

  getUnlockedIds(): string[] {
    return this.pads.filter((p) => p.unlocked).map((p) => p.id);
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    getCash: () => number,
    spendCash: (amt: number) => void,
    particles: ParticleSystem,
    floatingText: FloatingTextSystem,
    audio: AudioSynth,
    onUnlocked: (id: UnlockPad['id']) => void,
  ): void {
    this.drainTimer = Math.max(0, this.drainTimer - dt);

    for (const pad of this.pads) {
      if (pad.unlocked) {
        pad.group.visible = false;
        continue;
      }
      pad.group.visible = true;
      this.redrawPad(pad);

      const dist = Math.hypot(playerPos.x - pad.position.x, playerPos.z - pad.position.z);
      if (dist > 1.45) continue;

      if (this.drainTimer <= 0 && getCash() > 0) {
        const res = stepUnlockDrain(getCash(), pad.cost - pad.paid, 4);
        if (res.spent > 0) {
          this.drainTimer = 0.065;
          spendCash(res.spent);
          pad.paid += res.spent;
          audio.playCash();
          particles.burst(pad.position.x, 0.5, pad.position.z, 0x4ade80, 3, 2.5, 0.6);

          if (res.completed) {
            pad.unlocked = true;
            pad.group.visible = false;
            audio.playUnlock();
            triggerHaptic('heavy', 80);
            particles.burst(pad.position.x, 1.2, pad.position.z, 0x38bdf8, 16, 5.4, 1.1);
            floatingText.spawn(pad.position.x, 2.1, pad.position.z, `${pad.label} BUILT!`, '#38bdf8', 1.2);
            onUnlocked(pad.id);
          }
        }
      }
    }
  }
}
