export type GraphicsQuality = 'high' | 'low';

const STORAGE_KEY = 'frostbound_graphics_quality';

export class QualityManager {
  private currentQuality: GraphicsQuality;
  private readonly listeners: ((quality: GraphicsQuality) => void)[] = [];

  constructor() {
    this.currentQuality = this.detectInitialQuality();
  }

  get quality(): GraphicsQuality {
    return this.currentQuality;
  }

  get isHigh(): boolean {
    return this.currentQuality === 'high';
  }

  setQuality(next: GraphicsQuality): void {
    if (this.currentQuality === next) return;
    this.currentQuality = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may fail in restricted sandboxes
    }
    this.listeners.forEach((fn) => fn(next));
  }

  toggle(): GraphicsQuality {
    const next = this.currentQuality === 'high' ? 'low' : 'high';
    this.setQuality(next);
    return next;
  }

  onChange(listener: (quality: GraphicsQuality) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private detectInitialQuality(): GraphicsQuality {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'high' || saved === 'low') return saved;
    } catch {
      // Ignore
    }

    // Heuristic: weak/low-end mobile chips usually report <= 4 logical cores
    if (typeof navigator !== 'undefined') {
      const cores = navigator.hardwareConcurrency;
      if (typeof cores === 'number' && cores > 0 && cores <= 4) {
        return 'low';
      }
    }

    return 'high';
  }
}
