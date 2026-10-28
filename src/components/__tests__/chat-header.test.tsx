/**
 * The bar every conversation is read under: one name in the middle, its own
 * buttons on the right, and the account's activity pulled out of it.
 */
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { WorkbenchClient } from '../../api/client';
import { ChatHeader } from '../ChatHeader';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

/** The kept choices, then the answer: a few turns of the loop. */
const settle = async () => {
  await act(async () => undefined);
  await act(async () => undefined);
};

const canRender = typeof (React as { act?: unknown }).act === 'function';

const now = {
  at: 1,
  live: { tps: 42.4, by: { chat: 30 }, window_s: 10 },
  jobs: { running: 0, queued: 0, agents: 0, total: 0, kinds: {} },
  machine: { cpu_pct: 12.2, mem_mb: 2048, sampled: true, parts: [] },
};
const data = {
  ...now,
  range: '24h',
  t0: 1_700_000_000,
  step: 60,
  n: 2,
  series: { chat: [1000, 2000] },
  total: { tokens: 18_011_000, input: 1_000_000, output: 500_000, calls: 12, by: { chat: 6000 } },
  claude: { prompts: 7, calls: 4, tokens: 9_005_000 },
};
const client = () =>
  ({
    activity: jest.fn(async () => data),
    activityNow: jest.fn(async () => now),
  }) as unknown as WorkbenchClient;

const bar = (extra: Record<string, unknown> = {}) => (
  <ChatHeader
    title="Rail sag"
    lang="en"
    client={client()}
    onMenu={jest.fn()}
    titleTestID="chat-title"
    right={<Text>close</Text>}
    {...extra}
  />
);

(canRender ? describe : describe.skip)('the bar a conversation is read under', () => {
  it('shows the name, the drawer button and its own buttons', async () => {
    await render(bar());
    expect(screen.getByTestId('chat-header')).toBeTruthy();
    expect(screen.getByText('Rail sag')).toBeTruthy();
    expect(screen.getByTestId('open-drawer')).toBeTruthy();
    expect(screen.getByText('close')).toBeTruthy();
  });

  it("turns to the account's activity on a tap, and back again", async () => {
    await render(bar());
    await settle();
    const page = () => screen.getByTestId('activity-page', { includeHiddenElements: true });
    expect(page().props.pointerEvents).toBe('none');

    await fireEvent.press(screen.getByTestId('chat-title'));
    expect(page().props.pointerEvents).toBe('auto');
    // It is the account's own strip, with what is going on now, in the bar itself.
    expect(screen.getByTestId('activity-strip')).toBeTruthy();
    expect(screen.getByText('42.4')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('activity-back'));
    expect(page().props.pointerEvents).toBe('none');
  });

  it('says nothing of the activity when there is none to tell', async () => {
    const empty = {
      activity: jest.fn(async () => {
        throw new Error('off');
      }),
      activityNow: jest.fn(async () => {
        throw new Error('off');
      }),
    } as unknown as WorkbenchClient;
    await render(<ChatHeader title="3D Drawing" lang="en" client={empty} />);
    await settle();
    expect(screen.queryByTestId('activity-strip')).toBeNull();
  });
});
