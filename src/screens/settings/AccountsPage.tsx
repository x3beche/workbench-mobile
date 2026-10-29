/**
 * Settings > Accounts: every account kept on the phone, the open one checked;
 * a tap opens another, Add account signs a new one in. Signing one out is the
 * row's own button, red, and it asks first - it takes that account off this
 * phone and no other.
 *
 * The list is the same list every Settings page draws (components/SettingsList):
 * the account's picture takes the icon's column, its server the second line.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { displayServer } from '../../api/server';
import { accountStrings } from '../../components/accountStrings';
import { Avatar } from '../../components/Avatar';
import { LogOut, Plus } from '../../components/icons';
import {
  SettingsChoice,
  SettingsGroup,
  SettingsNote,
  SettingsPage,
  SettingsRow,
} from '../../components/SettingsList';
import { Dialog } from '../../components/Sheet';
import { IconButton } from '../../components/ui';
import type { SettingsStrings } from '../../lib/settingsStrings';
import type { Account } from '../../state/accounts';
import { useSession } from '../../state/session';
import { colors, gutter, space, type } from '../../theme/tokens';
import type { UiLang } from '../../update/strings';

export function AccountsPage({
  t,
  ui,
  onBack,
}: {
  t: SettingsStrings;
  ui: UiLang;
  onBack: () => void;
}) {
  const { account, accounts, switchTo, remove, addAnother, client, clientFor } = useSession();
  const a = accountStrings(ui);
  const [asking, setAsking] = useState<Account | null>(null);

  return (
    <SettingsPage title={a.accounts} onBack={onBack} backLabel={t.back} testID="settings-accounts-page">
      <SettingsGroup>
        {accounts.map((x) => {
          const on = x.id === account?.id;
          const who = x.user?.name || x.user?.email || a.localMode;
          return (
            <SettingsChoice
              key={x.id}
              title={who}
              sub={`${x.user?.email && x.user?.name ? `${x.user.email} · ` : ''}${displayServer(x.server)}`}
              on={on}
              onPress={() => !on && switchTo(x.id)}
              leading={
                <View style={s.leading}>
                  <Avatar client={on ? client : clientFor(x)} user={x.user} size={26} fontSize={type.micro} />
                </View>
              }
              trailing={
                <IconButton
                  icon={LogOut}
                  size={18}
                  color={colors.inkDim}
                  label={a.removeLabel(who)}
                  onPress={() => setAsking(x)}
                  testID={`account-remove-${x.id}`}
                />
              }
              last={false}
              testID={`account-${x.id}`}
            />
          );
        })}
        {/* One list: another account is the row under the ones it can open. */}
        <SettingsRow
          icon={Plus}
          title={a.addAccount}
          sub={t.accountsAddAbout}
          onPress={addAnother}
          last
          testID="account-add"
        />
      </SettingsGroup>
      <View style={s.note}>
        <SettingsNote>{t.accountsNote}</SettingsNote>
      </View>
      {asking ? (
        <Dialog
          title={a.removeTitle(asking.user?.name || asking.user?.email || a.localMode)}
          text={a.removeText}
          confirm={a.remove}
          cancel={a.cancel}
          danger
          testID="account-remove"
          onCancel={() => setAsking(null)}
          onConfirm={async () => {
            const x = asking;
            setAsking(null);
            await remove(x.id);
          }}
        />
      ) : null}
    </SettingsPage>
  );
}

const s = StyleSheet.create({
  leading: { width: 28, alignItems: 'flex-start' },
  note: { paddingHorizontal: gutter, paddingTop: space.md },
});
