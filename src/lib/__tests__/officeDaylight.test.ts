/**
 * The office's day (lib/office/daylight.ts): the hour it is in Istanbul, the clock the bar shows, and the wash
 * the view lays over the drawing - the web's `frontend/src/app/rooms/office/daylight.ts`, carried over.
 */
import { clockAt, daylightAt, daylightTint, officeHour, OFFICE_ZONE } from '../office/daylight';

/** An instant at a wall-clock hour in Istanbul (UTC+3, all year). */
const at = (hour: number, minute = 0) =>
  new Date(`2026-11-01T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+03:00`);

describe('the office clock', () => {
  it('is Istanbul time, whatever the phone is set to', () => {
    expect(OFFICE_ZONE).toBe('Europe/Istanbul');
    expect(officeHour(at(14, 5))).toBe(14);
    expect(clockAt(at(9, 5))).toBe('09:05');
    expect(clockAt(at(23, 59))).toBe('23:59');
    // The same instant read from another zone is still the office's hour.
    const instant = new Date('2026-11-01T11:30:00Z');
    expect(clockAt(instant)).toBe('14:30');
  });

  it('cuts the day into four bands, morning to night', () => {
    expect(daylightAt(at(5, 59))).toBe('night');
    expect(daylightAt(at(6))).toBe('morning');
    expect(daylightAt(at(9, 59))).toBe('morning');
    expect(daylightAt(at(10))).toBe('day');
    expect(daylightAt(at(16, 59))).toBe('day');
    expect(daylightAt(at(17))).toBe('evening');
    expect(daylightAt(at(20, 59))).toBe('evening');
    expect(daylightAt(at(21))).toBe('night');
    expect(daylightAt(at(0))).toBe('night');
  });

  it('washes the drawing at dawn, dusk and night, and not at all at noon', () => {
    expect(daylightTint('day')).toBeNull();
    expect(daylightTint('morning')).toMatch(/rgba\(/);
    expect(daylightTint('evening')).toMatch(/rgba\(/);
    expect(daylightTint('night')).toMatch(/rgba\(/);
    // Night is the deepest wash of the four, and dusk warmer than dawn.
    expect(daylightTint('night')).not.toBe(daylightTint('day'));
  });
});
