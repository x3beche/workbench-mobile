/** Settings > Server health on the phone (src/screens/settings/ServerHealthPage.tsx): the
 *  verdict, the figures, the events with what they broke - and the server's answer that it
 *  cannot read a source is said, not hidden. */
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import type { HostHealth } from '../../api/types';
import { ServerHealthPage } from '../settings/ServerHealthPage';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../../components/KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));

const canRender = typeof (React as { act?: unknown }).act === 'function';

function data(range: string): HostHealth {
  const n = 24;
  return {
    now: {
      at: 1,
      sample: {
        psi_mem_full60: 12.5, psi_mem_some60: 20, psi_mem_full10: 9, psi_io_full60: 0.4, psi_cpu_some60: 1,
        avail_gb: 9.4, swap_used_pct: 99.9, oom_kill: 220, temp_max: 85, temp_cpu: 85, temp_gpu: 39,
        disk_pct: 34.4, load1: 4.45, uptime_s: 676_892,
      },
      uptime_s: 676_892, boot_id: 'b1', load: [4.45, 6.64, 5.03],
      disks: { '/': { total_gb: 1966, free_gb: 1619.8, pct: 34.4 } },
      unreadable: ['edac'],
    },
    thresholds: { psi_mem_full60: 10, mem_avail_gb: 1, swap_used_pct: 90, disk_pct: 90, temp_c: 90 },
    verdict: { tone: 'danger', quiet: false, en: 'In the last 7 days: 1 unexpected restart(s), 1 OOM kill(s).',
               tr: 'Son 7 günde: 1 beklenmedik yeniden başlama, 1 OOM.' },
    series: { range, t0: 0, step: 60, n, psi: Array(n).fill(3), avail: Array(n).fill(9), temp: Array(n).fill(60) },
    events: [
      { id: 'e1', kind: 'oom', title: 'Out of memory: the kernel killed 3 process(es)',
        at: '2026-10-22T17:46:00Z', detail: 'the kernel killed 3', source: 'host',
        impact: { counts: { orchestrator: 2, sandboxes: 1, jobs: 0 }, total: 3 } },
      { id: 'e2', kind: 'restart', title: 'Unexpected restart', at: '2026-10-20T10:41:00Z',
        detail: 'no clean shutdown', source: 'derived', impact: { counts: { orchestrator: 3 }, total: 3 } },
    ],
    sources: [
      { id: 'psi', label: 'Memory, CPU and IO pressure (PSI)', ok: true, why: null },
      { id: 'edac', label: 'Hardware memory errors (EDAC)', ok: false, why: 'this machine has no EDAC controller' },
    ],
    cost: { samples: 12, cpu_ms: 3.5, avg_ms: 3.8 },
    containers: [],
  };
}

function client() {
  return {
    serverHealth: jest.fn(async (r: string) => data(r)),
  } as unknown as WorkbenchClient;
}

(canRender ? describe : describe.skip)('Server health, on the phone', () => {
  it('draws the verdict, the figures and the events, and says what it cannot read', async () => {
    const c = client();
    await render(
      <ServerHealthPage client={c} lang="en" onBack={() => undefined} backLabel="Back"
                        title="Server health" about="The server itself" />,
    );
    await act(async () => undefined);
    expect(c.serverHealth).toHaveBeenCalledWith('7d', 7);
    expect(screen.getByText('In the last 7 days: 1 unexpected restart(s), 1 OOM kill(s).')).toBeTruthy();
    expect(screen.getByText('9.4 GB')).toBeTruthy();       // available memory
    expect(screen.getByText('220')).toBeTruthy();           // OOM kills
    expect(screen.getByText('Out of memory: the kernel killed 3 process(es)')).toBeTruthy();
    // What it broke, and which rows are the app's own records rather than the kernel's.
    expect(screen.getByText('2 Orchestrator crashes · 1 sandboxes stopped')).toBeTruthy();
    expect(screen.getByTestId('server-health-chart')).toBeTruthy();
    // A source this server cannot read is said, never shown as a zero.
    expect(screen.getByText(/Hardware memory errors \(EDAC\): not readable here/)).toBeTruthy();
    // The range asks for its own days.
    await fireEvent.press(screen.getByTestId('server-health-range-24h'));
    await act(async () => undefined);
    expect(c.serverHealth).toHaveBeenLastCalledWith('24h', 1);
  });

  it('speaks Turkish, and says so when nothing went wrong', async () => {
    const quiet = {
      serverHealth: jest.fn(async (r: string) => {
        const d = data(r);
        return { ...d, events: [], verdict: { ...d.verdict, tone: 'ok' as const, tr: 'Son 7 günde sorun yok: yeniden başlama, OOM ya da donma yok.' } };
      }),
    } as unknown as WorkbenchClient;
    await render(
      <ServerHealthPage client={quiet} lang="tr" onBack={() => undefined} backLabel="Geri"
                        title="Sunucu sağlığı" about="Sunucunun kendisi" />,
    );
    await act(async () => undefined);
    expect(screen.getByText('Son 7 günde sorun yok: yeniden başlama, OOM ya da donma yok.')).toBeTruthy();
    expect(screen.getByText('Bu dönemde bir şey ters gitmedi.')).toBeTruthy();
    expect(screen.getByText('Kullanılabilir bellek')).toBeTruthy();
  });
});
