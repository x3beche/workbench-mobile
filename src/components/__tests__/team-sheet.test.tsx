/**
 * A manager's Team on the phone (components/TeamSheet.tsx, lib/team.ts): the agents under the session with a
 * state dot, the share of the window they use and the task they hold, then its tasks - the open ones with their
 * answer under a tap, the closed ones folded - as the web's right-hand column draws them. Only reading: a row
 * opens the agent's own session, a task opens the answer.
 */
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import type { BusEvent, TeamAnswer } from '../../api/types';
import { LiveContext } from '../../live/LiveContext';
import type { LiveHub } from '../../live/hub';
import { teamStrings } from '../../lib/teamStrings';
import { TeamSheet } from '../TeamSheet';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));

const canRender = typeof (React as { act?: unknown }).act === 'function';
const t = teamStrings('en');
const NOW = Date.now() / 1000;

/** Two agents under the manager, one of them with the work: one worker, a sub-agent under it. */
const DATA: TeamAnswer = {
  manager: 'wbc:boss',
  agents: [
    {
      agent: 'wbo:worker1',
      kind: 'OpenCode',
      name: 'Worker one',
      computer: 'ada-laptop',
      directory: '~/sensor',
      state: 'working',
      last: NOW - 30,
      context: { used: 50_000, limit: 200_000 },
      level: 1,
      open_tasks: [{ task: 't1' }, { task: 't9' }],
    },
    {
      agent: 'wbo:worker2',
      kind: 'OpenCode',
      name: 'Worker two',
      computer: null,
      directory: null,
      state: 'idle',
      last: NOW - 600,
      context: null,
      level: 2,
      open_tasks: 0,
    },
  ],
  tasks: [
    {
      task: 't1',
      agent: 'wbo:worker1',
      agent_name: 'Worker one',
      title: 'Route the rail',
      status: 'answered',
      answer: 'The rail is **fixed**.',
      answer_at: NOW - 40,
      created: NOW - 300,
      updated: NOW - 40,
    },
    {
      task: 't2',
      agent: 'wbo:worker1',
      agent_name: 'Worker one',
      title: 'Tile the lid',
      status: 'closed',
      answer: 'Tiled at 2 mm.',
      outcome: 'done',
      created: NOW - 900,
      updated: NOW - 600,
    },
  ],
};

function fake(data: TeamAnswer = DATA) {
  return { agentTeam: jest.fn(async () => data) } as unknown as WorkbenchClient & { agentTeam: jest.Mock };
}

function fakeHub(): { hub: LiveHub; say: (e: BusEvent) => void } {
  const subs: { kinds: string[]; fn: (e: BusEvent) => void }[] = [];
  const hub = {
    live: () => true,
    onLive: () => () => true,
    on: (kinds: string | string[], fn: (e: BusEvent) => void) => {
      const s = { kinds: Array.isArray(kinds) ? kinds : [kinds], fn };
      subs.push(s);
      return () => subs.splice(subs.indexOf(s), 1);
    },
    pace: () => ({ due: () => true, mark: () => undefined, ms: 1 }),
    follow: () => ({ start() {}, stop() {}, pause() {}, resume() {}, live: () => false }),
    drop() {},
  } as unknown as LiveHub;
  const say = (e: BusEvent) => {
    for (const s of [...subs]) if (e.k.startsWith('$') || s.kinds.includes(e.k)) s.fn(e);
  };
  return { hub, say };
}

async function draw(client: WorkbenchClient, onOpenAgent = jest.fn(), hub: LiveHub | null = null) {
  await render(
    <LiveContext.Provider value={hub}>
      <TeamSheet client={client} sid="boss" t={t} sub="Boss" onClose={jest.fn()} onOpenAgent={onOpenAgent} />
    </LiveContext.Provider>,
  );
  return { onOpenAgent };
}

(canRender ? describe : describe.skip)("a manager's Team", () => {
  it('says each agent, its share of the window and the work it holds', async () => {
    const c = fake();
    await draw(c);
    expect(c.agentTeam).toHaveBeenCalledWith('wbc:boss');
    expect(screen.getByText('Worker one')).toBeTruthy();
    expect(screen.getByText('Worker two')).toBeTruthy();
    // the share, from used/limit, and the work held, from the list
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getByText(/^2 open · #t1 Route the rail$/)).toBeTruthy();
    expect(screen.getByTestId('team-agents-count').props.children).toBe(2);
  });

  it('opens a task and draws its answer in the app\'s markdown', async () => {
    await draw(fake());
    expect(screen.queryByTestId('team-answer-t1')).toBeNull();
    await fireEvent.press(screen.getByTestId('team-task-row-t1'));
    expect(screen.getByTestId('team-answer-t1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('team-task-row-t1'));
    expect(screen.queryByTestId('team-answer-t1')).toBeNull();
  });

  it('opens the agent itself when its row is tapped', async () => {
    const { onOpenAgent } = await draw(fake());
    await fireEvent.press(screen.getByTestId('team-agent-wbo:worker1'));
    expect(onOpenAgent).toHaveBeenCalledWith('wbo:worker1');
  });

  it('keeps the closed tasks folded until asked for them', async () => {
    await draw(fake());
    expect(screen.queryByText('Tile the lid')).toBeNull();
    expect(screen.getByText('1 closed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('team-closed'));
    expect(screen.getByText('Tile the lid')).toBeTruthy();
  });

  it('says so when nobody is under the session', async () => {
    await draw(fake({ manager: 'wbc:boss', agents: [], tasks: [] }));
    expect(screen.getByTestId('team-empty-agent')).toBeTruthy();
    expect(screen.getByText('No agents under this session yet.')).toBeTruthy();
    expect(screen.getByText('No tasks yet.')).toBeTruthy();
  });

  it('reads the team again when the bus says the agents changed', async () => {
    const c = fake();
    const { hub, say } = fakeHub();
    await draw(c, jest.fn(), hub);
    expect(c.agentTeam).toHaveBeenCalledTimes(1);
    await act(async () => say({ k: 'agents' } as BusEvent));
    expect(c.agentTeam).toHaveBeenCalledTimes(2);
  });
});
