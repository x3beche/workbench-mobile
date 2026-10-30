/**
 * Settings, as the menu and the pages under it (1.9.9): the groups and their
 * rows, the value each row says is set now, a page of radios behind each
 * choice, and the one dangerous row - Sign out, red, asking first - at the
 * foot of the menu.
 *
 * The account is the app's own (state/session) and is faked here: what is
 * tested is the screen, not signing in.
 */
import { reloadAppAsync } from 'expo';
import * as React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import type { OrchStatus } from '../../api/types';
import { installedApp } from '../../update/installed';
import { orchStrings } from '../../lib/orchStrings';
import { settingsStrings } from '../../lib/settingsStrings';
import type { SettingsHandle } from '../SettingsScreen';
import { SettingsScreen } from '../SettingsScreen';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
// The theme page restarts the app to wear the theme it kept.
jest.mock('expo', () => ({ reloadAppAsync: jest.fn(async () => undefined) }));

const mockSignOut = jest.fn(async () => undefined);
const mockSwitchTo = jest.fn(async () => undefined);
const mockRemove = jest.fn(async () => undefined);
const mockAddAnother = jest.fn();
/** The accounts on the phone and the client the pool's row is read with: both per test. */
let mockAccounts: { id: string; server: string; user: { id: string; name: string; email: string } }[] = [];
let mockClient: unknown = null;
const mockAccount = {
  id: 'a1',
  server: 'https://wb.example.com',
  user: { id: 'u1', name: 'Ada Demir', email: 'ada@example.com' },
};
const mockOther = {
  id: 'a2',
  server: 'https://other.example',
  user: { id: 'u2', name: 'Bo', email: 'bo@other.example' },
};
jest.mock('../../state/session', () => ({
  useSession: () => ({
    user: mockAccount.user,
    client: mockClient,
    account: mockAccount,
    accounts: mockAccounts,
    signOut: mockSignOut,
    switchTo: mockSwitchTo,
    remove: mockRemove,
    addAnother: mockAddAnother,
    clientFor: () => mockClient,
  }),
}));

const t = settingsStrings('en');
const ot = orchStrings('en');

const orch: OrchStatus = {
  state: 'running',
  desired: 'running',
  halted: null,
  error: null,
  crash_loop: false,
  last_failure: null,
  next_try_at: null,
  started_at: null,
  provider_id: 'anthropic',
  model: 'claude-sonnet-4-5',
  session: 's1',
  choice: null,
  providers: [],
};

async function open(extra: Partial<React.ComponentProps<typeof SettingsScreen>> = {}) {
  const ref = React.createRef<SettingsHandle>();
  await render(
    <SettingsScreen
      ref={ref}
      t={t}
      ot={ot}
      ui="en"
      lang="auto"
      onLang={() => undefined}
      voiceMode="live"
      onVoiceMode={() => undefined}
      appLang="auto"
      onAppLang={() => undefined}
      detail="normal"
      onDetail={() => undefined}
      orch={orch}
      onAgent={() => undefined}
      {...extra}
    />,
  );
  return ref;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccounts = [mockAccount, mockOther];
  mockClient = null;
});

describe('Settings’ menu', () => {
  it('is five groups of rows, each row saying what it is set to now', async () => {
    await open();
    // The groups, small capitals over their rows (the style uppercases them).
    for (const [id, heading] of [
      ['account', 'Account'],
      ['ai', 'Artificial intelligence'],
      ['appearance', 'Appearance'],
      ['voice', 'Voice'],
      ['app', 'App'],
    ] as const) {
      expect(within(screen.getByTestId(`settings-group-${id}`)).getByText(heading)).toBeTruthy();
    }
    // One row per setting, its second line about it, and its value at the right.
    const rows = [
      ['accounts', 'Accounts', 'Ada Demir'],
      ['orchestrator', 'Orchestrator', 'Running'],
      ['chat', 'Chat detail', 'Normal'],
      ['theme', 'Theme', 'Spartan Dark'],
      ['language', 'Language', 'Auto'],
      ['voice-lang', 'Voice language', 'Auto'],
      ['voice-mode', 'Words appear', ot.running === 'Running' ? 'Live' : 'Live'],
    ] as const;
    for (const [key, title, value] of rows) {
      const row = within(screen.getByTestId(`settings-row-${key}`));
      expect(row.getByText(title)).toBeTruthy();
      expect(screen.getByTestId(`settings-value-${key}`)).toHaveTextContent(value);
    }
    // Version and About are one row: its name, and the build as its value.
    expect(screen.getByTestId('settings-value-about')).toHaveTextContent(installedApp().version);
    expect(screen.queryByTestId('settings-row-version')).toBeNull();
    // A row whose value says it all carries no second line: the accounts, the language.
    expect(screen.getByTestId('settings-row-accounts').props.accessibilityHint).toBeUndefined();
    expect(screen.getByTestId('settings-row-language').props.accessibilityHint).toBeUndefined();
    // A row is a button a screen reader names with its value, and it leads somewhere: a chevron.
    const accounts = screen.getByTestId('settings-row-accounts');
    expect(accounts.props.accessibilityRole).toBe('button');
    expect(accounts.props.accessibilityLabel).toBe('Accounts, Ada Demir');
  });

  it('leaves the Claude pool and Orchestrator rows out when the server has none', async () => {
    await open({ orch: null, onAgent: undefined, onDetail: undefined });
    // Nothing of the AI group is left, so the group is not drawn at all.
    expect(screen.queryByTestId('settings-group-ai')).toBeNull();
    expect(screen.getByTestId('settings-group-appearance')).toBeTruthy();
  });

  it('opens the Orchestrator sheet from its row, and says which model it is on', async () => {
    const onAgent = jest.fn();
    await open({ onAgent });
    expect(within(screen.getByTestId('settings-row-orchestrator')).getByText('claude-sonnet-4-5')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-row-orchestrator'));
    expect(onAgent).toHaveBeenCalled();
  });

  it('asks before signing out, and then signs the open account out', async () => {
    await open();
    const row = screen.getByTestId('action-sign-out');
    // Two accounts on the phone: the row and the question both name this one.
    expect(within(row).getByText('Sign out of Ada Demir')).toBeTruthy();
    // It acts here rather than leading anywhere, so it has no chevron.
    expect(row.props.accessibilityRole).toBe('button');
    await fireEvent.press(row);
    expect(screen.getByText('Sign out of Ada Demir?')).toBeTruthy();
    // Saying no leaves everything as it was.
    await fireEvent.press(screen.getByTestId('dialog-cancel'));
    expect(mockSignOut).not.toHaveBeenCalled();
    await fireEvent.press(row);
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('names no account when only one is on the phone', async () => {
    mockAccounts = [mockAccount];
    await open();
    expect(within(screen.getByTestId('action-sign-out')).getByText('Sign out')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('action-sign-out'));
    expect(screen.getByText('Sign out of Workbench?')).toBeTruthy();
  });

  it('gives a newer build a row of its own, in the accent, only when there is one', async () => {
    const update = {
      installed: { version: '1.9.9', code: 44 },
      check: {
        state: 'available' as const,
        release: {
          version: '1.9.10',
          versionCode: 45,
          size: null,
          sha256: null,
          url: '/api/public/m/workbench-1.9.10.apk',
          notes: null,
          minSdk: null,
          publishedAt: null,
        },
      },
      checking: false,
      job: { state: 'idle' as const },
      canInstall: true,
      recheck: jest.fn(),
      install: jest.fn(async () => undefined),
      cancel: jest.fn(),
      allow: jest.fn(async () => undefined),
    };
    await open({ update });
    const row = screen.getByTestId('settings-row-update');
    expect(within(row).getByText('Update ready: 1.9.10')).toBeTruthy();
    expect(screen.getByTestId('settings-value-about')).toHaveTextContent(installedApp().version);
    // It leads to About, where the download is described and started.
    await fireEvent.press(row);
    expect(screen.getByTestId('settings-about-page')).toBeTruthy();
  });

  it('says the pool with the window that is fullest, in four words', async () => {
    mockClient = {
      ccpoolOverview: async () => ({
        me: { id: 'u1', name: 'Ada', role: 'owner', privileged: true, keys: 1, usage: {} },
        plan: {
          five_hour: { pct: 9.1 },
          seven_day: { pct: 41.25 },
          week_pct: 41.25,
          week_api_usd: 0,
        },
        accounts: [],
        my_sessions: [],
        gateway: { configured: true },
      }),
    };
    const onPool = jest.fn();
    await open({ onPool });
    await act(async () => undefined);
    // The fuller window is the one shown, with its own short name.
    expect(screen.getByTestId('settings-value-ccpool')).toHaveTextContent('41.25% · 7 d');
  });

  it('takes Back out of a page first, and only then out of Settings', async () => {
    const ref = await open();
    expect(ref.current?.back()).toBe(false);
    await fireEvent.press(screen.getByTestId('settings-row-theme'));
    expect(screen.getByTestId('settings-theme-page')).toBeTruthy();
    await act(async () => {
      ref.current?.back();
    });
    expect(screen.getByTestId('settings-screen')).toBeTruthy();
  });
});

describe('Settings’ pages', () => {
  it('keeps a choice the moment it is touched, and the menu says the new one', async () => {
    // The app keeps the language it is set to and hands it back down: the row
    // is watched changing, not a spy on the callback.
    function Live() {
      const [appLang, setAppLang] = React.useState<'auto' | 'en' | 'tr'>('auto');
      return (
        <SettingsScreen
          t={t}
          ot={ot}
          ui="en"
          lang="auto"
          onLang={() => undefined}
          appLang={appLang}
          onAppLang={setAppLang}
          detail="normal"
          onDetail={() => undefined}
          orch={orch}
          onAgent={() => undefined}
        />
      );
    }
    await render(<Live />);
    expect(screen.getByTestId('settings-value-language')).toHaveTextContent('Auto');
    await fireEvent.press(screen.getByTestId('settings-row-language'));
    const page = within(screen.getByTestId('settings-language'));
    // What the setting is for, then each answer with what it means.
    expect(page.getByText(t.languageAbout)).toBeTruthy();
    expect(page.getByText('The app’s words in Turkish')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('settings-language-tr'));
    // Kept at once: the page says so, and the menu behind it.
    expect(screen.getByTestId('settings-language-tr').props.accessibilityState).toEqual({ checked: true });
    await fireEvent.press(screen.getByTestId('settings-back'));
    expect(screen.getByTestId('settings-value-language')).toHaveTextContent('Türkçe');
  });

  it('marks the choice set now, and only that one', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('settings-row-voice-mode'));
    expect(screen.getByTestId('settings-voice-mode-live').props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByTestId('settings-voice-mode-record').props.accessibilityState).toEqual({ checked: false });
    expect(screen.getByText(t.voiceModeChoice.record)).toBeTruthy();
  });

  it('offers the themes under three headings, with their own colours and no dark/light line each', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('settings-row-theme'));
    const page = within(screen.getByTestId('settings-theme-page'));
    // The phone's own, then the dark ones, then the light ones - a heading each.
    const heading = (id: string) => within(screen.getByTestId(`theme-group-${id}`)).getByRole('header');
    expect(heading('system')).toHaveTextContent('Follow the phone');
    // The headings are the app's own words, drawn in small capitals by the style.
    expect(heading('dark')).toHaveTextContent(/^dark$/i);
    expect(heading('light')).toHaveTextContent(/^light$/i);
    expect(screen.getByTestId('theme-system')).toBeTruthy();
    expect(screen.getByTestId('theme-spartan-dark').props.accessibilityState).toEqual({ checked: true });
    expect(page.getByText('Dracula')).toBeTruthy();
    // A theme is its name and its colours: the "Dark"/"Light" line under each is gone.
    expect(screen.getByTestId('theme-dracula').props.accessibilityHint).toBeUndefined();
    expect(screen.getByTestId('theme-system').props.accessibilityHint).toBeUndefined();
    // Picking one keeps it and restarts the app to wear it.
    await fireEvent.press(screen.getByTestId('theme-dracula'));
    expect(screen.getByText(t.restartTitle('Dracula'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(reloadAppAsync).toHaveBeenCalled();
  });

  it('shows the accounts on the phone, switches to one, adds one, and signs one out alone', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('settings-row-accounts'));
    // The open account is marked "Active"; another says who it is and where.
    expect(screen.getByTestId('account-a1').props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByTestId('account-a2').props.accessibilityState).toEqual({ checked: false });
    expect(within(screen.getByTestId('account-a1')).getByText('Active')).toBeTruthy();
    expect(within(screen.getByTestId('account-a2')).queryByText('Active')).toBeNull();
    expect(screen.getByText('bo@other.example · other.example')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('account-a2'));
    expect(mockSwitchTo).toHaveBeenCalledWith('a2');
    await fireEvent.press(screen.getByTestId('account-add'));
    expect(mockAddAnother).toHaveBeenCalled();
    // Signing one out is in the row's "..." menu (no second icon on the row), and it asks first.
    await fireEvent.press(screen.getByTestId('account-remove-a2'));
    expect(screen.getByTestId('account-menu')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('action-sign-out'));
    expect(screen.getByText('Sign out of Bo?')).toBeTruthy();
    expect(mockRemove).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('dialog-confirm'));
    expect(mockRemove).toHaveBeenCalledWith('a2');
  });

  it('describes the home screen widget, and on this platform has no button to add it', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('settings-row-widget'));
    const page = within(screen.getByTestId('settings-widget-page'));
    expect(page.getByText(t.widgetWhat)).toBeTruthy();
    expect(page.getByText('Not added')).toBeTruthy();
    expect(page.getByText(t.widgetHow)).toBeTruthy();
    // Jest runs an iOS platform: adding a home screen widget is Android's alone.
    expect(screen.queryByTestId('widget-add')).toBeNull();
  });

  it('says the version, the licence and where the source is, on one About page', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('settings-row-about'));
    const about = within(screen.getByTestId('settings-about-page'));
    expect(about.getByText(t.aboutText)).toBeTruthy();
    expect(about.getByText(`Workbench mobile ${installedApp().version}`)).toBeTruthy();
    expect(about.getByText(t.licence)).toBeTruthy();
    expect(about.getByText('github.com/x3beche/workbench-mobile')).toBeTruthy();
    expect(about.getByTestId('settings-source')).toBeTruthy();
  });

  it('shows how much of an answer the Chat shows, and what the chosen one looks like', async () => {
    const onDetail = jest.fn();
    await open({ onDetail });
    await fireEvent.press(screen.getByTestId('settings-row-chat'));
    const page = within(screen.getByTestId('settings-chat-detail'));
    expect(page.getByText('Compact')).toBeTruthy();
    expect(page.getByText('Detailed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('settings-chat-detail-detailed'));
    expect(onDetail).toHaveBeenCalledWith('detailed');
  });
});
