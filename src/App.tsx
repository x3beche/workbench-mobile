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
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { VoiceLang } from './api/client';
import { Appear } from './components/Appear';
import { LoginScreen } from './screens/LoginScreen';
import { ServerScreen } from './screens/ServerScreen';
import { Workspace } from './screens/Workspace';
import { SessionProvider, useSession } from './state/session';
import * as prefs from './storage/prefs';
import { installScrollbars } from './theme/scrollbars';
import { colors } from './theme/tokens';

// The native splash (app.json, expo-splash-screen: the mark on the theme's
// ground) stays until the first screen can be drawn, then fades into it.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 200, fade: true });
installScrollbars();

/** The longest the splash waits for the server to say who is signed in. */
const SPLASH_MAX_MS = 4000;

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
  // A new server or account starts afresh, never in someone else's conversation.
  return (
    <Appear key={`${server}|${user?.id ?? ''}`}>
      <Workspace lang={lang} onLang={changeLang} />
    </Appear>
  );
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
    <GestureHandlerRootView style={s.root}>
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
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
});
