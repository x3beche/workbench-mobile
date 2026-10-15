/** Sign in to the chosen server with an email address and password, as on the web. */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../api/client';
import { displayServer } from '../api/server';
import { Button, ErrorText, Field, Wordmark } from '../components/ui';
import { useSession } from '../state/session';
import * as prefs from '../storage/prefs';
import { colors, fonts, gutter, space, type } from '../theme/tokens';

export function LoginScreen() {
  const { client, server, signedIn, changeServer, notice } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice);
  const pw = useRef<TextInput>(null);

  useEffect(() => {
    if (server) prefs.lastEmail(server).then((e) => e && setEmail((now) => now || e));
  }, [server]);

  const go = async () => {
    if (!client || !server) return;
    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await client.login(email, password);
      await prefs.rememberEmail(server, email.trim());
      // An admin-set password must be replaced first, which the app does not do.
      const state = await client.authState().catch(() => null);
      if (state?.must_change_password) {
        await client.logout().catch(() => undefined);
        setError('This account must choose a new password first. Do that in the web app, then sign in here.');
        setBusy(false);
        return;
      }
      setPassword('');
      signedIn(user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Signing in failed.');
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={st.safe}>
      {/* The focused field and the button under it scroll clear of the keyboard. */}
      <KeyboardAwareScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" bottomOffset={96}>
        <View style={st.card}>
          <Wordmark sub="Sign in to continue." />
          <View style={st.serverRow}>
            <Text style={st.server} numberOfLines={1} testID="login-server">
              {server ? displayServer(server) : ''}
            </Text>
            <Button label="Change" variant="quiet" onPress={changeServer} accessibilityLabel="Change server" />
          </View>
          <Field
            testID="login-email"
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => pw.current?.focus()}
            error={!!error}
          />
          <Field
            ref={pw}
            testID="login-password"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={go}
            error={!!error}
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button testID="login-submit" label="Sign in" variant="primary" busy={busy} onPress={go} />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: gutter, paddingVertical: space.xl },
  card: { gap: 14 },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingLeft: 2,
  },
  server: { flex: 1, fontFamily: fonts.mono, fontSize: type.small, color: colors.ink },
});
