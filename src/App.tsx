/** The app: fonts, the session, and which screen is showing. */
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_400Regular_Italic,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { VoiceLang } from './api/client';
import type { Chat } from './api/types';
import { Appear } from './components/Appear';
import { ChatListScreen } from './screens/ChatListScreen';
import { ChatScreen } from './screens/ChatScreen';
import { LoginScreen } from './screens/LoginScreen';
import { ServerScreen } from './screens/ServerScreen';
import { SessionProvider, useSession } from './state/session';
import * as prefs from './storage/prefs';
import { colors } from './theme/tokens';

// The native splash (app.json, expo-splash-screen: the mark on the theme's
// ground) stays until the first screen can be drawn, then fades into it.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 200, fade: true });

/** The longest the splash waits for the server to say who is signed in. */
const SPLASH_MAX_MS = 4000;

/** Signed in: the list, or one conversation open over it. */
function Signed({ lang, onLang }: { lang: VoiceLang; onLang: (l: VoiceLang) => void }) {
  const [open, setOpen] = useState<Chat | null>(null);
  // The list comes back from the left only after a conversation was open.
  const [back, setBack] = useState(false);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!open) return false;
      setBack(true);
      setOpen(null);
      return true;
    });
    return () => sub.remove();
  }, [open]);
  if (open) {
    return (
      <Appear key={`chat-${open.id}`} from="right">
        <ChatScreen
          initial={open}
          onBack={() => {
            setBack(true);
            setOpen(null);
          }}
          lang={lang}
        />
      </Appear>
    );
  }
  return (
    <Appear key="list" from={back ? 'left' : 'none'}>
      <ChatListScreen onOpen={setOpen} lang={lang} onLang={onLang} />
    </Appear>
  );
}

function Screens() {
  const { phase, server, user } = useSession();
  const [lang, setLang] = useState<VoiceLang>('auto');

  useEffect(() => {
    prefs.voiceLang().then(setLang);
  }, []);

  // The splash goes once there is a screen to show (or after SPLASH_MAX_MS, on the spinner).
  const hidden = useRef(false);
  useEffect(() => {
    const hide = () => {
      if (hidden.current) return;
      hidden.current = true;
      SplashScreen.hideAsync().catch(() => undefined);
    };
    if (phase !== 'boot') {
      hide();
      return;
    }
    const t = setTimeout(hide, SPLASH_MAX_MS);
    return () => clearTimeout(t);
  }, [phase]);

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
  if (phase === 'server') {
    return (
      <Appear key="server">
        <ServerScreen />
      </Appear>
    );
  }
  if (phase === 'login') {
    return (
      <Appear key="login">
        <LoginScreen />
      </Appear>
    );
  }
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
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
        <StatusBar style="light" />
        {fontsReady || fontError ? (
          <SessionProvider>
            <Screens />
          </SessionProvider>
        ) : (
          <View style={s.boot} />
        )}
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
