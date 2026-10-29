/**
 * Mount it to open it.
 * Choose the model that answers in this conversation. The providers are the
 * ones with a key on the server (GET /api/llm/settings); their models come
 * from GET /api/llm/models. The choice is kept on the conversation.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type WorkbenchClient } from '../api/client';
import type { Model, Provider } from '../api/types';
import { colors, fonts, gutter, indicatorStyle, motion, radius, space, touch, type } from '../theme/tokens';
import { Appear } from './Appear';
import { Choice } from './Choice';
import { Check, Search, X } from './icons';
import { KeyboardSpacer } from './KeyboardSpacer';
import { modelName } from './MessageItem';
import { ErrorText, Glyph, IconButton } from './ui';

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
  const { height } = useWindowDimensions();

  useEffect(() => {
    if (!client) return;
    client
      .providers()
      .then((all) => setProviders(all.filter((p) => p.set)))
      .catch((e) =>
        setError(
          e instanceof ApiError && e.status === 403
            ? 'Your account may not choose models on this server.'
            : 'The providers could not be read.',
        ),
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
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <Appear from="below" fill={false} duration={motion.sheet}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[s.sheet, { height: Math.round(height * 0.82) }]}>
          <View style={s.grip} aria-hidden />
          <View style={s.head}>
            <View style={s.flex}>
              <Text style={s.title}>Model</Text>
              {model ? (
                <Text style={s.now} numberOfLines={1}>
                  Now: {modelName(model)}
                </Text>
              ) : null}
            </View>
            <IconButton icon={X} label="Close" onPress={onClose} testID="models-close" color={colors.inkDim} />
          </View>
          <View style={s.body}>
            {providers && providers.length > 1 ? (
              <Choice
                label="Provider"
                options={providers.map((p) => ({ id: p.id, label: p.name }))}
                value={prov}
                onChange={setProv}
              />
            ) : null}
            <View style={s.search}>
              <Glyph icon={Search} size={18} color={colors.inkDim} />
              <TextInput
                style={s.searchInput}
                value={q}
                onChangeText={setQ}
                placeholder="Find a model"
                placeholderTextColor={colors.inkDim}
                selectionColor={colors.inkDim}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Find a model"
              />
            </View>
            {error ? <ErrorText>{error}</ErrorText> : null}
          </View>
          {models === null && !error ? <ActivityIndicator style={s.wait} color={colors.inkDim} /> : null}
          <FlatList
            indicatorStyle={indicatorStyle}
            style={s.flex}
            data={shown}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => {
              const on = prov === provider && item.id === model;
              return (
                <Pressable
                  onPress={() => pick(item)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={s.row}
                >
                  {({ pressed }) => (
                    <>
                      <View style={s.flex}>
                        <Text style={[s.name, on && s.on, pressed && s.dim]} numberOfLines={1}>
                          {item.name || item.id}
                        </Text>
                        <Text style={s.id} numberOfLines={1}>
                          {saving === item.id ? 'Saving' : item.id}
                        </Text>
                      </View>
                      {on ? <Glyph icon={Check} size={18} color={colors.inkBright} /> : null}
                    </>
                  )}
                </Pressable>
              );
            }}
          />
          <KeyboardSpacer />
        </SafeAreaView>
      </Appear>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  flex: { flex: 1, minWidth: 0 },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: space.sm,
  },
  grip: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.pressed,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: gutter,
    paddingRight: space.xs,
    paddingTop: space.xs,
  },
  title: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.ink },
  now: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, marginTop: 2 },
  body: { paddingHorizontal: gutter, paddingTop: space.sm, paddingBottom: space.md, gap: 10 },
  search: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.field,
  },
  searchInput: {
    flex: 1,
    minHeight: touch - 2,
    fontFamily: fonts.sans,
    fontSize: type.input,
    color: colors.ink,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  wait: { marginTop: 24 },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: gutter,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  name: { fontFamily: fonts.sans, fontSize: type.body, color: colors.ink },
  on: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  dim: { color: colors.inkDim },
  id: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, marginTop: 2 },
});
