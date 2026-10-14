/** The app: fonts, the session, and which screen is showing. */
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_400Regular_Italic,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { VoiceLang } from './api/client';
import type { Chat } from './api/types';
import { ChatListScreen } from './screens/ChatListScreen';
import { ChatScreen } from './screens/ChatScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ServerScreen } from './screens/ServerScreen';
import { SessionProvider, useSession } from './state/session';
import * as prefs from './storage/prefs';
import { colors } from './theme/tokens';

/** Signed in: the list, or one conversation open over it. */
function Signed({ lang, onLang }: { lang: VoiceLang; onLang: (l: VoiceLang) => void }) {
  const [open, setOpen] = useState<Chat | null>(null);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!open) return false;
      setOpen(null);
      return true;
    });
    return () => sub.remove();
  }, [open]);
  if (open) return <ChatScreen key={open.id} initial={open} onBack={() => setOpen(null)} lang={lang} />;
  return <ChatListScreen onOpen={setOpen} lang={lang} onLang={onLang} />;
}

function Screens() {
  const { phase, server, user } = useSession();
  const [lang, setLang] = useState<VoiceLang>('auto');

  useEffect(() => {
    prefs.voiceLang().then(setLang);
  }, []);

  const changeLang = (l: VoiceLang) => {
    setLang(l);
    prefs.setVoiceLang(l);
  };

  if (phase === 'boot') {
    return (
      <View style={s.boot}>
        <ActivityIndicator color={colors.inkDim} />
      </View>
    );
  }
  if (phase === 'server') return <ServerScreen />;
  if (phase === 'login') return <LoginScreen />;
  // A new server or account starts on its list, never in someone else's conversation.
  return <Signed key={`${server}|${user?.id ?? ''}`} lang={lang} onLang={changeLang} />;
}

export default function App() {
  const [fontsReady, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_400Regular_Italic,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
  return (
    <SafeAreaProvider style={s.root}>
      <StatusBar style="light" />
      {fontsReady || fontError ? (
        <SessionProvider>
          <Screens />
        </SessionProvider>
      ) : (
        <View style={s.boot} />
      )}
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
