/**
 * The Office view: the rooms and the characters, the card a tap opens, the
 * card's way into the session - and no clock in the background (the resilience
 * rules: nothing is drawn behind another app).
 */
import * as React from 'react';
import { AppState } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { OfficeLayout, OfficeLiveAgent } from '../../api/types';
import { officeStrings } from '../../lib/officeStrings';
import { OfficeView } from '../OfficeView';

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
    { id: 'r-dep', floor: 'f1', name: 'Jev', kind: 'department', x: 0, y: 0, w: 6, h: 4, department: { manager: 'wbo:bob', desks: 2 } },
    { id: 'r-kit', floor: 'f1', name: 'Kitchen', kind: 'kitchen', x: 7, y: 0, w: 3, h: 3 },
    { id: 'r-lng', floor: 'f1', name: 'Lounge', kind: 'lounge', x: 10, y: 0, w: 3, h: 3 },
    { id: 'r-lob', floor: 'f1', name: 'Lobby', kind: 'lobby', x: 7, y: 4, w: 3, h: 3 },
    { id: 'r-park', floor: 'f1', name: 'Parking', kind: 'parking', x: 14, y: 0, w: 3, h: 3 },
  ],
  items: [
    { id: 'i-a', room: 'r-dep', kind: 'chair', x: 1, y: 1, dir: 0 },
    { id: 'i-b', room: 'r-dep', kind: 'chair', x: 3, y: 1, dir: 0 },
    { id: 'i-coffee', room: 'r-kit', kind: 'coffee', x: 8, y: 1, dir: 0 },
    { id: 'i-sofa', room: 'r-lng', kind: 'sofa', x: 11, y: 1, dir: 0 },
    { id: 'i-car', room: 'r-park', kind: 'car_spot', x: 15, y: 1, dir: 0 },
  ],
  seats: [
    { agent: 'wbo:alice', item: 'i-a', room: 'r-dep', floor: 'f1', auto: false },
    { agent: 'wbo:bob', item: 'i-b', room: 'r-dep', floor: 'f1', auto: false },
  ],
  kinds: { rooms: [], items: [] },
};

function row(over: Partial<OfficeLiveAgent> = {}): OfficeLiveAgent {
  return {
    key: 'wbo:alice', name: 'Alice', kind: 'OpenCode', state: 'working', activity: 'typing',
    bubble: '', seat: { item: 'i-a', room: 'r-dep', floor: 'f1' }, since: NOW - 60, manager: null,
    ...over,
  };
}

async function show(live: OfficeLiveAgent[] | null, onOpen = jest.fn()) {
  await render(<OfficeView layout={LAYOUT} live={live} t={officeStrings('en')} onOpen={onOpen} />);
  return onOpen;
}

beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
});

describe('the office view', () => {
  it('draws the rooms and a character per agent, and says nothing is happening when there is nobody', async () => {
    await show([row(), row({ key: 'wbo:bob', name: 'Bob', activity: 'break', since: NOW - 60 })]);
    expect(screen.getByTestId('office-view')).toBeTruthy();
    expect(screen.getByTestId('office-person-wbo:alice')).toBeTruthy();
    expect(screen.getByTestId('office-person-wbo:bob')).toBeTruthy();
    expect(screen.getByText('Jev')).toBeTruthy();
    expect(screen.getByText('Kitchen')).toBeTruthy();
    expect(screen.queryByTestId('office-empty')).toBeNull();
    expect(screen.getByText(/Pinch to zoom/)).toBeTruthy();
  });

  it('says the office is quiet when no agent is connected', async () => {
    await show([]);
    expect(screen.getByTestId('office-empty')).toBeTruthy();
    expect(screen.getByText('The office is quiet')).toBeTruthy();
  });

  it('opens a card on a tap: the name, what it does and the task with its share', async () => {
    const onOpen = await show([
      row({ activity: 'typing', state: 'working', task: { id: 't1', title: 'Ship the office', status: 'working', progress: 40 } }),
    ]);
    await fireEvent.press(screen.getByTestId('office-person-wbo:alice'));
    expect(screen.getByTestId('office-card')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('working at its desk · working')).toBeTruthy();
    expect(screen.getByText('Task: Ship the office')).toBeTruthy();
    expect(screen.getByText('~40%')).toBeTruthy();
    expect(screen.getByTestId('office-card-progress')).toBeTruthy();
    // A plain percent is not a measured estimate: no "time left" is invented for it.
    expect(screen.queryByText(/left$/)).toBeNull();

    await fireEvent.press(screen.getByTestId('office-card-open'));
    expect(onOpen).toHaveBeenCalledWith('wbo:alice');
  });

  it('closes the card with its X or a tap on the floor', async () => {
    await show([row()]);
    await fireEvent.press(screen.getByTestId('office-person-wbo:alice'));
    await fireEvent.press(screen.getByTestId('office-card-close'));
    expect(screen.queryByTestId('office-card')).toBeNull();

    await fireEvent.press(screen.getByTestId('office-person-wbo:alice'));
    await fireEvent.press(screen.getByTestId('office-floor'));
    expect(screen.queryByTestId('office-card')).toBeNull();
  });

  it('says there is no task when the agent has none, in Turkish too', async () => {
    await render(<OfficeView layout={LAYOUT} live={[row()]} t={officeStrings('tr')} onOpen={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('office-person-wbo:alice'));
    expect(screen.getByText('Açık görev yok')).toBeTruthy();
    expect(screen.getByText('Oturumu aç')).toBeTruthy();
  });

  it('shows the director’s work on the card: the Jev mark, its word, the mood and the "?"', async () => {
    await show([
      row({
        activity: 'typing', state: 'working', by: 'jev', confidence: 0.82, detail: 'debugging the rail',
        mood: { name: 'focused', level: 1 }, needs_manager: true, bubble: '?',
        task: {
          id: 't1', title: 'Ship the office', status: 'working',
          progress: { percent: 62, spread: 4, eta: '15-60m', at: 1_700_000_000, model: 'typesafe/jev' },
        },
      }),
    ]);
    // The "?" is over the head before any tap, and the card repeats it in words.
    expect(screen.getByTestId('office-asks-wbo:alice', { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('office-person-wbo:alice'));
    expect(screen.getByTestId('office-card-jev')).toBeTruthy();
    expect(screen.getByText('Jev · 82%')).toBeTruthy();
    expect(screen.getByText('working at its desk · working · focused')).toBeTruthy();
    expect(screen.getByTestId('office-card-detail')).toHaveTextContent('debugging the rail');
    expect(screen.getByTestId('office-card-asks')).toHaveTextContent('? wants you');
    // The share, its "~", and the time left from the same measurement.
    expect(screen.getByText('~62% · ~15-60m left')).toBeTruthy();
  });

  it('draws the row of the free rules without a Jev mark or a "?"', async () => {
    await show([row()]);
    expect(screen.queryByTestId('office-asks-wbo:alice', { includeHiddenElements: true })).toBeNull();
    await fireEvent.press(screen.getByTestId('office-person-wbo:alice'));
    expect(screen.queryByTestId('office-card-jev')).toBeNull();
    expect(screen.queryByTestId('office-card-asks')).toBeNull();
    expect(screen.queryByTestId('office-card-detail')).toBeNull();
  });

  it('puts the office’s hour over the drawing: a wash at night, nothing at noon', async () => {
    await render(<OfficeView layout={LAYOUT} live={[row()]} t={officeStrings('en')} onOpen={jest.fn()} phase="night" />);
    expect(screen.getByTestId('office-daylight')).toBeTruthy();
    await render(<OfficeView layout={LAYOUT} live={[row()]} t={officeStrings('en')} onOpen={jest.fn()} phase="day" />);
    expect(screen.queryByTestId('office-daylight')).toBeNull();
  });

  it('draws a car instead of a character while an agent drives in', async () => {
    await show([row({ activity: 'arrive', since: Date.now() / 1000 - 0.2 })]);
    expect(screen.getByTestId('office-car-wbo:alice', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('office-person-wbo:alice')).toBeNull();
  });

  it('keeps a clock only while someone walks, and none at all in the background', async () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(global, 'setInterval');
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' });
    const first = spy.mock.calls.length;
    await show([row({ activity: 'break', since: Date.now() / 1000 })]);
    expect(spy.mock.calls.filter(([, ms]) => ms === 120)).toHaveLength(0);
    expect(spy.mock.calls.length).toBe(first);

    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
    await show([row({ activity: 'break', since: Date.now() / 1000 })]);
    expect(spy.mock.calls.some(([, ms]) => ms === 120)).toBe(true);
    jest.useRealTimers();
  });
});
