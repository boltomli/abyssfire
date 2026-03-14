# Lootborn Game Design Document

Cartoon-style isometric MUD web game. DnD-inspired world, Diablo II-style loot and classes, real-time auto-combat with manual skill override.

## Tech Stack

- **Engine**: Phaser 3 (v3.87+) / Phaser 4 (upgrade when stable), TypeScript, Vite
- **Storage**: IndexedDB (Dexie.js)
- **State**: Custom EventBus + Store pattern
- **UI**: Phaser DOM + HTML/CSS overlay for complex panels
- **Art style**: Stylized cartoon (non-pixel), hand-painted / pre-rendered isometric assets
- **Art sources**: OpenGameArt.org (CC0), Kenney (CC0), itch.io free packs
- **Tile size**: 128x64 or 256x128 isometric (larger tiles suit cartoon detail)

### Framework Decision — Why Phaser (not Cocos/Pixi/etc.)

| | Phaser 3/4 | Cocos Creator | PixiJS | Excalibur.js |
|---|---|---|---|---|
| Type | Full game framework | Full engine + editor | Rendering library | TS game engine |
| Bundle | ~500 KB | ~1-2 MB | ~200 KB | ~300 KB |
| Isometric | Native tilemap (v3.50+) | TMX support | Manual only | Built-in IsometricMap |
| Physics | Arcade / Matter.js | Built-in | None | Built-in |
| Community | Largest (EN) | Smaller (EN), strong in CN | Large | Small (~2k stars) |
| Editor | Code-only | Visual scene/UI editor | Code-only | Code-only |
| Web focus | Primary | Secondary (multi-platform) | Primary | Primary |

**Decision: Stay with Phaser.** Reasons:
1. Project already built on Phaser 3 — migration cost outweighs any benefit
2. Phaser 4 is in RC phase (same API as v3, drop-in upgrade), adds WebGPU-ready "Beam" renderer
3. Native isometric tilemap support, largest English ecosystem
4. Art style is an asset concern, not a framework concern — Phaser renders cartoon sprites identically to pixel sprites
5. Cocos Creator's strengths (visual editor, WeChat mini-games, native mobile) are not relevant here
6. PixiJS would require building all game systems from scratch for no rendering gain

## World — Lootborn (掠生大陆)

Ancient seals shattered, darkness pours from the Abyss. Player awakens as a chosen hero.

**Races** (affect starting stats): Human / Elf / Dwarf / Half-Orc

### Zones (difficulty progression)

| # | Zone | Theme | Level |
|---|------|-------|-------|
| 1 | Emerald Plains (翡翠平原) | Goblins, slimes | 1-10 |
| 2 | Twilight Forest (暮色森林) | Undead, werewolves | 10-20 |
| 3 | Anvil Mountains (铁砧山脉) | Dwarven ruins, gargoyles | 20-30 |
| 4 | Scorching Desert (灼热荒漠) | Fire elementals, sandworms | 30-40 |
| 5 | Abyss Rift (深渊裂谷) | Demons, final bosses | 40-50 |
| 6 | Random Dungeons | Roguelike (future) | Endgame |

## Classes

### Attributes

| Attr | Effect |
|------|--------|
| STR | Physical damage, carry weight |
| DEX | Dodge, crit rate, attack speed |
| VIT | HP, physical resistance |
| INT | Magic damage, spell resistance |
| SPI | Mana, mana regen |
| LCK | Drop rate, crit multiplier |

+5 attribute points per level, +1 skill point per level. Respec costs gold (scaling).

### Warrior (近战/坦克)

Primary: STR, VIT

- **Battle Master**: Whirlwind, Slam, Charge, Lethal Strike
- **Guardian**: Shield Wall, Taunt, Iron Fortress, Life Regen
- **Berserker**: Frenzy, Dual Wield Mastery, Bleed Strike, Unyielding

### Mage (远程AOE/控制)

Primary: INT, SPI

- **Fire**: Fireball, Meteor, Fire Wall, Combustion
- **Frost**: Ice Arrow, Blizzard, Ice Armor, Freeze
- **Arcane**: Teleport, Mana Shield, Chain Lightning, Arcane Torrent

### Rogue (高爆发/敏捷)

Primary: DEX, LCK

- **Assassination**: Backstab, Poison Blade, Death Mark, Vanish
- **Traps**: Poison Cloud, Explosive Trap, Slow Trap, Chain Trap
- **Marksmanship**: Multi Shot, Piercing Arrow, Poison Arrow, Arrow Rain

### Skill Rules

- 3 trees per class, 8-10 skills per tree, 4 tiers
- Each tier requires investing points in previous tier
- Skills max at Lv 20

## Combat — Real-time + Auto-battle

- Auto-attack nearest target when in aggro range
- 6 skill slots with configurable auto-cast priority
- One-click auto-battle mode (AI uses skills + potions by priority)
- Player can manually override at any time

### Damage Formulas

```
Physical = (WeaponBase + STR_mod) * SkillMult * (1 + CritBonus) - ArmorReduction
Magic    = (SpellBase + INT_mod) * SkillMult * (1 + CritBonus) * ElementCoeff - Resistance
Dodge    = DEX * 0.3%  (cap 30%)
CritRate = DEX * 0.2% + LCK * 0.5% + GearBonus  (cap 75%)
CritDmg  = 150% + LCK * 1%
```

### Status Effects

Burn (DoT fire), Freeze (2s stun), Poison (DoT + reduced healing), Bleed (DoT physical), Slow, Stun, Silence.

### Skill Animations (SkillEffectSystem)

Each skill has a unique particle/procedural animation via `SkillEffectSystem.play()`:

| Skill | Visual |
|-------|--------|
| Slash | Arc trail, white-to-bright afterimage |
| Whirlwind | Multi-layer rotating arcs + wind particles 360 deg |
| Shield Wall | Hexagonal energy shield + pulse |
| Fireball | Projectile flight + explosion ring + fire particles |
| Blizzard | Ice shards falling + ground frost spread |
| Meteor | Screen shake + fireball descent + shockwave |
| Ice Armor | Orbiting ice crystals |
| Chain Lightning | Zigzag arcs between targets + spark particles |
| Backstab | Blink afterimage + crossed blade flash |
| Poison Blade | Green mist particles on weapon |
| Multi Shot | Fan-shaped projectile trajectories |
| Vanish | Smoke bomb + sprite fade |
| Explosive Trap | Ground marker + fire explosion on trigger |
| Arrow Rain | Mass arrows descending + dust on impact |

All effects use Phaser built-in particles + Graphics + tweens. Particle textures (dots, squares, stars) generated in `BootScene.generateEffects()`. Skill VFX sprites can be supplemented with pre-made cartoon effect sheets from asset packs.

## Items (D2-style)

### Quality Tiers

| Quality | Color | Affixes | Notes |
|---------|-------|---------|-------|
| Normal | White | 0 | Base stats only |
| Magic | Blue | 1-2 | 1 prefix + 1 suffix |
| Rare | Yellow | 3-4 | Random affix combo |
| Legendary | Orange | Fixed | Unique procs + special effects |
| Set | Green | Fixed | Set bonus scaling with pieces |

### Affix System

- **Prefixes** (stat mods): Sharp +ATK, Sturdy +DEF, Swift +ASPD, ...
- **Suffixes** (effect mods): ...of Leech, ...of Fire, ...of Freezing, ...
- Affix tiers 1-5; higher tiers drop in harder zones

### Equipment Slots

Helmet, Armor, Gloves, Boots, Weapon (main + off-hand), Necklace, 2 Rings, Belt

### Consumables & Materials

- Potions (HP/MP, tiered), Antidotes
- Scrolls: Town Portal, Identify
- Gems: socket into gear for bonus stats
- Crafting materials: for Blacksmith upgrades

## Homestead

Personal land near main town. Buildings unlocked via quests/gold.

| Building | Function |
|----------|----------|
| Herb Garden | Auto-produce potion mats, reduce potion cost |
| Training Ground | Offline XP, +5% XP bonus |
| Gem Workshop | Combine/upgrade gems, +10% gem effect |
| Pet Kennel | Raise pets for passive buffs |
| Warehouse | Extra storage slots |
| Altar | 2h temp stat buffs |

### Pets

Passive followers (no combat). Types: Sprite (+XP), Whelp (+ATK), Owl (+drop rate). Level up via feeding. Rare pets from special quests/bosses.

## Map System

### Procedural Generation (MapGenerator)

- Tile size: 128x64 isometric (cartoon detail requires higher resolution than pixel art)
- Map size: 80x80 tiles (~10240x5120 px)
- Map data defines fixed anchor points (camps, exits, spawn points); terrain procedurally generated

**Generation pipeline:**
1. Fixed seed points for camps/entrances/exits/boss areas (from MapData)
2. BSP subdivision into 8-12 sub-regions
3. Theme-based terrain fill per region (grass/trees for forest, sand/rock for desert)
4. Natural pathways via A*/cellular automata connecting regions
5. Scatter decorations (trees, rocks, flowers, mushrooms)
6. Water bodies via cellular automata (lakes, rivers)
7. Auto-generate boundary walls

**Performance**: viewport culling for 6400+ tiles, only render camera-visible area. Decorations also distance-culled.

### Fog of War

Circle-based vision centered on player. Explored areas remain visible but dimmed. Unexplored areas fully obscured.

### Camps (Safe Zones)

No monster entry. NPCs: Blacksmith (repair/craft), Merchant (buy/sell), Warehouse Keeper, Quest NPCs.

### Pathfinding

A* algorithm. Click-to-move with auto-navigation. Optional auto-combat or avoid encounters during pathfinding.

## Controls

### Desktop

WASD / arrows to move, click to pathfind. 1-6 for skills. I=Inventory, K=Skills, M=Map, H=Homestead.

### Mobile

Virtual joystick (left) + skill buttons (right, 6 + basic attack). Tap map to pathfind. Long-press for item tooltips. Responsive UI via Phaser Scale Manager.

## HUD

- **Top**: Minimap (expandable)
- **Top-left**: Portrait + level + HP/MP bars
- **Bottom-center**: Skill bar (6 slots)
- **Bottom-right**: Bag shortcut, potion quick-bar
- **Top-right**: Quest tracker
- **Toggle**: Auto-battle button

Popup panels: Inventory (grid), Character stats, Skill tree (3-branch visual), Shop, Blacksmith, Map, Homestead.

## Save System (IndexedDB)

Auto-save on zone change and camp rest. 3 manual save slots. Compressed for large data.

```typescript
interface SaveData {
  id: string;
  version: number;
  timestamp: number;
  player: PlayerData;
  inventory: ItemData[];
  stash: ItemData[];
  skills: SkillData[];
  quests: QuestProgress[];
  exploration: FogData;
  homestead: HomeData;
  settings: GameSettings;
}
```

## Progression

- Level cap: 50
- Exponential XP curve
- +5 attribute points + 1 skill point per level
- Difficulty modes (post-clear): Normal -> Nightmare -> Hell

## Additional Systems

- **Death penalty**: Lose some gold, gear drops at death location (D2-style), respawn at camp
- **Elite monsters**: Random map spawns with affixes ("Fire Enhanced", "Swift"), better drops
- **Achievements**: First kills, collection, exploration — grant titles and minor buffs
- **Combat log**: MUD-style scrolling text window for combat data, system messages, NPC dialogue
- **New player guide**: Tutorial quests in first zone teaching core mechanics

## Art Direction — Stylized Cartoon

### Style Guide

Shift from pixel art to **stylized cartoon / hand-painted** aesthetic. Think clean outlines, soft shading, vibrant color palettes — similar to Wakfu, Dofus, or MapleStory 2's isometric view. Characters and environments should feel warm and readable at small sizes.

Key principles:
- Consistent color temperature per zone (warm greens for Plains, cool purples for Forest, etc.)
- Clear silhouettes for characters and monsters at isometric scale
- Smooth anti-aliased edges (not pixel-snapped)
- UI elements match the cartoon tone (rounded corners, soft shadows, illustrated icons)

### Recommended Free Asset Packs (CC0 / CC-BY)

**Tiles & Environment:**
- Screaming Brain Studios — 300+ Overworld, 1800+ Wall, 1000+ Floor, 400+ Town isometric tiles (CC0, multiple sizes)
- Kenney Isometric Prototypes — floors, walls, objects, 8-dir character (CC0)
- "Tiny Tactics" series on itch.io — cartoon isometric tactical tiles (free)

**Characters & Monsters:**
- itch.io free isometric character packs (8-direction animated sprites)
- "Isometric Dungeon Crawler" by monogon — thousands of isometric sprites (itch.io)
- OpenGameArt medieval/fantasy character collections

**Browse:**
- https://opengameart.org/ (search: isometric, cartoon, tileset)
- https://itch.io/game-assets/free/genre-rpg/tag-isometric
- https://itch.io/game-assets/assets-cc0/tag-isometric
- https://kenney-assets.itch.io/

### Migration Notes (Pixel -> Cartoon)

1. Replace procedurally generated tile textures in `BootScene` with loaded spritesheets from asset packs
2. Increase tile dimensions from 64x32 to 128x64 (or 256x128 for HD)
3. Character sprites need 8-direction walk/attack/idle animations as spritesheets
4. UI elements (HUD, panels, buttons) should be re-skinned with cartoon-style frames
5. Particle effects can remain procedural but should use softer, rounder shapes
6. Retain procedural MapGenerator logic — it places tiles from whichever tileset is loaded
