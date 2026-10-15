/**
 * The small square at the start of a Files row: the server's picture of the
 * file (GET /api/files/{id}/mini - a photo, a PDF's first page, a model's
 * view) once it is there, its kind's icon until then and for files with no
 * picture. 202 means the server is still making it: the icon stays and the
 * picture is asked for again after the time the server gives, a few times.
 * Pictures are kept for as long as the app runs, by the file's content.
 */
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import type { WorkbenchClient } from '../api/client';
import type { FileFolder, StoredFile } from '../api/types';
import { hasMini, iconOf, type FileIcon } from '../lib/files';
import { colors, radius } from '../theme/tokens';
import {
  Box,
  CircuitBoard,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileMusic,
  FilePlay,
  FileSpreadsheet,
  FileText,
  Folder,
  type LucideIcon,
} from './icons';
import { Glyph } from './ui';

const ICON: Record<FileIcon, LucideIcon> = {
  folder: Folder,
  image: FileImage,
  video: FilePlay,
  audio: FileMusic,
  pdf: FileText,
  table: FileSpreadsheet,
  archive: FileArchive,
  model: Box,
  board: CircuitBoard,
  code: FileCode,
  text: FileText,
  file: File,
};

/** How many times a picture still being made is asked for before the icon stays. */
const TRIES = 6;

const pictures = new Map<string, string>();
const none = new Set<string>();

/** Forget what was learnt (tests; another server). */
export function forgetThumbs() {
  pictures.clear();
  none.clear();
}

export function FileThumb({
  client,
  file,
  folder,
  size = 40,
}: {
  client: WorkbenchClient | null;
  file?: StoredFile;
  folder?: FileFolder;
  size?: number;
}) {
  const key = file ? `${file.id}:${file.sha256 ?? file.bytes}` : '';
  const [uri, setUri] = useState<string | null>(() => pictures.get(key) ?? null);

  const id = file?.id;
  const wanted = !!file && hasMini(file);
  useEffect(() => {
    if (!id || !client || !wanted || pictures.has(key) || none.has(key)) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async (n: number) => {
      try {
        const got = await client.mini(id);
        if (!live) return;
        if (got.state === 'ready') {
          pictures.set(key, got.uri);
          setUri(got.uri);
        } else if (got.state === 'later' && n + 1 < TRIES) {
          timer = setTimeout(() => ask(n + 1), got.seconds * 1000);
        } else if (got.state === 'none') none.add(key);
      } catch {
        // Offline for a moment: the icon stays; the next time the row is drawn it asks again.
      }
    };
    ask(0);
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [client, id, wanted, key]);

  const box = { width: size, height: size, borderRadius: radius.md };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[s.box, box]}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        testID={file ? `thumb-${file.id}` : undefined}
      />
    );
  }
  const icon = folder ? Folder : ICON[file ? iconOf(file) : 'file'];
  return (
    <View style={[s.box, s.icon, box]}>
      <Glyph icon={icon} size={Math.round(size * 0.5)} color={colors.inkDim} />
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: colors.surface2 },
  icon: { alignItems: 'center', justifyContent: 'center' },
});
