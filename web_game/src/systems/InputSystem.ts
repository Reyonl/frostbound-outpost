export interface MoveVector {
  x: number;
  z: number;
  magnitude: number;
}

export function computeJoystickVector(
  dx: number,
  dy: number,
  maxRadius: number,
  deadzone = 6,
): MoveVector {
  const dist = Math.hypot(dx, dy);
  if (dist <= deadzone || maxRadius <= 0) {
    return { x: 0, z: 0, magnitude: 0 };
  }
  const clamped = Math.min(dist, maxRadius);
  const strength = (clamped - deadzone) / Math.max(maxRadius - deadzone, 1);
  const nx = dx / dist;
  const ny = dy / dist;
  return {
    x: nx * strength,
    z: ny * strength,
    magnitude: strength,
  };
}

export class InputSystem {
  private readonly zone: HTMLElement;
  private readonly baseEl: HTMLDivElement;
  private readonly knobEl: HTMLDivElement;
  private readonly maxRadius = 52;

  private activePointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private stickVec: MoveVector = { x: 0, z: 0, magnitude: 0 };
  private readonly keysDown = new Set<string>();
  private onFirstGesture?: () => void;

  constructor(zone: HTMLElement, onFirstGesture?: () => void) {
    this.zone = zone;
    this.onFirstGesture = onFirstGesture;

    this.baseEl = document.createElement('div');
    this.baseEl.className = 'joystick-base';
    this.knobEl = document.createElement('div');
    this.knobEl.className = 'joystick-knob';
    this.baseEl.appendChild(this.knobEl);
    this.zone.appendChild(this.baseEl);

    // Show subtle idle hint at bottom center until user touches
    this.showAt(window.innerWidth * 0.5, window.innerHeight * 0.8, false);

    this.zone.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private showAt(x: number, y: number, active: boolean): void {
    this.baseEl.style.left = `${x}px`;
    this.baseEl.style.top = `${y}px`;
    this.baseEl.classList.toggle('active', active);
  }

  private readonly handlePointerDown = (e: PointerEvent): void => {
    if (this.activePointerId !== null) return;
    this.onFirstGesture?.();
    this.onFirstGesture = undefined;

    this.activePointerId = e.pointerId;
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.showAt(this.originX, this.originY, true);
    this.knobEl.style.transform = 'translate(-50%, -50%)';
    this.stickVec = { x: 0, z: 0, magnitude: 0 };
  };

  private readonly handlePointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;
    const dx = e.clientX - this.originX;
    const dy = e.clientY - this.originY;
    this.stickVec = computeJoystickVector(dx, dy, this.maxRadius);

    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this.maxRadius);
    const kx = dist > 0.01 ? (dx / dist) * clamped : 0;
    const ky = dist > 0.01 ? (dy / dist) * clamped : 0;
    this.knobEl.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  };

  private readonly handlePointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    this.stickVec = { x: 0, z: 0, magnitude: 0 };
    this.knobEl.style.transform = 'translate(-50%, -50%)';
    this.showAt(window.innerWidth * 0.5, window.innerHeight * 0.8, false);
  };

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    this.onFirstGesture?.();
    this.onFirstGesture = undefined;
    this.keysDown.add(e.key.toLowerCase());
  };

  private readonly handleKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.key.toLowerCase());
  };

  getMoveVector(): MoveVector {
    if (this.stickVec.magnitude > 0) {
      return this.stickVec;
    }
    let kx = 0;
    let kz = 0;
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) kx -= 1;
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) kx += 1;
    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) kz -= 1;
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) kz += 1;

    if (kx === 0 && kz === 0) {
      return { x: 0, z: 0, magnitude: 0 };
    }
    const len = Math.hypot(kx, kz);
    return { x: kx / len, z: kz / len, magnitude: 1 };
  }

  dispose(): void {
    this.zone.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.baseEl.remove();
  }
}
