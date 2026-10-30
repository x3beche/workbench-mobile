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
  /** How long it thought, when the server kept that with the answer. */
  thinking_ms?: number | null;
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
  /** The cached kinds, and all four together - input, output, cache read and write. */
  cache_read?: number;
  cache_write?: number;
  tokens?: number;
  cost_usd: number | null;
}

/** GET /api/llm/usage?provider=all&days=30: calls, tokens and money over time, by job, model and provider. */
export interface LlmUsage {
  days: number;
  step: number;
  totals: { calls: number; input: number; output: number; cache_read?: number; cache_write?: number;
            /** All four kinds together, as the Analytics Models card counts them. */
            tokens?: number; cost_usd: number | null; unpriced_calls: number };
  by_provider: UsageRow[];
  by_model: UsageRow[];
  by_kind: UsageRow[];
  calls: TimeSeries;
  tokens: TimeSeries;
  cost: TimeSeries;
}

/** GET /api/cc/tools-usage?span=month: the Chat's tools, by day. */
export interface ToolsUsage {
  tools: Record<string, { uses: number; done: number; week: number; week_done?: number; month?: number; month_done?: number }>;
  mine: number;
  days: { day: string; by: Record<string, number> }[];
  span?: string;
  /** The person's own tool calls outside the Chat, in the same buckets: their
   *  Claude Code (the Claude pool) and OpenCode; null where there is none to tell. */
  external?: { claude: ExtToolUses | null; opencode: ExtToolUses | null };
}

/** GET /api/cc/tools: every chat tool, and whether it is on for whoever asks (the Tools page's list). */
export interface CcToolInfo {
  name: string;
  label: string;
  level?: string;
  description?: string;
  default: boolean;
  /** On for this person: their own choice, else the tool's default. */
  on: boolean;
  uses?: number;
}

/** One outside source's tool calls: each tool's total and week, and each bucket by tool. */
export interface ExtToolUses {
  tools: Record<string, { uses: number; week: number; month?: number }>;
  days: Record<string, Record<string, number>>;
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

/** GET /api/me/activity?range=24h: the tokens over a range by source, its totals, and what goes on now. */
export interface ActivityData extends ActivityNow {
  range: string;
  t0: number;
  step: number;
  n: number;
  sources?: ActivitySource[];
  series: Record<ActivitySource, number[] | undefined>;
  total: {
    tokens: number;
    input: number;
    output: number;
    calls: number;
    by: Record<ActivitySource, number | undefined>;
    cache_read?: number;
    cache_write?: number;
  };
  /** The person's own Claude pool use over the range; absent without a key. */
  claude?: {
    prompts: number;
    calls: number;
    tokens: number;
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
  } | null;
  since?: number;
  tz?: string;
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
  /** The newest page only: what Claude Code suggests typing next, with nothing typed after it. */
  suggestion?: string | null;
}

// ---- OpenCode sessions (backend/wbopencode.py: /api/wbo/*) ---------------------

/** The wb-opencode run on the person's computer that holds a session. Times in seconds. */
export interface WboModel {
  providerID: string;
  providerName: string;
  modelID: string;
  name: string;
  context: number | null;
  output: number | null;
  vision: boolean;
  variants: string[];
}

export interface WboSelectedModel {
  providerID: string;
  providerName?: string;
  modelID: string;
  name?: string;
  variant?: string | null;
}

export interface WboBridge {
  id: string;
  connected: boolean;
  /** Remote lines are taken on that computer (`wb-opencode --no-remote` refuses them). */
  remote: boolean;
  host: string;
  platform: string;
  version: string;
  opencode: string;
  cwd: string;
  model: string;
  seen: number | null;
  started: number | null;
  /** A newer wb-opencode is out. */
  outdated?: boolean;
  /** It takes the newer client from the server itself (0.2.2 on): only an older one needs telling how. */
  self_updates?: boolean;
  /** The server's own wb-opencode version (the one to update to). */
  latest?: string;
  /** It hands answers to OpenCode (0.2.0 and newer): what OpenCode asks can be answered from here. */
  answers?: boolean;
  /** Whether the bridge supports choosing models from Chat (0.2.8 and newer). */
  models_supported?: boolean;
  /** The models available to OpenCode on that computer. */
  models?: WboModel[] | null;
}

/** One of one's own OpenCode sessions (GET /api/wbo/sessions). `updated` in milliseconds. */
export interface WboSession {
  session_id: string;
  title: string;
  name: string;
  status: 'idle' | 'busy' | 'retry' | 'waiting' | 'ended';
  /** OpenCode waits for an answer (a question or a permission). */
  asking?: boolean;
  /** What its last step was sent of the model's window (the head's "Context" line, and the composer's own line
   *  under the model chip). Limit 0 when the run cannot tell. */
  context?: { used: number; limit: number; model: string; pct?: number | null } | null;
  directory: string;
  computer: string;
  updated: number | null;
  seen: number | null;
  created: number | null;
  parent: string | null;
  tokens: { input: number; output: number };
  mine: boolean;
  owner: { id: string | null; name: string };
  bridge: WboBridge | null;
  selected_model?: WboSelectedModel | null;
  model?: WboSelectedModel | string | null;
  models?: WboModel[];
  may_send: boolean;
  why: string;
}

/** A piece of an OpenCode message: its words, its reasoning, a tool call, a file. Times in milliseconds. */
export interface WboPart {
  id: string;
  type: 'text' | 'reasoning' | 'tool' | 'file';
  text?: string;
  tool?: string;
  status?: string;
  title?: string;
  input?: string;
  output?: string;
  error?: string;
  start?: number;
  end?: number;
}

/** One OpenCode message (a person's line, or one step of its answer). Times in milliseconds. */
export interface WboMsg {
  id: string;
  role: 'user' | 'assistant' | 'system';
  agent?: string | null;
  model?: string | null;
  /** The model's provider as OpenCode names it ("workbench", "opencode"...). */
  provider?: string | null;
  type?: string;
  previous?: WboSelectedModel | null;
  by?: string;
  time: number | null;
  /** When its first token (thinking or text) came. */
  first?: number | null;
  done: number | null;
  /** What it spent: input, output (thinking included), cache read, cache write. */
  tok?: [number, number, number, number] | null;
  parts: WboPart[];
  error?: string;
}

/** A line written to a session from Workbench, and what became of it. Times in seconds. */
export interface WboSend {
  id: string;
  text: string;
  by: { id?: string; name?: string };
  status: 'queued' | 'delivered' | 'refused' | 'failed' | 'expired';
  error: string;
  at: number | null;
  updated: number | null;
  delivered_at: number | null;
  /** OpenCode's id of the message it became. */
  inbox: string | null;
  images?: { n: number; type: string; bytes: number }[];
  images_gone?: boolean;
}

/** One question of a form OpenCode's question tool asks. */
export interface WboField {
  key: string;
  type: 'string' | 'multiselect' | 'boolean' | 'number' | 'integer';
  title: string;
  description: string;
  options: { value: string; label: string; description: string }[];
  custom: boolean;
  required: boolean;
  min?: number;
  max?: number;
}

/** What OpenCode asks: its question tool's form, or a permission prompt. Times in seconds. */
export interface WboAsk {
  id: string;
  kind: 'form' | 'permission';
  form_kind?: string;
  title?: string;
  fields?: WboField[];
  part?: string | null;
  message?: string | null;
  action?: string;
  resources?: string[];
  save?: string[];
  message_text?: string;
  /** More was asked than a card can hold (a long command, or more patterns than are kept): answered on the
   *  computer only, because a rule remembered from a part of a request is a rule nobody agreed to. */
  cut?: boolean;
  status: 'pending' | 'answering' | 'answered' | 'replied' | 'cancelled' | 'gone';
  answer?: Record<string, unknown> | null;
  decision?: 'once' | 'always' | 'reject' | null;
  /** Where it was answered. */
  via?: 'chat' | 'computer';
  error?: string | null;
  /** What was chosen here while it is on its way. */
  chosen?: { answer?: Record<string, unknown>; decision?: string; message?: string };
  at: number | null;
  settled_at: number | null;
  /** Drawn from the question tool's own call (no ask of it here): shown, not answered here. */
  local?: boolean;
  /** Its output, when what was chosen cannot be read from it. */
  raw?: string;
}

/** GET /api/wbo/sessions/{sid}: the session with its last messages, the lines sent and what it asks. */
export interface WboDetail extends WboSession {
  messages: WboMsg[];
  truncated: boolean;
  sends: WboSend[];
  asks?: WboAsk[];
  images?: WbcImageRules;
}

/** An answer to what OpenCode asks: a form's {field: value}, or a permission's decision. */
export type WboAnswer =
  | { answer: Record<string, unknown> }
  | { decision: 'once' | 'always' | 'reject'; message?: string };

// ---- the Chat list's own choices (backend/session_prefs.py: /api/me/side) ------

export type SideGroup = 'claude' | 'opencode';
/** What folds in the drawer: the session groups, and the rooms (open until folded). */
export type FoldGroup = SideGroup | 'rooms';

/** How much of an answer's work a conversation shows (lib/chatDetail.ts, Settings > Chat). */
export type ChatDetail = 'compact' | 'normal' | 'detailed';

/** Pinned sessions per group (newest pin first) and each group folded or not (null: never chosen). */
export interface SidePrefs {
  pins: Record<SideGroup, string[]>;
  folds: Record<FoldGroup, boolean | null>;
  /** How much of an answer's work the Chat shows: the same on every device, as the server keeps it. */
  chat: { detail: ChatDetail };
  /** The sections of a session's column (the OpenCode screen's sheet; the web's right-hand column), folded or
   *  open as the person left them: <section id> -> open. A section never touched is open. */
  panel: Record<string, boolean>;
}

// ---- a session's column (backend/wb_panel.py: GET /api/wbo/sessions/{sid}/panel) ----

export interface PanelTodo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface PanelFile {
  path: string;
  /** How many calls touched it. */
  count: number;
  /** When it was last touched (ms), or null. */
  at: number | null;
  status: string;
  /** Its last call failed. */
  error: boolean;
  /** The message that call is in: a tap scrolls the conversation to it. */
  message: string;
  /** The run's own line counts, when it reported a diff (wb-opencode 0.3.0 on). */
  additions?: number;
  deletions?: number;
}

export interface PanelTool {
  name: string;
  /** The MCP server it belongs to, '' for OpenCode's own tools. */
  server: string;
  count: number;
  errors: number;
  /** The newest call of it: where a tap scrolls to. */
  message: string;
  tool: string;
}

/** One session's column: what it is on, what it spent, its computer, its todo list, the files it changed,
 *  what it waits for and the tools it used. Empty parts come as null and are not drawn. */
export interface WboPanel {
  session: {
    id: string;
    title: string;
    status: 'idle' | 'busy' | 'retry' | 'waiting' | 'error';
    asking: boolean;
    since: number | null;
    model: WboSelectedModel | null;
    context: { used: number; limit: number; model: string; pct: number | null } | null;
    computer: (WboBridge & { name?: string }) | null;
  };
  todos: { items: PanelTodo[]; done: number; total: number; at: number | null } | null;
  files: { items: PanelFile[]; more: number } | null;
  tools: { items: PanelTool[]; more: number } | null;
  /** What it spent: the session's own total over its whole life (`source: 'session'`), or - for a session
   *  stored before that was kept - the messages that are here, which `messages` counts. The caches are only
   *  there when they are known. */
  tokens: {
    input: number;
    output: number;
    cost: number | null;
    cache_read?: number;
    cache_write?: number;
    source: 'session' | 'messages';
    messages: number;
  };
  /** How many messages the column was worked out from, and whether that is all of them. */
  messages: number;
  complete: boolean;
  pending: WboAsk[];
  may_answer: boolean;
  why: string;
  at: number;
}

// ---- Settings > Claude pool (backend/ccpool.py: GET /api/ccpool/overview) ----

/** A subscription window: how much is used and when it starts again (seconds). */
export interface PoolWindow {
  pct: number;
  resets_at: number | null;
  /** The last one known (the usage call refused for now). */
  stale?: boolean;
}

/** Requests, tokens and API value over some span (an account's week, a session). */
export interface PoolFigures {
  requests: number;
  in_tokens: number;
  out_tokens: number;
  cache_read: number;
  cache_write: number;
  total_tokens: number;
  cost_usd: number;
  cost_estimated_usd?: number;
  last_ts?: number;
}

export interface PoolWeek extends PoolFigures {
  /** The person's part of the 7-day window, in points; null while it is not known. */
  plan_pct: number | null;
  plan_pct_approx?: boolean;
  plan5_pct?: number | null;
  plan5_pct_approx?: boolean;
  plan_manual_pct?: number | null;
}

export interface PoolAccount {
  id: string;
  name: string;
  email: string;
  mine: boolean;
  usage: PoolFigures;
  week: PoolWeek;
  manual?: { tokens?: number; requests?: number; cost_usd?: number } | null;
}

export interface PoolSession {
  session_id: string;
  key_name: string | null;
  title?: string;
  label?: string;
  status?: 'active' | 'idle' | 'ended';
  first_ts: number;
  last_ts: number;
  requests: number;
  prompts?: number | null;
  in_tokens: number | null;
  out_tokens: number | null;
  cache_read: number | null;
  cache_write: number | null;
  total_tokens?: number;
  cost_usd: number;
  mine?: boolean;
}

export interface PoolOverview {
  me: {
    id: string;
    name: string;
    role: string;
    privileged: boolean;
    keys: number;
    usage: PoolFigures;
    manual?: { cost_usd?: number } | null;
  };
  plan: {
    five_hour?: PoolWindow | null;
    seven_day?: PoolWindow | null;
    extra?: (PoolWindow & { id: string; label: string })[];
    week_pct: number | null;
    week_api_usd: number;
    week_from?: number | null;
    week_to?: number | null;
    outside?: { seven_day?: number; five_hour?: number };
    unassigned_plan?: { seven_day?: number | null; five_hour?: number | null };
  };
  accounts: PoolAccount[];
  my_sessions: PoolSession[];
  my_hidden?: { count: number; cost_usd: number };
  gateway: { configured: boolean };
}

/** GET /api/admin/server-health: the server itself, for its owner and admins (backend/hosthealth.py). */
export interface HostHealth {
  now: {
    at: number;
    sample: {
      psi_mem_full60: number | null; psi_mem_some60: number | null; psi_mem_full10: number | null;
      psi_io_full60: number | null; psi_cpu_some60: number | null; avail_gb: number | null;
      swap_used_pct: number | null; oom_kill: number | null; temp_max: number | null;
      temp_cpu: number | null; temp_gpu: number | null; disk_pct: number | null;
      load1: number | null; uptime_s: number | null;
    };
    uptime_s: number | null; boot_id: string | null; load: number[];
    disks: Record<string, { total_gb: number; free_gb: number; pct: number }>;
    unreadable: string[];
  };
  thresholds: Record<string, number>;
  verdict: { tone: 'ok' | 'warn' | 'danger'; quiet: boolean; en: string; tr: string };
  series: { range: string; t0: number; step: number; n: number; psi: (number | null)[];
            avail: (number | null)[]; temp: (number | null)[] };
  events: {
    id: string; kind: string; title: string; at: string; detail?: string | null;
    source: 'host' | 'derived';
    impact: { counts: { orchestrator?: number; sandboxes?: number; jobs?: number }; total?: number };
  }[];
  sources: { id: string; label: string; ok: boolean; why: string | null }[];
  cost: { samples: number; cpu_ms: number | null; avg_ms?: number | null };
  containers: { name: string; state: string; status: string; unhealthy: boolean; restarting: boolean }[];
}
