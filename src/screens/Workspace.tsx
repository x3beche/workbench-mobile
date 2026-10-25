/**
 * Signed in: a conversation fills the screen (the last one open, or a new
 * one), or Files; the drawer on its left holds the conversations (Chats,
 * Archived, Trash), search, New chat, Files and the account. On a wide
 * screen the drawer is a column that stays open.
 *
 * What can be done with a conversation - rename, pin, archive, export,
 * delete; restore or delete forever from the trash - is offered in one
 * sheet, from a long press in the drawer or the "…" in the top bar; a swipe
 * to the left on a row shows the two most used.
 *
 * Android's Back closes a sheet (the sheet's own Modal), then the drawer,
 * then goes up a folder in Files and back to the conversation, then goes
 * back to the conversation open before, then leaves the app.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ApiError, CHAT_TRASH_DAYS, isMissingRoute, type VoiceLang } from '../api/client';
import type { Chat, ChatScope, Ideas, OrchStatus, Room, RoomId, WbcSession } from '../api/types';
import { AgentSheet } from '../components/AgentSheet';
import { Appear } from '../components/Appear';
import { Drawer } from '../components/Drawer';
import { DrawerPanel } from '../components/DrawerPanel';
import {
  Archive,
  ArchiveRestore,
  FileDown,
  FileText,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  Trash,
} from '../components/icons';
import { ActionList, Dialog, Sheet, type Action } from '../components/Sheet';
import type { SwipeAction } from '../components/SwipeRow';
import { chatToHtml, chatToMarkdown, exportName } from '../lib/exportChat';
import { tick } from '../lib/feel';
import { orchStrings } from '../lib/orchStrings';
import { settingsStrings } from '../lib/settingsStrings';
import { knownRooms } from '../lib/rooms';
import { wbcStrings } from '../lib/wbcStrings';
import { inFront } from '../live/hub';
import { useBus, useLive } from '../live/LiveContext';
import { shareFile, sharePdf } from '../lib/share';
import { useSession } from '../state/session';
import * as prefs from '../storage/prefs';
import { colors, drawerMax, fonts, motion, radius, type, wideAt } from '../theme/tokens';
import { uiLang, updateStrings } from '../update/strings';
import { useUpdate } from '../update/useUpdate';
import type { VoiceMode } from '../voice/voice';
import { ChatScreen, type Suggestion } from './ChatScreen';
import { FilesScreen, type FilesHandle } from './FilesScreen';
import { OrchestratorScreen, type OrchestratorHandle } from './OrchestratorScreen';
import { AnalyticsScreen } from './AnalyticsScreen';
import { ClaudeSessionScreen } from './ClaudeSessionScreen';
import { RoomScreen } from './RoomScreen';
import { SettingsScreen } from './SettingsScreen';

/** Where to begin when the server has no example questions of its own (the web app's STARTERS). */
export const STARTERS: Suggestion[] = [
  { area: 'PCB', text: 'What protection should a 5 V / 3 A USB-C power input have? Give part examples.' },
  {
    area: 'Firmware',
    text: 'Write a non-blocking debounce for 4 buttons on an STM32 that tells a short press from a long one.',
  },
  { area: 'CAD', text: 'In build123d, how do I model a snap-fit lid for a 60 × 40 × 20 mm box with 2 mm walls?' },
  { area: 'PCB', text: 'How wide should a 2 A trace be on 1 oz copper, and how many vias does the same current need?' },
];

const AREA: Record<string, string> = {
  pcb: 'PCB',
  firmware: 'Firmware',
  cad: '3D/CAD',
  notes: 'Notes',
  taste: 'Taste',
  manufacturers: 'Manufacturers',
  general: 'General',
};

/** The server's own example questions when it has written some, else the hand-written ones. */
export function suggestionsFrom(ideas: Ideas | null): Suggestion[] {
  const own = ideas?.source === 'llm' ? ideas.items.filter((i) => i.text?.trim()) : [];
  if (!own.length) return STARTERS;
  return own.slice(0, 4).map((i) => ({ area: AREA[i.kind] ?? undefined, text: i.text.trim() }));
}

/** What is open: a conversation (by id, with what the list knew of it) or a new one. */
type Open = { key: number; chat: Chat | null };

export function Workspace({
  lang,
  onLang,
  voiceMode = 'live',
  onVoiceMode = () => undefined,
  appLang = 'auto',
  onAppLang = () => undefined,
}: {
  lang: VoiceLang;
  onLang: (l: VoiceLang) => void;
  /** When dictated words appear (Settings: "Words appear"). */
  voiceMode?: VoiceMode;
  onVoiceMode?: (m: VoiceMode) => void;
  /** Settings > Language. */
  appLang?: 'auto' | 'en' | 'tr';
  onAppLang?: (l: 'auto' | 'en' | 'tr') => void;
}) {
  const { client, server, user, account: acct } = useSession();
  /** What is remembered per account (the conversation open last, rooms read) is kept under its id. */
  const keep = acct?.id ?? server;
  const { width } = useWindowDimensions();
  const wide = width >= wideAt;
  const drawerWidth = wide ? 300 : Math.min(drawerMax, Math.round(width * 0.84));

  const [chats, setChats] = useState<Chat[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<Ideas | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<Open>({ key: 0, chat: null });
  // The id of the open conversation once it is on the server (a new one gets it on its first line).
  const [openId, setOpenId] = useState<string | null>(null);
  const history = useRef<Chat[]>([]);
  const [actions, setActions] = useState<Chat | null>(null);
  const [ask, setAsk] = useState<
    { chat: Chat; what: 'rename' | 'delete' | 'forever' } | { chat?: undefined; what: 'empty' } | null
  >(null);
  const [page, setPage] = useState<'chat' | 'files' | 'settings' | 'analytics'>('chat');
  /** The workspace's room open on screen, if any (3D Drawing, PCB Design, Firmware). */
  const [room, setRoom] = useState<RoomId | null>(null);
  /** The Orchestrator is open on screen (read-only, above the rooms in the drawer). */
  const [orch, setOrch] = useState(false);
  /** Its state as last read: null until then, and while this server has none (an older server). */
  const [orchSt, setOrchSt] = useState<OrchStatus | null>(null);
  const [agentSheet, setAgentSheet] = useState(false);
  const orchView = useRef<OrchestratorHandle>(null);
  /** One's own Claude Code sessions (null until read, and on a server without them), and the one open on screen. */
  const [wbcRows, setWbcRows] = useState<WbcSession[] | null>(null);
  const [wbcOpen, setWbcOpen] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [roomsSeen, setRoomsSeen] = useState<Record<string, string>>({});
  const files = useRef<FilesHandle>(null);
  const [scope, setScope] = useState<ChatScope>('live');
  const [scoped, setScoped] = useState<{ scope: ChatScope; chats: Chat[] } | null>(null);
  const [can, setCan] = useState<string[] | null>(null);
  /** The account's role: the owner and the admins see the server's pool and the sandboxes in Analytics. */
  const [role, setRole] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);

  const update = useUpdate(client, server);
  const ui = uiLang(lang);
  const ot = useMemo(() => orchStrings(ui), [ui]);
  const stt = useMemo(() => settingsStrings(ui), [ui]);
  const wt = useMemo(() => wbcStrings(ui), [ui]);
  const updateNote =
    update.check.state === 'available'
      ? updateStrings(uiLang(lang)).drawer(update.check.release.version)
      : null;

  const say = useCallback((text: string, bad = false) => setToast({ text, bad }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.bad ? 5000 : 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // What this account may do, for Files (a viewer only looks).
  useEffect(() => {
    if (!client) return;
    let live = true;
    client.authState().then(
      (st) => {
        if (!live) return;
        setCan(st.can ?? null);
        setRole(st.mode === 'off' ? 'owner' : (st.role ?? null));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [client]);

  const loadScoped = useCallback(
    (which: ChatScope): Promise<void> => {
      if (!client || which === 'live') return Promise.resolve();
      return client.listChats('', which).then(
        (got) => {
          setScoped({ scope: which, chats: got });
          setListError(null);
        },
        (e) => setListError(e instanceof ApiError ? e.message : 'The conversations could not be read.'),
      );
    },
    [client],
  );

  useEffect(() => {
    if (scope !== 'live') loadScoped(scope);
  }, [scope, loadScoped]);

  /**
   * The workspace's rooms, so the drawer can lead with them. A server older
   * than the rooms answer with nothing, and the drawer simply has none.
   */
  const loadRooms = useCallback((): Promise<void> => {
    if (!client) return Promise.resolve();
    return client.rooms().then(
      (got) => setRooms(knownRooms(got)),
      () => undefined,
    );
  }, [client]);

  /** One's Orchestrator, for its row in the drawer: a server without one (older) leaves the row out. */
  const loadOrch = useCallback((): Promise<void> => {
    if (!client) return Promise.resolve();
    return client.orchestrator().then(
      (got) => setOrchSt(got),
      () => undefined,
    );
  }, [client]);

  useEffect(() => {
    loadOrch();
  }, [loadOrch]);

  /** One's Claude sessions, for their group in the drawer: a server without them (older) has none. */
  const loadWbc = useCallback((): Promise<void> => {
    if (!client) return Promise.resolve();
    return client.wbcSessions().then(
      (got) => setWbcRows(got),
      () => undefined,
    );
  }, [client]);

  useEffect(() => {
    loadWbc();
  }, [loadWbc]);

  useEffect(() => {
    loadRooms();
    if (!keep) return;
    let live = true;
    prefs.roomsSeen(keep).then((got) => live && setRoomsSeen(got));
    return () => {
      live = false;
    };
  }, [loadRooms, keep]);

  // The agent writes in a room on its own time: its last line and what is
  // unread (the drawer's badges) are read again when the account's bus says
  // a line was said (`line`), the Orchestrator's row when it changed
  // (`orch`), the conversations when one changed (`cc`) - and without the
  // bus now and then, as before (once a minute as a safety net with it).
  const hub = useLive();
  const pace = useMemo(() => hub?.pace() ?? null, [hub]);
  useEffect(() => {
    const t = setInterval(() => {
      if (pace && !pace.due()) return;
      loadRooms();
      loadOrch();
    }, 30_000);
    return () => clearInterval(t);
  }, [loadRooms, loadOrch, pace]);
  // A wb-claude that goes quiet tells nobody: the Claude sessions are read again now and then (in the front only).
  const wbcPace = useMemo(() => hub?.pace(30_000) ?? null, [hub]);
  const wbcKnown = wbcRows !== null;
  useEffect(() => {
    if (!wbcKnown) return;
    const t = setInterval(() => {
      if (!inFront()) return;
      if (wbcPace && !wbcPace.due()) return;
      loadWbc();
    }, 10_000);
    return () => clearInterval(t);
  }, [loadWbc, wbcPace, wbcKnown]);

  /** A room was read: its badge is counted again from what is remembered here. */
  const roomSeen = useCallback(() => {
    loadRooms();
    if (keep) prefs.roomsSeen(keep).then(setRoomsSeen);
  }, [loadRooms, keep]);

  const load = useCallback((): Promise<void> => {
    if (!client) return Promise.resolve();
    return client.listChats().then(
      (got) => {
        setChats(got);
        setListError(null);
      },
      (e) => setListError(e instanceof ApiError ? e.message : 'The conversations could not be read.'),
    );
  }, [client]);

  const scopeRef = useRef(scope);
  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);
  const gather = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(
    () => () => {
      for (const t of Object.values(gather.current)) clearTimeout(t);
    },
    [],
  );
  /** A burst of events read once, `ms` after the first. */
  const later = useCallback((what: string, ms: number, fn: () => void) => {
    if (gather.current[what]) return;
    gather.current[what] = setTimeout(() => {
      delete gather.current[what];
      fn();
    }, ms);
  }, []);
  useBus(['line', 'orch', 'cc', 'wbc'], (e) => {
    if (e.k === '$down') return;
    if (e.k === 'wbc' || e.k === '$open') {
      wbcPace?.mark();
      later('wbc', 150, loadWbc);
    }
    if (e.k === 'line' || e.k === '$open') later('rooms', 120, loadRooms);
    if (e.k === 'orch' || e.k === '$open') later('orch', 120, loadOrch);
    if (e.k === 'cc' || e.k === '$open') {
      later('chats', 120, () => {
        load();
        if (scopeRef.current !== 'live') loadScoped(scopeRef.current);
      });
    }
  });

  // The last conversation open on this server, or a new one.
  useEffect(() => {
    let live = true;
    (async () => {
      const last = keep ? await prefs.lastChat(keep) : null;
      if (!live) return;
      if (last) {
        setOpen({ key: 1, chat: { id: last } as Chat });
        setOpenId(last);
      }
      setReady(true);
    })();
    return () => {
      live = false;
    };
  }, [keep]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!client) return;
    let live = true;
    client.ideas(lang === 'tr' ? 'tr' : 'en').then((got) => live && setIdeas(got));
    return () => {
      live = false;
    };
  }, [client, lang]);

  useEffect(() => {
    if (keep && ready) prefs.setLastChat(keep, openId);
  }, [keep, openId, ready]);

  const show = useCallback(
    (chat: Chat | null, remember = true) => {
      if (remember && (openId || open.chat)) {
        const was = open.chat && openId ? { ...open.chat, id: openId } : null;
        if (was) history.current = [...history.current.filter((c) => c.id !== was.id), was].slice(-20);
      }
      setOpen((o) => ({ key: o.key + 1, chat }));
      setOpenId(chat?.id ?? null);
      setDrawer(false);
    },
    [open.chat, openId],
  );

  const openChat = (chat: Chat) => {
    setPage('chat');
    setRoom(null);
    setOrch(false);
    setWbcOpen(null);
    if (chat.id === openId) {
      setDrawer(false);
      return;
    }
    show(chat);
  };

  /** A room is not a conversation: it takes the screen on its own, and Back returns to the chat. */
  const openRoom = (which: RoomId) => {
    tick();
    setPage('chat');
    setRoom(which);
    setOrch(false);
    setWbcOpen(null);
    setDrawer(false);
  };

  /** A Claude session takes the screen as a room does; Back returns to the chat. */
  const openWbc = (sid: string) => {
    tick();
    setPage('chat');
    setRoom(null);
    setOrch(false);
    setWbcOpen(sid);
    setDrawer(false);
  };

  /** The Orchestrator takes the screen as a room does; Back returns to the chat. */
  const openOrch = () => {
    tick();
    setPage('chat');
    setRoom(null);
    setOrch(true);
    setWbcOpen(null);
    setDrawer(false);
  };

  const newChat = () => {
    tick();
    setPage('chat');
    setRoom(null);
    setOrch(false);
    setWbcOpen(null);
    if (!openId) {
      setDrawer(false);
      return;
    }
    show(null);
  };

  const openFiles = () => openPage('files');

  /** Files, Settings or Analytics: a page of its own in place of the conversation. */
  const openPage = (which: 'files' | 'settings' | 'analytics') => {
    setPage(which);
    setRoom(null);
    setOrch(false);
    setWbcOpen(null);
    setDrawer(false);
  };

  // Back: the drawer first, then the room, then the conversation before, then out of the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawer && !wide) {
        setDrawer(false);
        return true;
      }
      if (orch) {
        if (!orchView.current?.back()) setOrch(false);
        return true;
      }
      if (room) {
        setRoom(null);
        return true;
      }
      if (wbcOpen) {
        setWbcOpen(null);
        return true;
      }
      if (page === 'files') {
        if (!files.current?.back()) setPage('chat');
        return true;
      }
      if (page !== 'chat') {
        setPage('chat');
        return true;
      }
      const prev = history.current.pop();
      if (prev) {
        show(prev, false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [drawer, wide, show, page, room, orch, wbcOpen]);

  const created = useCallback((chat: Chat) => {
    setOpenId(chat.id);
    setOpen((o) => ({ ...o, chat }));
    setChats((now) => (now ? [chat, ...now.filter((c) => c.id !== chat.id)] : [chat]));
  }, []);

  const gone = useCallback(() => {
    setOpen((o) => ({ key: o.key + 1, chat: null }));
    setOpenId(null);
  }, []);

  /** Gone from the list it was in (archived, deleted, restored): the open one gives way to a new one. */
  const dropped = (chat: Chat, close = true) => {
    setChats((now) => now?.filter((c) => c.id !== chat.id) ?? now);
    setScoped((now) => (now ? { ...now, chats: now.chats.filter((c) => c.id !== chat.id) } : now));
    history.current = history.current.filter((c) => c.id !== chat.id);
    if (close && chat.id === openId) show(null, false);
  };

  const fail = (e: unknown, what: string) => say(e instanceof ApiError ? e.message : what, true);

  const archive = (chat: Chat, on: boolean) =>
    client
      ?.archive(chat.id, on)
      .then(() => {
        dropped(chat, on);
        if (!on) load();
        say(on ? 'Archived' : 'Back in Chats');
      })
      .catch((e) => fail(e, on ? 'It could not be archived.' : 'It could not be unarchived.'));

  const pin = (chat: Chat) =>
    client
      ?.pin(chat.id, !chat.pinned)
      .then((got) => {
        setChats((now) => now?.map((c) => (c.id === chat.id ? { ...c, pinned: got.pinned } : c)) ?? now);
        setScoped((now) =>
          now ? { ...now, chats: now.chats.map((c) => (c.id === chat.id ? { ...c, pinned: got.pinned } : c)) } : now,
        );
      })
      .catch((e) => fail(e, 'It could not be pinned.'));

  const restore = (chat: Chat) =>
    client
      ?.restoreChat(chat.id)
      .then(() => {
        dropped(chat, false);
        load();
        say(`“${chat.title}” is back`);
      })
      .catch((e) => fail(e, 'It could not be restored.'));

  /**
   * The server writes the file (Files > In the app > Chat/Exports) and the
   * phone hands it to the share sheet; a server without the route gets the
   * app's own Markdown, or a PDF printed on the phone.
   */
  const exportChat = async (chat: Chat, as: 'md' | 'pdf') => {
    if (!client) return;
    try {
      try {
        const made = await client.exportChat(chat.id, as);
        const blob = await client.fileBlob(made.id);
        await shareFile(blob, made.name, as === 'md' ? 'text/markdown' : 'application/pdf');
        say(`Exported to Chat/Exports: ${made.name}`);
        return;
      } catch (e) {
        if (!isMissingRoute(e)) throw e;
      }
      const full = await client.getChat(chat.id);
      if (as === 'md') await shareFile(chatToMarkdown(full), exportName(full, 'md'), 'text/markdown');
      else await sharePdf(chatToHtml(full), exportName(full, 'pdf'));
    } catch (e) {
      fail(e, 'It could not be exported.');
    }
  };

  /** Everything one may do with a conversation, by where it is. */
  const chatActions = (chat: Chat): Action[] => {
    const close = (fn: () => void) => () => {
      setActions(null);
      fn();
    };
    if (chat.deleted_at || scope === 'trash') {
      return [
        { id: 'restore', label: 'Restore', icon: RotateCcw, onPress: close(() => restore(chat)) },
        {
          id: 'forever',
          label: 'Delete forever',
          icon: Trash,
          danger: true,
          onPress: close(() => setAsk({ chat, what: 'forever' })),
        },
      ];
    }
    return [
      { id: 'rename', label: 'Rename', icon: Pencil, onPress: close(() => setAsk({ chat, what: 'rename' })) },
      {
        id: 'pin',
        label: chat.pinned ? 'Unpin' : 'Pin',
        icon: chat.pinned ? PinOff : Pin,
        onPress: close(() => pin(chat)),
      },
      chat.archived
        ? { id: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onPress: close(() => archive(chat, false)) }
        : { id: 'archive', label: 'Archive', icon: Archive, onPress: close(() => archive(chat, true)) },
      { id: 'export-md', label: 'Export as Markdown', icon: FileDown, onPress: close(() => exportChat(chat, 'md')) },
      { id: 'export-pdf', label: 'Export as PDF', icon: FileText, onPress: close(() => exportChat(chat, 'pdf')) },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash,
        danger: true,
        onPress: close(() => setAsk({ chat, what: 'delete' })),
      },
    ];
  };

  const swipeActions = (chat: Chat): SwipeAction[] => {
    if (scope === 'trash')
      return [
        { id: 'restore', label: 'Restore', icon: RotateCcw, onPress: () => restore(chat) },
        { id: 'forever', label: 'Delete', icon: Trash, danger: true, onPress: () => setAsk({ chat, what: 'forever' }) },
      ];
    return [
      scope === 'archived'
        ? { id: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onPress: () => archive(chat, false) }
        : { id: 'archive', label: 'Archive', icon: Archive, onPress: () => archive(chat, true) },
      { id: 'delete', label: 'Delete', icon: Trash, danger: true, onPress: () => setAsk({ chat, what: 'delete' }) },
    ];
  };

  /** The "…" in the top bar: the conversation as the lists know it (pinned, archived), or as the screen does. */
  const more = (c: { id: string; title: string }) => {
    const known = chats?.find((x) => x.id === c.id) ?? scoped?.chats.find((x) => x.id === c.id);
    setActions(known ?? ({ ...open.chat, id: c.id, title: c.title } as Chat));
  };

  const suggestions = useMemo(() => suggestionsFrom(ideas), [ideas]);
  const start = ideas?.start ?? (chats?.[0] ? { provider: chats[0].provider, model: chats[0].model } : null);

  const shown = scope === 'live' ? chats : scoped?.scope === scope ? scoped.chats : null;

  const panel = (
    <DrawerPanel
      client={client}
      server={server}
      user={user}
      chats={shown}
      error={listError}
      openId={openId}
      onOpen={openChat}
      onNew={newChat}
      onRefresh={() => {
        loadRooms();
        return scope === 'live' ? load() : loadScoped(scope);
      }}
      onActions={setActions}
      onAccount={() => openPage('settings')}
      accountOn={page === 'settings'}
      onAnalytics={() => openPage('analytics')}
      analyticsOn={page === 'analytics'}
      analyticsLabel={stt.analytics}
      updateNote={updateNote}
      scope={scope}
      onScope={setScope}
      swipeActions={swipeActions}
      onEmptyTrash={() => setAsk({ what: 'empty' })}
      onFiles={openFiles}
      filesOn={page === 'files'}
      rooms={rooms}
      roomsSeen={roomsSeen}
      openRoom={room}
      onRoom={openRoom}
      orchestrator={orchSt ? { label: ot.orchestrator, snip: ot.drawerSnip } : null}
      orchOn={orch}
      onOrchestrator={openOrch}
      wbc={wbcRows ? { t: wt, rows: wbcRows } : null}
      openWbc={wbcOpen}
      onWbc={openWbc}
    />
  );

  return (
    <View style={s.root}>
      <Drawer open={drawer || wide} onOpenChange={setDrawer} width={drawerWidth} wide={wide} panel={panel}>
        {orch ? (
          <Appear key="orchestrator" duration={motion.fade}>
            <OrchestratorScreen
              ref={orchView}
              client={client}
              t={ot}
              lang={ui}
              wide={wide}
              initial={orchSt}
              onStatus={setOrchSt}
              onMenu={() => setDrawer(true)}
            />
          </Appear>
        ) : wbcOpen ? (
          <Appear key={`wbc-${wbcOpen}`} duration={motion.fade}>
            <ClaudeSessionScreen
              sid={wbcOpen}
              client={client}
              user={user}
              initial={wbcRows?.find((x) => x.session_id === wbcOpen) ?? null}
              t={wt}
              lang={lang}
              voiceMode={voiceMode}
              wide={wide}
              onMenu={() => setDrawer(true)}
              onClose={() => setWbcOpen(null)}
            />
          </Appear>
        ) : room ? (
          <Appear key={`room-${room}`} duration={motion.fade}>
            <RoomScreen
              room={room}
              client={client}
              server={keep}
              user={user}
              lang={lang}
              voiceMode={voiceMode}
              wide={wide}
              onMenu={() => setDrawer(true)}
              onClose={() => setRoom(null)}
              onSeen={roomSeen}
            />
          </Appear>
        ) : page === 'settings' ? (
          <Appear key="settings" duration={motion.fade}>
            <SettingsScreen
              t={stt}
              ot={ot}
              ui={ui}
              lang={lang}
              onLang={onLang}
              voiceMode={voiceMode}
              onVoiceMode={onVoiceMode}
              appLang={appLang}
              onAppLang={onAppLang}
              update={update}
              orch={orchSt}
              onAgent={() => setAgentSheet(true)}
              wide={wide}
              onMenu={() => setDrawer(true)}
            />
          </Appear>
        ) : page === 'analytics' ? (
          <Appear key="analytics" duration={motion.fade}>
            <AnalyticsScreen
              client={client}
              t={stt}
              ot={ot}
              lang={ui}
              admin={role === 'owner' || role === 'admin'}
              wide={wide}
              onMenu={() => setDrawer(true)}
            />
          </Appear>
        ) : page === 'files' ? (
          <Appear key="files" duration={motion.fade}>
            <FilesScreen ref={files} client={client} user={user} can={can} wide={wide} onMenu={() => setDrawer(true)} />
          </Appear>
        ) : ready ? (
          <Appear key={open.key} duration={motion.fade}>
            <ChatScreen
              initial={open.chat}
              start={start}
              suggestions={suggestions}
              wide={wide}
              lang={lang}
              voiceMode={voiceMode}
              onMenu={() => setDrawer(true)}
              onNew={newChat}
              onCreated={created}
              onChanged={load}
              onGone={gone}
              onMore={more}
            />
          </Appear>
        ) : null}
      </Drawer>
      {agentSheet ? (
        <AgentSheet
          client={client}
          t={ot}
          lang={ui}
          onClose={() => setAgentSheet(false)}
          onChanged={setOrchSt}
          onOpenRoom={() => {
            setAgentSheet(false);
            openOrch();
          }}
        />
      ) : null}
      {actions ? (
        <Sheet onClose={() => setActions(null)} title={actions.title} testID="chat-actions">
          {/* eslint-disable-next-line react-hooks/refs -- refs are read in the actions' handlers, not while drawing */}
          <ActionList actions={chatActions(actions)} />
        </Sheet>
      ) : null}
      {ask?.what === 'rename' ? (
        <Dialog
          title="Rename"
          confirm="Save"
          input={{ value: ask.chat.title, label: 'Name' }}
          onCancel={() => setAsk(null)}
          onConfirm={async (title) => {
            if (!client) return;
            const got = await client.rename(ask.chat.id, title);
            const named = (c: Chat) => (c.id === got.id ? { ...c, title: got.title } : c);
            setChats((now) => now?.map(named) ?? now);
            setScoped((now) => (now ? { ...now, chats: now.chats.map(named) } : now));
            setAsk(null);
          }}
        />
      ) : null}
      {ask?.what === 'delete' ? (
        <Dialog
          title="Delete this conversation?"
          text={`“${ask.chat.title}” goes to the trash. It can be restored from Trash for ${client?.chatTrashDays ?? CHAT_TRASH_DAYS} days, then it is deleted for good.`}
          confirm="Delete"
          danger
          onCancel={() => setAsk(null)}
          onConfirm={async () => {
            if (!client) return;
            await client.remove(ask.chat.id);
            dropped(ask.chat);
            setAsk(null);
            say('Moved to Trash');
          }}
        />
      ) : null}
      {ask?.what === 'forever' ? (
        <Dialog
          title="Delete forever?"
          text={`“${ask.chat.title}” is deleted for good, with every line in it. This cannot be undone.`}
          confirm="Delete forever"
          danger
          onCancel={() => setAsk(null)}
          onConfirm={async () => {
            if (!client) return;
            await client.removeForever(ask.chat.id);
            dropped(ask.chat);
            setAsk(null);
          }}
        />
      ) : null}
      {ask?.what === 'empty' ? (
        <Dialog
          title="Empty the trash?"
          text="Every conversation in the trash is deleted for good. This cannot be undone."
          confirm="Empty trash"
          danger
          onCancel={() => setAsk(null)}
          onConfirm={async () => {
            if (!client) return;
            const got = await client.emptyTrash();
            setAsk(null);
            await loadScoped('trash');
            if (got.kept) say(`${got.kept} kept: only their authors or someone who may delete can remove them.`);
          }}
        />
      ) : null}
      {toast ? (
        <Appear fill={false} from="below" duration={motion.fade} style={s.toastWrap}>
          <Text style={[s.toast, toast.bad && s.toastBad]} accessibilityLiveRegion="polite" testID="workspace-toast">
            {toast.text}
          </Text>
        </Appear>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  toastWrap: { position: 'absolute', alignSelf: 'center', bottom: 96, maxWidth: '92%' },
  toast: {
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: colors.surface2,
    fontFamily: fonts.sansMedium,
    fontSize: type.small,
    color: colors.ink,
    textAlign: 'center',
  },
  toastBad: { color: colors.danger, borderRadius: radius.lg },
});
