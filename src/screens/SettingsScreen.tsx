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
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { VoiceLang } from '../api/client';
import type { ChatDetail, OrchStatus, PoolOverview } from '../api/types';
import { accountStrings, localized } from '../components/accountStrings';
import {
  AudioLines,
  Bot,
  ChartColumn,
  Info,
  Gauge,
  Languages,
  ListOrdered,
  LogOut,
  Mic,
  Palette,
  Smartphone,
  UserRound,
  type LucideIcon,
} from '../components/icons';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  SettingsGroup,
  SettingsRow,
  SettingsScroll,
} from '../components/SettingsList';
import { Dialog } from '../components/Sheet';
import { modelName } from '../components/MessageItem';
import { meters, poolShown } from '../lib/ccpool';
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
import { AboutPage, VersionPage, WidgetPage, updateLine } from './settings/AppPages';
import { ChoicePage } from './settings/ChoicePage';
import { ThemePage } from './settings/ThemePage';

/** The pages under Settings' menu. */
type Page = 'menu' | 'accounts' | 'chat' | 'language' | 'theme' | 'voice-lang' | 'voice-mode' | 'version' | 'widget' | 'about';

/** A row of the menu: what it says, and where its tap leads. */
interface MenuRow {
  key: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  value?: string;
  onPress: () => void;
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
  const { user, client, signOut, account } = useSession();
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
  // The pool's row says its first meter ("5-hour 9.10%"), not a paragraph.
  const poolMeter = pool ? meters(pool.plan, pt, ui)[0] : undefined;
  const poolValue = poolMeter ? `${poolMeter.label} ${poolMeter.text}` : '';

  const accountsRow: MenuRow = {
    key: 'accounts',
    icon: UserRound,
    title: a.accounts,
    sub: t.accountsAbout,
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
      sub: t.rowSub.language,
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
  const appRows: MenuRow[] = [
    {
      key: 'version',
      icon: Smartphone,
      title: t.version,
      sub: updateLine(update, ut) || t.versionAbout,
      value: version,
      onPress: () => setPage('version'),
    },
    {
      key: 'widget',
      icon: ChartColumn,
      title: t.widget,
      sub: t.widgetAbout,
      value: widgets ? t.widgetAdded : t.widgetNone,
      onPress: () => setPage('widget'),
    },
    {
      key: 'about',
      icon: Info,
      title: t.about,
      sub: t.aboutSub,
      onPress: () => setPage('about'),
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
            onPress={r.onPress}
            last={i === rows.length - 1}
            testID={`settings-row-${r.key}`}
            valueTestID={`settings-value-${r.key}`}
          />
        ))}
      </SettingsGroup>
    ) : null;

  const menu = (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']} testID="settings-screen">
      <ScreenHeader title={t.settings} onMenu={wide ? undefined : onMenu} menuTestID="settings-open-drawer" />
      <SettingsScroll>
        {group(t.menuGroups.account, 'account', [accountsRow])}
        {group(t.menuGroups.ai, 'ai', aiRows)}
        {group(t.menuGroups.appearance, 'appearance', lookRows)}
        {group(t.menuGroups.voice, 'voice', [voiceRow, modeRow])}
        {group(t.menuGroups.app, 'app', appRows)}
        {/* The one dangerous thing in the menu, at its foot, red, and asked. */}
        {user ? (
          <View style={s.danger}>
            <SettingsRow
              icon={LogOut}
              title={a.signOut}
              sub={t.signOutAbout}
              onPress={() => setAskOut(true)}
              danger
              last
              testID="action-sign-out"
            />
          </View>
        ) : null}
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
    ) : page === 'version' ? (
      <VersionPage t={t} update={update} ut={ut} lang={ui} version={version} onBack={onBack} />
    ) : page === 'widget' ? (
      <WidgetPage t={t} onTheHomeScreen={widgets} onBack={onBack} />
    ) : page === 'about' ? (
      <AboutPage t={t} version={version} onBack={onBack} />
    ) : (
      menu
    );

  return (
    <View style={s.root}>
      {body}
      {askOut ? (
        <Dialog
          title={a.signOutTitle}
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
