/** One line of a conversation, drawn as the web chat draws it (styles.css, .tcv-cc-msg). */
import { memo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatMessage } from '../api/types';
import type { Writing } from '../lib/answer';
import { clock } from '../lib/time';
import { colors, fonts, radius, type } from '../theme/tokens';
import { Markdown } from './Markdown';

function Thinking({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <Text style={s.thinkHead}>{open ? 'Hide thinking' : 'Show thinking'}</Text>
      {open ? <Text style={s.think}>{text}</Text> : null}
    </Pressable>
  );
}

export const MessageItem = memo(function MessageItem({ m, mine }: { m: ChatMessage; mine: boolean }) {
  if (m.role === 'user') {
    return (
      <View style={[s.msg, s.user]}>
        <Text style={[s.who, s.whoRight]}>
          {mine ? '' : `${m.by?.name || 'Someone'}  `}
          {clock(m.at)}
        </Text>
        <View style={s.bubble}>
          <Text style={s.userText} selectable>
            {m.content}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={s.msg}>
      <Text style={s.who}>
        <Text style={s.whoName}>{m.model || 'Answer'}</Text>
        {'  '}
        {clock(m.at)}
      </Text>
      {m.thinking ? <Thinking text={m.thinking} /> : null}
      {m.content ? <Markdown text={m.content} /> : null}
      {m.error ? <Text style={s.error}>{m.error}</Text> : null}
      {m.stopped ? <Text style={s.note}>Stopped</Text> : null}
      {m.interrupted ? <Text style={s.note}>Interrupted: the server restarted while this was written.</Text> : null}
    </View>
  );
});

/** The answer being written, as far as it got. */
export function WritingItem({ w, model }: { w: Writing; model?: string }) {
  return (
    <View style={s.msg} accessibilityLiveRegion="polite">
      <View style={s.writingHead}>
        <Text style={s.who}>
          <Text style={s.whoName}>{model || 'Answer'}</Text>
          {'  '}
          {w.error ? 'failed' : 'writing'}
        </Text>
        {!w.error ? <ActivityIndicator size="small" color={colors.inkDim} /> : null}
      </View>
      {w.thinking && !w.text ? <Text style={s.think} numberOfLines={4}>{w.thinking}</Text> : null}
      {w.text ? <Markdown text={w.text} /> : null}
      {w.error ? <Text style={s.error}>{w.error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  msg: { gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  user: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '88%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.accentDeep,
    borderWidth: 1,
    borderColor: colors.accent,
    borderTopLeftRadius: radius.bubble,
    borderTopRightRadius: radius.bubble,
    borderBottomLeftRadius: radius.bubble,
    borderBottomRightRadius: 2,
  },
  userText: { fontFamily: fonts.sans, fontSize: type.body, lineHeight: type.bodyLine, color: colors.ink },
  who: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  whoRight: { textAlign: 'right' },
  whoName: { fontFamily: fonts.mono, color: colors.ink },
  writingHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thinkHead: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim, textDecorationLine: 'underline' },
  think: { fontFamily: fonts.sansItalic, fontSize: type.tiny + 0.5, lineHeight: 18, color: colors.inkDim, marginTop: 4 },
  error: { fontFamily: fonts.sans, fontSize: type.small, color: colors.danger },
  note: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
});
