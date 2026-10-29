/** A chat answer drawn from its Markdown (lib/markdown.ts), in the web chat's type. */
import { memo, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { copy } from '../lib/feel';
import { parseMarkdown, type Block, type Inline } from '../lib/markdown';
import { colors, fonts, radius, type } from '../theme/tokens';
import { Check, Copy } from './icons';
import { Glyph, wrapAnywhere } from './ui';

/** A code block: its language and a Copy button above, the code scrolling sideways below. */
function Code({ lang, text }: { lang: string; text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <View style={s.pre}>
      <View style={s.preHead}>
        <Text style={s.lang}>{lang || 'code'}</Text>
        <Pressable
          testID="copy-code"
          onPress={() => copy(text).then(setCopied)}
          accessibilityRole="button"
          accessibilityLabel={copied ? 'Copied' : 'Copy the code'}
          hitSlop={10}
          style={s.copy}
        >
          {({ pressed }) => (
            <>
              <Glyph icon={copied ? Check : Copy} size={14} color={pressed ? colors.ink : colors.inkDim} />
              <Text style={[s.copyText, pressed && s.copyPressed]}>{copied ? 'Copied' : 'Copy'}</Text>
            </>
          )}
        </Pressable>
      </View>
      <ScrollView horizontal contentContainerStyle={s.preIn} showsHorizontalScrollIndicator={false}>
        <Text style={s.preText}>{text}</Text>
      </ScrollView>
    </View>
  );
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.kind) {
          case 'text':
            return n.text;
          case 'code':
            return (
              <Text key={i} style={s.inlineCode}>
                {n.text}
              </Text>
            );
          case 'strong':
            return (
              <Text key={i} style={s.strong}>
                <Inlines nodes={n.children} />
              </Text>
            );
          case 'em':
            return (
              <Text key={i} style={s.em}>
                <Inlines nodes={n.children} />
              </Text>
            );
          case 'link':
            return (
              <Text
                key={i}
                style={s.link}
                accessibilityRole="link"
                onPress={() => Linking.openURL(n.href).catch(() => undefined)}
              >
                <Inlines nodes={n.children} />
              </Text>
            );
        }
      })}
    </>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case 'heading':
      return (
        <Text style={[s.p, s.heading, b.level <= 2 && s.headingBig]} accessibilityRole="header">
          <Inlines nodes={b.children} />
        </Text>
      );
    case 'paragraph':
      return (
        <Text style={[s.p, wrapAnywhere]}>
          <Inlines nodes={b.children} />
        </Text>
      );
    case 'code':
      return <Code lang={b.lang} text={b.text} />;
    case 'table':
      return (
        <ScrollView horizontal style={s.table} contentContainerStyle={s.preIn} showsHorizontalScrollIndicator={false}>
          <Text style={s.preText}>{b.text}</Text>
        </ScrollView>
      );
    case 'list':
      return (
        <View style={s.list}>
          {b.items.map((item, i) => (
            <View key={i} style={s.item}>
              <Text style={[s.p, s.marker]}>{b.ordered ? `${b.start + i}.` : '•'}</Text>
              <Text style={[s.p, s.itemText, wrapAnywhere]}>
                <Inlines nodes={item} />
              </Text>
            </View>
          ))}
        </View>
      );
    case 'quote':
      return (
        <Text style={[s.p, s.quote]}>
          <Inlines nodes={b.children} />
        </Text>
      );
    case 'rule':
      return <View style={s.rule} />;
  }
}

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <View style={s.root}>
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} />
      ))}
    </View>
  );
});

const s = StyleSheet.create({
  root: { gap: 12 },
  p: { fontFamily: fonts.sans, fontSize: type.body, lineHeight: type.bodyLine, color: colors.ink },
  heading: { fontFamily: fonts.sansSemi, marginTop: 4 },
  headingBig: { fontSize: type.title },
  strong: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  em: { fontFamily: fonts.sansItalic },
  link: { color: colors.inkBright, textDecorationLine: 'underline' },
  inlineCode: { fontFamily: fonts.mono, fontSize: type.small, color: colors.ink, backgroundColor: colors.surface2 },
  pre: { borderRadius: radius.lg + 2, backgroundColor: colors.surface2, overflow: 'hidden' },
  preHead: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  lang: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingHorizontal: 4 },
  copyText: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  copyPressed: { color: colors.ink },
  table: { borderRadius: radius.lg, backgroundColor: colors.surface2 },
  preIn: { paddingHorizontal: 12, paddingVertical: 10 },
  preText: { fontFamily: fonts.mono, fontSize: type.small, lineHeight: type.smallLine, color: colors.ink },
  list: { gap: 4 },
  item: { flexDirection: 'row', gap: 8 },
  marker: { minWidth: 16, color: colors.inkDim },
  itemText: { flex: 1 },
  // A quote reads as quieter text, not as a coloured stripe.
  quote: { color: colors.inkDim, fontFamily: fonts.sansItalic, paddingLeft: 12 },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
});
