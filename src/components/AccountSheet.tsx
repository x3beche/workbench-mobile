/** Who is signed in where, the voice language, and the ways out. */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { VoiceLang } from '../api/client';
import { displayServer } from '../api/server';
import { useSession } from '../state/session';
import { colors, fonts, type } from '../theme/tokens';
import { VOICE_LANGS } from '../voice/voice';
import { Choice } from './Choice';
import { Button } from './ui';

/** Mount it to open it. */
export function AccountSheet({
  onClose,
  lang,
  onLang,
}: {
  onClose: () => void;
  lang: VoiceLang;
  onLang: (l: VoiceLang) => void;
}) {
  const { user, server, signOut, changeServer } = useSession();
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <SafeAreaView edges={['bottom']} style={s.sheet}>
        <View style={s.block}>
          <Text style={s.name} numberOfLines={1}>
            {user?.name || user?.email || 'Local mode'}
          </Text>
          {user?.email && user?.name ? <Text style={s.dim}>{user.email}</Text> : null}
          <Text style={s.mono} numberOfLines={1}>
            {server ? displayServer(server) : ''}
          </Text>
        </View>
        <View style={s.block}>
          <Text style={s.label}>Voice language</Text>
          <Choice label="Voice language" options={VOICE_LANGS} value={lang} onChange={onLang} />
        </View>
        <View style={s.actions}>
          <Button
            label="Change server"
            onPress={() => {
              onClose();
              changeServer();
            }}
          />
          {user ? (
            <Button
              testID="sign-out"
              label="Sign out"
              variant="danger"
              onPress={() => {
                onClose();
                signOut();
              }}
            />
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 20,
  },
  block: { gap: 4 },
  name: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.ink },
  dim: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  mono: { fontFamily: fonts.mono, fontSize: type.tiny, color: colors.inkDim, marginTop: 2 },
  label: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, marginBottom: 4 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8 },
});
