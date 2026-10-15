/**
 * Signed in: a conversation fills the screen (the last one open, or a new
 * one), and the drawer on its left holds the conversations, search, New chat
 * and the account. On a wide screen the drawer is a column that stays open.
 *
 * Android's Back closes a sheet (the sheet's own Modal), then the drawer,
 * then goes back to the conversation open before, then leaves the app.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ApiError, type VoiceLang } from '../api/client';
import type { Chat, Ideas } from '../api/types';
import { AccountSheet } from '../components/AccountSheet';
import { Appear } from '../components/Appear';
import { Drawer } from '../components/Drawer';
import { DrawerPanel } from '../components/DrawerPanel';
import { Archive, Pencil, Trash } from '../components/icons';
import { ActionList, Dialog, Sheet } from '../components/Sheet';
import { tick } from '../lib/feel';
import { useSession } from '../state/session';
import * as prefs from '../storage/prefs';
import { colors, drawerMax, motion, wideAt } from '../theme/tokens';
import { ChatScreen, type Suggestion } from './ChatScreen';

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

export function Workspace({ lang, onLang }: { lang: VoiceLang; onLang: (l: VoiceLang) => void }) {
  const { client, server, user } = useSession();
  const { width } = useWindowDimensions();
  const wide = width >= wideAt;
  const drawerWidth = wide ? 300 : Math.min(drawerMax, Math.round(width * 0.84));

  const [chats, setChats] = useState<Chat[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<Ideas | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [account, setAccount] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<Open>({ key: 0, chat: null });
  // The id of the open conversation once it is on the server (a new one gets it on its first line).
  const [openId, setOpenId] = useState<string | null>(null);
  const history = useRef<Chat[]>([]);
  const [actions, setActions] = useState<Chat | null>(null);
  const [ask, setAsk] = useState<{ chat: Chat; what: 'rename' | 'delete' } | null>(null);

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

  // The last conversation open on this server, or a new one.
  useEffect(() => {
    let live = true;
    (async () => {
      const last = server ? await prefs.lastChat(server) : null;
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
  }, [server]);

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
    if (server && ready) prefs.setLastChat(server, openId);
  }, [server, openId, ready]);

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
    if (chat.id === openId) {
      setDrawer(false);
      return;
    }
    show(chat);
  };

  const newChat = () => {
    tick();
    if (!openId) {
      setDrawer(false);
      return;
    }
    show(null);
  };

  // Back: the drawer first, then the conversation before, then out of the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawer && !wide) {
        setDrawer(false);
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
  }, [drawer, wide, show]);

  const created = useCallback((chat: Chat) => {
    setOpenId(chat.id);
    setOpen((o) => ({ ...o, chat }));
    setChats((now) => (now ? [chat, ...now.filter((c) => c.id !== chat.id)] : [chat]));
  }, []);

  const gone = useCallback(() => {
    setOpen((o) => ({ key: o.key + 1, chat: null }));
    setOpenId(null);
  }, []);

  const dropped = (chat: Chat) => {
    setChats((now) => now?.filter((c) => c.id !== chat.id) ?? now);
    history.current = history.current.filter((c) => c.id !== chat.id);
    if (chat.id === openId) show(null, false);
  };

  const suggestions = useMemo(() => suggestionsFrom(ideas), [ideas]);
  const start = ideas?.start ?? (chats?.[0] ? { provider: chats[0].provider, model: chats[0].model } : null);

  const panel = (
    <DrawerPanel
      client={client}
      server={server}
      user={user}
      chats={chats}
      error={listError}
      openId={openId}
      onOpen={openChat}
      onNew={newChat}
      onRefresh={load}
      onActions={setActions}
      onAccount={() => setAccount(true)}
    />
  );

  return (
    <View style={s.root}>
      <Drawer open={drawer || wide} onOpenChange={setDrawer} width={drawerWidth} wide={wide} panel={panel}>
        {ready ? (
          <Appear key={open.key} duration={motion.fade}>
            <ChatScreen
              initial={open.chat}
              start={start}
              suggestions={suggestions}
              wide={wide}
              lang={lang}
              onMenu={() => setDrawer(true)}
              onNew={newChat}
              onCreated={created}
              onChanged={load}
              onGone={gone}
            />
          </Appear>
        ) : null}
      </Drawer>
      {account ? <AccountSheet onClose={() => setAccount(false)} lang={lang} onLang={onLang} /> : null}
      {actions ? (
        <Sheet onClose={() => setActions(null)} title={actions.title} testID="chat-actions">
          <ActionList
            actions={[
              {
                id: 'rename',
                label: 'Rename',
                icon: Pencil,
                onPress: () => {
                  setAsk({ chat: actions, what: 'rename' });
                  setActions(null);
                },
              },
              {
                id: 'archive',
                label: 'Archive',
                icon: Archive,
                onPress: () => {
                  const chat = actions;
                  setActions(null);
                  client
                    ?.archive(chat.id)
                    .then(() => dropped(chat))
                    .catch((e) => setListError(e instanceof ApiError ? e.message : 'It could not be archived.'));
                },
              },
              {
                id: 'delete',
                label: 'Delete',
                icon: Trash,
                danger: true,
                onPress: () => {
                  setAsk({ chat: actions, what: 'delete' });
                  setActions(null);
                },
              },
            ]}
          />
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
            setChats((now) => now?.map((c) => (c.id === got.id ? { ...c, title: got.title } : c)) ?? now);
            setAsk(null);
          }}
        />
      ) : null}
      {ask?.what === 'delete' ? (
        <Dialog
          title="Delete this conversation?"
          text={`“${ask.chat.title}” goes to the server’s trash. It can be brought back from the web app until it is deleted for good.`}
          confirm="Delete"
          danger
          onCancel={() => setAsk(null)}
          onConfirm={async () => {
            if (!client) return;
            await client.remove(ask.chat.id);
            dropped(ask.chat);
            setAsk(null);
          }}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
});
