/**
 * A character's task on its card (lib/office/task.ts): the share and the time left, from the app's own
 * `TaskProgress` - or a plain percent on a row from an older server.
 */
import { shareOf } from '../office/task';

describe('the card’s task share', () => {
  it('reads a measured share: the percent, its spread and the time left', () => {
    expect(shareOf({
      id: 't1', title: 'Ship it', status: 'working',
      progress: { percent: 17, spread: 15.4, eta: '15-60m', at: 1_700_000_000, model: 'typesafe/jev' },
    })).toEqual({ percent: 17, spread: 15, eta: '15-60m' });
  });

  it('reads a plain percent, and says nothing of a spread or a bucket it does not have', () => {
    expect(shareOf({ id: 't1', title: 'Ship it', status: 'working', progress: 40 })).toEqual({
      percent: 40, spread: null, eta: null,
    });
  });

  it('takes a spread at most 1 as a fraction, as the Team sheet does', () => {
    expect(shareOf({
      id: 't', title: 't', status: 'w', progress: { percent: 50, spread: 0.25, at: 0, model: 'm' },
    })?.spread).toBe(25);
  });

  it('keeps the percent whole and inside 0-100', () => {
    expect(shareOf({ id: 't', title: 't', status: 'w', progress: { percent: 61.6, spread: 2, at: 0, model: 'm' } })?.percent).toBe(62);
    expect(shareOf({ id: 't', title: 't', status: 'w', progress: -4 })?.percent).toBe(0);
    expect(shareOf({ id: 't', title: 't', status: 'w', progress: 400 })?.percent).toBe(100);
  });

  it('draws nothing when there is no progress, or one it cannot read', () => {
    expect(shareOf(null)).toBeNull();
    expect(shareOf({ id: 't', title: 't', status: 'w' })).toBeNull();
    expect(shareOf({ id: 't', title: 't', status: 'w', progress: null })).toBeNull();
    expect(shareOf({ id: 't', title: 't', status: 'w', progress: { at: 0 } as never })).toBeNull();
    // A bucket the app does not know is not invented into one.
    expect(shareOf({
      id: 't', title: 't', status: 'w', progress: { percent: 30, spread: 1, eta: '2 days', at: 0, model: 'm' } as never,
    })?.eta).toBeNull();
  });
});
