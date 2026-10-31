/**
 * The readings behind a manager's Team (lib/team.ts): the state a dot shows, the order the agents keep, the
 * share of a window (from used/limit, not the server's capped pct), the bar's tone, a task's time, the one dim
 * line its agent left, the line an idle agent gets, and the closed tasks grouped by agent - as the web's
 * right-hand column reads them (frontend/src/app/rooms/team-panel.ts).
 */
import type { TeamAgent, TeamTask } from '../../api/types';
import { teamStrings } from '../teamStrings';
import {
  agentRank,
  agentsInOrder,
  barTone,
  closedTasks,
  dotTone,
  groupClosed,
  idleLine,
  lastClosed,
  oneLine,
  openTasks,
  pctOf,
  reportLine,
  shortTask,
  contextNumbers,
  overPct,
  tasksOf,
  took,
  when,
  windowOf,
} from '../team';

const t = teamStrings('en');
const NOW = 1_700_000_000_000;
const AT = 1_700_000_000; // the same moment in seconds

const agent = (over: Partial<TeamAgent> = {}): TeamAgent => ({
  agent: 'wbo:w1',
  kind: 'OpenCode',
  name: 'Worker one',
  computer: 'ada-laptop',
  directory: '~/sensor',
  state: 'idle',
  last: AT - 60,
  context: null,
  level: 1,
  open_tasks: [],
  ...over,
});

const task = (over: Partial<TeamTask> = {}): TeamTask => ({
  task: 'a0f239',
  agent: 'wbo:w1',
  agent_name: 'Worker one',
  title: 'Route the rail',
  status: 'working',
  created: AT - 600,
  updated: AT - 60,
  ...over,
});

describe('the dots a team draws', () => {
  it('reads the state as the dot: working green, waiting amber, interrupted or failed the error, idle quiet', () => {
    expect(dotTone('working')).toBe('ok');
    expect(dotTone('busy')).toBe('ok');
    expect(dotTone('starting')).toBe('ok');
    expect(dotTone('waiting for the person')).toBe('warn');
    expect(dotTone('waiting')).toBe('warn');
    expect(dotTone('interrupted')).toBe('bad');
    expect(dotTone('failed')).toBe('bad');
    expect(dotTone('offline')).toBe('bad');
    expect(dotTone('idle')).toBe('idle');
    expect(dotTone('answered')).toBe('idle');
  });

  it('puts what waits on the person first, then what works, then the idle, keeping their order', () => {
    const rows = [
      agent({ agent: 'a', state: 'idle' }),
      agent({ agent: 'b', state: 'working' }),
      agent({ agent: 'c', state: 'waiting for the person' }),
      agent({ agent: 'd', state: 'interrupted' }),
    ];
    expect(rows.map((r) => agentRank(r.state))).toEqual([2, 1, 0, 0]);
    expect(agentsInOrder(rows).map((r) => r.agent)).toEqual(['c', 'd', 'b', 'a']);
  });
});

describe('the share of a window', () => {
  it('is worked out from used/limit, even when the server pct is stale or capped', () => {
    expect(pctOf(agent({ context: { used: 50_000, limit: 200_000 } }))).toBe(25);
    // the server's pct is capped at 100 and lags a window that changed: the pair is the truth
    expect(pctOf(agent({ context: { used: 950_000, limit: 1_000_000, pct: 3 } }))).toBe(95);
    expect(pctOf(agent({ context: 41.4 }))).toBe(41);
    expect(pctOf(agent({ context: { pct: 40 } }))).toBe(40);
    expect(pctOf(agent({ context: null }))).toBeNull();
  });

  it('reads the window from the right field: the effective limit, else the model\'s own ceiling', () => {
    expect(windowOf({ used: 10, limit: 512_000, max: 1_048_576 })).toBe(512_000);
    expect(windowOf({ used: 10, limit: 0, max: 1_048_576 })).toBe(1_048_576);
    expect(windowOf({ used: 10, window: 200_000 })).toBe(200_000);
    expect(windowOf({ used: 10 })).toBeNull();
    expect(windowOf(null)).toBeNull();
    // a payload with no effective limit still says its share against the model's window
    expect(pctOf(agent({ context: { used: 262_144, max: 1_048_576 } }))).toBe(25);
  });

  it('caps a step past its window at 100 and says full, keeping the numbers behind it', () => {
    const over = agent({ context: { used: 590_874, limit: 512_000 } });
    expect(pctOf(over)).toBe(100);
    expect(overPct(over)).toBe(true);
    expect(contextNumbers(over)).toBe('591k / 512k · 115%');
    const under = agent({ context: { used: 413_212, limit: 512_000 } });
    expect(pctOf(under)).toBe(81);
    expect(overPct(under)).toBe(false);
    expect(contextNumbers(under)).toBe('413k / 512k · 81%');
    expect(overPct(agent({ context: null }))).toBe(false);
    expect(contextNumbers(agent({ context: null }))).toBe('');
    // the window comes from the model's ceiling when the run keeps to no smaller one
    expect(contextNumbers(agent({ context: { used: 262_144, max: 1_048_576 } }))).toBe('262k / 1M · 25%');
  });

  it('turns amber past 80 and red past 95', () => {
    expect(barTone(80)).toBe('');
    expect(barTone(81)).toBe('warn');
    expect(barTone(95)).toBe('warn');
    expect(barTone(96)).toBe('bad');
    expect(barTone(null)).toBe('');
  });
});

describe('the numbers beside a task', () => {
  it('says how long it has been going while it runs, and what it took once it answered', () => {
    const running = task({ status: 'working', created: AT - 600, updated: AT - 60 });
    expect(took(running, NOW)).toBe('10m');
    const answered = task({ status: 'answered', created: AT - 300, updated: AT - 60 });
    expect(took(answered, NOW)).toBe('4m');
    const short = task({ status: 'queued', created: AT - 5, updated: AT - 5 });
    expect(took(short, NOW)).toBe('5s');
  });

  it('says an age from seconds or milliseconds the same way', () => {
    expect(when(AT - 300, NOW)).toBe('5m');
    expect(when((AT - 300) * 1000, NOW)).toBe('5m');
    expect(when(null, NOW)).toBe('');
    expect(when(AT - 90, NOW)).toBe('2m');
    expect(when(AT - 3 * 3600, NOW)).toBe('3h 0m');
  });

  it('names a task by the last six of its id', () => {
    expect(shortTask('0123456789abcdef')).toBe('abcdef');
    expect(shortTask('')).toBe('');
  });
});

describe('the work under an agent', () => {
  it('is the ids its own list names, else the open tasks it holds', () => {
    const open = [
      task({ task: 'x1' }),
      task({ task: 'x2', agent: 'wbo:w2' }),
      task({ task: 'x3', agent: 'wbo:w2' }),
    ];
    expect(tasksOf(agent({ open_tasks: [{ task: 'x1' }] }), open).map((x) => x.task)).toEqual(['x1']);
    expect(tasksOf(agent({ agent: 'wbo:w2', open_tasks: 2 }), open).map((x) => x.task)).toEqual(['x2', 'x3']);
  });

  it('counts failed tasks as closed, as the web does', () => {
    const rows = [task({ status: 'working' }), task({ status: 'failed' }), task({ status: 'closed' })];
    expect(openTasks(rows).map((x) => x.status)).toEqual(['working']);
    expect(closedTasks(rows).map((x) => x.status)).toEqual(['failed', 'closed']);
  });

  it('gives an idle agent the last thing it closed', () => {
    const closed = [
      task({ task: 'old001', status: 'closed', updated: AT - 900 }),
      task({ task: 'new002', status: 'closed', updated: AT - 300 }),
      task({ task: 'other1', agent: 'wbo:w2', status: 'closed', updated: AT - 60 }),
    ];
    expect(lastClosed('wbo:w1', closed)?.task).toBe('new002');
    expect(idleLine('idle', lastClosed('wbo:w1', closed), t, NOW)).toBe('idle · last task #new002 closed 5m');
    expect(idleLine('idle', null, t, NOW)).toBe('idle · no task yet');
    expect(idleLine('offline', null, t, NOW)).toBe('offline · no task yet');
  });
});

describe('the agent\'s own word', () => {
  it('is the last report it made, flattened to one line', () => {
    const row = task({
      reports: [
        { status: 'progress', summary: 'Routing the **rail**', at: AT - 120, by: 'wbo:w1', by_name: 'Worker one' },
        { status: 'done', summary: 'The `DRC` is clean', at: AT - 60, by: 'wbo:w1', by_name: 'Worker one' },
      ],
    });
    expect(reportLine(row, t)).toBe('reported done · The DRC is clean');
  });

  it('falls back to what it answered, and says nothing when it has neither', () => {
    expect(reportLine(task({ status: 'answered', answer: 'The **rail** is fixed.' }), t)).toBe(
      'answered · The rail is fixed.',
    );
    expect(reportLine(task({ answer: null, reports: null }), t)).toBe('');
  });

  it('strips the markup a one-line clamp would show', () => {
    expect(oneLine('## Head\n\n- one\n- [two](https://x) `code`')).toBe('Head one two code');
  });
});

describe('the closed tasks at the foot', () => {
  it('are grouped by their agent, in the list\'s order, and an unknown agent still gets its own group', () => {
    const agents = [agent({ agent: 'wbo:w1', name: 'Worker one' }), agent({ agent: 'wbo:w2', name: 'Worker two' })];
    const closed = [
      task({ task: 'c1', agent: 'wbo:w2', agent_name: 'Worker two', status: 'closed' }),
      task({ task: 'c2', agent: 'wbo:w1', agent_name: 'Worker one', status: 'closed' }),
      task({ task: 'c3', agent: 'wbo:w9', agent_name: 'Gone one', status: 'failed' }),
    ];
    const groups = groupClosed(agents, closed);
    expect(groups.map((g) => [g.name, g.tasks.map((x) => x.task)])).toEqual([
      ['Worker one', ['c2']],
      ['Worker two', ['c1']],
      ['Gone one', ['c3']],
    ]);
  });
});
