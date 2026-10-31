/**
 * The made-up server's agents (backend/agents.py's links, agents_mcp.py's team): Ada's Claude Code session
 * "Sensor board rail sag" manages four of her OpenCode sessions. One list, one block an agent - the rail one
 * waiting on her (its window nearly full, and the ctx `pct` deliberately stale so a screenshot shows the app
 * works it out from used/limit), the OTA one working, the bring-up one away, the lid one idle with only a
 * closed task to its name - with tasks under them, their agents' last words, and the closed ones at the foot.
 */
const secs = () => Date.now() / 1000;

const MANAGER = 'wbc:a1b2c3d4-rail';

export const LINKS = [
  { worker: 'wbo:ses_rail0000a1', manager: MANAGER, at: secs() - 7200 },
  { worker: 'wbo:ses_ota00000b2', manager: MANAGER, at: secs() - 7000 },
  { worker: 'wbo:ses_off00000e5', manager: MANAGER, at: secs() - 6800 },
  { worker: 'wbo:ses_lid00000c3', manager: MANAGER, at: secs() - 3600 },
];

/** The team as GET /api/agents/team/{manager} sends it: the agents' states from agents_list, the tasks from
 *  tasks_list (the reopened reading, so reports and answers come with them). */
export function team() {
  return {
    manager: MANAGER,
    agents: [
      {
        agent: 'wbo:ses_rail0000a1',
        kind: 'OpenCode',
        name: 'Sensor board rail sag',
        computer: 'ada-laptop',
        directory: '~/projects/sensor-board',
        state: 'waiting for the person',
        last: secs() - 40,
        // used/limit is 95 %; the stale pct (3) is what the web falls for
        context: { used: 950_000, limit: 1_000_000, model: 'deepseek/deepseek-v4.1-flash', pct: 3 },
        level: 1,
        open_tasks: [{ task: 'a0f239', title: 'Route the 3.3 V rail and run DRC', status: 'waiting' }],
      },
      {
        agent: 'wbo:ses_ota00000b2',
        kind: 'OpenCode',
        name: 'OTA rollback watchdog',
        computer: 'workstation',
        directory: '~/fw/ota',
        state: 'working',
        last: secs() - 15,
        context: { used: 730_000, limit: 1_000_000, model: 'deepseek/deepseek-v4.1-flash', pct: 73 },
        level: 1,
        open_tasks: [
          { task: 'b1c2d3', title: 'Add the watchdog and flash the board', status: 'working' },
          { task: 'f6a7b8', title: 'Check the rollback partition map', status: 'answered' },
        ],
      },
      {
        agent: 'wbo:ses_off00000e5',
        kind: 'OpenCode',
        name: 'Sensor board bring-up',
        computer: 'x33-workstation',
        directory: '~/projects/redline-studio/frontend/src/app',
        state: 'offline',
        last: secs() - 900,
        context: null,
        level: 1,
        open_tasks: [{ task: 'c3d4e5', title: 'Bring up the 1V8 rail', status: 'interrupted' }],
      },
      {
        agent: 'wbo:ses_lid00000c3',
        kind: 'OpenCode',
        name: 'Enclosure lid review',
        computer: 'ada-laptop',
        directory: '~/projects/lid',
        state: 'idle',
        last: secs() - 6400,
        context: null,
        level: 1,
        open_tasks: [],
      },
    ],
    tasks: [
      {
        task: 'a0f239',
        agent: 'wbo:ses_rail0000a1',
        agent_name: 'Sensor board rail sag',
        title: 'Route the 3.3 V rail and run DRC',
        status: 'waiting',
        created: secs() - 780,
        updated: secs() - 40,
        reports: [
          {
            status: 'progress',
            summary: 'Five of the seven segments are routed; DRC next.',
            at: secs() - 240,
            by: 'wbo:ses_rail0000a1',
            by_name: 'Sensor board rail sag',
          },
        ],
      },
      {
        task: 'b1c2d3',
        agent: 'wbo:ses_ota00000b2',
        agent_name: 'OTA rollback watchdog',
        title: 'Add the watchdog and flash the board',
        status: 'working',
        created: secs() - 480,
        updated: secs() - 15,
        reports: [
          {
            status: 'progress',
            summary: 'ota_guard() added; flashing the board now.',
            at: secs() - 90,
            by: 'wbo:ses_ota00000b2',
            by_name: 'OTA rollback watchdog',
          },
        ],
      },
      {
        task: 'f6a7b8',
        agent: 'wbo:ses_ota00000b2',
        agent_name: 'OTA rollback watchdog',
        title: 'Check the rollback partition map',
        status: 'answered',
        created: secs() - 600,
        updated: secs() - 120,
        answer:
          'The map is right: the two app slots are 1.5 MB each and the rollback slot holds the factory image. ' +
          'A failed digest marks the slot unbootable in nvs and the bootloader falls back to the other one, ' +
          'so nothing needs the serial console.',
      },
      {
        task: 'c3d4e5',
        agent: 'wbo:ses_off00000e5',
        agent_name: 'Sensor board bring-up',
        title: 'Bring up the 1V8 rail',
        status: 'interrupted',
        created: secs() - 1200,
        updated: secs() - 600,
        reports: [
          {
            status: 'blocked',
            summary: 'The 1V8 rail never came up; the computer went away mid-turn.',
            at: secs() - 600,
            by: 'wbo:ses_off00000e5',
            by_name: 'Sensor board bring-up',
          },
        ],
      },
      {
        task: 'd4e5f6',
        agent: 'wbo:ses_lid00000c3',
        agent_name: 'Enclosure lid review',
        title: 'Make the lid snap-fit with 1.6 mm PETG',
        status: 'closed',
        outcome: 'done',
        answer: 'Four 0.4 mm hooks, 30 degree lead-in; the lid snaps and holds.',
        created: secs() - 9000,
        updated: secs() - 600,
      },
      {
        task: 'e5f6a7',
        agent: 'wbo:ses_rail0000a1',
        agent_name: 'Sensor board rail sag',
        title: 'Swap FB2 for a 1 A bead',
        status: 'closed',
        outcome: 'done',
        answer: 'FB2 is a BLM18PG221SN1 now; the rail holds 3.28 V at the burst.',
        created: secs() - 5400,
        updated: secs() - 300,
      },
    ],
  };
}

export function handleTeam(req, res, p) {
  if (req.method === 'GET' && p === '/api/agents/links') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ links: LINKS, max_depth: 3 }));
    return true;
  }
  const m = /^\/api\/agents\/team\/([^/]+)$/.exec(p);
  if (req.method === 'GET' && m) {
    const manager = decodeURIComponent(m[1]);
    const got = team();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ...got, manager }));
    return true;
  }
  return false;
}
