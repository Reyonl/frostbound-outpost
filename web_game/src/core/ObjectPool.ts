export interface Poolable {
  reset(): void;
}

/**
 * Fixed-overhead object pool to prevent runtime allocations during combat,
 * resource bursts, and snow/projectile updates.
 */
export class ObjectPool<T> {
  private readonly inactive: T[] = [];
  private readonly activeSet = new Set<T>();
  private readonly factory: () => T;
  private readonly onReset: (item: T) => void;

  constructor(factory: () => T, onReset: (item: T) => void, prewarm = 0) {
    this.factory = factory;
    this.onReset = onReset;
    for (let i = 0; i < prewarm; i++) {
      this.inactive.push(this.factory());
    }
  }

  acquire(): T {
    const item = this.inactive.pop() ?? this.factory();
    this.onReset(item);
    this.activeSet.add(item);
    return item;
  }

  release(item: T): void {
    if (!this.activeSet.delete(item)) return;
    this.onReset(item);
    this.inactive.push(item);
  }

  forEachActive(fn: (item: T) => boolean | void): void {
    for (const item of this.activeSet) {
      const shouldRelease = fn(item);
      if (shouldRelease === true) {
        this.release(item);
      }
    }
  }

  get activeCount(): number {
    return this.activeSet.size;
  }

  get pooledCount(): number {
    return this.inactive.length;
  }
}
