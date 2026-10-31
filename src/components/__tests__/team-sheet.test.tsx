/**
 * A manager's Team on the phone (components/TeamSheet.tsx, lib/team.ts): one list, one block an agent - its
 * state dot, its name and how much of its window it uses, the tasks it holds with the state and the time at the
 * right, and its own last word as one dim line a tap opens - the agents that wait first, the idle last, and the
 * closed tasks folded at the foot grouped by agent, as the web's right-hand column draws them. Only reading: an
 * agent's row opens its own session, a task's row or its word opens what the agent said.
 */
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkbenchClient } from '../../api/client';
import type { BusEvent, TeamAnswer } from '../../api/types';
import { LiveContext } from '../../live/LiveContext';
import type { LiveHub } from '../../live/hub';
import { teamStrings } from '../../lib/teamStrings';
import { colors } from '../../theme/tokens';
import { TeamSheet } from '../TeamSheet';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../KeyboardSpacer', () => ({ KeyboardSpacer: () => null }));

const canRender = typeof (React as { act?: unknown }).act === 'function';
const t = teamStrings('en');
const NOW = Date.now();

/**
 * Four agents under the manager: one waiting on the person, two working (one past its window - its server pct
 * is a lie, 3, while used/limit is 115 % - and one nearly full), one idle with only a closed task to its name.
 */
const DATA: TeamAnswer = {
  manager: 'wbc:boss',
  agents: [
    {
      agent: 'wbo:work1',
      kind: 'OpenCode',
      name: 'Worker one',
      computer: 'ada-laptop',
      directory: '~/sensor',
      state: 'working',
      last: NOW / 1000 - 30,
      context: { used: 590_874, limit: 512_000, pct: 3 },
      level: 1,
      open_tasks: [{ task: 'a0f239', title: 'Route the rail', status: 'working' }, { task: 'e5f6a7' }],
    },
    {
      agent: 'wbo:work2',
      kind: 'OpenCode',
      name: 'Worker four',
      computer: 'x33-workstation',
      directory: '~/fw/ota',
      state: 'working',
      last: NOW / 1000 - 25,
      context: { used: 950_000, limit: 1_000_000 },
      level: 1,
      open_tasks: [{ task: 'f7a8b9', title: 'Compile the firmware', status: 'working' }],
    },
    {
      agent: 'wbo:idle1',
      kind: 'OpenCode',
      name: 'Worker two',
      computer: null,
      directory: null,
      state: 'idle',
      last: NOW / 1000 - 600,
      context: null,
      level: 2,
      open_tasks: [],
    },
    {
      agent: 'wbo:wait1',
      kind: 'OpenCode',
      name: 'Worker three',
      computer: 'x33-workstation',
      directory: '~/projects/ota',
      state: 'waiting for the person',
      last: NOW / 1000 - 20,
      context: { used: 200_000, limit: 1_000_000 },
      level: 1,
      open_tasks: [{ task: 'b1c2d3', title: 'Check the thermal pad', status: 'waiting' }],
    },
  ],
  tasks: [
    {
      task: 'a0f239',
      agent: 'wbo:work1',
      agent_name: 'Worker one',
      title: 'Route the rail',
      status: 'working',
      created: NOW / 1000 - 600,
      updated: NOW / 1000 - 60,
      reports: [
        {
          status: 'progress',
          summary: 'Routing the **rail**; DRC next',
          at: NOW / 1000 - 120,
          by: 'wbo:work1',
          by_name: 'Worker one',
        },
      ],
    },
    {
      task: 'f7a8b9',
      agent: 'wbo:work2',
      agent_name: 'Worker four',
      title: 'Compile the firmware',
      status: 'working',
      created: NOW / 1000 - 120,
      updated: NOW / 1000 - 25,
    },
    {
      task: 'b1c2d3',
      agent: 'wbo:wait1',
      agent_name: 'Worker three',
      title: 'Check the thermal pad',
      status: 'waiting',
      created: NOW / 1000 - 300,
      updated: NOW / 1000 - 30,
    },
    {
      task: 'e5f6a7',
      agent: 'wbo:work1',
      agent_name: 'Worker one',
      title: 'Swap FB2 for a bead',
      status: 'answered',
      answer: 'The **rail** is fixed.',
      answer_at: NOW / 1000 - 120,
      created: NOW / 1000 - 300,
      updated: NOW / 1000 - 120,
    },
    {
      task: 'c3d4e5',
      agent: 'wbo:idle1',
      agent_name: 'Worker two',
      title: 'Tile the lid',
      status: 'closed',
      answer: 'Tiled at 2 mm.',
      outcome: 'done',
      created: NOW / 1000 - 1800,
      updated: NOW / 1000 - 600,
    },
    {
      task: 'd4e5f6',
      agent: 'wbo:work1',
      agent_name: 'Worker one',
      title: 'Measure the bead',
      status: 'closed',
      created: NOW / 1000 - 3600,
      updated: NOW / 1000 - 300,
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
  it('is one list in the order the person needs, with the counts of the team above it', async () => {
    const c = fake();
    await draw(c);
    expect(c.agentTeam).toHaveBeenCalledWith('wbc:boss');
    expect(screen.getByTestId('team-counts')).toHaveTextContent('4 agents · 2 working');
    const order = screen.getAllByTestId(/^team-agent-block-/).map((n) => String(n.props.testID));
    expect(order).toEqual([
      'team-agent-block-wbo:wait1',
      'team-agent-block-wbo:work1',
      'team-agent-block-wbo:work2',
      'team-agent-block-wbo:idle1',
    ]);
    // the old two sections are gone: no AGENTS or TASKS heads, one row an agent
    expect(screen.queryByText('Agents')).toBeNull();
    expect(screen.queryByText('Tasks')).toBeNull();
  });

  it('says each agent its share from used/limit, amber near the top and "full" past the window', async () => {
    await draw(fake());
    expect(screen.getByText('95%')).toBeTruthy();
    expect(screen.getByText('20%')).toBeTruthy();
    expect(screen.getByTestId('team-bar-wbo:work2')).toHaveStyle({ backgroundColor: colors.warn });
    // 115 % of 512k: the bar cannot hold it, so the row says "full" in the error tone
    expect(screen.getByTestId('team-ctx-wbo:work1')).toHaveTextContent('full');
    expect(screen.getByTestId('team-ctx-wbo:work1')).not.toHaveTextContent('115');
    expect(screen.getByTestId('team-bar-wbo:work1')).toHaveStyle({ backgroundColor: colors.danger });
  });

  it('keeps the real numbers behind a tap on the share', async () => {
    await draw(fake());
    expect(screen.queryByTestId('team-ctx-numbers-wbo:work1')).toBeNull();
    await fireEvent.press(screen.getByTestId('team-ctx-wbo:work1'));
    expect(screen.getByTestId('team-ctx-numbers-wbo:work1')).toHaveTextContent('591k / 512k · 115%');
    await fireEvent.press(screen.getByTestId('team-ctx-wbo:work1'));
    expect(screen.queryByTestId('team-ctx-numbers-wbo:work1')).toBeNull();
  });

  it('keeps the dot for the state: green working, amber waiting, a hollow ring idle', async () => {
    await draw(fake());
    const dot = (agent: string) => screen.getByTestId(`team-dot-${agent}`, { includeHiddenElements: true });
    expect(dot('wbo:work1')).toHaveStyle({ backgroundColor: colors.ok });
    expect(dot('wbo:wait1')).toHaveStyle({ backgroundColor: colors.warn });
    expect(dot('wbo:idle1')).toHaveStyle({ borderColor: colors.line });
  });

  it('puts the agent\'s tasks under it: the number, a title, the state and the time at the right', async () => {
    await draw(fake());
    expect(screen.getByTestId('team-task-row-a0f239')).toHaveTextContent(/#a0f239 Route the rail/);
    expect(screen.getByTestId('team-task-row-a0f239')).toHaveTextContent(/working · \d+m/);
    expect(screen.getByTestId('team-task-row-b1c2d3')).toHaveTextContent(/waiting · \d+m/);
    // the title wraps to two lines rather than being cut
    expect(screen.getByTestId('team-task-main-a0f239').props.numberOfLines).toBe(2);
  });

  it('shows the agent\'s last word as one dim line, and a tap opens it in the same small type', async () => {
    await draw(fake());
    expect(screen.getByTestId('team-note-a0f239')).toHaveTextContent('reported progress · Routing the rail; DRC next');
    expect(screen.getByTestId('team-note-text-a0f239').props.numberOfLines).toBe(1);
    expect(screen.queryByTestId('team-answer-a0f239')).toBeNull();
    await fireEvent.press(screen.getByTestId('team-note-a0f239'));
    // the same small type, all of it: the report opens under the line, which stays one line
    expect(screen.getByTestId('team-answer-a0f239')).toHaveTextContent('Routing the rail; DRC next');
    expect(screen.getByTestId('team-note-text-a0f239').props.numberOfLines).toBe(1);
    // an answered task opens what it said, flattened, not the big Markdown answer
    expect(screen.getByTestId('team-note-e5f6a7')).toHaveTextContent('answered · The rail is fixed.');
    await fireEvent.press(screen.getByTestId('team-note-e5f6a7'));
    expect(screen.getByTestId('team-answer-e5f6a7')).toHaveTextContent('The rail is fixed.');
  });

  it('gives an agent holding nothing one line: the task it closed last', async () => {
    await draw(fake());
    expect(screen.getByTestId('team-idle-wbo:idle1')).toHaveTextContent('idle · last task #c3d4e5 closed 10m');
  });

  it('opens the agent itself when its row is tapped', async () => {
    const { onOpenAgent } = await draw(fake());
    await fireEvent.press(screen.getByTestId('team-agent-wbo:work1'));
    expect(onOpenAgent).toHaveBeenCalledWith('wbo:work1');
  });

  it('folds the closed tasks at the foot, grouped by the agent that held them', async () => {
    await draw(fake());
    expect(screen.queryByTestId('team-closed-c3d4e5')).toBeNull();
    expect(screen.getByText('2 closed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('team-closed'));
    expect(screen.getByTestId('team-closed-group-wbo:work1')).toHaveTextContent(/Worker one/);
    expect(screen.getByTestId('team-closed-group-wbo:work1')).toHaveTextContent(/#d4e5f6 Measure the bead/);
    expect(screen.getByTestId('team-closed-c3d4e5')).toHaveTextContent(/#c3d4e5 Tile the lid/);
    expect(screen.getByTestId('team-closed-c3d4e5')).toHaveTextContent(/closed \d+m/);
  });

  it('says so when nobody is under the session', async () => {
    await draw(fake({ manager: 'wbc:boss', agents: [], tasks: [] }));
    expect(screen.getByTestId('team-empty-agent')).toBeTruthy();
    expect(screen.getByText('No agents under this session yet.')).toBeTruthy();
    expect(screen.getByTestId('team-counts')).toHaveTextContent('0 agents · 0 working');
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
