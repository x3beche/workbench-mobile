/**
 * Settings, from the drawer (the account at its foot opens it): everything
 * the app can be set to, in one place.
 *
 *   Accounts     every account kept on the phone, the open one marked; a tap
 *                opens another, Add account adds one, each signs out alone
 *   Agent & LLM  one's Orchestrator: its model, Start and Stop (AgentSheet)
 *   Claude pool  the server's Claude subscription as the web shows it to this
 *                person (CcpoolScreen), where the pool is set up and theirs to see
 *   Chat detail  how much of an answer's work the Chat shows (compact, normal,
 *                detailed: lib/chatDetail.ts), kept on the server per person
 *   Language     the app's words: Auto, English, Türkçe
 *   Theme        the web app's themes, or the phone's light or dark
 *   Voice        the voice language and when its words appear
 *   App          the version and its update; About
 *
 * Full width; on a wide screen the sections stand two side by side.
 */
import Constants from 'expo-constants';
import { reloadAppAsync } from 'expo';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { VoiceLang } from '../api/client';
import { displayServer } from '../api/server';
import type { ChatDetail, OrchStatus, PoolOverview } from '../api/types';
import { accountStrings, localized } from '../components/accountStrings';
import { Avatar } from '../components/Avatar';
import { Choice } from '../components/Choice';
import {
  Check,
  ChevronRight,
  KeyRound,
  LogOut,
  Network,
  Plus,
} from '../components/icons';
import { Dialog } from '../components/Sheet';
import { StateDot } from '../components/StateDot';
import { ScreenHeader } from '../components/ScreenHeader';
import { Glyph, IconButton } from '../components/ui';
import { UpdateSection } from '../components/UpdateSection';
import { modelName } from '../components/MessageItem';
import { meters, poolShown } from '../lib/ccpool';
import { activityWords, chatDetailStrings } from '../lib/chatDetail';
import { ccpoolStrings } from '../lib/ccpoolStrings';
import { stateWord, statusDot } from '../lib/orchestrator';
import type { OrchStrings } from '../lib/orchStrings';
import type { SettingsStrings } from '../lib/settingsStrings';
import type { Account } from '../state/accounts';
import { useSession } from '../state/session';
import { writeThemePref } from '../storage/themePref';
import { THEMES } from '../theme/themes';
import { SYSTEM_THEME, colors, fonts, gutter, indicatorStyle, space, theme, themeChoice, type } from '../theme/tokens';
import { SETTINGS_RECHECK_MS } from '../update/release';
import { updateStrings, type UiLang } from '../update/strings';
import type { Update } from '../update/useUpdate';
import { VOICE_LANGS, VOICE_MODES, type VoiceMode } from '../voice/voice';

const SOURCE = 'https://github.com/x3beche/workbench-mobile';

export function SettingsScreen({
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
}: {
  t: SettingsStrings;
  ot: OrchStrings;
  ui: UiLang;
  lang: VoiceLang;
  onLang: (l: VoiceLang) => void;
  voiceMode?: VoiceMode;
  onVoiceMode?: (m: VoiceMode) => void;
  appLang?: 'auto' | 'en' | 'tr';
  onAppLang?: (l: 'auto' | 'en' | 'tr') => void;
  /** How much of an answer's work the Chat shows (Settings > Chat; lib/chatDetail.ts). */
  detail?: ChatDetail;
  onDetail?: (d: ChatDetail) => void;
  update?: Update;
  /** One's Orchestrator, when the server has one: the Agent & LLM row says how it is. */
  orch?: OrchStatus | null;
  onAgent?: () => void;
  wide?: boolean;
  onMenu?: () => void;
  /** Settings > Claude pool opened, with what was read for its row. */
  onPool?: (d: PoolOverview) => void;
}) {
  const { user, client, signOut, account, accounts, switchTo, remove, addAnother, clientFor } = useSession();
  const [asking, setAsking] = useState<Account | null>(null);
  /** Signing out of the open account asks first: one tap used to end the session. */
  const [askOut, setAskOut] = useState(false);
  const [wear, setWear] = useState<{ id: string; name: string } | null>(null);
  const a = accountStrings(ui);
  const recheck = update?.recheck;
  // Opening Settings asks the server for a newer build again, unless it was asked a moment ago.
  useEffect(() => {
    recheck?.(SETTINGS_RECHECK_MS);
  }, [recheck]);
  const version = Constants.expoConfig?.version;
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
  const pt = ccpoolStrings(ui);
  /** The detail setting's words, in the app's language. */
  const dw = chatDetailStrings(ui);
  const poolLine = pool
    ? meters(pool.plan, pt, ui)
        .slice(0, 2)
        .map((m) => `${m.label} ${m.text}`)
        .join(' · ') || pt.about
    : '';

  const block = (title: string, children: React.ReactNode, about?: string, testID?: string) => (
    <View style={[s.section, wide && s.sectionWide]} testID={testID}>
      <Text style={s.h}>{title}</Text>
      {about ? <Text style={s.about}>{about}</Text> : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']} testID="settings-screen">
      <ScreenHeader title={t.settings} onMenu={wide ? undefined : onMenu} menuTestID="settings-open-drawer" />
      <ScrollView indicatorStyle={indicatorStyle} contentContainerStyle={[s.body, wide && s.bodyWide]}>
        {block(
          a.accounts,
          <View testID="accounts">
            {accounts.map((x) => {
              const on = x.id === account?.id;
              const who = x.user?.name || x.user?.email || a.localMode;
              return (
                <View key={x.id} style={s.acct}>
                  <Pressable
                    onPress={() => !on && switchTo(x.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${who}, ${displayServer(x.server)}`}
                    accessibilityHint={on ? a.current : a.switchHint}
                    style={({ pressed }) => [s.row, pressed && !on && s.pressed]}
                    testID={`account-${x.id}`}
                  >
                    <Avatar client={on ? client : clientFor(x)} user={x.user} size={32} fontSize={type.tiny} />
                    <View style={s.flex}>
                      <Text style={[s.name, on && s.on]} numberOfLines={1}>
                        {who}
                      </Text>
                      <Text style={s.dim} numberOfLines={1}>
                        {x.user?.email && x.user?.name ? `${x.user.email} · ` : ''}
                        {displayServer(x.server)}
                      </Text>
                    </View>
                    {on ? <Glyph icon={Check} size={18} color={colors.inkBright} /> : null}
                  </Pressable>
                  <IconButton
                    icon={LogOut}
                    size={18}
                    color={colors.inkDim}
                    label={a.removeLabel(who)}
                    onPress={() => setAsking(x)}
                    testID={`account-remove-${x.id}`}
                  />
                </View>
              );
            })}
            <Pressable
              onPress={addAnother}
              accessibilityRole="button"
              style={({ pressed }) => [s.row, pressed && s.pressed]}
              testID="account-add"
            >
              <View style={s.ico}>
                <Glyph icon={Plus} size={20} color={colors.ink} />
              </View>
              <Text style={s.name}>{a.addAccount}</Text>
            </Pressable>
            {user ? (
              <Pressable
                onPress={() => setAskOut(true)}
                accessibilityRole="button"
                style={({ pressed }) => [s.row, pressed && s.pressed]}
                testID="action-sign-out"
              >
                <View style={s.ico}>
                  <Glyph icon={LogOut} size={20} color={colors.danger} />
                </View>
                <Text style={[s.name, s.danger]}>{a.signOut}</Text>
              </Pressable>
            ) : null}
          </View>,
        )}
        {orch && onAgent
          ? block(
              ot.agentLlm,
              <Pressable
                onPress={onAgent}
                accessibilityRole="button"
                style={({ pressed }) => [s.row, pressed && s.pressed]}
                testID="action-agent-llm"
              >
                <View style={s.ico}>
                  <Glyph icon={Network} size={20} color={colors.ink} />
                </View>
                <View style={s.flex}>
                  <Text style={s.name}>{ot.orchestrator}</Text>
                  <View style={s.stateLine}>
                    <StateDot s={statusDot(orch)} />
                    <Text style={s.dim} numberOfLines={1}>
                      {stateWord(orch, ot)}
                      {orch.model ? ` · ${modelName(orch.model)}` : ''}
                    </Text>
                  </View>
                </View>
                <Glyph icon={ChevronRight} size={18} color={colors.inkDim} />
              </Pressable>,
              ot.agentLlmAbout,
            )
          : null}
        {pool && onPool
          ? block(
              pt.title,
              <Pressable
                onPress={() => onPool(pool)}
                accessibilityRole="button"
                style={({ pressed }) => [s.row, pressed && s.pressed]}
                testID="action-ccpool"
              >
                <View style={s.ico}>
                  <Glyph icon={KeyRound} size={20} color={colors.ink} />
                </View>
                <View style={s.flex}>
                  <Text style={s.name}>{pt.title}</Text>
                  <Text style={s.dim} numberOfLines={1}>
                    {poolLine}
                  </Text>
                </View>
                <Glyph icon={ChevronRight} size={18} color={colors.inkDim} />
              </Pressable>,
              pt.about,
            )
          : null}
        {onDetail
          ? block(
              dw.title,
              <View style={s.gap}>
                <Choice
                  label={dw.title}
                  options={dw.levels.map((l) => ({ id: l.id, label: l.label }))}
                  value={detail}
                  onChange={onDetail}
                />
                <Text style={s.text} testID="settings-chat-detail-about">
                  {dw.levels.find((l) => l.id === detail)?.about ?? ''}
                </Text>
                {/* What the setting looks like, so the scale is not a guess: one
                    answer's line, as compact draws it. */}
                <Text style={s.dim}>{dw.sample(activityWords(12, 4200, null, dw.act))}</Text>
              </View>,
              dw.about,
              'settings-chat-detail',
            )
          : null}
        {block(
          t.language,
          <Choice
            label={t.language}
            options={[
              { id: 'auto', label: t.auto },
              { id: 'en', label: 'English' },
              { id: 'tr', label: 'Türkçe' },
            ]}
            value={appLang}
            onChange={onAppLang}
          />,
          t.languageAbout,
          'settings-language',
        )}
        {block(
          t.theme,
          <View testID="settings-theme">
            <ThemeRow
              name={t.followPhone}
              sub={`${THEMES.find((x) => x.id === 'spartan-dark')?.name} / ${THEMES.find((x) => x.id === 'light')?.name}`}
              swatch={null}
              on={themeChoice === SYSTEM_THEME}
              onPress={() => setWear({ id: SYSTEM_THEME, name: t.followPhone })}
              testID="theme-system"
            />
            {THEMES.map((x) => (
              <ThemeRow
                key={x.id}
                name={x.name}
                sub={x.light ? t.light : t.dark}
                swatch={[x.colors.surface, x.colors.surface2, x.colors.ink, x.colors.series1]}
                on={themeChoice !== SYSTEM_THEME && theme.id === x.id}
                onPress={() => setWear({ id: x.id, name: x.name })}
                testID={`theme-${x.id}`}
              />
            ))}
          </View>,
          t.themeAbout,
        )}
        {block(
          t.voice,
          <View style={s.gap}>
            <Text style={s.label}>{a.voiceLanguage}</Text>
            <Choice label={a.voiceLanguage} options={localized(VOICE_LANGS, a)} value={lang} onChange={onLang} />
            <Text style={s.label}>{a.wordsAppear}</Text>
            <Choice
              label={a.wordsAppear}
              options={localized(VOICE_MODES, a)}
              value={voiceMode}
              onChange={onVoiceMode}
            />
          </View>,
        )}
        {block(
          t.app,
          <View style={s.gap}>
            {update ? <UpdateSection update={update} t={updateStrings(ui)} lang={ui} /> : null}
            <Text style={s.label}>{t.about}</Text>
            <Text style={s.text}>{t.aboutText}</Text>
            <Text style={s.dim}>
              Workbench mobile {version ?? ''} · {t.licence} ·{' '}
              <Text style={s.link} onPress={() => Linking.openURL(SOURCE)} accessibilityRole="link">
                {t.source}
              </Text>
            </Text>
          </View>,
        )}
      </ScrollView>
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
      {asking ? (
        <Dialog
          title={a.removeTitle(asking.user?.name || asking.user?.email || a.localMode)}
          text={a.removeText}
          confirm={a.remove}
          danger
          onCancel={() => setAsking(null)}
          onConfirm={async () => {
            const x = asking;
            setAsking(null);
            await remove(x.id);
          }}
        />
      ) : null}
      {wear ? (
        <Dialog
          title={t.restartTitle(wear.name)}
          text={t.restartText}
          confirm={t.restart}
          onCancel={() => setWear(null)}
          onConfirm={async () => {
            writeThemePref(wear.id);
            setWear(null);
            await reloadAppAsync('theme').catch(() => undefined);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function ThemeRow({
  name,
  sub,
  swatch,
  on,
  onPress,
  testID,
}: {
  name: string;
  sub: string;
  swatch: string[] | null;
  on: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={() => !on && onPress()}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={name}
      style={({ pressed }) => [s.theme, pressed && !on && s.pressed]}
      testID={testID}
    >
      <View style={s.swatch}>
        {(swatch ?? [colors.surface, colors.ink]).map((c, i) => (
          <View key={i} style={[s.chip, { backgroundColor: c }]} />
        ))}
      </View>
      <Text style={[s.name, s.flex, on && s.on]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={s.dim}>{sub}</Text>
      {on ? <Glyph icon={Check} size={18} color={colors.inkBright} /> : <View style={s.checkPad} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  head: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headPad: { width: space.sm },
  title: { flex: 1, paddingHorizontal: 4, fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.inkBright },
  body: { paddingBottom: space.xl },
  bodyWide: { flexDirection: 'row', flexWrap: 'wrap' },
  section: {
    paddingHorizontal: gutter,
    paddingVertical: space.lg,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  sectionWide: { width: '50%', borderRightWidth: 1, borderRightColor: colors.line },
  h: { fontFamily: fonts.sansSemi, fontSize: type.body, color: colors.ink },
  about: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: type.tinyLine, color: colors.inkDim, marginTop: -4 },
  gap: { gap: 8 },
  label: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, marginTop: 4 },
  text: { fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  link: { textDecorationLine: 'underline' },
  acct: { flexDirection: 'row', alignItems: 'center' },
  row: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8 },
  ico: { width: 32, alignItems: 'center' },
  name: { fontFamily: fonts.sans, fontSize: type.body, color: colors.ink },
  on: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  danger: { color: colors.danger },
  dim: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  pressed: { backgroundColor: colors.hover },
  stateLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  theme: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8 },
  swatch: {
    flexDirection: 'row',
    width: 56,
    height: 20,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  chip: { flex: 1 },
  checkPad: { width: 18 },
});
