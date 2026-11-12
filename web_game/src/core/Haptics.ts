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

export function triggerHaptic(style: HapticStyle = 'light', minCooldownMs = 45): void {
  const now = performance.now();
  if (now - lastHapticAt < minCooldownMs) return;
  lastHapticAt = now;

  if (typeof window !== 'undefined' && window.FrostboundNative) {
    window.FrostboundNative.postMessage(`haptic:${style}`);
    return;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(VIBRATE_MS[style]);
  }
}
