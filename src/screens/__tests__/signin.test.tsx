import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';

import * as prefs from '../../storage/prefs';
import { Harness, serve } from './harness';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const GOOD = 'https://wb.example';
const signedOut = { mode: 'on', user: null, role: null, needs_setup: false };
const ada = { id: 'u1', name: 'Ada', email: 'ada@wb.example' };

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('server screen', () => {
  it('opens on the server screen when no server was chosen', async () => {
    serve(() => 'offline');
    await render(<Harness />);
    expect(await screen.findByTestId('server-input')).toBeTruthy();
    expect(screen.getByText('Workbench')).toBeTruthy();
  });

  it('refuses an address it cannot use, without asking the network', async () => {
    const calls = serve(() => 'offline');
    await render(<Harness />);
    await fireEvent.changeText(await screen.findByTestId('server-input'), 'ftp://wb.example');
    await fireEvent.press(screen.getByTestId('server-connect'));
    expect(await screen.findByText('Only http and https addresses are supported.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('says so when the server cannot be reached', async () => {
    serve(() => 'offline');
    await render(<Harness />);
    await fireEvent.changeText(await screen.findByTestId('server-input'), 'down.example');
    await fireEvent.press(screen.getByTestId('server-connect'));
    expect(await screen.findByText('down.example: The server could not be reached.')).toBeTruthy();
    expect(await prefs.recentServers()).toEqual([]);
  });

  it('says so when the site is not Workbench', async () => {
    serve(() => ({ status: 200, body: '<!doctype html><p>a blog</p>' }));
    await render(<Harness />);
    await fireEvent.changeText(await screen.findByTestId('server-input'), 'blog.example');
    await fireEvent.press(screen.getByTestId('server-connect'));
    expect(await screen.findByText('blog.example: It did not answer as a Workbench server.')).toBeTruthy();
  });

  it('goes on to sign-in for a Workbench server, and remembers it', async () => {
    const calls = serve((url) =>
      url.endsWith('/api/health') ? { status: 200, body: { ok: true } } : { status: 200, body: signedOut },
    );
    await render(<Harness />);
    await fireEvent.changeText(await screen.findByTestId('server-input'), 'wb.example/chat');
    await fireEvent.press(screen.getByTestId('server-connect'));
    expect(await screen.findByTestId('login-email')).toBeTruthy();
    expect(screen.getByTestId('login-server')).toHaveTextContent('wb.example');
    expect(calls.map((c) => c.url)).toEqual([`${GOOD}/api/health`, `${GOOD}/api/auth/state`]);
    expect(await prefs.recentServers()).toEqual([GOOD]);
    expect(await prefs.currentServer()).toBe(GOOD);
  });

  it('goes straight in for a server without sign-in (local mode)', async () => {
    serve((url) =>
      url.endsWith('/api/health')
        ? { status: 200, body: { ok: true } }
        : { status: 200, body: { mode: 'off', user: null, role: 'owner' } },
    );
    await render(<Harness />);
    await fireEvent.changeText(await screen.findByTestId('server-input'), 'localhost:8000');
    await fireEvent.press(screen.getByTestId('server-connect'));
    expect(await screen.findByTestId('signed-in')).toHaveTextContent('local @ http://localhost:8000');
  });
});

describe('sign-in', () => {
  beforeEach(async () => {
    await prefs.rememberServer(GOOD);
    await prefs.setCurrentServer(GOOD);
  });

  it('opens on sign-in for the last server, with the last email filled in', async () => {
    await prefs.rememberEmail(GOOD, 'ada@wb.example');
    serve(() => ({ status: 200, body: signedOut }));
    await render(<Harness />);
    expect(await screen.findByDisplayValue('ada@wb.example')).toBeTruthy();
  });

  it('opens straight into the app while the session is still good', async () => {
    serve(() => ({ status: 200, body: { mode: 'on', user: ada, role: 'user' } }));
    await render(<Harness />);
    expect(await screen.findByTestId('signed-in')).toHaveTextContent(`Ada @ ${GOOD}`);
  });

  it('asks for both fields before sending anything', async () => {
    const calls = serve(() => ({ status: 200, body: signedOut }));
    await render(<Harness />);
    await fireEvent.press(await screen.findByTestId('login-submit'));
    expect(await screen.findByText('Enter your email address and password.')).toBeTruthy();
    expect(calls.filter((c) => c.url.endsWith('/api/auth/login'))).toHaveLength(0);
  });

  it("shows the server's words for a wrong password", async () => {
    serve((url) =>
      url.endsWith('/api/auth/login')
        ? { status: 401, body: { detail: 'that email and password do not match' } }
        : { status: 200, body: signedOut },
    );
    await render(<Harness />);
    await fireEvent.changeText(await screen.findByTestId('login-email'), 'ada@wb.example');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'wrong-password');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('that email and password do not match')).toBeTruthy();
    expect(screen.queryByTestId('signed-in')).toBeNull();
  });

  it('signs in, with the CSRF header and the cookie jar, and remembers the email', async () => {
    let signed = false;
    const calls = serve((url) => {
      if (url.endsWith('/api/auth/login')) {
        signed = true;
        return { status: 200, body: { user: ada, remembered: false } };
      }
      return { status: 200, body: signed ? { mode: 'on', user: ada, role: 'user' } : signedOut };
    });
    await render(<Harness />);
    await fireEvent.changeText(await screen.findByTestId('login-email'), ' ada@wb.example ');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'correct horse');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByTestId('signed-in')).toHaveTextContent(`Ada @ ${GOOD}`);
    const login = calls.find((c) => c.url === `${GOOD}/api/auth/login`)!;
    expect(login.init.method).toBe('POST');
    expect(login.init.credentials).toBe('include');
    expect((login.init.headers as Record<string, string>)['x-redline-csrf']).toBe('1');
    expect(JSON.parse(login.init.body as string)).toEqual({
      email: 'ada@wb.example',
      password: 'correct horse',
      remember: false,
      app: true,
    });
    expect(await prefs.lastEmail(GOOD)).toBe('ada@wb.example');
  });

  it('signs in even when the state check after it fails', async () => {
    let signed = false;
    serve((url) => {
      if (url.endsWith('/api/auth/login')) {
        signed = true;
        return { status: 200, body: { user: ada } };
      }
      return signed ? 'offline' : { status: 200, body: signedOut };
    });
    await render(<Harness />);
    await fireEvent.changeText(await screen.findByTestId('login-email'), 'ada@wb.example');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'correct horse');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByTestId('signed-in')).toBeTruthy();
  });

  it('signs straight out again when the account must choose a new password first', async () => {
    let signed = false;
    const calls = serve((url) => {
      if (url.endsWith('/api/auth/login')) {
        signed = true;
        return { status: 200, body: { user: ada } };
      }
      if (url.endsWith('/api/auth/logout')) return { status: 200, body: { signed_out: true } };
      return {
        status: 200,
        body: signed ? { mode: 'on', user: ada, role: 'user', must_change_password: true } : signedOut,
      };
    });
    await render(<Harness />);
    await fireEvent.changeText(await screen.findByTestId('login-email'), 'ada@wb.example');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'set-by-admin');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText(/must choose a new password first/)).toBeTruthy();
    expect(screen.queryByTestId('signed-in')).toBeNull();
    const logout = calls.find((c) => c.url === `${GOOD}/api/auth/logout`);
    expect(logout?.init.method).toBe('POST');
  });

  it('goes back to the server screen with Change', async () => {
    serve(() => ({ status: 200, body: signedOut }));
    await render(<Harness />);
    await fireEvent.press(await screen.findByLabelText('Change server'));
    expect(await screen.findByTestId('server-input')).toHaveDisplayValue('wb.example');
  });
});

describe('wordmark', () => {
  it('draws the section mark to the left of the name', async () => {
    serve(() => 'offline');
    await render(<Harness />);
    const mark = await screen.findByTestId('wordmark');
    expect(mark.props.style).toMatchObject({ flexDirection: 'row' });
    expect(screen.getByText('Workbench')).toBeTruthy();
  });
});
