/**
 * Abyss Labyrinth (深渊迷宫) UI, driven purely by the EventBus contract in
 * src/utils/EventBus.ts:
 *
 *   DUNGEON_TIER_PICK  → tier picker   → DUNGEON_TIER_CHOSEN { tier } (0 = cancel)
 *   DUNGEON_BOON_OFFER → boon cards    → DUNGEON_BOON_CHOSEN { boonId } (mandatory)
 *   DUNGEON_HUD        → run widget (null hides it)
 *   DUNGEON_RUN_END    → run summary
 *
 * Constructed by UIScene with the scene; all objects live in that scene.
 */
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import {
  EventBus, GameEvents,
  type DungeonTierPickPayload, type DungeonBoonOfferPayload, type DungeonHudPayload, type DungeonRunEndPayload,
} from '../utils/EventBus';
import { DisposableScope } from '../utils/DisposableScope';
import { t } from '../i18n';
import { isMobileDevice } from '../systems/MobileControlsSystem';
import type { BoonDef, BoonRarity } from '../data/abyssRun';
import { ensureBoonGlyph } from '../graphics/icons/BoonGlyphs';
import {
  addFrame, addButton, addDivider, addTitleFlourishes, addSectionHeader, backdropTexture, frameTexture,
  UI_FONT, UI_TITLE_FONT, UI_COLORS, type UiButton,
} from './UiKit';
import {
  getBoon, boonName, boonDescLines, curseName, curseDesc, themeName, recommendedLevel, formatRunTime,
} from './AbyssRunFormat';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;

/** Above the regular panels (4000) and below item tooltips (5000). */
const DEPTH = { hud: 3000, backdrop: 4500, panel: 4501, fx: 4600, tip: 5100 } as const;

/** Upper bound for the mobile panel fit scale (matches UIScene). */
const MOBILE_PANEL_MAX_SCALE = 2;

export interface AbyssRunUIOptions {
  /**
   * Run widget frame rectangle: `x`/`y` are the top-left corner, `w` its width. The
   * widget grows downwards.
   */
  hudAnchor: { x: number; y: number; w: number };
  /** Called when the widget's bottom edge moves (null = hidden) so the host can shift what sits below. */
  onHudResize?: (bottom: number | null) => void;
}

interface RarityStyle {
  main: string;
  second: string;
  dark: string;
  glow: number;
  label: string;
  name: string;
}

const RARITY: Record<BoonRarity, RarityStyle> = {
  common: { main: '#c9d2de', second: '#8e98a8', dark: '#2a2e36', glow: 0xdfe8f4, label: '#c9d2de', name: '#f2f5fa' },
  rare: { main: '#4f8cff', second: '#2a5cc0', dark: '#14244a', glow: 0x4f8cff, label: '#7fb0ff', name: '#a9c9ff' },
  epic: { main: '#a45cff', second: '#ffd06a', dark: '#2e1446', glow: 0xb070ff, label: '#c89aff', name: '#ffd98a' },
};

function hexNum(s: string): number {
  return parseInt(s.replace('#', ''), 16);
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bake(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.save();
  draw(ctx);
  ctx.restore();
  tex.refresh();
  return key;
}

const CARD_MARGIN = 12;
/** Glyph medallion centre, measured from the card's top edge. */
const CARD_MEDAL_Y = 88;
const CARD_MEDAL_R = 50;

/** Boon card body: rarity-coloured frame, dark body, recessed glyph medallion. */
function cardTexture(scene: Phaser.Scene, w: number, h: number, rarity: BoonRarity, hover: boolean): string {
  const key = `abyss_card_${rarity}_${w}x${h}_${hover ? 'h' : 'n'}`;
  const st = RARITY[rarity];
  const M = CARD_MARGIN;
  return bake(scene, key, w + M * 2, h + M * 2, (ctx) => {
    const x = M, y = M;
    // Outer glow (stronger on hover) + drop shadow
    ctx.save();
    ctx.shadowColor = hover ? st.main : 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = hover ? 14 : 10;
    ctx.shadowOffsetY = hover ? 0 : 4;
    rr(ctx, x, y, w, h, 10);
    ctx.fillStyle = '#0c0a0e';
    ctx.fill();
    ctx.restore();

    // Body
    ctx.save();
    rr(ctx, x, y, w, h, 10);
    ctx.clip();
    const body = ctx.createLinearGradient(0, y, 0, y + h);
    body.addColorStop(0, st.dark);
    body.addColorStop(0.42, '#16131a');
    body.addColorStop(1, '#0d0b10');
    ctx.fillStyle = body;
    ctx.fillRect(x, y, w, h);
    // Warm light from the upper left
    const warm = ctx.createRadialGradient(x + w * 0.2, y, 0, x + w * 0.2, y, h * 0.8);
    warm.addColorStop(0, 'rgba(255,220,170,0.08)');
    warm.addColorStop(1, 'rgba(255,220,170,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(x, y, w, h);
    // Rarity aura behind the medallion
    const cx = x + w / 2, cy = y + CARD_MEDAL_Y;
    const aura = ctx.createRadialGradient(cx, cy, CARD_MEDAL_R * 0.6, cx, cy, CARD_MEDAL_R * 2.1);
    aura.addColorStop(0, `${st.main}${hover ? '66' : '40'}`);
    aura.addColorStop(1, `${st.main}00`);
    ctx.fillStyle = aura;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // Medallion well
    ctx.beginPath();
    ctx.arc(cx, cy, CARD_MEDAL_R, 0, Math.PI * 2);
    const well = ctx.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, CARD_MEDAL_R);
    well.addColorStop(0, '#2a2530');
    well.addColorStop(1, '#08070a');
    ctx.fillStyle = well;
    ctx.fill();
    ctx.lineWidth = 3;
    const ring = ctx.createLinearGradient(cx - CARD_MEDAL_R, cy - CARD_MEDAL_R, cx + CARD_MEDAL_R, cy + CARD_MEDAL_R);
    ring.addColorStop(0, st.main);
    ring.addColorStop(1, st.second);
    ctx.strokeStyle = ring;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, CARD_MEDAL_R + 2.5, 0, Math.PI * 2);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#050407';
    ctx.stroke();

    // Frame: black outline, rarity band, light inner hairline
    rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 10);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#050407';
    ctx.stroke();
    const band = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
    band.addColorStop(0, st.main);
    band.addColorStop(1, st.second);
    rr(ctx, x + 3, y + 3, w - 6, h - 6, 8);
    ctx.lineWidth = hover ? 3.5 : 3;
    ctx.strokeStyle = band;
    ctx.stroke();
    rr(ctx, x + 6, y + 6, w - 12, h - 12, 6);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,245,225,0.16)';
    ctx.stroke();

    // Epic: gold corner diamonds
    if (rarity === 'epic') {
      for (const [dx, dy] of [[x + 3, y + 3], [x + w - 3, y + 3], [x + 3, y + h - 3], [x + w - 3, y + h - 3]]) {
        ctx.beginPath();
        ctx.moveTo(dx, dy - 7); ctx.lineTo(dx + 7, dy); ctx.lineTo(dx, dy + 7); ctx.lineTo(dx - 7, dy);
        ctx.closePath();
        ctx.fillStyle = st.second;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#3b2507';
        ctx.stroke();
      }
    }
    // Rarity band under the label
    ctx.fillStyle = `${st.main}30`;
    ctx.fillRect(x + 7, y + 7, w - 14, 22);
  });
}

/** Small round badge (key number / stack count backing). */
function badgeTexture(scene: Phaser.Scene, r: number, color: string): string {
  const S = Math.ceil(r * 2 + 4);
  return bake(scene, `abyss_badge_${r}_${color}`, S, S, (ctx) => {
    const c = S / 2;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(c - r * 0.3, c - r * 0.4, 0, c, c, r);
    g.addColorStop(0, '#3a3440');
    g.addColorStop(1, '#0e0c10');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = color;
    ctx.stroke();
  });
}

/** Big tier sigil: concentric runic rings behind the tier number. */
function sigilTexture(scene: Phaser.Scene, r: number): string {
  const S = r * 2 + 8;
  return bake(scene, `abyss_sigil_${r}`, S, S, (ctx) => {
    const c = S / 2;
    const glow = ctx.createRadialGradient(c, c, r * 0.2, c, c, r);
    glow.addColorStop(0, 'rgba(160,60,220,0.45)');
    glow.addColorStop(0.7, 'rgba(90,20,140,0.18)');
    glow.addColorStop(1, 'rgba(90,20,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, S, S);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(212,165,74,0.8)';
    ctx.beginPath(); ctx.arc(c, c, r - 4, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(200,140,255,0.55)';
    ctx.beginPath(); ctx.arc(c, c, r - 11, 0, Math.PI * 2); ctx.stroke();
    // rune ticks
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r0 = r - 11, r1 = i % 3 === 0 ? r - 4 : r - 7;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(255,217,138,0.9)' : 'rgba(212,165,74,0.5)';
      ctx.lineWidth = i % 3 === 0 ? 2 : 1;
      ctx.stroke();
    }
  });
}

/** Horizontal ribbon banner ("新纪录!"). */
function bannerTexture(scene: Phaser.Scene, w: number, h: number): string {
  return bake(scene, `abyss_banner_${w}x${h}`, w + 4, h + 4, (ctx) => {
    const x = 2, y = 2, n = h * 0.45;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - n, y + h / 2); ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h); ctx.lineTo(x + n, y + h / 2); ctx.closePath();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#b8321e');
    g.addColorStop(1, '#6a140c');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#ffd98a';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,230,190,0.18)';
    ctx.fillRect(x + n, y + 2, w - n * 2, h * 0.3);
  });
}

type Tip = { container: Phaser.GameObjects.Container; owner: Phaser.GameObjects.GameObject };

export class AbyssRunUI {
  private readonly scene: Phaser.Scene;
  private readonly opts: AbyssRunUIOptions;
  private readonly mobile = isMobileDevice();
  private subs = new DisposableScope();

  private backdrop: Phaser.GameObjects.Image | null = null;
  private tierPanel: Phaser.GameObjects.Container | null = null;
  private boonPanel: Phaser.GameObjects.Container | null = null;
  private summaryPanel: Phaser.GameObjects.Container | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  private tier = 1;
  private tierPick: DungeonTierPickPayload | null = null;
  private boonOffer: DungeonBoonOfferPayload | null = null;
  private boonPicked = false;
  private boonCards: Phaser.GameObjects.Container[] = [];

  private hud: Phaser.GameObjects.Container | null = null;
  private hudFrame: Phaser.GameObjects.Image | null = null;
  private hudData: DungeonHudPayload | null = null;
  private hudTimer: Phaser.GameObjects.Text | null = null;
  private hudTimerEvent: Phaser.Time.TimerEvent | null = null;
  private hudBoonSlots = new Map<string, { x: number; y: number }>();
  private hudSealOpen: boolean | null = null;

  private tip: Tip | null = null;
  private tipTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, opts: AbyssRunUIOptions) {
    this.scene = scene;
    this.opts = opts;
    this.subs.on(EventBus, GameEvents.DUNGEON_TIER_PICK, this.openTierPicker, this);
    this.subs.on(EventBus, GameEvents.DUNGEON_BOON_OFFER, this.openBoonOffer, this);
    this.subs.on(EventBus, GameEvents.DUNGEON_HUD, this.setHud, this);
    this.subs.on(EventBus, GameEvents.DUNGEON_RUN_END, this.openSummary, this);
    this.subs.on(EventBus, GameEvents.LOCALE_CHANGED, this.handleLocaleChanged, this);
    // Touch: a tap anywhere else dismisses an open tooltip.
    const onDown = (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void => {
      if (this.tip && !over.includes(this.tip.owner)) this.hideTip();
    };
    scene.input.on('pointerdown', onDown);
    this.subs.add(() => scene.input.off('pointerdown', onDown));
  }

  // ── Public API (UIScene) ────────────────────────────────────────────────

  /** A labyrinth modal (tier picker, boon choice, summary) is open. */
  isModalOpen(): boolean {
    return !!(this.tierPanel || this.boonPanel || this.summaryPanel);
  }

  /** The mandatory boon choice is up: other panels must not open over it. */
  blocksPanels(): boolean {
    return !!this.boonPanel;
  }

  /**
   * Close the dismissable modals (UIScene.closeAllPanels). The tier picker counts as a
   * cancel; the boon choice is mandatory and stays.
   */
  closeDismissable(): void {
    if (this.tierPanel) this.closeTierPicker(0);
    if (this.summaryPanel) this.closeSummary();
    this.hideTip();
  }

  destroy(): void {
    this.subs.dispose();
    this.detachKeys();
    this.hideTip();
    this.tierPanel?.destroy(); this.tierPanel = null;
    this.boonPanel?.destroy(); this.boonPanel = null;
    this.summaryPanel?.destroy(); this.summaryPanel = null;
    this.backdrop?.destroy(); this.backdrop = null;
    this.destroyHud();
  }

  // ── Shared helpers ──────────────────────────────────────────────────────

  /** HUD font size: touch devices raise small text so it stays legible (as UIScene's hfs). */
  private hfs(base: number): string {
    return `${this.mobile ? Math.max(Math.round(base * 1.6), 18) : base}px`;
  }

  private text(x: number, y: number, s: string, size: number, color: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, s, {
      fontSize: `${size}px`, fontFamily: UI_FONT, color, stroke: '#000000', strokeThickness: 2, ...extra,
    });
  }

  private ensureBackdrop(): void {
    if (this.backdrop) return;
    this.backdrop = this.scene.add.image(W / 2, H / 2, backdropTexture(this.scene, W, H))
      .setDisplaySize(W, H).setInteractive().setDepth(DEPTH.backdrop).setAlpha(0);
    this.scene.tweens.add({ targets: this.backdrop, alpha: 1, duration: 160 });
  }

  private dropBackdropIfIdle(): void {
    if (this.isModalOpen() || !this.backdrop) return;
    const bd = this.backdrop;
    this.backdrop = null;
    bd.disableInteractive();
    this.scene.tweens.add({ targets: bd, alpha: 0, duration: 160, onComplete: () => bd.destroy() });
  }

  /**
   * Centre a pw×ph panel on screen. Touch devices scale it up to fill the phone screen
   * (text in 1280×720 panels is tiny there), as UIScene does for its own panels.
   */
  private placePanel(panel: Phaser.GameObjects.Container, pw: number, ph: number): number {
    const m = 12;
    const s = this.mobile ? Math.max(1, Math.min(MOBILE_PANEL_MAX_SCALE, (W - m * 2) / pw, (H - m * 2) / ph)) : 1;
    panel.setSize(pw, ph);
    panel.setPosition(Math.round(W / 2 - (pw * s) / 2), Math.round(H / 2 - (ph * s) / 2));
    panel.setData('fitScale', s);
    panel.setScale(s * 0.92).setAlpha(0);
    // Scale about the centre while popping in.
    const x0 = panel.x, y0 = panel.y;
    panel.setPosition(x0 + (pw * s * 0.04), y0 + (ph * s * 0.04));
    this.scene.tweens.add({ targets: panel, scaleX: s, scaleY: s, x: x0, y: y0, alpha: 1, duration: 170, ease: 'Back.easeOut' });
    return s;
  }

  private panelTitle(panel: Phaser.GameObjects.Container, pw: number, cy: number, title: string, color: string, size: number): Phaser.GameObjects.Text {
    const txt = this.scene.add.text(pw / 2, cy, title, {
      fontSize: `${size}px`, fontFamily: UI_TITLE_FONT, color, fontStyle: 'bold',
      stroke: '#120b04', strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true },
    }).setOrigin(0.5);
    panel.add(addTitleFlourishes(this.scene, pw / 2, cy, txt.width));
    panel.add(txt);
    return txt;
  }

  private attachKeys(handler: (e: KeyboardEvent) => void): void {
    this.detachKeys();
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    this.keyHandler = handler;
    kb.on('keydown', handler);
  }

  private detachKeys(): void {
    if (this.keyHandler) this.scene.input.keyboard?.off('keydown', this.keyHandler);
    this.keyHandler = null;
  }

  // ── Tooltip ─────────────────────────────────────────────────────────────

  /** Wire hover (desktop) / tap (touch) tooltip on `target`. */
  private wireTip(target: Phaser.GameObjects.GameObject & { input?: Phaser.Types.Input.InteractiveObject | null }, build: () => { title: string; titleColor: string; lines: string[]; accent: number }): void {
    const show = (): void => {
      const b = build();
      const obj = target as unknown as Phaser.GameObjects.Components.GetBounds;
      const r = obj.getBounds();
      this.showTip(target, b.title, b.titleColor, b.lines, b.accent, r);
    };
    if (this.mobile) {
      target.on('pointerdown', () => {
        if (this.tip?.owner === target) { this.hideTip(); return; }
        show();
      });
    } else {
      target.on('pointerover', show);
      target.on('pointerout', () => { if (this.tip?.owner === target) this.hideTip(); });
    }
  }

  private showTip(owner: Phaser.GameObjects.GameObject, title: string, titleColor: string, lines: string[], accent: number, anchor: Phaser.Geom.Rectangle): void {
    this.hideTip();
    const k = this.mobile ? 1.5 : 1;
    const maxW = Math.round(240 * k);
    const pad = Math.round(10 * k);
    const c = this.scene.add.container(0, 0).setDepth(DEPTH.tip);
    const tt = this.text(pad, pad, title, Math.round(13 * k), titleColor, { fontStyle: 'bold', wordWrap: { width: maxW - pad * 2, useAdvancedWrap: true } });
    let y = pad + tt.height + Math.round(4 * k);
    const body: Phaser.GameObjects.Text[] = [];
    for (const l of lines) {
      const bt = this.text(pad, y, l, Math.round(12 * k), UI_COLORS.text, { wordWrap: { width: maxW - pad * 2, useAdvancedWrap: true } });
      body.push(bt);
      y += bt.height + Math.round(2 * k);
    }
    const tw = Math.min(maxW, Math.max(tt.width, ...body.map((b) => b.width)) + pad * 2);
    const th = Math.round(y + pad - 2 * k);
    c.add(addFrame(this.scene, 0, 0, tw, th, { variant: 'tooltip', accent }));
    c.add([tt, ...body]);
    // Place left of / below the anchor, clamped on screen.
    let x = anchor.x - tw - 8;
    if (x < 4) x = anchor.right + 8;
    if (x + tw > W - 4) x = W - 4 - tw;
    let ty = anchor.y;
    if (ty + th > H - 4) ty = H - 4 - th;
    c.setPosition(Math.max(4, Math.round(x)), Math.max(4, Math.round(ty)));
    this.tip = { container: c, owner };
    if (this.mobile) {
      this.tipTimer = this.scene.time.delayedCall(4000, () => this.hideTip());
    }
  }

  private hideTip(): void {
    this.tipTimer?.remove(false);
    this.tipTimer = null;
    this.tip?.container.destroy();
    this.tip = null;
  }

  // ── 1. Tier picker ──────────────────────────────────────────────────────

  private openTierPicker(data: DungeonTierPickPayload): void {
    if (this.boonPanel) return;
    this.tierPanel?.destroy();
    this.summaryPanel?.destroy(); this.summaryPanel = null;
    this.tierPick = data;
    const maxTier = Math.max(1, data.unlockedTier);
    // Default to the highest tier the hero is levelled for (at least 1).
    let pick = 1;
    for (let tr = maxTier; tr >= 1; tr--) if (recommendedLevel(tr) <= data.heroLevel) { pick = tr; break; }
    this.tier = pick;
    this.ensureBackdrop();
    this.buildTierPanel();
    this.attachKeys((e) => {
      if (e.key === 'Enter') this.closeTierPicker(this.tier);
      else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') this.stepTier(-1);
      else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') this.stepTier(1);
    });
  }

  private buildTierPanel(): void {
    const data = this.tierPick!;
    const pw = 460, ph = this.mobile ? 408 : 410, cx = pw / 2;
    const panel = this.scene.add.container(0, 0).setDepth(DEPTH.panel);
    const bg = addFrame(this.scene, 0, 0, pw, ph, { variant: 'panel', header: 44, gem: 0x8a3ad0, accent: 0xa45cff });
    bg.setInteractive(); // swallow clicks on the body
    panel.add(bg);
    this.panelTitle(panel, pw, 23, t('ui.abyss.title'), UI_COLORS.parchment, 21);
    panel.add(this.text(cx, 66, t('ui.abyss.flavor'), 12, UI_COLORS.textSoft, {
      fontStyle: 'italic', align: 'center', wordWrap: { width: pw - 70, useAdvancedWrap: true },
    }).setOrigin(0.5, 0));

    panel.add(this.text(cx, 112, t('ui.abyss.tierLabel'), 12, UI_COLORS.heading, { fontStyle: 'bold' }).setOrigin(0.5));
    const sigilY = 170;
    const sigil = this.scene.add.image(cx, sigilY, sigilTexture(this.scene, 50));
    panel.add(sigil);
    this.scene.tweens.add({ targets: sigil, angle: 360, duration: 24000, repeat: -1 });
    const num = this.scene.add.text(cx, sigilY + 1, '', {
      fontSize: '44px', fontFamily: UI_TITLE_FONT, color: UI_COLORS.goldBright, fontStyle: 'bold',
      stroke: '#1a0a24', strokeThickness: 6, shadow: { offsetX: 0, offsetY: 2, color: '#000', blur: 6, fill: true },
    }).setOrigin(0.5);
    panel.add(num);
    const bs = this.mobile ? 60 : 50;
    const minus = addButton(this.scene, cx - 118, sigilY, bs, bs, '−', { variant: 'secondary', fontSize: 28, bold: true, onClick: () => this.stepTier(-1) });
    const plus = addButton(this.scene, cx + 118, sigilY, bs, bs, '+', { variant: 'secondary', fontSize: 28, bold: true, onClick: () => this.stepTier(1) });
    panel.add([minus, plus]);

    const rec = this.text(cx, 236, '', 14, UI_COLORS.text, { fontStyle: 'bold' }).setOrigin(0.5);
    const lvl = this.text(cx, 258, '', 12, UI_COLORS.good).setOrigin(0.5);
    panel.add([rec, lvl]);
    panel.add(addDivider(this.scene, cx, 282, pw - 80));
    const best = data.bestTier > 0 ? t('ui.abyss.best', { tier: data.bestTier }) : t('ui.abyss.bestNone');
    panel.add(this.text(cx, 300, best, 13, UI_COLORS.heading).setOrigin(0.5));
    panel.add(this.text(cx, 322, t('ui.abyss.scaling'), 12, UI_COLORS.muted).setOrigin(0.5));

    const btnY = this.mobile ? 370 : 362;
    const bw = this.mobile ? 170 : 150, bh = this.mobile ? 50 : 38;
    panel.add(addButton(this.scene, cx - bw / 2 - 12, btnY, bw, bh, t('ui.abyss.cancel'), { variant: 'secondary', fontSize: 15, onClick: () => this.closeTierPicker(0) }));
    panel.add(addButton(this.scene, cx + bw / 2 + 12, btnY, bw, bh, t('ui.abyss.enter'), { variant: 'primary', fontSize: 15, bold: true, onClick: () => this.closeTierPicker(this.tier) }));
    if (!this.mobile) panel.add(this.text(cx, ph - 16, t('ui.abyss.keysHint'), 11, UI_COLORS.dim, { strokeThickness: 0 }).setOrigin(0.5));

    const refresh = (): void => {
      const tier = this.tier;
      const recLvl = recommendedLevel(tier);
      num.setText(t('ui.abyss.tierShort', { tier }));
      rec.setText(t('ui.abyss.recommended', { level: recLvl }));
      const under = data.heroLevel < recLvl;
      lvl.setText(t(under ? 'ui.abyss.levelWarn' : 'ui.abyss.levelOk', { level: data.heroLevel }));
      lvl.setColor(under ? UI_COLORS.bad : UI_COLORS.good);
      num.setColor(under ? '#ff9a7a' : UI_COLORS.goldBright);
      minus.setEnabled(tier > 1);
      plus.setEnabled(tier < Math.max(1, data.unlockedTier));
    };
    panel.setData('refresh', refresh);
    panel.setData('num', num);
    refresh();
    this.tierPanel = panel;
    this.placePanel(panel, pw, ph);
  }

  private stepTier(d: number): void {
    if (!this.tierPanel || !this.tierPick) return;
    const next = Phaser.Math.Clamp(this.tier + d, 1, Math.max(1, this.tierPick.unlockedTier));
    if (next === this.tier) return;
    this.tier = next;
    (this.tierPanel.getData('refresh') as () => void)();
    const num = this.tierPanel.getData('num') as Phaser.GameObjects.Text;
    this.scene.tweens.killTweensOf(num);
    num.setScale(1.25);
    this.scene.tweens.add({ targets: num, scale: 1, duration: 180, ease: 'Back.easeOut' });
  }

  private closeTierPicker(tier: number): void {
    if (!this.tierPanel) return;
    const p = this.tierPanel;
    this.tierPanel = null;
    this.detachKeys();
    this.hideTip();
    this.fadeOut(p);
    this.dropBackdropIfIdle();
    EventBus.emit(GameEvents.DUNGEON_TIER_CHOSEN, { tier });
  }

  private fadeOut(p: Phaser.GameObjects.Container, duration = 140): void {
    p.each((o: Phaser.GameObjects.GameObject) => (o as unknown as { disableInteractive?: () => void }).disableInteractive?.());
    this.scene.tweens.killTweensOf(p);
    this.scene.tweens.add({ targets: p, alpha: 0, duration, onComplete: () => p.destroy() });
  }

  // ── 2. Boon choice ──────────────────────────────────────────────────────

  private openBoonOffer(data: DungeonBoonOfferPayload): void {
    const options = data.options.map((id) => getBoon(id)).filter((b): b is BoonDef => !!b);
    if (options.length === 0) return;
    this.tierPanel?.destroy(); this.tierPanel = null;
    this.summaryPanel?.destroy(); this.summaryPanel = null;
    this.boonPanel?.destroy();
    this.hideTip();
    this.boonOffer = data;
    this.boonPicked = false;
    this.ensureBackdrop();

    const cw = 224, ch = 312, gap = 22, side = 34;
    const n = options.length;
    const pw = Math.max(520, n * cw + (n - 1) * gap + side * 2);
    const top = 96;
    const ph = top + ch + (this.mobile ? 22 : 50);
    const panel = this.scene.add.container(0, 0).setDepth(DEPTH.panel);
    const bg = addFrame(this.scene, 0, 0, pw, ph, { variant: 'panel', header: 50, gem: 0x8a3ad0, accent: 0xa45cff });
    bg.setInteractive();
    panel.add(bg);
    this.panelTitle(panel, pw, 26, t('ui.abyss.boonTitle'), UI_COLORS.parchment, 21);
    panel.add(this.text(pw / 2, 70, t('ui.abyss.boonSubtitle', { floor: data.floor }), 13, UI_COLORS.textSoft, { fontStyle: 'italic' }).setOrigin(0.5));

    this.boonCards = [];
    const x0 = pw / 2 - (n * cw + (n - 1) * gap) / 2 + cw / 2;
    options.forEach((b, i) => {
      const card = this.buildBoonCard(b, i, cw, ch, data.held[b.id] ?? 0);
      card.setPosition(x0 + i * (cw + gap), top + ch / 2);
      panel.add(card);
      this.boonCards.push(card);
      // Deal the cards in.
      card.setAlpha(0).setY(card.y + 24);
      this.scene.tweens.add({ targets: card, alpha: 1, y: top + ch / 2, delay: 80 + i * 70, duration: 220, ease: 'Cubic.easeOut' });
    });
    if (!this.mobile) {
      panel.add(this.text(pw / 2, ph - 22, t('ui.abyss.pickHint'), 12, UI_COLORS.dim, { strokeThickness: 0 }).setOrigin(0.5));
    }
    this.boonPanel = panel;
    this.placePanel(panel, pw, ph);
    this.attachKeys((e) => {
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx >= 0 && idx < options.length) this.pickBoon(idx);
    });
  }

  private buildBoonCard(b: BoonDef, index: number, cw: number, ch: number, held: number): Phaser.GameObjects.Container {
    const sc = this.scene;
    const st = RARITY[b.rarity];
    const card = sc.add.container(0, 0);
    const nKey = cardTexture(sc, cw, ch, b.rarity, false);
    const hKey = cardTexture(sc, cw, ch, b.rarity, true);
    const bg = sc.add.image(0, 0, nKey);
    card.add(bg);
    const top = -ch / 2;
    card.add(this.text(0, top + 18, t(`ui.abyss.rarity.${b.rarity}`), 12, st.label, { fontStyle: 'bold' }).setOrigin(0.5));
    const glyph = sc.add.image(0, top + CARD_MEDAL_Y, ensureBoonGlyph(sc, b.glyph, 96)).setDisplaySize(80, 80);
    card.add(glyph);
    card.setData('glyph', glyph);
    card.add(this.text(0, top + 160, boonName(b.id), 20, st.name, { fontStyle: 'bold', strokeThickness: 3 }).setOrigin(0.5));
    card.add(addDivider(sc, 0, top + 184, cw - 50, false));
    let y = top + 198;
    for (const lineStr of boonDescLines(b.id)) {
      const tx = this.text(0, y, lineStr, 14, UI_COLORS.text, { align: 'center', wordWrap: { width: cw - 30, useAdvancedWrap: true } }).setOrigin(0.5, 0);
      card.add(tx);
      y += tx.height + 4;
    }
    if (held > 0) {
      card.add(this.text(0, ch / 2 - 22, t('ui.abyss.held', { n: held }), 13, UI_COLORS.goldBright, { fontStyle: 'bold' }).setOrigin(0.5));
    }
    if (!this.mobile) {
      const bx = -cw / 2 + 20, by = top + 18;
      card.add(sc.add.image(bx, by, badgeTexture(sc, 11, st.main)));
      card.add(this.text(bx, by, String(index + 1), 13, UI_COLORS.parchment, { fontStyle: 'bold' }).setOrigin(0.5));
    }
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      if (this.boonPicked) return;
      bg.setTexture(hKey);
      sc.tweens.add({ targets: card, scale: 1.035, duration: 110 });
      sc.tweens.add({ targets: glyph, angle: { from: -4, to: 4 }, yoyo: true, duration: 160 });
    });
    bg.on('pointerout', () => {
      if (this.boonPicked) return;
      bg.setTexture(nKey);
      sc.tweens.add({ targets: card, scale: 1, duration: 110 });
    });
    bg.on('pointerdown', () => this.pickBoon(index));
    card.setData('bg', bg);
    card.setData('hKey', hKey);
    card.setData('boon', b);
    return card;
  }

  private pickBoon(index: number): void {
    if (!this.boonPanel || this.boonPicked) return;
    const card = this.boonCards[index];
    const b = card?.getData('boon') as BoonDef | undefined;
    if (!card || !b) return;
    this.boonPicked = true;
    this.detachKeys();
    const sc = this.scene;
    const panel = this.boonPanel;
    const st = RARITY[b.rarity];
    EventBus.emit(GameEvents.DUNGEON_BOON_CHOSEN, { boonId: b.id });

    (card.getData('bg') as Phaser.GameObjects.Image).setTexture(card.getData('hKey') as string);
    panel.each((o: Phaser.GameObjects.GameObject) => (o as unknown as { disableInteractive?: () => void }).disableInteractive?.());
    for (const c of this.boonCards) {
      (c.getData('bg') as Phaser.GameObjects.Image).disableInteractive();
      if (c !== card) sc.tweens.add({ targets: c, alpha: 0, y: c.y + 30, scale: 0.94, duration: 220, ease: 'Cubic.easeIn' });
    }
    card.parentContainer?.bringToTop(card);
    sc.tweens.add({ targets: card, scale: 1.1, duration: 160, ease: 'Back.easeOut' });

    // Screen-space position of the chosen glyph
    const s = (panel.getData('fitScale') as number) ?? 1;
    const glyph = card.getData('glyph') as Phaser.GameObjects.Image;
    const gx = panel.x + (card.x + glyph.x) * s;
    const gy = panel.y + (card.y + glyph.y) * s;

    // Flash + radiating sparks in the rarity colour
    const flash = sc.add.circle(gx, gy, 60 * s, 0xffffff, 0.85).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
    const ring = sc.add.circle(gx, gy, 50 * s).setStrokeStyle(4 * s, st.glow, 1).setDepth(DEPTH.fx);
    sc.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const d = (90 + Math.random() * 70) * s;
      const spark = sc.add.star(gx, gy, 4, 2 * s, 7 * s, i % 2 ? st.glow : 0xffe7a0).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
      sc.tweens.add({
        targets: spark, x: gx + Math.cos(a) * d, y: gy + Math.sin(a) * d, angle: 180, alpha: 0, scale: 0.4,
        duration: 480 + Math.random() * 200, ease: 'Cubic.easeOut', onComplete: () => spark.destroy(),
      });
    }

    // The glyph flies to the run widget (where the boon now lives).
    const target = this.hudBoonSlots.get(b.id) ?? this.hudBoonTarget();
    const flyer = sc.add.image(gx, gy, glyph.texture.key).setDisplaySize(80 * s, 80 * s).setDepth(DEPTH.fx + 1);
    const endSize = this.mobile ? 34 : 22;
    sc.time.delayedCall(260, () => {
      glyph.setVisible(false);
      sc.tweens.add({
        targets: flyer, x: target.x, y: target.y, displayWidth: endSize, displayHeight: endSize,
        duration: 520, ease: 'Cubic.easeIn',
        onComplete: () => {
          flyer.destroy();
          const pop = sc.add.circle(target.x, target.y, endSize * 0.6, st.glow, 0.8).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
          sc.tweens.add({ targets: pop, scale: 2, alpha: 0, duration: 260, onComplete: () => pop.destroy() });
        },
      });
      sc.tweens.add({ targets: panel, alpha: 0, duration: 260, delay: 60, onComplete: () => panel.destroy() });
      if (this.boonPanel === panel) this.boonPanel = null;
      this.boonCards = [];
      this.boonOffer = null;
      this.dropBackdropIfIdle();
    });
  }

  private hudBoonTarget(): { x: number; y: number } {
    const a = this.opts.hudAnchor;
    return { x: a.x + a.w / 2, y: a.y + (this.hud ? 60 : 30) };
  }

  // ── 3. Run HUD ──────────────────────────────────────────────────────────

  private setHud(data: DungeonHudPayload | null): void {
    if (!data) {
      this.destroyHud();
      this.opts.onHudResize?.(null);
      return;
    }
    const prevSeal = this.hudSealOpen;
    this.hudData = data;
    this.buildHud();
    if (prevSeal === false && data.sealOpen) this.pulseSeal();
    this.hudSealOpen = data.sealOpen;
  }

  private destroyHud(): void {
    this.hudTimerEvent?.remove(false);
    this.hudTimerEvent = null;
    if (this.tip && this.hud && this.hud.exists(this.tip.owner)) this.hideTip();
    this.hud?.destroy(); this.hud = null;
    this.hudFrame?.destroy(); this.hudFrame = null;
    this.hudTimer = null;
    this.hudData = null;
    this.hudSealOpen = null;
    this.hudBoonSlots.clear();
  }

  private buildHud(): void {
    const d = this.hudData!;
    const sc = this.scene;
    const { x, y, w } = this.opts.hudAnchor;
    const m = this.mobile;
    if (this.tip && this.hud && this.hud.exists(this.tip.owner)) this.hideTip();
    this.hud?.destroy();
    this.hudBoonSlots.clear();
    const c = sc.add.container(x, y).setDepth(DEPTH.hud);
    const pad = m ? 12 : 9;
    const innerW = w - pad * 2;
    let cy = pad - 1;

    const title = sc.add.text(w / 2, cy, t('ui.abyss.hudTitle', { tier: d.tier, floor: d.floor, total: d.totalFloors }), {
      fontSize: this.hfs(13), fontFamily: UI_TITLE_FONT, color: UI_COLORS.parchment, fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0);
    if (title.width > innerW) title.setScale(innerW / title.width, 1);
    c.add(title);
    cy += title.height + (m ? 2 : 1);
    const theme = this.text(w / 2, cy, themeName(d.theme), m ? 18 : 11, '#b8a6d8', { fontStyle: 'italic' }).setOrigin(0.5, 0);
    c.add(theme);
    cy += theme.height + (m ? 6 : 4);

    // Curse (tap / hover for its effect)
    const curseStr = d.curse ? t('ui.abyss.curseLabel', { name: curseName(d.curse) }) : t('ui.abyss.noCurse');
    const curse = this.text(pad, cy, curseStr, m ? 19 : 12, d.curse ? UI_COLORS.bad : UI_COLORS.muted, { fontStyle: d.curse ? 'bold' : 'normal' });
    c.add(curse);
    if (d.curse) {
      const id = d.curse;
      curse.setInteractive({ useHandCursor: true });
      // Small "i" badge: the curse has details on hover / tap.
      const ir = m ? 10 : 7;
      const ix = pad + curse.width + ir + 5, iy = cy + curse.height / 2;
      c.add(sc.add.image(ix, iy, badgeTexture(sc, ir, '#c0503c')));
      c.add(this.text(ix, iy, 'i', m ? 15 : 10, '#ffb8a6', { fontStyle: 'bold', strokeThickness: 0 }).setOrigin(0.5));
      this.wireTip(curse, () => ({ title: curseName(id), titleColor: UI_COLORS.bad, lines: curseDesc(id).split(' · '), accent: 0xc0503c }));
    }
    cy += curse.height + (m ? 6 : 4);

    // Timer + kills
    const iconS = m ? 26 : 16;
    const rowY = cy + iconS / 2;
    c.add(sc.add.image(pad + iconS / 2, rowY, ensureBoonGlyph(sc, 'hourglass', 48)).setDisplaySize(iconS, iconS));
    this.hudTimer = this.text(pad + iconS + 4, rowY, formatRunTime(Date.now() - d.startedAt), m ? 19 : 12, UI_COLORS.text, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    c.add(this.hudTimer);
    const kills = this.text(w - pad, rowY, t('ui.abyss.kills', { n: d.kills }), m ? 19 : 12, UI_COLORS.text, { fontStyle: 'bold' }).setOrigin(1, 0.5);
    c.add(kills);
    c.add(sc.add.image(w - pad - kills.width - 4 - iconS / 2, rowY, ensureBoonGlyph(sc, 'skull', 48)).setDisplaySize(iconS, iconS));
    cy += iconS + (m ? 8 : 6);

    // Boons row
    const ids = Object.keys(d.boons).filter((id) => d.boons[id] > 0 && getBoon(id));
    const bs = m ? 40 : 26, bgap = m ? 6 : 4;
    const perRow = Math.max(1, Math.floor((innerW + bgap) / (bs + bgap)));
    if (ids.length === 0) {
      const none = this.text(w / 2, cy, t('ui.abyss.noBoons'), m ? 17 : 11, UI_COLORS.muted).setOrigin(0.5, 0);
      c.add(none);
      cy += none.height + (m ? 6 : 4);
    } else {
      ids.forEach((id, i) => {
        const b = getBoon(id)!;
        const col = i % perRow, row = Math.floor(i / perRow);
        const bx = pad + bs / 2 + col * (bs + bgap);
        const by = cy + bs / 2 + row * (bs + bgap);
        const well = sc.add.image(bx, by, badgeTexture(sc, bs / 2 - 1, RARITY[b.rarity].main));
        well.setInteractive({ useHandCursor: true });
        c.add(well);
        c.add(sc.add.image(bx, by, ensureBoonGlyph(sc, b.glyph, 64)).setDisplaySize(bs - 6, bs - 6));
        const n = d.boons[id];
        if (n > 1) {
          c.add(this.text(bx + bs / 2 + 1, by + bs / 2 + 2, `${n}`, m ? 17 : 11, '#ffe7a0', { fontStyle: 'bold', strokeThickness: 3 }).setOrigin(1, 1));
        }
        this.hudBoonSlots.set(id, { x: x + bx, y: y + by });
        this.wireTip(well, () => ({
          title: `${boonName(id)}${n > 1 ? ` ×${n}` : ''}`,
          titleColor: RARITY[b.rarity].name,
          lines: boonDescLines(id, n),
          accent: hexNum(RARITY[b.rarity].main),
        }));
      });
      cy += Math.ceil(ids.length / perRow) * (bs + bgap) - bgap + (m ? 8 : 6);
    }

    // Seal state
    const sealStr = d.sealOpen ? t('ui.abyss.sealOpen') : t('ui.abyss.sealClosed', { keeper: d.sealKeeper ?? '?' });
    const seal = this.text(w / 2, cy, sealStr, m ? 19 : 12, d.sealOpen ? UI_COLORS.good : UI_COLORS.bad, {
      fontStyle: 'bold', align: 'center', wordWrap: { width: innerW, useAdvancedWrap: true },
    }).setOrigin(0.5, 0);
    c.add(seal);
    c.setData('seal', seal);
    cy += seal.height + pad - 2;

    const h = Math.ceil(cy / 4) * 4;
    const fk = frameTexture(sc, w, h, { variant: 'plate', alpha: 0.92, accent: 0xa45cff });
    if (!this.hudFrame) this.hudFrame = sc.add.image(0, 0, fk.key).setOrigin(0, 0).setDepth(DEPTH.hud - 1);
    this.hudFrame.setTexture(fk.key).setPosition(x - fk.margin, y - fk.margin);
    this.hud = c;

    if (!this.hudTimerEvent) {
      this.hudTimerEvent = sc.time.addEvent({
        delay: 250, loop: true,
        callback: () => { if (this.hudTimer && this.hudData) this.hudTimer.setText(formatRunTime(Date.now() - this.hudData.startedAt)); },
      });
    }
    this.opts.onHudResize?.(y + h);
  }

  private pulseSeal(): void {
    const seal = this.hud?.getData('seal') as Phaser.GameObjects.Text | undefined;
    if (!seal || !this.hud) return;
    const sc = this.scene;
    const gx = this.hud.x + seal.x, gy = this.hud.y + seal.y + seal.height / 2;
    const glow = sc.add.ellipse(gx, gy, seal.width + 40, seal.height + 16, 0x7ed36a, 0.5).setDepth(DEPTH.hud + 1).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: glow, alpha: 0, scaleX: 1.4, scaleY: 1.8, duration: 700, ease: 'Cubic.easeOut', repeat: 1, onComplete: () => glow.destroy() });
    sc.tweens.add({ targets: seal, scale: 1.18, duration: 180, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
  }

  // ── 4. Run summary ──────────────────────────────────────────────────────

  private openSummary(data: DungeonRunEndPayload): void {
    this.tierPanel?.destroy(); this.tierPanel = null;
    this.summaryPanel?.destroy();
    this.hideTip();
    const sc = this.scene;
    const m = this.mobile;
    // "Unlocked" only when the ladder actually moved this run.
    const prevUnlocked = this.tierPick?.unlockedTier ?? (data.result === 'cleared' ? data.tier : data.unlockedTier);
    const unlockedUp = data.unlockedTier > prevUnlocked;
    if (this.tierPick) this.tierPick = { ...this.tierPick, unlockedTier: data.unlockedTier };

    const pw = 500;
    const panel = sc.add.container(0, 0).setDepth(DEPTH.panel);
    const titleColor = data.result === 'cleared' ? UI_COLORS.goldBright : data.result === 'fallen' ? '#ff7a66' : UI_COLORS.parchment;
    const accent = data.result === 'cleared' ? 0xd4a54a : data.result === 'fallen' ? 0xc0503c : 0x8a7a64;
    const gem = data.result === 'cleared' ? 0xffc040 : data.result === 'fallen' ? 0xb3202a : 0x8a3ad0;

    const items: Phaser.GameObjects.GameObject[] = [];
    let y = 64;
    const titleTx = sc.add.text(pw / 2, 32, t(`ui.abyss.result.${data.result}`), {
      fontSize: '26px', fontFamily: UI_TITLE_FONT, color: titleColor, fontStyle: 'bold',
      stroke: '#120b04', strokeThickness: 5, shadow: { offsetX: 0, offsetY: 2, color: '#000', blur: 6, fill: true },
    }).setOrigin(0.5);

    if (data.newBest) {
      const bw = 170, bh = 30;
      const banner = sc.add.image(pw / 2, y + 22, bannerTexture(sc, bw, bh));
      const bt = this.text(pw / 2, y + 22, t('ui.abyss.newBest'), 16, '#fff2c8', { fontStyle: 'bold', strokeThickness: 3 }).setOrigin(0.5);
      items.push(banner, bt);
      banner.setScale(0); bt.setScale(0);
      sc.tweens.add({ targets: [banner, bt], scale: 1, delay: 260, duration: 320, ease: 'Back.easeOut' });
      sc.tweens.add({ targets: [banner, bt], angle: { from: -2, to: 2 }, delay: 600, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      y += 52;
    } else {
      y += 12;
    }

    // Stat tiles: tier, floors, time, kills
    const tiles: [string, string][] = [
      [t('ui.abyss.sumTier'), t('ui.abyss.tierShort', { tier: data.tier })],
      [t('ui.abyss.sumFloors'), t('ui.abyss.floorsValue', { done: data.floorsCleared, total: data.totalFloors })],
      [t('ui.abyss.sumTime'), formatRunTime(data.timeMs)],
      [t('ui.abyss.sumKills'), String(data.kills)],
    ];
    const tw = 102, th = 62, tg = 12;
    const tx0 = pw / 2 - (tiles.length * tw + (tiles.length - 1) * tg) / 2;
    const g = sc.add.graphics();
    items.push(g);
    tiles.forEach(([label, value], i) => {
      const tx = tx0 + i * (tw + tg);
      g.fillStyle(0x000000, 0.45); g.fillRoundedRect(tx, y + 2, tw, th, 6);
      g.fillStyle(0x19161c, 1); g.fillRoundedRect(tx, y, tw, th, 6);
      g.lineStyle(1, 0x4a4252, 1); g.strokeRoundedRect(tx + 0.5, y + 0.5, tw - 1, th - 1, 6);
      items.push(this.text(tx + tw / 2, y + 16, label, 12, UI_COLORS.muted).setOrigin(0.5));
      const v = this.text(tx + tw / 2, y + 41, value, 22, UI_COLORS.parchment, { fontFamily: UI_TITLE_FONT, fontStyle: 'bold', strokeThickness: 3 }).setOrigin(0.5);
      if (v.width > tw - 10) v.setScale((tw - 10) / v.width);
      items.push(v);
    });
    y += th + 22;

    // Boons taken
    items.push(...addSectionHeader(sc, 30, y, pw - 60, t('ui.abyss.sumBoons')));
    y += 16;
    const ids = Object.keys(data.boons).filter((id) => data.boons[id] > 0 && getBoon(id));
    if (ids.length === 0) {
      items.push(this.text(pw / 2, y + 12, t('ui.abyss.noBoons'), 13, UI_COLORS.dim).setOrigin(0.5));
      y += 34;
    } else {
      const bs = 42, bg2 = 8;
      const perRow = Math.floor((pw - 60 + bg2) / (bs + bg2));
      const rows = Math.ceil(ids.length / perRow);
      ids.forEach((id, i) => {
        const b = getBoon(id)!;
        const inRow = Math.min(perRow, ids.length - Math.floor(i / perRow) * perRow);
        const rowX0 = pw / 2 - (inRow * bs + (inRow - 1) * bg2) / 2 + bs / 2;
        const bx = rowX0 + (i % perRow) * (bs + bg2);
        const by = y + bs / 2 + Math.floor(i / perRow) * (bs + bg2);
        const well = sc.add.image(bx, by, badgeTexture(sc, bs / 2 - 1, RARITY[b.rarity].main)).setInteractive({ useHandCursor: true });
        items.push(well, sc.add.image(bx, by, ensureBoonGlyph(sc, b.glyph, 64)).setDisplaySize(bs - 8, bs - 8));
        const n = data.boons[id];
        if (n > 1) items.push(this.text(bx + bs / 2 + 2, by + bs / 2 + 3, `${n}`, 13, '#ffe7a0', { fontStyle: 'bold', strokeThickness: 3 }).setOrigin(1, 1));
        this.wireTip(well, () => ({
          title: `${boonName(id)}${n > 1 ? ` ×${n}` : ''}`, titleColor: RARITY[b.rarity].name,
          lines: boonDescLines(id, n), accent: hexNum(RARITY[b.rarity].main),
        }));
      });
      y += rows * (bs + bg2) - bg2 + 12;
    }

    if (unlockedUp) {
      const ul = this.text(pw / 2, y + 12, t('ui.abyss.unlocked', { tier: data.unlockedTier }), 16, UI_COLORS.good, { fontStyle: 'bold', strokeThickness: 3 }).setOrigin(0.5);
      items.push(ul);
      sc.tweens.add({ targets: ul, alpha: { from: 0.55, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
      y += 30;
    }

    y += 12;
    const bh = m ? 50 : 38;
    const btn: UiButton = addButton(sc, pw / 2, y + bh / 2, m ? 200 : 170, bh, t('ui.abyss.continue'), { variant: 'primary', fontSize: 15, bold: true, onClick: () => this.closeSummary() });
    items.push(btn);
    y += bh + 18;
    const ph = y;

    const bgImg = addFrame(sc, 0, 0, pw, ph, { variant: 'panel', header: 60, gem, accent });
    bgImg.setInteractive();
    panel.add(bgImg);
    panel.add(addTitleFlourishes(sc, pw / 2, 32, titleTx.width));
    panel.add(titleTx);
    panel.add(items);
    this.summaryPanel = panel;
    this.ensureBackdrop();
    this.placePanel(panel, pw, ph);
    if (data.result === 'cleared') this.celebrate(panel);
    this.attachKeys((e) => { if (e.key === 'Enter') this.closeSummary(); });
  }

  /** Gold embers rising around the title of a conquered run. */
  private celebrate(panel: Phaser.GameObjects.Container): void {
    const sc = this.scene;
    for (let i = 0; i < 18; i++) {
      const s = (panel.getData('fitScale') as number) ?? 1;
      const x = panel.x + (60 + Math.random() * 380) * s;
      const y = panel.y + (50 + Math.random() * 20) * s;
      const e = sc.add.star(x, y, 4, 1.5 * s, 5 * s, i % 3 ? 0xffd98a : 0xffffff).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      sc.tweens.add({
        targets: e, y: y - (60 + Math.random() * 60) * s, alpha: { from: 1, to: 0 }, angle: 180,
        delay: 200 + Math.random() * 700, duration: 900 + Math.random() * 500, onComplete: () => e.destroy(),
      });
    }
  }

  private closeSummary(): void {
    if (!this.summaryPanel) return;
    const p = this.summaryPanel;
    this.summaryPanel = null;
    this.detachKeys();
    this.hideTip();
    this.fadeOut(p);
    this.dropBackdropIfIdle();
  }

  // ── Locale ──────────────────────────────────────────────────────────────

  private handleLocaleChanged(): void {
    if (this.hudData) this.buildHud();
    if (this.tierPanel && this.tierPick) {
      this.tierPanel.destroy();
      const tier = this.tier;
      this.buildTierPanel();
      this.tier = tier;
      (this.tierPanel!.getData('refresh') as () => void)();
    }
    if (this.boonPanel && this.boonOffer && !this.boonPicked) this.openBoonOffer(this.boonOffer);
  }
}
