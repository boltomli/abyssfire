/**
 * Composer — the music theory behind the procedural score.
 *
 * Pure functions (no Web Audio): scales, diatonic chords, voicings and a
 * phrase generator that writes singable melodies over a chord progression.
 * MusicEngine turns the resulting note events into sound.
 */

export type Mode =
  | 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian'
  | 'harmonicMinor' | 'phrygianDominant';

/** Semitone steps of each mode above the tonic. */
export const MODES: Record<Mode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
};

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** MIDI note of scale `degree` (may be negative or ≥ 7: wraps octaves). */
export function degreeToMidi(tonic: number, mode: Mode, degree: number): number {
  const steps = MODES[mode];
  const oct = Math.floor(degree / 7);
  const idx = ((degree % 7) + 7) % 7;
  return tonic + oct * 12 + steps[idx];
}

/** Diatonic triad (or 7th chord) on a scale degree, as scale degrees. */
export function chordDegrees(root: number, sevenths = false): number[] {
  return sevenths ? [root, root + 2, root + 4, root + 6] : [root, root + 2, root + 4];
}

/**
 * Close voicing of a chord inside [low, high] MIDI: each chord tone takes the
 * octave that lands it in range, sorted low→high. Keeps pads in the warm
 * middle register instead of rumbling at the bottom.
 */
export function voiceChord(tonic: number, mode: Mode, degrees: readonly number[], low: number, high: number): number[] {
  const out: number[] = [];
  for (const d of degrees) {
    let n = degreeToMidi(tonic, mode, d);
    while (n < low) n += 12;
    while (n > high) n -= 12;
    if (n >= low) out.push(n);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** A small deterministic PRNG so a theme's melodies can be reproduced in tests. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export interface NoteEvent {
  /** Start, in beats from the start of the phrase. */
  beat: number;
  /** Length in beats. */
  length: number;
  /** MIDI note. */
  midi: number;
  /** 0..1 loudness. */
  velocity: number;
}

/** Rhythm cells (beat lengths) for one bar; negative = rest. */
const RHYTHMS_4: readonly (readonly number[])[] = [
  [2, 1, 1],
  [1, 1, 2],
  [1.5, 0.5, 2],
  [1, 0.5, 0.5, 2],
  [3, 1],
  [-1, 1, 2],
  [2, -1, 1],
  [1, 1, 1, 1],
];
const RHYTHMS_3: readonly (readonly number[])[] = [
  [2, 1],
  [1, 1, 1],
  [1.5, 0.5, 1],
  [3],
  [-1, 1, 1],
];

export interface PhraseOptions {
  tonic: number;
  mode: Mode;
  /** Scale-degree roots of the chords under each bar of the phrase. */
  chordRoots: readonly number[];
  beatsPerBar: number;
  /** Melody register (MIDI) — notes stay inside it. */
  low: number;
  high: number;
  /** 0..1: how busy the line is (fewer rests, shorter notes as it rises). */
  density: number;
  rng: () => number;
}

/**
 * Write a phrase over `chordRoots` (one chord per bar): strong beats land on
 * chord tones, motion is mostly stepwise, and the last note is a long chord
 * tone so the phrase breathes before the next one.
 */
export function writePhrase(o: PhraseOptions): NoteEvent[] {
  const events: NoteEvent[] = [];
  const cells = o.beatsPerBar === 3 ? RHYTHMS_3 : RHYTHMS_4;
  const scaleNotesInRange = (): number[] => {
    const out: number[] = [];
    for (let d = -14; d < 28; d++) {
      const n = degreeToMidi(o.tonic, o.mode, d);
      if (n >= o.low && n <= o.high) out.push(n);
    }
    return out;
  };
  const pool = scaleNotesInRange();
  if (pool.length === 0) return events;
  const chordTonesIn = (rootDeg: number): number[] => {
    const pcs = new Set(chordDegrees(rootDeg).map(d => ((degreeToMidi(o.tonic, o.mode, d) % 12) + 12) % 12));
    return pool.filter(n => pcs.has(((n % 12) + 12) % 12));
  };
  const nearest = (from: number, choices: number[]): number =>
    choices.reduce((best, n) => (Math.abs(n - from) < Math.abs(best - from) ? n : best), choices[0]);

  // Start near the middle of the range on a chord tone.
  let current = nearest((o.low + o.high) / 2, chordTonesIn(o.chordRoots[0]) .length ? chordTonesIn(o.chordRoots[0]) : pool);
  let beatAt = 0;
  o.chordRoots.forEach((root, bar) => {
    const lastBar = bar === o.chordRoots.length - 1;
    // Busier themes favour denser cells; the final bar always resolves long.
    let cell = cells[Math.floor(o.rng() * cells.length)];
    if (o.rng() > o.density) cell = cells.find(c => c.length <= 2 && c.every(x => x > 0)) ?? cell;
    if (lastBar) cell = o.beatsPerBar === 3 ? [1, 2] : [2, 2];
    const tones = chordTonesIn(root);
    let pos = 0;
    cell.forEach((len, i) => {
      const dur = Math.abs(len);
      if (len > 0) {
        const strong = pos === 0 || (o.beatsPerBar === 4 && pos === 2);
        let next: number;
        if (strong && tones.length) {
          // Chord tone close to where we are.
          next = nearest(current + (o.rng() < 0.5 ? -1 : 1), tones);
        } else {
          // Step up or down the scale (occasionally a third).
          const idx = pool.indexOf(nearest(current, pool));
          const leap = o.rng() < 0.2 ? 2 : 1;
          const dir = o.rng() < 0.5 ? -1 : 1;
          next = pool[Math.max(0, Math.min(pool.length - 1, idx + dir * leap))];
        }
        if (lastBar && i === cell.length - 1 && tones.length) next = nearest(next, tones);
        events.push({
          beat: beatAt + pos,
          length: dur,
          midi: next,
          velocity: (strong ? 0.9 : 0.7) * (0.85 + o.rng() * 0.15),
        });
        current = next;
      }
      pos += dur;
    });
    beatAt += o.beatsPerBar;
  });
  return events;
}
