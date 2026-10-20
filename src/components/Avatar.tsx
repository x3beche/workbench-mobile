/**
 * The signed-in person's round picture: the one they put on Workbench when
 * there is one (fetched once per version and kept for the session), else
 * their initials. The children (a dot, say) sit over its edge.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { WorkbenchClient } from '../api/client';
import type { User } from '../api/types';
import { initials } from '../lib/groups';
import { colors, fonts } from '../theme/tokens';

const pictures = new Map<string, string | null>();

export function Avatar({
  client,
  user,
  size,
  fontSize,
  children,
}: {
  client: WorkbenchClient | null;
  user: User | null;
  size: number;
  fontSize: number;
  children?: ReactNode;
}) {
  // Kept per server and person: two accounts never share a picture.
  const key = user?.has_avatar ? `${client?.base ?? ''}|${user.id}:${user.avatar_v ?? ''}` : '';
  // The picture fetched for a key; one already fetched (by the drawer, say) is shown at once.
  const [got, setGot] = useState<{ key: string; uri: string | null } | null>(null);
  const uri = !key ? null : got?.key === key ? got.uri : (pictures.get(key) ?? null);
  useEffect(() => {
    if (!key || !client || !user || pictures.has(key)) return;
    let live = true;
    client
      .avatar(user.id, user.avatar_v)
      .then((pic) => {
        pictures.set(key, pic);
        if (live) setGot({ key, uri: pic });
      })
      .catch(() => undefined); // offline for a moment: the initials stay, the next open asks again
    return () => {
      live = false;
    };
  }, [client, key, user]);
  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[s.box, round]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={round}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          testID="avatar-picture"
        />
      ) : (
        <Text style={[s.text, { fontSize }]}>{initials(user?.name || user?.email)}</Text>
      )}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.hover },
  text: { fontFamily: fonts.sansSemi, color: colors.ink },
});
