/** Sign in to the chosen server with an email address and password, as on the web. */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../api/client';
import { displayServer } from '../api/server';
import { accountStrings, type AccountStrings } from '../components/accountStrings';
import { Button, ErrorText, Field, Wordmark } from '../components/ui';
import { useSession } from '../state/session';
import * as prefs from '../storage/prefs';
import { colors, fonts, gutter, space, type } from '../theme/tokens';

export function LoginScreen({
  cancelLabel = 'Cancel',
  words,
}: {
  cancelLabel?: string;
  /** The screen's own words; English when a caller gives none. */
  words?: AccountStrings;
}) {
  const t = words ?? accountStrings('en');
  const { server, signedIn, changeServer, notice, adding, accounts, cancelAdd, clientWith } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice);
  const pw = useRef<TextInput>(null);

  useEffect(() => {
    if (server) prefs.lastEmail(server).then((e) => e && setEmail((now) => now || e));
  }, [server]);

  const go = async () => {
    if (!server) return;
    if (!email.trim() || !password) {
      setError(t.enterEmailPassword);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Signed in as a new account: no other account's session goes with it.
      const { user, session } = await clientWith(server, null).login(email, password);
      const mine = clientWith(server, session);
      await prefs.rememberEmail(server, email.trim());
      // An admin-set password must be replaced first, which the app does not do.
      const state = await mine.authState().catch(() => null);
      if (state?.must_change_password) {
        await mine.logout().catch(() => undefined);
        setError(t.mustChoosePassword);
        setBusy(false);
        return;
      }
      setPassword('');
      await signedIn(user, session);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.signInFailed);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={st.safe}>
      {/* The focused field and the button under it scroll clear of the keyboard. */}
      <KeyboardAwareScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" bottomOffset={96}>
        <View style={st.card}>
          <Wordmark sub={t.signInSub} />
          <View style={st.serverRow}>
            <Text style={st.server} numberOfLines={1} testID="login-server">
              {server ? displayServer(server) : ''}
            </Text>
            <Button label={t.change} variant="quiet" onPress={changeServer} accessibilityLabel={t.changeServer} />
          </View>
          <Field
            testID="login-email"
            label={t.email}
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
            label={t.password}
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
          <Button testID="login-submit" label={t.signIn} variant="primary" busy={busy} onPress={go} />
          {adding && accounts.length ? (
            <Button testID="login-cancel" label={cancelLabel} variant="quiet" onPress={cancelAdd} />
          ) : null}
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
