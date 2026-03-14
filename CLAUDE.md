# Abyssfire (渊火)

Isometric ARPG web game with DnD-style world, Diablo II loot system, real-time auto-combat. Built with Phaser 3, TypeScript, Vite. Runs entirely in the browser — no server.

## Quick Start

```bash
npm install
npm run dev      # dev server at localhost:5173
npm run build    # production build to dist/
```

Deployed to GitHub Pages via `.github/workflows/deploy.yml` — push to `main` auto-deploys.

## Tech Stack

- **Engine**: Phaser 3 (v3.80+), TypeScript, Vite
- **Storage**: IndexedDB via Dexie.js (saves, stash)
- **State**: Custom EventBus pub/sub + direct references
- **Art**: Procedurally generated sprites with external asset override (cartoon-style PNG fallback)
- **Resolution**: 1280x720, isometric tiles 64x32

## Project Structure

```
src/
  main.ts              # Phaser Game bootstrap
  config.ts            # Game constants (tile size, resolution)
  scenes/
    BootScene.ts       # Asset loading + procedural texture generation
    MenuScene.ts       # Title screen, class selection, save slots
    ZoneScene.ts       # Main game scene (map, entities, combat loop)
    UIScene.ts         # HUD overlay (HP/MP bars, skill bar, panels)
  entities/
    Player.ts          # Player state, stats, movement, class data
    Monster.ts         # Monster entity, AI, aggro, drops
    NPC.ts             # Non-player characters (shops, quests, dialogue)
  systems/
    CombatSystem.ts    # Damage calc, auto-attack, skill execution
    LootSystem.ts      # Item generation, affixes, quality tiers (D2-style)
    InventorySystem.ts # Equipment, inventory grid, stat bonuses
    QuestSystem.ts     # Quest tracking, objectives, rewards
    PathfindingSystem.ts # A* pathfinding on isometric grid
    FogOfWarSystem.ts  # Vision radius, explored/unexplored state
    MapGenerator.ts    # Procedural map generation (BSP + cellular automata)
    HomesteadSystem.ts # Player housing, buildings, pets
    SaveSystem.ts      # IndexedDB persistence via Dexie
    AudioSystem.ts     # BGM + SFX (Web Audio API)
    AchievementSystem.ts # Achievement tracking
    SkillEffectSystem.ts # Skill VFX (particles, tweens, screen shake)
  data/
    classes/           # Warrior, Mage, Rogue definitions
    items/             # Item bases, affixes, legendaries, sets
    maps/              # Zone map data (tile grids, spawns, exits, NPCs)
    monsters/          # Monster definitions per zone
    quests/            # Quest definitions
    skills/            # Skill trees per class
    types.ts           # Shared type definitions
  utils/
    EventBus.ts        # Typed event system (GameEvents enum)
    IsometricUtils.ts  # Screen <-> tile coordinate conversion
    MathUtils.ts       # Distance, random, clamping helpers
  ui/                  # (future) extracted UI components
docs/
  game-design.md       # Full game design document
public/                # Static assets served by Vite
  assets/              # External art assets (tiles, sprites)
```

## Architecture Patterns

### Scene Flow
`BootScene` (load assets + generate textures) -> `MenuScene` (class select / load save) -> `ZoneScene` + `UIScene` (gameplay). `UIScene` runs as a parallel overlay scene on top of `ZoneScene`.

### Entity System
Not a formal ECS. Entities (`Player`, `Monster`, `NPC`) are Phaser GameObjects managed by `ZoneScene`. Systems operate on entities directly.

### EventBus
Central pub/sub for decoupled communication. Events defined in `GameEvents` enum (`src/utils/EventBus.ts`). Used for: combat log, UI updates, skill clicks, shop/dialogue triggers, zone transitions.

### Asset Pipeline
1. `BootScene.preload()` attempts to load external PNGs from `assets/` directories
2. `loaderror` handler silently catches missing files
3. `BootScene.create()` generates procedural textures for any key that doesn't exist yet
4. Result: external art is used when present, procedural fallback otherwise

### Map Data
Each zone (`src/data/maps/`) defines: tile grid, spawn points, NPC positions, exits, decorations. `MapGenerator` can procedurally enhance maps. Tiles: 0=grass, 1=dirt, 2=stone, 3=water, 4=wall, 5=camp.

### Loot System (D2-style)
Quality tiers: Normal (white) -> Magic (blue, 1-2 affixes) -> Rare (yellow, 3-4) -> Legendary (orange, fixed) -> Set (green). Affixes have tiers 1-5 scaling with zone difficulty.

## Key Conventions

- **Language**: TypeScript strict mode, no `any` unless interfacing with Phaser internals
- **Naming**: PascalCase for classes/types, camelCase for variables/functions, UPPER_SNAKE for constants
- **Imports**: Phaser types imported explicitly, local imports use relative paths
- **UI text**: Chinese (Simplified) for all player-facing strings
- **No tests yet**: The project has no test framework set up
- **Phaser patterns**: Use `this.add.*` for game objects, `this.tweens` for animations, `this.time` for timers

## Current State

### Implemented
- 3 playable classes (Warrior, Mage, Rogue) with skill trees
- 5 zones with progression (Emerald Plains -> Abyss Rift)
- Real-time combat with auto-battle toggle
- D2-style loot generation with affixes
- Equipment system (10 slots)
- Quest system with tracking
- NPC interaction (shops, dialogue, quests)
- Fog of war with exploration memory
- Minimap
- Homestead system (buildings, pets)
- Save/load via IndexedDB
- Procedural sprite generation with external asset override
- Audio system (BGM + SFX)
- Skill VFX system
- Keyboard controls (WASD, 1-6 skills, I/K/M/H/C panels)

### Needs Work
- **Mobile controls**: Virtual joystick + touch skill buttons not implemented
- **Procedural map generation**: `MapGenerator.ts` exists but maps are still hand-authored grids
- **Random dungeons**: Zone 6 (endgame roguelike) not started
- **Death penalty**: Corpse run / gold loss not implemented
- **Elite monsters**: Random affix system for enhanced spawns
- **Difficulty modes**: Nightmare/Hell post-clear not implemented
- **Item identify**: Scroll of Identify mechanic not wired up
- **Gem socketing**: System not implemented
- **Crafting**: Blacksmith crafting beyond buy/sell
- **Achievements**: `AchievementSystem.ts` exists, needs integration
- **External art assets**: No actual PNG assets in `public/assets/` yet
- **Performance**: Large maps may need chunk-based rendering optimization

## Parallel Agent Guidelines

When multiple agents work simultaneously:

1. **Claim your files**: Each agent should work on distinct files/systems. Avoid editing the same file.
2. **System boundaries**: Systems are loosely coupled via EventBus — safe to develop independently.
3. **Safe to parallelize**:
   - New monster/item/quest data files (additive, no conflicts)
   - New systems (e.g., crafting, achievements) that emit/listen on EventBus
   - UI panels (self-contained in UIScene methods)
   - Art assets (just drop PNGs in the right directory)
4. **Requires coordination**:
   - `ZoneScene.ts` — central game loop, many systems touch it
   - `Player.ts` — adding new stats or abilities affects combat formulas
   - `types.ts` — shared types, changes ripple
5. **Integration pattern**: New systems should export a class, instantiate in `ZoneScene`, and communicate via `EventBus.emit()` / `EventBus.on()`.
