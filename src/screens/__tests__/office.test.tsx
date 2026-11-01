/**
 * The Office screen: the layout read once, the live rows polled at the pace the
 * server asks for, the card's way into a session - and no polling while the app
 * is in the background (the resilience rules).
 */
import * as React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, type WorkbenchClient } from '../../api/client';
import type { OfficeLayout, OfficeLiveAgent } from '../../api/types';
import { officeStrings } from '../../lib/officeStrings';
import { OfficeScreen } from '../OfficeScreen';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const NOW = Date.now() / 1000;

const LAYOUT: OfficeLayout = {
  company: { name: 'Acme', settings: {}, floors: ['f1'] },
  tile: 16,
  floors: [{ id: 'f1', name: 'Floor 1', order: 0, w: 20, h: 12 }],
  rooms: [
    { id: 'r-dep', floor: 'f1', name: 'Jev', kind: 'department', x: 0, y: 0, w: 6, h: 4, department: { manager: '', desks: 1 } },
    { id: 'r-kit', floor: 'f1', name: 'Kitchen', kind: 'kitchen', x: 7, y: 0, w: 3, h: 3 },
  ],
  items: [
    { id: 'i-a', room: 'r-dep', kind: 'chair', x: 1, y: 1, dir: 0 },
    { id: 'i-coffee', room: 'r-kit', kind: 'coffee', x: 8, y: 1, dir: 0 },
  ],
  seats: [{ agent: 'wbo:alice', item: 'i-a', room: 'r-dep', floor: 'f1', auto: false }],
  kinds: { rooms: [], items: [] },
};

const ROW: OfficeLiveAgent = {
  key: 'wbo:alice', name: 'Alice', kind: 'OpenCode', state: 'working', activity: 'typing',
  bubble: '', seat: { item: 'i-a', room: 'r-dep', floor: 'f1' }, since: NOW - 60, manager: null,
};

function client(over: Partial<Record<string, unknown>> = {}) {
  return {
    office: jest.fn(async () => LAYOUT),
    officeLive: jest.fn(async () => ({ agents: [ROW], live_s: 5 })),
    ...over,
  } as unknown as WorkbenchClient;
}

async function show(c: WorkbenchClient, onOpen = jest.fn()) {
  await render(<OfficeScreen client={c} t={officeStrings('en')} onOpen={onOpen} />);
  await act(async () => undefined);
  return onOpen;
}

beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
});

describe('the office screen', () => {
  it('reads the layout once, then the live rows, and draws the company', async () => {
    const c = client();
    await show(c);
    expect(c.office).toHaveBeenCalledTimes(1);
    expect(c.officeLive).toHaveBeenCalled();
    expect(screen.getByTestId('office-screen')).toBeTruthy();
    expect(screen.getByText('Office')).toBeTruthy();
    expect(screen.getByText('Floor 1 · 1 agent · Read only')).toBeTruthy();
    expect(screen.getByTestId('office-person-wbo:alice')).toBeTruthy();
  });

  it('shows the office’s own hour in the bar, and the hour’s light over the drawing', async () => {
    const c = client();
    await show(c);
    const clock = screen.getByTestId('office-clock');
    expect(clock).toBeTruthy();
    // Istanbul's wall clock, HH:MM (the phase itself is lib/office/daylight.ts's, tested there).
    expect(clock.props.children).toMatch(/^\d{2}:\d{2}$/);
    // Day or night: the wash is drawn only when the band is not the day's own.
    const hour = Number(String(clock.props.children).slice(0, 2));
    const day = hour >= 10 && hour < 17;
    expect(screen.queryByTestId('office-daylight') === null).toBe(day);
  });

  it('opens the session behind a tapped character', async () => {
    const c = client();
    const onOpen = await show(c);
    await fireEvent.press(screen.getByTestId('office-person-wbo:alice'));
    await fireEvent.press(screen.getByTestId('office-card-open'));
    expect(onOpen).toHaveBeenCalledWith('wbo:alice');
  });

  it('says so when the office cannot be read, and reads it again on Try again', async () => {
    const office = jest
      .fn()
      .mockRejectedValueOnce(new ApiError(500, 'The office is on fire.'))
      .mockResolvedValueOnce(LAYOUT);
    const c = client({ office });
    await show(c);
    expect(screen.getByTestId('office-error')).toBeTruthy();
    expect(screen.getByText('The office is on fire.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('office-error-retry'));
    await act(async () => undefined);
    expect(screen.getByTestId('office-person-wbo:alice')).toBeTruthy();
  });

  it('polls at the pace the server asks, and not while the app is behind another one', async () => {
    jest.useFakeTimers();
    const c = client();
    await render(<OfficeScreen client={c} t={officeStrings('en')} onOpen={jest.fn()} />);
    await act(async () => undefined);
    const calls = () => (c.officeLive as jest.Mock).mock.calls.length;
    expect(calls()).toBe(1);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    expect(calls()).toBe(2);

    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' });
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(calls()).toBe(2);

    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    expect(calls()).toBe(3);
    jest.useRealTimers();
  });

  it('says the office is quiet when no agent is connected', async () => {
    const c = client({ officeLive: jest.fn(async () => ({ agents: [], live_s: 10 })) });
    await show(c);
    expect(screen.getByTestId('office-empty')).toBeTruthy();
  });

  it('says how to pin an agent when the server says nothing is pinned', async () => {
    const c = client({ officeLive: jest.fn(async () => ({ agents: [], live_s: 10, pinned: 0 })) });
    await show(c);
    expect(screen.getByTestId('office-pin-prompt')).toBeTruthy();
  });
});
