# Visual Polish: HD Painterly Style, Fluid Animation, Crisp Fonts

**Date**: 2026-03-20
**Status**: Approved

## Problem

The game's visual presentation has three issues:
1. **Stiff movement and combat** — linear interpolation with no easing, short attack timelines, no hit impact effects, abrupt state transitions
2. **Pixel art remnants** — procedural sprites drawn on small canvases (64×96) look rough, especially when upscaled
3. **Blurry fonts** — 8-11px text rendered on a 720p canvas gets upscaled by `Phaser.Scale.FIT`, producing fuzzy text on modern displays

## Target Aesthetic

HD Hand-Painted style (reference: Hades, Dead Cells). Smooth gradients, soft edges, painterly shading. Sprites should look like miniature illustrations, not geometric shapes.

## Approach

Enhanced procedural generation + post-processing pipeline for sprites. Animation system overhaul for fluidity. DPI-aware rendering for fonts.

---

## Section 1: Sprite Quality Pipeline

### 1.1 Resolution Increase

| Parameter | Before | After |
|-----------|--------|-------|
| `TEXTURE_SCALE` | 2 | 3 |
| Player base frame | 64×96 | 96×144 |
| Actual render size | 128×192 | 288×432 |
| Sprite display scale | `setScale(0.5)` | `setScale(1/3)` |
| Particle textures | 6-12px | 12-24px |

### 1.2 Drawing Technique Upgrades

Applied across all 45+ sprite drawers via `DrawUtils` enhancements:

- **`ctx.shadowBlur`**: Soft glow edges on armor, weapons, magic effects. Replaces hard stroke outlines.
- **Multi-layer gradients**: 2-3 gradient passes per surface for volumetric depth (base color → shadow → highlight).
- **Rim lighting**: Subtle bright edge on character silhouettes, opposite to light direction.
- **Soft outlines**: Replace `ctx.strokeStyle` hard strokes with blurred shadow-based outlines (`ctx.shadowColor` + `ctx.shadowBlur` + `ctx.shadowOffsetX/Y`).
- **Sub-surface glow**: Inner radial gradient overlay for organic materials (skin, slime, cloth).

### 1.3 Post-Processing (Phaser PostFX Pipeline)

Applied at camera and per-entity level:

- **Camera bloom**: Subtle glow on bright elements (loot drops, magic effects, fire). Low threshold, wide radius.
- **Color grading**: Warm shadows, cool highlights — dark fantasy mood. Via `ColorMatrix` PostFX.
- **Vignette**: Subtle darkening at screen edges for cinematic focus.
- **Per-entity glow**: Magic items and active skill effects get individual bloom via `postFX.addBloom()`.
- **Particle softening**: Larger base textures (12-24px) with additive blending. Softer, more painterly particle effects.

### 1.4 Files Affected

- `src/graphics/DrawUtils.ts` — Add soft outline, rim lighting, multi-gradient helpers
- `src/graphics/SpriteGenerator.ts` — Update `TEXTURE_SCALE`, frame sizes
- `src/graphics/sprites/**/*.ts` — All 45+ sprite drawers, update drawing calls
- `src/scenes/BootScene.ts` — Particle texture generation (larger sizes)
- `src/systems/SkillEffectSystem.ts` — Particle texture sizes
- `src/scenes/ZoneScene.ts` — Camera PostFX setup
- `src/config.ts` — If TEXTURE_SCALE lives here

---

## Section 2: Animation System Overhaul

### 2.1 Movement Momentum

**Current**: Linear interpolation in `Player.updateMovement()` — `sprite.x += nx * step`. Constant speed, instant start/stop.

**Proposed**: Velocity-based movement with acceleration/deceleration.

```
currentSpeed = lerp(currentSpeed, targetSpeed, acceleration * dt)
sprite.x += nx * currentSpeed * dt
```

Parameters:
- Acceleration ramp: ~150ms to reach full speed
- Deceleration: ~100ms slide to stop
- Slight overshoot on direction change (elastic ease)
- `targetSpeed = 0` when no path (triggers deceleration)

**Files**: `src/entities/Player.ts` (updateMovement), `src/entities/Monster.ts` (AI movement)

### 2.2 Combat Weight & Impact

**Attack timeline** (total ~500ms, was 300ms):

| Phase | Duration | Description | Easing |
|-------|----------|-------------|--------|
| Anticipation | 150ms | Pull back further, compress body, build tension | Back.easeIn |
| Strike | 80ms | Fast snap forward to target | Expo.easeOut |
| Impact | 40ms | Exaggerated squash (0.25, was 0.15), hit-freeze | — |
| Follow-through | 120ms | Overshoot past rest, weapon continues arc | Quad.easeOut |
| Settle | 110ms | Elastic ease back to idle (slight bounce) | Elastic.easeOut |

**New impact effects**:
- **Hit-freeze**: Both attacker and target freeze for 30-50ms on contact. Damage dealt during freeze. Creates "crunch" feel (Hades/Hollow Knight technique).
- **Screen shake**: 50-120ms per hit, intensity proportional to damage dealt (not just big mobs). Uses `cameras.main.shake()`.
- **Hit flash**: Target sprite tints white (`0xffffff`) for 1 frame (~16ms) on damage.
- **Knockback**: 8-12px (was 3px) with elastic easing over 200ms (was 60ms). Direction: away from attacker.
- **Larger hit particles**: Hit sparks doubled in size and count, longer lifetime.

**Files**: `src/systems/CharacterAnimator.ts` (attack phases, presets), `src/scenes/ZoneScene.ts` (damage handling, screen effects), `src/entities/Monster.ts` (knockback), `src/systems/VFXManager.ts` (particle bursts)

### 2.3 State Transition Blending

**Current**: States snap instantly — idle frame one moment, walk frame the next.

**Proposed**: Crossfade blending with transition-specific timing:

| Transition | Duration | Behavior |
|-----------|----------|----------|
| Idle → Walk | 80ms | Bob amplitude ramps up, body leans into movement direction |
| Walk → Idle | 120ms | Momentum carries, slight position overshoot, then breathing resumes |
| Walk → Attack | 60ms | Forward momentum feeds into anticipation pull-back |
| Attack → Idle | 150ms | Weapon settles, body relaxes from combat stance |
| Any → Hurt | Immediate | Hit-freeze interrupts current animation, no blend |

Implementation: `CharacterAnimator` tracks `transitionProgress` (0→1) and lerps between outgoing and incoming animation parameters (position offsets, scale, rotation) during transitions.

**Files**: `src/systems/CharacterAnimator.ts` (add transition state machine, blending logic)

### 2.4 Walk Cycle Enhancement

| Parameter | Before | After |
|-----------|--------|-------|
| Y-bob | 4px sine | 6px asymmetric (sharp down, slow up) |
| Body tilt | 5° | 8° with direction lean |
| Squash | 0.05 | 0.10 (visible weight) |
| Bob speed | 280ms/cycle | 240ms/cycle (snappier) |
| Dust particles | 3 per other step | 5 per step, wider spread |

**Files**: `src/systems/CharacterAnimator.ts` (walk preset values)

---

## Section 3: Font & Text Rendering

### 3.1 DPI-Aware Canvas Resolution

**Problem**: Game canvas is fixed 1280×720. `Phaser.Scale.FIT` upscales to fill display. Text at 10px gets stretched to 20-30px → blurry.

**Fix**: Render canvas at native display resolution.

```typescript
const DPR = Math.min(window.devicePixelRatio || 1, 2); // cap at 2x
// config.ts
width: 1280 * DPR,
height: 720 * DPR,
```

CSS constrains the canvas to the same visual size. Text rasterized at native pixel density — no upscaling blur.

### 3.2 Font Size Adjustments

All sizes increase slightly for readability, then multiply by DPR at render time:

| Element | Before | After (base) |
|---------|--------|-------------|
| Cooldown timers | 8px | 11px |
| Monster names | 9px | 12px |
| Stat labels | 10px | 12px |
| Body text / HP / Gold | 11px | 13px |
| Skill names | 13px | 14px |
| Panel titles | 14px | 16px |
| Damage numbers (normal) | 16px | 20px |
| Damage numbers (crit) | 26px | 32px |

At render time: `fontSize = baseSize * DPR`.

### 3.3 Pervasive DPR Scaling

Everything using pixel values in the UI must scale by DPR:
- Font sizes: `${size * DPR}px`
- Stroke thickness: `strokeThickness * DPR`
- UI positions: All hardcoded panel coordinates, bar widths, icon positions, padding
- Text offsets: Damage number Y-offsets, NPC label positions, EXP/gold text positions

Export `DPR` from `src/config.ts` for use across all files.

### 3.4 Files Affected

- `src/config.ts` — DPR constant, canvas dimensions
- `src/scenes/UIScene.ts` — All font sizes, UI positions, bar dimensions
- `src/scenes/ZoneScene.ts` — Damage text, EXP/gold text, NPC labels
- `src/entities/NPC.ts` — Name labels, dialogue text
- `src/entities/Monster.ts` — Name label
- `src/systems/SkillEffectSystem.ts` — Any text rendering
- `src/scenes/MenuScene.ts` — Menu text sizes

---

## Implementation Notes

### Sprite Scaling Does Not Affect Collision
Changing `TEXTURE_SCALE` from 2 to 3 does not break collision or pathfinding. Collision is tile-based (grid coordinates), not pixel-based. Sprite visual size stays the same because `setScale(1/TEXTURE_SCALE)` adjusts proportionally — only pixel density increases.

### DPI Canvas: Set at Boot, Not Runtime
`DPR` is evaluated once at game creation before `new Phaser.Game(config)`. Phaser gameConfig is immutable after boot, so this is safe. CSS rule on `#game-container canvas` constrains display to `1280×720` CSS pixels while the internal canvas renders at `1280*DPR × 720*DPR`.

### State Transition Blending: Transform-Level, Not Frame-Level
`CharacterAnimator` already applies procedural transforms (position offset, scale, rotation) on top of sprite-sheet frames. Blending happens at the transform parameter level — lerping bob amplitude, tilt angle, squash values between outgoing and incoming states. Sprite-sheet frame playback is NOT blended; only the procedural overlays are. This is straightforward since all animation state in `CharacterAnimator` is already parametric.

### Hit-Freeze: Animation-Only Pause
Hit-freeze pauses tween progress and animation playback for 30-50ms. Game logic (damage calculation, cooldowns, AI) continues. Implementation: on damage event, set `entity.hitFreezeTimer = 30` and skip animation updates while timer > 0. Damage is already calculated before the freeze visual plays.

### Movement Momentum: Overlay on Existing Pathfinding
Path-following logic stays intact. The momentum system wraps the final sprite position update — instead of `sprite.x += nx * step`, it becomes `currentSpeed = lerp(currentSpeed, moveSpeed, accel * dt); sprite.x += nx * currentSpeed * dt`. The path, waypoints, and tile snapping remain unchanged. Applied to both Player and Monster movement.

### Screen Shake Scaling
Shake intensity = `clamp(damage / targetMaxHP * 0.01, 0.001, 0.008)`. Duration = `clamp(50 + damage / targetMaxHP * 100, 50, 120)`. Small hits produce subtle shakes; big hits are dramatic.

### Performance Budget
- TEXTURE_SCALE 3 increases sprite memory ~2.25x over current. With 45+ sprites at 288×432 max, total texture memory stays under 50MB — acceptable.
- Camera bloom is a single full-screen pass — ~1ms on modern GPUs. Per-entity bloom limited to active magic items only (not all entities).
- DPR cap at 2 prevents 4K canvas (3840×2160) which would stress fill rate.

### Particle Texture Regeneration
Existing particle textures in `BootScene.create()` and `SkillEffectSystem` are regenerated at their new sizes during boot. Same texture keys, larger canvases. No new keys needed.

---

## Files Affected (Complete)

### Core Rendering
- `src/config.ts` — `TEXTURE_SCALE` 2→3, add `DPR` constant, canvas dimensions
- `src/graphics/DrawUtils.ts` — Add soft outline, rim lighting, multi-gradient helpers
- `src/graphics/SpriteGenerator.ts` — Update frame size references
- `src/graphics/sprites/**/*.ts` — All 45+ sprite drawers (use new DrawUtils helpers)

### Animation
- `src/systems/CharacterAnimator.ts` — Attack phase timing, walk preset values, add transition blending logic, hit-freeze support
- `src/entities/Player.ts` — Movement momentum (wrap updateMovement speed calc)
- `src/entities/Monster.ts` — Movement momentum for AI, enhanced knockback (8-12px / 200ms)

### VFX & Particles
- `src/systems/VFXManager.ts` — Damage-based screen shake scaling, enhanced hit sparks, per-entity bloom
- `src/systems/SkillEffectSystem.ts` — Particle texture sizes 6-12px → 12-24px
- `src/scenes/BootScene.ts` — Particle texture generation at larger sizes

### UI & Text (DPR scaling)
- `src/scenes/UIScene.ts` — All font sizes, UI positions, bar dimensions × DPR
- `src/scenes/ZoneScene.ts` — Damage text, EXP/gold text, camera PostFX setup, hit-freeze coordination
- `src/scenes/MenuScene.ts` — Menu text sizes × DPR
- `src/entities/NPC.ts` — Name labels, dialogue text × DPR
- `src/entities/Monster.ts` — Name label × DPR

---

## Scope Exclusions

- **External art assets**: Not in scope. Procedural generation stays, just improved.
- **New animations**: No new action types (e.g., dodge roll). Only improving existing idle/walk/attack/hurt/death/cast.
- **Mobile**: No touch control changes.
- **Gameplay balance**: Attack duration increase is visual only — damage timing stays at the impact phase.
