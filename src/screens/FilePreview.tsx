/**
 * A file opened from Files, over the whole screen: a picture as it is, a
 * PDF as the server draws its pages (GET /api/files/{id}/pdf/page/{n}.png -
 * nothing native needed), Markdown laid out, text and code as text, a table
 * as rows. Anything else - a video, a model, an archive - goes to another
 * app through the share sheet, or onto the phone. Back or the cross closes it.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  PixelRatio,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type TableData, type TextHead, type WorkbenchClient } from '../api/client';
import type { StoredFile } from '../api/types';
import { Appear } from '../components/Appear';
import { FileThumb } from '../components/FileThumb';
import { Download, Ellipsis, Share, X } from '../components/icons';
import { Markdown } from '../components/Markdown';
import { ActionList, Sheet, type Action } from '../components/Sheet';
import { Button, ErrorText, IconButton } from '../components/ui';
import { previewWorth, size, viewerOf } from '../lib/files';
import { canSave } from '../lib/share';
import { shortTime } from '../lib/time';
import { colors, fonts, gutter, motion, radius, space, type } from '../theme/tokens';

const TEXT_MAX = 256 * 1024;

export function FilePreview({
  client,
  file,
  actions,
  onShare,
  onSave,
  onClose,
}: {
  client: WorkbenchClient | null;
  file: StoredFile;
  /** What else can be done with it (rename, move, delete, save to My files): the preview closes first. */
  actions: Action[];
  onShare: (f: StoredFile) => Promise<void>;
  onSave: (f: StoredFile) => Promise<void>;
  onClose: () => void;
}) {
  const [viewer, setViewer] = useState(() => viewerOf(file));
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (what: 'share' | 'save') => {
    setBusy(what);
    setError(null);
    try {
      await (what === 'share' ? onShare(file) : onSave(file));
    } catch (e) {
      setError((e as Error).message || 'That did not work.');
    } finally {
      setBusy(null);
    }
  };

  const meta = [size(file.bytes), shortTime(file.created_at), file.by?.name].filter(Boolean).join(' · ');

  return (
    <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={s.safe} edges={['top', 'bottom', 'left', 'right']} testID="file-preview">
        <Appear duration={motion.sheet}>
          <View style={s.head}>
            <IconButton icon={X} label="Close" onPress={onClose} testID="preview-close" />
            <View style={s.title}>
              <Text style={s.name} numberOfLines={1} ellipsizeMode="middle">
                {file.name}
              </Text>
              <Text style={s.meta} numberOfLines={1}>
                {meta}
              </Text>
            </View>
            <IconButton
              icon={Share}
              label="Share or open in another app"
              onPress={() => run('share')}
              disabled={!!busy}
              testID="preview-share"
            />
            {actions.length || canSave ? (
              <IconButton icon={Ellipsis} label="More" onPress={() => setMore(true)} testID="preview-more" />
            ) : null}
          </View>
          {error ? (
            <View style={s.msg}>
              <ErrorText>{error}</ErrorText>
            </View>
          ) : null}
          <View style={s.body}>
            {viewer === 'image' ? (
              <Picture client={client} file={file} onFail={() => setViewer('other')} />
            ) : viewer === 'pdf' ? (
              <Pdf client={client} file={file} onFail={() => setViewer('other')} />
            ) : viewer === 'markdown' || viewer === 'text' ? (
              <TextView client={client} file={file} markdown={viewer === 'markdown'} />
            ) : viewer === 'table' ? (
              <TableView client={client} file={file} onFail={() => setViewer('text')} />
            ) : (
              <Other client={client} file={file} busy={busy} onShare={() => run('share')} onSave={() => run('save')} />
            )}
          </View>
        </Appear>
      </SafeAreaView>
      {more ? (
        <Sheet onClose={() => setMore(false)} title={file.name} testID="preview-actions">
          <ActionList
            actions={[
              ...(canSave
                ? [
                    {
                      id: 'save-phone',
                      label: 'Save to phone',
                      icon: Download,
                      onPress: () => {
                        setMore(false);
                        run('save');
                      },
                    },
                  ]
                : []),
              ...actions.map((a) => ({
                ...a,
                onPress: () => {
                  setMore(false);
                  onClose();
                  a.onPress();
                },
              })),
            ]}
          />
        </Sheet>
      ) : null}
    </Modal>
  );
}

function Waiting({ label }: { label: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.inkDim} accessibilityLabel={label} />
    </View>
  );
}

function Failed({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={s.center}>
      <ErrorText>{text}</ErrorText>
      {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

/**
 * A picture, as large as the screen shows it: the server's copy at the
 * screen's size (GET /thumb?px=) when the original is large, else - or from
 * a server without sizes, or when that copy fails - the original.
 */
function Picture({ client, file, onFail }: { client: WorkbenchClient | null; file: StoredFile; onFail: () => void }) {
  const [loaded, setLoaded] = useState(false);
  // A small picture is shown as it is, at once; a large one waits for the server's copy.
  const [shown, setShown] = useState<{ uri: string; sized: boolean } | null>(() =>
    client && !previewWorth(file) ? { uri: client.fileUrl(file.id, true), sized: false } : null,
  );
  const { width, height } = useWindowDimensions();
  const px = Math.round(Math.max(width, height) * PixelRatio.get());
  useEffect(() => {
    if (!client || !previewWorth(file)) return;
    const original = { uri: client.fileUrl(file.id, true), sized: false };
    let live = true;
    client.previewUri(file.id, px).then(
      (uri) => live && setShown(uri ? { uri, sized: true } : original),
      () => live && setShown(original),
    );
    return () => {
      live = false;
    };
    // The screen turning does not fetch it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, file.id]);
  if (!client) return null;
  return (
    <View style={s.flex}>
      {shown ? (
        <Image
          testID="preview-image"
          source={client.imageSource(shown.uri)}
          style={s.flex}
          resizeMode="contain"
          onLoad={() => setLoaded(true)}
          onError={() => (shown.sized ? setShown({ uri: client.fileUrl(file.id, true), sized: false }) : onFail())}
          accessibilityLabel={file.name}
        />
      ) : null}
      {!loaded ? (
        <View style={StyleSheet.absoluteFill}>
          <Waiting label="Loading the picture" />
        </View>
      ) : null}
    </View>
  );
}

function Pdf({ client, file, onFail }: { client: WorkbenchClient | null; file: StoredFile; onFail: () => void }) {
  const [pages, setPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(1);
  const { width } = useWindowDimensions();

  const load = useCallback(() => {
    if (!client) return;
    client.pdfPages(file.id).then(
      (n) => setPages(Math.max(1, n)),
      (e) => {
        if (e instanceof ApiError && (e.status === 413 || e.status === 415 || e.status === 422)) onFail();
        else setError(e instanceof ApiError ? e.message : 'The PDF could not be read.');
      },
    );
  }, [client, file.id, onFail]);

  useEffect(load, [load]);

  const seen = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.item;
    if (typeof first === 'number') setAt(first);
  }, []);

  if (error)
    return (
      <Failed
        text={error}
        onRetry={() => {
          setError(null);
          load();
        }}
      />
    );
  if (!pages || !client) return <Waiting label="Reading the PDF" />;
  const pageWidth = Math.min(width, 900) - 2 * space.sm;
  return (
    <View style={s.flex}>
      <FlatList
        indicatorStyle="white"
        testID="pdf-pages"
        data={Array.from({ length: pages }, (_, i) => i + 1)}
        keyExtractor={(n) => String(n)}
        renderItem={({ item }) => (
          <PdfPage source={client.imageSource(client.pdfPageUrl(file.id, item))} width={pageWidth} n={item} />
        )}
        contentContainerStyle={s.pages}
        initialNumToRender={2}
        windowSize={5}
        onViewableItemsChanged={seen}
        viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
      />
      {pages > 1 ? (
        <View style={s.pageTag} pointerEvents="none">
          <Text style={s.pageText}>
            {at} / {pages}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function PdfPage({
  source,
  width,
  n,
}: {
  source: { uri: string; headers?: Record<string, string> };
  width: number;
  n: number;
}) {
  // A4 until the page itself says how tall it is.
  const [ratio, setRatio] = useState(1.414);
  return (
    <Image
      testID={`pdf-page-${n}`}
      source={source}
      style={[s.page, { width, height: width * ratio }]}
      resizeMode="contain"
      onLoad={(e) => {
        const src = e.nativeEvent?.source;
        if (src?.width && src?.height) setRatio(src.height / src.width);
      }}
      accessibilityLabel={`Page ${n}`}
    />
  );
}

function TextView({ client, file, markdown }: { client: WorkbenchClient | null; file: StoredFile; markdown: boolean }) {
  const [got, setGot] = useState<TextHead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    if (!client) return;
    client
      .fileText(file.id, TEXT_MAX)
      .then(setGot, (e) => setError(e instanceof ApiError ? e.message : 'The file could not be read.'));
  }, [client, file.id]);
  useEffect(load, [load]);
  if (error)
    return (
      <Failed
        text={error}
        onRetry={() => {
          setError(null);
          load();
        }}
      />
    );
  if (!got) return <Waiting label="Reading the file" />;
  return (
    <ScrollView contentContainerStyle={s.textPad} indicatorStyle="white" testID="preview-text">
      {markdown ? (
        <Markdown text={got.text} />
      ) : (
        <Text style={s.code} selectable>
          {got.text}
        </Text>
      )}
      {got.cut ? <Text style={s.note}>The first {size(TEXT_MAX)} are shown. Share it to read the rest.</Text> : null}
    </ScrollView>
  );
}

function TableView({ client, file, onFail }: { client: WorkbenchClient | null; file: StoredFile; onFail: () => void }) {
  const [got, setGot] = useState<TableData | null>(null);
  useEffect(() => {
    if (!client) return;
    client.table(file.id).then(setGot, onFail);
  }, [client, file.id, onFail]);
  if (!got) return <Waiting label="Reading the table" />;
  return (
    <ScrollView contentContainerStyle={s.textPad} indicatorStyle="white" testID="preview-table">
      <ScrollView horizontal indicatorStyle="white">
        <View>
          {got.rows.map((row, i) => (
            <View key={i} style={[s.tr, i === 0 && s.th]}>
              {row.map((cell, j) => (
                <Text key={j} style={[s.td, i === 0 && s.thText]} numberOfLines={2}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      {got.truncated ? (
        <Text style={s.note}>
          The first {got.rows.length} of {got.total} rows are shown.
        </Text>
      ) : null}
    </ScrollView>
  );
}

function Other({
  client,
  file,
  busy,
  onShare,
  onSave,
}: {
  client: WorkbenchClient | null;
  file: StoredFile;
  busy: 'share' | 'save' | null;
  onShare: () => void;
  onSave: () => void;
}) {
  return (
    <View style={s.center} testID="preview-other">
      <FileThumb client={client} file={file} size={96} />
      <Text style={s.otherName} numberOfLines={2}>
        {file.name}
      </Text>
      <Text style={[s.meta, s.centered]}>This file opens in another app on the phone.</Text>
      <View style={s.otherRow}>
        <Button
          label="Open or share"
          variant="primary"
          busy={busy === 'share'}
          onPress={onShare}
          testID="preview-open"
        />
        {canSave ? <Button label="Save to phone" busy={busy === 'save'} onPress={onSave} /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  head: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { flex: 1, minWidth: 0, paddingHorizontal: space.xs },
  name: { fontFamily: fonts.sansSemi, fontSize: type.title - 1, color: colors.ink },
  meta: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  centered: { textAlign: 'center' },
  msg: { paddingHorizontal: gutter, paddingVertical: space.xs },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  pages: { paddingVertical: space.sm, gap: space.sm, alignItems: 'center' },
  page: { backgroundColor: colors.inkBright, borderRadius: 2 },
  pageTag: {
    position: 'absolute',
    bottom: space.md,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.round,
    backgroundColor: colors.surface2,
  },
  pageText: { fontFamily: fonts.sansMedium, fontSize: type.small, color: colors.ink },
  textPad: { padding: gutter, gap: space.md },
  code: { fontFamily: fonts.mono, fontSize: type.small, lineHeight: 20, color: colors.ink },
  note: { fontFamily: fonts.sans, fontSize: type.small, color: colors.inkDim },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
  th: { borderBottomColor: colors.pressed },
  td: {
    width: 132,
    paddingVertical: 8,
    paddingRight: 12,
    fontFamily: fonts.sans,
    fontSize: type.small,
    color: colors.ink,
  },
  thText: { fontFamily: fonts.sansSemi },
  otherName: { fontFamily: fonts.sansSemi, fontSize: type.title, color: colors.ink, textAlign: 'center' },
  otherRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
