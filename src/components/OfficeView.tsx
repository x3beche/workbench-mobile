/**
 * The Office on the phone: a read-only, top-down pixel view of the company's
 * floor, drawn with plain Views (docs/OFFICE.md, phase 4).
 *
 * Why not Skia: the project has no @shopify/react-native-skia, and the picture
 * is a dozen rectangles and a dozen characters - plain Views at an integer
 * scale are the lightest thing that draws it, with no new native dependency and
 * nothing to download. A WebView would ship a second app for the same picture;
 * SVG (which the project has) would add a second renderer for no gain at this
 * element count. Every length below is a whole number of pixels: a 16 px tile
 * at ×1, ×2, ×3 or ×4, characters at tile centres, so nothing is resampled.
 *
 * The art has not landed (`atlas.png` is still `null` in the web's manifest),
 * so the shapes are the web engine's placeholders - colour-coded rooms, a body
 * and a head, a cup, a raised hand, a car. `lib/office/atlas.ts` is the same
 * manifest interface the sprites will arrive through.
 *
 * A character is an activity's place (lib/office/scene.ts walks it there for a
 * few hundred ms); tapping one opens a small card, and the card opens its
 * session. Nothing here writes to the server: the office is read-only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from 'react-native';

import type { OfficeLayout, OfficeLiveAgent } from '../api/types';
import { colors, fonts, radius, space, type, withAlpha } from '../theme/tokens';
import { walkFrame } from '../lib/office/anim';
import { daylightTint, type Daylight } from '../lib/office/daylight';
import { moodMouth } from '../lib/office/director';
import { shareOf } from '../lib/office/task';
import {
  centreCamera,
  clampCamera,
  fitScale,
  TILE,
  type Camera,
} from '../lib/office/grid';
import { extentOf, focusOf, sceneOf, type SceneCar, type ScenePerson } from '../lib/office/scene';
import type { OfficeStrings } from '../lib/officeStrings';
import { X } from './icons';
import { useReduceMotion } from './motion';
import { Button } from './ui';

/** The card's ceiling: a phone's width less its gutters. */
const CARD_MAX = 420;
/** The nearest and furthest a tile is drawn: whole numbers only, so the pixels stay crisp. */
const MIN_SCALE = 1;
const MAX_SCALE = 4;

export function OfficeView({
  layout,
  live,
  t,
  onOpen,
  wide = false,
  phase = 'day',
  testID = 'office-view',
}: {
  layout: OfficeLayout | null;
  live: OfficeLiveAgent[] | null;
  t: OfficeStrings;
  /** The session behind a character: `wbo:ses_…` or `wbc:ses_…`. */
  onOpen: (key: string) => void;
  wide?: boolean;
  /** The office's hour (lib/office/daylight.ts): the wash over the drawing, and nothing at noon. */
  phase?: Daylight;
  testID?: string;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, scale: MIN_SCALE });
  const [picked, setPicked] = useState<string | null>(null);
  const [active, setActive] = useState(() => AppState.currentState === 'active');
  const [nowS, setNowS] = useState(() => Date.now() / 1000);

  // A car and a walk are animations; reduced motion turns both into a jump (the app's own rule).
  const reduced = useReduceMotion();
  const scene = useMemo(() => sceneOf(layout, live, nowS, { reduced }), [layout, live, nowS, reduced]);
  const extent = useMemo(() => extentOf(scene), [scene]);
  const focus = useMemo(() => focusOf(scene), [scene]);
  const floorKey = scene.floor ? `${scene.floor.id}:${scene.floor.w}x${scene.floor.h}` : 'none';

  const sizeRef = useRef(size);
  const camRef = useRef(cam);
  const extentRef = useRef(extent);
  const focusRef = useRef(focus);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);
  useEffect(() => {
    camRef.current = cam;
  }, [cam]);
  useEffect(() => {
    extentRef.current = extent;
  }, [extent]);

  /** Fit the floor: the first time it and a window are both known, and on the Fit button. */
  const fit = useCallback(() => {
    const { w, h } = sizeRef.current;
    const ex = extentRef.current;
    if (!w || !h) return;
    const scale = fitScale(ex.w, ex.h, w, h, MIN_SCALE, MAX_SCALE);
    if (ex.w * TILE * scale <= w && ex.h * TILE * scale <= h) {
      setCam(centreCamera(ex.w, ex.h, w, h, scale));
      return;
    }
    // Too big for one screen at a whole scale: open on the people (or the first department), not on a wall.
    const at = focusRef.current;
    setCam(
      clampCamera({ x: at.x - w / (2 * scale), y: at.y - h / (2 * scale), scale }, ex.w, ex.h, w, h),
    );
  }, []);

  const fitted = useRef<string | null>(null);
  useEffect(() => {
    if (!size.w || !size.h) return;
    if (fitted.current === floorKey) return;
    fitted.current = floorKey;
    fit();
  }, [floorKey, size.w, size.h, fit]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((was) => (was.w === width && was.h === height ? was : { w: width, h: height }));
  }, []);

  // The walk is the only thing that moves: a clock runs while one is under way,
  // and not a moment longer. In the background nothing is drawn at all.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setActive(st === 'active'));
    return () => sub.remove();
  }, []);

  const moving = active && scene.animating;
  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => {
      if (AppState.currentState === 'active') setNowS(Date.now() / 1000);
    }, 120);
    return () => clearInterval(id);
  }, [moving]);

  // A new picture is a new "now": walks begin when the server's `since` says, and a row that arrived
  // while the app was elsewhere is not drawn half-way through a walk that is long over.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- once per new picture, not a loop
    setNowS(Date.now() / 1000);
  }, [live, layout]);

  /** Keep the middle of the view on the same world point while the scale changes. */
  const zoom = useCallback((dir: 1 | -1) => {
    const { w, h } = sizeRef.current;
    const ex = extentRef.current;
    const cur = camRef.current;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cur.scale + dir));
    if (scale === cur.scale || !w || !h) return;
    const mx = w / 2;
    const my = h / 2;
    const wx = cur.x + mx / cur.scale;
    const wy = cur.y + my / cur.scale;
    setCam(clampCamera({ x: wx - mx / scale, y: wy - my / scale, scale }, ex.w, ex.h, w, h));
  }, []);

  // ---- the fingers: one drags, two pinch, both keep the floor in the window ----
  const pan = useMemo(() => {
    const held = {
      startCam: { x: 0, y: 0, scale: MIN_SCALE },
      startScale: MIN_SCALE,
      startDist: 0,
      world: { x: 0, y: 0 },
      mid: { x: 0, y: 0 },
    };
    const beginPinch = (e: GestureResponderEvent) => {
      const touches = e.nativeEvent.touches;
      if (touches.length < 2) return false;
      const [a, b] = touches;
      held.startCam = camRef.current;
      held.startScale = camRef.current.scale;
      held.startDist = Math.max(1, Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY));
      held.mid = { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
      held.world = {
        x: held.startCam.x + held.mid.x / held.startCam.scale,
        y: held.startCam.y + held.mid.y / held.startCam.scale,
      };
      return true;
    };
    // eslint-disable-next-line react-hooks/refs -- the refs are read in the gesture's handlers, not while drawing
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e: GestureResponderEvent, g: PanResponderGestureState) =>
        e.nativeEvent.touches.length > 1 || Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onMoveShouldSetPanResponderCapture: (e: GestureResponderEvent) => e.nativeEvent.touches.length > 1,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        if (!beginPinch(e)) {
          held.startCam = camRef.current;
          held.startDist = 0;
        }
      },
      onPanResponderMove: (e: GestureResponderEvent, g: PanResponderGestureState) => {
        const { w, h } = sizeRef.current;
        const ex = extentRef.current;
        if (!w || !h) return;
        if (e.nativeEvent.touches.length >= 2) {
          if (!held.startDist) beginPinch(e);
          if (!held.startDist) return;
          const [a, b] = e.nativeEvent.touches;
          const dist = Math.max(1, Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY));
          const mid = { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
          const scale = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, Math.round(held.startScale * (dist / held.startDist))),
          );
          setCam(
            clampCamera(
              { x: held.world.x - mid.x / scale, y: held.world.y - mid.y / scale, scale },
              ex.w,
              ex.h,
              w,
              h,
            ),
          );
          return;
        }
        const scale = camRef.current.scale;
        setCam(
          clampCamera(
            { x: held.startCam.x - g.dx / scale, y: held.startCam.y - g.dy / scale, scale },
            ex.w,
            ex.h,
            w,
            h,
          ),
        );
      },
      onPanResponderRelease: () => {
        held.startDist = 0;
      },
      onPanResponderTerminate: () => {
        held.startDist = 0;
      },
    });
  }, []);

  const scale = cam.scale;
  const floorW = extent.w * TILE;
  const floorH = extent.h * TILE;
  const pickedPerson = picked ? scene.people.find((p) => p.key === picked) ?? null : null;
  const tint = daylightTint(phase);
  /** Two agents at one place (a word at the manager's desk) stand shoulder to shoulder, not on each other. */
  const spread = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const p of scene.people) {
      const at = `${Math.round(p.x)}:${Math.round(p.y)}`;
      groups.set(at, [...(groups.get(at) ?? []), p.key]);
    }
    const out = new Map<string, number>();
    for (const keys of groups.values()) {
      keys.forEach((k, i) => out.set(k, (i - (keys.length - 1) / 2) * 5));
    }
    return out;
  }, [scene.people]);

  return (
    <View style={s.wrap} testID={testID}>
      <View style={s.clip} onLayout={onLayout} {...pan.panHandlers}>
        <View
          style={[
            s.world,
            {
              left: -Math.round(cam.x * scale),
              top: -Math.round(cam.y * scale),
              width: floorW * scale,
              height: floorH * scale,
            },
          ]}
        >
          <Pressable
            testID="office-floor"
            onPress={() => setPicked(null)}
            style={[s.floor, { width: floorW * scale, height: floorH * scale }]}
          >
            {scene.rooms.map((r) => (
              <View
                key={r.id}
                style={[
                  s.room,
                  {
                    left: r.x * TILE * scale,
                    top: r.y * TILE * scale,
                    width: r.w * TILE * scale,
                    height: r.h * TILE * scale,
                    backgroundColor: roomTint(r.kind),
                  },
                ]}
              />
            ))}
            {scene.items.map((it) => {
              const box = itemBox(it.kind);
              return (
                <View
                  key={it.id}
                  style={{
                    position: 'absolute',
                    left: Math.round((it.x * TILE + box.ox) * scale),
                    top: Math.round((it.y * TILE + box.oy) * scale),
                    width: Math.max(1, Math.round(box.w * scale)),
                    height: Math.max(1, Math.round(box.h * scale)),
                    backgroundColor: box.fill,
                    ...(box.line ? { borderWidth: Math.max(1, scale > 1 ? 1 : 1), borderColor: box.line } : null),
                    ...(box.round ? { borderRadius: Math.max(1, Math.round(box.round * scale)) } : null),
                  }}
                />
              );
            })}
          </Pressable>
          {scene.cars.map((c) => carView(c, scale))}
          {scene.people
            .filter((p) => !p.gone && !p.inCar && p.needsManager)
            .map((p) => {
              const nx = spread.get(p.key) ?? 0;
              return (
                <View
                  key={`ask-${p.key}`}
                  pointerEvents="none"
                  testID={`office-asks-${p.key}`}
                  style={[
                    s.asks,
                    {
                      left: Math.round((p.x + nx) * scale - 5 * scale),
                      top: Math.round(p.y * scale - 20 * scale - 9 * scale),
                      width: Math.round(10 * scale),
                      height: Math.round(10 * scale),
                      borderRadius: Math.round(5 * scale),
                    },
                  ]}
                >
                  <Text style={[s.asksText, { fontSize: Math.max(8, Math.round(8 * scale)) }]}>?</Text>
                </View>
              );
            })}
          {scene.people
            .filter((p) => !p.gone && !p.inCar)
            .map((p) =>
              personView(p, spread.get(p.key) ?? 0, scale, picked === p.key, nowS, t, () => setPicked(p.key)),
            )}
          {/* The office's hour over the drawing: a wash, never a dimmer - the names and the card are drawn
              after it (lib/office/daylight.ts). */}
          {tint ? (
            <View
              pointerEvents="none"
              testID="office-daylight"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: floorW * scale,
                height: floorH * scale,
                backgroundColor: tint,
              }}
            />
          ) : null}
        </View>

        {/* Room names are drawn at screen size, not scaled with the floor: a 9 pt word stays readable
            while a 16 px tile is ×1. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {scene.rooms.map((r) => {
            const x = (r.x * TILE - cam.x) * scale;
            const y = (r.y * TILE - cam.y) * scale;
            const w = r.w * TILE * scale;
            const h = r.h * TILE * scale;
            // Too small to carry a word (and the clip hides the rest): no label.
            if (w < 44 || h < 22) return null;
            // At the room's foot: the desks and the heads are at its top, in a department.
            return (
              <Text
                key={r.id}
                numberOfLines={1}
                style={[s.roomName, { left: x + 3, top: y + h - 17, maxWidth: w - 6 }]}
              >
                {r.name}
              </Text>
            );
          })}
        </View>

        {scene.people.length === 0 ? (
          <View style={s.empty} testID="office-empty">
            <Text style={s.emptyTitle}>{t.empty}</Text>
            <Text style={s.emptyText}>{t.emptyAbout}</Text>
          </View>
        ) : (
          <View pointerEvents="none" style={s.hint}>
            <Text style={s.hintText} numberOfLines={1}>
              {t.hint}
            </Text>
          </View>
        )}

        <View style={s.zoom}>
          <ZoomButton label={t.zoomIn} sign="+" onPress={() => zoom(1)} testID="office-zoom-in" />
          <ZoomButton label={t.zoomOut} sign="−" onPress={() => zoom(-1)} testID="office-zoom-out" />
          <ZoomButton label={t.fit} sign={t.fit} small onPress={fit} testID="office-fit" />
        </View>

        {pickedPerson ? (
          <View style={[s.card, wide && s.cardWide]} testID="office-card">
            <View style={s.cardHead}>
              <View style={[s.cardDot, { backgroundColor: toneOf(pickedPerson) }]} />
              <Text style={s.cardName} numberOfLines={1}>
                {pickedPerson.name}
              </Text>
              {pickedPerson.jev ? (
                <View style={s.cardJev} testID="office-card-jev">
                  <Text style={s.cardJevText}>
                    {pickedPerson.confidence == null
                      ? t.jev
                      : t.jevWith(Math.round(pickedPerson.confidence * 100))}
                  </Text>
                </View>
              ) : null}
              <Pressable
                testID="office-card-close"
                accessibilityRole="button"
                accessibilityLabel={t.close}
                onPress={() => setPicked(null)}
                hitSlop={10}
                style={s.cardClose}
              >
                <X size={16} color={colors.inkDim} />
              </Pressable>
            </View>
            <Text style={s.cardLine} numberOfLines={1}>
              {`${t.activity[pickedPerson.activity]}${pickedPerson.state ? ` · ${t.state[pickedPerson.state] ?? pickedPerson.state}` : ''}${
                pickedPerson.mood ? ` · ${t.mood[pickedPerson.mood.name]}` : ''
              }`}
            </Text>
            {pickedPerson.detail ? (
              <Text style={s.cardDetail} numberOfLines={2} testID="office-card-detail">
                {pickedPerson.detail}
              </Text>
            ) : null}
            {pickedPerson.needsManager ? (
              <Text style={s.cardAsk} numberOfLines={1} testID="office-card-asks">
                {`? ${t.wantsYou}`}
              </Text>
            ) : null}
            <TaskLine person={pickedPerson} t={t} />
            <Button
              label={t.open}
              onPress={() => onOpen(pickedPerson.key)}
              testID="office-card-open"
              style={s.cardOpen}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A car on the floor: the agent's own colour, a windscreen and two wheels - nose-up when it comes in from the
 *  top or the bottom of the yard (lib/office/cars.ts). */
function carView(c: SceneCar, scale: number) {
  const w = Math.round((c.vertical ? 14 : 22) * scale);
  const h = Math.round((c.vertical ? 22 : 14) * scale);
  const wheel = Math.max(1, Math.round(2 * scale));
  const glass = Math.round(3 * scale);
  const wheelStyle = c.vertical
    ? { width: wheel, height: Math.round(6 * scale), top: Math.round(5 * scale) }
    : { width: Math.round(4 * scale), height: wheel, bottom: -1 };
  return (
    <View
      key={`car-${c.key}`}
      pointerEvents="none"
      testID={`office-car-${c.key}`}
      style={{
        position: 'absolute',
        left: Math.round(c.x * scale - w / 2),
        top: Math.round(c.y * scale - h / 2),
        width: w,
        height: h,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          borderRadius: Math.round(3 * scale),
          backgroundColor: `hsl(${c.hue}, 55%, 52%)`,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: glass,
          top: glass,
          width: Math.max(1, w - glass * 2),
          height: Math.max(1, h - glass * 3),
          borderRadius: Math.round(1 * scale),
          backgroundColor: withAlpha(colors.surface, 0.55),
        }}
      />
      <View style={{ position: 'absolute', backgroundColor: colors.ink, borderRadius: 1, ...wheelStyle, left: -1 }} />
      <View style={{ position: 'absolute', backgroundColor: colors.ink, borderRadius: 1, ...wheelStyle, right: -1 }} />
    </View>
  );
}

/**
 * The director's temper on a head: two eyes, and a mouth whose shape says which - a smile for calm, a line for
 * focused, a frown (and a red one) for frustrated. Nothing at level 0: that is the ordinary face.
 */
function moodFace(name: 'calm' | 'focused' | 'frustrated', scale: number) {
  const px = Math.max(1, Math.round(scale));
  const eye = withAlpha(colors.surface, 0.92);
  const line = name === 'frustrated' ? colors.danger : eye;
  const mouth = moodMouth({ name, level: 1 });
  const y = Math.round(4.2 * scale);
  const parts: { left: number; top: number }[] =
    mouth === 'smile'
      ? [{ left: 2, top: y + px * 0.4 }, { left: 3.2, top: y }, { left: 4.4, top: y + px * 0.4 }]
      : mouth === 'frown'
        ? [{ left: 2, top: y }, { left: 3.2, top: y + px * 0.4 }, { left: 4.4, top: y }]
        : [{ left: 2, top: y }, { left: 3.2, top: y }, { left: 4.4, top: y }];
  return (
    <>
      <View style={{ position: 'absolute', left: Math.round(2 * scale), top: Math.round(2.6 * scale), width: px, height: px, backgroundColor: eye }} />
      <View style={{ position: 'absolute', left: Math.round(4.4 * scale), top: Math.round(2.6 * scale), width: px, height: px, backgroundColor: eye }} />
      {parts.map((q, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: Math.round(q.left * scale), top: Math.round(q.top), width: px, height: px, backgroundColor: line }}
        />
      ))}
    </>
  );
}

/** One character: a shadow, legs while walking, a body in its tone, a head, and a mark for what it does. */
function personView(
  p: ScenePerson,
  nx: number,
  scale: number,
  selected: boolean,
  nowS: number,
  t: OfficeStrings,
  onPress: () => void,
) {
  const W = 12 * scale;
  const H = 20 * scale;
  const tone = toneOf(p);
  const frame = p.walking ? walkFrame(nowS * 1000) : 0;
  const bodyH = Math.round((p.pose === 'sit' ? 7 : 9) * scale);
  const legs = p.walking ? (frame === 1 ? 3 : 2) : 0;
  return (
    <Pressable
      key={p.key}
      testID={`office-person-${p.key}`}
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, ${t.activity[p.activity]}${p.needsManager ? `, ${t.wantsYou}` : ''}`}
      onPress={onPress}
      hitSlop={10}
      style={{
        position: 'absolute',
        left: Math.round(p.x * scale + nx * scale - W / 2),
        top: Math.round(p.y * scale - H),
        width: W,
        height: H,
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: Math.round(10 * scale),
          height: Math.max(1, Math.round(3 * scale)),
          borderRadius: Math.round(2 * scale),
          backgroundColor: colors.scrim,
          opacity: 0.32,
        }}
      />
      {p.walking ? (
        <>
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: Math.round(3 * scale),
              width: Math.max(1, Math.round(2 * scale)),
              height: Math.max(1, Math.round(legs * scale)),
              backgroundColor: colors.inkDim,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              right: Math.round(3 * scale),
              width: Math.max(1, Math.round(2 * scale)),
              height: Math.max(1, Math.round((frame === 2 ? 3 : 2) * scale)),
              backgroundColor: colors.inkDim,
            }}
          />
        </>
      ) : null}
      <View
        style={{
          position: 'absolute',
          top: Math.round(7 * scale),
          width: Math.round(8 * scale),
          height: bodyH,
          borderRadius: Math.round(2 * scale),
          backgroundColor: tone,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: Math.round(1 * scale),
          width: Math.round(6 * scale),
          height: Math.round(6 * scale),
          borderRadius: Math.round(3 * scale),
          backgroundColor: colors.ink,
        }}
      />
      {p.mood && p.mood.level > 0 ? moodFace(p.mood.name, scale) : null}
      {p.pose === 'think' ? (
        <View
          style={{
            position: 'absolute',
            top: Math.round(2 * scale),
            right: Math.round(1 * scale),
            width: Math.max(1, Math.round(2 * scale)),
            height: Math.max(1, Math.round(2 * scale)),
            borderRadius: Math.round(1 * scale),
            backgroundColor: colors.inkDim,
          }}
        />
      ) : null}
      {p.pose === 'raise' ? (
        <View
          style={{
            position: 'absolute',
            top: Math.round(7 * scale),
            right: 0,
            width: Math.max(1, Math.round(2 * scale)),
            height: Math.round(6 * scale),
            backgroundColor: colors.warn,
          }}
        />
      ) : null}
      {p.pose === 'cup' ? (
        <View
          style={{
            position: 'absolute',
            top: Math.round(10 * scale),
            right: 0,
            width: Math.max(1, Math.round(3 * scale)),
            height: Math.max(1, Math.round(3 * scale)),
            backgroundColor: colors.warn,
          }}
        />
      ) : null}
      {p.pose === 'alert' || p.tone === 'alert' ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            width: Math.max(1, Math.round(3 * scale)),
            height: Math.max(1, Math.round(3 * scale)),
            borderRadius: Math.round(1.5 * scale),
            backgroundColor: colors.danger,
          }}
        />
      ) : null}
      {p.bubble && p.tone !== 'alert' ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: Math.max(1, Math.round(3 * scale)),
            height: Math.max(1, Math.round(3 * scale)),
            borderRadius: Math.round(1.5 * scale),
            backgroundColor: tone,
          }}
        />
      ) : null}
      {selected ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: W,
            height: H,
            borderWidth: 1,
            borderColor: colors.focus,
            borderRadius: Math.round(3 * scale),
          }}
        />
      ) : null}
    </Pressable>
  );
}

function TaskLine({ person, t }: { person: ScenePerson; t: OfficeStrings }) {
  if (!person.task) {
    return (
      <Text style={s.cardTask} numberOfLines={1}>
        {t.noTask}
      </Text>
    );
  }
  const share = shareOf(person.task);
  const lines = share
    ? [t.approxPct(share.percent), share.spread ? `±${share.spread}` : null, share.eta ? t.etaLeft(share.eta) : null]
        .filter(Boolean)
        .join(' · ')
    : null;
  return (
    <View style={s.task}>
      <Text style={s.cardTask} numberOfLines={1}>
        {`${t.task}: ${person.task.title}`}
      </Text>
      {share ? (
        <View
          style={s.taskShare}
          accessible
          accessibilityLabel={`${t.task}: ${lines}`}
          testID="office-card-share"
        >
          <View style={s.track}>
            <View style={[s.fill, { width: `${share.percent}%` }]} testID="office-card-progress" />
          </View>
          <Text style={s.taskPct} testID="office-card-pct">
            {`${t.approxPct(share.percent)}${share.eta ? ` · ${t.etaLeft(share.eta)}` : ''}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function ZoomButton({
  label,
  sign,
  small = false,
  onPress,
  testID,
}: {
  label: string;
  sign: string;
  small?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.zoomBtn, pressed && s.zoomPressed]}
    >
      <Text style={[s.zoomSign, small && s.zoomSignSmall]}>{sign}</Text>
    </Pressable>
  );
}

/** A character's colour: what it does, not who it is - a question asks, a stuck one alerts. */
function toneOf(p: ScenePerson): string {
  // The page's accent is its ink (near white) in the dark themes: a character in it reads as a ghost on the
  // session dots' colours. The series' sky is the ordinary one, warn orange a question, danger a stuck agent.
  return p.tone === 'ask' ? colors.warn : p.tone === 'alert' ? colors.danger : colors.series7;
}

/** A room's wash: one tint a kind, over the floor's ground, light or dark alike. */
function roomTint(kind: string): string {
  switch (kind) {
    case 'department': return withAlpha(colors.accent, 0.06);
    case 'kitchen': return withAlpha(colors.ok, 0.1);
    case 'lounge': return withAlpha(colors.series5, 0.1);
    case 'meeting': return withAlpha(colors.series3, 0.1);
    case 'lobby': return withAlpha(colors.ink, 0.04);
    case 'parking': return withAlpha(colors.ink, 0.09);
    default: return withAlpha(colors.ink, 0.05);
  }
}

/** A placeholder piece of furniture, in world pixels from its tile's corner. */
function itemBox(kind: string): { w: number; h: number; ox: number; oy: number; fill: string; line?: string; round?: number } {
  switch (kind) {
    case 'desk':
      return { w: 26, h: 12, ox: -5, oy: 1, fill: withAlpha(colors.inkDim, 0.5), round: 1 };
    case 'pc':
      return { w: 6, h: 6, ox: 5, oy: 2, fill: colors.accent, round: 1 };
    case 'chair':
      return { w: 8, h: 6, ox: 4, oy: 9, fill: withAlpha(colors.ink, 0.3), round: 2 };
    case 'coffee':
      return { w: 10, h: 10, ox: 3, oy: 2, fill: colors.warn, round: 2 };
    case 'sofa':
      return { w: 30, h: 12, ox: -7, oy: 3, fill: withAlpha(colors.accent, 0.45), round: 3 };
    case 'plant':
      return { w: 8, h: 10, ox: 4, oy: 3, fill: colors.ok, round: 4 };
    case 'board':
      return { w: 30, h: 10, ox: -7, oy: 2, fill: withAlpha(colors.inkDim, 0.45), round: 1 };
    case 'car_spot':
      return { w: 26, h: 26, ox: -5, oy: -4, fill: 'transparent', line: withAlpha(colors.inkDim, 0.5), round: 2 };
    default:
      return { w: 8, h: 8, ox: 4, oy: 4, fill: withAlpha(colors.inkDim, 0.4), round: 1 };
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surface },
  clip: { flex: 1, overflow: 'hidden', backgroundColor: colors.surface },
  world: { position: 'absolute' },
  floor: { position: 'absolute', left: 0, top: 0, backgroundColor: colors.surface2 },
  room: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  roomName: {
    position: 'absolute',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: withAlpha(colors.surface, 0.72),
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.2,
    color: withAlpha(colors.ink, 0.62),
  },
  hint: {
    position: 'absolute',
    left: space.sm,
    top: space.sm,
    maxWidth: '72%',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: withAlpha(colors.surface, 0.82),
  },
  hintText: { fontFamily: fonts.sans, fontSize: type.micro, lineHeight: type.microLine, color: colors.inkDim },
  zoom: { position: 'absolute', right: space.sm, top: space.sm, gap: 6 },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.surface2, 0.92),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  zoomPressed: { backgroundColor: colors.pressed },
  zoomSign: { fontFamily: fonts.sansMedium, fontSize: 16, lineHeight: 19, color: colors.ink },
  zoomSignSmall: { fontSize: 10, lineHeight: 13 },
  empty: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    top: '38%',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: withAlpha(colors.surface, 0.92),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  emptyTitle: {
    fontFamily: fonts.sansSemi,
    fontSize: type.lead,
    lineHeight: type.leadLine,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.inkDim,
    textAlign: 'center',
  },
  card: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.md,
    maxWidth: CARD_MAX,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  cardWide: { left: 'auto', right: space.lg },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDot: { width: 8, height: 8, borderRadius: 4 },
  cardName: {
    flex: 1,
    fontFamily: fonts.sansSemi,
    fontSize: type.lead,
    lineHeight: type.leadLine,
    color: colors.ink,
  },
  cardClose: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  cardJev: {
    marginLeft: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  cardJevText: {
    fontFamily: fonts.sansSemi,
    fontSize: type.micro,
    lineHeight: type.microLine,
    color: colors.inkDim,
  },
  cardDetail: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.ink,
  },
  cardAsk: {
    marginTop: 2,
    fontFamily: fonts.sansSemi,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.warn,
  },
  asks: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warn },
  asksText: { fontFamily: fonts.sansSemi, color: withAlpha(colors.surface, 0.95) },
  cardLine: {
    marginTop: 1,
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.inkDim,
  },
  task: { marginTop: 4 },
  taskShare: { marginTop: 2 },
  taskPct: {
    fontFamily: fonts.sans,
    fontSize: type.micro,
    lineHeight: type.microLine,
    color: colors.inkDim,
  },
  cardTask: {
    fontFamily: fonts.sans,
    fontSize: type.small,
    lineHeight: type.smallLine,
    color: colors.ink,
  },
  track: {
    marginTop: 4,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: withAlpha(colors.ink, 0.14),
  },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  cardOpen: { marginTop: space.sm, alignSelf: 'flex-start' },
});
