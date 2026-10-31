import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { linkMap } from '../../lib/agents';
import { agentStrings } from '../../lib/agentStrings';
import { SIDE_EMPTY } from '../../lib/side';
import { wbcStrings } from '../../lib/wbcStrings';
import { AgentGroup, type AgentRowData } from '../AgentGroup';

const canRender = typeof (React as { act?: unknown }).act === 'function';
const NOW = Date.now();

const row = (key: string, name: string, over: Partial<AgentRowData> = {}): AgentRowData => ({
  key,
  group: key.startsWith('wbc:') ? 'claude' : 'opencode',
  id: key.slice(4),
  name,
  note: null,
  says: 'idle',
  when: '1 min ago',
  dot: 'idle',
  live: true,
  last: NOW - 60_000,
  child: false,
  ...over,
});

const ROWS = [
  row('wbc:boss01', 'Boss', { last: NOW - 1000 }),
  row('wbo:ses_worker1', 'Worker one', { dot: 'running', last: NOW - 2000 }),
  row('wbo:ses_worker2', 'Worker two', { last: NOW - 3000 }),
  row('wbo:ses_alone1', 'Alone', { last: NOW - 500 }),
  row('wbo:ses_child1', 'A sub-agent', { child: true, last: NOW - 400 }),
];
const LINKS = linkMap([
  { worker: 'wbo:ses_worker1', manager: 'wbc:boss01' },
  { worker: 'wbo:ses_worker2', manager: 'wbc:boss01' },
]);

(canRender ? describe : describe.skip)('the drawer\'s Agents group', () => {
  const draw = (onLink = jest.fn(), onOpen = jest.fn()) =>
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <AgentGroup
        rows={ROWS}
        links={LINKS}
        maxDepth={3}
        prefs={SIDE_EMPTY}
        selected={null}
        searching={false}
        t={wbcStrings('en')}
        a={agentStrings('en')}
        onOpen={onOpen}
        onFold={jest.fn()}
        onPin={jest.fn()}
        onLink={onLink}
      />
      </SafeAreaProvider>,
    );

  it('draws both kinds as one tree, a manager saying how many work for it', async () => {
    await draw();
    expect(screen.getByText('Agents')).toBeTruthy();
    const order = screen.getAllByTestId(/^agent-wb[co]:[\w.]+$/).map((e) => e.props.testID);
    expect(order).toEqual([
      'agent-wbo:ses_child1',
      'agent-wbo:ses_alone1',
      'agent-wbc:boss01',
      'agent-wbo:ses_worker1',
      'agent-wbo:ses_worker2',
    ]);
    expect(screen.getByText('2 agents · 1 working')).toBeTruthy();
    // The head says how many, and how many are at work; an idle one has no dot (a dot is news).
    expect(screen.getByTestId('drawer-agents-sum').props.children).toBe('5 · 1 working');
    expect(screen.queryByTestId('agent-wbo:ses_alone1-dot')).toBeNull();
  });

  it('folded, shows no rows - the head\'s summary says what is there', async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <AgentGroup rows={ROWS} links={LINKS} maxDepth={3}
                    prefs={{ ...SIDE_EMPTY, pins: { claude: ['boss01'], opencode: [] }, folds: { ...SIDE_EMPTY.folds, agents: false } }}
                    selected={null} searching={false} t={wbcStrings('en')} a={agentStrings('en')}
                    onOpen={jest.fn()} onFold={jest.fn()} onPin={jest.fn()} onLink={jest.fn()} />
      </SafeAreaProvider>,
    );
    expect(screen.queryByTestId('agent-wbc:boss01')).toBeNull();
    expect(screen.getByTestId('drawer-agents-sum')).toBeTruthy();
  });

  it('folds a manager\'s agents away and back', async () => {
    await draw();
    await fireEvent.press(screen.getByTestId('agent-twist-wbc:boss01'));
    expect(screen.queryByTestId('agent-wbo:ses_worker1')).toBeNull();
    await fireEvent.press(screen.getByTestId('agent-twist-wbc:boss01'));
    expect(screen.getByTestId('agent-wbo:ses_worker1')).toBeTruthy();
  });

  it('offers only the moves the rules allow, and makes them', async () => {
    const onLink = jest.fn();
    await draw(onLink);
    await fireEvent(screen.getByTestId('agent-wbc:boss01'), 'longPress');
    // Not under its own worker (a circle), not under a sub-agent OpenCode started itself.
    expect(screen.queryByText('Put under Worker one')).toBeNull();
    expect(screen.queryByText('Put under A sub-agent')).toBeNull();
    expect(screen.getByText('Put under Alone')).toBeTruthy();
    expect(screen.queryByText('On its own')).toBeNull();
    await fireEvent.press(screen.getByText('Put under Alone'));
    expect(onLink).toHaveBeenCalledWith('wbc:boss01', 'wbo:ses_alone1');

    await fireEvent(screen.getByTestId('agent-wbo:ses_worker2'), 'longPress');
    await fireEvent.press(screen.getByText('On its own'));
    expect(onLink).toHaveBeenLastCalledWith('wbo:ses_worker2', null);
  });

  it('keeps the older ones a press away', async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <AgentGroup rows={[...ROWS, row('wbo:ses_old0001', 'Old one', { old: true, last: NOW - 9 * 86_400_000 })]}
                    links={LINKS} maxDepth={3} prefs={SIDE_EMPTY} selected={null} searching={false}
                    t={wbcStrings('en')} a={agentStrings('en')}
                    onOpen={jest.fn()} onFold={jest.fn()} onPin={jest.fn()} onLink={jest.fn()} />
      </SafeAreaProvider>,
    );
    expect(screen.queryByTestId('agent-wbo:ses_old0001')).toBeNull();
    await fireEvent.press(screen.getByText('Show 1 older'));
    expect(screen.getByTestId('agent-wbo:ses_old0001')).toBeTruthy();
    await fireEvent.press(screen.getByText('Hide the older ones'));
    expect(screen.queryByTestId('agent-wbo:ses_old0001')).toBeNull();
  });

  it('opens a row by its kind', async () => {
    const onOpen = jest.fn();
    await draw(jest.fn(), onOpen);
    await fireEvent.press(screen.getByTestId('agent-wbo:ses_worker2'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ group: 'opencode', id: 'ses_worker2' }));
  });
});
