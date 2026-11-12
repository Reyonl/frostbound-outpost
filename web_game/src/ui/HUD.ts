import type { ResourceType } from '../config/gameConfig';

export interface ResourceCounts {
  cash: number;
  wood: number;
  meat: number;
  gold: number;
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly valueEls: Record<ResourceType, HTMLSpanElement>;
  private readonly pillEls: Record<ResourceType, HTMLDivElement>;
  private readonly stackTextEl: HTMLSpanElement;
  private readonly stackFillEl: HTMLDivElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly prevCounts: ResourceCounts = { cash: 0, wood: 0, meat: 0, gold: 0 };

  constructor(root: HTMLElement, onToggleMute: () => boolean) {
    this.root = root;

    const title = document.createElement('div');
    title.className = 'title-badge';
    title.textContent = 'FROSTBOUND OUTPOST';
    this.root.appendChild(title);

    this.muteBtn = document.createElement('button');
    this.muteBtn.className = 'hud-mute-btn';
    this.muteBtn.type = 'button';
    this.muteBtn.textContent = '🔊';
    this.muteBtn.setAttribute('aria-label', 'Toggle audio');
    this.muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const muted = onToggleMute();
      this.muteBtn.textContent = muted ? '🔇' : '🔊';
    });
    this.root.appendChild(this.muteBtn);

    const panel = document.createElement('div');
    panel.className = 'resource-hud';
    panel.setAttribute('data-testid', 'resource-hud');

    const meta: { key: ResourceType; icon: string; cls: string }[] = [
      { key: 'cash', icon: '$', cls: 'res-cash' },
      { key: 'wood', icon: '🪵', cls: 'res-wood' },
      { key: 'meat', icon: '🥩', cls: 'res-meat' },
      { key: 'gold', icon: '🪙', cls: 'res-gold' },
    ];

    this.valueEls = {} as Record<ResourceType, HTMLSpanElement>;
    this.pillEls = {} as Record<ResourceType, HTMLDivElement>;

    for (const item of meta) {
      const pill = document.createElement('div');
      pill.className = `res-pill ${item.cls}`;
      pill.setAttribute('data-resource', item.key);

      const icon = document.createElement('span');
      icon.className = 'res-icon';
      icon.textContent = item.icon;

      const val = document.createElement('span');
      val.className = 'res-value';
      val.textContent = '0';

      pill.append(icon, val);
      panel.appendChild(pill);
      this.pillEls[item.key] = pill;
      this.valueEls[item.key] = val;
    }

    this.root.appendChild(panel);

    const stackBar = document.createElement('div');
    stackBar.className = 'stack-bar';
    this.stackFillEl = document.createElement('div');
    this.stackFillEl.className = 'stack-bar-fill';
    this.stackTextEl = document.createElement('span');
    this.stackTextEl.className = 'stack-bar-text';
    this.stackTextEl.textContent = 'BACKPACK 0 / 12';
    stackBar.append(this.stackFillEl, this.stackTextEl);
    this.root.appendChild(stackBar);
  }

  update(counts: ResourceCounts, carryCount: number, maxCarry: number): void {
    (['cash', 'wood', 'meat', 'gold'] as ResourceType[]).forEach((key) => {
      const next = Math.floor(counts[key]);
      if (next !== this.prevCounts[key]) {
        this.prevCounts[key] = next;
        this.valueEls[key].textContent = String(next);
        const pill = this.pillEls[key];
        pill.classList.remove('pop');
        void pill.offsetWidth;
        pill.classList.add('pop');
      }
    });

    const pct = Math.min(100, Math.round((carryCount / Math.max(1, maxCarry)) * 100));
    this.stackFillEl.style.width = `${pct}%`;
    this.stackFillEl.classList.toggle('full', carryCount >= maxCarry);
    this.stackTextEl.textContent =
      carryCount >= maxCarry ? `FULL ${carryCount} / ${maxCarry}` : `PACK ${carryCount} / ${maxCarry}`;
  }
}
