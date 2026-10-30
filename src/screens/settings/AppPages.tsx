/**
 * Settings > Home screen widget and > About: the figures on the home screen,
 * and the app on this phone - its version and update, its licence and where it
 * comes from. The words a person reads about both live here, out of the menu,
 * which only says where each one stands.
 */
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { ExternalLink, FileText, Smartphone } from '../../components/icons';
import {
  SettingsAbout,
  SettingsGroup,
  SettingsNote,
  SettingsPage,
  SettingsRow,
} from '../../components/SettingsList';
import { Button } from '../../components/ui';
import { UpdateSection } from '../../components/UpdateSection';
import type { SettingsStrings } from '../../lib/settingsStrings';
import { colors, fonts, gutter, space, type } from '../../theme/tokens';
import type { UiLang, UpdateStrings } from '../../update/strings';
import type { Update } from '../../update/useUpdate';
import { addWidget } from '../../widget/home';
import { WidgetPreview, WidgetRefreshes } from './WidgetPreview';

/** Where the app's source is (Settings > About). */
export const SOURCE = 'https://github.com/x3beche/workbench-mobile';

/**
 * Settings > About: what the app is, the build on this phone and its update,
 * the licence, and where the source is. One page of rows where there used to
 * be a Version page and an About page.
 */
export function AboutPage({
  t,
  update,
  ut,
  lang,
  version,
  onBack,
}: {
  t: SettingsStrings;
  update?: Update;
  ut: UpdateStrings;
  lang: UiLang;
  /** The version this build carries (app.json, expo-constants). */
  version: string;
  onBack: () => void;
}) {
  const check = update?.check;
  // What stands beside the version: "Up to date", "Checking…", or why not. A
  // newer build says so in its own block under the rows.
  const status =
    check?.state === 'current'
      ? ut.upToDate
      : check?.state === 'none'
        ? ut.none
        : update?.checking
          ? ut.checking
          : check?.state === 'error'
            ? check.offline
              ? ut.offline
              : ut.checkFailed(check.message)
            : '';
  return (
    <SettingsPage title={t.about} onBack={onBack} backLabel={t.back} testID="settings-about-page">
      <SettingsAbout>{t.aboutText}</SettingsAbout>
      <SettingsGroup>
        <SettingsRow
          icon={Smartphone}
          title={t.version}
          sub={check?.state === 'error' && !check.offline ? ut.checkFailed(check.message) : undefined}
          value={status ? `${version} · ${status}` : version}
          trailing={
            update ? (
              <Button
                label={ut.check}
                disabled={update.checking}
                onPress={() => update.recheck()}
                testID="update-check"
              />
            ) : undefined
          }
          testID="settings-version"
          valueTestID="settings-value-version"
        />
        <SettingsRow icon={FileText} title={t.licenceLabel} value={t.licenceValue} testID="settings-licence" />
        <SettingsRow
          icon={ExternalLink}
          title={t.source}
          sub={SOURCE.replace(/^https:\/\//, '')}
          onPress={() => void Linking.openURL(SOURCE)}
          last
          testID="settings-source"
        />
      </SettingsGroup>
      {update && check?.state === 'available' ? (
        <View style={s.block}>
          <UpdateSection update={update} t={ut} lang={lang} />
        </View>
      ) : null}
    </SettingsPage>
  );
}

/** Settings > Home screen widget: what the card shows, what it looks like, whether it is there, and adding it. */
export function WidgetPage({
  t,
  onTheHomeScreen,
  onBack,
}: {
  t: SettingsStrings;
  /** How many of them the launcher says are on the home screen; null when it cannot say. */
  onTheHomeScreen: number | null;
  onBack: () => void;
}) {
  const android = Platform.OS === 'android';
  return (
    <SettingsPage title={t.widget} onBack={onBack} backLabel={t.back} testID="settings-widget-page">
      <SettingsAbout>{t.widgetWhat}</SettingsAbout>
      <View style={s.preview}>
        <WidgetPreview t={t} />
        <Text style={s.caption}>{t.widgetPreview}</Text>
      </View>
      <View style={s.note}>
        <Text style={s.state} testID="widget-state">
          {t.widgetStatus(!!onTheHomeScreen)}
        </Text>
      </View>
      {android ? (
        <View style={s.action}>
          <Button label={t.widgetAdd} variant="primary" onPress={() => void addWidget()} testID="widget-add" />
        </View>
      ) : null}
      <View style={s.note}>
        <SettingsNote>{t.widgetHow}</SettingsNote>
      </View>
      <View style={s.preview}>
        <WidgetRefreshes t={t} />
      </View>
      {android ? null : (
        <View style={s.note}>
          <SettingsNote>{t.widgetOnlyAndroid}</SettingsNote>
        </View>
      )}
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  block: { paddingTop: space.md },
  note: { paddingHorizontal: gutter, paddingTop: space.md },
  /** Where it stands: a line, not a heading. */
  state: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: type.tinyLine, color: colors.inkDim },
  action: { paddingHorizontal: gutter, paddingTop: space.md, alignItems: 'flex-start' },
  preview: { paddingHorizontal: gutter, paddingTop: space.lg },
  caption: {
    paddingTop: 6,
    fontFamily: fonts.sans,
    fontSize: type.micro,
    lineHeight: type.microLine,
    color: colors.inkDim,
  },
});
