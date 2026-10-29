/**
 * Files, as on the web: My files (one's own folders and uploads), In the app
 * (what the rest of Workbench keeps - projects, the Chat's files, Parts,
 * agents - read-only here) and Deleted files (kept for the server's days,
 * 30 by default). Folders open in place with the way back above the list;
 * a file opens in the preview. A long press, or the row's "…", offers what
 * may be done with it: share, rename, move, delete, save a copy to My files,
 * restore. Uploads come from the phone's files, photos or camera into the
 * folder that is open. What the server refuses is said in its own words.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, type VoiceLang, type WorkbenchClient } from '../api/client';
import type { FileFolder, StoredFile, TrashFile, UploadPart, User } from '../api/types';

import { FileThumb } from '../components/FileThumb';
import { ScreenHeader } from '../components/ScreenHeader';
import { filesStrings } from '../lib/filesStrings';
import { uiLang } from '../update/strings';
import { Toast, useToast } from '../components/Toast';
import {
  Camera,
  ChevronRight,
  Download,
  Ellipsis,
  FileDown,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Images,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Share,
  Trash,
  Upload,
  X,
} from '../components/icons';
import { ActionList, Dialog, Sheet, type Action } from '../components/Sheet';
import { Tabs } from '../components/Tabs';
import { Button, ErrorText, Glyph, IconButton } from '../components/ui';
import {
  appAt,
  appMissing,
  countIn,
  crumbs,
  folderChoices,
  mayDelete,
  mineAt,
  plural,
  rightsOf,
  search,
  searchTrash,
  size,
  typeOf,
  under,
  type FilesData,
  type Side,
} from '../lib/files';
import { canSave, saveFile, shareFile } from '../lib/share';
import { shortTime } from '../lib/time';
import {
  colors,
  fonts,
  gutter,
  indicatorStyle,
  radius,
  space,
  touch,
  type,
} from '../theme/tokens';
import { FilePreview } from './FilePreview';

export interface FilesHandle {
  /** Android's Back: up a folder, or out of a search. False when there is nowhere to go back to here. */
  back: () => boolean;
}

type Row =
  | { key: string; kind: 'folder'; folder: FileFolder }
  | { key: string; kind: 'file'; file: StoredFile }
  | { key: string; kind: 'trash'; file: TrashFile };

type Target =
  { kind: 'file'; file: StoredFile } | { kind: 'folder'; folder: FileFolder } | { kind: 'trash'; file: TrashFile };

type Ask =
  | { what: 'rename'; target: Target }
  | { what: 'delete'; target: Target }
  | { what: 'purge'; file: TrashFile }
  | { what: 'new-folder' };

const SIDES: Side[] = ['mine', 'app', 'trash'];

const errText = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : (e as Error)?.message || fallback;

export const FilesScreen = forwardRef<
  FilesHandle,
  {
    client: WorkbenchClient | null;
    user: User | null;
    /** What this account may do (GET /api/auth/state `can`). */
    can: string[] | null;
    wide?: boolean;
    onMenu?: () => void;
    /** The app's language: Files' own words follow it. */
    lang?: VoiceLang;
  }
>(function FilesScreen({ client, user, can, wide = false, onMenu, lang = 'auto' }, ref) {
  const f = useMemo(() => filesStrings(uiLang(lang)), [lang]);
  const rights = useMemo(() => rightsOf(can ?? ['view', 'draw', 'delete']), [can]);
  const [side, setSide] = useState<Side>('mine');
  const [here, setHere] = useState<Record<'mine' | 'app', string>>({ mine: '', app: '' });
  const [data, setData] = useState<FilesData | null>(null);
  const [trash, setTrash] = useState<{ days: number; files: TrashFile[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [finding, setFinding] = useState(false);
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<Target | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [picker, setPicker] = useState<{ mode: 'move' | 'copy'; target: Target } | null>(null);
  const [adding, setAdding] = useState(false);
  /** What is being uploaded now, and how many of them have gone (each file its own request). */
  const [uploading, setUploading] = useState<{ name: string; done: number; all: number } | null>(null);
  /** The upload's Stop: the one in hand ends, and none after it starts. */
  const uploadStop = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<StoredFile | null>(null);
  /** One line at the foot of the screen about what just happened, and its clock. */
  const { toast, say } = useToast();
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );


  const hereRef = useRef(here);
  useEffect(() => {
    hereRef.current = here;
  }, [here]);

  // One's own uploads, the folders, and the read-only folder open in In the
  // app - one at a time from a server that answers so (`?under=`); an older
  // one answers the whole tree, and every upload with `?area=own` ignored.
  const load = useCallback((): Promise<void> => {
    if (!client) return Promise.resolve();
    const appHere = hereRef.current.app;
    return Promise.all([
      client.listFiles(true),
      client.folders(),
      // An older server without the read-only folders still has My files.
      client.virtualFolder(appHere).catch(() => null),
    ]).then(
      ([files, folders, got]) => {
        if (!mounted.current) return;
        setData(
          !got
            ? { files, folders, tree: null }
            : 'folder' in got
              ? { files, folders, tree: null, app: { [appHere]: got.folder } }
              : { files, folders, tree: got.tree, every: files },
        );
        setError(null);
      },
      (e) => {
        if (mounted.current) setError(errText(e, f.couldNotRead));
      },
    );
  }, [client, f]);

  const loadTrash = useCallback((): Promise<void> => {
    if (!client) return Promise.resolve();
    return client.filesTrash().then(
      (got) => {
        if (mounted.current) setTrash(got);
      },
      (e) => {
        if (mounted.current) setError(errText(e, f.deletedCouldNotRead));
      },
    );
  }, [client, f]);

  useEffect(() => {
    load();
  }, [load]);

  // A read-only folder not read yet, from a server that answers one at a time.
  const missing = !!data && side === 'app' && appMissing(data, here.app);
  useEffect(() => {
    if (!client || !missing) return;
    const id = here.app;
    let live = true;
    client.virtualFolder(id).then(
      (got) => {
        if (!live || !mounted.current) return;
        setData((d) =>
          !d
            ? d
            : 'folder' in got
              ? { ...d, app: { ...d.app, [id]: got.folder } }
              : { ...d, tree: got.tree, every: d.files },
        );
      },
      (e) => {
        if (live && mounted.current) setError(errText(e, f.folderCouldNotRead));
      },
    );
    return () => {
      live = false;
    };
  }, [client, missing, here.app, f]);

  // A search of In the app looks through everything: the whole tree and every upload, read once.
  const wantAll = !!data && side === 'app' && !!q.trim() && !data.tree;
  useEffect(() => {
    if (!client || !wantAll) return;
    let live = true;
    Promise.all([client.virtualTree(), client.listFiles()]).then(
      ([tree, every]) => {
        if (live && mounted.current) setData((d) => (d ? { ...d, tree, every } : d));
      },
      (e) => {
        if (live && mounted.current) setError(errText(e, f.searchFailed));
      },
    );
    return () => {
      live = false;
    };
  }, [client, wantAll, f]);

  useEffect(() => {
    if (side === 'trash') loadTrash();
  }, [side, loadTrash]);

  const refresh = async () => {
    setRefreshing(true);
    await (side === 'trash' ? loadTrash() : load());
    setRefreshing(false);
  };

  const at = side === 'trash' ? '' : here[side];
  const go = (id: string) => {
    if (side !== 'trash') setHere((h) => ({ ...h, [side]: id }));
  };
  const trail = useMemo(() => (data ? crumbs(data, side, at) : []), [data, side, at]);

  useImperativeHandle(
    ref,
    () => ({
      back: () => {
        if (finding) {
          setFinding(false);
          setQ('');
          return true;
        }
        if (side !== 'trash' && at) {
          go(trail.length > 1 ? trail[trail.length - 2].id : '');
          return true;
        }
        return false;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finding, side, at, trail],
  );

  const rows = useMemo<Row[]>(() => {
    if (side === 'trash') {
      return searchTrash(trash?.files ?? [], q).map((f) => ({ key: `t:${f.id}`, kind: 'trash', file: f }));
    }
    if (!data) return [];
    const got = q.trim() ? search(data, side, q) : side === 'app' ? appAt(data, at) : mineAt(data, at);
    return [
      ...got.folders.map((f) => ({ key: `d:${f.id}`, kind: 'folder' as const, folder: f })),
      ...got.files.map((f) => ({ key: `f:${f.id}`, kind: 'file' as const, file: f })),
    ];
  }, [data, trash, side, at, q]);

  // ---- what can be done -------------------------------------------------

  const roTarget = (t: Target) =>
    t.kind === 'folder' ? !!t.folder.ro || side === 'app' : t.kind === 'file' ? !!t.file.ro || !!t.file.where : false;

  const share = async (f: StoredFile) => {
    if (!client) return;
    const blob = await client.fileBlob(f.id);
    await shareFile(blob, f.name, f.content_type || typeOf(f.name));
  };

  const keep = async (f: StoredFile) => {
    if (!client) return;
    const blob = await client.fileBlob(f.id);
    const where = await saveFile(blob, f.name, f.content_type || typeOf(f.name));
    say(`Saved to ${where}`);
  };

  const doing = async (job: () => Promise<unknown>, done: string, fallback: string) => {
    try {
      await job();
      say(done);
    } catch (e) {
      say(errText(e, fallback), true);
    }
  };

  const restore = (file: TrashFile) =>
    doing(
      async () => {
        const got = await client!.restoreFiles([file.id]);
        if (got.refused.length) throw new Error(got.refused[0].why || f.notRestored);
        await Promise.all([loadTrash(), load()]);
      },
      f.restored(file.name, file.folder_path || f.mine),
      f.notRestored,
    );

  const actionsFor = (t: Target, inPreview = false): Action[] => {
    const ro = roTarget(t);
    const out: Action[] = [];
    if (t.kind === 'trash') {
      out.push({ id: 'restore', label: f.restore, icon: RotateCcw, onPress: () => restore(t.file) });
      if (rights.change && mayDelete({ by: t.file.by }, rights, user?.id))
        out.push({
          id: 'purge',
          label: f.deleteForever,
          icon: Trash,
          danger: true,
          onPress: () => setAsk({ what: 'purge', file: t.file }),
        });
      return out;
    }
    if (t.kind === 'file' && !inPreview) {
      out.push({ id: 'open', label: f.openFile, icon: FolderOpen, onPress: () => setPreview(t.file) });
      out.push({
        id: 'share',
        label: f.share,
        icon: Share,
        onPress: () => share(t.file).catch((e) => say(errText(e, f.notShared), true)),
      });
      if (canSave)
        out.push({
          id: 'save-phone',
          label: f.saveToPhone,
          icon: Download,
          onPress: () => keep(t.file).catch((e) => say(errText(e, f.notSaved), true)),
        });
    }
    if (ro) {
      if (t.kind === 'file' && rights.change)
        out.push({
          id: 'copy',
          label: f.saveToMine,
          icon: FileDown,
          onPress: () => setPicker({ mode: 'copy', target: t }),
        });
      return out;
    }
    if (rights.change) {
      out.push({ id: 'rename', label: f.rename, icon: Pencil, onPress: () => setAsk({ what: 'rename', target: t }) });
      out.push({ id: 'move', label: 'Move', icon: FolderInput, onPress: () => setPicker({ mode: 'move', target: t }) });
    }
    if (t.kind === 'file' ? mayDelete(t.file, rights, user?.id) : rights.change)
      out.push({
        id: 'delete',
        label: f.delete,
        icon: Trash,
        danger: true,
        onPress: () => setAsk({ what: 'delete', target: t }),
      });
    return out;
  };

  const runMenu = (t: Target, fn: () => void) => {
    setMenu(null);
    fn();
    void t;
  };

  const open = (r: Row) => {
    if (r.kind === 'folder') {
      if (q.trim()) {
        setQ('');
        setFinding(false);
      }
      go(r.folder.id);
    } else if (r.kind === 'file') setPreview(r.file);
    else setMenu({ kind: 'trash', file: r.file });
  };

  // ---- uploading ----------------------------------------------------------

  /**
   * One file at a time, so the row can say which one and how far it is, and
   * Stop ends it where it stands. One file failing does not take the others
   * with it: what went through is kept and said.
   */
  const upload = async (parts: UploadPart[]) => {
    if (!client || !parts.length) return;
    const c = client;
    const ctl = new AbortController();
    uploadStop.current = ctl;
    let done = 0;
    let failed = 0;
    try {
      for (const p of parts) {
        if (ctl.signal.aborted) break;
        if (mounted.current) setUploading({ name: p.name, done, all: parts.length });
        try {
          await c.upload([p], here.mine, ctl.signal);
          done += 1;
        } catch (e) {
          if (ctl.signal.aborted) break;
          failed += 1;
          if (parts.length === 1) say(errText(e, f.uploadFailed), true);
        }
      }
      if (done) await load();
      if (!failed && !ctl.signal.aborted) {
        say(parts.length === 1 ? f.uploadedOne(parts[0].name) : f.uploadedMany(parts.length));
      } else if (ctl.signal.aborted) {
        say(done ? f.stoppedAt(done, parts.length) : f.stoppedNothing, true);
      } else {
        say(f.uploadPartial(done, parts.length, failed), true);
      }
    } finally {
      uploadStop.current = null;
      if (mounted.current) setUploading(null);
    }
  };

  const pickFiles = async () => {
    setAdding(false);
    const got = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (got.canceled) return;
    await upload(
      got.assets.map((a) =>
        a.file ? { blob: a.file, name: a.name } : { uri: a.uri, name: a.name, type: a.mimeType || typeOf(a.name) },
      ),
    );
  };

  const pickPhotos = async (camera: boolean) => {
    setAdding(false);
    if (camera) {
      const ok = await ImagePicker.requestCameraPermissionsAsync();
      if (!ok.granted) {
        say(f.cameraBlocked, true);
        return;
      }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images', 'videos'], quality: 1 };
    const got = camera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: 20 });
    if (got.canceled) return;
    await upload(
      got.assets.map((a, i) => {
        const name = a.fileName || `photo-${Date.now()}-${i + 1}.${(a.mimeType || 'image/jpeg').split('/')[1]}`;
        return a.file ? { blob: a.file, name } : { uri: a.uri, name, type: a.mimeType || typeOf(name) };
      }),
    );
  };

  // ---- drawing ----------------------------------------------------------------

  const empty =
    side === 'trash'
      ? trash === null
        ? null
        : q.trim()
          ? f.nothingFound(q.trim())
          : f.nothingDeleted
      : data === null
        ? null
        : q.trim()
          ? f.nothingFound(q.trim())
          : side === 'app'
            ? f.emptyNothing
            : at
              ? f.emptyFolder
              : f.emptyNoFiles;

  const renderRow = ({ item }: { item: Row }) => {
    const target: Target =
      item.kind === 'folder'
        ? { kind: 'folder', folder: item.folder }
        : item.kind === 'trash'
          ? { kind: 'trash', file: item.file }
          : { kind: 'file', file: item.file };
    const name = item.kind === 'folder' ? item.folder.name : item.file.name;
    const meta =
      item.kind === 'folder'
        ? data
          ? countIn(data, side, item.folder.id, item.folder.count, uiLang(lang))
          : ''
        : item.kind === 'trash'
          ? [
              size(item.file.bytes),
              item.file.days_left == null
                ? ''
                : uiLang(lang) === 'tr'
                  ? `${plural(item.file.days_left, 'gün', 'tr')} kaldı`
                  : `${plural(item.file.days_left, 'day')} left`,
              item.file.folder_path ? `from ${item.file.folder_path}` : '',
            ]
              .filter(Boolean)
              .join(' · ')
          : [size(item.file.bytes, uiLang(lang)), shortTime(item.file.created_at, new Date(), uiLang(lang))]
              .filter(Boolean)
              .join(' · ');
    const acts = actionsFor(target);
    return (
      <Pressable
        testID={`file-row-${item.key}`}
        onPress={() => open(item)}
        onLongPress={acts.length ? () => setMenu(target) : undefined}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${meta}`}
        style={s.row}
      >
        {({ pressed }) => (
          <>
            <FileThumb
              client={client}
              file={item.kind === 'folder' ? undefined : item.file}
              folder={item.kind === 'folder' ? item.folder : undefined}
            />
            <View style={s.rowText}>
              <Text style={[s.name, pressed && s.dim]} numberOfLines={1} ellipsizeMode="middle">
                {name}
              </Text>
              <Text style={s.meta} numberOfLines={1}>
                {meta}
              </Text>
            </View>
            {acts.length ? (
              <IconButton
                icon={Ellipsis}
                label={`What to do with ${name}`}
                size={20}
                color={colors.inkDim}
                onPress={() => setMenu(target)}
                testID={`file-more-${item.key}`}
              />
            ) : (
              <View style={s.side} />
            )}
          </>
        )}
      </Pressable>
    );
  };

  const loading = side === 'trash' ? trash === null : data === null || missing || wantAll;
  const canUpload = rights.change && side === 'mine' && !q.trim();

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']} testID="files-screen">
      <ScreenHeader
        title="Files"
        onMenu={wide ? undefined : onMenu}
        menuTestID="files-open-drawer"
        left={wide ? <View style={s.side} /> : undefined}
        center={
          finding ? (
            <View style={s.find}>
              <Glyph icon={Search} size={18} color={colors.inkDim} />
              <TextInput
                testID="files-search"
                style={s.findInput}
                value={q}
                onChangeText={setQ}
                autoFocus
                placeholder={side === 'trash' ? f.searchDeleted : side === 'app' ? f.searchApp : f.searchMine}
                placeholderTextColor={colors.inkDim}
                selectionColor={colors.inkDim}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel={f.search}
              />
            </View>
          ) : undefined
        }
        right={
          <>
            {finding ? (
              <IconButton
                icon={X}
                label={f.closeSearch}
                onPress={() => {
                  setFinding(false);
                  setQ('');
                }}
                testID="files-search-close"
              />
            ) : (
              <IconButton
                icon={Search}
                label={f.search}
                onPress={() => setFinding(true)}
                testID="files-search-open"
              />
            )}
            {canUpload ? (
              <IconButton
                icon={Plus}
                label={f.upload}
                onPress={() => setAdding(true)}
                testID="files-add"
              />
            ) : (
              <View style={s.side} />
            )}
          </>
        }
      />
      <Tabs
        tabs={SIDES.map((id) => ({ id, label: id === 'mine' ? f.mine : id === 'app' ? f.inApp : f.deleted }))}
        value={side}
        onChange={setSide}
        testID="files-tabs"
      />
      {side !== 'trash' && !q.trim() && trail.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.crumbs}
          contentContainerStyle={s.crumbsIn}
          testID="files-crumbs"
        >
          {trail.map((c, i) => {
            const last = i === trail.length - 1;
            return (
              <View key={c.id || 'top'} style={s.crumb}>
                {i ? <Glyph icon={ChevronRight} size={14} color={colors.inkDim} /> : null}
                <Pressable
                  testID={`crumb-${c.id || 'top'}`}
                  onPress={() => go(c.id)}
                  disabled={last}
                  accessibilityRole="button"
                  accessibilityLabel={c.name}
                  hitSlop={8}
                >
                  {({ pressed }) => (
                    <Text style={[s.crumbText, last && s.crumbOn, pressed && s.dim]} numberOfLines={1}>
                      {c.name}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
      {uploading ? (
        <View style={s.uploading} testID="files-uploading">
          <ActivityIndicator size="small" color={colors.inkDim} />
          <Text style={s.meta} numberOfLines={1}>
            Uploading {uploading.name}
            {uploading.all > 1 ? ` (${uploading.done + 1} of ${uploading.all})` : ''}…
          </Text>
          <Button
            label="Stop"
            variant="quiet"
            onPress={() => uploadStop.current?.abort()}
            testID="files-upload-stop"
          />
        </View>
      ) : null}
      <View style={s.flex}>
        <FlatList
          indicatorStyle={indicatorStyle}
          testID="files-list"
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderRow}
          initialNumToRender={20}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.inkDim}
              colors={[colors.ink]}
              progressBackgroundColor={colors.surface2}
            />
          }
          ListHeaderComponent={
            error ? (
              <View style={s.note}>
                <ErrorText>{error}</ErrorText>
                <Button label="Try again" onPress={refresh} testID="files-retry" />
              </View>
            ) : side === 'trash' && trash?.files.length ? (
              <Text style={s.kept}>Kept {trash.days} days, then deleted for good.</Text>
            ) : null
          }
          ListEmptyComponent={
            loading && !error ? (
              <ActivityIndicator style={s.wait} color={colors.inkDim} accessibilityLabel="Reading the files" />
            ) : empty && !error ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>{empty}</Text>
                {canUpload && !at ? (
                  <Button label="Upload" onPress={() => setAdding(true)} testID="files-empty-upload" />
                ) : null}
              </View>
            ) : null
          }
          contentContainerStyle={[s.listPad, wide && s.column]}
        />
        <Toast toast={toast} testID="files-toast" />
      </View>

      {menu ? (
        <Sheet
          onClose={() => setMenu(null)}
          title={menu.kind === 'folder' ? menu.folder.name : menu.file.name}
          testID="file-actions"
        >
          {/* eslint-disable-next-line react-hooks/refs -- refs are read in the actions' handlers, not while drawing */}
          <ActionList actions={actionsFor(menu).map((a) => ({ ...a, onPress: () => runMenu(menu, a.onPress) }))} />
        </Sheet>
      ) : null}

      {adding ? (
        <Sheet
          onClose={() => setAdding(false)}
          title={f.addTo(trail[trail.length - 1]?.name ?? f.mine)}
          testID="upload-sheet"
        >
          <ActionList
            actions={[
              {
                id: 'pick-files',
                label: f.filesOnPhone,
                icon: Upload,
                onPress: () => pickFiles().catch((e) => say(errText(e, f.filesUnreadable), true)),
              },
              {
                id: 'pick-photos',
                label: f.photosVideos,
                icon: Images,
                onPress: () => pickPhotos(false).catch((e) => say(errText(e, f.photosUnreadable), true)),
              },
              ...(Platform.OS === 'web'
                ? []
                : [
                    {
                      id: 'camera',
                      label: f.takePhoto,
                      icon: Camera,
                      onPress: () =>
                        pickPhotos(true).catch((e) => say(errText(e, f.cameraNotOpened), true)),
                    },
                  ]),
              {
                id: 'new-folder',
                label: f.newFolder,
                icon: FolderPlus,
                onPress: () => {
                  setAdding(false);
                  setAsk({ what: 'new-folder' });
                },
              },
            ]}
          />
        </Sheet>
      ) : null}

      {picker && data ? (
        <FolderPicker
          title={picker.mode === 'copy' ? f.saveToMineTitle : f.moveTo}
          folders={data.folders}
          current={
            picker.mode === 'move'
              ? picker.target.kind === 'folder'
                ? picker.target.folder.parent
                : picker.target.kind === 'file'
                  ? picker.target.file.folder
                  : ''
              : null
          }
          exclude={picker.target.kind === 'folder' ? under(data.folders, picker.target.folder.id) : new Set()}
          onClose={() => setPicker(null)}
          onPick={async (to) => {
            if (!client) return;
            const t = picker.target;
            if (picker.mode === 'copy' && t.kind === 'file') {
              const made = await client.copyToMine(t.file.id, to);
              say(`Saved a copy as ${made.name}`);
            } else if (t.kind === 'folder') await client.moveFiles([], [t.folder.id], to);
            else if (t.kind === 'file') await client.moveFiles([t.file.id], [], to);
            setPicker(null);
            if (picker.mode === 'move') say(f.moved);
            await load();
          }}
        />
      ) : null}

      {ask?.what === 'rename' && ask.target.kind !== 'trash' ? (
        <Dialog
          title="Rename"
          confirm="Save"
          input={{
            value: ask.target.kind === 'folder' ? ask.target.folder.name : ask.target.file.name,
            label: 'Name',
          }}
          onCancel={() => setAsk(null)}
          onConfirm={async (name) => {
            if (!client || ask.target.kind === 'trash') return;
            if (ask.target.kind === 'folder') await client.renameFolder(ask.target.folder.id, name);
            else await client.renameFile(ask.target.file.id, name);
            setAsk(null);
            await load();
          }}
        />
      ) : null}
      {ask?.what === 'new-folder' ? (
        <Dialog
          title="New folder"
          confirm="Make"
          input={{ value: '', label: 'Name' }}
          onCancel={() => setAsk(null)}
          onConfirm={async (name) => {
            if (!client) return;
            const made = await client.makeFolder(name, here.mine);
            setAsk(null);
            await load();
            go(made.id);
          }}
        />
      ) : null}
      {ask?.what === 'delete' && ask.target.kind !== 'trash' ? (
        <Dialog
          title={ask.target.kind === 'folder' ? f.deleteFolderQ : f.deleteFileQ}
          text={
            ask.target.kind === 'folder'
              ? `“${ask.target.folder.name}” and everything in it go to Deleted files, kept ${trash?.days ?? 30} days.`
              : `“${ask.target.file.name}” goes to Deleted files, kept ${trash?.days ?? 30} days. Where it was used, it shows as deleted.`
          }
          confirm="Delete"
          danger
          onCancel={() => setAsk(null)}
          onConfirm={async () => {
            if (!client || ask.target.kind === 'trash') return;
            if (ask.target.kind === 'folder') {
              await client.deleteFolder(ask.target.folder.id, true);
              if (at === ask.target.folder.id) go(ask.target.folder.parent);
            } else await client.deleteFile(ask.target.file.id);
            setAsk(null);
            say(f.movedToDeleted);
            await load();
            if (trash) loadTrash();
          }}
        />
      ) : null}
      {ask?.what === 'purge' ? (
        <Dialog
          title="Delete forever?"
          text={`“${ask.file.name}” is deleted for good. This cannot be undone.`}
          confirm="Delete forever"
          danger
          onCancel={() => setAsk(null)}
          onConfirm={async () => {
            if (!client) return;
            await client.purgeFiles([ask.file.id]);
            setAsk(null);
            await loadTrash();
          }}
        />
      ) : null}

      {preview ? (
        <FilePreview
          client={client}
          file={preview}
          // eslint-disable-next-line react-hooks/refs -- refs are read in the actions' handlers, not while drawing
          actions={actionsFor({ kind: 'file', file: preview }, true)}
          onShare={share}
          onSave={keep}
          onClose={() => setPreview(null)}
          lang={lang}
        />
      ) : null}
    </SafeAreaView>
  );
});

/** Where to move something, or where a copy goes: the folders of My files, as a tree. */
function FolderPicker({
  title,
  folders,
  current,
  exclude,
  onClose,
  onPick,
}: {
  title: string;
  folders: FileFolder[];
  /** Where it is now (moving it there does nothing), or null for a copy. */
  current: string | null;
  exclude: Set<string>;
  onClose: () => void;
  onPick: (to: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const choices = useMemo(() => folderChoices(folders).filter((c) => !exclude.has(c.id)), [folders, exclude]);
  const pick = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await onPick(id);
    } catch (e) {
      setError(errText(e, 'That did not work.'));
      setBusy(null);
    }
  };
  return (
    <Sheet onClose={onClose} title={title} testID="folder-picker">
      {error ? (
        <View style={s.pickErr}>
          <ErrorText>{error}</ErrorText>
        </View>
      ) : null}
      <ScrollView style={s.pickList} indicatorStyle={indicatorStyle}>
        {choices.map((c) => {
          const here = c.id === current;
          return (
            <Pressable
              key={c.id || 'top'}
              testID={`pick-folder-${c.id || 'top'}`}
              onPress={() => pick(c.id)}
              disabled={here || !!busy}
              accessibilityRole="button"
              accessibilityLabel={c.path}
              accessibilityState={{ disabled: here }}
              style={[s.pickRow, { paddingLeft: gutter + Math.min(c.depth, 6) * 16 }]}
            >
              {({ pressed }) => (
                <>
                  <Glyph icon={FolderOpen} size={18} color={here ? colors.inkDim : colors.ink} />
                  <Text style={[s.pickName, (here || pressed) && s.dim]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  {here ? <Text style={s.meta}>here now</Text> : null}
                  {busy === c.id ? <ActivityIndicator size="small" color={colors.inkDim} /> : null}
                </>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
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
  },
  side: { width: touch, height: touch },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.sansSemi,
    fontSize: type.title,
    color: colors.ink,
  },
  find: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 12,
    borderRadius: radius.field,
    backgroundColor: colors.surface2,
  },
  findInput: {
    flex: 1,
    minHeight: 38,
    fontFamily: fonts.sans,
    fontSize: type.input,
    color: colors.ink,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  crumbs: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.line },
  crumbsIn: { paddingHorizontal: gutter, minHeight: 40, alignItems: 'center', gap: 6 },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  crumbText: { fontFamily: fonts.sans, fontSize: type.small + 1, color: colors.inkDim, maxWidth: 180 },
  crumbOn: { fontFamily: fonts.sansSemi, color: colors.ink },
  uploading: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: gutter, minHeight: 36 },
  listPad: { paddingBottom: space.xl, flexGrow: 1 },
  column: { width: '100%', maxWidth: 780, alignSelf: 'center' },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: gutter,
    paddingRight: space.xs,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.sans, fontSize: type.lead, color: colors.ink },
  dim: { color: colors.inkDim },
  meta: { fontFamily: fonts.sans, fontSize: type.tiny, color: colors.inkDim },
  note: { paddingHorizontal: gutter, paddingVertical: space.md, gap: space.sm, alignItems: 'flex-start' },
  kept: {
    paddingHorizontal: gutter,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    fontFamily: fonts.sans,
    fontSize: type.tiny,
    color: colors.inkDim,
  },
  wait: { marginTop: space.xxl },
  empty: { alignItems: 'center', gap: space.md, paddingTop: 56, paddingBottom: 56, paddingHorizontal: gutter },
  emptyText: { fontFamily: fonts.sans, fontSize: type.small + 1, color: colors.inkDim, textAlign: 'center' },
  toastWrap: { position: 'absolute', alignSelf: 'center', bottom: space.md, maxWidth: '92%' },
  toast: {
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.round,
    backgroundColor: colors.surface2,
    fontFamily: fonts.sansMedium,
    fontSize: type.small,
    color: colors.ink,
    textAlign: 'center',
  },
  toastBad: { color: colors.danger, borderRadius: radius.lg },
  pickErr: { paddingHorizontal: gutter, paddingBottom: space.sm },
  pickList: { maxHeight: 420 },
  pickRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: gutter },
  pickName: { flex: 1, fontFamily: fonts.sans, fontSize: type.body, color: colors.ink },
});
