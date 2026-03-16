# Phaser 3 Visual Overhaul — Design Spec

**Date**: 2026-03-16
**Approach**: Pragmatic Hybrid (Approach B)
**Goal**: Fully leverage Phaser 3's engine capabilities to deliver maximum ARPG juice — visual spectacle, atmosphere, and performance.

## Phase 1: Visual Juice (Easy Wins)

### 1.1 FX Pipeline (Per-GameObject Effects)

Create a `VFXManager` class centralizing all FX calls. Uses Phaser's built-in `preFX`/`postFX` pipeline (available on any GameObject/Camera in WebGL mode).

| FX | Target | Trigger |
|----|--------|---------|
| Bloom | Skill impacts, boss auras, legendary drops, level-up | On event |
| Glow | Loot on ground (colored by rarity), quest NPC markers, portals, active skill icons | Persistent |
| Shine | Legendary/Set item drops, equipped legendaries | Looping tween on `progress` |
| Shadow | All entity sprites (replace Ellipse shadows) | Persistent |
| Color Matrix | Player: desaturate on hit, green on poison, blue on freeze, grayscale on death | On status apply/remove |
| Displacement | Water tiles, portals, air near campfires | Persistent animated |
| Blur | Background when panels open | On panel toggle |
| Pixelate | Teleport/respawn dissolve | On zone transition |
| Wipe | Camera-level zone transition | On zone change |
| Barrel | Portal interior distortion | Persistent |

### 1.2 Camera Effects

Subscribe to EventBus combat/game events, trigger camera effects via `VFXManager`.

| Effect | Trigger | Parameters |
|--------|---------|------------|
| Shake (light) | Player hit | 80ms, 0.003 |
| Shake (medium) | Crit received, elite slam | 150ms, 0.008 |
| Shake (heavy) | Boss AoE, legendary drop | 250ms, 0.015 |
| Flash (white) | Crit dealt | 50ms, 0.3 |
| Flash (gold) | Level up | 200ms, 0.5 |
| Flash (orange) | Legendary drop | 300ms, 0.6 |
| Fade out/in | Zone transition | 400ms each |
| Fade to red | Death | 600ms |
| ZoomTo (out) | Boss aggro | 1.4x over 800ms, ease back |
| ZoomTo (pulse) | Ultimate skill | 1.6x 150ms, snap back |
| Pan | NPC dialogue | Center between player+NPC, 300ms |

Throttled: max one shake per 100ms, one flash per 200ms.

### 1.3 Advanced Particle System

**Weather** (per-zone, managed by `WeatherSystem`):
- Rain: gravity 200, wind angle, death zone at ground, ADD blend
- Snow: gravity 30, sine X drift, white/blue tint
- Ember storm: negative gravity, orange/red, ADD blend, sine sway
- Ash/dust: slow drift, low alpha, gray

**Environmental ambience**:
- Fireflies (forest), dust motes (caves), bubbles (water edges), sparks (forges)

**Combat particles** (EventBus-driven):
- Hit sparks: `explode(8)`, white/yellow, radial
- Blood splatter: `explode(12)`, red, gravity 100
- Heal convergence: `moveTo` player, green ring
- Mana drain: `moveTo` caster, blue from target
- Gold burst: `explode(6)`, gold, gravity
- Loot quality aura: circular orbit, rarity-colored

**Skill enhancements**:
- Ground fire pool (rectangle emit zone), ice shatter (explode), lightning crackle (stepped), arrow trail, poison cloud

### 1.4 Render Texture Effects

`TrailRenderer` class managing 2 RenderTextures (weapon trails + ground marks):
- Weapon slash trails: draw arc sprite each frame, alpha erase fade
- Ground scorch marks: stamp decals on fire/ice/lightning impact, slow fade
- Dash ghost trail: snapshot player sprite 3-4 times at decreasing alpha

RenderTextures sized to viewport (1280x720), scroll with camera.

### 1.5 Object Pooling

| Pool | Strategy |
|------|----------|
| Monsters | `Phaser.GameObjects.Group` with `maxSize`, `get()`/`killAndHide()` |
| Projectiles | Shared group, recycle on hit/expire |
| Damage numbers | Pool of 20 Text objects, reposition + replay |
| Loot drops | Pool of containers, reset on reuse |
| Particles | `emitter.reserve()` pre-allocation |

## Phase 2: Isometric Tilemap Migration

Replace manual 80x80 Image grid with Phaser's native isometric tilemap:
- `Tilemap.createBlankMap()` with `ISOMETRIC` orientation (64x32 tile size)
- `map.addTilesetImage()` from procedural tile textures
- `createLayer()` for ground + decoration layers
- Converter function: existing array data -> tilemap format at zone load
- Animated tiles for water/lava
- Built-in culling replaces manual viewport math

## Phase 3: Enhanced Lighting

Replace canvas-based `LightingSystem` with render-texture approach:
- Dark overlay RenderTexture filled at zone ambient level (0.2-0.7 alpha)
- Light sources: `rt.erase()` with radial gradient sprites
- Sources: player torch, campfires, torches, spell effects, NPC auras
- Bloom FX on light source sprites for soft bleed
- Only update moved lights per frame

## New Files

- `src/systems/VFXManager.ts` — FX pipeline, camera effects, centralized VFX API
- `src/systems/WeatherSystem.ts` — Per-zone weather particle management
- `src/systems/TrailRenderer.ts` — Render texture trail/scorch effects

## Modified Files

- `src/scenes/ZoneScene.ts` — Integrate VFXManager, WeatherSystem, TrailRenderer; tilemap migration (Phase 2); lighting replacement (Phase 3)
- `src/scenes/UIScene.ts` — Blur FX on panel open, glow on skill icons
- `src/systems/CombatSystem.ts` — Emit richer events for VFX (crit flag, damage type, source type)
- `src/systems/SkillEffectSystem.ts` — Particle-enhanced skill effects
- `src/systems/LootSystem.ts` — Emit quality tier on drop for glow/shine
- `src/systems/LightingSystem.ts` — Phase 3 rewrite
- `src/entities/Player.ts` — Remove ellipse shadow (replaced by FX shadow)
- `src/entities/Monster.ts` — Remove ellipse shadow, add hit particle triggers
- `src/scenes/BootScene.ts` — Generate particle textures, radial gradient light texture
