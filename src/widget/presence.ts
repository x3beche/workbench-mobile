/**
 * The widget follows the app: the first screen of a session and every return to
 * the app ask for a refresh - whoever the person is and whichever room they are
 * in. `refreshWidget` holds the rules (one at a time, at most every two minutes
 * for this trigger, and the log), so a phone left open fires nothing and a
 * switch between rooms costs nothing.
 *
 * Its own file so it can be held in a test without the app around it.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { refreshWidget } from './refresh';

export function useWidgetOnForeground(): void {
  useEffect(() => {
    void refreshWidget('app');
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshWidget('app');
    });
    return () => sub.remove();
  }, []);
}
