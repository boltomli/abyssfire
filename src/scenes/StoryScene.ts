/**
 * StoryScene — full-screen overlay for everything narrative:
 *   - story sequences (prologue, epilogue) and the scrolling credits,
 *   - chapter title cards on first entry to a zone,
 *   - in-world cutscenes: letterbox bars, speaker dialogue with portraits,
 *     the antagonist's whispers and boss title cards. Camera work and screen
 *     effects are delegated back to the ZoneScene through `CutsceneHooks`.
 *
 * Runs above UIScene at zoom 1 (1280×720). Advance with click / Space /
 * Enter; Esc skips the whole sequence.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { t } from '../i18n';
import { isMobileDevice } from '../systems/MobileControlsSystem';
import type { Chapter, Cutscene, FocusTarget, Speaker, StorySequence, StorySlide } from '../data/story/types';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const SERIF = '"Noto Serif SC", "Songti SC", "Noto Sans SC", serif';
const SANS = '"Noto Sans SC", sans-serif';
const BAR_H = 78;
const DEPTH = 10000;

export interface CutsceneHooks {
  focus(target: FocusTarget, ms: number): Promise<void>;
  shake(intensity: number, ms: number): void;
  flash(color: number, ms: number): void;
  /** Portrait texture + frame for a speaker (null → emblem). */
  portrait(speaker: Speaker): { key: string; frame: number | string } | null;
  speakerName(speaker: Speaker): string;
}

const MOODS: Record<NonNullable<StorySlide['mood']>, { top: string; bottom: string; glow: string; embers: number }> = {
  embers: { top: '#0c0605', bottom: '#2a0f06', glow: 'rgba(255,120,40,0.35)', embers: 0xff9a3c },
  night: { top: '#03050c', bottom: '#101a33', glow: 'rgba(120,150,255,0.22)', embers: 0x9fb8ff },
  abyss: { top: '#07030a', bottom: '#260a2c', glow: 'rgba(200,40,120,0.32)', embers: 0xd24cff },
  dawn: { top: '#15142a', bottom: '#5a3a30', glow: 'rgba(255,190,120,0.35)', embers: 0xffd08a },
  forge: { top: '#0e0906', bottom: '#40200c', glow: 'rgba(255,140,40,0.4)', embers: 0xffb040 },
  sand: { top: '#1c1208', bottom: '#5a3c1a', glow: 'rgba(255,200,120,0.3)', embers: 0xffd79a },
  light: { top: '#1d2636', bottom: '#8a7550', glow: 'rgba(255,236,180,0.45)', embers: 0xfff1c8 },
};

type Advance = 'next' | 'skip';

export class StoryScene extends Phaser.Scene {
  private skipping = false;
  private waiters: ((a: Advance) => void)[] = [];
  private barTop!: Phaser.GameObjects.Rectangle;
  private barBottom!: Phaser.GameObjects.Rectangle;
  private layer!: Phaser.GameObjects.Container;
  private skipBtn!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'StoryScene' });
  }

  create(): void {
    this.layer = this.add.container(0, 0).setDepth(DEPTH);
    this.barTop = this.add.rectangle(W / 2, -BAR_H / 2, W, BAR_H, 0x000000).setDepth(DEPTH + 5);
    this.barBottom = this.add.rectangle(W / 2, H + BAR_H / 2, W, BAR_H, 0x000000).setDepth(DEPTH + 5);
    this.input.on('pointerdown', () => this.release('next'));
    this.input.keyboard?.on('keydown-SPACE', () => this.release('next'));
    this.input.keyboard?.on('keydown-ENTER', () => this.release('next'));
    this.input.keyboard?.on('keydown-ESC', () => this.skip());
    // Tappable skip (mobile has no Esc) — thumb-sized (≈ 48 CSS px tall) on touch devices.
    const touch = isMobileDevice();
    this.skipBtn = this.add.text(W - 22, 22, '', {
      fontFamily: SANS, fontSize: touch ? '28px' : '14px', color: '#b8a888', backgroundColor: '#00000088',
      padding: touch ? { x: 28, y: 26 } : { x: 10, y: 5 },
    }).setOrigin(1, 0).setDepth(DEPTH + 8).setVisible(false).setInteractive({ useHandCursor: true });
    this.skipBtn.on('pointerdown', () => this.skip());
  }

  private skip(): void {
    this.skipping = true;
    this.release('skip');
  }

  private showSkip(on: boolean): void {
    this.skipBtn.setText(t(isMobileDevice() ? 'story.ui.skipTouch' : 'story.ui.skip')).setVisible(on);
  }

  // ── Input plumbing ──────────────────────────────────────────

  private release(a: Advance): void {
    const w = this.waiters;
    this.waiters = [];
    for (const fn of w) fn(a);
  }

  /** Resolve on the next click/key (or immediately while skipping). */
  private waitInput(): Promise<Advance> {
    if (this.skipping) return Promise.resolve('skip');
    return new Promise(res => this.waiters.push(res));
  }

  /** Resolve after `ms`, or earlier on input/skip. */
  private waitOrInput(ms: number): Promise<Advance> {
    if (this.skipping) return Promise.resolve('skip');
    return new Promise(res => {
      const timer = this.time.delayedCall(ms, () => { this.waiters = this.waiters.filter(w => w !== done); res('next'); });
      const done = (a: Advance): void => { timer.remove(); res(a); };
      this.waiters.push(done);
    });
  }

  private sleep(ms: number): Promise<void> {
    if (this.skipping) return Promise.resolve();
    return new Promise(res => this.time.delayedCall(ms, () => res()));
  }

  private tweenTo(targets: object | object[], props: Record<string, unknown>, ms: number, ease = 'Sine.easeInOut'): Promise<void> {
    if (this.skipping) {
      const list = Array.isArray(targets) ? targets : [targets];
      for (const tg of list) Object.assign(tg as Record<string, unknown>, Object.fromEntries(Object.entries(props).filter(([, v]) => typeof v === 'number')));
      return Promise.resolve();
    }
    return new Promise(res => this.tweens.add({ targets, ...props, duration: ms, ease, onComplete: () => res() }));
  }

  private begin(): void {
    this.skipping = false;
    this.waiters = [];
    this.scene.bringToTop();
    this.layer.removeAll(true);
  }

  // ── Backdrops ───────────────────────────────────────────────

  private moodTexture(mood: NonNullable<StorySlide['mood']>): string {
    const key = `story_mood_${mood}`;
    if (this.textures.exists(key)) return key;
    const m = MOODS[mood];
    const c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    const g = x.createLinearGradient(0, 0, 0, 180);
    g.addColorStop(0, m.top); g.addColorStop(1, m.bottom);
    x.fillStyle = g; x.fillRect(0, 0, 320, 180);
    const r = x.createRadialGradient(160, 150, 10, 160, 150, 190);
    r.addColorStop(0, m.glow); r.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = r; x.fillRect(0, 0, 320, 180);
    const v = x.createRadialGradient(160, 90, 60, 160, 90, 210);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)');
    x.fillStyle = v; x.fillRect(0, 0, 320, 180);
    this.textures.addCanvas(key, c);
    return key;
  }

  private embers(color: number, depth: number): Phaser.GameObjects.Particles.ParticleEmitter | null {
    const tex = this.textures.exists('fx_core') ? 'fx_core' : null;
    if (!tex) return null;
    return this.add.particles(0, 0, tex, {
      x: { min: 0, max: W }, y: H + 10,
      speedY: { min: -60, max: -18 }, speedX: { min: -14, max: 14 },
      scale: { start: 0.12, end: 0.02 }, alpha: { start: 0.85, end: 0 },
      lifespan: { min: 5000, max: 9000 }, frequency: 140, tint: color, blendMode: 'ADD',
    }).setDepth(depth);
  }

  /** Soft additive glow behind a title (instead of a text shadow, which boxes). */
  private glowBehind(x: number, y: number, width: number, color: number, depth: number): Phaser.GameObjects.Image {
    const tex = this.textures.exists('fx_glow') ? 'fx_glow' : '__WHITE';
    const img = this.add.image(x, y, tex).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth).setAlpha(0);
    img.setDisplaySize(width, width * 0.32);
    return img;
  }

  // ── Story sequences (prologue / epilogue / credits) ────────

  async playSequence(seq: StorySequence): Promise<void> {
    this.begin();
    const bg = this.add.image(W / 2, H / 2, this.moodTexture(seq.slides[0]?.mood ?? 'embers'))
      .setDisplaySize(W, H).setDepth(DEPTH).setAlpha(0);
    const black = this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setDepth(DEPTH - 1);
    const fx = this.embers(MOODS[seq.slides[0]?.mood ?? 'embers'].embers, DEPTH + 1);
    this.showSkip(true);
    await this.tweenTo(bg, { alpha: 1 }, 900);

    if (seq.credits) {
      await this.rollCredits(seq);
    } else {
      for (const slide of seq.slides) {
        if (this.skipping) break;
        if (slide.mood) {
          const next = this.moodTexture(slide.mood);
          if (bg.texture.key !== next) {
            await this.tweenTo(bg, { alpha: 0 }, 400);
            bg.setTexture(next).setDisplaySize(W, H);
            fx?.setParticleTint(MOODS[slide.mood].embers);
            await this.tweenTo(bg, { alpha: 1 }, 500);
          }
        }
        await this.showSlide(slide);
      }
    }

    this.showSkip(false);
    this.skipping = false;
    await this.tweenTo([bg], { alpha: 0 }, 700);
    fx?.destroy(); bg.destroy(); black.destroy();
  }

  private async showSlide(slide: StorySlide): Promise<void> {
    const parts: Phaser.GameObjects.Text[] = [];
    let y = H / 2 - 90;
    if (slide.heading) {
      parts.push(this.add.text(W / 2, y, t(slide.heading), {
        fontFamily: SERIF, fontSize: '18px', color: '#c9a45a', letterSpacing: 6,
      }).setOrigin(0.5));
      y += 40;
    }
    if (slide.title) {
      parts.push(this.add.text(W / 2, y, t(slide.title), {
        fontFamily: SERIF, fontSize: '44px', color: '#f3d9a0', fontStyle: 'bold',
        stroke: '#1a0c04', strokeThickness: 6, letterSpacing: 4,
      }).setOrigin(0.5));
      y += 70;
    }
    if (slide.text) {
      for (const line of t(slide.text).split('\n')) {
        parts.push(this.add.text(W / 2, y, line, {
          fontFamily: SERIF, fontSize: '22px', color: '#eadcc0', align: 'center', lineSpacing: 10,
          wordWrap: { width: 900, useAdvancedWrap: true }, stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5, 0));
        y += parts[parts.length - 1].height + 12;
      }
    }
    // Vertically centre the block.
    const top = parts[0]?.y ?? H / 2;
    const bottom = parts.length ? parts[parts.length - 1].y + parts[parts.length - 1].height : H / 2;
    const shift = (H / 2 - (top + bottom) / 2);
    for (const p of parts) p.setY(p.y + shift).setDepth(DEPTH + 3).setAlpha(0);
    // Staggered fade-in; a click shows everything at once.
    let rushed = false;
    for (const p of parts) {
      if (rushed || this.skipping) { p.setAlpha(1); continue; }
      const r = await Promise.race([this.tweenTo(p, { alpha: 1 }, 900).then(() => 'done' as const), this.waitInput()]);
      if (r !== 'done') { rushed = true; p.setAlpha(1); }
    }
    if (!this.skipping) {
      const hint = this.add.text(W / 2, H - 46, '▼', { fontFamily: SANS, fontSize: '16px', color: '#c9a45a' })
        .setOrigin(0.5).setDepth(DEPTH + 3);
      this.tweens.add({ targets: hint, alpha: 0.2, y: H - 40, duration: 700, yoyo: true, repeat: -1 });
      await this.waitInput();
      hint.destroy();
    }
    await this.tweenTo(parts, { alpha: 0 }, 450);
    for (const p of parts) p.destroy();
  }

  private async rollCredits(seq: StorySequence): Promise<void> {
    const col = this.add.container(W / 2, H + 40).setDepth(DEPTH + 3);
    let y = 0;
    for (const s of seq.slides) {
      if (s.heading) { col.add(this.add.text(0, y, t(s.heading), { fontFamily: SERIF, fontSize: '16px', color: '#c9a45a', letterSpacing: 4 }).setOrigin(0.5, 0)); y += 30; }
      if (s.title) { col.add(this.add.text(0, y, t(s.title), { fontFamily: SERIF, fontSize: '34px', color: '#f3d9a0', fontStyle: 'bold', stroke: '#1a0c04', strokeThickness: 5 }).setOrigin(0.5, 0)); y += 52; }
      if (s.text) {
        const tx = this.add.text(0, y, t(s.text), { fontFamily: SERIF, fontSize: '20px', color: '#eadcc0', align: 'center', lineSpacing: 10, wordWrap: { width: 900, useAdvancedWrap: true } }).setOrigin(0.5, 0);
        col.add(tx); y += tx.height;
      }
      y += 90;
    }
    const total = H + 40 + y;
    const speed = 42; // px/s
    const rolled = this.tweenTo(col, { y: H + 40 - total }, (total / speed) * 1000, 'Linear');
    // Clicking speeds the roll up; Esc skips.
    const speedUp = (): void => { for (const tw of this.tweens.getTweensOf(col)) tw.timeScale = 4; };
    this.input.once('pointerdown', speedUp);
    await Promise.race([rolled, new Promise<void>(res => { const check = (): void => { if (this.skipping) res(); else this.time.delayedCall(100, check); }; check(); })]);
    this.input.off('pointerdown', speedUp);
    col.destroy(true);
  }

  // ── Chapter cards ───────────────────────────────────────────

  async playChapter(ch: Chapter): Promise<void> {
    this.begin();
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(DEPTH);
    const mood = MOODS[ch.mood];
    const glow = this.add.image(W / 2, H / 2, this.moodTexture(ch.mood)).setDisplaySize(W, H).setDepth(DEPTH).setAlpha(0);
    const num = this.add.text(W / 2, H / 2 - 92, t(ch.number), {
      fontFamily: SERIF, fontSize: '20px', color: '#c9a45a', letterSpacing: 10,
    }).setOrigin(0.5).setDepth(DEPTH + 2).setAlpha(0);
    const title = this.add.text(W / 2, H / 2 - 36, t(ch.title), {
      fontFamily: SERIF, fontSize: '56px', color: '#f6e0a8', fontStyle: 'bold', letterSpacing: 8,
      stroke: '#140a03', strokeThickness: 7,
    }).setOrigin(0.5).setDepth(DEPTH + 2).setAlpha(0);
    const halo = this.glowBehind(W / 2, H / 2 - 36, Math.max(420, title.width * 1.6), mood.embers, DEPTH + 1);
    const sub = this.add.text(W / 2, H / 2 + 22, t(ch.subtitle), {
      fontFamily: SERIF, fontSize: '22px', color: '#e2cfa4', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(DEPTH + 2).setAlpha(0);
    // Grow by scaleX: tweening a Rectangle's width leaves its origin behind.
    const lineL = this.add.rectangle(W / 2 - 20, H / 2 + 52, 260, 2, 0xc9a45a).setOrigin(1, 0.5).setDepth(DEPTH + 2).setScale(0, 1);
    const lineR = this.add.rectangle(W / 2 + 20, H / 2 + 52, 260, 2, 0xc9a45a).setOrigin(0, 0.5).setDepth(DEPTH + 2).setScale(0, 1);
    const body = this.add.text(W / 2, H / 2 + 74, t(ch.text), {
      fontFamily: SERIF, fontSize: '19px', color: '#d8c8a8', align: 'center', lineSpacing: 8,
      wordWrap: { width: 820, useAdvancedWrap: true }, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(DEPTH + 2).setAlpha(0);
    const fx = this.embers(mood.embers, DEPTH + 1);

    await this.tweenTo(shade, { fillAlpha: 0.72 }, 600);
    this.tweenTo(glow, { alpha: 0.55 }, 900);
    await this.tweenTo(num, { alpha: 1 }, 500);
    title.setScale(1.08);
    this.tweenTo(halo, { alpha: 0.55 }, 1200);
    await this.tweenTo(title, { alpha: 1, scale: 1 }, 900, 'Cubic.easeOut');
    this.tweenTo([lineL, lineR], { scaleX: 1 }, 700, 'Cubic.easeOut');
    await this.tweenTo(sub, { alpha: 1 }, 600);
    await this.tweenTo(body, { alpha: 1 }, 900);
    await this.waitOrInput(3800);
    await this.tweenTo([num, title, sub, body, lineL, lineR, glow, halo], { alpha: 0 }, 900);
    await this.tweenTo(shade, { fillAlpha: 0 }, 700);
    fx?.destroy();
    for (const o of [shade, glow, num, title, sub, lineL, lineR, body, halo]) o.destroy();
  }

  // ── Cutscenes ───────────────────────────────────────────────

  async playCutscene(cs: Cutscene, hooks: CutsceneHooks): Promise<void> {
    this.begin();
    this.showSkip(true);
    await this.letterbox(true);
    for (const step of cs.steps) {
      if (this.skipping) break;
      switch (step.kind) {
        case 'narrate': await this.narrate(t(step.text)); break;
        case 'say': await this.say(step.speaker, t(step.text), hooks); break;
        case 'whisper': await this.whisper(t(step.text)); break;
        case 'title': await this.titleCard(t(step.title), t(step.subtitle)); break;
        case 'focus': await hooks.focus(step.target, step.ms ?? 900); break;
        case 'shake': hooks.shake(step.intensity ?? 0.01, step.ms ?? 500); break;
        case 'flash': hooks.flash(step.color ?? 0xffffff, step.ms ?? 300); break;
        case 'wait': await this.sleep(step.ms); break;
      }
    }
    this.skipping = false;
    this.showSkip(false);
    await this.letterbox(false);
  }

  private async letterbox(on: boolean): Promise<void> {
    await Promise.all([
      this.tweenTo(this.barTop, { y: on ? BAR_H / 2 : -BAR_H / 2 }, 450, 'Cubic.easeOut'),
      this.tweenTo(this.barBottom, { y: on ? H - BAR_H / 2 : H + BAR_H / 2 }, 450, 'Cubic.easeOut'),
    ]);
  }

  private async narrate(text: string): Promise<void> {
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(DEPTH);
    const tx = this.add.text(W / 2, H / 2, text, {
      fontFamily: SERIF, fontSize: '24px', color: '#efe2c4', align: 'center', lineSpacing: 10,
      wordWrap: { width: 860, useAdvancedWrap: true }, stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH + 2).setAlpha(0);
    await this.tweenTo(shade, { fillAlpha: 0.55 }, 400);
    await this.tweenTo(tx, { alpha: 1 }, 700);
    await this.waitInput();
    await this.tweenTo([tx], { alpha: 0 }, 350);
    await this.tweenTo(shade, { fillAlpha: 0 }, 300);
    tx.destroy(); shade.destroy();
  }

  /** Typewriter text; a click finishes the line, the next click continues. */
  private async typeInto(tx: Phaser.GameObjects.Text, full: string, cps = 38): Promise<void> {
    if (this.skipping) { tx.setText(full); return; }
    let shown = 0;
    let done = false;
    const ev = this.time.addEvent({
      delay: 1000 / cps, loop: true,
      callback: () => { shown++; tx.setText(full.slice(0, shown)); if (shown >= full.length) { done = true; ev.remove(); } },
    });
    const r = await Promise.race([
      new Promise<'done'>(res => { const poll = (): void => { if (done) res('done'); else this.time.delayedCall(40, poll); }; poll(); }),
      this.waitInput(),
    ]);
    if (r !== 'done') { ev.remove(); tx.setText(full); }
  }

  private async say(speaker: Speaker, text: string, hooks: CutsceneHooks): Promise<void> {
    const boxW = 900, boxH = 150;
    const bx = (W - boxW) / 2, by = H - BAR_H - boxH - 10;
    const villain = speaker === 'villain';
    const box = this.add.graphics().setDepth(DEPTH + 3);
    box.fillStyle(villain ? 0x12061a : 0x100b07, 0.93);
    box.fillRoundedRect(bx, by, boxW, boxH, 10);
    box.lineStyle(2, villain ? 0x9b4dff : 0xc9a45a, 0.9);
    box.strokeRoundedRect(bx, by, boxW, boxH, 10);
    box.lineStyle(1, villain ? 0x4a1f66 : 0x5a4420, 0.9);
    box.strokeRoundedRect(bx + 5, by + 5, boxW - 10, boxH - 10, 7);

    // Portrait medallion
    const pcx = bx + 78, pcy = by + boxH / 2;
    const medal = this.add.graphics().setDepth(DEPTH + 4);
    medal.fillStyle(0x000000, 0.85); medal.fillCircle(pcx, pcy, 56);
    medal.lineStyle(3, villain ? 0x9b4dff : 0xc9a45a, 1); medal.strokeCircle(pcx, pcy, 56);
    const objs: Phaser.GameObjects.GameObject[] = [box, medal];
    const pic = hooks.portrait(speaker);
    if (pic && this.textures.exists(pic.key)) {
      // Frame the head and shoulders: the top ~45% of the character's opaque bounds.
      const img = this.add.image(0, 0, pic.key, pic.frame).setDepth(DEPTH + 4).setOrigin(0, 0);
      const b = this.opaqueBounds(pic.key, pic.frame);
      const focusH = Math.max(1, b.h * 0.45);
      const scale = 118 / Math.max(focusH, b.w * 0.8);
      img.setScale(scale);
      img.setPosition(pcx - (b.x + b.w / 2) * scale, pcy - (b.y + focusH * 0.52) * scale);
      const mask = this.make.graphics({}, false).fillCircle(pcx, pcy, 53).createGeometryMask();
      img.setMask(mask);
      objs.push(img);
    } else {
      objs.push(this.emblem(pcx, pcy, villain));
    }

    const name = this.add.text(bx + 156, by + 20, hooks.speakerName(speaker), {
      fontFamily: SERIF, fontSize: '20px', color: villain ? '#d9a6ff' : '#f0cf86', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setDepth(DEPTH + 4);
    const body = this.add.text(bx + 156, by + 54, '', {
      fontFamily: SERIF, fontSize: '20px', color: villain ? '#eadcff' : '#f1e6cf', lineSpacing: 8,
      wordWrap: { width: boxW - 190, useAdvancedWrap: true },
    }).setDepth(DEPTH + 4);
    objs.push(name, body);
    for (const o of objs) (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha(0);
    await this.tweenTo(objs, { alpha: 1 }, 220);
    await this.typeInto(body, text);
    const more = this.add.text(bx + boxW - 26, by + boxH - 22, '▼', { fontFamily: SANS, fontSize: '14px', color: villain ? '#b889ff' : '#c9a45a' })
      .setOrigin(0.5).setDepth(DEPTH + 4);
    this.tweens.add({ targets: more, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });
    await this.waitInput();
    more.destroy();
    await this.tweenTo(objs, { alpha: 0 }, 160);
    for (const o of objs) o.destroy();
  }

  private readonly boundsCache = new Map<string, { x: number; y: number; w: number; h: number }>();

  /** Opaque bounding box of a texture frame (cached), in frame pixels. */
  private opaqueBounds(key: string, frame: number | string): { x: number; y: number; w: number; h: number } {
    const id = `${key}#${frame}`;
    const hit = this.boundsCache.get(id);
    if (hit) return hit;
    const fr = this.textures.getFrame(key, frame);
    const full = { x: 0, y: 0, w: fr.cutWidth, h: fr.cutHeight };
    const src = fr.source.image as CanvasImageSource | undefined;
    if (!src) return full;
    const c = document.createElement('canvas');
    c.width = fr.cutWidth; c.height = fr.cutHeight;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
    for (let py = 0; py < c.height; py += 2) {
      for (let px = 0; px < c.width; px += 2) {
        if (d[(py * c.width + px) * 4 + 3] > 40) {
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
        }
      }
    }
    const out = maxX < 0 ? full : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    this.boundsCache.set(id, out);
    return out;
  }

  /** Stand-in portrait for speakers without a sprite: an eye in violet flame (villain) or a sigil. */
  private emblem(x: number, y: number, villain: boolean): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(DEPTH + 4);
    if (villain) {
      for (let i = 5; i >= 1; i--) { g.fillStyle(0x6a1fb0, 0.12 * i); g.fillEllipse(x, y, 20 + i * 14, 12 + i * 7); }
      g.fillStyle(0xffd0ff, 1); g.fillEllipse(x, y, 30, 12);
      g.fillStyle(0x2a0036, 1); g.fillEllipse(x, y, 8, 12);
    } else {
      g.lineStyle(3, 0xc9a45a, 1); g.strokeCircle(x, y, 26);
      g.fillStyle(0xff9a3c, 0.9); g.fillTriangle(x, y - 18, x - 12, y + 12, x + 12, y + 12);
    }
    return g;
  }

  private async whisper(text: string): Promise<void> {
    const key = 'story_whisper_vignette';
    if (!this.textures.exists(key)) {
      const c = document.createElement('canvas'); c.width = 320; c.height = 180;
      const x = c.getContext('2d', { willReadFrequently: true })!;
      const r = x.createRadialGradient(160, 90, 40, 160, 90, 200);
      r.addColorStop(0, 'rgba(20,0,30,0.25)'); r.addColorStop(0.6, 'rgba(60,0,90,0.6)'); r.addColorStop(1, 'rgba(10,0,16,0.95)');
      x.fillStyle = r; x.fillRect(0, 0, 320, 180);
      this.textures.addCanvas(key, c);
    }
    const veil = this.add.image(W / 2, H / 2, key).setDisplaySize(W, H).setDepth(DEPTH + 1).setAlpha(0);
    const style = { fontFamily: SERIF, fontSize: '28px', align: 'center', lineSpacing: 12, wordWrap: { width: 820, useAdvancedWrap: true } };
    const ghostA = this.add.text(W / 2 - 3, H / 2, text, { ...style, color: '#ff3a8c' }).setOrigin(0.5).setDepth(DEPTH + 2).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    const ghostB = this.add.text(W / 2 + 3, H / 2, text, { ...style, color: '#4a6bff' }).setOrigin(0.5).setDepth(DEPTH + 2).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    const main = this.add.text(W / 2, H / 2, text, { ...style, color: '#f0dcff', stroke: '#1a0026', strokeThickness: 5 })
      .setOrigin(0.5).setDepth(DEPTH + 3).setAlpha(0);
    const jitter = this.time.addEvent({
      delay: 60, loop: true,
      callback: () => {
        main.setPosition(W / 2 + (Math.random() - 0.5) * 2.4, H / 2 + (Math.random() - 0.5) * 2.4);
        ghostA.setX(W / 2 - 3 - Math.random() * 3); ghostB.setX(W / 2 + 3 + Math.random() * 3);
      },
    });
    await this.tweenTo(veil, { alpha: 1 }, 600);
    await this.tweenTo([main], { alpha: 1 }, 700);
    this.tweenTo([ghostA, ghostB], { alpha: 0.45 }, 400);
    await this.waitInput();
    await this.tweenTo([main, ghostA, ghostB, veil], { alpha: 0 }, 600);
    jitter.remove();
    for (const o of [veil, ghostA, ghostB, main]) o.destroy();
  }

  private async titleCard(title: string, subtitle: string): Promise<void> {
    const band = this.add.rectangle(W / 2, H / 2, W, 150, 0x000000, 0).setDepth(DEPTH + 1);
    const name = this.add.text(W / 2, H / 2 - 16, title, {
      fontFamily: SERIF, fontSize: '54px', color: '#ffe2a8', fontStyle: 'bold', letterSpacing: 6,
      stroke: '#2a0a02', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(DEPTH + 2).setAlpha(0).setScale(1.25);
    const halo = this.glowBehind(W / 2, H / 2 - 16, Math.max(460, name.width * 1.7), 0xff5a1a, DEPTH + 1);
    const epi = this.add.text(W / 2, H / 2 + 40, subtitle, {
      fontFamily: SERIF, fontSize: '22px', color: '#d9b98a', letterSpacing: 4, stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH + 2).setAlpha(0);
    const slash = this.add.rectangle(W / 2, H / 2 + 14, 520, 3, 0xff8a3c).setDepth(DEPTH + 2).setScale(0, 1);
    await this.tweenTo(band, { fillAlpha: 0.6 }, 200);
    this.tweenTo(halo, { alpha: 0.6 }, 500);
    await this.tweenTo(name, { alpha: 1, scale: 1 }, 380, 'Back.easeOut');
    this.tweenTo(slash, { scaleX: 1 }, 380, 'Cubic.easeOut');
    await this.tweenTo(epi, { alpha: 1 }, 400);
    await this.waitOrInput(2200);
    await this.tweenTo([band, name, epi, slash, halo], { alpha: 0 }, 450);
    for (const o of [band, name, epi, slash, halo]) o.destroy();
  }
}
