/** The Orchestrator as the app reads it: the tree, the live stream on a transcript, its calls in words. */
import type { AgentTree, McpCatalog, OrchStatus, OrchTranscript } from '../../api/types';
import {
  applyEvent,
  busyAgents,
  deltaPast,
  findTools,
  haltTitle,
  said,
  span,
  stateWord,
  statusDot,
  stepText,
  toolArgs,
  toolName,
  treeRows,
} from '../orchestrator';
import { orchStrings } from '../orchStrings';

const en = orchStrings('en');
const tr = orchStrings('tr');

const status = (over: Partial<OrchStatus>): OrchStatus => ({
  state: 'running',
  desired: 'running',
  halted: null,
  error: null,
  crash_loop: false,
  last_failure: null,
  next_try_at: null,
  started_at: null,
  provider_id: 'openrouter',
  model: 'anthropic/claude-sonnet-4.5',
  session: 'ses_root',
  choice: null,
  providers: [],
  ...over,
});

describe('its state', () => {
  it('in a word, in either language', () => {
    expect(stateWord(status({}), en)).toBe('Running');
    expect(stateWord(status({ state: 'halted' }), en)).toBe('Stopped');
    expect(stateWord(status({ state: 'restarting' }), tr)).toBe('Yeniden başlatılıyor…');
    expect(stateWord(null, en)).toBe('…');
  });

  it('as a dot: red when the provider stopped it, amber while it starts', () => {
    expect(statusDot(status({ halted: { kind: 'auth', message: 'invalid key', at: null } }))).toBe('error');
    expect(statusDot(status({ state: 'starting' }))).toBe('retry');
    expect(statusDot(status({ state: 'stopped', desired: 'stopped' }))).toBe('stopped');
    expect(statusDot(status({}))).toBe('idle');
  });

  it('says why it stopped', () => {
    expect(haltTitle('auth', en)).toBe('Your API key was rejected');
    expect(haltTitle('credit', tr)).toBe('Sağlayıcı krediniz bitti');
    expect(haltTitle('other', en)).toBe('Stopped');
  });
});

describe('the tree', () => {
  const tree: AgentTree = {
    root: 'r',
    nodes: [
      { id: 'r', parentID: null, title: 'main', agent: 'orchestrator', state: 'idle', started: 1, updated: 2, last_step: null },
      { id: 'a', parentID: 'r', title: 'Lid', agent: 'cad', state: 'done', started: 10, updated: 20, last_step: null },
      { id: 'b', parentID: 'r', title: 'Board', agent: 'pcb', state: 'running', started: 30, updated: 40,
        last_step: { kind: 'tool', tool: 'workbench_board_step', text: 'route' } },
      { id: 'c', parentID: 'b', title: 'Check', agent: 'pcb', state: 'retry', started: 50, updated: 60, last_step: null },
    ],
  };

  it('reads the Orchestrator first, each sub-agent under its parent, newest first', () => {
    const rows = treeRows(tree);
    expect(rows.map((r) => `${r.n.id}${r.depth}`)).toEqual(['r0', 'b1', 'c2', 'a1']);
    expect(busyAgents(rows)).toBe(2);
  });

  it('says what each does now', () => {
    expect(stepText(tree.nodes[2], en)).toBe('board_step · route');
    expect(stepText(tree.nodes[1], en)).toBe('done');
    expect(stepText(tree.nodes[0], tr)).toBe('bekleniyor');
  });

  it('is empty without a root', () => {
    expect(treeRows({ nodes: [], root: null })).toEqual([]);
    expect(treeRows(null)).toEqual([]);
  });
});

describe('its calls', () => {
  it('shows a line said in a room as an answer there', () => {
    const p = { type: 'tool' as const, tool: 'workbench_say', input: JSON.stringify({ room: 'cad', text: 'Lid is done.' }) };
    expect(said(p, en)).toEqual({ room: '3D Drawing', text: 'Lid is done.' });
    expect(said(p, tr)?.room).toBe('3D Çizim');
    expect(said({ type: 'tool', tool: 'workbench_model_build', input: '{}' }, en)).toBeNull();
  });

  it('names a call without its server, and a hand-off as one', () => {
    expect(toolName({ type: 'tool', tool: 'cad_model_build' }, en)).toBe('model_build');
    expect(toolName({ type: 'tool', tool: 'task' }, tr)).toBe('Ajana devret');
    expect(toolArgs({ type: 'tool', tool: 'task', input: JSON.stringify({ subagent_type: 'cad', description: 'lid' }) })).toBe(
      'cad · lid',
    );
    expect(toolArgs({ type: 'tool', tool: 'x', input: JSON.stringify({ id: 'm1', n: 2 }) })).toBe('id: m1, n: 2');
    expect(toolArgs({ type: 'tool', tool: 'x', title: 'Building the lid' })).toBe('Building the lid');
  });

  it('times them', () => {
    expect(span(0, 42_000)).toBe('42s');
    expect(span(0, 185_000)).toBe('3m 5s');
    expect(span(0, 4_320_000)).toBe('1h 12m');
  });
});

describe('the live stream on a transcript', () => {
  const base: OrchTranscript = { messages: [], truncated: false };

  it('adds a message, its parts and their text as it is written', () => {
    let x = applyEvent(base, { type: 'message', session: 's', id: 'm1', role: 'assistant', agent: 'orchestrator', time: 5 }, 's');
    x = applyEvent(x, { type: 'part', session: 's', message: 'm1', id: 'p1', part: { type: 'text', text: 'Hel' } }, 's');
    x = applyEvent(x, { type: 'delta', session: 's', message: 'm1', part: 'p1', delta: 'lo' }, 's');
    x = applyEvent(x, { type: 'delta', session: 's', message: 'm1', part: 'p2', delta: 'new' }, 's');
    expect(x.messages).toHaveLength(1);
    expect(x.messages[0].parts.map((p) => p.text)).toEqual(['Hello', 'new']);
    x = applyEvent(x, { type: 'message', session: 's', id: 'm1', role: 'assistant', done: 9, error: 'stopped' }, 's');
    expect(x.messages[0].done).toBe(9);
    expect(x.messages[0].error).toBe('stopped');
  });

  it('replaces a part written again, and takes away what was removed', () => {
    let x = applyEvent(base, { type: 'part', session: 's', message: 'm1', id: 't', part: { type: 'tool', status: 'running' } }, 's');
    x = applyEvent(x, { type: 'part', session: 's', message: 'm1', id: 't', part: { type: 'tool', status: 'completed' } }, 's');
    expect(x.messages[0].parts).toHaveLength(1);
    expect(x.messages[0].parts[0].status).toBe('completed');
    x = applyEvent(x, { type: 'removed', session: 's', message: 'm1', part: 't' }, 's');
    expect(x.messages[0].parts).toHaveLength(0);
    x = applyEvent(x, { type: 'removed', session: 's', message: 'm1', part: null }, 's');
    expect(x.messages).toHaveLength(0);
  });

  it('places a delta by its offset: the same delta from SSE and from S2 is added once', () => {
    let x = applyEvent(base, { type: 'part', session: 's', message: 'm1', id: 'p1', part: { type: 'text', text: 'Hel' } }, 's');
    x = applyEvent(x, { type: 'delta', session: 's', message: 'm1', part: 'p1', delta: 'lo', o: 3 }, 's');
    const again = applyEvent(x, { type: 'delta', session: 's', message: 'm1', part: 'p1', delta: 'lo', o: 3 }, 's');
    expect(again).toBe(x);
    x = applyEvent(x, { type: 'delta', session: 's', message: 'm1', part: 'p1', delta: 'lo w', o: 3 }, 's');
    expect(x.messages[0].parts[0].text).toBe('Hello w');
    expect(deltaPast('Hello', ' w', undefined)).toBe(' w');
    expect(deltaPast('Hel', 'lo', 9)).toBe('lo'); // a piece missed: all of it, the next part mends it
  });

  it("leaves another session's events alone", () => {
    const x = applyEvent(base, { type: 'delta', session: 'other', message: 'm', part: 'p', delta: 'x' }, 's');
    expect(x).toBe(base);
  });
});

describe('the MCP tools', () => {
  const cat: McpCatalog = {
    version: '2.4.0',
    count: 2,
    agents: [{ id: 'orchestrator', server: 'workbench', name: 'Orchestrator' }],
    groups: [
      { name: 'Rooms and questions', tools: [{ name: 'say', description: 'Write in a room', agents: [], params: [] }] },
      {
        name: 'Builds and pictures',
        tools: [
          {
            name: 'model_build',
            description: 'Build a model',
            agents: ['orchestrator'],
            params: [{ name: 'model', type: 'string', enum: null, description: 'its id', required: true }],
          },
        ],
      },
    ],
  };

  it('finds a tool by its name, what it does or its parameters', () => {
    expect(findTools(cat, '').map((g) => g.tools.length)).toEqual([1, 1]);
    expect(findTools(cat, 'room').map((g) => g.name)).toEqual(['Rooms and questions']);
    expect(findTools(cat, 'its id')[0].tools[0].name).toBe('model_build');
    expect(findTools(cat, 'nothing like it')).toEqual([]);
  });
});
