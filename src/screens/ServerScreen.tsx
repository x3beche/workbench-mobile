/** First screen: which Workbench server to use. Any install works - nothing is built in. */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, WorkbenchClient } from '../api/client';
import { displayServer, normalizeServer, ServerAddressError } from '../api/server';
import { Button, ErrorText, Field, Hint, Wordmark } from '../components/ui';
import { useSession } from '../state/session';
import * as prefs from '../storage/prefs';
import { colors, fonts, gutter, space, type } from '../theme/tokens';

export function ServerScreen() {
  const { connect, notice, server } = useSession();
  const [address, setAddress] = useState(server ? displayServer(server) : '');
  const [recent, setRecent] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(notice);

  useEffect(() => {
    prefs.recentServers().then(setRecent);
  }, []);

  const go = async (typed: string) => {
    setError(null);
    let base: string;
    try {
      base = normalizeServer(typed);
    } catch (e) {
      setError(e instanceof ServerAddressError ? e.message : 'That address cannot be used.');
      return;
    }
    setBusy(base);
    try {
      const state = await new WorkbenchClient(base).probe();
      await connect(base, state);
    } catch (e) {
      const why = e instanceof ApiError && e.status === 0 ? e.message : 'It did not answer as a Workbench server.';
      setError(`${displayServer(base)}: ${why}`);
      setBusy(null);
    }
  };

  const forget = async (s: string) => setRecent(await prefs.forgetServer(s));

  return (
    <SafeAreaView style={st.safe}>
      {/* The focused field and the button under it scroll clear of the keyboard. */}
      <KeyboardAwareScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" bottomOffset={96}>
        <View style={st.card}>
          <Wordmark sub="Connect to a Workbench server: the address you open the web app at." />
          <Field
            testID="server-input"
            label="Server address"
            placeholder="workbench.example.com"
            value={address}
            onChangeText={setAddress}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            inputMode="url"
            returnKeyType="go"
            onSubmitEditing={() => go(address)}
            error={!!error}
          />
          {error ? <ErrorText>{error}</ErrorText> : <Hint>https is used unless you type http://.</Hint>}
          <Button
            testID="server-connect"
            label="Connect"
            variant="primary"
            busy={!!busy}
            disabled={!address.trim()}
            onPress={() => go(address)}
          />
        </View>
        {recent.length ? (
          <View style={st.recent}>
            <Text style={st.head}>Recent servers</Text>
            {recent.map((r) => (
              <View key={r} style={st.row}>
                <Pressable
                  style={({ pressed }) => [st.rowMain, pressed && st.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Connect to ${displayServer(r)}`}
                  disabled={!!busy}
                  onPress={() => {
                    setAddress(displayServer(r));
                    go(r);
                  }}
                >
                  <Text style={st.addr} numberOfLines={1}>
                    {displayServer(r)}
                  </Text>
                </Pressable>
                <Button
                  label="Remove"
                  variant="quiet"
                  accessibilityLabel={`Remove ${displayServer(r)} from recent servers`}
                  onPress={() => forget(r)}
                />
              </View>
            ))}
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: gutter, paddingVertical: space.xl, gap: 28 },
  card: { gap: 14 },
  recent: { gap: 2 },
  head: { fontFamily: fonts.sansMedium, fontSize: type.tiny, color: colors.inkDim, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line },
  rowMain: { flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: 2 },
  pressed: { backgroundColor: colors.hover },
  addr: { fontFamily: fonts.mono, fontSize: type.small, color: colors.ink },
});
