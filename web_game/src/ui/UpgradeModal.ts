import type { UpgradeLevels } from '../core/SaveSystem';
import {
  UPGRADE_DEFS,
  computePrestigeMultiplier,
  computeRelicsEarned,
  getUpgradeCost,
  type UpgradeKey,
} from '../systems/UpgradeSystem';

export class UpgradeModal {
  readonly root: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly prestigeInfoEl: HTMLDivElement;
  private readonly prestigeBtn: HTMLButtonElement;
  private open = false;

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

    const header = document.createElement('div');
    header.className = 'upgrade-header';
    const title = document.createElement('h2');
    title.textContent = 'OUTPOST UPGRADES';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'upgrade-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.setOpen(false));
    header.append(title, closeBtn);

    this.listEl = document.createElement('div');
    this.listEl.className = 'upgrade-list';

    const prestigeCard = document.createElement('div');
    prestigeCard.className = 'prestige-card';
    this.prestigeInfoEl = document.createElement('div');
    this.prestigeInfoEl.className = 'prestige-info';
    this.prestigeBtn = document.createElement('button');
    this.prestigeBtn.type = 'button';
    this.prestigeBtn.className = 'prestige-btn';
    this.prestigeBtn.textContent = 'NEW EXPEDITION';
    this.prestigeBtn.addEventListener('click', () => {
      onPrestige();
      this.setOpen(false);
    });
    prestigeCard.append(this.prestigeInfoEl, this.prestigeBtn);

    sheet.append(header, this.listEl, prestigeCard);
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

  render(
    cash: number,
    levels: UpgradeLevels,
    relics: number,
    prestigeCount: number,
    totalCashEarned: number,
    kills: number,
  ): void {
    if (!this.open) return;

    this.listEl.innerHTML = '';
    for (const def of UPGRADE_DEFS) {
      const lvl = levels[def.key];
      const maxed = lvl >= def.maxLevel;
      const cost = getUpgradeCost(def, lvl);
      const canAfford = !maxed && cash >= cost;

      const row = document.createElement('div');
      row.className = 'upgrade-row';

      const info = document.createElement('div');
      info.className = 'upgrade-row-info';
      const name = document.createElement('div');
      name.className = 'upgrade-row-title';
      name.textContent = `${def.title} (Lv.${lvl}/${def.maxLevel})`;
      const desc = document.createElement('div');
      desc.className = 'upgrade-row-desc';
      desc.textContent = def.desc;
      info.append(name, desc);

      const buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = 'upgrade-buy-btn';
      buyBtn.dataset.upg = def.key;
      buyBtn.dataset.cost = String(cost);
      buyBtn.disabled = !canAfford;
      buyBtn.textContent = maxed ? 'MAX' : `$${cost}`;

      row.append(info, buyBtn);
      this.listEl.appendChild(row);
    }

    const pendingRelics = computeRelicsEarned(totalCashEarned, kills);
    const multPct = Math.round((computePrestigeMultiplier(relics) - 1) * 100);
    this.prestigeInfoEl.innerHTML =
      `<strong>Expedition #${prestigeCount + 1}</strong> · Relics: ${relics} (+${multPct}% Power & Cash)` +
      `<br/><span>Reset run to claim <b>+${pendingRelics}</b> Frost Relics</span>`;
    this.prestigeBtn.disabled = pendingRelics <= 0;
  }
}
