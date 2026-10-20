/**
 * Mount it to open it. The MCP server's tools, as the web app's Orchestrator
 * room lists them (GET /api/mcp/tools): by group, each with which of the
 * Orchestrator's agents may use it, what it does and its parameters, and a
 * search over all of that.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError, type WorkbenchClient } from '../api/client';
import type { McpCatalog, McpTool } from '../api/types';
import { findTools } from '../lib/orchestrator';
import type { OrchStrings } from '../lib/orchStrings';
import { colors, fonts, gutter, radius, space, touch, type } from '../theme/tokens';
import { Search } from './icons';
import { TallSheet } from './TallSheet';
import { ErrorText, Glyph, wrapAnywhere } from './ui';

export function McpSheet({
  client,
  t,
  onClose,
}: {
  client: WorkbenchClient | null;
  t: OrchStrings;
  onClose: () => void;
}) {
  const [cat, setCat] = useState<McpCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!client) return;
    let live = true;
    client.mcpTools().then(
      (got) => live && setCat(got),
      (e) => live && setError(e instanceof ApiError ? e.message : t.reasons.unreachable),
    );
    return () => {
      live = false;
    };
  }, [client, t]);

  const sections = useMemo(
    () => findTools(cat, q).map((g) => ({ title: g.name, data: g.tools })),
    [cat, q],
  );
  const agentName = (id: string) => cat?.agents.find((a) => a.id === id)?.name ?? id;

  return (
    <TallSheet
      title={t.mcpTools}
      sub={cat ? `${cat.version} · ${cat.count}` : t.mcpAbout}
      closeLabel={t.close}
      onClose={onClose}
      testID="mcp-sheet"
    >
      <View style={s.searchWrap}>
        <View style={s.search}>
          <Glyph icon={Search} size={18} color={colors.inkDim} />
          <TextInput
            testID="mcp-search"
            style={s.searchInput}
            value={q}
            onChangeText={setQ}
            placeholder={t.findTool}
            placeholderTextColor={colors.inkDim}
            selectionColor={colors.inkDim}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t.findTool}
          />
        </View>
        {error ? <ErrorText>{error}</ErrorText> : null}
      </View>
      {!cat && !error ? <ActivityIndicator style={s.wait} color={colors.inkDim} /> : null}
      {cat ? (
        <SectionList
          indicatorStyle="white"
          testID="mcp-list"
          sections={sections}
          keyExtractor={(tl) => tl.name}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={20}
          renderSectionHeader={({ section }) => <Text style={s.group}>{section.title}</Text>}
          renderItem={({ item }) => <ToolRow tool={item} agentName={agentName} />}
          ListEmptyComponent={<Text style={s.none}>{t.noTool}</Text>}
          contentContainerStyle={s.listPad}
        />
      ) : null}
    </TallSheet>
  );
}

function ToolRow({ tool, agentName }: { tool: McpTool; agentName: (id: string) => string }) {
  return (
    <View style={s.fn}>
      <View style={s.fnTop}>
        <Text style={[s.fnName, wrapAnywhere]}>{tool.name}</Text>
        {tool.agents.map((a) => (
          <Text key={a} style={s.tag}>
            {agentName(a)}
          </Text>
        ))}
      </View>
      {tool.description ? <Text style={s.desc}>{tool.description}</Text> : null}
      {tool.params.length ? (
        <View style={s.params}>
          {tool.params.map((p) => (
            <Text key={p.name} style={s.param}>
              <Text style={s.pName}>
                {p.name}
                {p.required ? '' : '?'}
              </Text>
              <Text style={s.pType}>{`  ${p.enum ? p.enum.join(' | ') : p.type}`}</Text>
              {p.description ? <Text>{`  ${p.description}`}</Text> : null}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  searchWrap: { paddingHorizontal: gutter, paddingTop: space.xs, paddingBottom: space.sm, gap: 8 },
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
  listPad: { paddingBottom: space.xl },
  group: {
    paddingHorizontal: gutter,
    paddingTop: space.md,
    paddingBottom: 4,
    fontFamily: fonts.sansSemi,
    fontSize: 11,
    letterSpacing: 0.3,
    color: colors.inkDim,
    textTransform: 'uppercase',
  },
  fn: {
    paddingHorizontal: gutter,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 3,
  },
  fnTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  fnName: { fontFamily: fonts.monoSemi, fontSize: type.small, color: colors.ink, marginRight: 2 },
  tag: {
    overflow: 'hidden',
    paddingHorizontal: 5,
    borderRadius: 4,
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.inkDim,
    backgroundColor: colors.hover,
  },
  desc: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 18, color: colors.inkDim },
  params: { gap: 2, marginTop: 2 },
  param: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 17, color: colors.ink },
  pName: { fontFamily: fonts.mono, fontSize: 11 },
  pType: { color: colors.inkDim },
  none: { paddingHorizontal: gutter, paddingTop: space.lg, fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
});
