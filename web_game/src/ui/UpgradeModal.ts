import type { UpgradeLevels } from '../core/SaveSystem';
import {
  UPGRADE_DEFS,
  computePrestigeMultiplier,
  computeRelicsEarned,
  getUpgradeCost,
  type UpgradeKey,
} from '../systems/UpgradeSystem';
import { renderSvg, type IconName } from './Icons';

export type UpgradeCategory = 'all' | 'combat' | 'survival' | 'base';

const UPGRADE_CATEGORY_MAP: Record<UpgradeKey, 'combat' | 'survival' | 'base'> = {
  axeCount: 'combat',
  axePower: 'combat',
  spinSpeed: 'combat',
  carryCap: 'survival',
  moveSpeed: 'survival',
  thermalCoat: 'survival',
  turretPower: 'base',
};

interface CategoryTabDef {
  id: UpgradeCategory;
  label: string;
  icon: IconName;
}

const CATEGORY_TABS: CategoryTabDef[] = [
  { id: 'all', label: 'ALL', icon: 'lightning' },
  { id: 'combat', label: 'COMBAT', icon: 'swords' },
  { id: 'survival', label: 'SURVIVAL', icon: 'shield' },
  { id: 'base', label: 'BASE', icon: 'cog' },
];

export class UpgradeModal {
  readonly root: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly tabsEl: HTMLDivElement;
  private readonly prestigeInfoEl: HTMLDivElement;
  private readonly prestigeBtn: HTMLButtonElement;
  private activeCategory: UpgradeCategory = 'all';
  private open = false;

  private lastRenderCash = 0;
  private lastRenderLevels: UpgradeLevels | null = null;
  private lastRenderRelics = 0;
  private lastRenderPrestigeCount = 0;
  private lastRenderTotalCash = 0;
  private lastRenderKills = 0;

  constructor(
    hudRoot: HTMLElement,
    onBuyUpgrade: (key: UpgradeKey, cost: number) => void,
    onPrestige: () => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'upgrade-backdrop hidden';

    const sheet = document.createElement('div');
    sheet.className = 'upgrade-sheet';
    sheet.addEventListener('pointerdown', (e) => e.stopPropagation());

    // Header
    const header = document.createElement('div');
    header.className = 'upgrade-header';
    const title = document.createElement('h2');
    title.textContent = 'OUTPOST UPGRADES';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'upgrade-close-btn';
    closeBtn.setAttribute('aria-label', 'Close upgrades');
    closeBtn.innerHTML = renderSvg('cross', 16);
    closeBtn.addEventListener('click', () => this.setOpen(false));
    header.append(title, closeBtn);

    // Category Tabs
    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'upgrade-tabs';
    for (const tab of CATEGORY_TABS) {
      const tabBtn = document.createElement('button');
      tabBtn.type = 'button';
      tabBtn.className = `upgrade-tab-btn ${tab.id === this.activeCategory ? 'active' : ''}`;
      tabBtn.dataset.cat = tab.id;
      tabBtn.innerHTML = `
        <span class="tab-icon">${renderSvg(tab.icon, 14)}</span>
        <span class="tab-label">${tab.label}</span>
      `;
      tabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setCategory(tab.id);
      });
      this.tabsEl.appendChild(tabBtn);
    }

    // Scrollable List
    this.listEl = document.createElement('div');
    this.listEl.className = 'upgrade-list';

    // Prestige Card
    const prestigeCard = document.createElement('div');
    prestigeCard.className = 'prestige-card';
    this.prestigeInfoEl = document.createElement('div');
    this.prestigeInfoEl.className = 'prestige-info';
    this.prestigeBtn = document.createElement('button');
    this.prestigeBtn.type = 'button';
    this.prestigeBtn.className = 'prestige-btn';
    this.prestigeBtn.innerHTML = `
      <span class="btn-icon">${renderSvg('compass', 15)}</span>
      <span class="btn-text">NEW EXPEDITION</span>
    `;
    this.prestigeBtn.addEventListener('click', () => {
      onPrestige();
      this.setOpen(false);
    });
    prestigeCard.append(this.prestigeInfoEl, this.prestigeBtn);

    sheet.append(header, this.tabsEl, this.listEl, prestigeCard);
    this.root.appendChild(sheet);
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.setOpen(false);
    });
    hudRoot.appendChild(this.root);

    this.listEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-upg]');
      if (!btn || btn.disabled) return;
      const key = btn.dataset.upg as UpgradeKey;
      const cost = Number(btn.dataset.cost || 0);
      onBuyUpgrade(key, cost);
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  setOpen(next: boolean): void {
    this.open = next;
    this.root.classList.toggle('hidden', !next);
  }

  setCategory(category: UpgradeCategory): void {
    if (this.activeCategory === category) return;
    this.activeCategory = category;

    const tabButtons = this.tabsEl.querySelectorAll<HTMLButtonElement>('.upgrade-tab-btn');
    tabButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.cat === category);
    });

    if (this.lastRenderLevels) {
      this.render(
        this.lastRenderCash,
        this.lastRenderLevels,
        this.lastRenderRelics,
        this.lastRenderPrestigeCount,
        this.lastRenderTotalCash,
        this.lastRenderKills,
      );
    }
  }

  render(
    cash: number,
    levels: UpgradeLevels,
    relics: number,
    prestigeCount: number,
    totalCashEarned: number,
    kills: number,
  ): void {
    this.lastRenderCash = cash;
    this.lastRenderLevels = levels;
    this.lastRenderRelics = relics;
    this.lastRenderPrestigeCount = prestigeCount;
    this.lastRenderTotalCash = totalCashEarned;
    this.lastRenderKills = kills;

    if (!this.open) return;

    this.listEl.innerHTML = '';
    const filteredDefs = UPGRADE_DEFS.filter((def) => {
      if (this.activeCategory === 'all') return true;
      return UPGRADE_CATEGORY_MAP[def.key] === this.activeCategory;
    });

    for (const def of filteredDefs) {
      const lvl = levels[def.key];
      const maxed = lvl >= def.maxLevel;
      const cost = getUpgradeCost(def, lvl);
      const canAfford = !maxed && cash >= cost;
      const category = UPGRADE_CATEGORY_MAP[def.key];

      const row = document.createElement('div');
      row.className = `upgrade-row category-${category}`;

      const info = document.createElement('div');
      info.className = 'upgrade-row-info';

      const titleRow = document.createElement('div');
      titleRow.className = 'upgrade-row-header';

      const name = document.createElement('span');
      name.className = 'upgrade-row-title';
      name.textContent = def.title;

      const lvlBadge = document.createElement('span');
      lvlBadge.className = `upgrade-lvl-badge ${maxed ? 'maxed' : ''}`;
      lvlBadge.textContent = maxed ? 'MAX' : `Lv.${lvl}/${def.maxLevel}`;

      titleRow.append(name, lvlBadge);

      const desc = document.createElement('div');
      desc.className = 'upgrade-row-desc';
      desc.textContent = def.desc;

      info.append(titleRow, desc);

      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = 'upgrade-buy-btn';
      buyBtn.dataset.upg = def.key;
      buyBtn.dataset.cost = String(cost);
      buyBtn.disabled = !canAfford;

      if (maxed) {
        buyBtn.textContent = 'MAX';
      } else {
        buyBtn.innerHTML = `${renderSvg('cash', 13, 'btn-coin')}<span class="buy-cost">${cost}</span>`;
      }

      row.append(info, buyBtn);
      this.listEl.appendChild(row);
    }

    const pendingRelics = computeRelicsEarned(totalCashEarned, kills);
    const multPct = Math.round((computePrestigeMultiplier(relics) - 1) * 100);
    this.prestigeInfoEl.innerHTML =
      `<strong>Expedition #${prestigeCount + 1}</strong> · Relics: <span class="relic-num">${relics}</span> (+${multPct}% Boost)` +
      `<br/><span class="prestige-sub">Reset run to claim <b>+${pendingRelics}</b> Frost Relics</span>`;
    this.prestigeBtn.disabled = pendingRelics <= 0;
  }
}
