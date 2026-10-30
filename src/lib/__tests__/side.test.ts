/** The drawer's session groups folded and pinned as the web's Chat list: the person's choice, else open while live. */
import type { SidePrefs } from '../../api/types';
import {
  FOLD_FIRST,
  isOpen,
  isPinned,
  pinnedFirst,
  SIDE_EMPTY,
  visibleRows,
  withDetail,
  withFold,
  withPin,
  withPanel,
  panelOpen,
  withRoomsFold,
} from '../side';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);
const id = (x: string) => x;

describe('folding and pins', () => {
  it('is open by the default rule until the person chooses, then as chosen', () => {
    expect(isOpen(SIDE_EMPTY, 'claude', true)).toBe(true);
    expect(isOpen(SIDE_EMPTY, 'claude', false)).toBe(false);
    const folded = withFold(SIDE_EMPTY, 'claude', false);
    expect(isOpen(folded, 'claude', true)).toBe(false);
    expect(isOpen(folded, 'opencode', true)).toBe(true);
    expect(isOpen(withFold(folded, 'claude', null), 'claude', true)).toBe(true);
  });

  it('puts the pinned first in the order pinned, newest pin first', () => {
    let p: SidePrefs = withPin(SIDE_EMPTY, 'opencode', 's3', true);
    p = withPin(p, 'opencode', 's5', true);
    expect(p.pins.opencode).toEqual(['s5', 's3']);
    expect(pinnedFirst(p, 'opencode', ids(7), id).slice(0, 3)).toEqual(['s5', 's3', 's0']);
    expect(isPinned(p, 'claude', 's3')).toBe(false);
    expect(withPin(p, 'opencode', 's5', false).pins.opencode).toEqual(['s3']);
  });

  it('shows the pinned only while folded; open, the pinned, the newest five and the open one', () => {
    const p = withPin(SIDE_EMPTY, 'claude', 's8', true);
    const rows = ids(10);
    expect(visibleRows(p, 'claude', rows, id, false, null, false)).toEqual(['s8']);
    const open = visibleRows(p, 'claude', rows, id, true, 's9', false);
    expect(open).toEqual(['s8', 's0', 's1', 's2', 's3', 's4', 's9']);
    expect(open.length - 2).toBe(FOLD_FIRST);
    expect(visibleRows(p, 'claude', rows, id, true, null, true)).toHaveLength(10);
  });

  it('keeps the rooms open until folded, and their fold on the phone while the server cannot keep it', () => {
    expect(isOpen(SIDE_EMPTY, 'rooms', true)).toBe(true);
    // an older server says nothing of the rooms: the phone's choice holds
    expect(withRoomsFold(SIDE_EMPTY, { open: false, pending: true }).folds.rooms).toBe(false);
    // the server keeps it: its word, once nothing is waiting to be told
    const kept = withFold(SIDE_EMPTY, 'rooms', true);
    expect(withRoomsFold(kept, { open: false, pending: false }).folds.rooms).toBe(true);
    expect(withRoomsFold(kept, { open: false, pending: true }).folds.rooms).toBe(false);
    expect(withRoomsFold(kept, null)).toBe(kept);
  });

  it("starts at the Chat's normal detail, and keeps the stop chosen", () => {
    expect(SIDE_EMPTY.chat).toEqual({ detail: 'normal' });
    const compact = withDetail(SIDE_EMPTY, 'compact');
    expect(compact.chat.detail).toBe('compact');
    // The other side prefs are not disturbed, and neither are they by it.
    expect(compact.pins).toEqual(SIDE_EMPTY.pins);
    expect(withFold(compact, 'claude', false).chat.detail).toBe('compact');
    expect(withPin(compact, 'claude', 's1', true).chat.detail).toBe('compact');
    expect(withDetail(withFold(SIDE_EMPTY, 'rooms', false), 'detailed')).toEqual({
      pins: { claude: [], opencode: [] },
      folds: { claude: null, opencode: null, rooms: false },
      chat: { detail: 'detailed' },
      panel: {},
    });
    // A section of a session's column: folded by the person, open until they do.
    expect(panelOpen(SIDE_EMPTY, 'files')).toBe(true);
    expect(panelOpen(withPanel(SIDE_EMPTY, 'files', false), 'files')).toBe(false);
    expect(withPanel(SIDE_EMPTY, 'files', false).chat.detail).toBe('normal');
  });
});
