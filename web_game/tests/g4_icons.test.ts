import { describe, expect, it } from 'vitest';
import { IconName, renderSvg } from '../src/ui/Icons';

describe('G4 Vector SVG Icons System', () => {
  const ALL_ICONS: IconName[] = [
    'cash',
    'wood',
    'meat',
    'gold',
    'fire',
    'frost',
    'audio-on',
    'audio-off',
    'quality-high',
    'quality-low',
    'lightning',
    'swords',
    'shield',
    'cog',
    'compass',
    'cross',
    'warning',
  ];

  it('renders valid SVG elements for all defined icon names', () => {
    for (const name of ALL_ICONS) {
      const svg = renderSvg(name);
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('viewBox="0 0 24 24"');
    }
  });

  it('correctly applies custom sizes and class names', () => {
    const customSize = 28;
    const customClass = 'hud-test-icon';
    const svg = renderSvg('wood', customSize, customClass);

    expect(svg).toContain(`width="${customSize}"`);
    expect(svg).toContain(`height="${customSize}"`);
    expect(svg).toContain(`class="${customClass}"`);
  });

  it('defaults size to 16 and className to svg-icon when omitted', () => {
    const svg = renderSvg('cash');
    expect(svg).toContain('width="16"');
    expect(svg).toContain('height="16"');
    expect(svg).toContain('class="svg-icon"');
  });

  it('returns empty string gracefully for unknown icon names', () => {
    // @ts-expect-error testing boundary condition with invalid icon name
    const svg = renderSvg('non_existent_icon');
    expect(svg).toBe('');
  });
});
