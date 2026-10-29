/**
 * Settings > Theme: the phone's own light or dark, or one of the web app's
 * themes colour for colour (theme/themes.ts, from its styles.css). Each row
 * carries the theme's own four colours - a picture of it, not the chrome
 * around it - so the choice is made by looking rather than by its name.
 *
 * The choice is read once, when the app starts, so it is kept and the app
 * restarts to wear it; the person comes back where they were signed in.
 */
import { reloadAppAsync } from 'expo';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SettingsAbout, SettingsChoice, SettingsPage } from '../../components/SettingsList';
import { Dialog } from '../../components/Sheet';
import type { SettingsStrings } from '../../lib/settingsStrings';
import { writeThemePref } from '../../storage/themePref';
import { SYSTEM_THEME, colors, space, theme, themeChoice } from '../../theme/tokens';
import { THEMES } from '../../theme/themes';

/** "dark" as a line of its own begins: "Dark", "Açık". */
function upper(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function ThemePage({ t, onBack }: { t: SettingsStrings; onBack: () => void }) {
  /** The theme picked, waiting for its restart to be agreed to. */
  const [wear, setWear] = useState<{ id: string; name: string } | null>(null);
  const dark = THEMES.find((x) => x.id === 'spartan-dark')?.name ?? '';
  const light = THEMES.find((x) => x.id === 'light')?.name ?? '';
  const rows = [
    {
      id: SYSTEM_THEME,
      name: t.followPhone,
      sub: `${dark} / ${light}`,
      swatch: [colors.surface, colors.surface2, colors.accent, colors.ink],
    },
    ...THEMES.map((x) => ({
      id: x.id,
      name: x.name,
      sub: upper(x.light ? t.light : t.dark),
      swatch: [x.colors.surface, x.colors.surface2, x.colors.accent, x.colors.ink],
    })),
  ];

  return (
    <SettingsPage title={t.theme} onBack={onBack} backLabel={t.back} testID="settings-theme-page">
      <SettingsAbout>{t.themeAbout}</SettingsAbout>
      <View style={s.list}>
        {rows.map((r, i) => {
          const on = r.id === SYSTEM_THEME ? themeChoice === SYSTEM_THEME : themeChoice !== SYSTEM_THEME && theme.id === r.id;
          return (
            <SettingsChoice
              key={r.id}
              title={r.name}
              sub={r.sub}
              on={on}
              onPress={() => !on && setWear({ id: r.id, name: r.name })}
              leading={
                <View style={s.swatch}>
                  {r.swatch.map((c, k) => (
                    <View key={k} style={[s.chip, { backgroundColor: c }]} />
                  ))}
                </View>
              }
              last={i === rows.length - 1}
              testID={r.id === SYSTEM_THEME ? 'theme-system' : `theme-${r.id}`}
            />
          );
        })}
      </View>
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
  list: { paddingTop: space.sm },
  swatch: {
    width: 28,
    height: 22,
    flexDirection: 'row',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  chip: { flex: 1 },
});
