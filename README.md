# Abyssfire (渊火)

Isometric ARPG web game with a DnD-inspired world, Diablo II-style loot system, and real-time auto-combat. Runs entirely in the browser — no server required.

**[Play Now](https://feuvan.github.io/abyssfire/)**

## Quick Start

```bash
npm install
npm run dev      # dev server at localhost:5173
npm run build    # production build to dist/
npm test         # run 2,587 unit tests
```

Deployed to GitHub Pages via `.github/workflows/deploy.yml` — push to `main` auto-deploys.

## Features

### Classes & Combat
- **3 Playable Classes** — Warrior, Mage, Rogue, each with 15 unique skills and full skill trees
- **Real-time Combat** — Manual control or auto-battle with skill priority configuration
- **Status Effects** — Burn, Freeze, Poison, Bleed, Slow, Stun with visual indicators
- **Elite Monsters** — Random affix system (Fire Enhanced, Swift, Teleporting, etc.) with better drops

### World & Exploration
- **5 Zones** — Progress from Emerald Plains to the Abyss Rift (Lv.1–50) on large 120×120 tile maps
- **Random Dungeons** — Procedural roguelike floors with scaling difficulty, bosses, and exclusive loot
- **Fog of War** — Explore and uncover the map as you go
- **Random Events** — Ambushes, treasure caches, wandering merchants, rescue missions, environmental puzzles
- **Mini-bosses & Lore** — Zone-specific boss encounters with pre-fight dialogue and collectible lore objects

### Loot & Progression
- **Diablo II Loot** — Normal / Magic / Rare / Legendary / Set items with random affixes
- **Gem Socketing** — 4 gem types × 3 tiers, insertable into equipment sockets
- **Difficulty Modes** — Normal → Nightmare → Hell with scaling monster stats and rewards
- **Achievements** — 12+ trackable achievements with progress bars and stat rewards

### Companions
- **Mercenaries** — 5 hireable types (tank, melee DPS, ranged, healer, mage) with their own stats, equipment, and combat AI
- **Pets** — Visual followers with feeding, leveling, evolution, and combat participation; acquired from boss drops, quests, and rare spawns

### Story & NPCs
- **Branching Dialogue** — NPC dialogue trees with player choices and outcomes
- **Quest Variety** — Kill, collect, escort, defend, investigate, and craft-and-deliver quest types
- **Homestead** — Build structures, upgrade buildings, manage pets and mercenaries

### Infrastructure
- **Persistent Saves** — IndexedDB via Dexie.js with multiple save slots and v1→v2 migration
- **Procedural Sprites** — All entity art generated via Canvas 2D, with external PNG override support
- **Audio** — Synthesized BGM and SFX via Web Audio API
- **A\* Pathfinding** — Binary heap-optimized for large maps

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Engine | Phaser 3 (v3.80+), TypeScript strict mode |
| Bundler | Vite |
| Storage | IndexedDB (Dexie.js) |
| Testing | Vitest (2,587 tests across 33 test suites) |
| Art | Procedural Canvas 2D generation with per-zone palettes |
| Resolution | 1280×720, isometric tiles 64×32 |

## Controls

| Key | Action |
|-----|--------|
| `WASD` / Arrow Keys | Move |
| Left Click | Move / attack / interact |
| Right Click / `R` | Return to camp |
| `1-6` | Use skills |
| `TAB` | Toggle auto-combat |
| `I` | Inventory |
| `C` | Character stats |
| `K` | Skill tree |
| `J` | Quest log |
| `M` | Map |
| `H` | Homestead |
| `P` | Companions |
| `V` | Achievements |
| `O` | Audio settings |
| `ESC` | Return to main menu |

## Project Structure

```
src/
  scenes/         # BootScene, MenuScene, ZoneScene, UIScene
  entities/       # Player, Monster, NPC
  systems/        # Combat, Loot, Inventory, Quest, Pathfinding,
                  # FogOfWar, MapGenerator, Homestead, Save, Audio,
                  # Achievement, SkillEffect, Mercenary, Pet,
                  # RandomEvent, Difficulty, GemSocket, Dungeon
  data/           # Classes, items, maps, monsters, quests, skills,
                  # mini-bosses, lore, dialogue trees, random events
  utils/          # EventBus, IsometricUtils, MathUtils
  __tests__/      # 33 test suites (Vitest)
docs/             # Game design document
public/assets/    # External art and audio assets
```

## Credits

- **Tile Art** — [Isometric Landscape](https://kenney.nl/) by Kenney (CC0) · [License](public/assets/tiles/LICENSE-kenney-CC0.txt)
- **BGM** — Various artists from [OpenGameArt.org](https://opengameart.org/) (CC0 / GPL) · [Full credits](public/assets/audio/bgm/CREDITS.md)

## License

All rights reserved.
