/**
 * The Office screen: the web's page hosted, the ticket read once, the bridge's four messages, the freeze in the
 * background - and the stand-in while the server has no page (#a02107), so the app's side is the real one.
 */
import * as React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, type WorkbenchClient } from '../../api/client';
import type { OfficeEmbed } from '../../api/types';
import type { PageMessage } from '../../lib/officeEmbed';
import { officeStrings } from '../../lib/officeStrings';
import { OfficeScreen } from '../OfficeScreen';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const STRINGS = officeStrings('en');
const STANDIN: OfficeEmbed = { ready: false, url: null, token: null, expires_in: 0 };
const PAGE: OfficeEmbed = { ready: true, url: '/office/embed', token: 'ticket-abc', expires_in: 60 };

function client(answer: OfficeEmbed | Error = STANDIN, base = 'https://office.example') {
  const officeEmbedToken = jest.fn(async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  });
  return { base, officeEmbedToken } as unknown as WorkbenchClient & { officeEmbedToken: jest.Mock };
}

async function show(c: WorkbenchClient, onOpen = jest.fn()) {
  await render(<OfficeScreen client={c} t={STRINGS} lang="en" onOpen={onOpen} />);
  await act(async () => undefined);
  return onOpen;
}

/** The host as RNTL sees it: the source it loads, the ticket's header and whether the page is frozen. */
function host() {
  return screen.getByTestId('office-embed');
}

/** The page says something to the app (its own channel: a string in `postMessage`). */
async function speaks(message: PageMessage) {
  await act(async () => {
    host().props.onMessage({ nativeEvent: { data: JSON.stringify(message) } });
  });
}

/** What the app told the page: the injected calls, read back as the messages they carried. */
function told(): Record<string, unknown>[] {
  const all = (globalThis as { __webviewInjected?: string[] }).__webviewInjected ?? [];
  const out: Record<string, unknown>[] = [];
  for (const js of all) {
    const m = js.match(/__workbenchOffice\(([\s\S]*)\);true;$/);
    if (!m) continue;
    try {
      const inner = JSON.parse(m[1]);
      out.push(typeof inner === 'string' ? JSON.parse(inner) : inner);
    } catch {
      // not a message of ours
    }
  }
  return out;
}

/** Every `change` listener the screen registers, so a test can move the app to the background. */
function watchAppState(): ((state: string) => void)[] {
  const heard: ((state: string) => void)[] = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(((event: string, cb: (state: string) => void) => {
      if (event === 'change') heard.push(cb);
      return { remove: jest.fn() } as never;
    }) as never);
  return heard;
}

beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  (globalThis as { __webviewInjected?: string[] }).__webviewInjected = [];
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the office screen', () => {
  it('asks the server for a ticket once, and hosts the stand-in while there is no page', async () => {
    const c = client(STANDIN);
    await show(c);
    expect(c.officeEmbedToken).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('office-screen')).toBeTruthy();
    expect(screen.getByText('Office')).toBeTruthy();
    expect(host().props.source.html).toMatch(/__workbenchOffice/);
    expect(host().props.source.uri).toBeUndefined();
    expect(screen.getByTestId('office-clock')).toBeTruthy();
  });

  it('hands the page the app’s theme, language, insets and server', async () => {
    await show(client(PAGE));
    const hello = told().find((m) => m.type === 'hello');
    expect(hello).toMatchObject({ lang: 'en', server: 'https://office.example' });
    expect(['dark', 'light']).toContain(String(hello?.theme));
    expect(hello?.insets).toEqual(expect.objectContaining({ top: expect.any(Number), bottom: expect.any(Number) }));
  });

  it('opens the real page with the ticket in a header, never in the address', async () => {
    await show(client(PAGE));
    const source = host().props.source;
    expect(source.uri).toBe('https://office.example/office/embed');
    expect(source.headers).toEqual({ 'x-office-embed': 'ticket-abc' });
    expect(source.uri).not.toContain('ticket-abc');
    expect(source.html).toBeUndefined();
  });

  it('says what the page says: ready, the floor and its agents, a tap on a character', async () => {
    const onOpen = await show(client(STANDIN));
    await speaks({ type: 'ready' });
    expect(screen.getByText('Read only')).toBeTruthy();
    await speaks({ type: 'state', floor: 'Ground floor', agents: 4 });
    expect(screen.getByText('Ground floor · 4 agents')).toBeTruthy();
    await speaks({ type: 'open', agent: 'wbo:ses_demo1' });
    expect(onOpen).toHaveBeenCalledWith('wbo:ses_demo1');
  });

  it('shows the page’s own reason when it could not draw, and reads a new ticket on Try again', async () => {
    const c = client(STANDIN);
    await show(c);
    await speaks({ type: 'error', message: 'the layout was empty' });
    expect(screen.getByTestId('office-embed-error')).toBeTruthy();
    expect(screen.getByText(/the layout was empty/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('office-embed-retry'));
    expect(c.officeEmbedToken).toHaveBeenCalledTimes(2);
  });

  it('says so calmly when there is no ticket at all, and tries again on the button', async () => {
    const c = client(new ApiError(503, 'The server had a problem (HTTP 503).'));
    await show(c);
    expect(screen.getByTestId('office-error')).toBeTruthy();
    expect(screen.getByText('The server had a problem (HTTP 503).')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('office-error-retry'));
    expect(c.officeEmbedToken).toHaveBeenCalledTimes(2);
  });

  it('freezes the page while the app is behind another one, and lets it go when it is back', async () => {
    const handlers = watchAppState();
    await show(client(STANDIN));
    expect(told().map((m) => m.type)).toContain('hello');
    expect(told().map((m) => m.type)).not.toContain('pause');
    await act(async () => handlers.forEach((say) => say('background')));
    expect(told().map((m) => m.type)).toContain('pause');      // stop drawing, stop asking
    await act(async () => handlers.forEach((say) => say('active')));
    expect(told().map((m) => m.type)).toContain('resume');
  });

  it('says how to pin an agent when the page has nobody on the floor', async () => {
    await show(client(STANDIN));
    await speaks({ type: 'state', floor: 'Ground floor', agents: 0 });
    expect(screen.getByText('Pin agents in the Chat’s Agents list to see them here.')).toBeTruthy();
  });
});
