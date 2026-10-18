/** Account, from the drawer: who is signed in where, the voice language and when its words appear, and the ways out. */
import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';

import type { VoiceLang } from '../api/client';
import { displayServer } from '../api/server';
import { initials } from '../lib/groups';
import { useSession } from '../state/session';
import { colors, fonts, gutter, space, type } from '../theme/tokens';
import { VOICE_LANGS, VOICE_MODES, type VoiceMode } from '../voice/voice';
import { Choice } from './Choice';
import { LogOut, Server } from './icons';
import { ActionList, Sheet, type Action } from './Sheet';

/** Mount it to open it. */
export function AccountSheet({
  onClose,
  lang,
  onLang,
  voiceMode = 'live',
  onVoiceMode = () => undefined,
}: {
  onClose: () => void;
  lang: VoiceLang;
  onLang: (l: VoiceLang) => void;
  voiceMode?: VoiceMode;
  onVoiceMode?: (m: VoiceMode) => void;
}) {
  const { user, server, signOut, changeServer } = useSession();
  const actions: Action[] = [
    {
      id: 'change-server',
      label: 'Change server',
      icon: Server,
      onPress: () => {
        onClose();
        changeServer();
      },
    },
  ];
  if (user) {
    actions.push({
      id: 'sign-out',
      label: 'Sign out',
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
      <View style={s.who}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials(user?.name || user?.email)}</Text>
        </View>
        <View style={s.flex}>
          <Text style={s.name} numberOfLines={1}>
            {user?.name || user?.email || 'Local mode'}
          </Text>
          {user?.email && user?.name ? (
            <Text style={s.dim} numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={s.block}>
        <Text style={s.label}>Server</Text>
        <Text style={s.value} numberOfLines={1}>
          {server ? displayServer(server) : ''}
        </Text>
      </View>
      <View style={s.block}>
        <Text style={s.label}>Voice language</Text>
        <Choice label="Voice language" options={VOICE_LANGS} value={lang} onChange={onLang} />
      </View>
      <View style={s.block}>
        <Text style={s.label}>Words appear</Text>
        <Choice label="Words appear" options={VOICE_MODES} value={voiceMode} onChange={onVoiceMode} />
      </View>
      <View style={s.rule} />
      <ActionList actions={actions} />
      {version ? <Text style={s.version}>Workbench mobile {version}</Text> : null}
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
