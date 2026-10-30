/**
 * Settings > Orchestrator: one's own Orchestrator as a dashboard, the same
 * answer the web's Settings > Orchestrator reads
 * (GET /api/me/orchestrator/overview, backend/orchestrator/overview.py) - its
 * state and Start / Stop, the figures (up for, restarts today, memory, the
 * tokens of today and the week, what is busy, the last incident), what it
 * handed to its agents, and the incidents it kept. The owner and the admins
 * get every Orchestrator on the server and every incident below it; the
 * server answers 403 for anyone else, and then the section is not drawn.
 *
 * The model it runs on is not drawn twice: this page's model row opens the
 * sheet that already picks it (AgentSheet, Settings > AI's row).
 *
 * Its state is read again when the account's bus says it changed (kind
 * `orch`, through S2); without the bus every 20 s, and never while the app is
 * in the background.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ApiError, WorkbenchClient } from '../../api/client';
import type { OrchStatus } from '../../api/types';
import { SettingsGroup, SettingsPage, SettingsRow } from '../../components/SettingsList';
import { StateDot } from '../../components/StateDot';
import { Button, ErrorText } from '../../components/ui';
import { inFront } from '../../live/hub';
import { useBus, useLive } from '../../live/LiveContext';
import { stateWord, statusDot, whenOf, failureWord, haltTitle } from '../../lib/orchestrator';
import type { OrchStrings } from '../../lib/orchStrings';
import { colors, fonts, gutter, radius, space, theme, type } from '../../theme/tokens';
import { modelName } from '../../components/MessageItem';

/** GET /api/me/orchestrator/overview - what this page draws, as the server shapes it. */
interface Overview {
  status: OrchStatus;
  uptime: number | null;
  started_at: string | null;
  restarts_today: number;
  memory: { used_mb: number; limit_mb: number } | null;
  now: { busy: number; asking: boolean; handoffs: number; sessions: number };
  tokens: { tokens: number[]; total: number; today: number; week: number };
  handoffs: { id: string; agent: string; room: string | null; title: string | null; state: string; seconds: number | null }[];
  incidents: {
    at: string | null; kind: string; code: number | null; signal: string | null; detail: string | null;
    names: string[]; count: number;
  }[];
  last_event: { kind: string; at: string } | null;
}
interface AdminOverview {
  rows: {
    account: string; name: string | null; email: string | null; state: string; model: string | null;
    failures: number; memory: number | null; last_event: { kind: string; at: string } | null;
  }[];
  incidents: { at: string | null; kind: string; code: number | null; names: string[]; count: number }[];
  running: number;
  settings: { max_running: number; mem_mb: number };
}

const HANDFOFFS = 6;
const INCIDENTS = 8;

export function OrchestratorPage({
  client,
  t,
  lang,
  onBack,
  backLabel,
  onModel,
  onOpenRoom,
}: {
  client: WorkbenchClient | null;
  t: OrchStrings;
  lang: 'en' | 'tr';
  onBack: () => void;
  backLabel: string;
  /** The model row: the sheet that picks it (AgentSheet). */
  onModel: () => void;
  onOpenRoom?: () => void;
}) {
  const [o, setO] = useState<Overview | null>(null);
  const [every, setEvery] = useState<AdminOverview | null>(null);
  const [busy, setBusy] = useState<'start' | 'stop' | null>(null);
  const [bad, setBad] = useState('');
  const [askStop, setAskStop] = useState(false);
  const [moreHandoffs, setMoreHandoffs] = useState(false);
  const [moreIncidents, setMoreIncidents] = useState(false);

  const tz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
  }, []);

  const load = useCallback((): Promise<void> => {
    if (!client) return Promise.resolve();
    return client
      .request<Overview>('GET', `/api/me/orchestrator/overview?tz=${encodeURIComponent(tz)}`)
      .then(setO, (e: ApiError) => setBad(e.status === 403 ? t.mayNot : e.message || t.cantRead))
      .then(() =>
        client.request<AdminOverview>('GET', '/api/admin/orchestrators/overview').then(setEvery, () => setEvery(null)),
      );
  }, [client, tz, t]);

  const hub = useLive();
  const pace = useMemo(() => hub?.pace() ?? null, [hub]);
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!inFront()) return;
      if (!pace || pace.due()) load();
    }, 20_000);
    return () => clearInterval(timer);
  }, [load, pace]);
  useBus(['orch'], (e) => {
    if (e.k === '$down') return;
    pace?.mark();
    load();
  });

  const st = o?.status ?? null;
  const running = st?.desired === 'running';
  const act = async (what: 'start' | 'stop') => {
    if (!client) return;
    setBusy(what);
    setBad('');
    try {
      if (what === 'start') await client.orchestratorStart();
      else await client.orchestratorStop();
    } catch (e) {
      setBad(`${what === 'start' ? t.cantStart : t.cantStop}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
      setAskStop(false);
      await load();
    }
  };

  const figs = o
    ? [
        { label: t.upFor, value: o.uptime === null ? '—' : spans(o.uptime, t) },
        { label: t.restartsToday, value: String(o.restarts_today) },
        ...(o.memory ? [{ label: t.memory, value: `${o.memory.used_mb}/${o.memory.limit_mb} MB` }] : []),
        { label: t.tokensToday, value: num(o.tokens.today) },
        { label: t.tokensWeek, value: num(o.tokens.week) },
        { label: t.nowBusy, value: `${o.now.busy} · ${o.now.asking ? t.asking1 : '0'} · ${o.now.handoffs}` },
        { label: t.lastEvent, value: o.last_event ? `${kindWord(o.last_event.kind, t)}` : '—' },
      ]
    : [];

  return (
    <SettingsPage title={t.orchestrator} onBack={onBack} backLabel={backLabel} testID="settings-orchestrator">
      <SettingsGroup>
        <View style={s.head}>
          <View style={s.stateRow}>
            {st ? <StateDot s={statusDot(st)} /> : null}
            <Text style={s.stateText} numberOfLines={1} testID="orch-state">
              {st ? stateWord(st, t) : '…'}
              {st?.state === 'running' && st.started_at ? (
                <Text style={s.dim}>{` · ${t.since} ${whenOf(st.started_at, lang)}`}</Text>
              ) : null}
            </Text>
          </View>
          <Text style={s.dim}>{t.answersEveryRoom}</Text>
        </View>
        {st?.halted ? (
          <Text style={s.warn} accessibilityRole="alert">
            <Text style={s.bold}>{haltTitle(st.halted.kind, t)}</Text>
            {st.halted.message ? ` · ${st.halted.message}` : ''} · {t.fixKey}
          </Text>
        ) : st?.crash_loop ? (
          <Text style={s.warn}>{t.crashLoop}</Text>
        ) : st?.state === 'restarting' ? (
          <Text style={s.dim}>{t.restartingNow}
            {st.last_failure ? ` ${failureWord(st.last_failure.kind, t)}` : ''}</Text>
        ) : null}
        {bad ? <ErrorText>{bad}</ErrorText> : null}
        <View style={s.acts}>
          {running ? <Button label={t.stop} onPress={() => setAskStop(true)} disabled={!!busy} testID="orch-stop" /> : null}
          <Button label={busy === 'start' ? t.startingBusy : running ? t.restart : t.start}
                  variant={running ? 'plain' : 'primary'} onPress={() => act('start')} disabled={!!busy} testID="orch-start" />
          {onOpenRoom ? <Button label={t.openInChat} variant="quiet" onPress={onOpenRoom} testID="orch-open-room" /> : null}
        </View>
        {askStop ? (
          <View style={s.ask}>
            <Text style={s.askText}>{t.stopTitle} {t.stopText}</Text>
            <View style={s.acts}>
              <Button label={t.stop} onPress={() => act('stop')} disabled={!!busy} busy={busy === 'stop'} testID="orch-stop-yes" />
              <Button label={t.close} variant="quiet" onPress={() => setAskStop(false)} />
            </View>
          </View>
        ) : null}
      </SettingsGroup>

      {st?.providers.length ? (
        <SettingsGroup>
          <SettingsRow icon={undefined} title={t.model} sub={t.ownKey} value={st.choice ? modelName(st.choice.model) : t.pickModel}
                       onPress={onModel} last testID="orch-model" />
        </SettingsGroup>
      ) : (
        <SettingsGroup>
          <SectionNote text={t.noProviders} />
        </SettingsGroup>
      )}

      {o ? (
        <SettingsGroup title={t.figures}>
          {figs.map((f, i) => (
            <View key={f.label} style={[s.fig, i === figs.length - 1 && s.last]}>
              <Text style={s.figLabel}>{f.label}</Text>
              <Text style={s.figValue} numberOfLines={1}>{f.value}</Text>
            </View>
          ))}
        </SettingsGroup>
      ) : null}

      {o ? (
        <SettingsGroup title={t.handoffs} note={<SectionNote text={o.now.handoffs ? t.atWork(o.now.handoffs) : t.noHandoffs} />}>
          {o.handoffs.slice(0, moreHandoffs ? 100 : HANDFOFFS).map((h, i) => (
            <View key={String(h.id)} style={[s.row, i === Math.min(o.handoffs.length, moreHandoffs ? 100 : HANDFOFFS) - 1 && s.last]}>
              <View style={s.rowMain}>
                <Text style={s.rowTitle} numberOfLines={1}>{h.title || agentWord(h.agent, t)}</Text>
                <Text style={s.dim}>{[h.room ? roomWord(h.room, t) : null, handoffWord(h.state, t)].filter(Boolean).join(' · ')}</Text>
              </View>
              <Text style={s.dim}>{h.seconds === null ? '—' : spans(h.seconds, t)}</Text>
            </View>
          ))}
          {o.handoffs.length > HANDFOFFS ? (
            <Pressable onPress={() => setMoreHandoffs(!moreHandoffs)} style={s.moreRow} testID="orch-more-handoffs">
              <Text style={s.link}>{moreHandoffs ? t.fewer : t.allOfThem}</Text>
            </Pressable>
          ) : null}
        </SettingsGroup>
      ) : null}

      {o ? (
        <SettingsGroup title={t.incidents} note={<SectionNote text={`${o.incidents.length}`} />}>
          {o.incidents.slice(0, moreIncidents ? 100 : INCIDENTS).map((i, idx, arr) => (
            <View key={`${i.at}-${i.kind}-${idx}`} style={[s.row, idx === arr.length - 1 && s.last]}>
              <View style={s.rowMain}>
                <Text style={s.rowTitle} numberOfLines={1}>
                  {kindWord(i.kind, t)}{i.count > 1 ? ` ×${i.count}` : ''}
                  {i.code !== null ? ` · ${i.code}` : ''}
                </Text>
                <Text style={s.dim} numberOfLines={1}>{i.detail || whenOf(i.at, lang)}</Text>
              </View>
              <Text style={s.dim}>{whenOf(i.at, lang)}</Text>
            </View>
          ))}
          {!o.incidents.length ? <SectionNote text={t.noIncidents} /> : null}
          {o.incidents.length > INCIDENTS ? (
            <Pressable onPress={() => setMoreIncidents(!moreIncidents)} style={s.moreRow} testID="orch-more-incidents">
              <Text style={s.link}>{moreIncidents ? t.fewer : t.more}</Text>
            </Pressable>
          ) : null}
        </SettingsGroup>
      ) : null}

      {every ? (
        <>
          <SettingsGroup title={t.allOrchestrators}
                         note={<SectionNote text={`${every.running} ${t.running.toLowerCase()} · ${t.atMost} ${every.settings.max_running} · ${every.settings.mem_mb} MB`} />}>
            {every.rows.map((r, i) => (
              <View key={r.account} style={[s.row, i === every.rows.length - 1 && s.last]}>
                <View style={s.rowMain}>
                  <Text style={s.rowTitle} numberOfLines={1}>{r.name || r.account}</Text>
                  <Text style={s.dim} numberOfLines={1}>
                    {[r.email, r.model ? modelName(r.model) : null, r.last_event ? kindWord(r.last_event.kind, t) : null]
                      .filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={s.dim}>{stateOf(r.state, t)}</Text>
              </View>
            ))}
            {!every.rows.length ? <SectionNote text={t.noIncidents} /> : null}
          </SettingsGroup>
          <SettingsGroup title={t.allIncidents}>
            {every.incidents.slice(0, 12).map((i, idx) => (
              <View key={`${i.at}-${i.kind}-${idx}`} style={[s.row, idx === Math.min(every.incidents.length, 12) - 1 && s.last]}>
                <View style={s.rowMain}>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {kindWord(i.kind, t)}{i.count > 1 ? ` ×${i.count}` : ''}
                  </Text>
                  <Text style={s.dim} numberOfLines={1}>{i.names.join(', ')}</Text>
                </View>
                <Text style={s.dim}>{whenOf(i.at, lang)}</Text>
              </View>
            ))}
            {!every.incidents.length ? <SectionNote text={t.noIncidents} /> : null}
          </SettingsGroup>
        </>
      ) : null}
    </SettingsPage>
  );
}

function SectionNote({ text }: { text: string }) {
  return <Text style={s.note}>{text}</Text>;
}

/** 2.6M / 51k / 903 - the figures of the strip, short. */
function num(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(v);
}

/** A duration as people read it: 3 d 4 h, 5 h 12 min, 42 min, 12 s. */
function spans(v: number, t: OrchStrings): string {
  const d = Math.floor(v / 86400), h = Math.floor((v % 86400) / 3600), m = Math.floor((v % 3600) / 60);
  if (d) return `${d}${t.dayShort} ${h}${t.hourShort}`;
  if (h) return `${h}${t.hourShort} ${m}${t.minShort}`;
  if (m) return `${m}${t.minShort}`;
  return `${Math.round(v)}${t.secShort}`;
}

function agentWord(a: string, t: OrchStrings): string {
  return t.rooms[a] ?? a;
}

function roomWord(r: string, t: OrchStrings): string {
  return t.rooms[r] ?? r;
}

function handoffWord(s: string, t: OrchStrings): string {
  return ({ working: t.working, done: t.done, failed: t.failed, cancelled: t.cancelled } as Record<string, string>)[s] ?? s;
}

function kindWord(k: string, t: OrchStrings): string {
  return t.kinds[k] ?? k;
}

function stateOf(state: string, t: OrchStrings): string {
  return ({ auth: t.keyRejected, credit: t.creditsOut, running: t.running, restarting: t.restarting,
            stopped: t.stopped } as Record<string, string>)[state] ?? state;
}

const s = StyleSheet.create({
  head: { paddingHorizontal: gutter, paddingTop: space.sm, paddingBottom: space.xs, gap: 4 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  stateText: { flexShrink: 1, fontFamily: fonts.sansSemi, fontSize: type.body, color: colors.ink },
  dim: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: type.tinyLine, color: colors.inkDim },
  warn: { paddingHorizontal: gutter, paddingBottom: space.xs, fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: type.tinyLine, color: colors.warn },
  bold: { fontFamily: fonts.sansSemi },
  acts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingHorizontal: gutter, paddingTop: space.xs, paddingBottom: space.sm },
  ask: { paddingBottom: space.sm, borderTopWidth: 1, borderTopColor: colors.line, marginTop: space.xs },
  askText: { paddingHorizontal: gutter, paddingTop: space.sm, fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  fig: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
    minHeight: 34, paddingHorizontal: gutter, borderTopWidth: 1, borderTopColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  figLabel: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  figValue: { fontFamily: fonts.sansSemi, fontSize: type.small, color: colors.ink, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44,
    paddingHorizontal: gutter, borderTopWidth: 1, borderTopColor: colors.line,
  },
  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: fonts.sans, fontSize: type.small, color: colors.ink },
  note: { paddingHorizontal: gutter, paddingTop: space.sm, fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: type.tinyLine, color: colors.inkDim },
  moreRow: { minHeight: 40, justifyContent: 'center', paddingHorizontal: gutter, borderTopWidth: 1, borderTopColor: colors.line },
  link: { fontFamily: fonts.sansSemi, fontSize: type.small, color: colors.inkDim },
});
