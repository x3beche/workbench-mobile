/** Analytics: each section from the route the web app reads; the server's own only for the owner and admins. */
import * as React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import { orchStrings } from '../../lib/orchStrings';
import { settingsStrings } from '../../lib/settingsStrings';
import { setAppLanguage, uiLang } from '../../update/strings';
import { AnalyticsScreen } from '../AnalyticsScreen';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const canRender = typeof (React as { act?: unknown }).act === 'function';
const missing = async () => {
  throw new Error('Not Found');
};

function client(over: Partial<Record<string, unknown>> = {}) {
  return {
    llmSummary: jest.fn(async () => ({
      days: 14,
      month: { calls: 120, input: 1, output: 1, tokens: 2_400_000, cost_usd: 3.5, unpriced_calls: 0, providers: 1 },
      today: { calls: 4, tokens: 12_000, cost_usd: 0.1, answers: 3 },
      answers: { n: 3, tps_median: 61, ttft_ms_median: 900 },
      by_day: [
        { day: '2026-10-19', calls: 3, tokens: 1000, cost_usd: 0.1, by: { openrouter: 1000 } },
        { day: '2026-10-20', calls: 1, tokens: 500, cost_usd: 0.05, by: { openrouter: 500 } },
      ],
      providers: [{ id: 'openrouter', name: 'OpenRouter' }],
    })),
    llmUsage: jest.fn(missing),
    toolsUsage: jest.fn(async () => ({
      tools: { part_search: { uses: 9, done: 8, week: 5, week_done: 5 } },
      mine: 5,
      days: [{ day: '2026-10-20', by: { part_search: 5 } }],
    })),
    orchestrator: jest.fn(missing),
    orchestratorIncidents: jest.fn(missing),
    myPool: jest.fn(missing),
    adminPool: jest.fn(missing),
    adminSandboxes: jest.fn(missing),
    ...over,
  } as unknown as WorkbenchClient;
}

(canRender ? describe : describe.skip)('Analytics', () => {
  it('shows the models and the tools, and leaves out what the server does not have', async () => {
    const c = client();
    await render(<AnalyticsScreen client={c} t={settingsStrings('en')} ot={orchStrings('en')} lang="en" />);
    await act(async () => undefined);
    expect(screen.getByTestId('analytics-models')).toBeTruthy();
    // As the web's Models card: the month's tokens large, its calls at the right, under the LLM group.
    expect(screen.getByTestId('group-llm')).toBeTruthy();
    expect(screen.getByText('LLM')).toBeTruthy();
    expect(screen.getByText('2.4M')).toBeTruthy();
    expect(screen.getByText('120 calls')).toBeTruthy();
    expect(screen.getByText(/Today 12k tok · 3 answers/)).toBeTruthy();
    expect(screen.getByTestId('analytics-tools')).toBeTruthy();
    expect(screen.queryByTestId('analytics-spend')).toBeNull();
    expect(screen.queryByTestId('analytics-orchestrator')).toBeNull();
    // Not an admin: the server's pool and the sandboxes are not asked for.
    expect(c.adminPool).not.toHaveBeenCalled();
    expect(c.adminSandboxes).not.toHaveBeenCalled();
  });

  it('asks for the sandboxes and the whole pool for the owner and the admins, in Turkish', async () => {
    const c = client({
      adminSandboxes: jest.fn(async () => ({
        sandboxes: [{ id: 's1', name: 'Ada', email: null, env_name: 'main', state: 'running', usage: { cpu_pct: 3, mem_mb: 900, disk_mb: 1 }, last_active: null }],
        running: 1,
        max_running: 4,
      })),
    });
    await render(<AnalyticsScreen client={c} t={settingsStrings('tr')} ot={orchStrings('tr')} lang="tr" admin />);
    await act(async () => undefined);
    expect(c.adminSandboxes).toHaveBeenCalled();
    expect(screen.getByTestId('group-server')).toBeTruthy();
    expect(screen.getByText('Sunucu')).toBeTruthy();
    expect(screen.getByText('1/4')).toBeTruthy();
    expect(screen.getByText('Modeller')).toBeTruthy();
  });
});

describe('the language of the app', () => {
  afterEach(() => setAppLanguage(null));
  it('is the one chosen in Settings, whatever the voice; on Auto the voice, then the phone', () => {
    expect(uiLang('auto', 'tr-TR')).toBe('tr');
    setAppLanguage('en');
    expect(uiLang('tr', 'tr-TR')).toBe('en');
    setAppLanguage(null);
    expect(uiLang('en', 'tr-TR')).toBe('en');
  });
});
