import type { ResourceType } from '../config/gameConfig';
import type { GraphicsQuality } from '../core/QualitySettings';
import { renderSvg } from './Icons';

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
  private readonly qualityBtn: HTMLButtonElement;
  private readonly debugEl: HTMLDivElement;
  readonly upgradeBtn: HTMLButtonElement;

  private readonly prevCounts: ResourceCounts = { cash: -1, wood: -1, meat: -1, gold: -1 };
  private bannerTimer = 0;
  private fpsFrames = 0;
  private fpsTimer = 0;
  private currentFps = 60;
  private isDebugVisible = false;

  // 5-tap secret gesture on Quality pill
  private qualityTapCount = 0;
  private lastQualityTapTime = 0;

  constructor(
    root: HTMLElement,
    onToggleMute: () => boolean,
    onOpenUpgrades: () => void,
    onToggleQuality: () => GraphicsQuality,
    initialQuality: GraphicsQuality,
  ) {
    this.root = root;

    // Outpost Header Badge
    const title = document.createElement('div');
    title.className = 'title-badge';
    title.innerHTML = '<span class="title-text">FROSTBOUND OUTPOST</span>';
    this.root.appendChild(title);

    // Warmth / Day Status Pill
    this.statusPillEl = document.createElement('div');
    this.statusPillEl.className = 'status-pill';
    this.statusPillEl.innerHTML = `
      <span class="status-icon">${renderSvg('fire', 13)}</span>
      <span class="status-warmth">100%</span>
      <span class="status-dot">·</span>
      <span class="status-meta">DAY 1 · W1</span>
    `;
    this.root.appendChild(this.statusPillEl);

    // Audio Mute Button
    this.muteBtn = document.createElement('button');
    this.muteBtn.className = 'hud-mute-btn';
    this.muteBtn.type = 'button';
    this.muteBtn.innerHTML = renderSvg('audio-on', 16);
    this.muteBtn.setAttribute('aria-label', 'Toggle audio');
    this.muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const muted = onToggleMute();
      this.muteBtn.innerHTML = renderSvg(muted ? 'audio-off' : 'audio-on', 16);
    });
    this.root.appendChild(this.muteBtn);

    // Graphics Quality Toggle Button with 5-tap gesture
    this.qualityBtn = document.createElement('button');
    this.qualityBtn.className = 'hud-quality-btn';
    this.qualityBtn.type = 'button';
    this.setQualityBadge(initialQuality);
    this.qualityBtn.setAttribute('aria-label', 'Toggle graphics quality');
    this.qualityBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const now = performance.now();
      if (now - this.lastQualityTapTime > 3000) {
        this.qualityTapCount = 0;
      }
      this.lastQualityTapTime = now;
      this.qualityTapCount++;

      if (this.qualityTapCount >= 5) {
        this.qualityTapCount = 0;
        this.toggleDebugOverlay();
      }

      const next = onToggleQuality();
      this.setQualityBadge(next);
    });
    this.root.appendChild(this.qualityBtn);

    // Debug Overlay (enabled via ?debug=1 OR 5-tap gesture)
    const isDebugParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
    this.isDebugVisible = isDebugParam;

    this.debugEl = document.createElement('div');
    this.debugEl.className = `debug-hud ${this.isDebugVisible ? '' : 'hidden'}`;
    this.debugEl.textContent = 'FPS: 60 | DC: 0 | Q: HI';
    this.root.appendChild(this.debugEl);

    // Resource HUD
    const panel = document.createElement('div');
    panel.className = 'resource-hud';
    panel.setAttribute('data-testid', 'resource-hud');

    const meta: { key: ResourceType; icon: string; cls: string }[] = [
      { key: 'cash', icon: renderSvg('cash', 16), cls: 'res-cash' },
      { key: 'wood', icon: renderSvg('wood', 16), cls: 'res-wood' },
      { key: 'meat', icon: renderSvg('meat', 16), cls: 'res-meat' },
      { key: 'gold', icon: renderSvg('gold', 16), cls: 'res-gold' },
    ];

    this.valueEls = {} as Record<ResourceType, HTMLSpanElement>;
    this.pillEls = {} as Record<ResourceType, HTMLDivElement>;

    for (const item of meta) {
      const pill = document.createElement('div');
      pill.className = `res-pill ${item.cls}`;
      pill.setAttribute('data-resource', item.key);

      const icon = document.createElement('span');
      icon.className = 'res-icon';
      icon.innerHTML = item.icon;

      const val = document.createElement('span');
      val.className = 'res-value';
      val.textContent = '0';

      pill.append(icon, val);
      panel.appendChild(pill);
      this.pillEls[item.key] = pill;
      this.valueEls[item.key] = val;
    }

    this.root.appendChild(panel);

    // Notification / Event Banner
    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'event-banner hidden';
    this.root.appendChild(this.bannerEl);

    // Tutorial Prompt Tip
    this.tipEl = document.createElement('div');
    this.tipEl.className = 'tutorial-tip';
    this.tipEl.textContent = 'Drag to chop trees & hunt!';
    this.root.appendChild(this.tipEl);

    // Upgrade Button
    this.upgradeBtn = document.createElement('button');
    this.upgradeBtn.type = 'button';
    this.upgradeBtn.className = 'upgrade-open-btn';
    this.upgradeBtn.setAttribute('data-testid', 'open-upgrades');
    this.upgradeBtn.innerHTML = `
      <span class="btn-icon">${renderSvg('lightning', 15)}</span>
      <span class="btn-text">UPGRADES</span>
    `;
    this.upgradeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onOpenUpgrades();
    });
    this.root.appendChild(this.upgradeBtn);

    // Stack Backpack Capacity Bar
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

  setQualityBadge(quality: GraphicsQuality): void {
    const isHigh = quality === 'high';
    const icon = isHigh ? renderSvg('quality-high', 14) : renderSvg('quality-low', 14);
    const label = isHigh ? 'HIGH' : 'LOW';
    this.qualityBtn.innerHTML = `<span class="quality-icon">${icon}</span><span class="quality-label">${label}</span>`;
  }

  toggleDebugOverlay(): void {
    this.isDebugVisible = !this.isDebugVisible;
    this.debugEl.classList.toggle('hidden', !this.isDebugVisible);
  }

  showBanner(text: string, duration = 3.2, iconType: 'warning' | 'frost' | 'default' = 'default'): void {
    let iconSvg = '';
    if (iconType === 'warning') {
      iconSvg = `<span class="banner-icon">${renderSvg('warning', 16)}</span>`;
    } else if (iconType === 'frost') {
      iconSvg = `<span class="banner-icon">${renderSvg('frost', 16)}</span>`;
    }
    this.bannerEl.innerHTML = `${iconSvg}<span class="banner-text">${text}</span>`;
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
    drawCalls = 0,
    quality: GraphicsQuality = 'high',
  ): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerEl.classList.add('hidden');
      }
    }

    // Debug FPS & Draw Calls update
    if (this.isDebugVisible) {
      this.fpsFrames++;
      this.fpsTimer += dt;
      if (this.fpsTimer >= 0.3) {
        this.currentFps = Math.round(this.fpsFrames / this.fpsTimer);
        this.fpsFrames = 0;
        this.fpsTimer = 0;
        this.debugEl.textContent = `FPS: ${this.currentFps} | DC: ${drawCalls} | Q: ${quality === 'high' ? 'HI' : 'LO'}`;
      }
    }

    // Resource Counters with tabular nums and pop effect
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

    // Warmth / Day Status Pill
    const warmPct = Math.round(warmth);
    const iconName = blizzard || warmPct < 35 ? 'frost' : 'fire';
    this.statusPillEl.innerHTML = `
      <span class="status-icon">${renderSvg(iconName, 13)}</span>
      <span class="status-warmth">${warmPct}%</span>
      <span class="status-dot">·</span>
      <span class="status-meta">DAY ${day} · W${wave}</span>
    `;
    this.statusPillEl.classList.toggle('cold', warmPct < 35 || blizzard);

    if (tutorialText && this.tipEl.textContent !== tutorialText) {
      this.tipEl.textContent = tutorialText;
    }

    // Pack Backpack Capacity
    this.stackTextEl.textContent = `PACK ${carryCount} / ${maxCarry}`;
    const fillRatio = Math.min(100, Math.round((carryCount / Math.max(1, maxCarry)) * 100));
    this.stackFillEl.style.width = `${fillRatio}%`;
    this.stackFillEl.classList.toggle('full', carryCount >= maxCarry);
  }
}
