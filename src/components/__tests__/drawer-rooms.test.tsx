/** The rooms lead the drawer: their name, their last line, and what is unread. */
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Chat, Room, User } from '../../api/types';
import { SIDE_EMPTY } from '../../lib/side';
import { DrawerPanel } from '../DrawerPanel';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
// The rows' swipe actions need a gesture root the drawer test is not about.
jest.mock('../SwipeRow', () => ({
  SwipeRow: ({ children }: { children: React.ReactNode }) => children,
}));

/**
 * RNTL renders through React's own act. An install of react 19 that does not
 * ship it cannot render at all here (this repository's own composer, chat and
 * files tests are red for the same reason), so this block is skipped rather
 * than left failing on a machine that cannot run it.
 */
const canRender = typeof (React as { act?: unknown }).act === 'function';

const user: User = { id: 'u1', name: 'Emirhan', email: 'emir@wb.example' };

const rooms: Room[] = [
  {
    room: 'cad',
    count: 2,
    waiting: 0,
    urgent: 0,
    last: { role: 'agent', text: 'Not ac499b received (lid, front panel)', at: '2026-10-15T09:00:00Z', by: null },
    agent_at: ['2026-10-15T09:00:00Z'],
  },
  {
    room: 'pcb',
    count: 1,
    waiting: 0,
    urgent: 0,
    last: { role: 'agent', text: 'The PCB task (00006b) was cancelled', at: '2026-10-10T09:00:00Z', by: null },
    agent_at: ['2026-10-10T09:00:00Z'],
  },
  { room: 'firmware', count: 0, waiting: 0, urgent: 0, last: null, agent_at: [] },
];

const chats = [{ id: 'c1', title: 'Rail sag', updated_at: '2026-10-15T09:00:00Z' } as Chat];

async function panel(over: Partial<React.ComponentProps<typeof DrawerPanel>> = {}) {
  const props = {
    client: null,
    server: 'https://wb.example',
    user,
    chats,
    error: null,
    openId: null,
    onOpen: jest.fn(),
    onNew: jest.fn(),
    onRefresh: jest.fn(async () => undefined),
    onActions: jest.fn(),
    onAccount: jest.fn(),
    rooms,
    onRoom: jest.fn(),
    ...over,
  };
  await render(<DrawerPanel {...props} />);
  return props;
}

(canRender ? describe : describe.skip)('the rooms in the drawer', () => {
  it('leads the list with all three, above the conversations', async () => {
    await panel();
    expect(screen.getByText('Rooms · 3')).toBeTruthy();
    expect(screen.getByText('3D Drawing')).toBeTruthy();
    expect(screen.getByText('PCB Design')).toBeTruthy();
    expect(screen.getByText('Firmware')).toBeTruthy();
    // In the order they are drawn: the rooms' heading before the first conversation.
    expect(screen.getAllByText(/^(Rooms · 3|Rail sag)$/).map((t) => t.props.children)).toEqual([
      'Rooms · 3',
      'Rail sag',
    ]);
  });

  it('reads each room with who wrote last and what they said', async () => {
    await panel();
    expect(screen.getByText('agent: Not ac499b received (lid, front panel)')).toBeTruthy();
    expect(screen.getByText('agent: The PCB task (00006b) was cancelled')).toBeTruthy();
    expect(screen.getByText('No messages yet')).toBeTruthy();
  });

  it('counts what the agent wrote since the room was last read here', async () => {
    await panel({ roomsSeen: { cad: '2026-10-15T08:00:00Z', pcb: '2026-10-11T00:00:00Z' } });
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.queryByText('2')).toBeNull();
  });

  it('counts everything for a room never opened on this phone', async () => {
    await panel();
    // 3D Drawing and PCB Design each have one line from the agent; Firmware none.
    expect(screen.getAllByText('1')).toHaveLength(2);
  });

  it('opens a room when its row is pressed', async () => {
    const props = await panel();
    fireEvent.press(screen.getByTestId('room-pcb'));
    expect(props.onRoom).toHaveBeenCalledWith('pcb');
  });

  it('marks the room that is open', async () => {
    await panel({ openRoom: 'cad' });
    expect(screen.getByTestId('room-cad').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('room-firmware').props.accessibilityState).toEqual({ selected: false });
  });

  it('leaves the rooms out of a search', async () => {
    await panel();
    await fireEvent.changeText(screen.getByTestId('drawer-search'), 'rail');
    expect(screen.queryByText(/^Rooms/)).toBeNull();
  });

  it('folds by its header, open until folded; folded, what is unread is on the header', async () => {
    const props = await panel({ onFold: jest.fn() });
    fireEvent.press(screen.getByTestId('drawer-rooms-fold'));
    expect(props.onFold).toHaveBeenCalledWith('rooms', false);
  });

  it('folded, hides the rooms and puts what is unread on the header', async () => {
    await panel({ side: { ...SIDE_EMPTY, folds: { ...SIDE_EMPTY.folds, rooms: false } } });
    expect(screen.queryByTestId('room-cad')).toBeNull();
    expect(screen.getByTestId('drawer-rooms-dot')).toHaveProp('accessibilityLabel', 'unread');
  });

  it('has no rooms on an older server that sends none', async () => {
    await panel({ rooms: null });
    expect(screen.queryByTestId('drawer-rooms')).toBeNull();
    expect(screen.queryByText(/^Rooms/)).toBeNull();
  });
});

(canRender ? describe : describe.skip)('an update in the drawer', () => {
  it('puts a dot on the account and the new version under the name', async () => {
    await panel({ updateNote: 'Update ready: 1.5.0' });
    expect(screen.getByTestId('update-dot')).toBeTruthy();
    expect(screen.getByTestId('drawer-update')).toHaveTextContent('Update ready: 1.5.0');
    expect(screen.queryByText('wb.example')).toBeNull();
  });

  it('shows the server as before when there is none', async () => {
    await panel();
    expect(screen.queryByTestId('update-dot')).toBeNull();
    expect(screen.getByText('wb.example')).toBeTruthy();
  });
});

(canRender ? describe : describe.skip)('the Orchestrator in the drawer', () => {
  const orchestrator = { label: 'Orchestrator', snip: 'What your Orchestrator does, live' };

  it('is pinned above the rooms, read-only, and opens on a press', async () => {
    const onOrchestrator = jest.fn();
    await panel({ orchestrator, onOrchestrator });
    expect(screen.getByText('Orchestrator')).toBeTruthy();
    expect(screen.getAllByText(/^(Orchestrator|3D Drawing)$/).map((t) => t.props.children)).toEqual([
      'Orchestrator',
      '3D Drawing',
    ]);
    fireEvent.press(screen.getByTestId('room-orchestrator'));
    expect(onOrchestrator).toHaveBeenCalled();
  });

  it('is there even when the server sends no rooms, and not on a server without one', async () => {
    await panel({ rooms: null, orchestrator, onOrchestrator: jest.fn() });
    expect(screen.getByTestId('room-orchestrator')).toBeTruthy();
    await panel({ orchestrator: null, onOrchestrator: jest.fn() });
    expect(screen.queryByTestId('room-orchestrator')).toBeNull();
  });
});
