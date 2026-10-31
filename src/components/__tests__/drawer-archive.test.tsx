/**
 * The Agents group's archive in the drawer (components/DrawerPanel.tsx, lib/side.ts): a session taken out of the
 * group is not drawn there, and waits in the Archived tab under "Archived agents", newest first, each putting
 * itself back with the one action that matters. The group's own menu (components/AgentGroup.tsx) is where a row is
 * sent out; the pins and the archive are the person's own on the server (PUT /api/me/side/archived).
 */
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Chat, User, WboSession } from '../../api/types';
import { linkMap } from '../../lib/agents';
import { agentStrings } from '../../lib/agentStrings';
import { drawerStrings } from '../../lib/drawerStrings';
import { SIDE_EMPTY, withArchived } from '../../lib/side';
import { wbcStrings } from '../../lib/wbcStrings';
import { wboStrings } from '../../lib/wboStrings';
import { DrawerPanel } from '../DrawerPanel';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../SwipeRow', () => ({
  SwipeRow: ({ children }: { children: React.ReactNode }) => children,
}));

const canRender = typeof (React as { act?: unknown }).act === 'function';
const NOW = Date.now();
const t = drawerStrings('en');

const user: User = { id: 'u1', name: 'Ada', email: 'ada@wb.example' };
const chats: Chat[] = [];

function session(over: Partial<WboSession> = {}): WboSession {
  return {
    session_id: 'ses_idle01',
    title: 'Power budget',
    name: 'Power budget',
    status: 'idle',
    directory: '~/sensor',
    computer: 'ada-laptop',
    updated: NOW,
    seen: null,
    created: null,
    parent: null,
    tokens: { input: 0, output: 0 },
    mine: true,
    owner: { id: 'u1', name: 'Ada' },
    bridge: { id: 'b1', connected: true, remote: false, host: 'ada-laptop', platform: 'linux', version: '0.2.9',
              opencode: '1.0', cwd: '~/sensor', model: 'm', seen: null, started: null },
    may_send: true,
    why: '',
    ...over,
  } as WboSession;
}

const rows = (over: WboSession[] = []) => (over.length ? over : [session()]);

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
    wbc: { t: wbcStrings('en'), rows: [] },
    onWbc: jest.fn(),
    wbo: { t: wboStrings('en'), rows: rows() },
    openWbo: null,
    onWbo: jest.fn(),
    agents: { t: agentStrings('en'), links: linkMap([]), maxDepth: 3, onLink: jest.fn() },
    side: SIDE_EMPTY,
    onFold: jest.fn(),
    onPin: jest.fn(),
    onScope: jest.fn(),
    lang: 'en' as const,
    ...over,
  };
  await render(<DrawerPanel {...props} />);
  return props;
}

(canRender ? describe : describe.skip)('the drawer\'s archive', () => {
  it('leaves an archived session out of the Agents group, and its pin with it', async () => {
    const side = { ...withArchived(SIDE_EMPTY, 'opencode', 'ses_idle01', true), folds: { ...SIDE_EMPTY.folds, agents: true } };
    await panel({ side, wbo: { t: wboStrings('en'), rows: [session({ session_id: 'ses_idle01' }), session({ session_id: 'ses_live02', name: 'Rail sag' })] } });
    // The group is there for the one that stayed, and counts it alone.
    expect(screen.getByTestId('drawer-agents')).toBeTruthy();
    expect(screen.getByTestId('drawer-agents-sum').props.children).toBe('1');
    expect(screen.queryByTestId('agent-wbo:ses_idle01')).toBeNull();
    expect(screen.getByTestId('agent-wbo:ses_live02')).toBeTruthy();
    // Nothing pinned on it: archiving dropped the pin.
    expect(screen.queryByTestId('agent-wbo:ses_idle01-pin')).toBeNull();
  });

  it('draws it in the Archived tab, newest first, and opens it from there', async () => {
    const side = withArchived(SIDE_EMPTY, 'opencode', 'ses_idle01', true);
    const props = await panel({
      side,
      scope: 'archived',
      wbo: { t: wboStrings('en'), rows: [session({ session_id: 'ses_idle01' }), session({ session_id: 'ses_old02', name: 'Lid review', updated: NOW - 3600_000 })] },
    });
    expect(screen.getByText('Archived agents · 1')).toBeTruthy();
    // The one that is not archived is not here.
    expect(screen.queryByTestId('archived-agent-wbo:ses_old02')).toBeNull();
    await fireEvent.press(screen.getByTestId('archived-agent-wbo:ses_idle01'));
    expect(props.onWbo).toHaveBeenCalledWith('ses_idle01');
    // An archive with something in it is not an empty archive.
    expect(screen.queryByText(t.emptyArchived)).toBeNull();
  });

  it('puts one back from its row menu, with one action', async () => {
    const side = withArchived(SIDE_EMPTY, 'opencode', 'ses_idle01', true);
    const props = await panel({ side, scope: 'archived', onArchive: jest.fn() });
    await fireEvent.press(screen.getByTestId('archived-agent-wbo:ses_idle01-more'));
    expect(screen.getByText('Unarchive')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('action-archived-agent-unarchive'));
    expect(props.onArchive).toHaveBeenCalledWith('opencode', 'ses_idle01', false);
  });

  it('archives from the group\'s own menu, by the row\'s kind and id', async () => {
    const props = await panel({ onArchive: jest.fn(), side: { ...SIDE_EMPTY, folds: { ...SIDE_EMPTY.folds, agents: true } } });
    await fireEvent.press(screen.getByTestId('agent-wbo:ses_idle01-more'));
    await fireEvent.press(screen.getByTestId('action-agent-archive'));
    expect(props.onArchive).toHaveBeenCalledWith('opencode', 'ses_idle01', true);
  });
});
