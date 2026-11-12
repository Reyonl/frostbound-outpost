export type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection';

interface NativeBridge {
  postMessage(msg: string): void;
}

declare global {
  interface Window {
    FrostboundNative?: NativeBridge;
    FrostboundLifecycle?: {
      onPause?: () => void;
      onResume?: () => void;
    };
  }
}

const VIBRATE_MS: Record<HapticStyle, number> = {
  selection: 8,
  light: 14,
  medium: 26,
  heavy: 45,
};

let lastHapticAt = 0;
let hapticsUnlocked = false;

export function unlockHaptics(): void {
  hapticsUnlocked = true;
}

export function triggerHaptic(style: HapticStyle = 'light', minCooldownMs = 45): void {
  const now = performance.now();
  if (now - lastHapticAt < minCooldownMs) return;
  lastHapticAt = now;

  if (typeof window !== 'undefined' && window.FrostboundNative) {
    window.FrostboundNative.postMessage(`haptic:${style}`);
    return;
  }

  const hasUserActivation =
    hapticsUnlocked &&
    typeof navigator !== 'undefined' &&
    (!('userActivation' in navigator) || navigator.userActivation?.hasBeenActive === true);

  if (hasUserActivation && typeof navigator.vibrate === 'function') {
    navigator.vibrate(VIBRATE_MS[style]);
  }
}
