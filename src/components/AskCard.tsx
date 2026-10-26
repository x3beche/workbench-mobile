/**
 * What OpenCode asks, as the web app's Chat shows it (opencode-sessions.ts
 * askTpl): a card with its state ("waiting for your answer" with the amber
 * dot, "answered from the Chat" / "on the computer", "no longer asked"),
 * then either its questions - each with its header, its text and its
 * options as buttons with their descriptions (checkboxes when several may
 * be chosen) and an "Other" field where OpenCode takes its own words - and
 * Answer; or a permission - what it would run, Allow once / Always allow /
 * Reject. Answered, the card shows what was chosen. A choice is shown by
 * ink and weight and a tick, never a fill.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { WboAnswer, WboAsk, WboField } from '../api/types';
import {
  answerOf,
  askState,
  choose,
  decisionWord,
  isReady,
  NO_CHOICE,
  optionsOf,
  setOther,
  shownAnswer,
  type Choice,
} from '../lib/wbo';
import type { WboStrings } from '../lib/wboStrings';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { Check } from './icons';
import { StateDot } from './StateDot';
import { Button, Glyph, wrapAnywhere } from './ui';

export function AskCard({
  a,
  t,
  canAnswer,
  busy,
  note,
  onAnswer,
}: {
  a: WboAsk;
  t: WboStrings;
  /** It is open and this account may answer it now. */
  canAnswer: boolean;
  /** An answer is on its way. */
  busy: boolean;
  /** Why it cannot be answered from here, while it is open. */
  note?: string | null;
  onAnswer: (a: WboAsk, body: WboAnswer) => void;
}) {
  const [c, setC] = useState<Choice>(NO_CHOICE);
  const open = a.status === 'pending' || a.status === 'answering';
  const submit = () => {
    if (canAnswer && !busy && isReady(a, c)) onAnswer(a, { answer: answerOf(a, c) });
  };
  return (
    <View style={s.card} accessibilityLabel={t.asks} testID={`ask-${a.id}`}>
      <View style={s.head}>
        {open ? <StateDot s="retry" size={8} /> : null}
        <Text style={s.title} numberOfLines={2}>
          {a.kind === 'permission' ? t.asksToRun(a.action || '') : t.asks}
        </Text>
        <Text style={s.state} testID="ask-state">
          {askState(a, t)}
        </Text>
      </View>
      {a.kind === 'form' ? (
        <>
          {(a.fields ?? []).map((f) => (
            <Question
              key={f.key}
              a={a}
              f={f}
              c={c}
              t={t}
              edit={canAnswer}
              onChoose={(v) => setC((now) => choose(now, f, v))}
              onOther={(v) => setC((now) => setOther(now, f, v))}
              onSubmit={submit}
            />
          ))}
          {canAnswer ? (
            <View style={s.acts}>
              <Button
                label={t.answer}
                variant="primary"
                onPress={submit}
                disabled={!isReady(a, c)}
                busy={busy}
                testID="ask-answer"
              />
              {a.error ? <Text style={s.err}>{a.error}</Text> : null}
            </View>
          ) : null}
        </>
      ) : (
        <>
          {a.resources?.length ? (
            <Text style={[s.res, wrapAnywhere]} selectable>
              {a.resources.join('\n')}
            </Text>
          ) : null}
          {canAnswer ? (
            <View style={s.acts}>
              <Button
                label={t.allowOnce}
                variant="primary"
                onPress={() => onAnswer(a, { decision: 'once' })}
                disabled={busy}
                testID="ask-once"
              />
              <Button
                label={t.alwaysAllow}
                onPress={() => onAnswer(a, { decision: 'always' })}
                disabled={busy}
                accessibilityLabel={a.save?.length ? `${t.alwaysAllow}. ${t.fromNowOn(a.save.join(', '))}` : undefined}
                testID="ask-always"
              />
              <Button
                label={t.reject}
                variant="danger"
                onPress={() => onAnswer(a, { decision: 'reject' })}
                disabled={busy}
                testID="ask-reject"
              />
              {a.save?.length ? <Text style={s.save}>{t.fromNowOn(a.save.join(', '))}</Text> : null}
              {a.error ? <Text style={s.err}>{a.error}</Text> : null}
            </View>
          ) : decisionWord(a, t) ? (
            <Text style={s.chosen} testID="ask-chosen">
              {decisionWord(a, t)}
            </Text>
          ) : null}
        </>
      )}
      {a.status === 'pending' && note ? <Text style={s.note}>{note}</Text> : null}
    </View>
  );
}

function Question({
  a,
  f,
  c,
  t,
  edit,
  onChoose,
  onOther,
  onSubmit,
}: {
  a: WboAsk;
  f: WboField;
  c: Choice;
  t: WboStrings;
  edit: boolean;
  onChoose: (v: string) => void;
  onOther: (v: string) => void;
  onSubmit: () => void;
}) {
  const opts = optionsOf(f);
  const many = f.type === 'multiselect';
  const picked = (v: string) => (c.picks[f.key] ?? []).includes(v);
  const shown = edit ? '' : shownAnswer(a, f);
  const num = f.type === 'number' || f.type === 'integer';
  return (
    <View style={s.q}>
      {f.title ? <Text style={s.qHead}>{f.title}</Text> : null}
      {f.description ? <Text style={[s.qText, wrapAnywhere]}>{f.description}</Text> : null}
      {edit ? (
        <>
          {opts.length ? (
            <View style={s.opts} accessibilityLabel={f.title || f.description}>
              {opts.map((o) => {
                const on = picked(o.value);
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => onChoose(o.value)}
                    accessibilityRole={many ? 'checkbox' : 'radio'}
                    accessibilityState={many ? { checked: on } : { selected: on }}
                    accessibilityLabel={o.description ? `${o.label}. ${o.description}` : o.label}
                    style={({ pressed }) => [s.opt, pressed && s.optPressed]}
                    testID={`ask-opt-${f.key}-${o.value}`}
                  >
                    <View style={[s.box, !many && s.radio]}>
                      {on ? <Glyph icon={Check} size={13} color={colors.inkBright} /> : null}
                    </View>
                    <View style={s.optText}>
                      <Text style={[s.optLabel, on && s.optOn]}>{o.label}</Text>
                      {o.description ? <Text style={s.optDesc}>{o.description}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {f.custom || (!opts.length && f.type !== 'boolean') ? (
            <TextInput
              style={s.other}
              value={c.others[f.key] ?? ''}
              onChangeText={onOther}
              onSubmitEditing={onSubmit}
              placeholder={opts.length ? t.other : t.yourAnswer}
              placeholderTextColor={colors.inkDim}
              selectionColor={colors.inkDim}
              accessibilityLabel={opts.length ? t.other : t.yourAnswer}
              keyboardType={num ? 'numeric' : 'default'}
              returnKeyType="done"
              testID={`ask-other-${f.key}`}
            />
          ) : null}
        </>
      ) : shown ? (
        <Text style={s.chosen} testID="ask-chosen">
          {shown}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    gap: space.sm + 2,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { flexShrink: 1, fontFamily: fonts.sansSemi, fontSize: type.small, color: colors.inkBright },
  state: { marginLeft: 'auto', fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  q: { gap: 6 },
  qHead: { fontFamily: fonts.sansMedium, fontSize: type.small, color: colors.ink },
  qText: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 20, color: colors.ink },
  opts: { gap: 2 },
  opt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  optPressed: { backgroundColor: colors.hover },
  box: {
    width: 18,
    height: 18,
    marginTop: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.inkDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: { borderRadius: 9 },
  optText: { flex: 1, minWidth: 0, gap: 2 },
  optLabel: { fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  optOn: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  optDesc: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 17, color: colors.inkDim },
  other: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    fontFamily: fonts.sans,
    fontSize: type.small,
    color: colors.ink,
  },
  acts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  res: {
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    fontFamily: fonts.mono,
    fontSize: type.tiny,
    lineHeight: 18,
    color: colors.ink,
  },
  chosen: { fontFamily: fonts.sansSemi, fontSize: type.small, color: colors.inkBright },
  save: { flexBasis: '100%', fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  err: { flexBasis: '100%', fontFamily: fonts.sans, fontSize: type.tiny, color: colors.danger },
  note: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 17, color: colors.inkDim },
});
