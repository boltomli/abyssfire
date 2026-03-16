# Entity Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace template-based procedural sprites with per-entity custom drawing for all 43 game entities in a realistic dark fantasy style.

**Architecture:** Each entity gets its own drawing module under `src/graphics/sprites/`. A shared `DrawUtils` class provides reusable primitives (gradients, materials, noise). `SpriteGenerator` delegates to these modules instead of using shared `drawHumanoidFrame`/`drawBlobFrame` templates. External PNG spritesheets override procedural generation when present.

**Tech Stack:** TypeScript, Canvas 2D API, Phaser 3 texture system

**Spec:** `docs/superpowers/specs/2026-03-16-entity-visual-overhaul-design.md`

**No test framework:** This project has no test framework set up. Validation is visual — run `npm run dev`, load the game, and verify sprites render correctly. Each task includes a visual verification step.

---

## Chunk 1: Foundation

### Task 1: Create EntityDrawer interface and action types

**Files:**
- Create: `src/graphics/sprites/types.ts`

- [ ] **Step 1: Create the shared types file**

```typescript
// src/graphics/sprites/types.ts
import type { DrawUtils } from '../DrawUtils';

export type MonsterAction = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';
export type PlayerAction = MonsterAction | 'cast';
export type NPCAction = 'working' | 'alert' | 'idle' | 'talking';
export type EntityAction = MonsterAction | PlayerAction | NPCAction;

export interface EntityDrawer {
  readonly key: string;
  readonly frameW: number;       // before TEXTURE_SCALE
  readonly frameH: number;       // before TEXTURE_SCALE
  readonly totalFrames: number;

  drawFrame(
    ctx: CanvasRenderingContext2D,
    frame: number,               // 0-based index within the current action
    action: EntityAction,
    w: number,                   // scaled frame width
    h: number,                   // scaled frame height
    utils: DrawUtils,
  ): void;
}

/** Map of texture key → {frameWidth, frameHeight} for BootScene spritesheet loading */
export type FrameSizeRegistry = Record<string, { frameWidth: number; frameHeight: number }>;
```

- [ ] **Step 2: Verify game still loads**

Run: `npm run dev` — verify game still loads normally. This file has no imports yet, so it won't affect anything until DrawUtils is created in Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/graphics/sprites/types.ts
git commit -m "feat(graphics): add EntityDrawer interface and action types"
```

---

### Task 2: Extract DrawUtils from SpriteGenerator

**Files:**
- Create: `src/graphics/DrawUtils.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

This extracts the existing utility methods from `SpriteGenerator` into a standalone `DrawUtils` class, then adds new material-drawing helpers.

- [ ] **Step 1: Create DrawUtils with extracted methods**

Create `src/graphics/DrawUtils.ts` containing all utility methods currently private on `SpriteGenerator`. These are found at `SpriteGenerator.ts:321-431`:

```typescript
// src/graphics/DrawUtils.ts

/** Shared drawing primitives for entity sprite generation. */
export class DrawUtils {

  // ── Noise ──

  hash2d(x: number, y: number): number {
    let n = (x | 0) * 374761393 + (y | 0) * 668265263;
    n = ((n >> 13) ^ n) * 1274126177;
    return ((n >> 16) ^ n & 0x7fffffff) / 0x7fffffff;
  }

  noise2d(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = this.hash2d(ix, iy), n10 = this.hash2d(ix + 1, iy);
    const n01 = this.hash2d(ix, iy + 1), n11 = this.hash2d(ix + 1, iy + 1);
    return (n00 + (n10 - n00) * sx) + ((n01 + (n11 - n01) * sx) - (n00 + (n10 - n00) * sx)) * sy;
  }

  fbm(x: number, y: number, octaves: number): number {
    let v = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      v += this.noise2d(x * freq, y * freq) * amp;
      amp *= 0.5; freq *= 2;
    }
    return v;
  }

  // ── Color ──

  clamp(v: number): number { return Math.max(0, Math.min(255, v | 0)); }

  rgb(c: number, alpha?: number): string {
    const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
    return alpha !== undefined ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
  }

  hexRgb(c: number): [number, number, number] {
    return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
  }

  darken(c: number, amt: number): number {
    const [r, g, b] = this.hexRgb(c);
    return ((Math.max(0, r - amt) << 16) | (Math.max(0, g - amt) << 8) | Math.max(0, b - amt));
  }

  lighten(c: number, amt: number): number {
    const [r, g, b] = this.hexRgb(c);
    return ((Math.min(255, r + amt) << 16) | (Math.min(255, g + amt) << 8) | Math.min(255, b + amt));
  }

  lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

  // ── Canvas Primitives ──

  createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')!];
  }

  roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  fillEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  fillCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.fill();
  }

  drawPart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: number, radius: number = 0): void {
    const [r, g, b] = this.hexRgb(color);
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, `rgb(${this.clamp(r + 15)},${this.clamp(g + 15)},${this.clamp(b + 15)})`);
    grad.addColorStop(1, `rgb(${this.clamp(r - 20)},${this.clamp(g - 20)},${this.clamp(b - 20)})`);
    ctx.fillStyle = grad;
    if (radius > 0) { this.roundRect(ctx, x, y, w, h, radius); ctx.fill(); }
    else { ctx.fillRect(x, y, w, h); }
  }

  applyNoiseToRegion(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, intensity: number): void {
    const imageData = ctx.getImageData(x, y, w, h);
    const d = imageData.data;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4;
        if (d[i + 3] === 0) continue;
        const n = (this.fbm((x + px) * 0.025, (y + py) * 0.025, 4) - 0.5) * 2;
        const grain = (this.hash2d(px * 131 + py, py * 97 + px) - 0.5) * 0.08;
        const val = (n + grain) * intensity;
        d[i] = this.clamp(d[i] + val);
        d[i + 1] = this.clamp(d[i + 1] + val);
        d[i + 2] = this.clamp(d[i + 2] + val);
      }
    }
    ctx.putImageData(imageData, x, y);
  }

  // ── Gradient Fills ──

  /** Create and fill a linear or radial gradient over a rectangular region */
  gradientFill(ctx: CanvasRenderingContext2D, type: 'linear' | 'radial', colors: { stop: number; color: string }[], x: number, y: number, w: number, h: number): void {
    const grad = type === 'radial'
      ? ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) / 2)
      : ctx.createLinearGradient(x, y, x, y + h);
    for (const { stop, color } of colors) grad.addColorStop(stop, color);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  }

  // ── Material Shaders (new) ──

  /** Draw a gradient-filled shape with top-left highlight for metallic look */
  drawMetalSurface(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, baseColor: number): void {
    const [r, g, b] = this.hexRgb(baseColor);
    const grad = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
    grad.addColorStop(0, `rgb(${this.clamp(r + 40)},${this.clamp(g + 40)},${this.clamp(b + 40)})`);
    grad.addColorStop(0.4, `rgb(${r},${g},${b})`);
    grad.addColorStop(1, `rgb(${this.clamp(r - 30)},${this.clamp(g - 30)},${this.clamp(b - 30)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  }

  /** Draw worn leather texture with subtle stitching hint */
  drawLeatherTexture(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, baseColor: number): void {
    this.drawPart(ctx, x, y, w, h, baseColor, 2);
    // Subtle grain
    ctx.fillStyle = this.rgb(this.darken(baseColor, 20), 0.15);
    for (let i = 0; i < 5; i++) {
      const lx = x + this.hash2d(i * 3, 7) * w;
      const ly = y + this.hash2d(i * 5, 11) * h;
      ctx.fillRect(lx, ly, w * 0.3, 0.5);
    }
  }

  /** Draw cracked stone texture */
  drawStoneTexture(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, baseColor: number): void {
    this.drawPart(ctx, x, y, w, h, baseColor, 1);
    ctx.strokeStyle = this.rgb(this.darken(baseColor, 30), 0.4);
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      const sx = x + this.hash2d(i * 17, 3) * w;
      const sy = y + this.hash2d(i * 23, 7) * h * 0.3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + this.hash2d(i, 13) * w * 0.4, sy + this.hash2d(i, 19) * h * 0.6);
      ctx.stroke();
    }
  }

  /** Draw a layered flame shape */
  drawFlameLayer(ctx: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number, color: string, flicker: number): void {
    const wobble = Math.sin(flicker) * w * 0.1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, baseY - h);
    ctx.quadraticCurveTo(cx + w * 0.5 + wobble, baseY - h * 0.6, cx + w * 0.4, baseY);
    ctx.lineTo(cx - w * 0.4, baseY);
    ctx.quadraticCurveTo(cx - w * 0.5 - wobble, baseY - h * 0.6, cx, baseY - h);
    ctx.fill();
  }

  /** Draw an anatomical bone segment between two points */
  drawBoneSegment(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, color: number): void {
    ctx.strokeStyle = this.rgb(color);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // Joint knobs at each end
    ctx.fillStyle = this.rgb(this.lighten(color, 15));
    this.fillCircle(ctx, x1, y1, width * 0.6);
    this.fillCircle(ctx, x2, y2, width * 0.6);
  }

  /** Draw directional fur strokes over a region */
  drawFurTexture(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, baseColor: number, angle: number = 0): void {
    const count = Math.floor(w * h / 20);
    for (let i = 0; i < count; i++) {
      const fx = x + this.hash2d(i * 7, 31) * w;
      const fy = y + this.hash2d(i * 13, 47) * h;
      const len = 2 + this.hash2d(i, 71) * 3;
      const shade = this.hash2d(i, 91) > 0.5 ? this.lighten(baseColor, 10) : this.darken(baseColor, 10);
      ctx.strokeStyle = this.rgb(shade, 0.3);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(angle) * len, fy + Math.sin(angle) * len);
      ctx.stroke();
    }
  }

  /** Draw a jointed limb through a series of points with tapering width */
  drawLimb(ctx: CanvasRenderingContext2D, joints: { x: number; y: number }[], baseWidth: number, color: number): void {
    if (joints.length < 2) return;
    for (let i = 0; i < joints.length - 1; i++) {
      const taper = 1 - (i / joints.length) * 0.3;
      const w = baseWidth * taper;
      ctx.strokeStyle = this.rgb(color);
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(joints[i].x, joints[i].y);
      ctx.lineTo(joints[i + 1].x, joints[i + 1].y);
      ctx.stroke();
    }
  }
}
```

- [ ] **Step 2: Update SpriteGenerator to use DrawUtils for internal methods**

In `src/graphics/SpriteGenerator.ts`, add `import { DrawUtils } from './DrawUtils';` at the top. Add a `private utils: DrawUtils;` field initialized in the constructor. Then update `generateAll()` and all internal methods that use the extracted functions (hash2d, noise2d, fbm, clamp, rgb, lerp, createCanvas, roundRect, fillEllipse, fillCircle, drawPart, applyNoiseToRegion) to delegate to `this.utils.*` instead of `this.*`.

**Do NOT delete the original private methods yet** — they're still used by the existing drawing code (`drawHumanoidFrame`, `drawBlobFrame`, `drawNPCFrame`, etc.). Instead, make each private method call through to `this.utils`:

```typescript
// In constructor:
this.utils = new DrawUtils();

// Delegate pattern (repeat for each method):
private hash2d(x: number, y: number): number { return this.utils.hash2d(x, y); }
private noise2d(x: number, y: number): number { return this.utils.noise2d(x, y); }
// ... etc for all extracted methods
```

This ensures zero behavior change while establishing DrawUtils as the source of truth.

- [ ] **Step 3: Verify game still works**

Run: `npm run dev` — open game, create a character, enter a zone. Confirm all sprites (players, monsters, NPCs, decorations) render exactly as before. No visual changes expected.

- [ ] **Step 4: Commit**

```bash
git add src/graphics/DrawUtils.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): extract DrawUtils from SpriteGenerator"
```

---

### Task 3: Add shouldSkipGeneration and frame-size registry

**Files:**
- Modify: `src/graphics/SpriteGenerator.ts`
- Modify: `src/graphics/sprites/types.ts`

- [ ] **Step 1: Add shouldSkipGeneration to SpriteGenerator**

Add this method to the `SpriteGenerator` class:

```typescript
private shouldSkipGeneration(key: string): boolean {
  if (!this.scene.textures.exists(key)) return false;
  const tex = this.scene.textures.get(key);
  return tex.source[0]?.source instanceof HTMLImageElement;
}
```

Add the check at the start of `makeCharSheet()` and `makeNPCSheet()`:

```typescript
// In makeCharSheet(), after getting the key:
const key = cfg.textureKey;
if (this.shouldSkipGeneration(key)) return;

// In makeNPCSheet(), after getting the key:
const key = npc.key;
if (this.shouldSkipGeneration(key)) return;
```

Also add the same check in `generateDecorations()` and `generateEffects()` — before each texture is created, check `if (this.shouldSkipGeneration(decorKey)) continue;`.

- [ ] **Step 2: Create a frame-size registry builder**

Add to `src/graphics/sprites/types.ts`. Note: The spec says the registry should be "exported from the drawing modules." We place it here as a hardcoded function for now (before drawing modules exist). Once all drawers are created, each drawer's `key`/`frameW`/`frameH` serve as the source of truth — this registry mirrors those values. No migration needed since the values are stable.

```typescript
/** Build frame-size registry from the existing configs. Used by BootScene for spritesheet loading. */
export function buildFrameSizeRegistry(): FrameSizeRegistry {
  // These match the current SpriteGenerator configs.
  // As entity drawers are added, they'll register themselves here.
  return {
    // Players (64x96, 24 frames)
    player_warrior: { frameWidth: 64, frameHeight: 96 },
    player_mage: { frameWidth: 64, frameHeight: 96 },
    player_rogue: { frameWidth: 64, frameHeight: 96 },
    // Monsters (various sizes, 20 frames)
    monster_slime: { frameWidth: 48, frameHeight: 40 },
    monster_goblin: { frameWidth: 48, frameHeight: 56 },
    monster_goblin_chief: { frameWidth: 60, frameHeight: 68 },
    monster_skeleton: { frameWidth: 44, frameHeight: 64 }, // upgraded from 60 — taller for detailed bone anatomy
    monster_zombie: { frameWidth: 44, frameHeight: 60 },
    monster_werewolf: { frameWidth: 52, frameHeight: 64 },
    monster_werewolf_alpha: { frameWidth: 56, frameHeight: 68 },
    monster_gargoyle: { frameWidth: 52, frameHeight: 60 },
    monster_stone_golem: { frameWidth: 60, frameHeight: 68 },
    monster_mountain_troll: { frameWidth: 64, frameHeight: 72 },
    monster_fire_elemental: { frameWidth: 48, frameHeight: 60 },
    monster_desert_scorpion: { frameWidth: 52, frameHeight: 44 },
    monster_sandworm: { frameWidth: 56, frameHeight: 48 },
    monster_phoenix: { frameWidth: 56, frameHeight: 56 },
    monster_imp: { frameWidth: 40, frameHeight: 48 },
    monster_lesser_demon: { frameWidth: 52, frameHeight: 64 },
    monster_succubus: { frameWidth: 48, frameHeight: 64 },
    monster_demon_lord: { frameWidth: 72, frameHeight: 84 },
    // NPCs (80x120, 24 frames)
    npc_blacksmith: { frameWidth: 80, frameHeight: 120 },
    npc_blacksmith_advanced: { frameWidth: 80, frameHeight: 120 },
    npc_merchant: { frameWidth: 80, frameHeight: 120 },
    npc_merchant_desert: { frameWidth: 80, frameHeight: 120 },
    npc_stash: { frameWidth: 80, frameHeight: 120 },
    npc_quest_elder: { frameWidth: 80, frameHeight: 120 },
    npc_quest_scout: { frameWidth: 80, frameHeight: 120 },
    npc_forest_hermit: { frameWidth: 80, frameHeight: 120 },
    npc_quest_dwarf: { frameWidth: 80, frameHeight: 120 },
    npc_quest_nomad: { frameWidth: 80, frameHeight: 120 },
    npc_quest_warden: { frameWidth: 80, frameHeight: 120 },
  };
}
```

- [ ] **Step 3: Verify game still works**

Run: `npm run dev` — confirm sprites render as before. The `shouldSkipGeneration` check should have no effect since no external spritesheets exist yet.

- [ ] **Step 4: Commit**

```bash
git add src/graphics/SpriteGenerator.ts src/graphics/sprites/types.ts
git commit -m "feat(graphics): add shouldSkipGeneration and frame-size registry"
```

---

### Task 4: Update BootScene for spritesheet loading

**Files:**
- Modify: `src/scenes/BootScene.ts`

- [ ] **Step 1: Replace image loading with spritesheet loading**

In `BootScene.ts`, import the registry and replace the entity loading code (lines 28-61):

```typescript
import { buildFrameSizeRegistry } from '../graphics/sprites/types';
import { TEXTURE_SCALE } from '../config';
```

Replace the player, monster, NPC, decoration, and effect loading sections with:

```typescript
// ── External assets (optional spritesheet overrides) ─────────────────
const registry = buildFrameSizeRegistry();
const s = TEXTURE_SCALE;

// Load entity spritesheets (frame dimensions scaled by TEXTURE_SCALE)
for (const [key, { frameWidth, frameHeight }] of Object.entries(registry)) {
  const path = this.getAssetPath(key);
  this.load.spritesheet(key, path, {
    frameWidth: frameWidth * s,
    frameHeight: frameHeight * s,
  });
}

// Decorations (single-frame images — no spritesheet needed)
const decors = ['tree', 'bush', 'rock', 'flower', 'mushroom', 'cactus', 'boulder', 'crystal', 'bones'];
for (const d of decors) {
  this.load.image(`decor_${d}`, `assets/sprites/decorations/decor_${d}.png`);
}

// Effects (single-frame images)
this.load.image('loot_bag', 'assets/sprites/effects/loot_bag.png');
this.load.image('exit_portal', 'assets/sprites/effects/exit_portal.png');

// Tiles (keep as-is)
const tiles = ['grass', 'dirt', 'stone', 'water', 'wall', 'camp'];
for (const t of tiles) {
  this.load.image(`tile_${t}`, `assets/tiles/tile_${t}.png`);
}
```

Add the helper method to `BootScene`:

```typescript
private getAssetPath(key: string): string {
  if (key.startsWith('player_')) return `assets/sprites/players/${key}.png`;
  if (key.startsWith('monster_')) return `assets/sprites/monsters/${key}.png`;
  if (key.startsWith('npc_')) return `assets/sprites/npcs/${key}.png`;
  return `assets/sprites/${key}.png`;
}
```

- [ ] **Step 2: Verify game still loads**

Run: `npm run dev` — the console will show "Failed to process file" errors for the new NPC keys (npc_blacksmith_advanced, npc_quest_elder, etc.) since those PNG files don't exist. This is expected. The game should still load normally with procedural fallbacks.

Confirm the existing tile PNGs still load (tile_grass, etc.) and the existing decor_tree.png still loads.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/BootScene.ts
git commit -m "feat(boot): update asset loading to use spritesheets with frame-size registry"
```

---

## Chunk 2: Reference Implementations

These tasks establish the pattern that all remaining entity modules follow. Full drawing code is provided.

### Task 5: Slime — reference monster implementation (Ooze archetype)

**Files:**
- Create: `src/graphics/sprites/monsters/Slime.ts`
- Modify: `src/graphics/SpriteGenerator.ts` (wire up the new module)

This is the **reference implementation** for all monster drawing modules. It demonstrates the full pattern: implementing `EntityDrawer`, per-action frame drawing with animation offsets, and using `DrawUtils`.

- [ ] **Step 1: Create the Slime drawer**

```typescript
// src/graphics/sprites/monsters/Slime.ts
import type { EntityDrawer, MonsterAction } from '../types';
import type { DrawUtils } from '../../DrawUtils';

export const SlimeDrawer: EntityDrawer = {
  key: 'monster_slime',
  frameW: 48,
  frameH: 40,
  totalFrames: 20,

  drawFrame(ctx, frame, action, w, h, utils) {
    const act = action as MonsterAction;
    const s = w / 48; // scale factor

    // Animation phase
    const frameCounts: Record<MonsterAction, number> = { idle: 4, walk: 6, attack: 4, hurt: 2, death: 4 };
    const count = frameCounts[act] || 4;
    const localFrame = frame % count;
    const t = count > 1 ? localFrame / (count - 1) : 0;
    const phase = (localFrame / count) * Math.PI * 2;

    // Animation parameters per action
    let squishX = 1, squishY = 1, offsetY = 0, alpha = 1;
    switch (act) {
      case 'idle':
        squishY = 1 + Math.sin(phase) * 0.08;
        squishX = 1 - Math.sin(phase) * 0.05;
        break;
      case 'walk':
        squishY = 1 + Math.sin(phase) * 0.12;
        squishX = 1 - Math.sin(phase) * 0.08;
        offsetY = -Math.abs(Math.sin(phase)) * 3 * s;
        break;
      case 'attack':
        squishX = 1 + t * 0.3;
        squishY = 1 - t * 0.15;
        offsetY = -t * 4 * s;
        break;
      case 'hurt':
        squishX = 1 - t * 0.15;
        squishY = 1 + t * 0.1;
        alpha = 0.7 + t * 0.3;
        break;
      case 'death':
        squishY = 1 - t * 0.7;
        squishX = 1 + t * 0.5;
        alpha = 1 - t * 0.8;
        break;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    const cx = w / 2, baseY = h * 0.88;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    utils.fillEllipse(ctx, cx, baseY + 2 * s, 17 * s * squishX, 3 * s);

    // Puddle drip
    ctx.fillStyle = 'rgba(10,74,24,0.25)';
    utils.fillEllipse(ctx, cx, baseY, 18 * s * squishX, 4 * s);

    // Main body
    const bodyRx = 16 * s * squishX;
    const bodyRy = 14 * s * squishY;
    const bodyCy = baseY - bodyRy * 0.6 + offsetY;

    const grad = ctx.createRadialGradient(
      cx - bodyRx * 0.15, bodyCy - bodyRy * 0.2, 0,
      cx, bodyCy, bodyRx
    );
    grad.addColorStop(0, '#3aaa55');
    grad.addColorStop(0.5, '#1a7a30');
    grad.addColorStop(1, '#0a4a18');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, bodyCy, bodyRx, bodyRy, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subsurface glow
    const glowGrad = ctx.createRadialGradient(cx - 2 * s, bodyCy - 2 * s, 0, cx, bodyCy, bodyRx * 0.7);
    glowGrad.addColorStop(0, 'rgba(90,238,112,0.25)');
    glowGrad.addColorStop(1, 'rgba(26,122,48,0)');
    ctx.fillStyle = glowGrad;
    utils.fillEllipse(ctx, cx - 2 * s, bodyCy - 2 * s, bodyRx * 0.65, bodyRy * 0.6);

    // Internal particles
    ctx.fillStyle = 'rgba(10,90,26,0.4)';
    utils.fillCircle(ctx, cx - 6 * s, bodyCy + 2 * s, 2 * s);
    utils.fillCircle(ctx, cx + 4 * s, bodyCy + 4 * s, 1.5 * s);

    // Specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.save();
    ctx.translate(cx - 6 * s, bodyCy - bodyRy * 0.4);
    ctx.rotate(-0.25);
    utils.fillEllipse(ctx, 0, 0, 5 * s, 3 * s);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    utils.fillEllipse(ctx, cx - 7 * s, bodyCy - bodyRy * 0.5, 2.5 * s, 1.5 * s);

    // Eyes
    const eyeSpread = 6 * s * squishX;
    for (const side of [-1, 1]) {
      const ex = cx + side * eyeSpread;
      const ey = bodyCy - bodyRy * 0.15;
      // Eye socket
      ctx.fillStyle = '#0a3a0a';
      utils.fillEllipse(ctx, ex, ey, 3 * s, 3.5 * s);
      // Iris
      ctx.fillStyle = '#2aaa40';
      utils.fillEllipse(ctx, ex, ey - 0.5 * s, 2 * s, 2.5 * s);
      // Pupil
      ctx.fillStyle = '#0a2a0a';
      utils.fillEllipse(ctx, ex, ey - 1 * s, 1 * s, 1.2 * s);
      // Highlight
      ctx.fillStyle = 'rgba(170,255,170,0.5)';
      utils.fillCircle(ctx, ex - 0.5 * s, ey - 1.5 * s, 0.5 * s);
    }

    // Mouth
    ctx.strokeStyle = '#0a3a10';
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 4 * s, bodyCy + bodyRy * 0.25);
    ctx.quadraticCurveTo(cx, bodyCy + bodyRy * 0.35, cx + 4 * s, bodyCy + bodyRy * 0.25);
    ctx.stroke();

    // Drip tendrils
    if (act !== 'death') {
      ctx.fillStyle = 'rgba(10,74,24,0.6)';
      ctx.beginPath();
      ctx.moveTo(cx - 10 * s, baseY - 2 * s);
      ctx.quadraticCurveTo(cx - 12 * s, baseY + 2 * s, cx - 11 * s, baseY + 4 * s);
      ctx.quadraticCurveTo(cx - 10 * s, baseY + 3 * s, cx - 9 * s, baseY - 1 * s);
      ctx.fill();
    }

    ctx.restore();
  },
};
```

- [ ] **Step 2: Wire Slime into SpriteGenerator**

In `SpriteGenerator.ts`, add the import and modify `generateMonsterSheets()`:

```typescript
import { SlimeDrawer } from './sprites/monsters/Slime';
```

Add a new method to generate sprites from EntityDrawer modules:

```typescript
private generateFromDrawer(drawer: EntityDrawer): void {
  if (this.shouldSkipGeneration(drawer.key)) return;

  const s = TEXTURE_SCALE;
  const fw = drawer.frameW * s, fh = drawer.frameH * s;
  const [canvas, ctx] = this.utils.createCanvas(fw * drawer.totalFrames, fh);

  // Determine actions and frame layout based on totalFrames
  const actions: [string, number, number][] = [
    ['idle', IDLE_START, IDLE_COUNT],
    ['walk', WALK_START, WALK_COUNT],
    ['attack', ATK_START, ATK_COUNT],
    ['hurt', HURT_START, HURT_COUNT],
    ['death', DEATH_START, DEATH_COUNT],
  ];
  if (drawer.totalFrames > MONSTER_FRAMES) {
    actions.push(['cast', CAST_START, CAST_COUNT]);
  }

  for (const [action, start, count] of actions) {
    for (let f = 0; f < count; f++) {
      const ox = (start + f) * fw;
      ctx.save();
      ctx.translate(ox, 0);
      drawer.drawFrame(ctx, f, action as any, fw, fh, this.utils);
      ctx.restore();
    }
  }

  this.utils.applyNoiseToRegion(ctx, 0, 0, canvas.width, canvas.height, 4);

  const key = drawer.key;
  if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
  const canvasTex = this.scene.textures.addCanvas(key, canvas)!;
  for (let i = 0; i < drawer.totalFrames; i++) {
    canvasTex.add(i, 0, i * fw, 0, fw, fh);
  }
}
```

In `generateMonsterSheets()`, add the Slime drawer call before the existing loop:

```typescript
private generateMonsterSheets(): void {
  // New per-entity drawers
  this.generateFromDrawer(SlimeDrawer);

  // Existing template-based generation (skip if drawer already handled it)
  for (const cfg of MONSTER_CONFIGS) {
    if (!this.scene.textures.exists(cfg.textureKey)) {
      this.makeCharSheet(cfg, MONSTER_FRAMES);
    }
  }
}
```

- [ ] **Step 3: Verify Slime renders in-game**

Run: `npm run dev` — create a character, enter Emerald Plains (Zone 1). Find a Slime enemy. Verify:
- Slime has translucent ooze body with specular highlight
- Eyes float inside the body with green irises
- Idle animation shows gentle pulsing
- Walking shows squish/stretch bounce
- All other monsters still render with old template sprites

- [ ] **Step 4: Commit**

```bash
git add src/graphics/sprites/monsters/Slime.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Slime custom drawer (reference monster implementation)"
```

---

### Task 6: Skeleton — reference undead implementation

**Files:**
- Create: `src/graphics/sprites/monsters/Skeleton.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

This establishes the pattern for bone-based undead monsters using `DrawUtils.drawBoneSegment()`.

- [ ] **Step 1: Create the Skeleton drawer**

Create `src/graphics/sprites/monsters/Skeleton.ts` implementing `EntityDrawer` with:
- `key: 'monster_skeleton'`, `frameW: 44`, `frameH: 64`, `totalFrames: 20`
- **Visual features** (from spec): Anatomical skull with separate jaw and deep eye sockets with faint blue soul-fire. Curved ribcage drawn as individual rib arcs using `ctx.arc()`. Visible spine as vertical bone segments. Separate radius/ulna arm bones using `drawBoneSegment()`. Rusted sword with pitted blade. Pelvis as elliptical bone. Femur + tibia leg bones with joint knobs.
- **Animation**: Idle — slight jaw wobble, soul-fire flicker. Walk — bone rattle (slight random offset per bone). Attack — sword arm swings forward, body leans. Hurt — bones scatter slightly. Death — bones collapse downward, skull rolls.
- Use `DrawUtils.drawBoneSegment()` for all limb bones. Use bone color `0xd0c8b0` with `darken`/`lighten` for depth. Eye sockets are deep black `#1a1a10` with `rgba(68,136,170,0.2)` soul-fire glow.

- [ ] **Step 2: Wire into SpriteGenerator**

Add `import { SkeletonDrawer } from './sprites/monsters/Skeleton';` and add `this.generateFromDrawer(SkeletonDrawer);` in `generateMonsterSheets()`.

- [ ] **Step 3: Verify in-game**

Run: `npm run dev` — enter Twilight Forest (Zone 2), find a Skeleton. Verify anatomical bone structure, sword, and animations.

- [ ] **Step 4: Commit**

```bash
git add src/graphics/sprites/monsters/Skeleton.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Skeleton custom drawer (undead archetype)"
```

---

### Task 7: Werewolf — reference beast implementation

**Files:**
- Create: `src/graphics/sprites/monsters/Werewolf.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

This establishes the pattern for beast-type monsters using `DrawUtils.drawFurTexture()` and `DrawUtils.drawLimb()`.

- [ ] **Step 1: Create the Werewolf drawer**

Create `src/graphics/sprites/monsters/Werewolf.ts` implementing `EntityDrawer` with:
- `key: 'monster_werewolf'`, `frameW: 52`, `frameH: 64`, `totalFrames: 20`
- **Visual features** (from spec): Wolf-like skull with protruding muzzle drawn as overlapping ellipses. Pointed ears with inner pink. Predatory amber slit-pupil eyes (diamond-shaped). Muscular torso with radial gradient (`#6a4a30` → `#2a1808`). Chest fur as lighter belly ellipse overlay. Digitigrade (reverse-knee) legs drawn with `drawLimb()` using 3 joints (hip, backward knee, ankle, paw). Curved claws as short white strokes. Fangs visible in snarl.
- Apply `drawFurTexture()` over the body region after base shapes are drawn.
- **Animation**: Idle — breathing (torso expand/contract), ears twitch. Walk — digitigrade leg cycle, arms swing, muzzle bobs. Attack — lunge forward with claws extended. Hurt — recoil backward. Death — collapse to side.

- [ ] **Step 2: Wire into SpriteGenerator**

Add import and `this.generateFromDrawer(WerewolfDrawer);` in `generateMonsterSheets()`.

- [ ] **Step 3: Verify in-game**

Run: `npm run dev` — enter Twilight Forest, find a Werewolf. Verify wolf muzzle, fur texture, digitigrade legs, and amber eyes.

- [ ] **Step 4: Commit**

```bash
git add src/graphics/sprites/monsters/Werewolf.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Werewolf custom drawer (beast archetype)"
```

---

### Task 8: Fire Elemental — reference elemental implementation

**Files:**
- Create: `src/graphics/sprites/monsters/FireElemental.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

This establishes the pattern for elemental monsters using `DrawUtils.drawFlameLayer()`.

- [ ] **Step 1: Create the Fire Elemental drawer**

Create `src/graphics/sprites/monsters/FireElemental.ts` implementing `EntityDrawer` with:
- `key: 'monster_fire_elemental'`, `frameW: 48`, `frameH: 60`, `totalFrames: 20`
- **Visual features** (from spec): No solid body. Three layered flame silhouettes drawn with `drawFlameLayer()`: outer dark orange `#6a2200`, mid bright `#aa4400`, inner yellow `#cc6600`. White-hot core as radial gradient ellipse. Face emerges as bright spots for eyes (`#ffee00`) and mouth arc. Floating ember particles as small circles with random positions seeded by frame number.
- **Animation**: Each frame uses the frame index as a `flicker` parameter to `drawFlameLayer()`, creating natural flame movement. Idle — gentle flicker. Walk — flame leans in movement direction. Attack — flame surges upward and forward. Hurt — flame dims and contracts. Death — flame shrinks to ember, fades out.

- [ ] **Step 2: Wire into SpriteGenerator**

Add import and `this.generateFromDrawer(FireElementalDrawer);` in `generateMonsterSheets()`.

- [ ] **Step 3: Verify in-game**

Run: `npm run dev` — enter Anvil Mountains (Zone 3), find a Fire Elemental. Verify layered flame effect, flickering animation, and face emerging from fire.

- [ ] **Step 4: Commit**

```bash
git add src/graphics/sprites/monsters/FireElemental.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Fire Elemental custom drawer (elemental archetype)"
```

---

### Task 9: Desert Scorpion — reference arachnid implementation

**Files:**
- Create: `src/graphics/sprites/monsters/DesertScorpion.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

This establishes the pattern for non-humanoid, wide/low body shapes.

- [ ] **Step 1: Create the Desert Scorpion drawer**

Create `src/graphics/sprites/monsters/DesertScorpion.ts` implementing `EntityDrawer` with:
- `key: 'monster_desert_scorpion'`, `frameW: 52`, `frameH: 44`, `totalFrames: 20`
- **Visual features** (from spec): Wide landscape orientation. Segmented carapace drawn as overlapping ellipses with gradient (`#8a6a3a` → `#4a3018`). Tail as chain of decreasing circles curving upward, ending in red stinger with venom drip. Pincers (chelae) as curved paths with serrated inner edge. Cephalothorax head with cluster of small beady eyes. 4 pairs of jointed legs drawn with `drawLimb()`.
- **Animation**: Idle — tail sways, pincers open/close slightly. Walk — legs cycle, body shifts side to side. Attack — tail strikes forward (stinger arc). Hurt — body contracts. Death — legs curl inward, body flips.

- [ ] **Step 2: Wire into SpriteGenerator**

Add import and `this.generateFromDrawer(DesertScorpionDrawer);` in `generateMonsterSheets()`.

- [ ] **Step 3: Verify in-game**

Run: `npm run dev` — enter Scorching Desert (Zone 4). Verify scorpion shape, segmented tail, pincers, and leg movement.

- [ ] **Step 4: Commit**

```bash
git add src/graphics/sprites/monsters/DesertScorpion.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Desert Scorpion custom drawer (arachnid archetype)"
```

---

## Chunk 3: Remaining Zone 1–3 Monsters

Each task follows the same pattern established in Chunk 2. Create the drawer file, wire into SpriteGenerator, verify visually, commit.

### Task 10: Goblin + Goblin Chief

**Files:**
- Create: `src/graphics/sprites/monsters/Goblin.ts`
- Create: `src/graphics/sprites/monsters/GoblinChief.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

- [ ] **Step 1: Create Goblin drawer**

`src/graphics/sprites/monsters/Goblin.ts` — `key: 'monster_goblin'`, `frameW: 48`, `frameH: 56`, `totalFrames: 20`

Visual spec: Heavy brow ridge (dark arc over eyes), bulbous warty nose (ellipse with small circle wart), sinewy arms drawn with `drawLimb()`, leather vest via `drawLeatherTexture()`, nail-studded crude club (rect with small grey circles for nails), large pointed ears (triangle paths), wrapped feet (small ellipses with cross-hatch strokes). Skin color `#5a8a30` with gradient. Eyes are deep-set beady orange `#cc6600`.

- [ ] **Step 2: Create Goblin Chief drawer**

`src/graphics/sprites/monsters/GoblinChief.ts` — `key: 'monster_goblin_chief'`, `frameW: 60`, `frameH: 68`, `totalFrames: 20`

Visual spec: Same base as Goblin but 25% larger. Battered crown (jagged polygon with `drawMetalSurface()` gold `#8a7030`, red gem circle). Battle scar across face (diagonal stroke with perpendicular tick marks). Crude shoulder pauldrons (ellipses with `drawMetalSurface()`). War axe instead of club (rect handle + polygon blade with `drawMetalSurface()` `#6a6a7a`). Metal-capped boots. Eyes glow redder `#cc4400`.

- [ ] **Step 3: Wire both into SpriteGenerator**

Import both drawers and add `this.generateFromDrawer()` calls in `generateMonsterSheets()`.

- [ ] **Step 4: Verify in-game**

Run: `npm run dev` — Emerald Plains. Verify Goblin has warty nose, leather vest, crude club. Verify Goblin Chief is larger with crown, scar, pauldrons, and axe.

- [ ] **Step 5: Commit**

```bash
git add src/graphics/sprites/monsters/Goblin.ts src/graphics/sprites/monsters/GoblinChief.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Goblin and Goblin Chief custom drawers"
```

---

### Task 11: Zombie + Werewolf Alpha + Gargoyle

**Files:**
- Create: `src/graphics/sprites/monsters/Zombie.ts`
- Create: `src/graphics/sprites/monsters/WerewolfAlpha.ts`
- Create: `src/graphics/sprites/monsters/Gargoyle.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

- [ ] **Step 1: Create Zombie drawer**

`key: 'monster_zombie'`, `frameW: 44`, `frameH: 60`, `totalFrames: 20`

Visual spec: Lopsided head (ellipse with slight rotation transform). Exposed skull patch (lighter arc on one side). Sunken glowing green eyes of uneven sizes. Torn clothing (rect body with irregular edge paths, gaps showing skin `#6a8a5a` underneath). One arm outstretched using `drawLimb()` with stiff angle. Stiff asymmetric gait in walk animation (one leg drags).

- [ ] **Step 2: Create Werewolf Alpha drawer**

`key: 'monster_werewolf_alpha'`, `frameW: 56`, `frameH: 68`, `totalFrames: 20`

Visual spec: Same structure as Werewolf but 20% larger. Darker fur `#2a1810`. Glowing red eyes `#ff4400` (brighter than werewolf amber). Battle scars drawn as diagonal strokes with `darken()` across torso and face. Heavier musculature (wider torso ellipse, thicker limbs). More upright posture (less hunched than regular werewolf).

- [ ] **Step 3: Create Gargoyle drawer**

`key: 'monster_gargoyle'`, `frameW: 52`, `frameH: 60`, `totalFrames: 20`

Visual spec: Angular head (polygon path, not ellipse). Weathered stone texture via `drawStoneTexture()` with base `#4a5a6a`. Moss patches (small green ellipses with low alpha). Bat-wing membranes (curved paths with vein lines). Curved horns (thick stroked arcs). Crouching compact posture (body lower, legs bent). Stone cracks with faint orange glow (thin strokes + orange stroke overlay at low alpha). Curled stone tail (quadratic curve path with decreasing width).

- [ ] **Step 4: Wire all three into SpriteGenerator**

Import all drawers and add `this.generateFromDrawer()` calls.

- [ ] **Step 5: Verify in-game**

Run: `npm run dev` — Twilight Forest. Verify Zombie (lopsided, torn clothes, outstretched arm), Werewolf Alpha (larger/darker werewolf with scars), Gargoyle (stone texture, wings, crouching).

- [ ] **Step 6: Commit**

```bash
git add src/graphics/sprites/monsters/Zombie.ts src/graphics/sprites/monsters/WerewolfAlpha.ts src/graphics/sprites/monsters/Gargoyle.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Zombie, Werewolf Alpha, Gargoyle custom drawers"
```

---

### Task 12: Stone Golem + Mountain Troll

**Files:**
- Create: `src/graphics/sprites/monsters/StoneGolem.ts`
- Create: `src/graphics/sprites/monsters/MountainTroll.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

- [ ] **Step 1: Create Stone Golem drawer**

`key: 'monster_stone_golem'`, `frameW: 60`, `frameH: 68`, `totalFrames: 20`

Visual spec: Angular boulder body segments drawn as polygons (not smooth ellipses) using `drawStoneTexture()`. Glowing orange cracks between segments (thin strokes `#ff8800` at 0.5 alpha). Pillar legs (rectangles with stone texture). Massive asymmetric fists (polygons, one larger). Small boulder head with ember eyes (`#ff8800` radial gradient). Segments appear to float — gap between head and body, between body and limbs (orange glow fills gaps).

- [ ] **Step 2: Create Mountain Troll drawer**

`key: 'monster_mountain_troll'`, `frameW: 64`, `frameH: 72`, `totalFrames: 20`

Visual spec: Massive belly (large ellipse, `#3a5a2a` with lighter center `#4a6a3a`). Disproportionately small head (only ~15% of body height). Tiny beady eyes (2px circles) with `#ffaa00` iris dots. Prominent underbite with two tusks (upward triangles from jaw). Enormous arms reaching past knees via `drawLimb()` with thick base width. Short thick legs. Grey-green mottled skin with noise overlay. Tree-trunk club (thick rect with bark-colored strokes `#5a3a1a`).

- [ ] **Step 3: Wire both into SpriteGenerator**

Import both drawers and add `this.generateFromDrawer()` calls in `generateMonsterSheets()`.

- [ ] **Step 4: Verify in-game**

Run: `npm run dev` — enter Anvil Mountains (Zone 3). Verify Stone Golem (floating boulder segments with orange cracks) and Mountain Troll (massive belly, tiny head, tree-trunk club).

- [ ] **Step 5: Commit**

```bash
git add src/graphics/sprites/monsters/StoneGolem.ts src/graphics/sprites/monsters/MountainTroll.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Stone Golem and Mountain Troll custom drawers"
```

---

## Chunk 4: Zone 4–5 Monsters

### Task 13: Sandworm + Phoenix

**Files:**
- Create: `src/graphics/sprites/monsters/Sandworm.ts`
- Create: `src/graphics/sprites/monsters/Phoenix.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

- [ ] **Step 1: Create Sandworm drawer**

`key: 'monster_sandworm'`, `frameW: 56`, `frameH: 48`, `totalFrames: 20`

Visual spec: Body emerging from ground at angle — lower portion is "underground" (not drawn, implied by ground-level cutoff). Circular mouth with concentric rings of teeth (arcs at decreasing radii with small triangles). Eyeless head with sensory pits (dark indentations). Visible body segments as horizontal arc stripes. Coils visible behind head (overlapping circles decreasing in size). Sand particles as scattered small circles `#c0a060` at low alpha. Rough sandy hide via gradient `#8a7040` → `#4a3018`.

- [ ] **Step 2: Create Phoenix drawer**

`key: 'monster_phoenix'`, `frameW: 56`, `frameH: 56`, `totalFrames: 20`

Visual spec: Bird body (ellipse torso). Layered flame-feather wings — draw individual feather shapes as elongated teardrops, transitioning from `#cc5500` at base to `#ff8800` at tips using `drawFlameLayer()` for each feather group. Ornate head crest (upward flame wisps). Sharp curved beak (triangle `#ff8800`). Blazing eyes `#ffee00` with white center. Long trailing tail feathers dissolving into fire (paths that fade via decreasing alpha). Ember particles. Warm light aura (large radial gradient at low alpha behind body).

- [ ] **Step 3: Wire both into SpriteGenerator, verify in Zone 4, commit**

```bash
git add src/graphics/sprites/monsters/Sandworm.ts src/graphics/sprites/monsters/Phoenix.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Sandworm and Phoenix custom drawers"
```

---

### Task 14: Imp + Lesser Demon + Succubus

**Files:**
- Create: `src/graphics/sprites/monsters/Imp.ts`
- Create: `src/graphics/sprites/monsters/LesserDemon.ts`
- Create: `src/graphics/sprites/monsters/Succubus.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

- [ ] **Step 1: Create Imp drawer**

`key: 'monster_imp'`, `frameW: 40`, `frameH: 48`, `totalFrames: 20`

Visual spec: Oversized head (40% of total height). Small curved horns (short arcs `#4a0808`). Bat wings too small to fly (small triangular paths behind shoulders `#5a1010`). Large mischievous amber eyes `#ffaa00` with large pupils. Wide toothy grin (arc with triangle teeth). Skinny limbs via `drawLimb()` with thin width. Spade-tipped tail (curve path ending in diamond shape). Reddish skin `#7a1010`.

- [ ] **Step 2: Create Lesser Demon drawer**

`key: 'monster_lesser_demon'`, `frameW: 52`, `frameH: 64`, `totalFrames: 20`

Visual spec: Muscular humanoid frame. Curved goat-like horns (thick arcs `#3a0a2a`). Fanged mouth (downward triangles from upper jaw). Clawed hands with elongated fingers (5 thin lines ending in points). Barbed tail (curve with small triangles along it). Purple-red skin `#5a0a3a` with gradient. Defined musculature — pectoral line, abdominal segments drawn as horizontal arcs on torso. Hoofed feet (dark wedge shapes).

- [ ] **Step 3: Create Succubus drawer**

`key: 'monster_succubus'`, `frameW: 48`, `frameH: 64`, `totalFrames: 20`

Visual spec: Slender form with narrow waist (body path curves inward at waist). Swept-back curved horns (graceful arcs, thinner than demon horns). Dark flowing hair (layered curve paths from head `#2a0a1a`). Elegant bat wings (smoother curves than gargoyle, `#5a1030` with subtle vein). Alluring glowing pink eyes `#ff44aa` with white highlight. Dark lips (small arc fill `#aa2050`). Form-fitting dark clothing (body shape with darker overlay). Spade-tipped tail. Clawed fingertips (tiny points at hand ends).

- [ ] **Step 4: Wire all three into SpriteGenerator, verify in Zone 5, commit**

```bash
git add src/graphics/sprites/monsters/Imp.ts src/graphics/sprites/monsters/LesserDemon.ts src/graphics/sprites/monsters/Succubus.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Imp, Lesser Demon, Succubus custom drawers"
```

---

### Task 15: Demon Lord (boss)

**Files:**
- Create: `src/graphics/sprites/monsters/DemonLord.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

- [ ] **Step 1: Create Demon Lord drawer**

`key: 'monster_demon_lord'`, `frameW: 72`, `frameH: 84`, `totalFrames: 20`

Visual spec: Massive frame (largest sprite in the game). Ram-like spiraling horns with ridges (thick arcs with perpendicular tick marks `#1a0a1a`). Enormous tattered bat wings (large curved paths with jagged edges and vein lines, `#2a0a3a`). Burning red eyes with vertical slit pupils (eye shape: outer `#ff0044` radial gradient, inner vertical ellipse pupil `#1a0a0a`, white highlight dot). Chest bearing glowing arcane rune (diamond shape with inner glow `#ff004444`). Dark purple-black skin `#2a0a3a` → `#0a0418` gradient. Spiked shoulder pauldrons (ellipses with spike lines extending upward). Hooved digitigrade legs via `drawLimb()`. Heavy barbed tail (thick curve with triangle barbs). Subtle dark aura (large low-alpha radial gradient behind entire body `#ff004406`).

- [ ] **Step 2: Wire into SpriteGenerator, verify in Zone 5, commit**

```bash
git add src/graphics/sprites/monsters/DemonLord.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Demon Lord custom drawer (boss)"
```

---

## Chunk 5: Players

### Task 16: Player Warrior

**Files:**
- Create: `src/graphics/sprites/players/PlayerWarrior.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

- [ ] **Step 1: Create Player Warrior drawer**

`key: 'player_warrior'`, `frameW: 64`, `frameH: 96`, `totalFrames: 24` (includes cast frames)

Visual spec: Stocky broad-shouldered build. Heavy plate pauldrons via `drawMetalSurface()` `#566a80`. Chain mail visible at joints (cross-hatch pattern at shoulder/elbow gaps using thin grey strokes). Kite shield on left arm (pentagon shape with emblem — simple cross or lion silhouette). Longsword with crossguard in right hand (rect blade `#8a8a9a`, rect crossguard `#5a4a3a`). Iron helm with nose guard (dome shape with vertical rect nose piece). Thick armored boots (wide rectangles with `drawMetalSurface()`). Body armor color `#3a4a5c` with lighter chest `#566a80`. Skin tone `#b08960`.

Animation: Idle — slight breathing, shield rests at side. Walk — heavy bob with shield forward, sword at ready. Attack — overhead slash (sword arcs from behind head to forward). Hurt — shield raises to block, recoil. Death — collapse forward, shield and sword fall. Cast — shield up, sword glows (color overlay on blade).

- [ ] **Step 2: Wire into SpriteGenerator**

Modify `generatePlayerSheets()` similarly to monsters:

```typescript
private generatePlayerSheets(): void {
  this.generateFromDrawer(PlayerWarriorDrawer);
  // Existing template fallback for remaining classes
  for (const cfg of PLAYER_CONFIGS) {
    if (!this.scene.textures.exists(cfg.textureKey)) {
      this.makeCharSheet(cfg, PLAYER_FRAMES);
    }
  }
}
```

- [ ] **Step 3: Verify in-game**

Run: `npm run dev` — create a Warrior, enter a zone. Verify plate armor, shield, sword, helm, and all animations. Other classes should still use template sprites.

- [ ] **Step 4: Commit**

```bash
git add src/graphics/sprites/players/PlayerWarrior.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Player Warrior custom drawer"
```

---

### Task 17: Player Mage + Player Rogue

**Files:**
- Create: `src/graphics/sprites/players/PlayerMage.ts`
- Create: `src/graphics/sprites/players/PlayerRogue.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

- [ ] **Step 1: Create Player Mage drawer**

`key: 'player_mage'`, `frameW: 64`, `frameH: 96`, `totalFrames: 24`

Visual spec: Lean tall frame (narrower body rect). Flowing layered robes (body drawn as trapezoid widening at bottom, with wavy hem line). Pointed wizard hat with star motif (triangle with star circle near tip, `#3f2a55`). Gnarled staff with glowing crystal tip (bent line for staff, small radial gradient circle at top `#8a5ac0` → `#ffffff`). Arcane energy wisps around hands in cast frames (small circles with glow). Narrow frame. Cloth shoes (simple flat ellipses). Body `#2a1a3a`. Skin `#c4a882`.

- [ ] **Step 2: Create Player Rogue drawer**

`key: 'player_rogue'`, `frameW: 64`, `frameH: 96`, `totalFrames: 24`

Visual spec: Athletic balanced build. Leather armor via `drawLeatherTexture()` `#2a3a2a` with buckle details (small `drawMetalSurface()` rectangles). Hooded cloak draped over one shoulder (asymmetric triangle path on left side, `#2a3a1a`). Dual curved daggers (short curved blade paths in each hand `#8a8a9a`). Bandolier with pouches (diagonal strap across chest with small rect pouches). Cloth-wrapped boots (cross-hatch pattern). Skin `#a08060`. Agile stance (slight lean forward).

- [ ] **Step 3: Wire both into SpriteGenerator, verify all 3 classes, commit**

```bash
git add src/graphics/sprites/players/PlayerMage.ts src/graphics/sprites/players/PlayerRogue.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Player Mage and Rogue custom drawers"
```

---

## Chunk 6: NPCs

### Task 18: NPC drawing modules (all 11)

**Files:**
- Create: `src/graphics/sprites/npcs/Blacksmith.ts`
- Create: `src/graphics/sprites/npcs/BlacksmithAdvanced.ts`
- Create: `src/graphics/sprites/npcs/Merchant.ts`
- Create: `src/graphics/sprites/npcs/MerchantDesert.ts`
- Create: `src/graphics/sprites/npcs/Stash.ts`
- Create: `src/graphics/sprites/npcs/QuestElder.ts`
- Create: `src/graphics/sprites/npcs/QuestScout.ts`
- Create: `src/graphics/sprites/npcs/ForestHermit.ts`
- Create: `src/graphics/sprites/npcs/QuestDwarf.ts`
- Create: `src/graphics/sprites/npcs/QuestNomad.ts`
- Create: `src/graphics/sprites/npcs/QuestWarden.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

NPCs use 24 frames at 80×120 with 4-state animation (working/alert/idle/talking). The `EntityDrawer` interface works — `totalFrames: 24`, actions are `NPCAction` type.

- [ ] **Step 1: Create NPC drawer helper for generateFromDrawer**

NPCs use a different frame layout than monsters (working/alert/idle/talking instead of idle/walk/attack/hurt/death). Add an NPC-specific generation method to SpriteGenerator:

```typescript
private generateFromNPCDrawer(drawer: EntityDrawer): void {
  if (this.shouldSkipGeneration(drawer.key)) return;

  const s = TEXTURE_SCALE;
  const fw = drawer.frameW * s, fh = drawer.frameH * s;
  const [canvas, ctx] = this.utils.createCanvas(fw * drawer.totalFrames, fh);

  const actions: [string, number, number][] = [
    ['working', NPC_WORK_START, NPC_WORK_COUNT],
    ['alert', NPC_ALERT_START, NPC_ALERT_COUNT],
    ['idle', NPC_IDLE_START, NPC_IDLE_COUNT],
    ['talking', NPC_TALK_START, NPC_TALK_COUNT],
  ];

  for (const [action, start, count] of actions) {
    for (let f = 0; f < count; f++) {
      const ox = (start + f) * fw;
      ctx.save();
      ctx.translate(ox, 0);
      drawer.drawFrame(ctx, f, action as any, fw, fh, this.utils);
      ctx.restore();
    }
  }

  this.utils.applyNoiseToRegion(ctx, 0, 0, canvas.width, canvas.height, 3);

  const key = drawer.key;
  if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
  const canvasTex = this.scene.textures.addCanvas(key, canvas)!;
  for (let i = 0; i < drawer.totalFrames; i++) {
    canvasTex.add(i, 0, i * fw, 0, fw, fh);
  }
}
```

- [ ] **Step 2: Create Blacksmith drawer (reference NPC)**

`key: 'npc_blacksmith'`, `frameW: 80`, `frameH: 120`, `totalFrames: 24`

Visual spec: Grizzled face with square jaw (wider head shape). Short dark hair `#2a1a0a`. Full beard. Bulky build (`bodyScale: 1.15`). Heavy leather apron via `drawLeatherTexture()`. Muscular bare arms (skin `#c09070`). Hammer in right hand (rect handle + rect head with `drawMetalSurface()` `#6a6a6a`). Standing near implied anvil.

Working: Hammer arm raises and falls rhythmically. Alert: Looks up, hammer pauses mid-swing. Idle: Hammer at side, slight breathing. Talking: Free hand gestures, hammer rests on shoulder.

- [ ] **Step 3: Create remaining 10 NPC drawers**

Each follows the same pattern as Blacksmith. Key per-NPC visual details:

| NPC | Unique Face | Accessory Animation |
|-----|------------|-------------------|
| BlacksmithAdvanced | Bald, darker skin `#a08060`, broader | Hammer with fancier metal head |
| Merchant | Round face, short brown hair, friendly eyes | Counting coins from coinbag, weighing gesture |
| MerchantDesert | Hooded, darker skin `#b08050`, kohl eyes | Presenting wares from cloth sack |
| Stash | Scholarly face, medium brown hair | Reading/writing in book, arcane symbols |
| QuestElder | Weathered face, deep wrinkles, long grey hair, full beard | Leaning on staff with golden orb |
| QuestScout | Young face, short hair, alert eyes | Cloaked, hand on sword hilt |
| ForestHermit | Aged face, long grey hair, wild beard | Staff with green crystal, mossy cloak |
| QuestDwarf | Broad face, red beard, thick brows | Pickaxe over shoulder, stocky build |
| QuestNomad | Hooded, desert skin, sharp features | Swinging lantern, sandy cloak |
| QuestWarden | Gaunt face, dark hair, stern expression | Dark cloak, sword at belt |

- [ ] **Step 4: Wire all NPC drawers into SpriteGenerator**

Update `generateNPCSprites()`:

```typescript
private generateNPCSprites(): void {
  const npcDrawers = [
    BlacksmithDrawer, BlacksmithAdvancedDrawer, MerchantDrawer,
    MerchantDesertDrawer, StashDrawer, QuestElderDrawer,
    QuestScoutDrawer, ForestHermitDrawer, QuestDwarfDrawer,
    QuestNomadDrawer, QuestWardenDrawer,
  ];
  for (const drawer of npcDrawers) {
    this.generateFromNPCDrawer(drawer);
  }
  // Template fallback for any not covered
  for (const npc of NPC_CONFIGS) {
    if (!this.scene.textures.exists(npc.key)) {
      this.makeNPCSheet(npc);
    }
  }
}
```

- [ ] **Step 5: Verify all NPCs in-game**

Run: `npm run dev` — visit each zone's camp. Verify each NPC has a unique face and appropriate working animation.

- [ ] **Step 6: Commit**

```bash
git add src/graphics/sprites/npcs/*.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add all 11 NPC custom drawers"
```

---

## Chunk 7: Decorations, Effects, Export Tool, Cleanup

### Task 19: Decoration drawing modules (all 9)

**Files:**
- Create: `src/graphics/sprites/decorations/Tree.ts` (and 8 more)
- Modify: `src/graphics/SpriteGenerator.ts`

Decorations are single-frame static textures. `totalFrames: 1`, `action` is always `'idle'`, `frame` is always `0`.

- [ ] **Step 1: Create all 9 decoration drawers**

Each implements `EntityDrawer` with `totalFrames: 1`. Use the visual spec from the design doc:

| File | Key | Size | Drawing Focus |
|------|-----|------|--------------|
| `Tree.ts` | `decor_tree` | 24×36 | Gnarled trunk (`drawPart` with bark strokes), layered canopy (overlapping ellipses with depth gradient), visible roots |
| `Bush.ts` | `decor_bush` | 16×12 | Leafy clusters (multiple overlapping small ellipses with green variation), berry accents (tiny red circles) |
| `Rock.ts` | `decor_rock` | 16×12 | `drawStoneTexture()`, angular polygon shape, lichen spots (green-grey circles) |
| `Flower.ts` | `decor_flower` | 8×10 | Distinct petals (5 small ellipses arranged radially), stem with leaves, center dot |
| `Mushroom.ts` | `decor_mushroom` | 10×12 | Cap with spots (ellipse + small circles), gills underneath (thin arcs), thick stem |
| `Cactus.ts` | `decor_cactus` | 12×20 | Ribbed surface (vertical stroked arcs), needle clusters (tiny cross-hatch patterns), optional flower |
| `Boulder.ts` | `decor_boulder` | 20×16 | `drawStoneTexture()`, massive angular polygon, moss on top (green ellipse overlay) |
| `Crystal.ts` | `decor_crystal` | 14×18 | Faceted polygon surfaces, inner glow (radial gradient), transparent edges (low-alpha outer strokes) |
| `Bones.ts` | `decor_bones` | 16×10 | Scattered bone shapes via `drawBoneSegment()`, cracked skull fragment, partially buried |

- [ ] **Step 2: Wire decoration drawers into SpriteGenerator**

Add a `generateFromStaticDrawer()` method for single-frame textures:

```typescript
private generateFromStaticDrawer(drawer: EntityDrawer): void {
  if (this.shouldSkipGeneration(drawer.key)) return;

  const s = TEXTURE_SCALE;
  const w = drawer.frameW * s, h = drawer.frameH * s;
  const [canvas, ctx] = this.utils.createCanvas(w, h);

  drawer.drawFrame(ctx, 0, 'idle', w, h, this.utils);

  if (this.scene.textures.exists(drawer.key)) this.scene.textures.remove(drawer.key);
  this.scene.textures.addCanvas(drawer.key, canvas);
}
```

Update `generateDecorations()` to use the new drawers with template fallback.

- [ ] **Step 3: Verify decorations in-game, commit**

```bash
git add src/graphics/sprites/decorations/*.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add all 9 decoration custom drawers"
```

---

### Task 20: Effect drawing modules (Loot Bag + Exit Portal)

**Files:**
- Create: `src/graphics/sprites/effects/LootBag.ts`
- Create: `src/graphics/sprites/effects/ExitPortal.ts`
- Modify: `src/graphics/SpriteGenerator.ts`

- [ ] **Step 1: Create LootBag drawer**

`key: 'loot_bag'`, `frameW: 24`, `frameH: 24`, `totalFrames: 1`

Visual spec: Leather pouch with drawstring (body shape as rounded rect via `drawLeatherTexture()` `#4a3020`). Visible stitching (dashed line down center). Metallic buckle with sheen (`drawMetalSurface()` small rect `#8a7020`). Bulging shape. Ground shadow (dark ellipse at base).

- [ ] **Step 2: Create ExitPortal drawer**

`key: 'exit_portal'`, `frameW: 32`, `frameH: 32`, `totalFrames: 1`

Visual spec: Swirling energy vortex (concentric arc strokes with rotation, green `#00dc64`). Inner glow gradient (radial white → green → transparent). Edge sparkle hints (small bright dots at perimeter).

- [ ] **Step 3: Wire both into SpriteGenerator's generateEffects(), verify, commit**

```bash
git add src/graphics/sprites/effects/*.ts src/graphics/SpriteGenerator.ts
git commit -m "feat(graphics): add Loot Bag and Exit Portal custom drawers"
```

---

### Task 21: Texture Export Tool

**Files:**
- Create: `src/graphics/TextureExporter.ts`
- Modify: `src/scenes/ZoneScene.ts`

- [ ] **Step 1: Create TextureExporter**

```typescript
// src/graphics/TextureExporter.ts
import { buildFrameSizeRegistry } from './sprites/types';

export class TextureExporter {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  exportAll(): void {
    const registry = buildFrameSizeRegistry();
    const keys = Object.keys(registry);

    // Also include decorations and effects
    const decorKeys = ['decor_tree', 'decor_bush', 'decor_rock', 'decor_flower',
      'decor_mushroom', 'decor_cactus', 'decor_boulder', 'decor_crystal', 'decor_bones'];
    const effectKeys = ['loot_bag', 'exit_portal'];
    const allKeys = [...keys, ...decorKeys, ...effectKeys];

    const links: string[] = [];

    for (const key of allKeys) {
      if (!this.scene.textures.exists(key)) continue;
      const tex = this.scene.textures.get(key);
      const source = tex.getSourceImage() as HTMLCanvasElement;
      if (!(source instanceof HTMLCanvasElement)) continue;

      const dataUrl = source.toDataURL('image/png');
      const filename = this.keyToFilename(key);
      links.push(`<a href="${dataUrl}" download="${filename}">${key} (${source.width}x${source.height})</a>`);
    }

    // Open manifest page
    const html = `<!DOCTYPE html><html><head><title>Texture Export</title>
      <style>body{background:#1a1a2e;color:#c0934a;font-family:monospace;padding:20px}
      a{color:#5aaa8a;display:block;margin:4px 0}</style></head>
      <body><h1>Exported Textures (${links.length})</h1>
      <p>Right-click → Save As to download individual sprites.</p>
      ${links.join('\n')}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob));
  }

  private keyToFilename(key: string): string {
    if (key.startsWith('player_')) return `sprites-players-${key}.png`;
    if (key.startsWith('monster_')) return `sprites-monsters-${key}.png`;
    if (key.startsWith('npc_')) return `sprites-npcs-${key}.png`;
    if (key.startsWith('decor_')) return `sprites-decorations-${key}.png`;
    return `sprites-effects-${key}.png`;
  }
}
```

- [ ] **Step 2: Wire keybinding in ZoneScene (dev mode only)**

In `ZoneScene.ts`, in the `create()` method where keyboard controls are set up, add:

```typescript
if (import.meta.env.DEV) {
  const exportKey = this.input.keyboard!.addKey(
    Phaser.Input.Keyboard.KeyCodes.E
  );
  exportKey.on('down', async (event: KeyboardEvent) => {
    if (event.ctrlKey && event.shiftKey) {
      const { TextureExporter } = await import('../graphics/TextureExporter');
      new TextureExporter(this).exportAll();
    }
  });
}
```

- [ ] **Step 3: Verify export tool**

Run: `npm run dev` — enter a zone, press `Ctrl+Shift+E`. A new browser tab should open listing all texture keys with download links. Click one to verify it downloads a valid PNG sprite sheet.

- [ ] **Step 4: Commit**

```bash
git add src/graphics/TextureExporter.ts src/scenes/ZoneScene.ts
git commit -m "feat(graphics): add dev texture export tool (Ctrl+Shift+E)"
```

---

### Task 22: Remove old template code and final cleanup

**Files:**
- Modify: `src/graphics/SpriteGenerator.ts`

- [ ] **Step 1: Verify all entities have custom drawers**

Run: `npm run dev` — visit every zone, verify every monster, player, NPC, and decoration renders with the new custom sprites. Make a list of any entities still using the old template.

- [ ] **Step 2: Remove old drawing functions**

Once all 43 entities have custom drawers wired in, remove from `SpriteGenerator.ts`:
- `drawHumanoidFrame()` and all its sub-methods
- `drawBlobFrame()` and its sub-methods
- `drawNPCFrame()` and `calcNPCPose()`
- `getAnimOffsets()`
- The `PLAYER_CONFIGS`, `MONSTER_CONFIGS`, `NPC_CONFIGS` arrays
- The `SpriteConfig`, `NPCConfig`, `AnimOffsets` interfaces
- The `makeCharSheet()` and `makeNPCSheet()` methods (replaced by `generateFromDrawer` / `generateFromNPCDrawer` / `generateFromStaticDrawer`)

Keep: `generateTiles()`, `generateBlendedTile()`, `generateCampDecorations()`, tile-related code, `registerAnimations()`, `generateAll()` (now just calls drawers).

- [ ] **Step 3: Remove the delegate-pattern wrappers in SpriteGenerator**

In Task 2, we added wrapper methods like `private hash2d(...) { return this.utils.hash2d(...); }`. If tile/camp code still uses these, keep them. Otherwise, remove the wrappers and use `this.utils.*` directly in any remaining code.

- [ ] **Step 4: Verify game still works end-to-end**

Run: `npm run dev` — full playthrough: create each class, visit each zone, interact with NPCs, check all monsters, verify decorations, test loot drops (loot_bag sprite), test zone transitions (exit_portal sprite).

- [ ] **Step 5: Commit**

```bash
git add src/graphics/SpriteGenerator.ts
git commit -m "refactor(graphics): remove old template drawing code, SpriteGenerator is now a thin orchestrator"
```

---

### Task 23: Final commit and verification

- [ ] **Step 1: Run build to verify no TypeScript errors**

Run: `npm run build`

Expected: Clean build with no errors. Check for any unused imports or references to removed code.

- [ ] **Step 2: Visual regression check**

Run: `npm run dev` — do a final visual pass through all 5 zones. Verify:
- [ ] All 3 player classes have unique gear and animations
- [ ] All 18 monsters have unique silhouettes per their archetype
- [ ] All 11 NPCs have unique faces and working animations
- [ ] All 9 decorations render correctly
- [ ] Loot bag and exit portal effects render correctly
- [ ] Texture export tool works (Ctrl+Shift+E)
- [ ] External PNG override works (existing tile_grass.png and decor_tree.png are used instead of procedural)

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(graphics): complete entity visual overhaul — 43 unique sprites in realistic dark fantasy style"
```
