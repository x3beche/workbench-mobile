/**
 * Account, from the drawer: who is signed in where, the voice language and
 * when its words appear, the app's version and its update, and the ways out.
 */
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VoiceLang } from '../api/client';
import { displayServer } from '../api/server';
import { useSession } from '../state/session';
import { colors, fonts, gutter, space, type } from '../theme/tokens';
import { SETTINGS_RECHECK_MS } from '../update/release';
import { uiLang, updateStrings } from '../update/strings';
import type { Update } from '../update/useUpdate';
import { VOICE_LANGS, VOICE_MODES, type VoiceMode } from '../voice/voice';
import { accountStrings, localized } from './accountStrings';
import { Avatar } from './Avatar';
import { Choice } from './Choice';
import { Check, LogOut, Network, Plus } from './icons';
import type { Account } from '../state/accounts';
import { ActionList, Dialog, Sheet, type Action } from './Sheet';
import { Glyph, IconButton } from './ui';
import { UpdateSection } from './UpdateSection';

/** Mount it to open it. */
export function AccountSheet({
  onClose,
  lang,
  onLang,
  voiceMode = 'live',
  onVoiceMode = () => undefined,
  update,
  agentLabel,
  onAgent,
}: {
  onClose: () => void;
  lang: VoiceLang;
  onLang: (l: VoiceLang) => void;
  voiceMode?: VoiceMode;
  onVoiceMode?: (m: VoiceMode) => void;
  /** The in-app update (src/update): the versions, and the download where it can be installed. */
  update?: Update;
  /** "Agent & LLM": one's Orchestrator, its model, Start and Stop (left out where the server has none). */
  agentLabel?: string;
  onAgent?: () => void;
}) {
  const { user, client, signOut, account, accounts, switchTo, remove, addAnother, clientFor } = useSession();
  const [asking, setAsking] = useState<Account | null>(null);
  const recheck = update?.recheck;
  // Opening Account asks the server again, unless it was asked a moment ago.
  useEffect(() => {
    recheck?.(SETTINGS_RECHECK_MS);
  }, [recheck]);
  const ui = uiLang(lang);
  const t = accountStrings(ui);
  const actions: Action[] = [];
  if (agentLabel && onAgent) actions.push({ id: 'agent-llm', label: agentLabel, icon: Network, onPress: onAgent });
  if (user) {
    actions.push({
      id: 'sign-out',
      label: t.signOut,
      icon: LogOut,
      danger: true,
      onPress: () => {
        onClose();
        signOut();
      },
    });
  }
  const version = Constants.expoConfig?.version;
  return (
    <Sheet onClose={onClose} testID="account-sheet">
      {/* Every account kept on this phone: the open one marked, a tap opens another, each signs out alone. */}
      <View style={s.block} testID="accounts">
        <Text style={s.label}>{t.accounts}</Text>
        {accounts.map((a) => {
          const on = a.id === account?.id;
          const who = a.user?.name || a.user?.email || t.localMode;
          return (
            <View key={a.id} style={s.acct}>
              <Pressable
                onPress={() => {
                  if (on) return;
                  onClose();
                  switchTo(a.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${who}, ${displayServer(a.server)}`}
                accessibilityHint={on ? t.current : t.switchHint}
                style={({ pressed }) => [s.acctMain, pressed && !on && s.pressed]}
                testID={`account-${a.id}`}
              >
                <Avatar client={on ? client : clientFor(a)} user={a.user} size={32} fontSize={type.tiny} />
                <View style={s.flex}>
                  <Text style={[s.acctName, on && s.on]} numberOfLines={1}>
                    {who}
                  </Text>
                  <Text style={s.dim} numberOfLines={1}>
                    {a.user?.email && a.user?.name ? `${a.user.email} · ` : ''}
                    {displayServer(a.server)}
                  </Text>
                </View>
                {on ? <Glyph icon={Check} size={18} color={colors.inkBright} /> : null}
              </Pressable>
              <IconButton
                icon={LogOut}
                size={18}
                color={colors.inkDim}
                label={t.removeLabel(who)}
                onPress={() => setAsking(a)}
                testID={`account-remove-${a.id}`}
              />
            </View>
          );
        })}
        <Pressable
          onPress={() => {
            onClose();
            addAnother();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [s.acctMain, s.addRow, pressed && s.pressed]}
          testID="account-add"
        >
          <Glyph icon={Plus} size={20} color={colors.ink} />
          <Text style={s.acctName}>{t.addAccount}</Text>
        </Pressable>
      </View>
      <View style={s.block}>
        <Text style={s.label}>{t.voiceLanguage}</Text>
        <Choice label={t.voiceLanguage} options={localized(VOICE_LANGS, t)} value={lang} onChange={onLang} />
      </View>
      <View style={s.block}>
        <Text style={s.label}>{t.wordsAppear}</Text>
        <Choice label={t.wordsAppear} options={localized(VOICE_MODES, t)} value={voiceMode} onChange={onVoiceMode} />
      </View>
      {update ? <UpdateSection update={update} t={updateStrings(ui)} lang={ui} /> : null}
      <View style={s.rule} />
      <ActionList actions={actions} />
      {asking ? (
        <Dialog
          title={t.removeTitle(asking.user?.name || asking.user?.email || t.localMode)}
          text={t.removeText}
          confirm={t.remove}
          danger
          onCancel={() => setAsking(null)}
          onConfirm={async () => {
            const a = asking;
            setAsking(null);
            if (a.id === account?.id) onClose();
            await remove(a.id);
          }}
        />
      ) : null}
      {version && !update ? <Text style={s.version}>Workbench mobile {version}</Text> : null}
    </Sheet>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: gutter, paddingVertical: space.sm },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.hover,
  },
  avatarText: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.ink },
  name: { fontFamily: fonts.sansSemi, fontSize: type.display - 2, color: colors.ink },
  dim: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim, marginTop: 2 },
  block: { paddingHorizontal: gutter, paddingTop: space.md, gap: 6 },
  label: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  value: { fontFamily: fonts.sans, fontSize: type.body, color: colors.ink },
  acct: { flexDirection: 'row', alignItems: 'center' },
  acctMain: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8 },
  addRow: { paddingLeft: 6 },
  acctName: { fontFamily: fonts.sans, fontSize: type.body, color: colors.ink },
  on: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  pressed: { backgroundColor: colors.hover },
  rule: { height: 1, backgroundColor: colors.line, marginTop: space.lg, marginBottom: space.xs },
  version: {
    paddingHorizontal: gutter,
    paddingTop: space.xs,
    paddingBottom: space.sm,
    fontFamily: fonts.sans,
    fontSize: type.tiny,
    color: colors.inkDim,
  },
});
