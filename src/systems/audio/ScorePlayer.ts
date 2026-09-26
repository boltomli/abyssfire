/**
 * ScorePlayer — performs a zone's score in real time.
 *
 * Replaces the old always-on drone: music is written bar by bar over a chord
 * progression — a soft mid-register pad that changes with the harmony, a
 * light plucked bass only on strong beats, arpeggios, and sung-sounding
 * melodic phrases with rests. A 16-bar section cycle thins the texture out
 * and lets it breathe so it never becomes a wall of sound.
 *
 * Events are scheduled on the AudioContext clock with lookahead
 * (`scheduleUntil`), so the same code runs live or into an
 * OfflineAudioContext for analysis.
 */
import {
  chordDegrees, degreeToMidi, makeRng, midiToHz, voiceChord, writePhrase, type Mode,
} from './Composer';

export type ScoreState = 'explore' | 'combat';

export interface ScoreSpec {
  /** Tonic as a MIDI note. */
  tonic: number;
  mode: Mode;
  /** Chord roots as scale degrees; each lasts `barsPerChord` bars. */
  progression: readonly number[];
  barsPerChord: number;
  beatsPerBar: 3 | 4;
  tempo: number;
  pad: { wave: OscillatorType; gain: number; cutoff: number };
  /** Plucked bass on these beats of the bar (explore); null = none. */
  bass: { gain: number; beats: readonly number[] } | null;
  lead: { wave: OscillatorType; gain: number; low: number; high: number; density: number; vibrato: number };
  arp: { wave: OscillatorType; gain: number; low: number; high: number; perBeat: 1 | 2; decay: number } | null;
  /** Sparse high bell tones in the quiet sections. */
  bell: { gain: number } | null;
  /** Combat plays faster by this factor. */
  combatTempo: number;
}

type Section = 'intro' | 'full' | 'thin' | 'rest';

/** Lowest note the bass may play (E2, 82 Hz): keeps the sub-bass out. */
const BASS_FLOOR = 40;

export class ScorePlayer {
  private readonly ctx: BaseAudioContext;
  private readonly out: AudioNode;
  private readonly spec: ScoreSpec;
  private readonly state: ScoreState;
  private readonly rng: () => number;
  private readonly beatSec: number;
  private bar = 0;
  private nextBarTime: number;
  private noise: AudioBuffer | null = null;

  constructor(ctx: BaseAudioContext, out: AudioNode, spec: ScoreSpec, state: ScoreState, startTime: number, seed = 1) {
    this.ctx = ctx;
    this.out = out;
    this.spec = spec;
    this.state = state;
    this.rng = makeRng(seed);
    this.beatSec = 60 / (spec.tempo * (state === 'combat' ? spec.combatTempo : 1));
    this.nextBarTime = startTime;
  }

  /** Schedule every bar that starts before `time` (seconds, context clock). */
  scheduleUntil(time: number): void {
    while (this.nextBarTime < time) {
      this.scheduleBar(this.bar, this.nextBarTime);
      this.bar++;
      this.nextBarTime += this.spec.beatsPerBar * this.beatSec;
    }
  }

  // ── Structure ───────────────────────────────────────────────

  private section(bar: number): Section {
    if (this.state === 'combat') return (bar % 16) >= 14 ? 'thin' : 'full';
    const cycle = Math.floor(bar / 16);
    const b = bar % 16;
    if (b < 4) return 'intro';
    if (b < 12) return 'full';
    if (b < 14) return 'thin';
    // Every other cycle ends on two near-silent bars so the music breathes.
    return cycle % 2 === 1 ? 'rest' : 'thin';
  }

  private chordRootAt(bar: number): number {
    const p = this.spec.progression;
    return p[Math.floor(bar / this.spec.barsPerChord) % p.length];
  }

  private scheduleBar(bar: number, t: number): void {
    const sec = this.section(bar);
    const root = this.chordRootAt(bar);
    const barSec = this.spec.beatsPerBar * this.beatSec;
    const chordStarts = bar % this.spec.barsPerChord === 0;

    if (chordStarts && sec !== 'rest') {
      this.pad(root, t, this.spec.barsPerChord * barSec, sec === 'intro' ? 0.8 : 1);
    }
    if (this.spec.bass && (sec === 'full' || (this.state === 'combat' && sec === 'thin'))) {
      const beats = this.state === 'combat' ? [0, 2].filter(b => b < this.spec.beatsPerBar) : this.spec.bass.beats;
      for (const b of beats) this.bass(root, t + b * this.beatSec, b === 0 ? 1 : 0.7);
    }
    if (this.spec.arp && (sec === 'full' || sec === 'thin')) this.arpeggio(root, t, sec === 'thin' ? 0.6 : 1);
    if (sec === 'full' && bar % 2 === 0 && (this.state === 'combat' || this.rng() < 0.85)) {
      this.phrase(bar, t);
    }
    if (this.spec.bell && (sec === 'intro' || sec === 'thin') && bar % 2 === 0) {
      this.bellTone(root, t + this.beatSec * (this.rng() < 0.5 ? 0 : 1));
    }
    if (this.state === 'combat') this.percussion(t);
  }

  // ── Voices ──────────────────────────────────────────────────

  private envGain(t: number, peak: number, attack: number, hold: number, release: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return g;
  }

  private pluckGain(t: number, peak: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    return g;
  }

  private osc(wave: OscillatorType, freq: number, t: number, stop: number, detuneCents = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    if (detuneCents) o.detune.setValueAtTime(detuneCents, t);
    o.start(t);
    o.stop(stop);
    return o;
  }

  /** Sustained chord in the warm middle register (G3–C5), changing with the harmony. */
  private pad(rootDeg: number, t: number, dur: number, level: number): void {
    const { pad, tonic, mode } = this.spec;
    const notes = voiceChord(tonic, mode, chordDegrees(rootDeg, this.spec.mode !== 'major'), 55, 72);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(pad.cutoff * 0.6, t);
    lp.frequency.linearRampToValueAtTime(pad.cutoff, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(pad.cutoff * 0.7, t + dur);
    lp.Q.value = 0.5;
    lp.connect(this.out);
    const attack = Math.min(1.6, dur * 0.3);
    const release = 1.8;
    const g = this.envGain(t, pad.gain * level / Math.sqrt(notes.length), attack, Math.max(0.1, dur - attack), release);
    g.connect(lp);
    for (const n of notes) {
      const f = midiToHz(n);
      this.osc(pad.wave, f, t, t + dur + release + 0.1, -6).connect(g);
      this.osc(pad.wave, f, t, t + dur + release + 0.1, 6).connect(g);
    }
  }

  /** Short plucked root on strong beats — present, never droning. */
  private bass(rootDeg: number, t: number, accent: number): void {
    const spec = this.spec.bass;
    if (!spec) return;
    let n = degreeToMidi(this.spec.tonic, this.spec.mode, rootDeg) - 12;
    while (n < BASS_FLOOR) n += 12;
    while (n > BASS_FLOOR + 12) n -= 12;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.35);
    lp.connect(this.out);
    const g = this.pluckGain(t, spec.gain * accent, 0.55);
    g.connect(lp);
    this.osc('triangle', midiToHz(n), t, t + 0.6).connect(g);
    this.osc('sine', midiToHz(n + 12), t, t + 0.6).connect(g);
  }

  /** Broken-chord arpeggio through the bar. */
  private arpeggio(rootDeg: number, t: number, level: number): void {
    const arp = this.spec.arp;
    if (!arp) return;
    const tones = voiceChord(this.spec.tonic, this.spec.mode, chordDegrees(rootDeg), arp.low, arp.high);
    if (tones.length === 0) return;
    const ext = [...tones, tones[0] + 12].filter(n => n <= arp.high + 12);
    const perBeat = this.state === 'combat' ? 2 : arp.perBeat;
    const steps = this.spec.beatsPerBar * perBeat;
    const pattern = [...ext, ...ext.slice(1, -1).reverse()];
    const stepSec = this.beatSec / perBeat;
    for (let i = 0; i < steps; i++) {
      // Leave gaps so it sounds played, not sequenced.
      if (perBeat === 2 && i % 4 === 3 && this.rng() < 0.5) continue;
      const n = pattern[i % pattern.length];
      const at = t + i * stepSec;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, at);
      lp.frequency.exponentialRampToValueAtTime(900, at + arp.decay);
      lp.connect(this.out);
      const g = this.pluckGain(at, arp.gain * level * (i % perBeat === 0 ? 1 : 0.7), arp.decay);
      g.connect(lp);
      this.osc(arp.wave, midiToHz(n), at, at + arp.decay + 0.05).connect(g);
    }
  }

  /** A two-bar melodic phrase over the coming chords. */
  private phrase(bar: number, t: number): void {
    const lead = this.spec.lead;
    const events = writePhrase({
      tonic: this.spec.tonic,
      mode: this.spec.mode,
      chordRoots: [this.chordRootAt(bar), this.chordRootAt(bar + 1)],
      beatsPerBar: this.spec.beatsPerBar,
      low: lead.low,
      high: lead.high,
      density: this.state === 'combat' ? Math.min(1, lead.density + 0.25) : lead.density,
      rng: this.rng,
    });
    for (const e of events) {
      const at = t + e.beat * this.beatSec;
      const dur = e.length * this.beatSec;
      const f = midiToHz(e.midi);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lead.wave === 'sine' ? 6000 : 2400;
      lp.connect(this.out);
      const release = Math.min(0.9, dur * 0.8);
      const g = this.envGain(at, lead.gain * e.velocity, 0.04, Math.max(0.05, dur * 0.7), release);
      g.connect(lp);
      const stop = at + dur * 0.7 + release + 0.1;
      const a = this.osc(lead.wave, f, at, stop, -4);
      const b = this.osc(lead.wave, f, at, stop, 4);
      a.connect(g); b.connect(g);
      // Delayed vibrato on held notes.
      if (lead.vibrato > 0 && dur > 0.5) {
        const lfo = this.osc('sine', 5.2, at, stop);
        const depth = this.ctx.createGain();
        depth.gain.setValueAtTime(0, at);
        depth.gain.linearRampToValueAtTime(lead.vibrato, at + Math.min(0.6, dur * 0.5));
        lfo.connect(depth);
        depth.connect(a.detune);
        depth.connect(b.detune);
      }
    }
  }

  private bellTone(rootDeg: number, t: number): void {
    const bell = this.spec.bell;
    if (!bell) return;
    const tones = voiceChord(this.spec.tonic, this.spec.mode, chordDegrees(rootDeg), 76, 91);
    if (tones.length === 0) return;
    const n = tones[Math.floor(this.rng() * tones.length)];
    const g = this.pluckGain(t, bell.gain, 2.6);
    g.connect(this.out);
    this.osc('sine', midiToHz(n), t, t + 2.7).connect(g);
    const partial = this.pluckGain(t, bell.gain * 0.3, 1.2);
    partial.connect(this.out);
    this.osc('sine', midiToHz(n) * 2.76, t, t + 1.3).connect(partial);
  }

  /** Combat pulse: a soft frame drum on 1 and 3, shaker on the offbeats. */
  private percussion(t: number): void {
    if (!this.noise) {
      const len = Math.floor(this.ctx.sampleRate * 0.3);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      const r = makeRng(7);
      for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
    }
    for (let b = 0; b < this.spec.beatsPerBar; b++) {
      const at = t + b * this.beatSec;
      if (b % 2 === 0) {
        // Drum: pitched body (220 → 110 Hz) + a noise tap — punchy, not boomy.
        const g = this.pluckGain(at, b === 0 ? 0.09 : 0.06, 0.22);
        g.connect(this.out);
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(220, at);
        o.frequency.exponentialRampToValueAtTime(110, at + 0.18);
        o.start(at); o.stop(at + 0.25);
        o.connect(g);
      }
      for (const off of [0.5]) {
        const st = at + off * this.beatSec;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noise;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6000;
        const g = this.pluckGain(st, 0.025, 0.08);
        src.connect(hp); hp.connect(g); g.connect(this.out);
        src.start(st); src.stop(st + 0.1);
      }
    }
  }
}
