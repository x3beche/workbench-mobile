/** The web top bar's Activity: the strip, its sheet, the range and what the strip shows, kept per account. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import { actSpan, readActPrefs } from '../../lib/activity';
import { ActivityStrip } from '../Activity';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));

/** The kept choices, then the answer: a few turns of the loop. */
const settle = async () => {
  await act(async () => undefined);
  await act(async () => undefined);
};

const canRender = typeof (React as { act?: unknown }).act === 'function';

const now = {
  at: 1,
  live: { tps: 42.4, by: { chat: 30, orchestrator: 12.4 }, window_s: 10 },
  jobs: { running: 2, queued: 1, agents: 1, total: 3, kinds: {} },
  machine: { cpu_pct: 12.2, mem_mb: 2048, sampled: true, parts: [{ kind: 'sandbox' as const, name: 'main', cpu_pct: 4, mem_mb: 900 }] },
};
function data(range: string) {
  return {
    ...now,
    range,
    t0: 1_700_000_000,
    step: 60,
    n: 3,
    series: { chat: [1000, 2000, 3000], claude: [0, 5000, 9_000_000] },
    total: { tokens: 18_011_000, input: 1_000_000, output: 500_000, calls: 120, by: { chat: 6000, claude: 18_005_000 } },
    claude: { prompts: 7, calls: 40, tokens: 9_005_000 },
  };
}
function client() {
  return {
    activity: jest.fn(async (r: string) => data(r)),
    activityNow: jest.fn(async () => now),
  } as unknown as WorkbenchClient;
}

describe('actSpan', () => {
  it('takes a number and m, h or d, from 1 minute to 30 days, as the web', () => {
    expect(actSpan('15m')).toBe(900);
    expect(actSpan(' 2H ')).toBe(7200);
    expect(actSpan('30d')).toBe(30 * 86400);
    expect(actSpan('31d')).toBeNull();
    expect(actSpan('0m')).toBeNull();
    expect(actSpan('15')).toBeNull();
    expect(actSpan('1w')).toBeNull();
  });
});

(canRender ? describe : describe.skip)('the Activity strip', () => {
  beforeEach(() => AsyncStorage.clear());

  it('shows tokens a second with a green dot, the range total, and opens the sheet', async () => {
    const c = client();
    await render(<ActivityStrip client={c} scope="acct-1" lang="en" />);
    await settle();
    expect(c.activity).toHaveBeenCalledWith('24h');
    expect(screen.getByTestId('activity-dot-on')).toBeTruthy();
    expect(screen.getByText('42.4')).toBeTruthy();
    expect(screen.getByText('18M')).toBeTruthy();
    expect(screen.getByText('tok · 24h')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('activity-strip'));
    expect(screen.getByTestId('activity-sheet')).toBeTruthy();
    expect(screen.getByText('in 1.0M · out 500k · cache 0')).toBeTruthy();
    expect(screen.getByText('Chat 30.0 · Orchestrator 12.4')).toBeTruthy();
    // One agent is an agent: the strip used to say "1 agents".
    expect(screen.getByText('2 running · 1 waiting · 1 agent')).toBeTruthy();
    expect(screen.getByText('1 container')).toBeTruthy();
    // Claude is there (a pool key); OpenCode had nothing in the range: no legend for it.
    expect(screen.getByTestId('activity-legend-claude')).toBeTruthy();
    expect(screen.queryByTestId('activity-legend-opencode')).toBeNull();

    // Another range: asked for, and kept for this account.
    await fireEvent.press(screen.getByTestId('activity-range-1h'));
    await settle();
    expect(c.activity).toHaveBeenLastCalledWith('1h');
    expect((await readActPrefs('acct-1')).range).toBe('1h');

    // One's own: a bad one is not taken, a good one is.
    await fireEvent.changeText(screen.getByTestId('activity-own-range'), '40x');
    await fireEvent(screen.getByTestId('activity-own-range'), 'submitEditing');
    await settle();
    expect(c.activity).toHaveBeenLastCalledWith('1h');
    await fireEvent.changeText(screen.getByTestId('activity-own-range'), '15m');
    await fireEvent(screen.getByTestId('activity-own-range'), 'submitEditing');
    await settle();
    expect(c.activity).toHaveBeenLastCalledWith('15m');

    // The strip without the tokens a second.
    await fireEvent.press(screen.getByTestId('activity-show-tps'));
    expect(screen.queryByTestId('activity-dot-on')).toBeNull();
    expect((await readActPrefs('acct-1')).show).not.toContain('tps');
  });

  it('speaks Turkish as the web does', async () => {
    await render(<ActivityStrip client={client()} scope="acct-2" lang="tr" />);
    await settle();
    expect(screen.getByText('çıkış token/sn')).toBeTruthy();
    expect(screen.getByText('tok · 24sa')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('activity-strip'));
    expect(screen.getByText('Etkinlik')).toBeTruthy();
    expect(screen.getByText('Şeritte gösterilenler')).toBeTruthy();
    expect(screen.getByText('Sohbet 30.0 · Orkestratör 12.4')).toBeTruthy();
  });

  it('is not there when the server has no Activity', async () => {
    const c = {
      activity: jest.fn(async () => {
        throw new Error('Not Found');
      }),
      activityNow: jest.fn(async () => {
        throw new Error('Not Found');
      }),
    } as unknown as WorkbenchClient;
    await render(<ActivityStrip client={c} scope="acct-3" lang="en" />);
    await settle();
    expect(screen.queryByTestId('activity-strip')).toBeNull();
  });
});
