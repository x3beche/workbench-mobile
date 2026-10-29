/**
 * The palette's two promises: a line or a control's edge can be seen (3:1
 * against the ground it sits on), and a chart's series is a colour on the
 * card it is drawn on - in every theme, not only the dark ones.
 */
import { THEMES } from '../themes';
import { contrast, luminance, mixOn, paletteOf, readableOn } from '../tokens';

describe('contrast', () => {
  it('knows black on white is 21 to 1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#123456', '#123456')).toBeCloseTo(1, 5);
  });

  it('reads rgb() and the three-digit form as well as hex', () => {
    expect(luminance('rgb(255, 255, 255)')).toBeCloseTo(1, 5);
    expect(luminance('#fff')).toBeCloseTo(1, 5);
    expect(luminance('#000')).toBeCloseTo(0, 5);
    // Nothing it cannot read: a colour it does not know is not a crash.
    expect(contrast('transparent', '#000')).toBeGreaterThan(0);
  });

  it('lays one colour over another', () => {
    expect(mixOn('#ffffff', '#000000', 0)).toBe('#000000');
    expect(mixOn('#ffffff', '#000000', 1)).toBe('#ffffff');
    expect(mixOn('#ffffff', '#000000', 0.5)).toBe('#808080');
  });
});

describe('readableOn', () => {
  it('leaves a colour that is already visible alone', () => {
    expect(readableOn('#ffffff', '#000000')).toBe('#ffffff');
  });

  it('lifts a pale colour on a white ground until it can be seen', () => {
    const pale = '#f5f0c0';
    expect(contrast(pale, '#ffffff')).toBeLessThan(3);
    expect(contrast(readableOn(pale, '#ffffff'), '#ffffff')).toBeGreaterThanOrEqual(3);
  });

  it('darkens a dark colour on a dark ground', () => {
    // Toward the ink of that theme: on a near-black ground it goes lighter.
    expect(contrast(readableOn('#1a1a1a', '#000000'), '#000000')).toBeGreaterThanOrEqual(3);
  });
});

describe('every theme', () => {
  it.each(THEMES.map((t) => [t.name, t] as const))('%s', (_name, t) => {
    const p = paletteOf(t);
    const ground = t.colors.surface;
    expect(contrast(p.lineStrong, ground)).toBeGreaterThanOrEqual(3);
    expect(contrast(p.focus, ground)).toBeGreaterThanOrEqual(3);
    for (const key of ['series1', 'series2', 'series3', 'series4', 'series5', 'series6', 'series7', 'series8'] as const) {
      expect(contrast(p[key], ground)).toBeGreaterThanOrEqual(3);
    }
  });
});
