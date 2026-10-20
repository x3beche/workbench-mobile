/** Figures as Analytics writes them, and the themes Settings offers. */
import { THEMES } from '../../theme/themes';
import { SYSTEM_THEME, themeFor, withAlpha } from '../../theme/tokens';
import { compact, dayLabel, money, seconds } from '../numbers';

describe('figures', () => {
  it('counts short', () => {
    expect([compact(950), compact(12_340), compact(4_100_000)]).toEqual(['950', '12k', '4.1M']);
  });
  it('writes money and time', () => {
    expect([money(0.004), money(0.42), money(1234.5)]).toEqual(['<$0.01', '$0.42', '$1,235']);
    expect([seconds(42), seconds(185), seconds(4320)]).toEqual(['42s', '3m 5s', '1h 12m']);
  });
  it('names a day in either language', () => {
    expect(dayLabel('2026-10-14', 'en')).toBe('14 Oct');
    expect(dayLabel('2026-10-14', 'tr')).toBe('14 Eki');
  });
});

describe('themes', () => {
  it('has every theme of the web app, each complete', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(20);
    expect(THEMES.map((t) => t.id)).toEqual(expect.arrayContaining(['spartan-dark', 'light', 'dracula', 'github-light']));
    for (const t of THEMES) expect(Object.keys(t.colors)).toEqual(expect.arrayContaining(['surface', 'ink', 'series8']));
  });
  it('wears Spartan Dark unless another was chosen, and the phone light or dark when it follows the phone', () => {
    expect(themeFor(null, 'dark').id).toBe('spartan-dark');
    expect(themeFor('nord', 'light').id).toBe('nord');
    expect(themeFor('no-such-theme', null).id).toBe('spartan-dark');
    expect(themeFor(SYSTEM_THEME, 'light').light).toBe(true);
    expect(themeFor(SYSTEM_THEME, 'dark').id).toBe('spartan-dark');
  });
  it('mixes a colour with its alpha', () => {
    expect(withAlpha('#e88c30', 0.09)).toBe('rgba(232, 140, 48, 0.09)');
  });
});
