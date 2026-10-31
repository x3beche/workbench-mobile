/**
 * What a character does for what its session does (docs/OFFICE.md, the rule
 * table in §2) - the web's `frontend/src/app/rooms/office/anim.ts`, kept pure
 * so the phone's view and its tests share it.
 *
 * The server's `/api/office/live` says an agent's `activity`; this says what
 * that is drawn as: where the character goes, what it does there, whether its
 * bubble shows, and how its walk and typing frames move.
 */

export type Activity =
  | 'typing'
  | 'thinking'
  | 'asking'
  | 'break'
  | 'lounge'
  | 'stuck'
  | 'arrive'
  | 'leave'
  | 'meeting';

export const ACTIVITIES: readonly Activity[] = [
  'typing', 'thinking', 'asking', 'break', 'lounge', 'stuck', 'arrive', 'leave', 'meeting',
];

/** Anything the server sends that these rules do not know is drawn as an idle agent at its desk. */
export function activityOf(raw: unknown): Activity {
  return typeof raw === 'string' && (ACTIVITIES as readonly string[]).includes(raw) ? (raw as Activity) : 'lounge';
}

export type Pose = 'type' | 'think' | 'raise' | 'cup' | 'sit' | 'alert' | 'walk' | 'stand';

export type Dir = 'n' | 'e' | 's' | 'w';

/** Where a character goes for its activity: its own seat, the kitchen, the lounge, its manager's desk, the
 *  door (leaving), or the car park (arriving). */
export type Place = 'seat' | 'kitchen' | 'lounge' | 'manager' | 'door' | 'car';

export interface Look {
  pose: Pose;
  place: Place;
  /** The bubble above it says what it does (the server's words), or nothing. */
  bubble: boolean;
}

const LOOKS: Record<Activity, Look> = {
  typing: { pose: 'type', place: 'seat', bubble: true },
  thinking: { pose: 'think', place: 'seat', bubble: true },
  asking: { pose: 'raise', place: 'manager', bubble: true },
  break: { pose: 'cup', place: 'kitchen', bubble: true },
  lounge: { pose: 'sit', place: 'lounge', bubble: false },
  stuck: { pose: 'alert', place: 'seat', bubble: true },
  arrive: { pose: 'walk', place: 'car', bubble: false },
  leave: { pose: 'walk', place: 'door', bubble: false },
  meeting: { pose: 'walk', place: 'manager', bubble: true },
};

export function lookOf(activity: Activity): Look {
  return LOOKS[activity] ?? LOOKS.lounge;
}

/** The bubble's tone: a question asks for the person, a red "!" says the work is stuck, the rest simply say
 *  what it is doing. */
export function bubbleTone(activity: Activity): 'info' | 'ask' | 'alert' {
  if (activity === 'asking' || activity === 'meeting') return 'ask';
  if (activity === 'stuck') return 'alert';
  return 'info';
}

/** The walk cycle's frame: 0, 1, 2 - two legs and a passing pose, four times a second. */
export function walkFrame(ms: number): 0 | 1 | 2 {
  const f = Math.floor(Math.max(0, ms) / 125) % 3;
  return f === 0 ? 0 : f === 1 ? 1 : 2;
}

/** Typing: two frames, a keystroke apart. */
export function typingFrame(ms: number): 0 | 1 {
  return Math.floor(Math.max(0, ms) / 260) % 2 === 0 ? 0 : 1;
}

/** Thinking: the head scratch, one frame each way, slower than typing. */
export function thinkingFrame(ms: number): 0 | 1 {
  return Math.floor(Math.max(0, ms) / 480) % 2 === 0 ? 0 : 1;
}

/** Which way a step of the path turns the character. Four directions: the longer axis wins a tie (a
 *  diagonal step is never drawn - paths are four-directional). */
export function faceOf(dx: number, dy: number): Dir {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'e' : 'w';
  return dy >= 0 ? 's' : 'n';
}

/** How long a car takes to drive off (ms). */
export const CAR_OUT_MS = 900;
/** World pixels a character walks in a second (2.4 tiles): the phone's walk tween is scaled from this. */
export const WALK_PX_S = 38;
