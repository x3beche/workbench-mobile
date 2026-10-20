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
import { accountStrings } from './components/accountStrings';
import { setAppLanguage, uiLang } from './update/strings';
import * as prefs from './storage/prefs';
import { installScrollbars } from './theme/scrollbars';
import { colors, theme } from './theme/tokens';
import type { VoiceMode } from './voice/voice';

// The native splash (app.json, expo-splash-screen: the mark on the theme's
// ground) stays until the first screen can be drawn, then fades into it.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 200, fade: true });
installScrollbars();

/** The longest the splash waits for the server to say who is signed in. */
const SPLASH_MAX_MS = 4000;

function Screens() {
  const { phase, server, user, account } = useSession();
  const [lang, setLang] = useState<VoiceLang>('auto');
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('live');
  /** Settings > Language: the app's own words, apart from the voice's. */
  const [appLang, setAppLangState] = useState<'auto' | 'en' | 'tr'>('auto');

  useEffect(() => {
    prefs.voiceLang().then(setLang);
    prefs.voiceMode().then(setVoiceMode);
    prefs.appLang().then((l) => {
      setAppLanguage(l === 'auto' ? null : l);
      setAppLangState(l);
    });
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

  const changeVoiceMode = (m: VoiceMode) => {
    setVoiceMode(m);
    prefs.setVoiceMode(m);
  };

  const changeAppLang = (l: 'auto' | 'en' | 'tr') => {
    setAppLanguage(l === 'auto' ? null : l);
    setAppLangState(l);
    prefs.setAppLang(l);
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
        <ServerScreen cancelLabel={accountStrings(uiLang(lang)).cancel} />
      </Appear>
    );
  }
  if (phase === 'login') {
    return (
      <Appear key="login">
        <LoginScreen cancelLabel={accountStrings(uiLang(lang)).cancel} />
      </Appear>
    );
  }
  // Each account is drawn afresh (its streams, lists and caches), never in someone else's conversation.
  return (
    <Appear key={`${account?.id ?? ''}|${server}|${user?.id ?? ''}`}>
      <Workspace
        lang={lang}
        onLang={changeLang}
        voiceMode={voiceMode}
        onVoiceMode={changeVoiceMode}
        appLang={appLang}
        onAppLang={changeAppLang}
      />
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
          <StatusBar style={theme.light ? 'dark' : 'light'} />
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
