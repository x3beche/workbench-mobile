/** A chat answer drawn from its Markdown (lib/markdown.ts), in the web chat's type. */
import { memo, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { copy } from '../lib/feel';
import { parseMarkdown, type Block, type Inline } from '../lib/markdown';
import { colors, fonts, radius, type } from '../theme/tokens';
import { Check, ChevronRight, Copy } from './icons';
import { Glyph, wrapAnywhere } from './ui';

/**
 * A box wider than the phone: code, a table. It scrolls sideways - and says
 * so, with a chevron at the edge it runs off, until the reader reaches that
 * edge. Without it a wide table just looked cut off.
 */
function Sideways({ style, hint, children }: { style?: object; hint: string; children: React.ReactNode }) {
  const [box, setBox] = useState(0);
  const [content, setContent] = useState(0);
  const [at, setAt] = useState(0);
  const runsOff = content > box + 2 && at + box < content - 2;
  return (
    <View style={style}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityHint={hint}
        onLayout={(e) => setBox(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setContent(w)}
        onScroll={(e) => setAt(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
        contentContainerStyle={s.preIn}
      >
        {children}
      </ScrollView>
      {runsOff ? (
        <View style={s.moreMark} pointerEvents="none" testID="sideways-more">
          <Glyph icon={ChevronRight} size={13} color={colors.inkDim} />
        </View>
      ) : null}
    </View>
  );
}

/** What the pieces of a page say - a code block's tag and Copy button, the
 *  hint of a box that runs off the edge - so a caller can put them in the
 *  reader's language. English until it does. */
export interface MarkdownWords {
  code: string;
  copy: string;
  copied: string;
  copyCode: string;
  sidewaysCode: string;
  sidewaysTable: string;
}

export const MARKDOWN_WORDS: MarkdownWords = {
  code: 'code',
  copy: 'Copy',
  copied: 'Copied',
  copyCode: 'Copy the code',
  sidewaysCode: 'The rest of the code is to the right: swipe sideways.',
  sidewaysTable: 'The rest of the table is to the right: swipe sideways.',
};

/** A code block: its language and a Copy button above, the code scrolling sideways below. */
function Code({ lang, text, words }: { lang: string; text: string; words: MarkdownWords }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <View style={s.pre}>
      <View style={s.preHead}>
        <Text style={s.lang}>{lang || words.code}</Text>
        <Pressable
          testID="copy-code"
          onPress={() => copy(text).then(setCopied)}
          accessibilityRole="button"
          accessibilityLabel={copied ? words.copied : words.copyCode}
          hitSlop={10}
          style={s.copy}
        >
          {({ pressed }) => (
            <>
              <Glyph icon={copied ? Check : Copy} size={14} color={pressed ? colors.ink : colors.inkDim} />
              <Text style={[s.copyText, pressed && s.copyPressed]}>{copied ? words.copied : words.copy}</Text>
            </>
          )}
        </Pressable>
      </View>
      <Sideways hint={words.sidewaysCode}>
        <Text style={s.preText}>{text}</Text>
      </Sideways>
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

function BlockView({ b, words }: { b: Block; words: MarkdownWords }) {
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
      return <Code lang={b.lang} text={b.text} words={words} />;
    case 'table':
      return (
        <Sideways style={s.table} hint={words.sidewaysTable}>
          <Text style={s.preText}>{b.text}</Text>
        </Sideways>
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

export const Markdown = memo(function Markdown({
  text,
  words = MARKDOWN_WORDS,
}: {
  text: string;
  /** In the reader's language, when the caller has it. */
  words?: MarkdownWords;
}) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  return (
    <View style={s.root}>
      {blocks.map((b, i) => (
        <BlockView key={i} b={b} words={words} />
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
  table: { borderRadius: radius.lg, backgroundColor: colors.surface2, overflow: 'hidden' },
  // The chevron at the edge something runs off: the page is wider than the phone.
  moreMark: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingLeft: 6,
    borderRadius: radius.round,
  },
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
