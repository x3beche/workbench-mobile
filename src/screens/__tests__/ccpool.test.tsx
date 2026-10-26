/** Settings > Claude pool on the phone: the meters, the ring and its people, My sessions; read-only. */
import * as React from 'react';
import { render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import type { PoolOverview } from '../../api/types';
import { ccpoolStrings } from '../../lib/ccpoolStrings';
import { CcpoolScreen } from '../CcpoolScreen';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const canRender = typeof (React as { act?: unknown }).act === 'function';
const week = {
  requests: 12,
  in_tokens: 1000,
  out_tokens: 2000,
  cache_read: 0,
  cache_write: 0,
  total_tokens: 3000,
  cost_usd: 4.5,
};
const data: PoolOverview = {
  me: { id: 'u1', name: 'Ada', role: 'user', privileged: false, keys: 1, usage: week },
  plan: {
    five_hour: { pct: 80, resets_at: null },
    seven_day: { pct: 41.2, resets_at: null },
    week_pct: 41.2,
    week_api_usd: 4.5,
    outside: { seven_day: 6.2 },
  },
  accounts: [
    {
      id: 'u1',
      name: 'Ada',
      email: '',
      mine: true,
      usage: { ...week, last_ts: 0 },
      week: { ...week, plan_pct: 35, plan5_pct: 4 },
    },
  ],
  my_sessions: [
    {
      session_id: 's1',
      key_name: 'laptop',
      title: 'Rail sag',
      status: 'active',
      first_ts: 0,
      last_ts: 0,
      requests: 12,
      prompts: 3,
      in_tokens: 1000,
      out_tokens: 2000,
      cache_read: 0,
      cache_write: 0,
      cost_usd: 4.5,
    },
  ],
  gateway: { configured: true },
};

(canRender ? describe : describe.skip)('Settings > Claude pool', () => {
  it('shows the windows, the week as a ring with its people, and My sessions, with nothing to change', async () => {
    const client = { ccpoolOverview: jest.fn(async () => data) } as unknown as WorkbenchClient;
    await render(
      <CcpoolScreen client={client} t={ccpoolStrings('en')} lang="en" initial={data} onClose={() => undefined} />,
    );
    expect(screen.getByTestId('ccpool-meter-five_hour')).toHaveTextContent(/5-hour window80.00%/);
    expect(screen.getByTestId('ccpool-ring')).toBeTruthy();
    expect(screen.getByTestId('ccpool-slice-outside')).toHaveTextContent('Outside the pool≈6.20%');
    expect(screen.getByTestId('ccpool-slice-unused')).toHaveTextContent('Unused58.80%');
    expect(screen.getByTestId('ccpool-people')).toHaveTextContent(/Ada · you/);
    expect(screen.getByTestId('ccpool-people')).toHaveTextContent(/≈35.00%/);
    expect(screen.getByTestId('ccpool-sessions')).toHaveTextContent(/Rail sag/);
    expect(screen.getByTestId('ccpool-sessions')).toHaveTextContent(/3 \/ 12/);
    expect(screen.queryByText(/Give a key|Connect/)).toBeNull();
  });
});
