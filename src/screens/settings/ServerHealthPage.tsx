/**
 * Settings > Server health, for the owner and the admins: the server itself,
 * on the phone - is it short of memory, has the kernel killed anything, did it
 * restart without saying goodbye, is the disk or the heat over a line - and
 * what each of those broke in the app (GET /api/admin/server-health,
 * backend/hosthealth.py; the web's page is frontend/src/app/server-health.ts).
 *
 * The same page, made plain for a phone: the verdict in a line, the figures
 * under it, the last events with what they broke. No thresholds here - they
 * are the web page's, where a person sets them.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { WorkbenchClient } from '../../api/client';
import type { HostHealth } from '../../api/types';
import { SettingsAbout, SettingsPage } from '../../components/SettingsList';
import { colors, fonts, gutter, radius, space, type } from '../../theme/tokens';

const RANGES: { id: string; word: string }[] = [
  { id: '24h', word: '24h' },
  { id: '7d', word: '7d' },
  { id: '30d', word: '30d' },
];

export function ServerHealthPage({
  client,
  lang,
  onBack,
  backLabel,
  title,
  about,
}: {
  client: WorkbenchClient | null;
  lang: 'en' | 'tr';
  onBack: () => void;
  backLabel: string;
  title: string;
  about: string;
}) {
  const [d, setD] = useState<HostHealth | null>(null);
  const [err, setErr] = useState(false);
  const [rng, setRng] = useState('7d');

  const load = useCallback(
    (r: string) => {
      if (!client) return;
      const days = r === '24h' ? 1 : r === '7d' ? 7 : 30;
      Promise.resolve()
        .then(() => client.serverHealth(r, days))
        .then(
          (got) => {
            setD(got);
            setErr(false);
          },
          () => setErr(true),
        );
    },
    [client],
  );
  useEffect(() => {
    load(rng);
    const t = setInterval(() => load(rng), 60_000);
    return () => clearInterval(t);
  }, [load, rng]);

  const tr = lang === 'tr';
  const sm = d?.now.sample;
  const gb = (v?: number | null) => (v == null ? '–' : `${v.toFixed(1)} GB`);
  const pct = (v?: number | null) => (v == null ? '–' : `${v.toFixed(1)}%`);
  const temp = (v?: number | null) => (v == null ? '–' : `${Math.round(v)} °C`);
  const when = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString(tr ? 'tr-TR' : 'en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  const broke = (e: { impact?: { counts?: Record<string, number | undefined> } }) => {
    const c = e.impact?.counts ?? {};
    const parts: string[] = [];
    if (c.orchestrator) parts.push(`${c.orchestrator} ${tr ? 'Orkestratör çökmesi' : 'Orchestrator crashes'}`);
    if (c.sandboxes) parts.push(`${c.sandboxes} ${tr ? 'sandbox durdu' : 'sandboxes stopped'}`);
    if (c.jobs) parts.push(`${c.jobs} ${tr ? 'iş başarısız' : 'jobs failed'}`);
    return parts.length ? parts.join(' · ') : tr ? 'uygulamada bir şey yok' : 'nothing in the app';
  };

  return (
    <SettingsPage title={title} onBack={onBack} backLabel={backLabel} testID="server-health-page">
      <SettingsAbout>{about}</SettingsAbout>
      {!d ? (
        <Text style={s.hint}>{err ? (tr ? 'Sunucu sağlığı okunamadı.' : 'The server health could not be read.') : tr ? 'Yükleniyor…' : 'Loading…'}</Text>
      ) : (
        <>
          <View style={s.verdict}>
            <View style={[s.dot, { backgroundColor: toneColour(d.verdict.tone) }]} />
            <Text style={s.verdictText}>{tr ? d.verdict.tr : d.verdict.en}</Text>
          </View>

          <View style={s.figs}>
            <Fig label={tr ? 'Kullanılabilir bellek' : 'Available memory'} value={gb(sm?.avail_gb)} note={`${tr ? 'swap' : 'swap'} ${pct(sm?.swap_used_pct)}`} />
            <Fig label={tr ? 'Bellek baskısı' : 'Memory pressure'} value={pct(sm?.psi_mem_full60)} note={tr ? 'takılma, avg60' : 'stalled, avg60'} />
            <Fig label={tr ? 'Disk' : 'Disk'} value={pct(sm?.disk_pct)} note={`${tr ? 'boş' : 'free'} ${Object.values(d.now.disks)[0]?.free_gb ?? '–'} GB`} />
            <Fig label={tr ? 'Sıcaklık' : 'Temperature'} value={temp(sm?.temp_max)} note={`${tr ? 'işlemci' : 'cpu'} ${temp(sm?.temp_cpu)}`} />
            <Fig label={tr ? 'OOM öldürmeleri' : 'OOM kills'} value={String(sm?.oom_kill ?? '–')} note={tr ? 'açılıştan beri' : 'since the boot'} />
            <Fig label={tr ? 'Çalışma süresi' : 'Up for'} value={up(sm?.uptime_s ?? null, tr)} note={(d.now.load ?? []).map((x) => x.toFixed(2)).join(' · ')} />
          </View>

          <View style={s.ranges}>
            {RANGES.map((r) => (
              <Text
                key={r.id}
                onPress={() => setRng(r.id)}
                style={[s.range, rng === r.id && s.rangeOn]}
                testID={`server-health-range-${r.id}`}
              >
                {r.word}
              </Text>
            ))}
            <Text style={s.marks}>{tr ? 'olaylar grafiğin üstünde' : 'events above the chart'}</Text>
          </View>

          <Spark d={d} />

          <Text style={s.h5}>{tr ? 'Olaylar' : 'Events'}</Text>
          {d.events.length ? (
            d.events.slice(0, 12).map((e) => (
              <View key={e.id} style={s.event}>
                <Text style={s.when}>{when(e.at)}</Text>
                <Text style={[s.kind, { color: toneColour(kindTone(e.kind)) }]}>{kindWord(e.kind, tr)}</Text>
                <Text style={s.detail} numberOfLines={2}>
                  {e.title}
                </Text>
                <Text style={s.broke}>{broke(e)}</Text>
              </View>
            ))
          ) : (
            <Text style={s.hint}>{tr ? 'Bu dönemde bir şey ters gitmedi.' : 'Nothing went wrong in this period.'}</Text>
          )}

          <Text style={s.hint}>
            {tr ? 'Örnekleme maliyeti' : 'Sampling costs'}: {d.cost.cpu_ms ?? '–'} ms
            {tr ? ' CPU/dakika' : ' of CPU a minute'} ({d.cost.samples} {tr ? 'örnek' : 'samples'}).
          </Text>
          <Text style={s.hint}>
            {(d.sources ?? []).filter((x) => !x.ok).map((x) => `${x.label}: ${tr ? 'burada okunamıyor' : 'not readable here'}`).join('\n')}
          </Text>
        </>
      )}
    </SettingsPage>
  );
}

function Fig({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={s.fig}>
      <Text style={s.figLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={s.figValue} numberOfLines={1}>
        {value}
      </Text>
      {note ? (
        <Text style={s.figNote} numberOfLines={1}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** The range as bars: the memory pressure, and a mark over each event. */
function Spark({ d }: { d: HostHealth }) {
  const n = d.series.n;
  const psi = d.series.psi;
  const hi = Math.max(1, ...psi.map((v) => v ?? 0));
  const end = d.series.t0 + d.series.step * n;
  const cols = psi.slice(-28);
  return (
    <View style={s.chart} testID="server-health-chart">
      <View style={s.bars}>
        {cols.map((v, i) => (
          <View key={i} style={s.barCol}>
            <View style={[s.bar, { height: Math.max(1, Math.round(((v ?? 0) / hi) * 54)) }]} />
          </View>
        ))}
      </View>
      <View style={s.marksRow}>
        {d.events.slice(0, 40).map((e) => {
          const at = Date.parse(e.at) / 1000;
          if (!(at >= d.series.t0 && at <= end)) return null;
          const left = Math.max(0, Math.min(1, (at - d.series.t0) / Math.max(1, end - d.series.t0)));
          return <View key={e.id} style={[s.mark, { left: `${left * 100}%`, backgroundColor: toneColour(kindTone(e.kind)) }]} />;
        })}
      </View>
    </View>
  );
}

function up(secs: number | null, tr: boolean) {
  if (!secs) return '–';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  return d ? `${d} ${tr ? 'g' : 'd'} ${h} ${tr ? 'sa' : 'h'}` : `${h} ${tr ? 'sa' : 'h'}`;
}

function kindTone(kind: string): 'ok' | 'warn' | 'danger' {
  if (kind === 'restart' || kind === 'oom' || kind === 'edac_ue') return 'danger';
  if (kind === 'hang' || kind === 'edac' || kind === 'mem' || kind === 'swap' || kind === 'psi' || kind === 'disk' || kind === 'temp') return 'warn';
  return 'ok';
}

function toneColour(tone: 'ok' | 'warn' | 'danger') {
  return tone === 'danger' ? colors.danger : tone === 'warn' ? colors.warn : colors.ok;
}

function kindWord(kind: string, tr: boolean) {
  const words: Record<string, [string, string]> = {
    restart: ['Yeniden başlama', 'Restart'],
    restart_clean: ['Temiz yeniden başlama', 'Clean restart'],
    oom: ['Bellek tükendi', 'Out of memory'],
    hang: ['Donma', 'Stall'],
    edac: ['Bellek hatası', 'Memory error'],
    edac_ue: ['Düzeltilemeyen bellek hatası', 'Uncorrected memory error'],
    mem: ['Az bellek', 'Little memory'],
    psi: ['Bellek baskısı', 'Memory pressure'],
    swap: ['Swap dolu', 'Swap full'],
    disk: ['Disk', 'Disk'],
    temp: ['Sıcaklık', 'Temperature'],
  };
  const w = words[kind];
  return w ? (tr ? w[0] : w[1]) : kind;
}

const s = StyleSheet.create({
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  verdictText: { flex: 1, fontSize: type.small, lineHeight: type.smallLine, color: colors.ink },
  figs: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fig: { width: '47%', paddingVertical: space.sm },
  figLabel: { fontSize: type.tiny, color: colors.inkDim },
  figValue: { fontSize: type.body, fontFamily: fonts.mono, color: colors.ink },
  figNote: { fontSize: type.micro, color: colors.inkDim },
  ranges: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  range: { fontSize: type.small, color: colors.inkDim, paddingHorizontal: space.sm, paddingVertical: 2 },
  rangeOn: { color: colors.ink, fontWeight: '600' },
  marks: { marginLeft: 'auto', fontSize: type.micro, color: colors.inkDim },
  chart: { height: 74, justifyContent: 'flex-end', marginVertical: space.sm },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 56, gap: 1 },
  barCol: { flex: 1, justifyContent: 'flex-end' },
  bar: { backgroundColor: colors.warn, opacity: 0.55, borderRadius: 1 },
  marksRow: { height: 12, marginTop: 2 },
  mark: { position: 'absolute', top: 0, width: 6, height: 6, borderRadius: 3 },
  h5: { fontSize: type.small, fontWeight: '600', color: colors.ink, marginTop: space.md },
  event: { paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  when: { fontSize: type.micro, color: colors.inkDim, fontFamily: fonts.mono },
  kind: { fontSize: type.small, fontWeight: '600' },
  detail: { fontSize: type.small, color: colors.ink },
  broke: { fontSize: type.micro, color: colors.inkDim },
  hint: { fontSize: type.small, color: colors.inkDim, lineHeight: type.smallLine },
});
