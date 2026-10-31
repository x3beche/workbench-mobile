/**
 * What a character does for its activity (lib/office/anim.ts, the web's
 * frontend/src/app/rooms/office/anim.ts).
 */
import {
  ACTIVITIES,
  activityOf,
  bubbleTone,
  faceOf,
  lookOf,
  thinkingFrame,
  typingFrame,
  walkFrame,
} from '../office/anim';

describe('an activity and its look', () => {
  it('draws a known activity by its own rule and anything else in the lounge', () => {
    expect(activityOf('typing')).toBe('typing');
    expect(activityOf('meeting')).toBe('meeting');
    expect(activityOf('teleporting')).toBe('lounge');
    expect(activityOf(null)).toBe('lounge');
    expect(activityOf(7)).toBe('lounge');
    for (const a of ACTIVITIES) expect(activityOf(a)).toBe(a);
  });

  it('places every activity: desk, kitchen, lounge, manager, door, car', () => {
    expect(lookOf('typing')).toEqual({ pose: 'type', place: 'seat', bubble: true });
    expect(lookOf('thinking')).toEqual({ pose: 'think', place: 'seat', bubble: true });
    expect(lookOf('asking')).toEqual({ pose: 'raise', place: 'manager', bubble: true });
    expect(lookOf('break')).toEqual({ pose: 'cup', place: 'kitchen', bubble: true });
    expect(lookOf('lounge')).toEqual({ pose: 'sit', place: 'lounge', bubble: false });
    expect(lookOf('stuck')).toEqual({ pose: 'alert', place: 'seat', bubble: true });
    expect(lookOf('arrive')).toEqual({ pose: 'walk', place: 'car', bubble: false });
    expect(lookOf('leave')).toEqual({ pose: 'walk', place: 'door', bubble: false });
    expect(lookOf('meeting')).toEqual({ pose: 'walk', place: 'manager', bubble: true });
  });

  it('tones a bubble: a question asks, a stuck character alerts, the rest informs', () => {
    expect(bubbleTone('asking')).toBe('ask');
    expect(bubbleTone('meeting')).toBe('ask');
    expect(bubbleTone('stuck')).toBe('alert');
    expect(bubbleTone('typing')).toBe('info');
    expect(bubbleTone('break')).toBe('info');
  });
});

describe('the frames', () => {
  it('walks two legs and a passing pose, four times a second', () => {
    expect([0, 125, 250, 375, 500].map(walkFrame)).toEqual([0, 1, 2, 0, 1]);
  });

  it('types on two frames, and thinks on two slower ones', () => {
    expect([0, 259, 260, 519].map(typingFrame)).toEqual([0, 0, 1, 1]);
    expect([0, 479, 480, 959].map(thinkingFrame)).toEqual([0, 0, 1, 1]);
  });

  it('faces the way of a four-direction step, the longer axis winning a tie', () => {
    expect(faceOf(1, 0)).toBe('e');
    expect(faceOf(-1, 0)).toBe('w');
    expect(faceOf(0, 1)).toBe('s');
    expect(faceOf(0, -1)).toBe('n');
    expect(faceOf(2, 1)).toBe('e');
    expect(faceOf(0, 0)).toBe('e');
  });
});
