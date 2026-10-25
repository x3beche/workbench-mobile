/** Shapes the Workbench server answers with (backend/main.py, backend/cc_chat.py). */

export interface User {
  id: string;
  name?: string | null;
  email?: string;
  /** A picture of their own (GET /api/me/avatar/{id}?v=avatar_v); else the initials. */
  has_avatar?: boolean;
  avatar_v?: number | string | null;
}

export interface AuthState {
  /** "on": sign-in is required. "off": local mode, everyone is the owner. */
  mode: 'on' | 'off';
  needs_setup?: boolean;
  user: User | null;
  role: string | null;
  /** What this role may do (backend/access.py ACTIONS): view, draw, run, edit, delete, ... */
  can?: string[];
  must_change_password?: boolean;
}

export interface Who {
  id?: string;
  name?: string;
  type?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  at: string;
  by?: Who;
  provider?: string;
  model?: string;
  thinking?: string;
  error?: string;
  stopped?: boolean;
  interrupted?: boolean;
  edited_at?: string;
  /** The tools the model ran for this answer, where they happened in it. */
  steps?: Step[];
}

/**
 * One tool the model ran while writing an answer (backend/ccgen.py run_step).
 * `say` is a sentence with {name} slots filled from `vars`; `pos` is where in
 * the answer's text it ran.
 */
export interface Step {
  id: string;
  tool: string;
  status: 'running' | 'done' | 'error' | 'ask' | 'denied' | 'stopped' | 'interrupted' | string;
  pos?: number;
  say?: string;
  vars?: Record<string, string | number>;
  summary?: string;
  error?: string;
  ms?: number;
}

export interface Chat {
  id: string;
  title: string;
  provider: string;
  model: string;
  by?: Who;
  created_at: string;
  updated_at: string;
  count: number;
  pinned?: boolean;
  archived?: boolean;
  messages?: ChatMessage[];
  last?: { role: string; text: string; by?: string };
  /** The answer being written in it, if any. */
  gen?: string | null;
  /** In the trash: when it was deleted, and the whole days left before it goes for good. */
  deleted_at?: string;
  purge_at?: string;
  days_left?: number;
}

/** Which conversations a list shows: the live ones, the archived ones, or the trash. */
export type ChatScope = 'live' | 'archived' | 'trash';

export interface Provider {
  id: string;
  name: string;
  /** A key is set on the server: the provider can answer. */
  set: boolean;
}

export interface Model {
  id: string;
  name: string;
  context?: number | null;
  cheap?: boolean;
}

/** One server-sent event of an answer being written (cc_chat._begin / live). */
export interface ChatEvent {
  type: string;
  text?: string;
  at?: number;
  error?: string;
  message?: ChatMessage | null;
  keep?: number;
  title?: string;
  gen?: string;
  live?: { gen: string; text?: string; thinking?: string; model?: string; steps?: Step[] }[];
  thinking?: string;
  steps?: Step[];
}

/**
 * The empty Chat's example questions (GET /api/cc/ideas, backend/chat_ideas.py):
 * written by a model from the person's own work, or none yet (`default`).
 * `start` is the model a new conversation begins with.
 */
export interface Ideas {
  items: { kind: string; text: string }[];
  source: 'llm' | 'default';
  start?: { provider: string; model: string };
}

// ---- the agent rooms (backend/chat.py: /api/chat/rooms, /api/chat) --------

/** A room of the workspace chat: 3D Drawing, PCB Design or Firmware. */
export type RoomId = 'cad' | 'pcb' | 'firmware';

/** The last thing said in a room. */
export interface RoomLast {
  role: 'user' | 'agent';
  text: string;
  at: string;
  by?: string | null;
}

/**
 * A room as GET /api/chat/rooms gives it: what was said in it, what waits to
 * be read, and when the agent last wrote (what is unread is counted from
 * those - the server sends its last 99).
 */
export interface Room {
  room: RoomId;
  count: number;
  waiting: number;
  urgent: number;
  last: RoomLast | null;
  agent_at: string[];
}

/** One line of a room's thread (GET /api/chat?room=). */
export interface RoomLine {
  id: string;
  at: string;
  role: 'user' | 'agent';
  text: string;
  urgent?: boolean;
  room?: RoomId;
  by?: Who;
  seen_at?: string | null;
}

/** 202 from POST /messages: an answer was being written, so the line waits. */
export interface Queued {
  queued?: { id: string; content: string };
  queue?: unknown[];
  paused?: boolean;
}

export interface Transcript {
  text: string;
  language: string;
  model: string;
  seconds: number;
}

// ---- Files (backend/files_api.py, backend/files_virtual.py) ---------------

/** How the server previews a file (files.preview_of). */
export type Preview =
  'image' | 'video' | 'audio' | 'pdf' | 'markdown' | 'table' | 'archive' | 'mesh' | 'step' | 'text' | 'none';

export interface StoredFile {
  id: string;
  name: string;
  bytes: number;
  kind: string;
  content_type?: string;
  preview: Preview;
  folder: string;
  created_at: string;
  by?: Who;
  note?: string;
  sha256?: string;
  context?: Record<string, string>;
  /** One of what the app keeps (In the app): read-only here; `where` is the area that changes it. */
  ro?: boolean;
  where?: string;
}

export interface FileFolder {
  id: string;
  name: string;
  parent: string;
  path?: string;
  by?: Who;
  created_at?: string;
  /** A read-only folder (In the app); `root` for Projects, Chat, Parts, Agents and Taste. */
  ro?: boolean;
  root?: boolean;
  where?: string;
  /** What a read-only folder holds itself, when the server read it one folder at a time (`?under=`). */
  count?: { folders: number; files: number };
}

/** GET /api/files/virtual: the read-only folders, their own files, and which uploads they refer to. */
export interface VirtualTree {
  folders: FileFolder[];
  files: StoredFile[];
  links: { folder: string; file: string }[];
}

/**
 * GET /api/files/virtual?under=: one read-only folder ("" the roots) - the
 * folders in it, each with what it holds itself (`count`), its own files,
 * its links and the uploads they refer to (`linked`), and the way to it
 * from the top (`trail`).
 */
export interface VirtualFolder {
  under: string;
  trail: { id: string; name: string }[];
  folders: FileFolder[];
  files: StoredFile[];
  links: { folder: string; file: string }[];
  linked: StoredFile[];
}

/** A file in Files' trash (GET /api/files/trash). */
export interface TrashFile extends StoredFile {
  deleted_at: string;
  deleted_by?: Who;
  purge_at: string;
  folder_path: string;
  days_left: number | null;
}

/** A file picked on the phone to upload: a uri on Android and iOS, a Blob in a browser. */
export type UploadPart = { uri: string; name: string; type: string } | { blob: Blob; name: string };

// ---- the Orchestrator (backend/orchestrator: /api/me/orchestrator, /api/mcp/tools) ----

/** GET /api/me/orchestrator: one's own Orchestrator, the agent that answers in every room. */
export interface OrchStatus {
  state: 'running' | 'starting' | 'restarting' | 'stopped' | 'halted';
  desired: string;
  /** Stopped by the supervisor: the key was refused (`auth`), the credits ran out (`credit`), or else. */
  halted: { kind: string; message: string; at: string | null } | null;
  error: string | null;
  crash_loop: boolean;
  last_failure: { kind: string; at: string | null; code: number | null } | null;
  next_try_at: string | null;
  started_at: string | null;
  provider_id: string | null;
  model: string | null;
  session: string | null;
  /** The provider and model chosen for it in Agent & LLM. */
  choice: { provider_id: string; model: string } | null;
  providers: { id: string; name: string; kind?: string; key_hint?: string | null; ok?: boolean | null; models: string[] }[];
  limits?: { mem_mb: number; cpus: number };
  mcp_version?: string | null;
}

export type AgentState = 'running' | 'retry' | 'idle' | 'done' | 'error' | 'stopped';

/** What a session did last, under its name in the tree. */
export interface AgentStep {
  kind: 'tool' | 'text' | 'thinking' | 'user';
  tool?: string;
  status?: string;
  text: string;
}

/** A session in the Orchestrator's tree: its own (the root) or a sub-agent's. */
export interface AgentNode {
  id: string;
  parentID: string | null;
  title: string;
  agent: string | null;
  state: AgentState;
  started: number | null;
  updated: number | null;
  last_step: AgentStep | null;
  error?: string;
}

/** GET /api/me/orchestrator/tree. */
export interface AgentTree {
  nodes: AgentNode[];
  root: string | null;
  reason?: string;
}

/** A piece of a message in a session's transcript (backend/sandbox/agents.py _part). */
export interface OrchPart {
  id?: string;
  type: 'text' | 'reasoning' | 'tool' | 'subtask' | 'file';
  text?: string;
  synthetic?: boolean;
  agent?: string;
  tool?: string;
  status?: string;
  title?: string;
  input?: string;
  output?: string;
  error?: string;
  start?: number;
  end?: number;
  /** A `task` call's sub-agent session. */
  session?: string;
}

export interface OrchMessage {
  id: string;
  role: 'user' | 'assistant';
  agent: string | null;
  time: number | null;
  done: number | null;
  parts: OrchPart[];
  error?: string;
}

/** GET /api/me/orchestrator/sessions/{sid}. */
export interface OrchTranscript {
  id?: string;
  parentID?: string | null;
  title?: string;
  agent?: string | null;
  state?: AgentState;
  messages: OrchMessage[];
  truncated: boolean;
  reason?: string;
  error?: string;
}

/** One event of GET /api/me/orchestrator/events (backend/orchestrator/live.py shape). */
export interface OrchEvent {
  type: string;
  session?: string | null;
  message?: string;
  id?: string;
  part?: OrchPart | string | null;
  delta?: string;
  /** Where a delta goes in its part's text (newer servers): what is held already is not added twice. */
  o?: number;
  /** On `hello`: "s2" when the events come through the account's S2 stream instead (asked with ?via=s2). */
  via?: string;
  role?: 'user' | 'assistant';
  agent?: string | null;
  time?: number | null;
  done?: number | null;
  error?: string;
  kind?: string | null;
  status?: string;
  why?: string;
  parentID?: string | null;
  title?: string;
}

export interface McpTool {
  name: string;
  description: string;
  agents: string[];
  params: { name: string; type: string; enum: string[] | null; description: string; required: boolean }[];
}

/** GET /api/mcp/tools: the MCP server's version and every tool, grouped. */
export interface McpCatalog {
  version: string;
  count: number;
  agents: { id: string; server: string; name: string }[];
  groups: { name: string; tools: McpTool[] }[];
}

// ---- Analytics (the routes the web app's Chat cards and Settings read) ----

/** GET /api/llm/summary?days=14 (backend/llm_api.py): every provider together. */
export interface LlmSummary {
  days: number;
  month: { calls: number; input: number; output: number; tokens: number; cost_usd: number | null; unpriced_calls: number; providers: number };
  today: { calls: number; tokens: number; cost_usd: number | null; answers: number };
  answers: { n: number; tps_median: number | null; ttft_ms_median: number | null };
  /** Each day; `by`: its tokens by provider id. */
  by_day: { day: string; calls: number; tokens: number; cost_usd: number | null; by?: Record<string, number> }[];
  providers?: { id: string; name: string }[];
}

export interface TimeSeries {
  t0: number;
  step: number;
  n: number;
  series: { name: string; values: (number | null)[] }[];
}

export interface UsageRow {
  name: string;
  calls: number;
  input: number;
  output: number;
  cost_usd: number | null;
}

/** GET /api/llm/usage?provider=all&days=30: calls, tokens and money over time, by job, model and provider. */
export interface LlmUsage {
  days: number;
  step: number;
  totals: { calls: number; input: number; output: number; cost_usd: number | null; unpriced_calls: number };
  by_provider: UsageRow[];
  by_model: UsageRow[];
  by_kind: UsageRow[];
  calls: TimeSeries;
  tokens: TimeSeries;
  cost: TimeSeries;
}

/** GET /api/cc/tools-usage?span=week: the Chat's tools, by day. */
export interface ToolsUsage {
  tools: Record<string, { uses: number; done: number; week: number; week_done?: number }>;
  mine: number;
  days: { day: string; by: Record<string, number> }[];
  span?: string;
}

/** GET /api/me/orchestrator/incidents: what the supervisor kept (crash, out of memory, key refused, ...). */
export interface Incident {
  id: string;
  at: string | null;
  kind: string;
  code: number | null;
  signal: string | null;
  oom: boolean;
  detail: string | null;
}

export interface PoolJob {
  job: string;
  kind: string;
  label: string | null;
  state: string;
  queued_at: string | null;
  started_at: string | null;
  finished_at?: string | null;
  waited_s: number | null;
  ran_s: number | null;
  place?: number | null;
  why?: string | null;
  who?: { name: string | null; email: string | null };
}

/** GET /api/pool: one's own jobs waiting or running, and how full the server is. */
export interface MyPool {
  jobs: PoolJob[];
  running: number;
  queued: number;
  limits: { total: number; queued_per_account: number; kinds: Record<string, { limit: number; running: number; queued: number }> };
}

/** GET /api/admin/pool (owner and admins): every job, the latest finished, the memory. */
export interface AdminPool extends MyPool {
  recent: PoolJob[];
  memory?: { total_mb?: number; available_mb?: number; reserved_mb?: number };
}

/** GET /api/admin/sandboxes (owner and admins): every sandbox, what it uses. */
export interface AdminSandboxes {
  sandboxes: {
    id: string;
    name: string | null;
    email: string | null;
    env_name: string | null;
    state: string;
    usage: { cpu_pct: number; mem_mb: number; disk_mb: number };
    last_active: string | null;
  }[];
  running: number;
  max_running: number;
}

// ---- live streams through S2 (backend/s2live.py, docker/s2gate) ----------------

/** A read token for the account's own streams (POST /api/s2/token). Never logged, never in an address. */
export interface S2Token {
  token: string;
  /** Seconds since 1970. */
  expires_at: number;
  basin: string;
  /** The token's own stream (`acct/<account>/activity`). */
  stream: string;
  /** `acct/<account>/`: every stream of the account's begins with it. */
  prefix: string;
  /** Where the gate is on the server ("/s2"). */
  path: string;
}

/** One event of the account's bus (backend/bus.py): its kind, what it is about, when (ms). */
export interface BusEvent<P = Record<string, unknown>> {
  k: string;
  p?: P;
  t?: number;
}

export type ActivitySource = string;

/** What goes on now (GET /api/me/activity/now, and the `activity` stream): the web top bar's Activity. */
export interface ActivityNow {
  at: number;
  live: { tps: number; by: Record<ActivitySource, number>; window_s: number };
  jobs: { running: number; queued: number; agents: number; total: number; kinds: Record<string, number> };
  machine: {
    cpu_pct: number;
    mem_mb: number;
    sampled: boolean;
    parts: { kind: 'orchestrator' | 'sandbox' | 'jobs'; name: string; cpu_pct: number | null; mem_mb: number }[];
  };
}

// ---- Claude sessions (backend/wbclaude.py: /api/wbc/*) -------------------------

/** The wb-claude on the person's computer that holds a session: connected, and what Claude does there. */
export interface WbcBridge {
  id: string;
  connected: boolean;
  state: 'starting' | 'idle' | 'working' | 'waiting' | 'ended';
  detail: string;
  /** Remote messages are taken on that computer (`wb-claude --no-remote` refuses them). */
  remote: boolean;
  host: string;
  platform: string;
  version: string;
  cwd: string;
  queue: number;
  seen: number | null;
  started: number | null;
  /** It takes pictures (wb-claude 0.2.0 on); a newer wb-claude is out. */
  images?: boolean;
  outdated?: boolean;
}

/** One of one's own Claude Code sessions from the Claude pool (GET /api/wbc/sessions). Times in seconds. */
export interface WbcSession {
  session_id: string;
  name: string;
  title: string;
  status: 'active' | 'idle' | 'ended';
  computer: string;
  first_ts: number | null;
  last_ts: number | null;
  prompts: number | null;
  requests: number | null;
  known: boolean;
  mine: boolean;
  owner: { id: string | null; name: string };
  bridge: WbcBridge | null;
  /** Whether this account may write to it now; `why` not when it may not. */
  may_send: boolean;
  why: string;
}

/** A line written to a session from Workbench, and what became of it. */
export interface WbcMessage {
  id: string;
  text: string;
  by: { id?: string; name?: string };
  status: 'queued' | 'waiting' | 'delivered' | 'refused' | 'failed' | 'expired';
  detail: string;
  error: string;
  at: number | null;
  updated: number | null;
  delivered_at: number | null;
  images?: { n: number; type: string; bytes: number }[];
  images_gone?: boolean;
}

/** What pictures a message may carry: how many, how large, which types. */
export interface WbcImageRules {
  max: number;
  bytes: number;
  types: string[];
}

/** GET /api/wbc/sessions/{sid}: the session with its remote messages. */
export interface WbcDetail extends WbcSession {
  messages: WbcMessage[];
  mark: string;
  images?: WbcImageRules;
}

/** A picture of one of the gateway's requests: pasted or mentioned with a prompt, or read by a tool. */
export interface WbcPic {
  req: string;
  n: number;
  type: string;
}

/** A prompt or a final answer, as the pool recorded it. `at` in seconds. */
export interface WbcTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  remote?: boolean;
  model?: string;
  cut?: boolean;
  images?: WbcPic[];
}

/** GET /api/wbc/sessions/{sid}/turns: a page, newest last; `before` asks for the page above. */
export interface WbcTurnsPage {
  turns: WbcTurn[];
  more: boolean;
  before: number | null;
}
