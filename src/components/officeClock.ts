/**
 * The office's clock: what time it is in Istanbul, and which of the day's four bands that is (the tint over the
 * drawing). It ticks once a minute, and not at all while the app is behind another one - a clock that draws
 * nothing is a wake-up with no picture to show (the resilience rules).
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { clockAt, daylightAt, type Daylight } from '../lib/office/daylight';

/** How often the clock is read again: a minute is the smallest thing it shows. */
export const CLOCK_MS = 60_000;

export interface OfficeClock {
  /** The office's wall clock, "14:32". */
  clock: string;
  /** Morning, day, evening or night, for the wash over the drawing. */
  phase: Daylight;
}

export function useOfficeClock(stepMs = CLOCK_MS): OfficeClock {
  const [at, setAt] = useState(() => new Date());
  const [active, setActive] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      const on = st === 'active';
      setActive(on);
      // Back in front: the hour it is now, not the one it was when it went to the back. Set from the event,
      // not from the effect's body: a render caused by another render is what the lint rule is about.
      if (on) setAt(new Date());
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setAt(new Date()), stepMs);
    return () => clearInterval(id);
  }, [active, stepMs]);

  return { clock: clockAt(at), phase: daylightAt(at) };
}
