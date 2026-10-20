/** The Orchestrator's routes as the client asks them (backend/orchestrator/api.py). */
import { CSRF_HEADER, WorkbenchClient } from '../client';
import type { OrchEvent } from '../types';
import { FakeXhr, fakeFetch, jsonResponse } from './fakes';

const BASE = 'https://wb.example';

describe('the Orchestrator', () => {
  it('reads its state, tree, a session and the MCP tools', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(200, {}));
    const client = new WorkbenchClient(BASE, { fetch });
    await client.orchestrator();
    await client.orchestratorTree();
    await client.orchestratorSession('ses_a/b');
    await client.mcpTools();
    expect(calls.map((c) => c.url)).toEqual([
      `${BASE}/api/me/orchestrator`,
      `${BASE}/api/me/orchestrator/tree`,
      `${BASE}/api/me/orchestrator/sessions/ses_a%2Fb`,
      `${BASE}/api/mcp/tools`,
    ]);
  });

  it('starts and stops it, and gives it a model, as changes', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(200, {}));
    const client = new WorkbenchClient(BASE, { fetch });
    await client.orchestratorStart();
    await client.orchestratorStop();
    await client.setAgentModel('openrouter', 'qwen/qwen3-coder');
    expect(calls.map((c) => `${c.init.method} ${c.url.slice(BASE.length)}`)).toEqual([
      'POST /api/me/orchestrator/start',
      'POST /api/me/orchestrator/stop',
      'PUT /api/me/llm/agent',
    ]);
    for (const c of calls) expect((c.init.headers as Record<string, string>)[CSRF_HEADER]).toBe('1');
    expect(JSON.parse(String(calls[2].init.body))).toEqual({ provider_id: 'openrouter', model: 'qwen/qwen3-coder' });
  });

  it('follows its live stream', async () => {
    const xhr = new FakeXhr();
    const client = new WorkbenchClient(BASE, { createXhr: () => xhr });
    const got: OrchEvent[] = [];
    const done = client.orchestratorEvents({ onEvent: (e) => got.push(e) });
    expect(xhr.method).toBe('GET');
    expect(xhr.url).toBe(`${BASE}/api/me/orchestrator/events`);
    xhr.respond(200, 'text/event-stream');
    xhr.chunk('data: {"type":"hello"}\n\n: ping\n\n');
    xhr.chunk('data: {"type":"delta","session":"s","message":"m","part":"p","delta":"Hi"}\n\n');
    xhr.end();
    await done;
    expect(got.map((e) => e.type)).toEqual(['hello', 'delta']);
    expect(got[1].delta).toBe('Hi');
  });
});
