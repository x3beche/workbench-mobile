/**
 * Mount it to open it.
 * Choose the model that answers in this conversation. The providers are the
 * ones with a key on the server (GET /api/llm/settings); their models come
 * from GET /api/llm/models. The choice is kept on the conversation.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type WorkbenchClient } from '../api/client';
import type { Model, Provider } from '../api/types';
import { colors, fonts, radius, type } from '../theme/tokens';
import { Choice } from './Choice';
import { Button, ErrorText } from './ui';

export function ModelSheet({
  client,
  provider,
  model,
  onClose,
  onPick,
}: {
  client: WorkbenchClient | null;
  provider: string;
  model: string;
  onClose: () => void;
  onPick: (provider: string, model: string) => Promise<void>;
}) {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [prov, setProv] = useState(provider);
  const [loaded, setLoaded] = useState<{ prov: string; list: Model[] } | null>(null);
  const models = loaded && loaded.prov === prov ? loaded.list : null;
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    client
      .providers()
      .then((all) => setProviders(all.filter((p) => p.set)))
      .catch((e) =>
        setError(e instanceof ApiError && e.status === 403 ? 'Your account may not choose models on this server.' : 'The providers could not be read.'),
      );
  }, [client]);

  useEffect(() => {
    if (!client || !prov) return;
    client
      .models(prov)
      .then((list) => setLoaded({ prov, list }))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'The models could not be read.'));
  }, [client, prov]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (models ?? []).filter((m) => words.every((w) => `${m.id} ${m.name}`.toLowerCase().includes(w)));
  }, [models, q]);

  const pick = async (m: Model) => {
    setSaving(m.id);
    try {
      await onPick(prov, m.id);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The model could not be changed.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal visible animationType="none" onRequestClose={onClose}>
      <SafeAreaView style={s.safe}>
        <View style={s.head}>
          <Text style={s.title}>Model</Text>
          <Button label="Close" variant="quiet" onPress={onClose} />
        </View>
        <View style={s.body}>
          {providers && providers.length > 1 ? (
            <Choice label="Provider" options={providers.map((p) => ({ id: p.id, label: p.name }))} value={prov} onChange={setProv} />
          ) : null}
          <TextInput
            style={s.search}
            value={q}
            onChangeText={setQ}
            placeholder="Find a model"
            placeholderTextColor={colors.inkDim}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Find a model"
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
        </View>
        {models === null && !error ? <ActivityIndicator style={s.wait} color={colors.inkDim} /> : null}
        <FlatList
          data={shown}
          keyExtractor={(m) => m.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const on = prov === provider && item.id === model;
            return (
              <Pressable
                onPress={() => pick(item)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [s.row, pressed && s.pressed]}
              >
                <Text style={[s.name, on && s.on]} numberOfLines={1}>
                  {item.name || item.id}
                </Text>
                <Text style={s.id} numberOfLines={1}>
                  {saving === item.id ? 'Saving' : item.id}
                </Text>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  head: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.ink },
  body: { padding: 12, gap: 10 },
  search: {
    minHeight: 40,
    paddingHorizontal: 12,
    fontFamily: fonts.sans,
    fontSize: type.small,
    color: colors.ink,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
  },
  wait: { marginTop: 24 },
  row: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 2 },
  pressed: { backgroundColor: colors.hover },
  name: { fontFamily: fonts.sans, fontSize: type.body, color: colors.inkDim },
  on: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  id: { fontFamily: fonts.mono, fontSize: type.tiny - 1, color: colors.inkDim },
});
