/**
 * Settings > Version, > Home screen widget and > About: the app on this
 * phone, its update, the figures on the home screen, and where the app comes
 * from. The words a person reads about all three live here, out of the menu,
 * which only says where each one stands.
 */
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { ExternalLink } from '../../components/icons';
import { SettingsAbout, SettingsGroup, SettingsNote, SettingsPage, SettingsRow } from '../../components/SettingsList';
import { Button } from '../../components/ui';
import { UpdateSection } from '../../components/UpdateSection';
import type { SettingsStrings } from '../../lib/settingsStrings';
import { colors, fonts, gutter, space, type } from '../../theme/tokens';
import type { UiLang, UpdateStrings } from '../../update/strings';
import type { Update } from '../../update/useUpdate';
import { addWidget } from '../../widget/home';

/** Where the app's source is (Settings > About). */
export const SOURCE = 'https://github.com/x3beche/workbench-mobile';

/** Where the update stands, in the menu's one line: "Up to date", "Version 1.9.9 is ready". */
export function updateLine(update: Update | undefined, t: UpdateStrings): string {
  if (!update) return '';
  if (update.checking) return t.checking;
  switch (update.check.state) {
    case 'available':
      return t.ready(update.check.release.version);
    case 'current':
      return t.upToDate;
    case 'none':
      return t.none;
    case 'error':
      return update.check.offline ? t.offline : t.checkFailed(update.check.message);
    default:
      return '';
  }
}

/** Settings > Version: the version on this phone and the server's, and the update's own steps. */
export function VersionPage({
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
  return (
    <SettingsPage title={t.version} onBack={onBack} backLabel={t.back} testID="settings-version-page">
      <SettingsAbout>{t.versionAbout}</SettingsAbout>
      {update ? (
        <View style={s.block}>
          <UpdateSection update={update} t={ut} lang={lang} />
        </View>
      ) : (
        <SettingsNote>{`Workbench mobile ${version}`}</SettingsNote>
      )}
      <View style={s.note}>
        <SettingsNote>{`${t.aboutText} · ${t.licence}`}</SettingsNote>
      </View>
    </SettingsPage>
  );
}

/** Settings > Home screen widget: what the card shows, whether it is there, and adding it. */
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
      <View style={s.state}>
        <Text style={s.stateText}>{onTheHomeScreen ? t.widgetAdded : t.widgetNone}</Text>
      </View>
      {android ? (
        <View style={s.action}>
          <Button label={t.widgetAdd} variant="primary" onPress={() => void addWidget()} testID="widget-add" />
        </View>
      ) : null}
      <View style={s.note}>
        <SettingsNote>{t.widgetHow}</SettingsNote>
      </View>
      {android ? null : (
        <View style={s.note}>
          <SettingsNote>{t.widgetOnlyAndroid}</SettingsNote>
        </View>
      )}
    </SettingsPage>
  );
}

/** Settings > About: what the app is, its version and licence, and where its source is. */
export function AboutPage({
  t,
  version,
  onBack,
}: {
  t: SettingsStrings;
  version: string;
  onBack: () => void;
}) {
  return (
    <SettingsPage title={t.about} onBack={onBack} backLabel={t.back} testID="settings-about-page">
      <SettingsAbout>{t.aboutText}</SettingsAbout>
      <View style={s.note}>
        <SettingsNote>{`Workbench mobile ${version} · ${t.licence}`}</SettingsNote>
      </View>
      <SettingsGroup>
        <SettingsRow
          icon={ExternalLink}
          title={t.source}
          sub={SOURCE.replace(/^https:\/\//, '')}
          onPress={() => void Linking.openURL(SOURCE)}
          last
          testID="settings-source"
        />
      </SettingsGroup>
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  block: { paddingTop: space.md },
  note: { paddingHorizontal: gutter, paddingTop: space.md },
  state: { paddingHorizontal: gutter, paddingTop: space.lg },
  stateText: { fontFamily: fonts.sansMedium, fontSize: type.lead, lineHeight: type.leadLine, color: colors.ink },
  action: { paddingHorizontal: gutter, paddingTop: space.md, alignItems: 'flex-start' },
});
