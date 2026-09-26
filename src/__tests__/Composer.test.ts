import { describe, expect, it } from 'vitest';
import { chordDegrees, degreeToMidi, makeRng, midiToHz, MODES, voiceChord, writePhrase } from '../systems/audio/Composer';
import { ZONE_SCORES, ZONE_THEMES } from '../systems/audio/MusicEngine';

describe('Composer theory', () => {
  it('maps scale degrees across octaves', () => {
    expect(degreeToMidi(60, 'major', 0)).toBe(60);
    expect(degreeToMidi(60, 'major', 4)).toBe(67);
    expect(degreeToMidi(60, 'major', 7)).toBe(72);
    expect(degreeToMidi(60, 'minor', -1)).toBe(58);
    expect(midiToHz(69)).toBeCloseTo(440);
  });

  it('voices chords inside the requested register', () => {
    for (const mode of Object.keys(MODES) as (keyof typeof MODES)[]) {
      for (let root = 0; root < 7; root++) {
        const v = voiceChord(50, mode, chordDegrees(root, true), 55, 72);
        expect(v.length).toBeGreaterThanOrEqual(3);
        for (const n of v) { expect(n).toBeGreaterThanOrEqual(55); expect(n).toBeLessThanOrEqual(72); }
      }
    }
  });

  it('writes phrases in range, on chord tones on the downbeat, resolving long', () => {
    for (let seed = 1; seed < 40; seed++) {
      const events = writePhrase({ tonic: 62, mode: 'major', chordRoots: [0, 4], beatsPerBar: 4, low: 69, high: 86, density: 0.6, rng: makeRng(seed) });
      expect(events.length).toBeGreaterThan(0);
      for (const e of events) { expect(e.midi).toBeGreaterThanOrEqual(69); expect(e.midi).toBeLessThanOrEqual(86); }
      const downbeat = events.find(e => e.beat === 0);
      if (downbeat) {
        const tonePcs = chordDegrees(0).map(d => degreeToMidi(62, 'major', d) % 12);
        expect(tonePcs).toContain(downbeat.midi % 12);
      }
      const last = events[events.length - 1];
      expect(last.length).toBeGreaterThanOrEqual(2);
      expect(Math.max(...events.map(e => e.beat + e.length))).toBeLessThanOrEqual(8);
    }
  });
});

describe('zone scores', () => {
  it('exist for every music theme and keep the pad out of the bass', () => {
    for (const id of Object.keys(ZONE_THEMES)) {
      const s = ZONE_SCORES[id];
      expect(s, id).toBeDefined();
      expect(s.lead.low).toBeGreaterThanOrEqual(55);
      if (s.arp) expect(s.arp.low).toBeGreaterThanOrEqual(55);
      expect(s.progression.length).toBeGreaterThanOrEqual(3);
    }
  });
});
