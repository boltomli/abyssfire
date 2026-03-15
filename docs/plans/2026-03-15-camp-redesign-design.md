# Camp Redesign: Diablo II-Style Encampments

## Summary

Upgrade camps from bare 5x5 floor tiles to immersive Diablo II-style encampments with palisade walls, campfire, decorations, zone-themed visuals, and a safe zone that prevents monsters from entering.

## Decisions

- **Boundary**: Hybrid — palisade walls on 3 sides + open entrance + safe zone radius
- **Size**: 11x11 tile footprint (9x9 interior inside walls)
- **Interior elements**: Campfire, wall torches, tents, barrels/crates, banners, well/waypoint
- **Zone theming**: Each zone gets unique wall material, ground tint, and accent colors
- **Camp size is parametric**: Larger camps possible on larger maps in the future

## Camp Layout

```
  W W W W G G W W W W W
  W . . . . . . . . . W
  W . T . . . . . T . W
  W . . . . . . . . . W
  W . . . B . P . . . W
  W . C . . F . . C . W
  W . . . . . . . . . W
  W . . T . . . T . . W
  W . . . . . . . . . W
  t . . . . . . . . . t
  . . . . . . . . . . .

  W = wall tile (non-walkable, collisions[r][c] = false)
  F = campfire (center)
  T = tent (decoration, walkable)
  B = banner (decoration, walkable)
  C = crates/barrels (non-walkable)
  P = well/waypoint (decoration, walkable)
  G = gate opening (2 tiles wide, walkable)
  . = camp ground tile (walkable)
  t = entrance torches (decoration, walkable)
```

Walls occupy the outer ring on top, left, and right sides. The south side is fully open as the entrance, flanked by torches. The north wall has a 2-tile gap as a decorative gate.

## Camp Boundary & Monster Safe Zone

### Walls
- Wall tiles placed on the outer ring of the 11x11 area (top, left, right sides)
- South side open — no wall tiles, just entrance torches
- North wall has a 2-tile gap (decorative gate)
- Camp walls use a new tile type `TILE_CAMP_WALL = 6` to distinguish from terrain walls (`TILE_WALL = 4`)
  - `collisions[r][c] = false` for camp walls (non-walkable, blocks movement)
  - Rendered with zone-themed 3D elevated tile style (like `TILE_WALL` but with themed colors)
  - Requires adding to `TileData.type` union, `TILE_KEYS` array, and `SpriteGenerator`
  - `drunkWalk` and all post-generation passes must protect `TILE_CAMP_WALL` tiles from overwrite, same as `TILE_CAMP` (update all `tiles[r][c] !== TILE_CAMP` guards to also check `!== TILE_CAMP_WALL`)
- Camp interior floor uses existing `TILE_CAMP = 5`, with zone-themed coloring

### Safe Zone
- Radius: 9 tiles from camp center (euclidean distance)
  - Camp corners are ~7.07 tiles from center; radius 9 gives ~4 tiles of coverage beyond the south entrance
  - Enough to prevent monsters from aggroing at the doorstep
- `safeZoneRadius` is stored per-map on `MapData` (default: 9). Allows future per-zone tuning.
- Monster behavior when inside safe zone:
  - If in `chase` or `attack` state: immediately set to `idle`, move toward spawn
  - If in `idle` or `patrol` state: patrol target generation rejects tiles inside any safe zone
- Spawn rejection: `spawnMonsters()` skips any spawn tile within a camp's safe zone radius
- Safe zone check lives in `ZoneScene.updateMonsters()`, before calling `monster.update()`:
  - `ZoneScene` checks each monster's distance to all camp centers
  - If inside safe zone and monster is aggro: reset monster state to `idle`
  - This avoids changing `Monster` constructor signature — `Monster` does not need to know about camps
  - `this.campPositions` already exists on `ZoneScene` (set in `init()` from `mapData.camps`)

### Edge Cases
- Leashing monsters pass through safe zone briefly to reach spawn — acceptable
- Multiple camps: check distance to all camp centers (max 2-3 per zone currently)

## Interior Elements

### Campfire (center tile)
- Procedurally generated sprite at exact camp center
- Animated flame: orange/yellow particle tweens (Phaser particles or tween-based)
- Radial glow overlay: additive blend circle, gentle pulse tween
- Player respawn point (existing `respawnAtCamp` already uses camp center)

### Wall Torches (on wall tiles)
- One torch every 2-3 wall segments
- Smaller flame than campfire
- Each casts a small warm glow circle
- Subtle random flicker tween on alpha/scale

### Tents (corners, along walls)
- 2-3 per camp, placed in corners or along wall interiors
- Procedurally drawn as triangular/pitched shapes
- Non-collidable decoration

### Barrels & Crates (near walls and NPCs)
- 3-5 clusters per camp
- Small rectangular sprites, stacked groups of 1-3
- Collidable (non-walkable) for pathing interest
- Placed near walls and NPC positions

### Banners (entrance + walls)
- 2 flanking the entrance, 1-2 on walls
- Colored per zone theme
- Subtle swaying tween animation on rotation

### Well / Waypoint (near center)
- Placed 2 tiles from campfire
- Stone circle sprite
- Non-functional for now — positioned for future fast-travel

### Placement Strategy
- All positions computed relative to camp center by `MapGenerator`
- Deterministic layout template per camp size — no random scatter
- Elements have fixed logical positions so camps feel designed
- Camp decorations are computed at runtime by `ZoneScene` from camp center positions, NOT stored in `MapData.decorations`
  - `ZoneScene` has a new method `buildCampDecorations(camp)` that returns an array of `{ col, row, type }` for each camp
  - Decoration types: `'campfire'`, `'camp_torch'`, `'tent'`, `'barrel'`, `'crate'`, `'banner'`, `'well'`
  - These are rendered in `updateVisibleTiles()` alongside tile rendering, with dedicated sprite creation per type
  - Separate from terrain decorations (trees, rocks) which remain in `MapData.decorations`

### NPC Placement (11x11 layout)

NPCs are positioned near tents using a fixed offset table relative to camp center. The table supports up to 4 NPCs per camp (matching the max in current map data):

| NPC Index | Offset (dc, dr) | Tent Location | Role (typical) |
|-----------|-----------------|---------------|----------------|
| 0 | (-3, -2) | Upper-left tent | Blacksmith |
| 1 | (+3, -2) | Upper-right tent | Merchant |
| 2 | (-3, +2) | Lower-left tent | Quest giver |
| 3 | (+3, +2) | Lower-right tent | Stash / Extra |

If a camp has fewer NPCs, only the first N offsets are used. If more than 4 (unlikely), extras use fallback offsets along the walls: `(0, -3)`, `(0, +3)`.

This replaces the current `npcOffsets` array in `ZoneScene.spawnNPCs()`.

## Zone-Themed Camp Variants

| Zone | Theme | Walls | Ground | Accents |
|------|-------|-------|--------|---------|
| Emerald Plains | `plains` | Wooden palisade (brown) | Warm wood planks | Green/gold banners |
| Twilight Forest | `forest` | Dark wood with moss tint | Mossy stone floor | Purple/silver banners |
| Anvil Mountains | `mountain` | Stone walls (grey) | Cobblestone floor | Red/iron banners |
| Scorching Desert | `desert` | Sandstone + cloth canopies | Sandy tile | Orange/copper banners |
| Abyss Rift | `abyss` | Dark obsidian/corrupted stone | Cracked dark stone | Crimson/black banners |

### Implementation
- `CampTheme` config object per `MapTheme`
- Defines: wall color, ground color, banner tint, torch flame color, tent fabric color
- `SpriteGenerator` uses these when generating camp tiles and decoration sprites
- `drawCamp()` splits into `drawCampGround(theme)` and `drawCampWall(theme)`
- Each zone generates themed tile textures at boot: `tile_camp_wall_plains`, `tile_camp_ground_plains`, etc.

## Map Data Fixes

The 11x11 camp footprint requires 5 tiles clearance from center to border. All camp centers must satisfy: `col >= 6 && col <= 73 && row >= 6 && row <= 73` (on 80x80 maps).

**Abyss Rift primary camp** at `(col: 6, row: 16)` fails — left edge would be at col 1 (border wall). Fix: move to `(col: 10, row: 16)`. Update `playerStart` accordingly if it references the old position.

All other camp positions have sufficient clearance:
- Emerald Plains: (12,12), (64,68) — OK
- Twilight Forest: (13,35), (70,67), (66,42) — OK
- Anvil Mountains: (10,32), (58,67) — OK
- Scorching Desert: (10,10), (64,64) — OK
- Abyss Rift: (58,67) — OK

## Files Changed

### Modified
- **`src/systems/MapGenerator.ts`** — expanded camp placement: 11x11 layout with `TILE_CAMP_WALL` (6) for walls, `TILE_CAMP` (5) for ground, themed tiles. Add `TILE_CAMP_WALL = 6` constant. Update collision generation to treat `TILE_CAMP_WALL` as non-walkable.
- **`src/entities/Monster.ts`** — patrol target generation rejects tiles inside any safe zone radius (passed via `update()` params or checked externally)
- **`src/scenes/ZoneScene.ts`** — safe zone check in monster update loop, `buildCampDecorations()` method, render camp decorations (campfire particles/glow, torches, tents, crates, banners, well), spawn rejection in `spawnMonsters()`, updated NPC offset table in `spawnNPCs()`. Add `'tile_camp_wall'` to `TILE_KEYS`.
- **`src/graphics/SpriteGenerator.ts`** — `drawCampWall(theme)`, `drawCampGround(theme)`, decoration sprite generators (torch, tent, barrel, crate, banner, well, campfire). Add camp wall to `TILE_BASE_COLORS` and `TILE_NAMES`.
- **`src/data/types.ts`** — add `CampTheme` interface, add `safeZoneRadius?: number` to `MapData`, add `'camp_wall'` to `TileData.type` union
- **`src/data/maps/abyss_rift.ts`** — move primary camp from (6,16) to (10,16)

### New
- **`src/data/camp-themes.ts`** — `CampTheme` configs keyed by `MapTheme`

### Not Changed
- `Player.ts` — `respawnAtCamp()` already works with camp center coordinates
- `NPC.ts` — NPC placement is driven by `ZoneScene.spawnNPCs()`, not NPC itself
- `UIScene.ts` — no camp-related UI changes
- `CombatSystem.ts` — combat doesn't need to know about safe zones
