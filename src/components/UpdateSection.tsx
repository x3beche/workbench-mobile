/**
 * Account's App block, drawn like the rows above it (a small dim label, the
 * value in body text): "Version 1.5.0" with "Up to date" under it and a
 * quiet Check on the right. When the server has a newer build: "Version
 * 1.5.1 is ready", the version installed and the download's size under it,
 * what changed when the server says, and "Download and install" (Android);
 * then the download's progress, the check of its checksum, and the
 * installer. The web build shows the versions only.
 */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, gutter, space, type } from '../theme/tokens';
import { formatSize, notesFor, type UpdateFailure } from '../update/release';
import type { UiLang, UpdateStrings } from '../update/strings';
import type { Update } from '../update/useUpdate';
import { Button, ErrorText } from './ui';

function failureText(f: UpdateFailure, t: UpdateStrings): string {
  return f.kind === 'http' ? t.http(f.status) : t.errors[f.kind];
}

export function UpdateSection({ update, t, lang }: { update: Update; t: UpdateStrings; lang: UiLang }) {
  const { installed, check, checking, job, canInstall } = update;
  const size = (n: number | null | undefined) => formatSize(n, lang);
  if (check.state !== 'available') {
    let sub: string | null = null;
    let bad = false;
    if (checking) sub = t.checking;
    else if (check.state === 'current') sub = t.upToDate;
    else if (check.state === 'none') sub = t.none;
    else if (check.state === 'error') {
      sub = check.offline ? t.offline : t.checkFailed(check.message);
      bad = true;
    }
    return (
      <View style={s.block} testID="update-section">
        <Text style={s.label}>{t.section}</Text>
        <View style={s.row}>
          <View style={s.flex} testID="update-status">
            <Text style={s.value} numberOfLines={1}>
              {t.version(installed.version)}
            </Text>
            {sub ? (
              <Text style={[s.sub, bad && s.bad]} numberOfLines={2}>
                {sub}
              </Text>
            ) : null}
          </View>
          <Button
            label={t.check}
            variant="quiet"
            disabled={checking}
            onPress={() => update.recheck()}
            style={s.check}
            testID="update-check"
          />
        </View>
      </View>
    );
  }

  const { release } = check;
  const notes = notesFor(release.notes, lang);
  const bytes = size(release.size);
  const percent =
    job.state === 'downloading' && job.total > 0 ? Math.min(100, Math.round((job.got / job.total) * 100)) : null;

  return (
    <View style={s.block} testID="update-section">
      <Text style={s.label}>{t.section}</Text>
      <View testID="update-status">
        <Text style={s.value} numberOfLines={1}>
          {t.ready(release.version)}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {t.youHave(installed.version)}
          {bytes ? ` · ${bytes}` : ''}
        </Text>
      </View>
      {notes ? (
        <View style={s.notes}>
          <Text style={s.label}>{t.whatsNew}</Text>
          <Text style={s.notesText} numberOfLines={8} testID="update-notes">
            {notes}
          </Text>
        </View>
      ) : null}
      {!canInstall ? (
        <Text style={s.dim}>{t.webOnly}</Text>
      ) : job.state === 'downloading' ? (
        <View style={s.progress}>
          <View style={s.row}>
            <Text style={[s.dim, s.flex]} testID="update-progress">
              {job.total > 0 ? t.downloading(size(job.got), size(job.total)) : t.downloadingNoTotal(size(job.got))}
              {percent != null ? ` (${percent}%)` : ''}
            </Text>
            <Button label={t.cancel} variant="quiet" onPress={update.cancel} testID="update-cancel" />
          </View>
          <View
            style={s.track}
            accessibilityRole="progressbar"
            accessibilityValue={percent != null ? { min: 0, max: 100, now: percent } : undefined}
          >
            <View style={[s.fill, { width: `${percent ?? 0}%` }]} />
          </View>
        </View>
      ) : job.state === 'verifying' || job.state === 'installing' ? (
        <View style={s.row}>
          <ActivityIndicator color={colors.inkDim} size="small" />
          <Text style={[s.dim, s.flex]}>{job.state === 'verifying' ? t.verifying : t.installing}</Text>
        </View>
      ) : job.state === 'permission' ? (
        <View style={s.stack}>
          <Text style={s.dim}>{t.permission}</Text>
          <Button label={t.openSetting} variant="primary" onPress={() => void update.allow()} testID="update-allow" />
        </View>
      ) : (
        <View style={s.stack}>
          {job.state === 'failed' ? <ErrorText>{failureText(job.failure, t)}</ErrorText> : null}
          {job.state === 'ready' ? <Text style={s.dim}>{t.notInstalled}</Text> : null}
          <Button
            label={job.state === 'ready' ? t.install : job.state === 'failed' ? t.tryAgain : t.downloadInstall}
            variant="primary"
            onPress={() => void update.install()}
            testID="update-install"
          />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  block: { paddingHorizontal: gutter, paddingTop: space.md, gap: 6 },
  label: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  value: { fontFamily: fonts.sans, fontSize: type.body, color: colors.ink },
  sub: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: type.smallLine, color: colors.inkDim, marginTop: 1 },
  bad: { color: colors.danger },
  // A quiet text button whose word lines up with the sheet's right margin.
  check: { marginRight: -8 },
  dim: { flexShrink: 1, fontFamily: fonts.sans, fontSize: type.small, lineHeight: type.smallLine, color: colors.inkDim },
  notes: { gap: 4, paddingTop: space.xs },
  notesText: { fontFamily: fonts.sans, fontSize: type.small, lineHeight: type.smallLine, color: colors.ink },
  stack: { gap: space.sm, paddingTop: space.xs },
  progress: { gap: 6 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.hover, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.ink },
});
