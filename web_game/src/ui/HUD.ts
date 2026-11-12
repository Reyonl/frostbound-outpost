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
  private readonly statusPillEl: HTMLDivElement;
  private readonly bannerEl: HTMLDivElement;
  private readonly tipEl: HTMLDivElement;
  private readonly stackTextEl: HTMLSpanElement;
  private readonly stackFillEl: HTMLDivElement;
  private readonly muteBtn: HTMLButtonElement;
  readonly upgradeBtn: HTMLButtonElement;

  private readonly prevCounts: ResourceCounts = { cash: -1, wood: -1, meat: -1, gold: -1 };
  private bannerTimer = 0;

  constructor(
    root: HTMLElement,
    onToggleMute: () => boolean,
    onOpenUpgrades: () => void,
  ) {
    this.root = root;

    const title = document.createElement('div');
    title.className = 'title-badge';
    title.textContent = 'FROSTBOUND OUTPOST';
    this.root.appendChild(title);

    this.statusPillEl = document.createElement('div');
    this.statusPillEl.className = 'status-pill';
    this.statusPillEl.textContent = '🔥 100% · DAY 1 · W1';
    this.root.appendChild(this.statusPillEl);

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

    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'event-banner hidden';
    this.root.appendChild(this.bannerEl);

    this.tipEl = document.createElement('div');
    this.tipEl.className = 'tutorial-tip';
    this.tipEl.textContent = 'Drag to chop trees & hunt!';
    this.root.appendChild(this.tipEl);

    this.upgradeBtn = document.createElement('button');
    this.upgradeBtn.type = 'button';
    this.upgradeBtn.className = 'upgrade-open-btn';
    this.upgradeBtn.setAttribute('data-testid', 'open-upgrades');
    this.upgradeBtn.textContent = '⚡ UPGRADES';
    this.upgradeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onOpenUpgrades();
    });
    this.root.appendChild(this.upgradeBtn);

    const stackBar = document.createElement('div');
    stackBar.className = 'stack-bar';
    this.stackFillEl = document.createElement('div');
    this.stackFillEl.className = 'stack-bar-fill';
    this.stackTextEl = document.createElement('span');
    this.stackTextEl.className = 'stack-bar-text';
    this.stackTextEl.textContent = 'PACK 0 / 12';
    stackBar.append(this.stackFillEl, this.stackTextEl);
    this.root.appendChild(stackBar);
  }

  showBanner(text: string, duration = 3.2): void {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.remove('hidden');
    this.bannerTimer = duration;
  }

  update(
    counts: ResourceCounts,
    carryCount: number,
    maxCarry: number,
    warmth: number,
    day: number,
    wave: number,
    blizzard: boolean,
    tutorialText: string,
    dt: number,
  ): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerEl.classList.add('hidden');
      }
    }

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

    const warmPct = Math.round(warmth);
    this.statusPillEl.textContent = blizzard
      ? `❄️ BLIZZARD · 🔥 ${warmPct}%`
      : `🔥 ${warmPct}% · DAY ${day} · W${wave}`;
    this.statusPillEl.classList.toggle('cold', warmth < 35 || blizzard);

    if (tutorialText) {
      this.tipEl.textContent = tutorialText;
      this.tipEl.classList.remove('hidden');
    } else {
      this.tipEl.classList.add('hidden');
    }
  }
}
