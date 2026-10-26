/**
 * One line of a conversation. The person's lines are rounded bubbles on the
 * right; answers run the full width without one, under the model's name,
 * with the tools they ran as compact rows where they ran. A long press opens
 * the line's actions (Copy, Select text).
 *
 * How much of an answer's work is shown is the Chat's detail (Settings >
 * Chat; lib/chatDetail.ts): compact puts the thinking and the tool calls
 * behind one line under an answer, normal folds the thinking and gives each
 * tool call its row, and detailed opens both.
 */
import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatDetail, ChatMessage, Step } from '../api/types';
import type { Writing } from '../lib/answer';
import { activityWords, chatDetailStrings, type ChatDetailStrings } from '../lib/chatDetail';
import { useSmoothText } from '../lib/drain';
import { chunks, stepDetail, stepLabel, stepState } from '../lib/steps';
import { clock } from '../lib/time';
import { colors, fonts, gutter, motion, radius, space, type } from '../theme/tokens';
import { Appear } from './Appear';
import { Check, ChevronDown, ChevronRight, CircleAlert, Square } from './icons';
import { Markdown } from './Markdown';
import { useReduceMotion } from './motion';
import { Glyph, wrapAnywhere } from './ui';

/** A model id as a person reads it: "anthropic/claude-sonnet-4.5" -> "claude-sonnet-4.5". */
export function modelName(id: string | undefined): string {
  if (!id) return '';
  return id.includes('/') ? id.slice(id.lastIndexOf('/') + 1) : id;
}

/** More steps than this in one place fold into a "Ran N tools" row. */
const FOLD_STEPS = 3;

/** The answer's thinking, folded; `words` for another language (OpenCode
 *  sessions), and `open` for a Chat set to detailed (Settings > Chat). */
export function Thinking({
  text,
  live,
  words,
  open: startOpen,
}: {
  text: string;
  live?: boolean;
  words?: { live: string; done: string };
  open?: boolean;
}) {
  // `open` is where the row starts: a Chat set to detailed opens it, and a tap
  // from there closes it again - the callers key the row by the setting, so a
  // change of the setting draws it the new way.
  const [open, setOpen] = useState(!!startOpen);
  if (!text.trim()) return null;
  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={s.thinkWrap}
    >
      <View style={s.stepRow}>
        <Glyph icon={open ? ChevronDown : ChevronRight} size={14} color={colors.inkDim} />
        <Text style={s.stepText}>{live ? (words?.live ?? 'Thinking') : (words?.done ?? 'Thought it through')}</Text>
      </View>
      {open ? (
        <Text style={s.think}>{text}</Text>
      ) : live ? (
        <Text style={s.think} numberOfLines={3}>
          {text.slice(-400)}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** One tool call: its sentence, and what it gave back when opened (always
 *  open in a Chat set to detailed). */
function StepRow({ step, open: startOpen }: { step: Step; open?: boolean }) {
  const [open, setOpen] = useState(!!startOpen);
  const state = stepState(step);
  const detail = stepDetail(step);
  const mark =
    state === 'running' ? (
      <ActivityIndicator size="small" color={colors.inkDim} style={s.spin} />
    ) : state === 'failed' ? (
      <Glyph icon={CircleAlert} size={14} color={colors.danger} />
    ) : state === 'stopped' ? (
      <Glyph icon={Square} size={12} color={colors.inkDim} />
    ) : (
      <Glyph icon={Check} size={14} color={colors.inkDim} />
    );
  return (
    <Pressable
      testID={`step-${step.id}`}
      onPress={() => detail && setOpen((v) => !v)}
      disabled={!detail}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={s.step}
    >
      <View style={s.stepRow}>
        <View style={s.mark}>{mark}</View>
        <Text style={s.stepText} numberOfLines={1}>
          {stepLabel(step)}
        </Text>
        {detail ? <Glyph icon={open ? ChevronDown : ChevronRight} size={14} color={colors.inkDim} /> : null}
      </View>
      {open ? <Text style={s.stepDetail}>{detail}</Text> : null}
    </Pressable>
  );
}

/** The tools that ran in one place, folded into one row when there are many;
 *  `ran` says it in another language, and `detail` opens each row's body
 *  (and keeps them apart) for a Chat set to detailed. */
export function Steps({
  steps,
  ran,
  detail = 'normal',
}: {
  steps: Step[];
  ran?: (n: number, failed: number) => string;
  detail?: ChatDetail;
}) {
  const openAll = detail === 'detailed';
  const running = steps.some((x) => stepState(x) === 'running');
  const [open, setOpen] = useState(false);
  if (steps.length <= FOLD_STEPS || running || open || openAll) {
    return (
      <View style={s.steps}>
        {steps.map((x) => (
          <StepRow key={`${x.id}:${openAll ? 'open' : 'folded'}`} step={x} open={openAll} />
        ))}
      </View>
    );
  }
  const failed = steps.filter((x) => stepState(x) === 'failed').length;
  return (
    <Pressable
      onPress={() => setOpen(true)}
      accessibilityRole="button"
      accessibilityState={{ expanded: false }}
      style={s.step}
    >
      <View style={s.stepRow}>
        <View style={s.mark}>
          <Glyph icon={failed ? CircleAlert : Check} size={14} color={failed ? colors.danger : colors.inkDim} />
        </View>
        <Text style={s.stepText}>
          {ran ? ran(steps.length, failed) : `Ran ${steps.length} tools${failed ? `, ${failed} failed` : ''}`}
        </Text>
        <Glyph icon={ChevronRight} size={14} color={colors.inkDim} />
      </View>
    </Pressable>
  );
}

/** The answer's text with its tools where they ran. */
function Body({ text, steps, detail }: { text: string; steps?: Step[]; detail?: ChatDetail }) {
  return (
    <>
      {chunks(text, steps).map((c, i) =>
        c.kind === 'text' ? (
          <Markdown key={`t${i}`} text={c.text} />
        ) : (
          <Steps key={`s${i}:${detail}`} steps={c.steps} detail={detail} />
        ),
      )}
    </>
  );
}

/**
 * Everything an answer did - the thinking and the tool rows - behind one line
 * under the answer, opened by a tap (Settings > Chat: compact). The line says
 * what it was: "4 tool calls · thought 8.9 s".
 */
export function CompactWork({
  tools,
  thinking,
  ms,
  dw,
  children,
}: {
  tools: number;
  /** The characters of thinking, for the line when how long it took is not known. */
  thinking: number;
  ms?: number | null;
  dw: ChatDetailStrings;
  /** What it was, drawn when the line is opened. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={s.step}
        testID="compact-work"
      >
        <View style={s.stepRow}>
          <Glyph icon={open ? ChevronDown : ChevronRight} size={14} color={colors.inkDim} />
          <Text style={s.stepText} numberOfLines={1}>
            {activityWords(tools, thinking, ms, dw.act)}
          </Text>
        </View>
      </Pressable>
      {open ? children : null}
    </>
  );
}

function Head({ model, at }: { model?: string; at?: string }) {
  return (
    <Text style={s.head} numberOfLines={1}>
      <Text style={s.headName}>{modelName(model) || 'Answer'}</Text>
      {at ? `  ${clock(at)}` : ''}
    </Text>
  );
}

export const MessageItem = memo(function MessageItem({
  m,
  mine,
  animate,
  onMenu,
  detail = 'normal',
  dw,
}: {
  m: ChatMessage;
  mine: boolean;
  /** It came while the conversation was open: it fades in. */
  animate?: boolean;
  onMenu?: (m: ChatMessage) => void;
  /** How much of the answer's work to show (Settings > Chat; lib/chatDetail.ts). */
  detail?: ChatDetail;
  /** The detail setting's words; English when the caller does not say. */
  dw?: ChatDetailStrings;
}) {
  const words = dw ?? chatDetailStrings('en');
  const body =
    m.role === 'user' ? (
      <View style={[s.msg, s.user]}>
        {!mine ? <Text style={[s.head, s.headRight]}>{m.by?.name || 'Someone'}</Text> : null}
        <Pressable
          onLongPress={onMenu ? () => onMenu(m) : undefined}
          delayLongPress={350}
          accessibilityHint="Long press to copy"
          style={s.bubble}
        >
          <Text style={[s.userText, wrapAnywhere]}>{m.content}</Text>
        </Pressable>
      </View>
    ) : (
      <Pressable
        onLongPress={onMenu ? () => onMenu(m) : undefined}
        delayLongPress={350}
        accessibilityHint="Long press to copy"
        style={s.msg}
      >
        <Head model={m.model} at={m.at} />
        {detail === 'compact' ? (
          <>
            {m.thinking || m.steps?.length ? (
              <CompactWork
                tools={m.steps?.length ?? 0}
                thinking={m.thinking?.length ?? 0}
                ms={m.thinking_ms}
                dw={words}
              >
                {m.thinking ? (
                  <Thinking key="think:opened" text={m.thinking} open words={words.thinking} />
                ) : null}
                {m.steps?.length ? (
                  <Steps key="steps:opened" steps={m.steps} detail="detailed" ran={words.ran} />
                ) : null}
              </CompactWork>
            ) : null}
            <Markdown text={m.content || ''} />
          </>
        ) : (
          <>
            {m.thinking ? (
              <Thinking
                key={`think:${detail}`}
                text={m.thinking}
                open={detail === 'detailed'}
                words={words.thinking}
              />
            ) : null}
            <Body text={m.content || ''} steps={m.steps} detail={detail} />
          </>
        )}
        {m.error ? <Text style={s.error}>{m.error}</Text> : null}
        {m.stopped ? <Text style={s.note}>Stopped</Text> : null}
        {m.interrupted ? <Text style={s.note}>Interrupted: the server restarted while this was written.</Text> : null}
      </Pressable>
    );
  if (!animate) return body;
  return (
    <Appear fill={false} from={m.role === 'user' ? 'below' : 'none'} duration={motion.fade}>
      {body}
    </Appear>
  );
});

/** The person's line, shown at once while it is on its way to the server. */
export function PendingItem({ text }: { text: string }) {
  return (
    <Appear fill={false} from="below" duration={motion.fade}>
      <View style={[s.msg, s.user]} testID="pending-line">
        <View style={[s.bubble, s.pending]}>
          <Text style={[s.userText, wrapAnywhere]}>{text}</Text>
        </View>
      </View>
    </Appear>
  );
}

/** Three dots breathing while the first words are awaited (still, under reduced motion). */
export function TypingDots() {
  const reduce = useReduceMotion();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [t, reduce]);
  return (
    <View style={s.dots} testID="typing" accessibilityLabel="Writing the answer" accessibilityLiveRegion="polite">
      {[0, 1, 2].map((i) => {
        const opacity = reduce
          ? 0.6
          : t.interpolate({
              inputRange: [0, 0.2 + i * 0.2, 0.4 + i * 0.2, 1],
              outputRange: [0.3, 1, 0.3, 0.3],
              extrapolate: 'clamp',
            });
        return <Animated.View key={i} style={[s.dot, { opacity }]} />;
      })}
    </View>
  );
}

/** The answer being written, as far as it got: laid out as the finished answer will be, so nothing jumps when it lands. */
export function WritingItem({
  w,
  model,
  detail = 'normal',
  dw,
}: {
  w: Writing;
  model?: string;
  /** How much of the answer's work to show (Settings > Chat; lib/chatDetail.ts). */
  detail?: ChatDetail;
  dw?: ChatDetailStrings;
}) {
  const reduce = useReduceMotion();
  const words = dw ?? chatDetailStrings('en');
  const waiting = !w.text && !w.thinking && !w.steps.length && !w.error;
  // The words arrive in the server's pieces; they are let out smoothly.
  const text = useSmoothText(w.text, !reduce);
  const work = (open: boolean) => (
    <>
      {w.thinking ? (
        <Thinking
          key={`think:${open ? 'open' : detail}`}
          text={w.thinking}
          live={!w.text}
          open={open}
          words={words.thinking}
        />
      ) : null}
      {w.steps.length ? (
        <Steps
          key={`steps:${open ? 'detailed' : detail}`}
          steps={w.steps}
          detail={open ? 'detailed' : detail}
          ran={words.ran}
        />
      ) : null}
    </>
  );
  return (
    <View style={s.msg} accessibilityLiveRegion="polite" testID="writing">
      <Head model={model} />
      {detail === 'compact' ? (
        <>
          {w.thinking || w.steps.length ? (
            <CompactWork tools={w.steps.length} thinking={w.thinking.length} dw={words}>
              {work(true)}
            </CompactWork>
          ) : null}
          {w.text ? <Body text={text} /> : waiting ? <TypingDots /> : null}
        </>
      ) : (
        <>
          {waiting ? <TypingDots /> : null}
          {work(detail === 'detailed')}
          <Body text={text} detail={detail} />
        </>
      )}
      {w.error ? <Text style={s.error}>{w.error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  msg: { gap: 10, paddingHorizontal: gutter, paddingVertical: space.md },
  user: { alignItems: 'flex-end', gap: 4, paddingVertical: space.sm },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface2,
    borderRadius: radius.bubble,
    borderBottomRightRadius: 6,
  },
  pending: { opacity: 0.7 },
  userText: { fontFamily: fonts.sans, fontSize: type.body, lineHeight: type.bodyLine, color: colors.ink },
  head: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  headRight: { textAlign: 'right' },
  headName: { fontFamily: fonts.sansMedium, color: colors.inkDim },
  thinkWrap: { gap: 6 },
  think: {
    fontFamily: fonts.sansItalic,
    fontSize: type.small,
    lineHeight: 20,
    color: colors.inkDim,
    paddingLeft: 22,
  },
  steps: { gap: 2 },
  step: { gap: 4 },
  stepRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 14, alignItems: 'center' },
  spin: { transform: [{ scale: 0.7 }] },
  stepText: { flexShrink: 1, fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  stepDetail: {
    paddingLeft: 22,
    paddingBottom: 4,
    fontFamily: fonts.sans,
    fontSize: type.tiny,
    lineHeight: 18,
    color: colors.inkDim,
  },
  dots: { flexDirection: 'row', gap: 5, height: type.bodyLine, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.ink },
  error: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: 20, color: colors.danger },
  note: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
});
