/**
 * The director's layer on a live row (lib/office/director.ts): the face, the "?", the word, and how sure it was -
 * the fields `backend/office_director.py` adds only when its pick is fresh and confident.
 */
import { bubbleOf, directorOf, jevLabel, moodMouth, moodOf } from '../office/director';

describe('the director on a row', () => {
  it('reads nothing from a row the rules alone spoke for', () => {
    const d = directorOf({ key: 'wbo:alice', by: 'rule', bubble: 'running tests' } as never);
    expect(d).toEqual({ jev: false, confidence: null, mood: null, detail: null, needsManager: false, pose: null });
    expect(jevLabel(d.confidence)).toBe('Jev');
    expect(bubbleOf({ bubble: 'running tests' } as never, null)).toBe('running tests');
  });

  it('reads the fields Jev added, in the wire’s own names', () => {
    const d = directorOf({
      key: 'wbo:alice', by: 'jev', confidence: 0.823, mood: { name: 'focused', level: 1 },
      detail: '  debugging  ', needs_manager: true, pose: 'desk', bubble: '?',
    });
    expect(d).toEqual({
      jev: true, confidence: 0.823, mood: { name: 'focused', level: 1 }, detail: 'debugging',
      needsManager: true, pose: 'desk',
    });
    expect(jevLabel(d.confidence)).toBe('Jev · 82%');
    // The "?" wins over whatever bubble the rules had, and the row asks rather than informs.
    expect(bubbleOf({ needs_manager: true, bubble: 'reading docs' }, 'reading docs')).toBe('?');
  });

  it('knows only the three moods, and clamps their level', () => {
    expect(moodOf({ name: 'calm', level: 0 })).toEqual({ name: 'calm', level: 0 });
    expect(moodOf({ name: 'frustrated', level: 9 })).toEqual({ name: 'frustrated', level: 2 });
    expect(moodOf({ name: 'frustrated', level: -3 })).toEqual({ name: 'frustrated', level: 0 });
    expect(moodOf({ name: 'elated', level: 1 })).toBeNull();
    expect(moodOf({ name: 'calm', level: '2' })).toEqual({ name: 'calm', level: 0 });
    expect(moodOf(null)).toBeNull();
    expect(moodOf('focused')).toBeNull();
  });

  it('draws the face the mood names, and nothing at level 0', () => {
    expect(moodMouth(null)).toBe('none');
    expect(moodMouth({ name: 'calm', level: 0 })).toBe('none');
    expect(moodMouth({ name: 'calm', level: 1 })).toBe('smile');
    expect(moodMouth({ name: 'focused', level: 2 })).toBe('flat');
    expect(moodMouth({ name: 'frustrated', level: 1 })).toBe('frown');
  });
});
