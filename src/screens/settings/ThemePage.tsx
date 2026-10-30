/**
 * Settings > Theme: the phone's own light or dark, or one of the web app's
 * themes colour for colour (theme/themes.ts, from its styles.css). The themes
 * are grouped the way they are chosen - the phone's own, then the dark ones,
 * then the light ones - and each row carries a square of the theme's own four
 * colours: a picture of it, not the chrome around it, so the choice is made by
 * looking rather than by its name.
 *
 * The choice is read once, when the app starts, so it is kept and the app
 * restarts to wear it; the person comes back where they were signed in.
 */
import { reloadAppAsync } from 'expo';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SettingsAbout, SettingsChoice, SettingsGroup, SettingsPage } from '../../components/SettingsList';
import { Dialog } from '../../components/Sheet';
import type { SettingsStrings } from '../../lib/settingsStrings';
import { writeThemePref } from '../../storage/themePref';
import { SYSTEM_THEME, colors, theme, themeChoice } from '../../theme/tokens';
import { THEMES } from '../../theme/themes';

export function ThemePage({ t, onBack }: { t: SettingsStrings; onBack: () => void }) {
  /** The theme picked, waiting for its restart to be agreed to. */
  const [wear, setWear] = useState<{ id: string; name: string } | null>(null);
  /** The phone's own, then the dark ones and the light ones under their own headings. */
  const groups: { key: string; title: string; rows: { id: string; name: string; swatch: string[] }[] }[] = [
    {
      key: 'system',
      title: t.followPhone,
      rows: [{ id: SYSTEM_THEME, name: t.followPhone, swatch: [colors.surface, colors.surface2, colors.accent, colors.ink] }],
    },
    {
      key: 'dark',
      title: t.dark,
      rows: THEMES.filter((x) => !x.light).map((x) => ({
        id: x.id,
        name: x.name,
        swatch: [x.colors.surface, x.colors.surface2, x.colors.accent, x.colors.ink],
      })),
    },
    {
      key: 'light',
      title: t.light,
      rows: THEMES.filter((x) => x.light).map((x) => ({
        id: x.id,
        name: x.name,
        swatch: [x.colors.surface, x.colors.surface2, x.colors.accent, x.colors.ink],
      })),
    },
  ];

  return (
    <SettingsPage title={t.theme} onBack={onBack} backLabel={t.back} testID="settings-theme-page">
      <SettingsAbout>{t.themeAbout}</SettingsAbout>
      {groups.map((g) => (
        <SettingsGroup key={g.key} title={g.title} testID={`theme-group-${g.key}`}>
          {g.rows.map((r, i) => {
            const on = r.id === SYSTEM_THEME ? themeChoice === SYSTEM_THEME : themeChoice !== SYSTEM_THEME && theme.id === r.id;
            return (
              <SettingsChoice
                key={r.id}
                title={r.name}
                on={on}
                onPress={() => !on && setWear({ id: r.id, name: r.name })}
                leading={
                  <View style={s.leading}>
                    <View style={s.swatch}>
                      {r.swatch.map((c, k) => (
                        <View key={k} style={[s.chip, { backgroundColor: c }]} />
                      ))}
                    </View>
                  </View>
                }
                last={i === g.rows.length - 1}
                testID={r.id === SYSTEM_THEME ? 'theme-system' : `theme-${r.id}`}
              />
            );
          })}
        </SettingsGroup>
      ))}
      {wear ? (
        <Dialog
          title={t.restartTitle(wear.name)}
          text={t.restartText}
          confirm={t.restart}
          testID="theme-restart"
          onCancel={() => setWear(null)}
          onConfirm={async () => {
            writeThemePref(wear.id);
            setWear(null);
            await reloadAppAsync('theme').catch(() => undefined);
          }}
        />
      ) : null}
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  leading: { width: 28, alignItems: 'flex-start' },
  // Two colours over two, so each patch is seen: the plate, its panels, the accent and the ink.
  swatch: {
    width: 28,
    height: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  chip: { width: '50%', height: '50%' },
});
