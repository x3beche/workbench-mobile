/**
 * A Claude session's pictures (screens/ClaudeSessionScreen.tsx): a prompt's
 * or a sent line's as thumbnails, the screenshots a tool read smaller, and
 * one shown whole over the screen. Each is read through the account's own
 * client (its X-Workbench-Session, as every request; a browser's <img> could
 * not send it) as a data: URI, kept for the account while the app runs; one
 * the server no longer keeps (404) says so in its place.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { WorkbenchClient } from '../api/client';
import { colors, fonts, radius, space, type } from '../theme/tokens';
import { X } from './icons';
import { Glyph } from './ui';

/** The pictures read, per account and address; the oldest let go past this many. */
const KEEP = 40;
const cache = new Map<string, string | 'gone'>();
const asking = new Map<string, Promise<string | 'gone' | null>>();

/** A picture of the session's, read once (null while it could not be read now). */
export function readPicture(client: WorkbenchClient, path: string): Promise<string | 'gone' | null> {
  const k = `${client.liveKey}|${path}`;
  const held = cache.get(k);
  if (held) return Promise.resolve(held);
  let p = asking.get(k);
  if (!p) {
    p = client.wbcImage(path).then(
      (got) => {
        asking.delete(k);
        if (got) {
          cache.set(k, got);
          while (cache.size > KEEP) cache.delete(cache.keys().next().value as string);
        }
        return got;
      },
      () => {
        asking.delete(k);
        return null;
      },
    );
    asking.set(k, p);
  }
  return p;
}

/** For tests: nothing kept. */
export function forgetPictures(): void {
  cache.clear();
  asking.clear();
}

export function WbcThumb({
  client,
  path,
  label,
  small = false,
  goneText,
  onOpen,
  testID,
}: {
  client: WorkbenchClient | null;
  path: string;
  label: string;
  /** A tool's: smaller. */
  small?: boolean;
  goneText: string;
  onOpen: (uri: string) => void;
  testID?: string;
}) {
  const [got, setGot] = useState<string | 'gone' | null | undefined>(undefined);
  useEffect(() => {
    if (!client) return;
    let live = true;
    readPicture(client, path).then((v) => live && setGot(v));
    return () => {
      live = false;
    };
  }, [client, path]);
  const box = small ? s.small : s.thumb;
  if (got === 'gone') {
    return (
      <View style={[box, s.gone]} testID={testID ? `${testID}-gone` : undefined} accessibilityLabel={goneText}>
        <Text style={s.goneText}>{goneText}</Text>
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={() => typeof got === 'string' && onOpen(got)}
      disabled={typeof got !== 'string'}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      style={({ pressed }) => [box, s.ground, pressed && s.pressed]}
    >
      {typeof got === 'string' ? (
        <Image source={{ uri: got }} style={s.fill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : got === undefined ? (
        <ActivityIndicator size="small" color={colors.inkDim} />
      ) : null}
    </Pressable>
  );
}

/** One picture over the whole screen: a tap on it, the cross or Back closes it. */
export function PictureViewer({
  uri,
  label,
  closeLabel,
  onClose,
}: {
  uri: string;
  label: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.veil} onPress={onClose} accessibilityLabel={closeLabel} testID="wbc-viewer">
        <SafeAreaView style={s.viewerSafe} edges={['top', 'bottom', 'left', 'right']}>
          <Image source={{ uri }} style={s.whole} resizeMode="contain" accessibilityLabel={label} />
        </SafeAreaView>
      </Pressable>
      <SafeAreaView style={s.closeWrap} edges={['top', 'right']} pointerEvents="box-none">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          hitSlop={8}
          style={({ pressed }) => [s.close, pressed && s.pressed]}
          testID="wbc-viewer-close"
        >
          <Glyph icon={X} size={18} color={colors.ink} />
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  thumb: { width: 132, height: 100, borderRadius: radius.md, overflow: 'hidden' },
  small: { width: 88, height: 66, borderRadius: radius.md, overflow: 'hidden' },
  ground: { backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  pressed: { opacity: 0.75 },
  gone: {
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.sm,
    justifyContent: 'center',
  },
  goneText: { fontFamily: fonts.sans, fontSize: type.tiny, lineHeight: 16, color: colors.inkDim },
  veil: { flex: 1, backgroundColor: colors.scrim },
  viewerSafe: { flex: 1, padding: space.md },
  whole: { flex: 1, width: '100%' },
  closeWrap: { position: 'absolute', top: 0, right: 0 },
  close: {
    margin: space.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
});
