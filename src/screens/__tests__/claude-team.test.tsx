/**
 * The Team button in a Claude session's bar: only a session with agents under it has one, and it opens the sheet
 * the web's right-hand column is (components/TeamSheet.tsx). The screen itself is the Claude session's
 * (screens/__tests__/claude-session.test.tsx); here only the button and what a row does with it.
 */
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import type { TeamAnswer, WbcDetail, WbcTurn } from '../../api/types';
import { wbcStrings } from '../../lib/wbcStrings';
import { MARK } from '../../lib/wbc';
import { ClaudeSessionScreen } from '../ClaudeSessionScreen';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../../components/KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));
jest.mock('../../components/SwipeRow', () => ({
  SwipeRow: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../lib/pictureFile', () => ({ readPictureHead: jest.fn(() => null) }));
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => ({ uri: null, prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn() }),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const canRender = typeof (React as { act?: unknown }).act === 'function';
const en = wbcStrings('en');
const NOW = Date.now() / 1000;

const TEAM: TeamAnswer = {
  manager: 'wbc:s1',
  agents: [
    {
      agent: 'wbo:worker1',
      kind: 'OpenCode',
      name: 'Worker one',
      computer: 'ada-laptop',
      directory: '~/sensor',
      state: 'working',
      last: NOW - 20,
      context: { pct: 40 },
      level: 1,
      open_tasks: 1,
    },
  ],
  tasks: [],
};

const TURNS: WbcTurn[] = [{ id: 'r1', role: 'user', text: 'Run the DRC', at: NOW - 60 }];

function client() {
  const d: WbcDetail = {
    session_id: 's1',
    name: 'Boss',
    title: '',
    status: 'active',
    computer: 'ada-laptop',
    first_ts: NOW - 4000,
    last_ts: NOW - 60,
    prompts: 2,
    requests: 8,
    known: true,
    mine: true,
    owner: { id: 'u1', name: 'Ada' },
    bridge: null,
    may_send: false,
    why: 'This session is not on wb-claude.',
    messages: [],
    mark: MARK,
  };
  return {
    wbcSession: jest.fn(async () => d),
    wbcTurns: jest.fn(async () => ({ turns: TURNS, more: false, before: null })),
    agentTeam: jest.fn(async () => TEAM),
    wbcTurnImagePath: (sid: string, req: string, n: number) => `/api/wbc/sessions/${sid}/images/${req}/${n}`,
    wbcMessageImagePath: (sid: string, mid: string, n: number) =>
      `/api/wbc/sessions/${sid}/messages/${mid}/images/${n}`,
  } as unknown as WorkbenchClient & { agentTeam: jest.Mock };
}

async function open(teamCount: number, onOpenAgent = jest.fn()) {
  await render(
    <ClaudeSessionScreen
      sid="s1"
      client={client()}
      user={{ id: 'u1', name: 'Ada' }}
      t={en}
      lang="en"
      teamCount={teamCount}
      onOpenAgent={onOpenAgent}
    />,
  );
  return onOpenAgent;
}

(canRender ? describe : describe.skip)('a Claude session as a manager', () => {
  it('has no Team button while nothing is under it', async () => {
    await open(0);
    expect(screen.queryByTestId('wbc-team')).toBeNull();
  });

  it('opens its Team in a sheet, and says who is under it', async () => {
    await open(2);
    await fireEvent.press(screen.getByTestId('wbc-team'));
    expect(screen.getByTestId('wbc-team-sheet')).toBeTruthy();
    expect(screen.getByText('Worker one')).toBeTruthy();
  });

  it('hands an agent\'s row to the screen that opens sessions', async () => {
    const onOpenAgent = await open(1);
    await fireEvent.press(screen.getByTestId('wbc-team'));
    await fireEvent.press(screen.getByTestId('team-agent-wbo:worker1'));
    expect(onOpenAgent).toHaveBeenCalledWith('wbo:worker1');
  });
});
