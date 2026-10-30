/**
 * Settings, from the drawer (the account at its foot opens it): a menu of
 * short rows, grouped the way the web app groups its own Settings (its "You"
 * and "This browser"), and a page behind every row that has something to
 * choose or to read.
 *
 *   ACCOUNT       the accounts on this phone, which one is open; Sign out at
 *                 the foot of the menu, red, asking first
 *   AI            one's Orchestrator (AgentSheet), the Claude pool's usage
 *                 (CcpoolScreen), and how much of an answer the Chat shows
 *   APPEARANCE    the theme (a page of themes), the app's language
 *   VOICE         the voice language, and when its words appear
 *   APP           the version and its update, the home screen widget, About
 *
 * A row is an icon, a name, one line about it and the value it is set to now
 * (components/SettingsList.tsx draws them all the same way, so nothing here
 * sets a height or a colour of its own). A choice is a page of radios that
 * keeps what is touched at once; the menu behind it then shows the new value.
 *
 * Android's Back leaves a page for the menu before it leaves Settings
 * (`back()` below, called by the workspace's hardware back).
 */
import { Fragment, forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { VoiceLang } from '../api/client';
import type { ChatDetail, OrchStatus, PoolOverview } from '../api/types';
import { accountStrings, localized } from '../components/accountStrings';
import {
  Activity,
  AudioLines,
  Bot,
  ChartColumn,
  Download,
  Info,
  Gauge,
  Languages,
  ListOrdered,
  LogOut,
  Mic,
  Palette,
  UserRound,
  type LucideIcon,
} from '../components/icons';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  SETTINGS_COLUMN,
  SettingsGroup,
  SettingsRow,
  SettingsScroll,
  useTwoColumns,
} from '../components/SettingsList';
import { Dialog } from '../components/Sheet';
import { modelName } from '../components/MessageItem';
import { meters, poolShown, type Meter } from '../lib/ccpool';
import { activityWords, chatDetailStrings } from '../lib/chatDetail';
import { ccpoolStrings } from '../lib/ccpoolStrings';
import { stateWord } from '../lib/orchestrator';
import type { OrchStrings } from '../lib/orchStrings';
import type { SettingsStrings } from '../lib/settingsStrings';
import { useSession } from '../state/session';
import { SYSTEM_THEME, colors, fonts, space, theme, themeChoice, type } from '../theme/tokens';
import { installedApp } from '../update/installed';
import { SETTINGS_RECHECK_MS } from '../update/release';
import { updateStrings, type UiLang } from '../update/strings';
import type { Update } from '../update/useUpdate';
import { VOICE_LANGS, VOICE_MODES, type VoiceMode } from '../voice/voice';
import { useWidgetsOnHome } from '../widget/home';
import { AccountsPage } from './settings/AccountsPage';
import { ServerHealthPage } from './settings/ServerHealthPage';
import { AboutPage, WidgetPage } from './settings/AppPages';
import { ChoicePage } from './settings/ChoicePage';
import { ThemePage } from './settings/ThemePage';

/** The pages under Settings' menu. */
type Page = 'menu' | 'accounts' | 'chat' | 'language' | 'theme' | 'voice-lang' | 'voice-mode' | 'widget' | 'about' | 'serverhealth';

/** A row of the menu: what it says, and where its tap leads. */
interface MenuRow {
  key: string;
  icon: LucideIcon;
  title: string;
  /** One line under it; a row whose value already says everything has none. */
  sub?: string;
  value?: string;
  /** News of its own, in the accent: a newer build is on the server. */
  accent?: boolean;
  onPress: () => void;
}

/** The shortest name of a subscription window, to sit beside its figure: "5 h", "7 d Opus". */
function windowWord(m: Meter, t: SettingsStrings, plan: PoolOverview['plan'] | undefined): string {
  if (m.id === 'five_hour') return t.window.fiveHour;
  if (m.id === 'seven_day') return t.window.sevenDay;
  // A window of the plan's own, named after the model it is for: the API's "7-day Opus" is "7 d Opus".
  const name = plan?.extra?.find((w) => w.id === m.id)?.label.replace(/^7-day\s+/, '').trim();
  return name ? t.window.sevenDayFor(name) : m.label;
}

export interface SettingsHandle {
  /** Android's Back: out of a page under Settings. False at the menu itself. */
  back: () => boolean;
}

export const SettingsScreen = forwardRef<
  SettingsHandle,
  {
    t: SettingsStrings;
    ot: OrchStrings;
    ui: UiLang;
    lang: VoiceLang;
    onLang: (l: VoiceLang) => void;
    voiceMode?: VoiceMode;
    onVoiceMode?: (m: VoiceMode) => void;
    appLang?: 'auto' | 'en' | 'tr';
    onAppLang?: (l: 'auto' | 'en' | 'tr') => void;
    /** How much of an answer's work the Chat shows (Settings > AI; lib/chatDetail.ts). */
    detail?: ChatDetail;
    onDetail?: (d: ChatDetail) => void;
    update?: Update;
    /** One's Orchestrator, when the server has one: the menu says how it is. */
    orch?: OrchStatus | null;
    onAgent?: () => void;
    wide?: boolean;
    onMenu?: () => void;
    /** Settings > Claude pool opened, with what was read for its row. */
    onPool?: (d: PoolOverview) => void;
  }
>(function SettingsScreen(
  {
    t,
    ot,
    ui,
    lang,
    onLang,
    voiceMode = 'live',
    onVoiceMode = () => undefined,
    appLang = 'auto',
    onAppLang = () => undefined,
    detail = 'normal',
    onDetail,
    update,
    orch,
    onAgent,
    wide = false,
    onMenu,
    onPool,
  },
  ref,
) {
  const { user, client, signOut, account, accounts } = useSession();
  /** The server's own pages are the owner's and the admins' (backend/access.py). */
  const admin = (account?.user as { role?: string } | null)?.role === 'owner'
    || (account?.user as { role?: string } | null)?.role === 'admin';
  const [page, setPage] = useState<Page>('menu');
  /** Signing out of the open account asks first: one tap used to end the session. */
  const [askOut, setAskOut] = useState(false);
  const a = accountStrings(ui);
  const ut = updateStrings(ui);
  const pt = ccpoolStrings(ui);
  const dw = chatDetailStrings(ui);
  const recheck = update?.recheck;
  // Opening Settings asks the server for a newer build again, unless it was asked a moment ago.
  useEffect(() => {
    recheck?.(SETTINGS_RECHECK_MS);
  }, [recheck]);
  // The build on this phone, as the update reads it too (expo-application, else app.json).
  const version = installedApp().version;
  // The Claude pool's row: only where the pool is set up and this person may see it (an error, a 403: no row).
  const [pool, setPool] = useState<PoolOverview | null>(null);
  useEffect(() => {
    let live = true;
    if (client && onPool)
      client.ccpoolOverview().then(
        (d) => live && setPool(poolShown(d) ? d : null),
        () => live && setPool(null),
      );
    return () => {
      live = false;
    };
  }, [client, onPool]);
  const widgets = useWidgetsOnHome();
  /** Wide enough for two columns of groups: the menu fills the width instead of one column. */
  const two = useTwoColumns();

  const onBack = useCallback(() => setPage('menu'), []);
  useImperativeHandle(
    ref,
    () => ({
      back: () => {
        if (page === 'menu') return false;
        setPage('menu');
        return true;
      },
    }),
    [page],
  );

  // What each row says is set to now, in the app's words.
  const activeName = account?.user?.name || account?.user?.email || a.localMode;
  const themeName = themeChoice === SYSTEM_THEME ? t.followPhone : theme.name;
  const langName = appLang === 'auto' ? t.auto : appLang === 'tr' ? 'Türkçe' : 'English';
  const voiceLangs = localized(VOICE_LANGS, a);
  const voiceModes = localized(VOICE_MODES, a);
  const voiceName = voiceLangs.find((l) => l.id === lang)?.label ?? lang;
  const modeName = voiceModes.find((m) => m.id === voiceMode)?.label ?? voiceMode;
  const detailName = dw.levels.find((l) => l.id === detail)?.label ?? '';
  // The pool's row says the window that is fullest, in four words: "9.10% · 5 h".
  const poolMeters = pool ? meters(pool.plan, pt, ui) : [];
  const poolMeter = poolMeters.reduce<Meter | null>((most, m) => (!most || m.pct > most.pct ? m : most), null);
  const poolValue = poolMeter ? `${poolMeter.text} · ${windowWord(poolMeter, t, pool?.plan)}` : '';
  // Signing out names the account when there is more than one to tell apart.
  const outName = account?.user?.name || account?.user?.email || '';
  const named = accounts.length > 1 && !!outName;

  const accountsRow: MenuRow = {
    key: 'accounts',
    icon: UserRound,
    title: a.accounts,
    value: activeName,
    onPress: () => setPage('accounts'),
  };
  const aiRows: MenuRow[] = [];
  if (orch && onAgent)
    aiRows.push({
      key: 'orchestrator',
      icon: Bot,
      title: ot.orchestrator,
      sub: orch.model ? modelName(orch.model) : t.orchestratorAbout,
      value: stateWord(orch, ot),
      onPress: onAgent,
    });
  // The server itself, for its owner and the admins (backend/hosthealth.py).
  if (admin)
    aiRows.push({
      key: 'serverhealth',
      icon: Activity,
      title: t.serverHealth,
      sub: t.serverHealthSub,
      onPress: () => setPage('serverhealth'),
    });
  if (pool && onPool)
    aiRows.push({
      key: 'ccpool',
      icon: Gauge,
      title: pt.title,
      sub: t.rowSub.pool,
      value: poolValue,
      onPress: () => onPool(pool),
    });
  if (onDetail)
    aiRows.push({
      key: 'chat',
      icon: ListOrdered,
      title: dw.title,
      sub: t.rowSub.chat,
      value: detailName,
      onPress: () => setPage('chat'),
    });
  const lookRows: MenuRow[] = [
    {
      key: 'theme',
      icon: Palette,
      title: t.theme,
      sub: t.rowSub.theme,
      value: themeName,
      onPress: () => setPage('theme'),
    },
    {
      key: 'language',
      icon: Languages,
      title: t.language,
      value: langName,
      onPress: () => setPage('language'),
    },
  ];
  const voiceRow: MenuRow = {
    key: 'voice-lang',
    icon: Mic,
    title: a.voiceLanguage,
    sub: t.voiceLangAbout,
    value: voiceName,
    onPress: () => setPage('voice-lang'),
  };
  const modeRow: MenuRow = {
    key: 'voice-mode',
    icon: AudioLines,
    title: a.wordsAppear,
    sub: t.voiceModeAbout,
    value: modeName,
    onPress: () => setPage('voice-mode'),
  };
  // A newer build, when there is one: its own row, in the accent, above nothing
  // else - the version below is the one on this phone.
  const ready = update?.check.state === 'available' ? update.check.release.version : null;
  const appRows: MenuRow[] = [
    ...(ready
      ? [
          {
            key: 'update',
            icon: Download,
            title: ut.drawer(ready),
            accent: true,
            onPress: () => setPage('about'),
          },
        ]
      : []),
    {
      key: 'about',
      icon: Info,
      title: t.about,
      sub: t.aboutSub,
      value: version,
      onPress: () => setPage('about'),
    },
    {
      key: 'widget',
      icon: ChartColumn,
      title: t.widget,
      sub: t.widgetAbout,
      value: widgets ? t.widgetAdded : t.widgetNone,
      onPress: () => setPage('widget'),
    },
  ];

  const group = (title: string, id: string, rows: MenuRow[]) =>
    rows.length ? (
      <SettingsGroup title={title} testID={`settings-group-${id}`}>
        {rows.map((r, i) => (
          <SettingsRow
            key={r.key}
            icon={r.icon}
            title={r.title}
            sub={r.sub}
            value={r.value}
            accent={r.accent}
            onPress={r.onPress}
            last={i === rows.length - 1}
            testID={`settings-row-${r.key}`}
            valueTestID={`settings-value-${r.key}`}
          />
        ))}
      </SettingsGroup>
    ) : null;

  const accountGroup = group(t.menuGroups.account, 'account', [accountsRow]);
  const aiGroup = group(t.menuGroups.ai, 'ai', aiRows);
  const lookGroup = group(t.menuGroups.appearance, 'appearance', lookRows);
  const voiceGroup = group(t.menuGroups.voice, 'voice', [voiceRow, modeRow]);
  const appGroup = group(t.menuGroups.app, 'app', appRows);
  // The one dangerous thing in the menu, red, asked, and without a chevron -
  // it acts here rather than leading anywhere.
  const signOutRow = user ? (
    <View style={s.danger}>
      <SettingsRow
        icon={LogOut}
        title={named ? a.signOutOf(outName) : a.signOut}
        sub={t.signOutAbout}
        onPress={() => setAskOut(true)}
        danger
        chevron={false}
        last
        testID="action-sign-out"
      />
    </View>
  ) : null;

  const menu = (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']} testID="settings-screen">
      <ScreenHeader
        title={t.settings}
        column={two ? undefined : SETTINGS_COLUMN}
        onMenu={wide ? undefined : onMenu}
        menuTestID="settings-open-drawer"
      />
      <SettingsScroll
        columns={[
          <Fragment key="left">
            {accountGroup}
            {aiGroup}
          </Fragment>,
          <Fragment key="right">
            {lookGroup}
            {voiceGroup}
            {appGroup}
          </Fragment>,
        ]}
        // Signing out is not one column's business: it goes across both, under them.
        footer={signOutRow}
      >
        {accountGroup}
        {aiGroup}
        {lookGroup}
        {voiceGroup}
        {appGroup}
      </SettingsScroll>
    </SafeAreaView>
  );

  const body =
    page === 'accounts' ? (
      <AccountsPage t={t} ui={ui} onBack={onBack} />
    ) : page === 'chat' ? (
      <ChoicePage
        title={dw.title}
        about={dw.about}
        options={dw.levels.map((l) => ({ id: l.id, label: l.label, sub: l.about }))}
        value={detail}
        onPick={onDetail ?? (() => undefined)}
        backLabel={t.back}
        onBack={onBack}
        extra={
          <Text style={s.sample}>
            {dw.sample(activityWords(12, 4200, null, dw.act))}
          </Text>
        }
        testID="settings-chat-detail"
      />
    ) : page === 'language' ? (
      <ChoicePage
        title={t.language}
        about={t.languageAbout}
        options={[
          { id: 'auto', label: t.auto, sub: t.languageChoice.auto },
          { id: 'en', label: 'English', sub: t.languageChoice.en },
          { id: 'tr', label: 'Türkçe', sub: t.languageChoice.tr },
        ]}
        value={appLang}
        onPick={onAppLang}
        backLabel={t.back}
        onBack={onBack}
        testID="settings-language"
      />
    ) : page === 'theme' ? (
      <ThemePage t={t} onBack={onBack} />
    ) : page === 'voice-lang' ? (
      <ChoicePage
        title={a.voiceLanguage}
        about={t.voiceLangAbout}
        options={voiceLangs.map((l) => ({ id: l.id, label: l.label, sub: t.voiceLangChoice[l.id] }))}
        value={lang}
        onPick={onLang}
        backLabel={t.back}
        onBack={onBack}
        testID="settings-voice-lang"
      />
    ) : page === 'voice-mode' ? (
      <ChoicePage
        title={a.wordsAppear}
        about={t.voiceModeAbout}
        options={voiceModes.map((m) => ({ id: m.id, label: m.label, sub: t.voiceModeChoice[m.id] }))}
        value={voiceMode}
        onPick={onVoiceMode}
        backLabel={t.back}
        onBack={onBack}
        testID="settings-voice-mode"
      />
    ) : page === 'widget' ? (
      <WidgetPage t={t} onTheHomeScreen={widgets} onBack={onBack} />
    ) : page === 'serverhealth' ? (
      <ServerHealthPage
        client={client ?? null}
        lang={ui === 'tr' ? 'tr' : 'en'}
        onBack={onBack}
        backLabel={t.back}
        title={t.serverHealth}
        about={t.serverHealthSub}
      />
    ) : page === 'about' ? (
      <AboutPage t={t} update={update} ut={ut} lang={ui} version={version} onBack={onBack} />
    ) : (
      menu
    );

  return (
    <View style={s.root}>
      {body}
      {askOut ? (
        <Dialog
          title={named ? a.signOutTitleOf(outName) : a.signOutTitle}
          text={a.signOutText}
          confirm={a.signOut}
          cancel={a.cancel}
          danger
          testID="signout"
          onCancel={() => setAskOut(false)}
          onConfirm={async () => {
            setAskOut(false);
            await signOut();
          }}
        />
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.surface },
  danger: { marginTop: space.lg },
  sample: {
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.inkDim,
  },
});
