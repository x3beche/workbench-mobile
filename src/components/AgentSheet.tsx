/**
 * Mount it to open it. Agent & LLM, as far as the phone goes: one's own
 * Orchestrator, as the card at the top of the web app's Settings > Agent &
 * LLM (orchestrator-card.ts) - its state and since when, why it stopped,
 * the provider and model it runs on (the providers come with their models
 * from GET /api/me/orchestrator; a pick is saved at once, PUT
 * /api/me/llm/agent), and Start, Restart and Stop. Keys and the other
 * settings stay on the web. Its state is read again when the account's bus
 * says it changed (kind `orch`, through S2); without the bus every 5 s.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError, type WorkbenchClient } from '../api/client';
import type { OrchStatus } from '../api/types';
import { failureWord, haltTitle, stateWord, statusDot, whenOf } from '../lib/orchestrator';
import { useBus, useLive } from '../live/LiveContext';
import type { OrchStrings } from '../lib/orchStrings';
import { colors, fonts, gutter, radius, space, touch, type } from '../theme/tokens';
import { Check, Search } from './icons';
import { modelName } from './MessageItem';
import { Dialog } from './Sheet';
import { StateDot } from './StateDot';
import { TallSheet } from './TallSheet';
import { Button, ErrorText, Glyph } from './ui';

export function AgentSheet({
  client,
  t,
  lang,
  onClose,
  onOpenRoom,
  onChanged,
}: {
  client: WorkbenchClient | null;
  t: OrchStrings;
  lang: 'en' | 'tr';
  onClose: () => void;
  /** Offered from Account: go to the Orchestrator in the Chat. */
  onOpenRoom?: () => void;
  /** It was started, stopped or given another model. */
  onChanged?: (s: OrchStatus) => void;
}) {
  const [st, setSt] = useState<OrchStatus | null>(null);
  const [prov, setProv] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<'start' | 'stop' | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [askStop, setAskStop] = useState(false);

  const take = useCallback(
    (s: OrchStatus) => {
      setSt(s);
      setProv((now) =>
        now && s.providers.some((p) => p.id === now) ? now : (s.choice?.provider_id ?? s.providers[0]?.id ?? ''),
      );
    },
    [],
  );

  const load = useCallback((): Promise<void> => {
    if (!client) return Promise.resolve();
    return client.orchestrator().then(take, (e) =>
      setNote({ text: e instanceof ApiError && e.status !== 403 ? e.message : t.mayNot, bad: true }),
    );
  }, [client, take, t]);

  // Read again when the account's bus says it changed (`orch`); every 5 s without the bus, as before.
  const hub = useLive();
  const pace = useMemo(() => hub?.pace() ?? null, [hub]);
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!pace || pace.due()) load();
    }, 5000);
    return () => clearInterval(timer);
  }, [load, pace]);
  useBus(['orch'], (e) => {
    if (e.k === '$down') return;
    pace?.mark();
    load();
  });

  const models = useMemo(() => {
    const all = st?.providers.find((p) => p.id === prov)?.models ?? [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((m) => words.every((w) => m.toLowerCase().includes(w)));
  }, [st, prov, q]);

  const choice = st?.choice ?? null;
  const ready = !!choice && !!st?.providers.some((p) => p.id === choice.provider_id);
  const running = st?.desired === 'running';

  const pick = async (model: string) => {
    if (!client) return;
    setSaving(model);
    try {
      await client.setAgentModel(prov, model);
      setNote({ text: `${t.modelSaved}: ${modelName(model)}` });
    } catch (e) {
      setNote({ text: `${t.cantSaveModel}: ${e instanceof Error ? e.message : String(e)}`, bad: true });
    } finally {
      setSaving(null);
      await load();
    }
  };

  const start = async () => {
    if (!client) return;
    setBusy('start');
    setNote(null);
    try {
      const got = await client.orchestratorStart();
      take(got);
      onChanged?.(got);
    } catch (e) {
      setNote({ text: `${t.cantStart}: ${e instanceof Error ? e.message : String(e)}`, bad: true });
    } finally {
      setBusy(null);
      await load();
    }
  };

  const stop = async () => {
    if (!client) return;
    setBusy('stop');
    setNote(null);
    try {
      const got = await client.orchestratorStop();
      take(got);
      onChanged?.(got);
    } catch (e) {
      setNote({ text: `${t.cantStop}: ${e instanceof Error ? e.message : String(e)}`, bad: true });
    } finally {
      setBusy(null);
      setAskStop(false);
      await load();
    }
  };

  const head = (
    <View style={s.top}>
      <View style={s.stateRow}>
        <Text style={s.h}>{t.orchestrator}</Text>
        {st ? (
          <View style={s.state} testID="agent-state">
            <StateDot s={statusDot(st)} />
            <Text style={s.stateText} numberOfLines={1}>
              {stateWord(st, t)}
              {st.state === 'running' && st.started_at ? (
                <Text style={s.dim}>{` · ${t.since} ${whenOf(st.started_at, lang)}`}</Text>
              ) : null}
            </Text>
          </View>
        ) : null}
      </View>
      {st?.halted ? (
        <Text style={s.warn} accessibilityRole="alert">
          <Text style={s.bold}>{haltTitle(st.halted.kind, t)}</Text>
          {st.halted.message ? ` · ${st.halted.message}` : ''} · {t.fixKey}
        </Text>
      ) : st?.crash_loop ? (
        <Text style={s.warn}>
          {t.crashLoop}
          {st.last_failure ? ` · ${failureWord(st.last_failure.kind, t)} ${whenOf(st.last_failure.at, lang)}` : ''}
        </Text>
      ) : st?.state === 'restarting' ? (
        <Text style={s.dimLine}>
          {t.restartingNow}
          {st.last_failure ? ` ${failureWord(st.last_failure.kind, t)} · ${whenOf(st.last_failure.at, lang)}` : ''}
          {st.error ? ` · ${st.error}` : ''}
        </Text>
      ) : null}
      {st ? (
        <View style={s.acts}>
          {running ? (
            <Button
              label={t.stop}
              onPress={() => setAskStop(true)}
              disabled={!!busy}
              busy={busy === 'stop'}
              testID="agent-stop"
            />
          ) : null}
          <Button
            label={busy === 'start' ? t.startingBusy : running ? t.restart : t.start}
            variant={running ? 'plain' : 'primary'}
            onPress={start}
            disabled={!!busy || !ready}
            busy={busy === 'start'}
            testID="agent-start"
          />
          {onOpenRoom ? <Button label={t.openInChat} variant="quiet" onPress={onOpenRoom} testID="agent-open-room" /> : null}
        </View>
      ) : null}
      {note ? (
        note.bad ? (
          <ErrorText>{note.text}</ErrorText>
        ) : (
          <Text style={s.dimLine} accessibilityLiveRegion="polite">
            {note.text}
          </Text>
        )
      ) : null}
      {st && !st.providers.length ? <Text style={s.dimLine}>{t.noProviders}</Text> : null}
      {st?.providers.length ? (
        <>
          <View style={s.modelHead}>
            <Text style={s.h}>{t.model}</Text>
            <Text style={[s.dim, s.flex]} numberOfLines={1}>
              {choice ? t.modelNow(modelName(choice.model)) : t.pickModel}
            </Text>
          </View>
          <Text style={s.dimLine}>
            {t.ownKey}
            {st.limits ? ` · ${st.limits.mem_mb} MB` : ''}
          </Text>
          {st.providers.length > 1 ? (
            <View style={s.provs} accessibilityRole="radiogroup" accessibilityLabel={t.provider}>
              {st.providers.map((p) => {
                const on = p.id === prov;
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setProv(p.id)}
                    style={({ pressed }) => [s.prov, pressed && s.pressed]}
                    testID={`agent-provider-${p.id}`}
                  >
                    <Text style={[s.provText, on && s.on]} numberOfLines={1}>
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View style={s.search}>
            <Glyph icon={Search} size={18} color={colors.inkDim} />
            <TextInput
              style={s.searchInput}
              value={q}
              onChangeText={setQ}
              placeholder={t.findModel}
              placeholderTextColor={colors.inkDim}
              selectionColor={colors.inkDim}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t.findModel}
              testID="agent-model-search"
            />
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <TallSheet title={t.agentLlm} sub={t.agentLlmAbout} closeLabel={t.close} onClose={onClose} testID="agent-sheet">
      <FlatList
        indicatorStyle="white"
        data={st?.providers.length ? models : []}
        keyExtractor={(m) => m}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={head}
        ListEmptyComponent={st?.providers.length ? <Text style={s.none}>{t.noModels}</Text> : null}
        contentContainerStyle={s.listPad}
        renderItem={({ item }) => {
          const on = !!choice && choice.provider_id === prov && choice.model === item;
          return (
            <Pressable
              onPress={() => pick(item)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [s.row, pressed && s.pressed]}
              testID={`agent-model-${item}`}
            >
              <Text style={[s.name, on && s.on]} numberOfLines={1}>
                {saving === item ? '…' : item}
              </Text>
              {on ? <Glyph icon={Check} size={18} color={colors.inkBright} /> : null}
            </Pressable>
          );
        }}
      />
      {askStop ? (
        <Dialog
          title={t.stopTitle}
          text={t.stopText}
          confirm={t.stop}
          danger
          onCancel={() => setAskStop(false)}
          onConfirm={stop}
        />
      ) : null}
    </TallSheet>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  top: { paddingHorizontal: gutter, paddingTop: space.xs, paddingBottom: space.sm, gap: 10 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
  h: { fontFamily: fonts.sansSemi, fontSize: type.body, color: colors.ink },
  state: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  stateText: { flexShrink: 1, fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  dim: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  dimLine: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 17, color: colors.inkDim },
  warn: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 17, color: colors.warn },
  bold: { fontFamily: fonts.sansSemi },
  acts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  modelHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingTop: space.sm,
    marginTop: space.xs,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  provs: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: colors.line, borderRadius: 6, overflow: 'hidden' },
  prov: { flexGrow: 1, minHeight: touch, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  provText: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  pressed: { backgroundColor: colors.hover },
  on: { fontFamily: fonts.sansSemi, color: colors.inkBright },
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
  listPad: { paddingBottom: space.xl },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: gutter,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  name: { flex: 1, minWidth: 0, fontFamily: fonts.sans, fontSize: type.body - 1, color: colors.ink },
  none: { paddingHorizontal: gutter, paddingTop: space.md, fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
});
