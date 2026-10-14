/** A chat answer drawn from its Markdown (lib/markdown.ts), in the web chat's type. */
import { memo, useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { parseMarkdown, type Block, type Inline } from '../lib/markdown';
import { colors, fonts, radius, type } from '../theme/tokens';

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
        <Text style={s.p} selectable>
          <Inlines nodes={b.children} />
        </Text>
      );
    case 'code':
    case 'table':
      return (
        <ScrollView horizontal style={s.pre} contentContainerStyle={s.preIn} showsHorizontalScrollIndicator={false}>
          <Text style={s.preText} selectable>
            {b.text}
          </Text>
        </ScrollView>
      );
    case 'list':
      return (
        <View style={s.list}>
          {b.items.map((item, i) => (
            <View key={i} style={s.item}>
              <Text style={[s.p, s.marker]}>{b.ordered ? `${b.start + i}.` : '•'}</Text>
              <Text style={[s.p, s.itemText]} selectable>
                <Inlines nodes={item} />
              </Text>
            </View>
          ))}
        </View>
      );
    case 'quote':
      return (
        <Text style={[s.p, s.quote]} selectable>
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
  root: { gap: 8 },
  p: { fontFamily: fonts.sans, fontSize: type.body, lineHeight: type.bodyLine, color: colors.ink },
  heading: { fontFamily: fonts.sansSemi, marginTop: 4 },
  headingBig: { fontSize: type.title },
  strong: { fontFamily: fonts.sansSemi, color: colors.inkBright },
  em: { fontFamily: fonts.sansItalic },
  link: { color: colors.inkBright, textDecorationLine: 'underline' },
  inlineCode: { fontFamily: fonts.mono, fontSize: type.small, color: colors.ink, backgroundColor: colors.surface2 },
  pre: { borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  preIn: { paddingHorizontal: 10, paddingVertical: 8 },
  preText: { fontFamily: fonts.mono, fontSize: type.tiny + 0.5, lineHeight: 19, color: colors.ink },
  list: { gap: 4 },
  item: { flexDirection: 'row', gap: 8 },
  marker: { minWidth: 16, color: colors.inkDim },
  itemText: { flex: 1 },
  // A quote reads as quieter text, not as a coloured stripe.
  quote: { color: colors.inkDim, fontFamily: fonts.sansItalic, paddingLeft: 12 },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
});
