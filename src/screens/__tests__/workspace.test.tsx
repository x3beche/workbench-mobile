import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { BackHandler, StyleSheet } from 'react-native';

import type { Chat, ChatScope, Ideas, Room } from '../../api/types';
import { ApiError } from '../../api/client';
import * as share from '../../lib/share';
import { motion } from '../../theme/tokens';
import { STARTERS, suggestionsFrom, Workspace } from '../Workspace';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
// The spacer follows the native keyboard frame; there is none here.
jest.mock('../../components/KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));
jest.mock('../../lib/share', () => ({
  shareFile: jest.fn(async () => undefined),
  sharePdf: jest.fn(async () => undefined),
  saveFile: jest.fn(async () => 'Downloads'),
  canSave: false,
}));
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => ({ uri: null, prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn() }),
}));

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const listed = (id: string, title: string, min: number, extra: Partial<Chat> = {}) =>
  ({
    id,
    title,
    provider: 'openrouter',
    model: 'a/b',
    created_at: ago(min),
    updated_at: ago(min),
    count: 2,
    ...extra,
  }) as Chat;

const CHATS = [
  listed('c1', 'Rail sag', 5),
  listed('c2', 'Enclosure walls', 60 * 24 * 1.2),
  listed('c3', 'Stepper heat', 60 * 24 * 40),
  listed('c0', 'Bring-up', 60 * 24 * 3, { pinned: true }),
];

const IDEAS: Ideas = {
  source: 'llm',
  start: { provider: 'openrouter', model: 'anthropic/claude-sonnet-4.5' },
  items: [
    { kind: 'pcb', text: 'Why does the rail sag?' },
    { kind: 'firmware', text: 'Add a watchdog to the updater.' },
  ],
};

const full = (c: Chat): Chat => ({
  ...c,
  messages: [
    { id: `${c.id}-q`, role: 'user', content: `Question in ${c.title}`, at: c.updated_at, by: { id: 'u1' } },
    { id: `${c.id}-a`, role: 'assistant', content: `Answer in ${c.title}`, at: c.updated_at, model: c.model },
  ],
});

/** The server's lists: what the tests made, archived or deleted changes them. */
let mockChats: Chat[] = [];
let mockArchived: Chat[] = [];
let mockTrash: Chat[] = [];

const mockClient = {
  authState: jest.fn(async () => ({ mode: 'on', user: null, role: 'owner', can: ['view', 'draw', 'delete'] })),
  listChats: jest.fn(async (q = '', scope: ChatScope = 'live') =>
    (scope === 'trash' ? mockTrash : scope === 'archived' ? mockArchived : mockChats).filter(
      (c) => !q || c.title.toLowerCase().includes(String(q).toLowerCase()),
    ),
  ),
  ideas: jest.fn(async (): Promise<Ideas | null> => IDEAS),
  // The workspace's rooms (1.3.0): none here, as from an older server - the drawer test covers them.
  rooms: jest.fn(async (): Promise<Room[]> => []),
  // A room's thread, for the room the app opens into below.
  roomHistory: jest.fn(async () => []),
  // The Orchestrator (1.5.4): none here, as from an older server - the drawer and lib tests cover it.
  orchestrator: jest.fn(async () => {
    throw new Error('Not Found');
  }),
  // The Claude sessions (1.6.0): none here, as from an older server - claude-session.test.tsx covers them.
  wbcSessions: jest.fn(async () => {
    throw new Error('Not Found');
  }),
  // The OpenCode sessions and the groups' pins and folds (1.6.1): none, as an older server - opencode-session.test.tsx covers them.
  wboSessions: jest.fn(async () => {
    throw new Error('Not Found');
  }),
  side: jest.fn(async () => {
    throw new Error('Not Found');
  }),
  /** How much of an answer the Chat shows (Settings > Chat): kept for the person. */
  sideChat: jest.fn(async (detail: 'compact' | 'normal' | 'detailed') => ({
    pins: { claude: [], opencode: [] },
    folds: { claude: null, opencode: null, rooms: null },
    chat: { detail },
  })),
  // Settings > Claude pool (1.6.2): not set up here - no row; ccpool.test.tsx covers it.
  ccpoolOverview: jest.fn(async () => {
    throw new Error('Not Found');
  }),
  getChat: jest.fn(async (id: string) => full(CHATS.find((c) => c.id === id) ?? listed(id, 'Gone', 1))),
  live: jest.fn(async () => undefined),
  createChat: jest.fn(async (provider?: string, model?: string) => {
    const made = listed('n1', 'New conversation', 0, { provider: provider ?? 'p', model: model ?? 'm' });
    mockChats = [made, ...mockChats];
    return made;
  }),
  say: jest.fn(async () => ({ queued: null })),
  rename: jest.fn(async (id: string, title: string) => ({ ...CHATS.find((c) => c.id === id)!, title })),
  archive: jest.fn(async (id: string, on = true) => {
    const c = [...mockChats, ...mockArchived].find((x) => x.id === id)!;
    mockChats = mockChats.filter((x) => x.id !== id);
    mockArchived = mockArchived.filter((x) => x.id !== id);
    if (on) mockArchived.push({ ...c, archived: true });
    else mockChats.push({ ...c, archived: false });
    return c;
  }),
  pin: jest.fn(async (id: string, pinned: boolean) => ({ ...CHATS.find((c) => c.id === id)!, pinned })),
  remove: jest.fn(async (id: string) => {
    const c = [...mockChats, ...mockArchived].find((x) => x.id === id);
    mockChats = mockChats.filter((x) => x.id !== id);
    mockArchived = mockArchived.filter((x) => x.id !== id);
    if (c) mockTrash.push({ ...c, deleted_at: ago(0), days_left: 30 });
    return { deleted: id, trash: true, days: 30 };
  }),
  restoreChat: jest.fn(async (id: string) => {
    const c = mockTrash.find((x) => x.id === id)!;
    mockTrash = mockTrash.filter((x) => x.id !== id);
    mockChats.push(c);
    return c;
  }),
  removeForever: jest.fn(async (id: string) => {
    mockTrash = mockTrash.filter((x) => x.id !== id);
    return { deleted: id, forever: true };
  }),
  emptyTrash: jest.fn(async () => {
    const n = mockTrash.length;
    mockTrash = [];
    return { deleted: n, kept: 0 };
  }),
  exportChat: jest.fn(async (id: string, format: 'md' | 'pdf') => ({
    id: `x-${format}`,
    name: `Rail sag 2026-10-15.${format}`,
    bytes: 10,
    folder: 'Chat/Exports',
    format,
  })),
  fileBlob: jest.fn(async () => ({ size: 10 }) as unknown as Blob),
  listFiles: jest.fn(async () => []),
  folders: jest.fn(async () => []),
  virtualTree: jest.fn(async () => ({ folders: [], files: [], links: [] })),
  virtualFolder: jest.fn(async () => ({ tree: { folders: [], files: [], links: [] } })),
  filesTrash: jest.fn(async () => ({ days: 30, files: [] })),
  stop: jest.fn(async () => ({ stopped: true })),
};
jest.mock('../../state/session', () => {
  const session = () => ({
    client: mockClient,
    server: 'https://wb.example.com',
    user: { id: 'u1', name: 'Ada Demir', email: 'ada@example.com' },
    signOut: jest.fn(),
    changeServer: jest.fn(),
    // Two accounts kept (1.5.6): Ada here, open; Bo on another server.
    account: mockAccounts[0],
    accounts: mockAccounts,
    switchTo: mockSwitch,
    remove: mockRemove,
    addAnother: mockAdd,
    clientFor: () => mockClient,
  });
  return { useSession: session, useMaybeSession: session };
});
const mockAccounts = [
  { id: 'a1', server: 'https://wb.example.com', user: { id: 'u1', name: 'Ada Demir', email: 'ada@example.com' } },
  { id: 'a2', server: 'https://other.example', user: { id: 'u9', name: 'Bo', email: 'bo@other.example' } },
];
const mockSwitch = jest.fn(async () => undefined);
const mockRemove = jest.fn(async () => undefined);
const mockAdd = jest.fn();

/** The latest hardware Back handler the app registered. */
function back(): boolean {
  const calls = (BackHandler.addEventListener as jest.Mock).mock.calls;
  return calls[calls.length - 1][1]();
}

const drawerOpen = () =>
  screen.getByTestId('drawer', { includeHiddenElements: true }).props.accessibilityElementsHidden === false;

async function start() {
  await render(<Workspace lang="auto" onLang={jest.fn()} />);
  // The last conversation is looked up, the list and the example questions are read.
  await act(async () => undefined);
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockChats = [...CHATS];
  mockArchived = [listed('a1', 'Old enclosure', 60 * 24 * 20, { archived: true })];
  mockTrash = [listed('t1', 'Scratch idea', 60 * 24 * 2, { deleted_at: ago(60), days_left: 29 })];
  await AsyncStorage.clear();
  jest.spyOn(BackHandler, 'addEventListener');
});

describe('suggestionsFrom', () => {
  it("takes the server's own questions, with their area, and the hand-written ones otherwise", () => {
    expect(suggestionsFrom(IDEAS)).toEqual([
      { area: 'PCB', text: 'Why does the rail sag?' },
      { area: 'Firmware', text: 'Add a watchdog to the updater.' },
    ]);
    expect(suggestionsFrom(null)).toBe(STARTERS);
    expect(suggestionsFrom({ source: 'default', items: [] })).toBe(STARTERS);
    expect(suggestionsFrom({ source: 'llm', items: [{ kind: 'pcb', text: '  ' }] })).toBe(STARTERS);
  });
});

describe('workspace', () => {
  it('opens on a new conversation with a greeting and the server’s example questions', async () => {
    await start();
    expect(screen.getByTestId('new-chat-screen')).toBeTruthy();
    expect(screen.getByText(/Ada$/)).toBeTruthy();
    expect(screen.getByText('Why does the rail sag?')).toBeTruthy();
    expect(mockClient.ideas).toHaveBeenCalledWith('en');
    // The server's starting model is in the top bar.
    expect(screen.getByText('claude-sonnet-4.5')).toBeTruthy();
  });

  it('falls back to the hand-written questions, and a question tapped fills the composer', async () => {
    mockClient.ideas.mockResolvedValueOnce(null);
    await start();
    await fireEvent.press(screen.getByTestId('suggestion-0'));
    expect(screen.getByTestId('composer-input')).toHaveDisplayValue(STARTERS[0].text);
    expect(mockClient.say).not.toHaveBeenCalled();
  });

  it('opens and closes the drawer, with the conversations grouped by day', async () => {
    await start();
    expect(drawerOpen()).toBe(false);
    await fireEvent.press(screen.getByTestId('open-drawer'));
    expect(drawerOpen()).toBe(true);
    const list = within(screen.getByTestId('drawer-list'));
    for (const g of ['Pinned', 'Today', 'Yesterday', 'Older']) expect(list.getByText(g)).toBeTruthy();
    expect(list.queryByText('Previous 7 days')).toBeNull();

    // (The open panel is modal to screen readers, so the dimmed side is hidden from them.)
    await fireEvent.press(screen.getByTestId('drawer-scrim', { includeHiddenElements: true }));
    expect(drawerOpen()).toBe(false);
  });

  it('takes the shut drawer out of the layout, so a keyboard cannot land in it', async () => {
    await start();
    const overlay = () => screen.getByTestId('drawer-overlay', { includeHiddenElements: true });
    const gone = () => Boolean(StyleSheet.flatten(overlay().props.style)?.display === 'none');
    // A drawer that is only slid aside still holds every Tab stop on the web: the search
    // field, forty rows, the account - and the conversation behind it cannot be reached.
    expect(gone()).toBe(true);
    await fireEvent.press(screen.getByTestId('open-drawer'));
    expect(gone()).toBe(false);
    await fireEvent.press(screen.getByTestId('drawer-scrim', { includeHiddenElements: true }));
    // It leaves once it has finished sliding, not through the middle of the slide.
    await act(async () => {
      await new Promise((r) => setTimeout(r, motion.drawer + 120));
    });
    expect(gone()).toBe(true);
  });

  it('opens a conversation from the drawer, and Back closes the drawer, then goes back, then leaves', async () => {
    await start();
    await fireEvent.press(screen.getByTestId('open-drawer'));
    await fireEvent.press(screen.getByTestId('chat-c1'));
    expect(drawerOpen()).toBe(false);
    expect(await screen.findByText('Answer in Rail sag')).toBeTruthy();
    expect(await AsyncStorage.getItem('workbench.lastChat')).toContain('"c1"');

    await fireEvent.press(screen.getByTestId('open-drawer'));
    await fireEvent.press(screen.getByTestId('chat-c3'));
    expect(await screen.findByText('Answer in Stepper heat')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('open-drawer'));
    let handled: boolean | undefined;
    await act(async () => {
      handled = back();
    });
    expect(handled).toBe(true);
    expect(drawerOpen()).toBe(false);
    expect(screen.getByText('Answer in Stepper heat')).toBeTruthy();

    await act(async () => {
      handled = back();
    });
    expect(handled).toBe(true);
    expect(await screen.findByText('Answer in Rail sag')).toBeTruthy();

    // Back again: the empty conversation it started on is not worth going back to - out of the app.
    await act(async () => {
      handled = back();
    });
    expect(handled).toBe(false);
  });

  it('opens straight into the conversation that was open last', async () => {
    await AsyncStorage.setItem('workbench.lastChat', JSON.stringify({ a1: 'c2' }));
    await start();
    expect(await screen.findByText('Answer in Enclosure walls')).toBeTruthy();
    expect(mockClient.getChat).toHaveBeenCalledWith('c2');
  });

  it('opens straight into the room it was left in, and writes down the one it is left in', async () => {
    // The PCB room was the last thing open: the app comes back to it, not to the chat.
    await AsyncStorage.setItem('workbench.lastView', JSON.stringify({ a1: { kind: 'room', id: 'pcb' } }));
    mockClient.rooms.mockResolvedValueOnce([
      { room: 'firmware', count: 0, waiting: 0, urgent: 0, last: null, agent_at: [] },
    ]);
    await start();
    expect(await screen.findByTestId('room-screen-pcb')).toBeTruthy();

    // Out of it, and into another room: that one is what the next start opens.
    await act(async () => {
      back();
    });
    await fireEvent.press(screen.getByTestId('open-drawer'));
    await fireEvent.press(await screen.findByTestId('room-firmware'));
    expect(await screen.findByTestId('room-screen-firmware')).toBeTruthy();
    expect(await AsyncStorage.getItem('workbench.lastView')).toContain('"firmware"');
  });

  it('makes a new conversation on the server with the first line, with the chosen model', async () => {
    await start();
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'How wide is a 2 A trace?');
    await fireEvent.press(screen.getByTestId('send'));
    expect(mockClient.createChat).toHaveBeenCalledWith('openrouter', 'anthropic/claude-sonnet-4.5');
    expect(mockClient.say).toHaveBeenCalledWith(
      'n1',
      expect.objectContaining({ text: 'How wide is a 2 A trace?', model: 'anthropic/claude-sonnet-4.5' }),
      expect.anything(),
    );
    // It is in the drawer, and opens next time.
    await fireEvent.press(screen.getByTestId('open-drawer'));
    expect(within(screen.getByTestId('drawer-list')).getByText('New conversation')).toBeTruthy();
    expect(await AsyncStorage.getItem('workbench.lastChat')).toContain('"n1"');
    // The list is read again once the answer is in.
    expect(mockClient.listChats.mock.calls.length).toBeGreaterThan(1);
  });

  it('New chat leaves a conversation for an empty one', async () => {
    await AsyncStorage.setItem('workbench.lastChat', JSON.stringify({ a1: 'c1' }));
    await start();
    await screen.findByText('Answer in Rail sag');
    await fireEvent.press(screen.getByTestId('header-new-chat'));
    expect(await screen.findByTestId('new-chat-screen')).toBeTruthy();
  });

  it('renames, archives and deletes a conversation from a long press', async () => {
    await start();
    await fireEvent.press(screen.getByTestId('open-drawer'));

    await fireEvent(screen.getByTestId('chat-c2'), 'longPress');
    expect(screen.getByTestId('chat-actions')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('action-rename'));
    await fireEvent.changeText(screen.getByTestId('dialog-input'), 'PETG enclosure');
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(mockClient.rename).toHaveBeenCalledWith('c2', 'PETG enclosure');
    expect(await screen.findByText('PETG enclosure')).toBeTruthy();

    await fireEvent(screen.getByTestId('chat-c3'), 'longPress');
    await fireEvent.press(screen.getByTestId('action-archive'));
    expect(mockClient.archive).toHaveBeenCalledWith('c3', true);
    expect(screen.queryByTestId('chat-c3')).toBeNull();

    await fireEvent(screen.getByTestId('chat-c1'), 'longPress');
    await fireEvent.press(screen.getByTestId('action-delete'));
    expect(screen.getByText('Delete this conversation?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(mockClient.remove).toHaveBeenCalledWith('c1');
    expect(screen.queryByTestId('chat-c1')).toBeNull();
  });

  it('searches titles at once and the server for what was said', async () => {
    jest.useFakeTimers();
    try {
      await start();
      await fireEvent.press(screen.getByTestId('open-drawer'));
      await fireEvent.changeText(screen.getByTestId('drawer-search'), 'stepper');
      const list = within(screen.getByTestId('drawer-list'));
      expect(list.getByText('Results')).toBeTruthy();
      expect(list.getByTestId('chat-c3')).toBeTruthy();
      expect(list.queryByTestId('chat-c1')).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      expect(mockClient.listChats).toHaveBeenCalledWith('stepper', 'live');
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps how much of an answer the Chat shows in Settings > Chat, on the server', async () => {
    await start();
    await fireEvent.press(screen.getByTestId('open-drawer'));
    await fireEvent.press(screen.getByTestId('open-account'));
    const card = within(screen.getByTestId('settings-chat-detail'));
    expect(card.getByText('Chat detail')).toBeTruthy();
    for (const stop of ['Compact', 'Normal', 'Detailed']) expect(card.getByText(stop)).toBeTruthy();
    // What the chosen stop means, and what it looks like.
    expect(screen.getByTestId('settings-chat-detail-about')).toHaveTextContent(
      'Each tool call a line of its own; thinking folded.',
    );
    await fireEvent.press(card.getByText('Detailed'));
    expect(mockClient.sideChat).toHaveBeenCalledWith('detailed');
    expect(screen.getByTestId('settings-chat-detail-about')).toHaveTextContent(
      'Everything open: the thinking, and what every tool call read and returned.',
    );
  });

  it('opens Settings from the account at the bottom of the drawer, and Back comes back', async () => {
    await start();
    await fireEvent.press(screen.getByTestId('open-drawer'));
    expect(screen.getByText('wb.example.com')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('open-account'));
    expect(screen.getByTestId('settings-screen')).toBeTruthy();
    expect(screen.getByText('Voice language')).toBeTruthy();
    expect(screen.getByText('Sign out')).toBeTruthy();
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByTestId('theme-spartan-dark').props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByTestId('theme-dracula')).toBeTruthy();
    await act(async () => {
      back();
    });
    expect(screen.queryByTestId('settings-screen')).toBeNull();
  });

  it('changes the language of the app in Settings, apart from the voice', async () => {
    const onAppLang = jest.fn();
    await render(<Workspace lang="auto" onLang={jest.fn()} appLang="auto" onAppLang={onAppLang} />);
    await act(async () => undefined);
    await fireEvent.press(screen.getByTestId('open-drawer'));
    await fireEvent.press(screen.getByTestId('open-account'));
    // The first Türkçe is the app's language; the voice language has one too.
    await fireEvent.press(screen.getAllByRole('radio', { name: 'Türkçe' })[0]);
    expect(onAppLang).toHaveBeenCalledWith('tr');
  });

  it('lists every account in Settings, the open one marked; a tap switches, one signs out alone, another is added', async () => {
    await start();
    await fireEvent.press(screen.getByTestId('open-drawer'));
    await fireEvent.press(screen.getByTestId('open-account'));
    expect(screen.getByTestId('account-a1').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText('bo@other.example · other.example')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('account-a2'));
    expect(mockSwitch).toHaveBeenCalledWith('a2');
    await fireEvent.press(screen.getByTestId('account-remove-a2'));
    expect(screen.getByText('Sign out of Bo?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(mockRemove).toHaveBeenCalledWith('a2');
    await fireEvent.press(screen.getByTestId('account-add'));
    expect(mockAdd).toHaveBeenCalled();
  });

  it('chooses in Account whether dictated words appear live or after recording', async () => {
    const onVoiceMode = jest.fn();
    await render(<Workspace lang="auto" onLang={jest.fn()} voiceMode="live" onVoiceMode={onVoiceMode} />);
    await act(async () => undefined);
    await fireEvent.press(screen.getByTestId('open-drawer'));
    await fireEvent.press(screen.getByTestId('open-account'));
    expect(screen.getByText('Words appear')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Live' }).props.accessibilityState).toEqual({ checked: true });
    await fireEvent.press(screen.getByText('After recording'));
    expect(onVoiceMode).toHaveBeenCalledWith('record');
  });

  it('offers the row actions as its own button, for anyone who would not think to swipe', async () => {
    await start();
    await fireEvent.press(screen.getByTestId('open-drawer'));
    // No swipe and no long press: the … at the end of the row opens the same sheet.
    await fireEvent.press(screen.getByTestId('chat-c3-more'));
    await fireEvent.press(screen.getByTestId('action-archive'));
    expect(mockClient.archive).toHaveBeenCalledWith('c3', true);
  });

  it('swipe actions on a row archive or delete it (delete asks first)', async () => {
    await start();
    await fireEvent.press(screen.getByTestId('open-drawer'));
    await fireEvent.press(screen.getByTestId('swipe-c3-archive'));
    expect(mockClient.archive).toHaveBeenCalledWith('c3', true);
    expect(screen.queryByTestId('chat-c3')).toBeNull();

    await fireEvent.press(screen.getByTestId('swipe-c2-delete'));
    expect(screen.getByText('Delete this conversation?')).toBeTruthy();
    expect(mockClient.remove).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(mockClient.remove).toHaveBeenCalledWith('c2');
    expect(screen.queryByTestId('chat-c2')).toBeNull();
  });

  it('shows Archived: an archived conversation is brought back with Unarchive', async () => {
    await start();
    await fireEvent.press(screen.getByTestId('open-drawer'));
    await fireEvent.press(screen.getByTestId('chat-scope-archived'));
    expect(await screen.findByTestId('chat-a1')).toBeTruthy();
    expect(screen.queryByTestId('chat-c1')).toBeNull();
    expect(mockClient.listChats).toHaveBeenCalledWith('', 'archived');
    await fireEvent.press(screen.getByTestId('swipe-a1-unarchive'));
    expect(mockClient.archive).toHaveBeenCalledWith('a1', false);
    expect(screen.queryByTestId('chat-a1')).toBeNull();
    await fireEvent.press(screen.getByTestId('chat-scope-live'));
    expect(await screen.findByTestId('chat-a1')).toBeTruthy();
  });

  it('Select ticks several conversations and does it to all of them at once', async () => {
    await start();
    await fireEvent.press(screen.getByTestId('open-drawer'));
    // The web's own row of tabs, with Select at its right.
    expect(screen.getByText('Conversations')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('chat-select'));

    // Selecting, the search and New chat give way to the bar, and a row is a box to tick.
    expect(screen.queryByTestId('new-chat')).toBeNull();
    await fireEvent.press(screen.getByTestId('chat-c3'));
    await fireEvent.press(screen.getByTestId('chat-c2'));
    expect(screen.getByText('2 selected')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('chat-bulk-archive'));
    expect(mockClient.archive).toHaveBeenCalledWith('c3', true);
    expect(mockClient.archive).toHaveBeenCalledWith('c2', true);
    expect(screen.queryByTestId('chat-c3')).toBeNull();
    expect(screen.queryByTestId('chat-c2')).toBeNull();
    // Out of selecting, the list as it was.
    expect(screen.getByTestId('new-chat')).toBeTruthy();

    // Every row at once, then the trash's own two buttons behind their question.
    mockTrash.push(listed('t2', 'Another scratch', 60 * 24 * 3, { deleted_at: ago(90), days_left: 28 }));
    await fireEvent.press(screen.getByTestId('chat-scope-trash'));
    await fireEvent.press(await screen.findByTestId('chat-select'));
    await fireEvent.press(screen.getByTestId('chat-pick-all'));
    expect(screen.getByText('2 selected')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('chat-bulk-forever'));
    expect(screen.getByText('Delete 2 conversations forever?')).toBeTruthy();
    expect(mockClient.removeForever).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(mockClient.removeForever).toHaveBeenCalledWith('t1');
    expect(mockClient.removeForever).toHaveBeenCalledWith('t2');
    expect(await screen.findByText(/The trash is empty/)).toBeTruthy();
  });

  it('shows Trash: restore, delete forever and empty the trash', async () => {
    mockTrash.push(listed('t2', 'Another scratch', 60 * 24 * 3, { deleted_at: ago(90), days_left: 28 }));
    await start();
    await fireEvent.press(screen.getByTestId('open-drawer'));
    await fireEvent.press(screen.getByTestId('chat-scope-trash'));
    expect(await screen.findByText('29 d left')).toBeTruthy();

    // A tap on a deleted conversation offers what can be done with it.
    await fireEvent.press(screen.getByTestId('chat-t1'));
    await fireEvent.press(screen.getByTestId('action-restore'));
    expect(mockClient.restoreChat).toHaveBeenCalledWith('t1');
    expect(screen.queryByTestId('chat-t1')).toBeNull();

    await fireEvent.press(screen.getByTestId('swipe-t2-forever'));
    expect(screen.getByText('Delete forever?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(mockClient.removeForever).toHaveBeenCalledWith('t2');

    mockTrash.push(listed('t3', 'Third', 60, { deleted_at: ago(5), days_left: 30 }));
    await fireEvent.press(screen.getByTestId('chat-scope-live'));
    await fireEvent.press(screen.getByTestId('chat-scope-trash'));
    await fireEvent.press(await screen.findByTestId('empty-trash'));
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(mockClient.emptyTrash).toHaveBeenCalled();
    expect(await screen.findByText(/The trash is empty/)).toBeTruthy();
  });

  it('the top bar’s “…” renames, pins, archives, exports and deletes the open conversation', async () => {
    await AsyncStorage.setItem('workbench.lastChat', JSON.stringify({ a1: 'c1' }));
    await start();
    await screen.findByText('Answer in Rail sag');
    await fireEvent.press(screen.getByTestId('header-more'));
    const sheet = within(screen.getByTestId('chat-actions'));
    for (const a of ['Rename', 'Pin', 'Archive', 'Export as Markdown', 'Export as PDF', 'Delete'])
      expect(sheet.getByText(a)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('action-pin'));
    expect(mockClient.pin).toHaveBeenCalledWith('c1', true);
    await fireEvent.press(screen.getByTestId('header-more'));
    expect(within(screen.getByTestId('chat-actions')).getByText('Unpin')).toBeTruthy();

    // The server writes the file into Files (Chat/Exports); the phone shares what it wrote.
    await fireEvent.press(screen.getByTestId('action-export-md'));
    expect(mockClient.exportChat).toHaveBeenCalledWith('c1', 'md');
    expect(mockClient.fileBlob).toHaveBeenCalledWith('x-md');
    expect(share.shareFile).toHaveBeenCalledWith({ size: 10 }, 'Rail sag 2026-10-15.md', 'text/markdown');
    await fireEvent.press(screen.getByTestId('header-more'));
    await fireEvent.press(screen.getByTestId('action-export-pdf'));
    expect(share.shareFile).toHaveBeenCalledWith({ size: 10 }, 'Rail sag 2026-10-15.pdf', 'application/pdf');
    expect(share.sharePdf).not.toHaveBeenCalled();

    // A server without the route: the app writes the Markdown, and prints the PDF on the phone.
    mockClient.exportChat.mockRejectedValueOnce(new ApiError(405, 'Method Not Allowed'));
    await fireEvent.press(screen.getByTestId('header-more'));
    await fireEvent.press(screen.getByTestId('action-export-md'));
    expect(share.shareFile).toHaveBeenLastCalledWith(
      expect.stringContaining('# Rail sag'),
      'Rail sag.md',
      'text/markdown',
    );
    mockClient.exportChat.mockRejectedValueOnce(new ApiError(404, 'Not Found'));
    await fireEvent.press(screen.getByTestId('header-more'));
    await fireEvent.press(screen.getByTestId('action-export-pdf'));
    expect(share.sharePdf).toHaveBeenCalledWith(expect.stringContaining('<h1>Rail sag</h1>'), 'Rail sag.pdf');

    // Anything else the server says is shown, and nothing is written here.
    mockClient.exportChat.mockRejectedValueOnce(new ApiError(409, 'the conversation has no lines yet'));
    await fireEvent.press(screen.getByTestId('header-more'));
    await fireEvent.press(screen.getByTestId('action-export-md'));
    expect(await screen.findByText('the conversation has no lines yet')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('header-more'));
    await fireEvent.press(screen.getByTestId('action-delete'));
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(mockClient.remove).toHaveBeenCalledWith('c1');
    expect(await screen.findByTestId('new-chat-screen')).toBeTruthy();
  });

  it('a new conversation has no “…” until it is on the server', async () => {
    await start();
    expect(screen.getByTestId('header-more').props.accessibilityState.disabled).toBe(true);
  });

  it('opens Files from the drawer, and Back comes back to the conversation', async () => {
    await start();
    await fireEvent.press(screen.getByTestId('open-drawer'));
    await fireEvent.press(screen.getByTestId('open-files'));
    expect(await screen.findByTestId('files-screen')).toBeTruthy();
    expect(mockClient.listFiles).toHaveBeenCalled();
    let handled: boolean | undefined;
    await act(async () => {
      handled = back();
    });
    expect(handled).toBe(true);
    expect(screen.queryByTestId('files-screen')).toBeNull();
    expect(screen.getByTestId('new-chat-screen')).toBeTruthy();
  });
});
