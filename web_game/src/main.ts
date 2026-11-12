export const APP_TITLE = 'Frostbound Outpost';

export function bootPlaceholder(): string {
  return APP_TITLE;
}

if (typeof document !== 'undefined') {
  const hud = document.getElementById('hud-root');
  if (hud && !hud.textContent) {
    hud.setAttribute('data-game', APP_TITLE);
  }
}
