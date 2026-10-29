/** What the home screen widget counts: the web Chat tab's two cards, from the same two routes. */
import type { LlmSummary, ToolsUsage } from '../../api/types';
import { modelDays, snapshotOf, toolDays, toolKinds, toolSwitchboard, toolWeek } from '../data';

const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`;

const summary = (days: LlmSummary['by_day'], providers?: { id: string; name: string }[]): LlmSummary => ({
  days: days.length,
  month: { calls: 9807, input: 0, output: 0, tokens: 2_190_000_000, cost_usd: 12, unpriced_calls: 0, providers: 2 },
  today: { calls: 40, tokens: 96_800_000, cost_usd: null, answers: 9 },
  answers: { n: 9, tps_median: 44, ttft_ms_median: 700 },
  by_day: days,
  providers,
});

const usage = (days: ToolsUsage['days'], tools: ToolsUsage['tools'], external?: ToolsUsage['external']): ToolsUsage => ({
  tools,
  mine: 0,
  days,
  span: 'month',
  external,
});

describe('the models card', () => {
  it('draws each day by provider, in the server order', () => {
    const days = modelDays(
      summary(
        [
          { day: day(1), calls: 1, tokens: 90, cost_usd: null, by: { a: 60, b: 30 } },
          { day: day(2), calls: 1, tokens: 10, cost_usd: null, by: { a: 10 } },
        ],
        [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ],
      ),
    );
    expect(days).toEqual([
      [60, 30],
      [10, 0],
    ]);
  });

  it('falls back to the day whole when the server names no providers', () => {
    expect(modelDays(summary([{ day: day(1), calls: 1, tokens: 90, cost_usd: null }]))).toEqual([[90]]);
  });

  it('keeps the last fourteen days, as the chart draws fourteen bars', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ day: day(i + 1), calls: 1, tokens: i, cost_usd: null }));
    expect(modelDays(summary(many))).toHaveLength(14);
    expect(modelDays(summary(many))[13]).toEqual([19]);
  });
});

describe('the tools card', () => {
  const days: ToolsUsage['days'] = [
    { day: day(1), by: { Read: 3, Bash: 2 } },
    { day: day(2), by: { Read: 1 } },
  ];

  it('draws each day by source: the Chat, Claude Code, OpenCode', () => {
    expect(
      toolDays(usage(days, {}, { claude: { tools: {}, days: { [day(1)]: { Edit: 4 } } }, opencode: null })),
    ).toEqual([
      [5, 4, 0],
      [1, 0, 0],
    ]);
  });

  it('adds every source up for the week, and counts the tools once', () => {
    const u = usage(
      days,
      { Read: { uses: 9, done: 9, week: 4 }, Bash: { uses: 3, done: 3, week: 2 }, Old: { uses: 1, done: 1, week: 0 } },
      {
        claude: { tools: { Edit: { uses: 5, week: 3 } }, days: {} },
        opencode: { tools: { Test: { uses: 2, week: 2 }, Read: { uses: 1, week: 0 } }, days: {} },
      },
    );
    expect(toolWeek(u)).toBe(11);
    expect(toolKinds(u)).toBe(4);
  });

  it('reads nothing outside the Chat when there is none', () => {
    expect(toolWeek(usage(days, { Read: { uses: 2, done: 2, week: 2 } }))).toBe(2);
    expect(toolKinds(usage(days, {}))).toBe(0);
  });
});

describe('the snapshot', () => {
  it('carries the month, the week and both charts', () => {
    const snap = snapshotOf(
      summary([{ day: day(1), calls: 1, tokens: 90, cost_usd: null }]),
      usage([{ day: day(1), by: { Read: 3 } }], { Read: { uses: 3, done: 3, week: 3 } }),
      null,
      7,
    );
    expect(snap).toEqual({
      at: 7,
      models: { tokens: 2_190_000_000, calls: 9807, days: [[90]] },
      tools: { week: 3, kinds: 1, on: 0, total: 0, days: [[3, 0, 0]] },
    });
  });

  it('counts the tools that are on, out of all of them, when the list was read', () => {
    const tools = [
      { name: 'read', label: 'Read', default: true, on: true },
      { name: 'bash', label: 'Bash', default: true, on: false },
      { name: 'edit', label: 'Edit', default: false, on: true },
    ];
    expect(toolSwitchboard(tools)).toEqual({ on: 2, total: 3 });
    const snap = snapshotOf(
      summary([{ day: day(1), calls: 1, tokens: 1, cost_usd: null }]),
      usage([], {}),
      tools,
    );
    expect([snap.tools.on, snap.tools.total]).toEqual([2, 3]);
  });
});
