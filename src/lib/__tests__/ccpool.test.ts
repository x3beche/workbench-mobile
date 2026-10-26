/** Settings > Claude pool without drawing it: meters, the ring's parts, the words of the tables. */
import type { PoolOverview } from '../../api/types';
import { ago, apiValue, meters, mySummary, pct, planSlices, poolShown, resetText, sessionName } from '../ccpool';
import { ccpoolStrings } from '../ccpoolStrings';

const en = ccpoolStrings('en');
const tr = ccpoolStrings('tr');
const NOW = 1_800_000_000_000;
const week = { requests: 0, in_tokens: 0, out_tokens: 0, cache_read: 0, cache_write: 0, total_tokens: 0, cost_usd: 0 };

const over = (o: Partial<PoolOverview> = {}): PoolOverview => ({
  me: { id: 'u1', name: 'Ada', role: 'user', privileged: false, keys: 1, usage: { ...week, cost_usd: 5 } },
  plan: {
    five_hour: { pct: 12.5, resets_at: NOW / 1000 + 2 * 3600 + 14 * 60 },
    seven_day: { pct: 41.2, resets_at: NOW / 1000 + 3 * 86400 },
    extra: [{ id: 'seven_day_opus', label: '7-day Opus', pct: 92, resets_at: null }],
    week_pct: 41.2,
    week_api_usd: 30,
    outside: { seven_day: 6.2, five_hour: 1 },
  },
  accounts: [
    { id: 'u1', name: 'Ada', email: '', mine: true, usage: week, week: { ...week, plan_pct: 25 } },
    { id: 'u2', name: 'Bo', email: '', mine: false, usage: week, week: { ...week, plan_pct: 10 } },
    { id: 'u3', name: 'Cem', email: '', mine: false, usage: week, week: { ...week, plan_pct: 0 } },
  ],
  my_sessions: [
    {
      session_id: 'abcdef123456',
      key_name: 'laptop',
      status: 'active',
      first_ts: 0,
      last_ts: 0,
      requests: 3,
      in_tokens: 1,
      out_tokens: 1,
      cache_read: 0,
      cache_write: 0,
      cost_usd: 3,
    },
    {
      session_id: 'zz',
      key_name: null,
      title: 'Rail',
      status: 'ended',
      first_ts: 0,
      last_ts: 0,
      requests: 1,
      in_tokens: 0,
      out_tokens: 0,
      cache_read: 0,
      cache_write: 0,
      cost_usd: 1,
    },
  ],
  my_hidden: { count: 0, cost_usd: 0 },
  gateway: { configured: true },
  ...o,
});

describe('the Claude pool', () => {
  it('writes percentages as the web does, the sign first in Turkish', () => {
    expect(pct(2.978, 'en')).toBe('2.98%');
    expect(pct(2.978, 'tr')).toBe('%2.98');
    expect(pct(null, 'en')).toBe('–');
    expect(apiValue({ cost_usd: 1234.5 })).toBe('$1,234.50');
    expect(apiValue({ cost_usd: 2, cost_estimated_usd: 1 })).toBe('≈$2.00');
    expect(apiValue({ cost_usd: 0 })).toBe('–');
  });

  it('draws the windows as meters, warn from 75 % and danger from 90 %, with when they start again', () => {
    const m = meters(over().plan, en, 'en', NOW);
    expect(m.map((x) => [x.label, x.text, x.tone])).toEqual([
      ['5-hour window', '12.50%', null],
      ['7-day window', '41.20%', null],
      ['7-day Opus', '92.00%', 'danger'],
    ]);
    expect(m[0].reset).toMatch(/^Starts again from 0 in 2 h 14 min, at /);
    expect(meters(over().plan, tr, 'tr', NOW)[2].label).toBe('7 günlük Opus');
    expect(resetText(NOW / 1000 - 5, tr, 'tr', NOW)).toBe('şimdi sıfırlanıyor');
  });

  it('splits the week into each person, Outside the pool and Unused', () => {
    expect(planSlices(over(), en)?.map((x) => [x.label, x.pct, x.color])).toEqual([
      ['Ada', 25, 0],
      ['Bo', 10, 1],
      ['Outside the pool', 6.2, 'dim'],
      ['Unused', 58.8, null],
    ]);
    expect(planSlices(over({ plan: { ...over().plan, week_pct: null } }), en)).toBeNull();
  });

  it('names sessions, says how long ago and sums up My sessions', () => {
    expect(sessionName(over().my_sessions[0])).toBe('abcdef12');
    expect(sessionName(over().my_sessions[1])).toBe('Rail');
    expect(ago(NOW / 1000 - 600, en, NOW)).toBe('10 min ago');
    expect(ago(NOW / 1000 - 7200, tr, NOW)).toBe('2 sa önce');
    expect(ago(0, en, NOW)).toBe('never');
    expect(mySummary(over(), en)).toBe('2 sessions · 1 active now · $4.00 · $1.00 outside sessions');
    expect(mySummary(over(), tr)).toBe('2 oturum · şu an 1 etkin · $4.00 · oturum dışında $1.00');
  });

  it('is shown only where the pool is set up', () => {
    expect(poolShown(over())).toBe(true);
    expect(poolShown(over({ gateway: { configured: false } }))).toBe(false);
    expect(poolShown(null)).toBe(false);
  });
});
