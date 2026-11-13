import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool';

interface FloatingItem {
  el: HTMLDivElement;
  wx: number;
  wy: number;
  wz: number;
  vy: number;
  life: number;
  maxLife: number;
}

export class FloatingTextSystem {
  private readonly container: HTMLDivElement;
  private readonly pool: ObjectPool<FloatingItem>;
  private readonly projVec = new THREE.Vector3();

  constructor(hudRoot: HTMLElement) {
    this.container = document.createElement('div');
    this.container.className = 'floating-text-layer';
    hudRoot.appendChild(this.container);

    this.pool = new ObjectPool<FloatingItem>(
      () => {
        const el = document.createElement('div');
        el.className = 'float-num';
        el.style.display = 'none';
        this.container.appendChild(el);
        return { el, wx: 0, wy: 0, wz: 0, vy: 1.6, life: 0, maxLife: 0.65 };
      },
      (item) => {
        item.life = 0;
        item.el.style.display = 'none';
      },
      20,
    );
  }

  spawn(wx: number, wy: number, wz: number, text: string, color = '#ffffff', scale = 1): void {
    const item = this.pool.acquire();
    item.wx = wx + (Math.random() - 0.5) * 0.4;
    item.wy = wy;
    item.wz = wz;
    item.vy = 1.85;
    item.maxLife = 0.68;
    item.life = item.maxLife;
    item.el.textContent = text;
    item.el.style.color = color;
    item.el.style.fontSize = `${Math.round(14 * scale)}px`;
    item.el.style.display = 'block';
  }

  update(dt: number, camera: THREE.Camera): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.pool.forEachActive((item) => {
      item.life -= dt;
      if (item.life <= 0) {
        return true;
      }
      item.wy += item.vy * dt;
      item.vy *= 0.94;

      this.projVec.set(item.wx, item.wy, item.wz).project(camera);
      if (this.projVec.z > 1) {
        item.el.style.opacity = '0';
        return false;
      }
      const sx = (this.projVec.x * 0.5 + 0.5) * w;
      const sy = (-this.projVec.y * 0.5 + 0.5) * h;
      const alpha = Math.min(1, (item.life / item.maxLife) * 1.4);

      item.el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      item.el.style.opacity = alpha.toFixed(2);
      return false;
    });
  }
}
