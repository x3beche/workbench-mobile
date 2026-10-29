/**
 * What the home screen widget draws, worked out once from the two routes the
 * Analytics screen reads - GET /api/llm/summary and GET /api/cc/tools-usage -
 * counted the way the web Chat tab's cards count them (cc-usage.ts CcUsageLine
 * and cc-tools.ts CcToolsLine): the models' month and their 14 days by
 * provider, the tools' week and their 14 days by source.
 *
 * Numbers only - no colours and no words: the widget wears the theme and the
 * language it is drawn in, and reads neither from here.
 */
import type { CcToolInfo, ExtToolUses, LlmSummary, ToolsUsage } from '../api/types';

/** Days under each card, the count the web card's chart draws. */
export const WIDGET_DAYS = 14;

export interface WidgetSnapshot {
  /** When this reading was taken (ms). */
  at: number;
  models: {
    /** This month's tokens and calls, as the card's large figure and its second. */
    tokens: number;
    calls: number;
    /** One row a day, one number a series (the providers, in the server's order). */
    days: number[][];
  };
  tools: {
    /** Tool calls this week, all three sources together. */
    week: number;
    /** How many different tools were used this week. */
    kinds: number;
    /** The tools the model may use with this person's lines, and how many are on - the web head's 88/298. */
    on: number;
    total: number;
    /** One row a day: the Chat, Claude Code, OpenCode. */
    days: number[][];
  };
}

const total = (by: Record<string, number> | undefined) => Object.values(by ?? {}).reduce((a, n) => a + n, 0);

/** An outside source's week: each of its tools' own week, summed. */
const extWeek = (x: ExtToolUses | null | undefined) =>
  x ? Object.values(x.tools).reduce((a, v) => a + v.week, 0) : 0;

/** A day's tokens by provider, or the day's whole count when the server names no providers. */
export function modelDays(summary: LlmSummary): number[][] {
  const provs = summary.providers?.length
    ? summary.providers
    : [...new Set(summary.by_day.flatMap((x) => Object.keys(x.by ?? {})))].map((id) => ({ id }));
  return summary.by_day
    .slice(-WIDGET_DAYS)
    .map((d) => (provs.length ? provs.map((p) => d.by?.[p.id] ?? 0) : [d.tokens]));
}

/** A day's tool calls: the Chat's, then the person's own Claude Code's and OpenCode's. */
export function toolDays(u: ToolsUsage): number[][] {
  const ext = u.external;
  return u.days
    .slice(-WIDGET_DAYS)
    .map((d) => [total(d.by), total(ext?.claude?.days[d.day]), total(ext?.opencode?.days[d.day])]);
}

/** Every tool used this week, of any source, counted once. */
export function toolKinds(u: ToolsUsage): number {
  const weeks = [
    ...Object.values(u.tools).map((v) => v.week),
    ...Object.values(u.external?.claude?.tools ?? {}).map((v) => v.week),
    ...Object.values(u.external?.opencode?.tools ?? {}).map((v) => v.week),
  ];
  return weeks.filter((w) => w > 0).length;
}

/** The week's calls, the Chat's and the person's own together. */
export function toolWeek(u: ToolsUsage): number {
  return (
    Object.values(u.tools).reduce((a, v) => a + v.week, 0) +
    extWeek(u.external?.claude) +
    extWeek(u.external?.opencode)
  );
}

/** The tools the model may use, and how many of them are on for this person. */
export function toolSwitchboard(list: { on: boolean }[] | null | undefined): { on: number; total: number } {
  if (!list?.length) return { on: 0, total: 0 };
  return { on: list.filter((x) => x.on).length, total: list.length };
}

export function snapshotOf(
  summary: LlmSummary,
  tools: ToolsUsage,
  /** GET /api/cc/tools, when it could be read: the head's "88/298". */
  catalogue: CcToolInfo[] | null = null,
  at = Date.now(),
): WidgetSnapshot {
  const switchboard = toolSwitchboard(catalogue);
  return {
    at,
    models: { tokens: summary.month.tokens, calls: summary.month.calls, days: modelDays(summary) },
    tools: { week: toolWeek(tools), kinds: toolKinds(tools), ...switchboard, days: toolDays(tools) },
  };
}
