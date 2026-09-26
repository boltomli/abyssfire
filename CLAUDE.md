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

### Combat Feel (hit timing & feedback)
- Damage lands on the animation's **contact beat**, not at input time: `CharacterAnimator.playAttack()` / `playCast()` return the ms until the blow connects / the spell releases (derived from the sheet's attack frames via `AnimConfig.attackContact`), and `ZoneScene` resolves the hit in a `time.delayedCall`. Projectile skills and ranged monsters apply damage on arrival (`SkillEffectSystem.getProjectileTravelMs`).
- `src/systems/HitFeedback.ts` classifies every hit (`tick`/`light`/`normal`/`heavy`/`crit`/`kill`) and `HIT_PROFILES` drives hit-stop, white flash, recoil, shake and the `VFXManager.impactBurst` — tune feel there, not per call site.
- `Monster.takeDamage(amount, fromX, fromY, { isCrit, isTick })` plays the target-side reaction and returns the weight; pass `isTick` for DoTs.
- Generated sprite sheets wrap into a grid ≤ 4096px (`computeSheetGrid`) — never emit a single-row strip wider than that.

### Quests
- Data: `src/data/quests/all_quests.ts`; the giver is whichever NPC lists the quest in `npcs.ts` (exactly one, standing in the quest's zone — enforced by `QuestContent.test.ts`, which also checks every kill/talk/collect target exists there).
- Collect / craft_collect objectives need a `source`: `drop` (specific monsters + chance) or `gather` (an area + node count; spots are resolved deterministically on walkable tiles). `itemKind` picks the icon from `src/graphics/icons/QuestItemIcons.ts`.
- `QuestWorld` (created by `ZoneScene`) owns gather nodes, quest-item pickups and the guide arrow; `QuestGuide.computeGuideTarget` decides where the arrow points (tracked quest → nearest target of its first unfinished objective, or the giver once complete).
- Turn-in goes through `ZoneScene.turnInQuest(id, choiceIndex)`; `rewards.choices` generates class-appropriate pick-one gear (`QuestRewards.ts`).
- NPC lines per quest live in `src/i18n/locales/questStory.ts` (`data.quest.<id>.offer` / `.complete`).

### Story
- Story bible: `docs/story.md`. Script data: `src/data/story/script.ts` (prologue/epilogue/credits sequences, chapter cards, cutscenes, boss intros, triggers) typed by `src/data/story/types.ts`; all text is i18n keys in `src/i18n/locales/story.ts`.
- `StoryDirector` (created by `ZoneScene`) queues beats — prologue on a new game, a chapter card on each zone's first visit, cutscenes on main-quest turn-ins / the final boss kill, boss intros when a named boss comes within 9 tiles, then epilogue + credits — and freezes the world while one plays (`cinematic`). `StoryScene` renders them (letterbox, portraits, whispers, title cards). Seen beats persist in the save (`storySeen`).
- `StoryScript.test.ts` checks every key exists in zh-CN and en, every trigger/boss intro resolves, and cutscene speakers stand in the zone where the cutscene plays.

### Loot System (D2-style)
Quality tiers: Normal (white) -> Magic (blue, 1-2 affixes) -> Rare (yellow, 3-4) -> Legendary (orange, fixed) -> Set (green). Affixes have tiers 1-5 scaling with zone difficulty.

## Key Conventions

- **Language**: TypeScript strict mode, no `any` unless interfacing with Phaser internals
- **Naming**: PascalCase for classes/types, camelCase for variables/functions, UPPER_SNAKE for constants
- **Imports**: Phaser types imported explicitly, local imports use relative paths
- **UI text**: Chinese (Simplified) for all player-facing strings
- **Tests**: Vitest (`npm test`); tests live in `src/__tests__/`. Run them plus `npx tsc --noEmit` before pushing
- **Phaser patterns**: Use `this.add.*` for game objects, `this.tweens` for animations, `this.time` for timers

## Current State

### Implemented
- 3 playable classes (Warrior, Mage, Rogue) with skill trees; mercenaries, pets, spirit system
- 5 zones with progression (Emerald Plains -> Abyss Rift); maps are hand-authored grids enhanced by `MapGenerator` at load
- Sub-dungeons (`DungeonSystem`), random events, weather, lighting
- Real-time combat with auto-battle toggle, contact-frame hit timing and weighted hit feedback (see Combat Feel)
- Elite monster affixes (`EliteAffixSystem`), difficulty modes (`DifficultySystem`)
- D2-style loot with affixes, identify scrolls, gem sockets, buyback
- Equipment (10 slots), inventory, stash panel (stash keeper NPC; homestead warehouse adds slots)
- Quest system with tracking; NPC shops, dialogue trees, quests
- Fog of war, minimap, homestead (buildings, pets), achievements
- Save/load via IndexedDB; audio (BGM + SFX); zh-CN / en localisation (`t()`)
- Keyboard controls (WASD, 1-6 skills, I/K/M/H/C panels) and mobile touch controls
- Art: all characters, monsters and NPCs are procedural cel-shaded rigs (`src/graphics/sprites/rig/`);
  zone-themed terrain (`src/graphics/terrain/`), props, pooled skill VFX (`src/graphics/vfx/`),
  item/skill icons (`src/graphics/icons/`) and the UI kit (`src/ui/UiKit.ts`) follow
  `docs/art-direction.md`. External PNGs in `public/assets/` still override any texture key.

### Needs Work
- **Random dungeons**: Zone 6 (endgame roguelike) not started
- **Death penalty**: Corpse run / gold loss not implemented
- **Crafting**: Blacksmith crafting beyond buy/sell
- **Performance**: first entry to a zone draws its monster/NPC sheets (~1 s on a software
  renderer). Sheets are drawn at `TEXTURE_SCALE` 2 (camera zoom is 1.8, so that is ≥ 1 texel per
  screen pixel) and survive `SpriteGenerator.sheetKeepZones` zone changes (2 on desktop, 1 on
  touch), so walking back to a recent zone is ~0.15 s

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
