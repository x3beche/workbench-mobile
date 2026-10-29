/**
 * A setting with a few answers, opened from Settings' menu: the choices as a
 * list of radios, each with what it means under it, and the one set now
 * checked. There is no Save - a choice is kept the moment it is touched, and
 * the menu behind the page already says what is set.
 *
 * Every page that offers a choice draws this: the app's language, the voice
 * language, when its words appear, and how much of an answer the Chat shows.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { SettingsAbout, SettingsChoice, SettingsPage } from '../../components/SettingsList';
import { gutter, space } from '../../theme/tokens';

export function ChoicePage<T extends string>({
  title,
  about,
  options,
  value,
  onPick,
  backLabel,
  onBack,
  extra,
  testID,
}: {
  /** The setting's name, at the top of the page. */
  title: string;
  /** What the setting is for: one paragraph, here and not in the menu. */
  about?: string;
  options: { id: T; label: string; sub?: string }[];
  value: T;
  onPick: (id: T) => void;
  backLabel: string;
  onBack: () => void;
  /** Something to read under the choices (what the setting looks like). */
  extra?: ReactNode;
  testID?: string;
}) {
  return (
    <SettingsPage title={title} onBack={onBack} backLabel={backLabel} testID={testID}>
      {about ? <SettingsAbout testID={testID ? `${testID}-about` : undefined}>{about}</SettingsAbout> : null}
      <View style={s.list}>
        {options.map((o, i) => (
          <SettingsChoice
            key={o.id}
            title={o.label}
            sub={o.sub}
            on={o.id === value}
            onPress={() => onPick(o.id)}
            last={i === options.length - 1}
            testID={testID ? `${testID}-${o.id}` : undefined}
          />
        ))}
      </View>
      {extra ? <View style={s.extra}>{extra}</View> : null}
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  list: { paddingTop: space.sm },
  extra: { paddingHorizontal: gutter, paddingTop: space.md },
});
