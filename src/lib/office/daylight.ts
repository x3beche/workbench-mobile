/**
 * The Office's day: the clock the screen shows, and the gentle light over the building - the web's
 * `frontend/src/app/rooms/office/daylight.ts`, kept pure so the screen and its tests share it.
 *
 * The app speaks Istanbul's time (the server's scheduler and the account's daily figures are Istanbul days), so
 * the office does too; `daylightAt` cuts the day into four bands and `daylightTint` is the wash the view lays
 * over the drawing. The tint goes under the names and the bubbles, never over them.
 */

export const OFFICE_ZONE = 'Europe/Istanbul';

export type Daylight = 'morning' | 'day' | 'evening' | 'night';

function pieces(at: Date, zone: string): { hour: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? at.getHours());
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? at.getMinutes());
    return { hour, minute };
  } catch {
    return { hour: at.getHours(), minute: at.getMinutes() };
  }
}

export function officeHour(at: Date, zone = OFFICE_ZONE): number {
  return pieces(at, zone).hour % 24;
}

/** HH:MM on the wall, zero-padded, in the office's zone. */
export function clockAt(at: Date, zone = OFFICE_ZONE): string {
  const { hour, minute } = pieces(at, zone);
  return `${String(hour % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Morning 06-10, day 10-17, evening 17-21, night the rest. */
export function daylightAt(at: Date, zone = OFFICE_ZONE): Daylight {
  const h = officeHour(at, zone);
  if (h >= 6 && h < 10) return 'morning';
  if (h >= 10 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/** The wash over the world: warm at dawn, none at noon, orange at dusk, deep blue at night. A tint, not a
 *  dimmer - the names and the bubbles are drawn after it and keep their contrast. */
export function daylightTint(phase: Daylight): string | null {
  switch (phase) {
    case 'morning':
      return 'rgba(255, 190, 120, .10)';
    case 'day':
      return null;
    case 'evening':
      return 'rgba(255, 136, 62, .14)';
    case 'night':
      return 'rgba(15, 23, 56, .32)';
  }
}
