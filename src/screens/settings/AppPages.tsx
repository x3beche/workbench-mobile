/**
 * Settings > Home screen widget and > About: the figures on the home screen,
 * and the app on this phone - its version, its update, its licence and where
 * it comes from. The words a person reads about both live here, out of the
 * menu, which only says where each one stands.
 */
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { ChartColumn, ExternalLink, Wrench } from '../../components/icons';
import {
  SettingsAbout,
  SettingsGroup,
  SettingsNote,
  SettingsPage,
  SettingsRow,
} from '../../components/SettingsList';
import { Button, Glyph } from '../../components/ui';
import { UpdateSection } from '../../components/UpdateSection';
import type { SettingsStrings } from '../../lib/settingsStrings';
import { colors, fonts, gutter, radius, space, type, widgetGround } from '../../theme/tokens';
import type { UiLang, UpdateStrings } from '../../update/strings';
import type { Update } from '../../update/useUpdate';
import { addWidget } from '../../widget/home';

/** Where the app's source is (Settings > About). */
export const SOURCE = 'https://github.com/x3beche/workbench-mobile';

/**
 * Settings > About: what the app is, the build on this phone and its update,
 * the licence, and where the source is. One page where there used to be two:
 * the menu's own row says the version, and this says the rest.
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
  return (
    <SettingsPage title={t.about} onBack={onBack} backLabel={t.back} testID="settings-about-page">
      <SettingsAbout>{t.aboutText}</SettingsAbout>
      {update ? (
        <View style={s.block}>
          <UpdateSection update={update} t={ut} lang={lang} />
        </View>
      ) : (
        <View style={s.note}>
          <SettingsNote testID="settings-about-version">{`Workbench mobile ${version}`}</SettingsNote>
        </View>
      )}
      <View style={s.note}>
        <SettingsNote>{t.licence}</SettingsNote>
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

/**
 * The widget's own picture, drawn the way the launcher draws it (its two
 * halves, a head each, the big figure and the days under it) - so a person
 * sees what they are adding before they add it. The plate is the widget's
 * grey; the card inside follows the theme, as the widget's own card does.
 */
function WidgetPreview({ t }: { t: SettingsStrings }) {
  const days = [3, 5, 2, 6, 4, 7, 3, 8, 5, 4, 6, 3, 5, 7];
  return (
    <View
      style={s.plate}
      testID="widget-preview"
      accessibilityRole="image"
      accessibilityLabel={t.widgetPreviewLabel}
    >
      <View style={s.card}>
        <View style={s.half}>
          <View style={s.head}>
            <Glyph icon={ChartColumn} size={12} color={colors.inkDim} />
            <Text style={s.headText} numberOfLines={1}>
              {t.models}
            </Text>
            <View style={s.grow} />
            <Text style={s.headAside} numberOfLines={1}>
              {t.period.month}
            </Text>
          </View>
          <View style={s.figures}>
            <Text style={s.big}>312k</Text>
            <Text style={s.unit}>tok</Text>
          </View>
          <View style={s.days}>
            {days.map((h, i) => (
              <View key={i} style={[s.bar, { height: 2 + h }]} />
            ))}
          </View>
        </View>
        <View style={s.divide} />
        <View style={s.half}>
          <View style={s.head}>
            <Glyph icon={Wrench} size={12} color={colors.inkDim} />
            <Text style={s.headText} numberOfLines={1}>
              {t.tools}
            </Text>
            <View style={s.grow} />
            <Text style={s.headAside} numberOfLines={1}>
              {t.period.week}
            </Text>
          </View>
          <View style={s.figures}>
            <Text style={s.big}>33</Text>
            <Text style={s.unit} numberOfLines={1}>
              {t.toolWord(33)}
            </Text>
          </View>
          <View style={s.days}>
            {days.map((h, i) => (
              <View key={i} style={[s.bar, s.barAlt, { height: 2 + ((i * 3) % 7) }]} />
            ))}
          </View>
        </View>
      </View>
    </View>
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
        <View style={s.caption}>
          <Text style={s.captionText}>{t.widgetPreview}</Text>
        </View>
      </View>
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

const s = StyleSheet.create({
  block: { paddingTop: space.md },
  note: { paddingHorizontal: gutter, paddingTop: space.md },
  state: { paddingHorizontal: gutter, paddingTop: space.lg },
  stateText: { fontFamily: fonts.sansMedium, fontSize: type.lead, lineHeight: type.leadLine, color: colors.ink },
  action: { paddingHorizontal: gutter, paddingTop: space.md, alignItems: 'flex-start' },
  // The widget's drawing: its grey plate, its card, and its two halves.
  preview: { paddingHorizontal: gutter, paddingTop: space.lg },
  plate: { backgroundColor: widgetGround, borderRadius: radius.lg, padding: space.sm },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  half: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 8 },
  divide: { width: 1, backgroundColor: colors.line },
  head: { flexDirection: 'row', alignItems: 'center' },
  headText: {
    marginLeft: 5,
    fontFamily: fonts.sansMedium,
    fontSize: type.micro,
    lineHeight: type.microLine,
    color: colors.ink,
  },
  headAside: {
    marginLeft: space.xs,
    fontFamily: fonts.sans,
    fontSize: type.micro,
    lineHeight: type.microLine,
    color: colors.inkDim,
  },
  grow: { flex: 1 },
  figures: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  big: { fontFamily: fonts.monoSemi, fontSize: 20, color: colors.inkBright },
  unit: {
    marginLeft: 4,
    fontFamily: fonts.sans,
    fontSize: type.micro,
    lineHeight: type.microLine,
    color: colors.inkDim,
  },
  days: { flexDirection: 'row', alignItems: 'flex-end', height: 12, marginTop: 6 },
  bar: { flex: 1, marginRight: 2, borderRadius: 1, backgroundColor: colors.accent },
  barAlt: { backgroundColor: colors.series2 },
  caption: { flexDirection: 'row', alignItems: 'center', paddingTop: 6 },
  captionText: {
    fontFamily: fonts.sans,
    fontSize: type.micro,
    lineHeight: type.microLine,
    color: colors.inkDim,
  },
});
