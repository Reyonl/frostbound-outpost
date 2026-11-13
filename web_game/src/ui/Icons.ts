// Inline SVG icons for Frostbound Outpost HUD and UI
// Completely replaces emoji with crisp, scalable, zero-dependency SVG vectors.

export type IconName =
  | 'cash'
  | 'wood'
  | 'meat'
  | 'gold'
  | 'fire'
  | 'frost'
  | 'audio-on'
  | 'audio-off'
  | 'quality-high'
  | 'quality-low'
  | 'lightning'
  | 'swords'
  | 'shield'
  | 'cog'
  | 'compass'
  | 'cross'
  | 'warning';

const ICONS: Record<IconName, (size: number, className: string) => string> = {
  cash: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="3" fill="#15803d" stroke="#4ade80" stroke-width="1.8"/>
      <circle cx="12" cy="12" r="3.6" fill="#166534" stroke="#86efac" stroke-width="1.4"/>
      <path d="M12 9.5v5M10.7 10.8c0-.7.6-1.3 1.3-1.3h.3c.7 0 1.2.5 1.2 1.1 0 1.5-2.5 1-2.5 2.5 0 .6.5 1.1 1.2 1.1h.4c.7 0 1.2-.5 1.2-1.1" stroke="#f0fdf4" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`,

  wood: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 8.5C4 6.6 5.8 5 8 5s4 1.6 4 3.5v7C12 17.4 10.2 19 8 19s-4-1.6-4-3.5v-7z" fill="#78350f" stroke="#b45309" stroke-width="1.6"/>
      <path d="M12 7l8 3.5v5.5l-8 3V7z" fill="#92400e" stroke="#d97706" stroke-width="1.6" stroke-linejoin="round"/>
      <ellipse cx="8" cy="8.5" rx="2.5" ry="1.8" fill="#d97706" stroke="#fde68a" stroke-width="1"/>
      <circle cx="8" cy="8.5" r="0.8" fill="#78350f"/>
    </svg>`,

  meat: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 14.5c-1.8 0-3-1.4-3-3.2 0-3.5 4.5-7.3 10.5-7.3 4 0 7.5 2.5 7.5 5.5 0 3.2-3.8 6.5-8.5 6.5-1.2 0-2.2-.4-3.2-.9l-3.3 1.4v-2z" fill="#b91c1c" stroke="#f87171" stroke-width="1.6" stroke-linejoin="round"/>
      <ellipse cx="14.5" cy="9.5" rx="3.5" ry="2.2" fill="#ef4444" stroke="#fecaca" stroke-width="1"/>
      <circle cx="14.5" cy="9.5" r="1.1" fill="#fef2f2"/>
      <path d="M5.5 15.5l-2.2 2.2a1.2 1.2 0 101.7 1.7l2.2-2.2" stroke="#fef2f2" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,

  gold: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="12" cy="8.5" rx="7.5" ry="3.8" fill="#f59e0b" stroke="#fde047" stroke-width="1.6"/>
      <path d="M4.5 8.5v6c0 2.1 3.4 3.8 7.5 3.8s7.5-1.7 7.5-3.8v-6" fill="#d97706" stroke="#fde047" stroke-width="1.6"/>
      <ellipse cx="12" cy="14.5" rx="7.5" ry="3.8" fill="none" stroke="#fde047" stroke-width="1.2" stroke-dasharray="2 2"/>
      <path d="M12 6.5l.8 1.4 1.6.2-1.2 1.1.3 1.6-1.5-.8-1.5.8.3-1.6-1.2-1.1 1.6-.2z" fill="#fef08a"/>
    </svg>`,

  fire: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2C9.5 5 7 8 7 12c0 3 2.2 6 5 6s5-3 5-6c0-2-1-4-2-5.5-.3 1.8-1.2 2.8-2 3.2 0-2.2-.4-5.2-1-7.7z" fill="#ea580c" stroke="#fb923c" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M12 11c-1.2 0-2 1-2 2.5 0 1.5 1 2.5 2 2.5s2-1 2-2.5c0-.8-.4-1.5-.8-1.8 0 1-.5 1.3-.7 1.3-.2 0-.5-.5-.5-2z" fill="#fef08a"/>
    </svg>`,

  frost: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M12 6l-2-2m4 0l-2 2m0 12l-2 2m4 0l-2-2M6 12l-2-2m0 4l2-2m12 0l2-2m0 4l-2-2" stroke="#bae6fd" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,

  'audio-on': (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="#e2e8f0" stroke="#f8fafc" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M16.5 8.5c1 1 1.5 2.3 1.5 3.5s-.5 2.5-1.5 3.5M19 6c1.8 1.8 2.8 3.9 2.8 6s-1 4.2-2.8 6" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`,

  'audio-off': (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="#64748b" stroke="#94a3b8" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M3 3l18 18M16 9l6 6M22 9l-6 6" stroke="#f87171" stroke-width="2" stroke-linecap="round"/>
    </svg>`,

  'quality-high': (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 3h12l4 6-10 12L2 9l4-6z" fill="#0369a1" stroke="#38bdf8" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M2 9h20M12 21L7.5 9 10 3m4 0l2.5 6L12 21" stroke="#7dd3fc" stroke-width="1.3"/>
    </svg>`,

  'quality-low': (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" fill="#b45309" stroke="#fbbf24" stroke-width="1.6" stroke-linejoin="round"/>
    </svg>`,

  lightning: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M13 2L4 14h7l-2 8 11-12h-8l3-8z" fill="#38bdf8" stroke="#7dd3fc" stroke-width="1.6" stroke-linejoin="round"/>
    </svg>`,

  swords: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19 3l-8 8M16 3l5 5M5 19l3-3M3 21l2-2" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 3l8 8M8 3l-5 5M19 19l-3-3M21 21l-2-2" stroke="#fca5a5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

  shield: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2L4 5v7c0 5.2 3.5 9.8 8 11 4.5-1.2 8-5.8 8-11V5l-8-3z" fill="#0369a1" stroke="#38bdf8" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M12 6v12M8 10h8" stroke="#bae6fd" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,

  cog: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" fill="#d97706" stroke="#fbbf24" stroke-width="1.5"/>
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.1-6.9l-2.1 2.1m-9.6 9.6l-2.1 2.1m0-13.8l2.1 2.1m9.6 9.6l2.1 2.1" stroke="#fde047" stroke-width="2" stroke-linecap="round"/>
    </svg>`,

  compass: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#fbbf24" stroke-width="1.8"/>
      <polygon points="12,5 15,12 12,19 9,12" fill="#d97706" stroke="#fef08a" stroke-width="1.2"/>
      <polygon points="12,5 15,12 12,12" fill="#ef4444"/>
    </svg>`,

  cross: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#cbd5e1" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`,

  warning: (size, cls) => `
    <svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3L2 21h20L12 3z" fill="#7f1d1d" stroke="#ef4444" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M12 9v5M12 17.5v.5" stroke="#fecaca" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
};

export function renderSvg(name: IconName, size = 16, className = 'svg-icon'): string {
  const fn = ICONS[name];
  if (!fn) return '';
  return fn(size, className).trim();
}
