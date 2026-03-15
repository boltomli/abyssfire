# Camp Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade camps to Diablo II-style encampments with palisade walls, decorations, zone theming, and a monster safe zone.

**Architecture:** New `TILE_CAMP_WALL` tile type + `CampTheme` data drives themed camp generation in `MapGenerator`. Camp decorations are computed at runtime by `ZoneScene`. Monster safe zone check is added to `ZoneScene.update()` loop. All visuals are procedurally generated in `SpriteGenerator`.

**Tech Stack:** Phaser 3, TypeScript, procedural canvas rendering

**Spec:** `docs/plans/2026-03-15-camp-redesign-design.md`

---

## Chunk 1: Data Layer & MapGenerator

### Task 1: Add CampTheme type and TILE_CAMP_WALL to types.ts

**Files:**
- Modify: `src/data/types.ts:172-177` (TileData.type union, MapData)

- [ ] **Step 1: Add `'camp_wall'` to `TileData.type` union**

In `src/data/types.ts`, change line 174:
```typescript
// Before:
type: 'grass' | 'dirt' | 'stone' | 'water' | 'wall' | 'camp';
// After:
type: 'grass' | 'dirt' | 'stone' | 'water' | 'wall' | 'camp' | 'camp_wall';
```

- [ ] **Step 2: Add `safeZoneRadius` to `MapData`**

In `src/data/types.ts`, add after `decorations?` field (around line 194):
```typescript
safeZoneRadius?: number;
```

- [ ] **Step 3: Add `CampTheme` interface**

In `src/data/types.ts`, add after `MapData`:
```typescript
export interface CampTheme {
  wallColor: string;
  wallDark: string;
  wallLight: string;
  wallTop: string;
  groundColor: string;
  bannerColor: string;
  bannerDark: string;
  torchFlame: number;
  tentColor: string;
}
```

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors (existing code doesn't reference new fields yet)

- [ ] **Step 5: Commit**

```bash
git add src/data/types.ts
git commit -m "feat(camp): add CampTheme type, TILE_CAMP_WALL to TileData, safeZoneRadius to MapData"
```

---

### Task 2: Create camp-themes.ts

**Files:**
- Create: `src/data/camp-themes.ts`

- [ ] **Step 1: Create the camp themes config file**

```typescript
import type { CampTheme, MapTheme } from './types';

export const CAMP_THEMES: Record<MapTheme, CampTheme> = {
  plains: {
    wallColor: '#4a3520',
    wallDark: '#2e2010',
    wallLight: '#5a4530',
    wallTop: '#6a5540',
    groundColor: '#2c2010',
    bannerColor: '#2a6a1a',
    bannerDark: '#1a4a10',
    torchFlame: 0xff8800,
    tentColor: '#5a4a30',
  },
  forest: {
    wallColor: '#2a3a20',
    wallDark: '#1a2a10',
    wallLight: '#3a4a30',
    wallTop: '#4a5a40',
    groundColor: '#2a3028',
    bannerColor: '#6a4a8a',
    bannerDark: '#4a2a6a',
    torchFlame: 0xaa88ff,
    tentColor: '#3a4a3a',
  },
  mountain: {
    wallColor: '#4a4a50',
    wallDark: '#2a2a30',
    wallLight: '#5a5a60',
    wallTop: '#6a6a70',
    groundColor: '#3a3a3e',
    bannerColor: '#8a2a1a',
    bannerDark: '#5a1a10',
    torchFlame: 0xff6600,
    tentColor: '#4a4040',
  },
  desert: {
    wallColor: '#6a5a3a',
    wallDark: '#4a3a20',
    wallLight: '#7a6a4a',
    wallTop: '#8a7a5a',
    groundColor: '#4a3a20',
    bannerColor: '#c07020',
    bannerDark: '#8a5010',
    torchFlame: 0xffaa00,
    tentColor: '#6a5a40',
  },
  abyss: {
    wallColor: '#1a1020',
    wallDark: '#0a0510',
    wallLight: '#2a1a30',
    wallTop: '#3a2040',
    groundColor: '#1a1018',
    bannerColor: '#8a1a1a',
    bannerDark: '#5a0a0a',
    torchFlame: 0xff2200,
    tentColor: '#2a1a2a',
  },
};
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/data/camp-themes.ts
git commit -m "feat(camp): add zone-themed camp color configs"
```

---

### Task 3: Fix Abyss Rift camp position

**Files:**
- Modify: `src/data/maps/abyss_rift.ts:30`

- [ ] **Step 1: Move primary camp from (6,16) to (10,16)**

In `src/data/maps/abyss_rift.ts`, change line 30:
```typescript
// Before:
{ col: 6, row: 16, npcs: ['blacksmith_advanced', 'merchant_desert', 'stash', 'quest_warden'] },
// After:
{ col: 10, row: 16, npcs: ['blacksmith_advanced', 'merchant_desert', 'stash', 'quest_warden'] },
```

Note: `playerStart` is at `(3, 38)` which is far from the camp — no change needed.

- [ ] **Step 2: Commit**

```bash
git add src/data/maps/abyss_rift.ts
git commit -m "fix(camp): move abyss rift camp to (10,16) for 11x11 clearance"
```

---

### Task 4: Upgrade MapGenerator for 11x11 camps

**Files:**
- Modify: `src/systems/MapGenerator.ts:1-460`

- [ ] **Step 1: Add TILE_CAMP_WALL constant and import CampTheme**

At the top of `MapGenerator.ts`, after line 9 (`const TILE_CAMP = 5;`), add:
```typescript
const TILE_CAMP_WALL = 6;
```

- [ ] **Step 2: Create a helper function `isCampTile` for protection checks**

Add after the `clearArea` function (around line 200):
```typescript
/** Check if a tile is part of camp infrastructure (protected from overwrite) */
function isCampTile(tile: number): boolean {
  return tile === TILE_CAMP || tile === TILE_CAMP_WALL;
}
```

- [ ] **Step 3: Update `drunkWalk` to protect TILE_CAMP_WALL**

In `drunkWalk`, replace all `tiles[...] !== TILE_CAMP` checks with `!isCampTile(tiles[...])`:

Line 139: `if (tiles[row][col] !== TILE_CAMP)` → `if (!isCampTile(tiles[row][col]))`
Line 147: `if (tiles[adjacentRow][adjacentCol] !== TILE_CAMP)` → `if (!isCampTile(tiles[adjacentRow][adjacentCol]))`
Line 177: `if (tiles[toRow][toCol] !== TILE_CAMP)` → `if (!isCampTile(tiles[toRow][toCol]))`

- [ ] **Step 4: Replace 5x5 camp placement with 11x11 layout**

Replace the camp placement block (lines 338-352) with:
```typescript
// (c) Place camp tiles at camp positions (11x11 camp with walls on 3 sides)
for (const camp of map.camps) {
  const halfSize = 5; // 11x11 → extends 5 from center

  // Clear a 13x13 walkable area around camp center (buffer zone)
  clearArea(tiles, camp.col, camp.row, halfSize + 1, config.primaryTile, cols, rows);

  // Place camp ground tiles (full 11x11 area)
  for (let dr = -halfSize; dr <= halfSize; dr++) {
    for (let dc = -halfSize; dc <= halfSize; dc++) {
      const r = camp.row + dr;
      const c = camp.col + dc;
      if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
        tiles[r][c] = TILE_CAMP;
      }
    }
  }

  // Place palisade walls on top, left, and right edges
  for (let dc = -halfSize; dc <= halfSize; dc++) {
    const r = camp.row - halfSize;
    const c = camp.col + dc;
    // Leave 2-tile gate gap at north wall (dc === -1, dc === 0)
    if (dc === -1 || dc === 0) continue;
    if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
      tiles[r][c] = TILE_CAMP_WALL;
    }
  }
  // Left and right walls (exclude south row, which is the entrance)
  for (let dr = -halfSize; dr < halfSize - 1; dr++) {
    const r = camp.row + dr;
    // Left wall
    const cL = camp.col - halfSize;
    if (r > 0 && r < rows - 1 && cL > 0 && cL < cols - 1) {
      tiles[r][cL] = TILE_CAMP_WALL;
    }
    // Right wall
    const cR = camp.col + halfSize;
    if (r > 0 && r < rows - 1 && cR > 0 && cR < cols - 1) {
      tiles[r][cR] = TILE_CAMP_WALL;
    }
  }
}
```

- [ ] **Step 5: Update collision generation to block TILE_CAMP_WALL**

In the collisions block (line 436), change:
```typescript
// Before:
collisions[r][c] = tile !== TILE_WALL && tile !== TILE_WATER;
// After:
collisions[r][c] = tile !== TILE_WALL && tile !== TILE_WATER && tile !== TILE_CAMP_WALL;
```

- [ ] **Step 6: Update decoration placement to skip TILE_CAMP_WALL**

In the decorations block (line 444), change:
```typescript
// Before:
if (collisions[r][c] && tiles[r][c] !== TILE_CAMP && tiles[r][c] !== TILE_DIRT) {
// After:
if (collisions[r][c] && !isCampTile(tiles[r][c]) && tiles[r][c] !== TILE_DIRT) {
```

- [ ] **Step 7: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Verify with dev server**

Run: `npm run dev`
Open browser, start a game in Emerald Plains. Check that:
- Camp area is now 11x11 with walls visible on 3 sides
- North wall has a 2-tile gate opening
- South side is open
- Player can walk into camp but not through walls
- Monsters don't spawn inside camp

- [ ] **Step 9: Commit**

```bash
git add src/systems/MapGenerator.ts
git commit -m "feat(camp): upgrade to 11x11 layout with palisade walls"
```

---

## Chunk 2: SpriteGenerator Themed Tiles & Decorations

### Task 5: Add camp wall tile rendering to SpriteGenerator

**Files:**
- Modify: `src/graphics/SpriteGenerator.ts`

- [ ] **Step 1: Add camp wall to TERRAIN_COLORS and TILE_NAMES**

In `SpriteGenerator`, update the static arrays (around line 179-188):

Add to `TERRAIN_COLORS` array (index 6):
```typescript
'#4a3520', // 6 = camp_wall (default plains color, overridden by themed tiles)
```

Add to `TILE_NAMES` array:
```typescript
private static readonly TILE_NAMES = ['grass', 'dirt', 'stone', 'water', 'wall', 'camp', 'camp_wall'];
```

- [ ] **Step 2: Add `drawCampWall` method**

Add after `drawCamp` method (after line 583). This draws a themed 3D wall similar to `drawWall` but with configurable colors:

```typescript
private drawCampWall(ctx: CanvasRenderingContext2D, w: number, h: number,
  wallColor: string, wallDark: string, wallLight: string, wallTop: string): void {
  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, w, h);

  const wallH = h * 0.5;
  // Front face
  const fGrad = ctx.createLinearGradient(0, h / 2, 0, h);
  fGrad.addColorStop(0, wallLight); fGrad.addColorStop(1, wallDark);
  ctx.fillStyle = fGrad;
  ctx.beginPath();
  ctx.moveTo(0, h / 2); ctx.lineTo(w / 2, h);
  ctx.lineTo(w / 2, h - wallH); ctx.lineTo(0, h / 2 - wallH);
  ctx.closePath(); ctx.fill();

  // Right face
  const rGrad = ctx.createLinearGradient(w / 2, h / 2, w, h / 2);
  rGrad.addColorStop(0, wallLight); rGrad.addColorStop(1, wallColor);
  ctx.fillStyle = rGrad;
  ctx.beginPath();
  ctx.moveTo(w / 2, h); ctx.lineTo(w, h / 2);
  ctx.lineTo(w, h / 2 - wallH); ctx.lineTo(w / 2, h - wallH);
  ctx.closePath(); ctx.fill();

  // Top face
  ctx.fillStyle = wallTop;
  ctx.beginPath();
  ctx.moveTo(w / 2, h / 2 - wallH); ctx.lineTo(w, h / 2 - wallH);
  ctx.lineTo(w / 2, h - wallH); ctx.lineTo(0, h / 2 - wallH);
  ctx.closePath(); ctx.fill();

  // Vertical plank/brick lines
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < 4; i++) {
    const x = (w / 2) * (i / 4);
    ctx.beginPath();
    ctx.moveTo(x, h / 2 - wallH + (h / 2 - wallH) * 0);
    ctx.lineTo(x + w / 8, h / 2 + (h / 4) * (i / 4));
    ctx.stroke();
  }

  // Edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, h / 2 - wallH); ctx.lineTo(w / 2, h / 2 - wallH);
  ctx.lineTo(w, h / 2 - wallH);
  ctx.stroke();

  this.applyNoiseToRegion(ctx, 0, 0, w, h, 5);
}
```

- [ ] **Step 3: Add `drawCampGround` themed variant**

Add after `drawCampWall`:
```typescript
private drawCampGroundThemed(ctx: CanvasRenderingContext2D, w: number, h: number,
  groundColor: string): void {
  ctx.fillStyle = groundColor;
  ctx.fillRect(0, 0, w, h);

  this.applyNoiseToRegion(ctx, 0, 0, w, h, 6);

  // Plank lines
  const cx = w / 2, cy = h / 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.6;
  for (let i = -4; i <= 4; i++) {
    const ly = cy + i * h * 0.1;
    const inset = Math.abs(i) * w * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.4 + inset, ly);
    ctx.lineTo(cx + w * 0.4 - inset, ly);
    ctx.stroke();
  }

  // Subtle warm glow
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.4);
  glow.addColorStop(0, 'rgba(160,90,20,0.08)');
  glow.addColorStop(0.6, 'rgba(100,45,10,0.04)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}
```

- [ ] **Step 4: Generate themed camp tiles in `generateTiles()`**

Import `CAMP_THEMES` at top of file:
```typescript
import { CAMP_THEMES } from '../data/camp-themes';
```

Update `generateTiles()` to generate per-theme camp tiles:
```typescript
private generateTiles(): void {
  this.makeTile('tile_grass', this.drawGrass.bind(this));
  this.makeTile('tile_dirt', this.drawDirt.bind(this));
  this.makeTile('tile_stone', this.drawStone.bind(this));
  this.makeTile('tile_water', this.drawWater.bind(this));
  this.makeTile('tile_wall', this.drawWall.bind(this));
  this.makeTile('tile_camp', this.drawCamp.bind(this));
  // Default camp wall (uses plains theme)
  this.makeTile('tile_camp_wall', (ctx, w, h) => {
    const t = CAMP_THEMES.plains;
    this.drawCampWall(ctx, w, h, t.wallColor, t.wallDark, t.wallLight, t.wallTop);
  });
  // Per-theme camp tiles
  for (const [theme, t] of Object.entries(CAMP_THEMES)) {
    this.makeTile(`tile_camp_wall_${theme}`, (ctx, w, h) => {
      this.drawCampWall(ctx, w, h, t.wallColor, t.wallDark, t.wallLight, t.wallTop);
    });
    this.makeTile(`tile_camp_ground_${theme}`, (ctx, w, h) => {
      this.drawCampGroundThemed(ctx, w, h, t.groundColor);
    });
  }
}
```

- [ ] **Step 5: Add camp decoration sprite generation**

Add a new method `generateCampDecorations()` and call it from `generateAll()`:

```typescript
// In generateAll(), add this line AFTER the existing this.generateDecorations() call:
this.generateCampDecorations();
```

The method generates sprites for campfire, torch, tent, barrel, crate, banner, and well. Each is a small procedural canvas:

```typescript
private generateCampDecorations(): void {
  const s = TEXTURE_SCALE;

  // Campfire — 32x32 sprite
  this.makeSprite('camp_campfire', 32 * s, 32 * s, (ctx, w, h) => {
    // Stone ring
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.7, w * 0.35, h * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Logs
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(w * 0.25, h * 0.55, w * 0.5, h * 0.12);
    ctx.fillRect(w * 0.3, h * 0.5, w * 0.4, h * 0.1);
    // Fire base
    ctx.fillStyle = '#cc4400';
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.55);
    ctx.lineTo(w * 0.5, h * 0.15);
    ctx.lineTo(w * 0.7, h * 0.55);
    ctx.closePath();
    ctx.fill();
    // Fire bright center
    ctx.fillStyle = '#ffaa20';
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.5);
    ctx.lineTo(w * 0.5, h * 0.25);
    ctx.lineTo(w * 0.62, h * 0.5);
    ctx.closePath();
    ctx.fill();
  });

  // Torch — 16x24 sprite
  this.makeSprite('camp_torch', 16 * s, 24 * s, (ctx, w, h) => {
    // Pole
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(w * 0.4, h * 0.3, w * 0.2, h * 0.7);
    // Flame
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.moveTo(w * 0.25, h * 0.35);
    ctx.lineTo(w * 0.5, h * 0.0);
    ctx.lineTo(w * 0.75, h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.3);
    ctx.lineTo(w * 0.5, h * 0.1);
    ctx.lineTo(w * 0.65, h * 0.3);
    ctx.closePath();
    ctx.fill();
  });

  // Tent — 40x36 sprite
  this.makeSprite('camp_tent', 40 * s, 36 * s, (ctx, w, h) => {
    ctx.fillStyle = '#5a4a30';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w / 2, h * 0.1);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    // Flap
    ctx.fillStyle = '#4a3a20';
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h);
    ctx.lineTo(w / 2, h * 0.2);
    ctx.lineTo(w * 0.7, h);
    ctx.closePath();
    ctx.fill();
    // Pole tip
    ctx.fillStyle = '#6a5a3a';
    ctx.fillRect(w * 0.47, h * 0.05, w * 0.06, h * 0.15);
  });

  // Barrel — 16x20 sprite
  this.makeSprite('camp_barrel', 16 * s, 20 * s, (ctx, w, h) => {
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
    // Rings
    ctx.strokeStyle = '#6a5030';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.3);
    ctx.lineTo(w * 0.9, h * 0.3);
    ctx.moveTo(w * 0.1, h * 0.7);
    ctx.lineTo(w * 0.9, h * 0.7);
    ctx.stroke();
    // Top ellipse
    ctx.fillStyle = '#5a4030';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.1, w * 0.4, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Crate — 18x16 sprite
  this.makeSprite('camp_crate', 18 * s, 16 * s, (ctx, w, h) => {
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(w * 0.05, h * 0.1, w * 0.9, h * 0.85);
    // Cross planks
    ctx.strokeStyle = '#4a3a28';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.15); ctx.lineTo(w * 0.9, h * 0.9);
    ctx.moveTo(w * 0.9, h * 0.15); ctx.lineTo(w * 0.1, h * 0.9);
    ctx.stroke();
    // Top
    ctx.fillStyle = '#4a3a28';
    ctx.fillRect(w * 0.05, h * 0.05, w * 0.9, h * 0.12);
  });

  // Banner — 12x32 sprite
  this.makeSprite('camp_banner', 12 * s, 32 * s, (ctx, w, h) => {
    // Pole
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(w * 0.4, 0, w * 0.2, h);
    // Flag
    ctx.fillStyle = '#2a6a1a'; // Default green, tinted at render time
    ctx.beginPath();
    ctx.moveTo(w * 0.6, h * 0.05);
    ctx.lineTo(w, h * 0.15);
    ctx.lineTo(w * 0.85, h * 0.35);
    ctx.lineTo(w * 0.6, h * 0.3);
    ctx.closePath();
    ctx.fill();
  });

  // Well — 28x24 sprite
  this.makeSprite('camp_well', 28 * s, 24 * s, (ctx, w, h) => {
    // Base ring
    ctx.fillStyle = '#4a4a50';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.65, w * 0.45, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Inner dark
    ctx.fillStyle = '#0a0a10';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.6, w * 0.3, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Posts
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(w * 0.15, h * 0.2, w * 0.08, h * 0.5);
    ctx.fillRect(w * 0.77, h * 0.2, w * 0.08, h * 0.5);
    // Crossbar
    ctx.fillRect(w * 0.15, h * 0.2, w * 0.7, h * 0.06);
  });
}

private makeSprite(key: string, w: number, h: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): void {
  if (this.scene.textures.exists(key)) return;
  const [canvas, ctx] = this.createCanvas(w, h);
  drawFn(ctx, w, h);
  this.scene.textures.addCanvas(key, canvas);
}
```

- [ ] **Step 6: Verify build compiles and sprites generate**

Run: `npm run dev`
Open browser, check console for no texture errors. Camp tiles should now appear with themed walls.

- [ ] **Step 7: Commit**

```bash
git add src/graphics/SpriteGenerator.ts
git commit -m "feat(camp): add themed camp wall/ground tiles and decoration sprites"
```

---

## Chunk 3: ZoneScene Camp Rendering & Safe Zone

### Task 6: Update ZoneScene TILE_KEYS and camp tile rendering

**Files:**
- Modify: `src/scenes/ZoneScene.ts:29, 318-348`

- [ ] **Step 1: Add `tile_camp_wall` to TILE_KEYS**

Line 29:
```typescript
// Before:
const TILE_KEYS = ['tile_grass', 'tile_dirt', 'tile_stone', 'tile_water', 'tile_wall', 'tile_camp'];
// After:
const TILE_KEYS = ['tile_grass', 'tile_dirt', 'tile_stone', 'tile_water', 'tile_wall', 'tile_camp', 'tile_camp_wall'];
```

- [ ] **Step 2: Use themed camp tile keys in `updateVisibleTiles()`**

In `updateVisibleTiles()`, after the blended tile key resolution (around line 330-332), add themed tile override logic. Replace the tile key resolution block:

```typescript
// Determine the tile texture key
let tileKey: string;
if (needsBlend) {
  tileKey = SpriteGenerator.generateBlendedTile(this, tileType, [tr, tl, br, bl]);
} else if (tileType === 5 && this.mapData.theme) {
  // Themed camp ground
  tileKey = `tile_camp_ground_${this.mapData.theme}`;
  if (!this.textures.exists(tileKey)) tileKey = 'tile_camp';
} else if (tileType === 6 && this.mapData.theme) {
  // Themed camp wall
  tileKey = `tile_camp_wall_${this.mapData.theme}`;
  if (!this.textures.exists(tileKey)) tileKey = 'tile_camp_wall';
} else {
  tileKey = TILE_KEYS[tileType] || 'tile_grass';
}
```

- [ ] **Step 3: Remove the old yellow flag decoration for camp tiles**

Remove lines 337-340 (the `if (tileType === 5)` block that adds tiny yellow flags):
```typescript
// DELETE THIS:
if (tileType === 5) {
  const flag = this.add.rectangle(pos.x, pos.y - 12, 3, 10, 0xf1c40f);
  flag.setDepth(pos.y + 1);
}
```

- [ ] **Step 4: Verify build and check visual**

Run: `npm run dev`
Expected: Camps now have 3D palisade walls on 3 sides, themed ground tiles. No more yellow flags.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/ZoneScene.ts
git commit -m "feat(camp): render themed camp wall and ground tiles, remove yellow flags"
```

---

### Task 7: Add camp decoration rendering to ZoneScene

**Files:**
- Modify: `src/scenes/ZoneScene.ts`

- [ ] **Step 1: Add `campDecorSprites` map and `buildCampDecorations` method**

Add a new instance field after `decorSprites` (around line 48):
```typescript
private campDecorSprites: Map<string, Phaser.GameObjects.Image | Phaser.GameObjects.Container> = new Map();
private campDecorPositions: { col: number; row: number; type: string }[] = [];
```

Add method after `spawnNPCs()`:
```typescript
private buildCampDecorations(): void {
  this.campDecorPositions = [];
  for (const camp of this.mapData.camps) {
    const c = camp.col, r = camp.row;
    // Campfire at center
    this.campDecorPositions.push({ col: c, row: r, type: 'campfire' });
    // Well/waypoint 2 tiles north-east of center
    this.campDecorPositions.push({ col: c + 1, row: r - 1, type: 'well' });
    // Banners on walls
    this.campDecorPositions.push({ col: c - 1, row: r - 4, type: 'banner' });
    this.campDecorPositions.push({ col: c + 2, row: r - 4, type: 'banner' });
    // Tents in corners
    this.campDecorPositions.push({ col: c - 3, row: r - 2, type: 'tent' });
    this.campDecorPositions.push({ col: c + 3, row: r - 2, type: 'tent' });
    this.campDecorPositions.push({ col: c - 2, row: r + 2, type: 'tent' });
    this.campDecorPositions.push({ col: c + 2, row: r + 2, type: 'tent' });
    // Crates/barrels near NPCs (non-walkable — set collisions to false in MapGenerator)
    this.campDecorPositions.push({ col: c - 2, row: r, type: 'barrel' });
    this.campDecorPositions.push({ col: c + 2, row: r, type: 'crate' });
    this.campDecorPositions.push({ col: c - 3, row: r - 3, type: 'crate' });
    this.campDecorPositions.push({ col: c + 3, row: r - 3, type: 'barrel' });
    // Entrance banners (flanking the south entrance)
    this.campDecorPositions.push({ col: c - 5, row: r + 4, type: 'banner' });
    this.campDecorPositions.push({ col: c + 5, row: r + 4, type: 'banner' });
    // Entrance torches
    this.campDecorPositions.push({ col: c - 5, row: r + 4, type: 'camp_torch' });
    this.campDecorPositions.push({ col: c + 5, row: r + 4, type: 'camp_torch' });
    // Wall torches (every ~3 segments)
    this.campDecorPositions.push({ col: c - 5, row: r - 2, type: 'camp_torch' });
    this.campDecorPositions.push({ col: c - 5, row: r + 1, type: 'camp_torch' });
    this.campDecorPositions.push({ col: c + 5, row: r - 2, type: 'camp_torch' });
    this.campDecorPositions.push({ col: c + 5, row: r + 1, type: 'camp_torch' });
    this.campDecorPositions.push({ col: c - 2, row: r - 5, type: 'camp_torch' });
    this.campDecorPositions.push({ col: c + 3, row: r - 5, type: 'camp_torch' });
  }
}
```

- [ ] **Step 2: Call `buildCampDecorations()` in `create()` and mark barrel/crate collisions**

After `this.spawnNPCs();` (around line 138), add:
```typescript
this.buildCampDecorations();
// Mark barrel/crate positions as non-walkable
for (const decor of this.campDecorPositions) {
  if (decor.type === 'barrel' || decor.type === 'crate') {
    const r = Math.round(decor.row);
    const c = Math.round(decor.col);
    if (r >= 0 && r < this.mapData.rows && c >= 0 && c < this.mapData.cols) {
      this.mapData.collisions[r][c] = false;
    }
  }
}
```

- [ ] **Step 3: Render camp decorations in `updateVisibleTiles()`**

After the terrain decoration update (`this.updateVisibleDecorations()`), add camp decoration rendering. Add at the end of `updateVisibleTiles()`:

```typescript
// Update camp decorations visibility
this.updateCampDecorations();
```

Add the method:
```typescript
private updateCampDecorations(): void {
  const cam = this.cameras.main;
  const camCX = cam.scrollX + cam.width / 2 / cam.zoom;
  const camCY = cam.scrollY + cam.height / 2 / cam.zoom;
  const viewW = cam.width / cam.zoom / 2;
  const viewH = cam.height / cam.zoom / 2;
  const margin = TILE_WIDTH * 4;

  const visibleKeys = new Set<string>();

  for (const decor of this.campDecorPositions) {
    const pos = cartToIso(decor.col, decor.row);
    const dx = Math.abs(pos.x - camCX);
    const dy = Math.abs(pos.y - camCY);
    if (dx > viewW + margin || dy > viewH + margin) continue;

    const key = `camp_${decor.col}_${decor.row}_${decor.type}`;
    visibleKeys.add(key);

    if (this.campDecorSprites.has(key)) continue;

    const texKey = `camp_${decor.type}`;
    if (!this.textures.exists(texKey)) continue;

    const sprite = this.add.image(pos.x, pos.y - 16, texKey).setScale(1 / TEXTURE_SCALE);
    sprite.setDepth(pos.y + 10);
    this.campDecorSprites.set(key, sprite);

    // Add animations for torches and campfire
    if (decor.type === 'camp_torch' || decor.type === 'campfire') {
      this.tweens.add({
        targets: sprite,
        alpha: { from: 0.85, to: 1 },
        scaleX: { from: sprite.scaleX * 0.95, to: sprite.scaleX * 1.05 },
        scaleY: { from: sprite.scaleY * 0.95, to: sprite.scaleY * 1.05 },
        duration: 300 + Math.random() * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Add campfire glow
    if (decor.type === 'campfire') {
      const glow = this.add.circle(pos.x, pos.y, 60, 0xff8800, 0.08);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setDepth(pos.y + 5);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.06, to: 0.12 },
        scaleX: { from: 0.9, to: 1.1 },
        scaleY: { from: 0.9, to: 1.1 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Banner swaying
    if (decor.type === 'banner') {
      this.tweens.add({
        targets: sprite,
        angle: { from: -3, to: 3 },
        duration: 1500 + Math.random() * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // Remove out-of-view camp decorations
  for (const [key, sprite] of this.campDecorSprites) {
    if (!visibleKeys.has(key)) {
      sprite.destroy();
      this.campDecorSprites.delete(key);
    }
  }
}
```

- [ ] **Step 4: Clean up camp decorations on scene shutdown**

In the scene's `shutdown()` or `destroy()` handler, add:
```typescript
for (const sprite of this.campDecorSprites.values()) sprite.destroy();
this.campDecorSprites.clear();
```

- [ ] **Step 5: Verify visually**

Run: `npm run dev`
Expected: Campfire visible at center with flickering glow, torches along walls, tents in corners, barrels/crates near NPCs, banners swaying, well near center.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/ZoneScene.ts
git commit -m "feat(camp): render camp decorations with animations (campfire, torches, tents, barrels, banners, well)"
```

---

### Task 8: Add monster safe zone logic

**Files:**
- Modify: `src/scenes/ZoneScene.ts:262-266` (monster update loop)
- Modify: `src/scenes/ZoneScene.ts:988-1001` (spawnMonsters)
- Modify: `src/entities/Monster.ts:126-155` (patrol target rejection)

- [ ] **Step 1: Add safe zone check in monster update loop**

In `ZoneScene.update()`, replace the monster update block (lines 262-266):
```typescript
// Before:
for (const monster of this.monsters) {
  if (monster.isAlive()) {
    monster.update(time, delta, this.player.tileCol, this.player.tileRow, this.mapData.collisions);
  }
}

// After:
const safeRadius = this.mapData.safeZoneRadius ?? 9;
for (const monster of this.monsters) {
  if (!monster.isAlive()) continue;
  // Safe zone check: repel aggro monsters near camps, force retreat to spawn
  let monsterInSafe = false;
  for (const camp of this.campPositions) {
    if (euclideanDistance(monster.tileCol, monster.tileRow, camp.col, camp.row) < safeRadius) {
      monsterInSafe = true;
      break;
    }
  }
  if (monsterInSafe && monster.isAggro()) {
    monster.state = 'idle';
    // Don't skip update — let leash/idle logic move monster toward spawn
  }
  // Also check if player is inside safe zone — suppress aggro transitions
  let playerInSafe = false;
  for (const camp of this.campPositions) {
    if (euclideanDistance(this.player.tileCol, this.player.tileRow, camp.col, camp.row) < safeRadius) {
      playerInSafe = true;
      break;
    }
  }
  // Pass playerInSafe flag to monster so it won't aggro on protected players
  if (playerInSafe && !monster.isAggro()) {
    // Skip the update's aggro check by temporarily inflating the distance
    // Instead: just run update normally but monster won't see player in range
    // because we set monster state to idle if it tries to aggro
    monster.update(time, delta, -999, -999, this.mapData.collisions);
  } else {
    monster.update(time, delta, this.player.tileCol, this.player.tileRow, this.mapData.collisions);
  }
}
```

Note: `monster.state` is currently `public` (no accessor) and `isAggro()` already exists on `Monster`. `euclideanDistance` is already imported in `ZoneScene.ts`.

- [ ] **Step 2: Add safe zone spawn rejection in `spawnMonsters()`**

In `spawnMonsters()`, after the collision check (around line 996), add a camp proximity check:
```typescript
private spawnMonsters(): void {
  const monsterDefs = MonstersByZone[this.currentMapId] || [];
  const safeRadius = this.mapData.safeZoneRadius ?? 9;
  for (const spawn of this.mapData.spawns) {
    const def = monsterDefs.find(m => m.id === spawn.monsterId) || getMonsterDef(spawn.monsterId);
    if (!def) continue;
    for (let i = 0; i < spawn.count; i++) {
      const c = Math.max(1, Math.min(this.mapData.cols - 2, spawn.col + randomInt(-3, 3)));
      const r = Math.max(1, Math.min(this.mapData.rows - 2, spawn.row + randomInt(-3, 3)));
      if (!this.mapData.collisions[r][c]) continue;
      // Reject spawns inside camp safe zones
      let inSafeZone = false;
      for (const camp of this.campPositions) {
        if (euclideanDistance(c, r, camp.col, camp.row) < safeRadius) {
          inSafeZone = true;
          break;
        }
      }
      if (inSafeZone) continue;
      this.monsters.push(new Monster(this, def, c, r));
    }
  }
}
```

Note: No changes needed to `Monster.ts` itself. All safe zone logic is handled in `ZoneScene.update()`:
- Aggro monsters inside safe zone → reset to idle, let existing leash/idle logic handle retreat
- Player inside safe zone → pass fake coordinates (-999, -999) so no monster will see them in aggro range
- Patrol targets that land inside safe zone → handled naturally because monsters near camps will have their aggro suppressed, and their patrol radius (±2 from spawn) won't reach into camps since spawns are rejected from safe zones

- [ ] **Step 5: Verify safe zone works**

Run: `npm run dev`
Test in Emerald Plains:
- Walk to camp — monsters should stop chasing at the camp perimeter
- Monsters should not spawn inside the camp
- Monsters should not patrol into the camp

- [ ] **Step 6: Commit**

```bash
git add src/scenes/ZoneScene.ts src/entities/Monster.ts
git commit -m "feat(camp): add monster safe zone (aggro repel, spawn rejection, patrol avoidance)"
```

---

### Task 9: Update NPC placement for 11x11 layout

**Files:**
- Modify: `src/scenes/ZoneScene.ts:1003-1021` (spawnNPCs)

- [ ] **Step 1: Replace NPC offset table**

Replace the `spawnNPCs()` method:
```typescript
private spawnNPCs(): void {
  // NPC offsets for 11x11 camp — positions near tents
  const npcOffsets: { dc: number; dr: number }[] = [
    { dc: -3, dr: -2 },  // Upper-left tent — blacksmith
    { dc: 3, dr: -2 },   // Upper-right tent — merchant
    { dc: -3, dr: 2 },   // Lower-left tent — quest giver
    { dc: 3, dr: 2 },    // Lower-right tent — stash / extra
    { dc: 0, dr: -3 },   // Fallback: north center
    { dc: 0, dr: 3 },    // Fallback: south center
  ];
  for (const camp of this.mapData.camps) {
    camp.npcs.forEach((npcId, i) => {
      const def = NPCDefinitions[npcId];
      if (!def) return;
      const offset = npcOffsets[i % npcOffsets.length];
      const npc = new NPC(this, def, camp.col + offset.dc, camp.row + offset.dr);
      this.npcs.push(npc);
    });
  }
}
```

- [ ] **Step 2: Verify NPCs appear near tents**

Run: `npm run dev`
Expected: NPCs spread across the camp near tent positions, not clustered together.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/ZoneScene.ts
git commit -m "feat(camp): update NPC placement for 11x11 camp layout"
```

---

### Task 10: Final integration test

- [ ] **Step 1: Test all 5 zones**

Run: `npm run dev`
For each zone (Emerald Plains, Twilight Forest, Anvil Mountains, Scorching Desert, Abyss Rift):
- Verify camp has themed walls (different colors per zone)
- Verify camp has all decorations (campfire, torches, tents, barrels, banners, well)
- Verify monsters cannot enter camp
- Verify NPCs are accessible and interactable
- Verify player can walk in/out freely through the south entrance
- Verify campfire has glow and flicker animation

- [ ] **Step 2: Test respawn**

Die to a monster, verify player respawns at camp center.

- [ ] **Step 3: Test save/load**

Save game, reload page, load save. Verify camp renders correctly after load.

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 5: Final commit**

If any fixes were needed during testing, commit them:
```bash
git add -A
git commit -m "fix(camp): integration fixes from testing"
```
