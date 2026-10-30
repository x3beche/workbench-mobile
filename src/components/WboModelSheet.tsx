/**
 * Mount it to open it.
 * Choose the model for this OpenCode session from the models available to
 * OpenCode on that computer (wboSession.models).
 */
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { VoiceLang } from '../api/client';
import type { WboModel, WboSelectedModel } from '../api/types';
import { colors, fonts, gutter, indicatorStyle, motion, radius, space, touch, type } from '../theme/tokens';
import { Appear } from './Appear';
import { Choice } from './Choice';
import { Check, Search, X } from './icons';
import { KeyboardSpacer } from './KeyboardSpacer';
import { modelName } from './MessageItem';
import { wboStrings } from '../lib/wboStrings';
import { uiLang } from '../update/strings';
import { ErrorText, Glyph, IconButton } from './ui';

export function WboModelSheet({
  models,
  selected,
  lang = 'auto',
  onClose,
  onPick,
}: {
  models: WboModel[];
  selected?: WboSelectedModel | null;
  lang?: VoiceLang;
  onClose: () => void;
  onPick: (providerID: string, modelID: string, variant?: string) => Promise<void>;
}) {
  const t = wboStrings(uiLang(lang));
  const { height } = useWindowDimensions();

  // Extract unique providers, putting 'workbench' first
  const providers = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of models) {
      if (m.providerID && !map.has(m.providerID)) {
        map.set(m.providerID, m.providerName || m.providerID);
      }
    }
    const list = Array.from(map.entries()).map(([id, name]) => ({ id, label: name }));
    list.sort((a, b) => {
      if ((a.id === 'workbench') !== (b.id === 'workbench')) return a.id === 'workbench' ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
    return list;
  }, [models]);

  const [prov, setProv] = useState(() => selected?.providerID || providers[0]?.id || 'workbench');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const curModels = useMemo(() => models.filter((m) => m.providerID === prov), [models, prov]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return curModels.filter((m) => words.every((w) => `${m.modelID} ${m.name}`.toLowerCase().includes(w)));
  }, [curModels, q]);

  const pick = async (m: WboModel) => {
    setSaving(m.modelID);
    try {
      await onPick(m.providerID, m.modelID, m.variants?.[0]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The model could not be changed.');
    } finally {
      setSaving(null);
    }
  };

  const tokSize = (n?: number | null) => {
    if (!n) return '';
    if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
    if (n >= 1_000) return `${Math.round(n / 1000)}k`;
    return String(n);
  };

  const currentLabel = selected?.name || (selected?.modelID ? modelName(selected.modelID) : '');

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel={t.close} />
      <Appear from="below" fill={false} duration={motion.sheet}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[s.sheet, { height: Math.round(height * 0.82) }]}>
          <View style={s.grip} aria-hidden />
          <View style={s.head}>
            <View style={s.flex}>
              <Text style={s.title}>{t.model}</Text>
              {currentLabel ? (
                <Text style={s.now} numberOfLines={1}>
                  {currentLabel}
                </Text>
              ) : null}
            </View>
            <IconButton icon={X} label={t.close} onPress={onClose} testID="models-close" color={colors.inkDim} />
          </View>
          <View style={s.body}>
            {providers.length > 1 ? (
              <Choice
                label={t.provider}
                options={providers}
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
                placeholder={t.pickModel}
                placeholderTextColor={colors.inkDim}
                selectionColor={colors.inkDim}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t.pickModel}
              />
            </View>
            {error ? <ErrorText>{error}</ErrorText> : null}
          </View>
          <FlatList
            indicatorStyle={indicatorStyle}
            style={s.flex}
            data={shown}
            keyExtractor={(m) => `${m.providerID}/${m.modelID}`}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyText}>{t.noModels}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const on = item.providerID === selected?.providerID && item.modelID === selected?.modelID;
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
                        <View style={s.rowHead}>
                          <Text style={[s.name, on && s.on, pressed && s.dim]} numberOfLines={1}>
                            {item.name || item.modelID}
                          </Text>
                          {item.vision ? <Text style={s.badge}>🖼</Text> : null}
                          {item.variants?.length ? (
                            <View style={s.tagWrap}>
                              <Text style={s.tagText}>{item.variants.join(', ')}</Text>
                            </View>
                          ) : null}
                          {item.context ? (
                            <Text style={s.ctxText}>{tokSize(item.context)}</Text>
                          ) : null}
                        </View>
                        <Text style={s.id} numberOfLines={1}>
                          {saving === item.modelID ? t.sendingAnswer : item.modelID}
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
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: gutter.screen,
    overflow: 'hidden',
  },
  grip: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    alignSelf: 'center',
    marginTop: space.s,
    marginBottom: space.xs,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.s,
  },
  flex: { flex: 1 },
  title: {
    fontFamily: fonts.sans,
    fontSize: type.h2,
    fontWeight: '600',
    color: colors.inkBright,
  },
  now: {
    fontFamily: fonts.sans,
    fontSize: type.caption,
    color: colors.inkDim,
    marginTop: 2,
  },
  body: {
    paddingBottom: space.xs,
    gap: space.s,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.m,
    paddingHorizontal: space.s,
    height: 40,
    gap: space.xs,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: type.body,
    color: colors.inkBright,
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.s,
    paddingHorizontal: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    minHeight: touch.min,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontFamily: fonts.sans,
    fontSize: type.body,
    fontWeight: '500',
    color: colors.ink,
  },
  on: {
    fontWeight: '700',
    color: colors.inkBright,
  },
  dim: { opacity: 0.6 },
  id: {
    fontFamily: fonts.mono,
    fontSize: type.caption,
    color: colors.inkDim,
    marginTop: 2,
  },
  badge: {
    fontSize: 12,
  },
  tagWrap: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tagText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkDim,
  },
  ctxText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkDim,
    marginLeft: 'auto',
  },
  empty: {
    paddingVertical: space.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: type.body,
    color: colors.inkDim,
  },
});
