# Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the game's visual feel from stiff/pixelated to fluid HD painterly by upgrading sprite resolution, animation weight, and font crispness.

**Architecture:** Three independent streams — (1) DPI-aware rendering + font scaling, (2) animation system overhaul for fluidity, (3) sprite quality pipeline with post-processing. Stream 1 is foundational and must complete first. Streams 2 and 3 are independent.

**Tech Stack:** Phaser 3.80+, TypeScript, Canvas 2D API (sprite generation), WebGL PostFX (bloom, color matrix, vignette)

**Spec:** `docs/superpowers/specs/2026-03-20-visual-polish-design.md`

**Note:** No test framework exists in this project. Verification is visual — run `npm run dev` and check in browser.

---

## File Structure

### Modified Files
| File | Responsibility |
|------|---------------|
| `src/config.ts` | Add `DPR` constant, update `TEXTURE_SCALE` 2→3, scale `GAME_WIDTH`/`GAME_HEIGHT` by DPR |
| `src/main.ts` | No changes needed (spreads gameConfig) |
| `index.html` | Add CSS to constrain canvas to 1280×720 CSS pixels |
| `src/scenes/UIScene.ts` | Scale all font sizes and UI positions by DPR |
| `src/scenes/ZoneScene.ts` | Scale damage/EXP/gold text by DPR, add camera PostFX, add hit-freeze + screen shake |
| `src/scenes/MenuScene.ts` | Scale menu text by DPR |
| `src/scenes/BootScene.ts` | Scale boot text by DPR |
| `src/entities/NPC.ts` | Scale NPC labels by DPR |
| `src/entities/Monster.ts` | Scale name label by DPR, enhanced knockback, movement momentum |
| `src/entities/Player.ts` | Movement momentum (acceleration/deceleration) |
| `src/systems/CharacterAnimator.ts` | Updated presets, 5-phase attack, transition blending, hit-freeze |
| `src/systems/VFXManager.ts` | Damage-based screen shake, hit flash, enhanced particles |
| `src/systems/SkillEffectSystem.ts` | Particle textures 2x larger |
| `src/graphics/DrawUtils.ts` | Add softOutline, rimLight, multiGradient helpers |
| `src/graphics/SpriteGenerator.ts` | Update TEXTURE_SCALE reference if frame sizes hardcoded |
| `src/graphics/sprites/**/*.ts` | Use new DrawUtils helpers in sprite drawers |

---

## Task 1: DPR Foundation — Config + Canvas + CSS

**Files:**
- Modify: `src/config.ts:1-31`
- Modify: `index.html:10-20`

This task establishes the DPI-aware rendering foundation that all other tasks depend on.

- [ ] **Step 1: Add DPR constant and scale canvas dimensions in config.ts**

In `src/config.ts`, add the DPR constant and scale game dimensions:

```typescript
// After line 10 (after GAME_HEIGHT = 720):
export const DPR = Math.min(window.devicePixelRatio || 1, 2);
```

Update `TEXTURE_SCALE` from 2 to 3:
```typescript
export const TEXTURE_SCALE = 3;
```

Update gameConfig to use DPR-scaled dimensions:
```typescript
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH * DPR,
  height: GAME_HEIGHT * DPR,
  pixelArt: false,
  antialias: true,
  backgroundColor: '#0f0f1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
};
```

- [ ] **Step 2: Add CSS to constrain canvas display size**

In `index.html`, update the `<style>` block to add a max-size constraint on the canvas:

```html
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0a12; }
  #game-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #game-container canvas {
    max-width: 100vw;
    max-height: 100vh;
    object-fit: contain;
  }
</style>
```

- [ ] **Step 3: Verify — run `npm run dev`, check that game renders at correct size**

Run: `npm run dev`
Expected: Game displays at same visual size as before, but canvas internal resolution is higher on HiDPI displays. No visual regression.

- [ ] **Step 4: Commit**

```bash
git add src/config.ts index.html
git commit -m "feat: DPI-aware canvas + TEXTURE_SCALE 3 for HD rendering"
```

---

## Task 2: Font DPR Scaling — UIScene

**Files:**
- Modify: `src/scenes/UIScene.ts:1-30` and throughout

The largest file to update. All hardcoded font sizes and pixel positions must scale by DPR. Since GAME_WIDTH/GAME_HEIGHT are now DPR-scaled, positions relative to those constants auto-scale. Only literal pixel values in font sizes and stroke thicknesses need manual DPR multiplication.

- [ ] **Step 1: Import DPR in UIScene and create scaled font size helper**

At the top of `src/scenes/UIScene.ts`, add DPR import and a helper:

```typescript
import { GAME_WIDTH, GAME_HEIGHT, DPR } from '../config';
```

Add a helper function after the constants (after line 15):

```typescript
/** Scale a font size by DPR for crisp text at any display resolution */
function fs(basePx: number): string {
  return `${Math.round(basePx * DPR)}px`;
}
```

- [ ] **Step 2: Replace all hardcoded fontSize strings with fs() calls**

Search-and-replace pattern throughout UIScene.ts. Representative changes:

All `fontSize: '10px'` → `fontSize: fs(12)` (stat labels, item text, log)
All `fontSize: '11px'` → `fontSize: fs(13)` (HP/mana labels, gold)
All `fontSize: '12px'` → `fontSize: fs(14)` (dialog text, equipment titles)
All `fontSize: '13px'` → `fontSize: fs(14)` (skill names, gold display)
All `fontSize: '14px'` → `fontSize: fs(16)` (panel titles)
All `fontSize: '8px'` → `fontSize: fs(11)` (cooldown timers)

Also scale `strokeThickness` values: multiply each by DPR.
Also scale `GLOBE_R`: `const GLOBE_R = Math.round(40 * DPR);`

- [ ] **Step 3: Scale hardcoded pixel positions that aren't relative to GAME_WIDTH/GAME_HEIGHT**

Any literal pixel offsets like padding, margin, bar widths that are hardcoded numbers (not derived from GAME_WIDTH/GAME_HEIGHT) need `* DPR`. GAME_WIDTH and GAME_HEIGHT are already DPR-scaled from config, so positions computed from them auto-scale.

- [ ] **Step 4: Verify — run `npm run dev`, check all UI panels render with crisp text**

Run: `npm run dev`
Expected: HP/mana bars, skill bar, inventory panel, quest log — all text is crisp, same visual size, higher pixel density.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/UIScene.ts
git commit -m "feat: DPR-scale all UIScene fonts and positions for crisp text"
```

---

## Task 3: Font DPR Scaling — ZoneScene, MenuScene, BootScene, NPC, Monster

**Files:**
- Modify: `src/scenes/ZoneScene.ts` (showDamageText, EXP/gold text, showLevelUpBanner)
- Modify: `src/scenes/MenuScene.ts`
- Modify: `src/scenes/BootScene.ts`
- Modify: `src/entities/NPC.ts:57-79`
- Modify: `src/entities/Monster.ts` (name label)

- [ ] **Step 1: Scale ZoneScene damage text, EXP/gold text, level-up banner**

Add DPR import and `fs()` helper to ZoneScene:

```typescript
import { GAME_WIDTH, GAME_HEIGHT, DPR } from '../config';

function fs(basePx: number): string {
  return `${Math.round(basePx * DPR)}px`;
}
```

Update `showDamageText()` — search for the method by name:
```typescript
// Replace hardcoded sizes:
// Normal: '16px' → fs(20), Crit: '26px' → fs(32), Miss: '13px' → fs(14)
// Player crit: '24px' → fs(28)
// strokeThickness: isCrit ? 4 : 3 → isCrit ? Math.round(4 * DPR) : Math.round(3 * DPR)
```

Update EXP/gold text — search for `'+${exp} EXP'` and `'+${gold}G'`:
```typescript
// fontSize: '11px' → fs(13)
// strokeThickness: 2 → Math.round(2 * DPR)
```

Update `showLevelUpBanner()` — search for the method by name:
```typescript
// fontSize: '32px' → fs(32), '18px' → fs(18)
// strokeThickness: 5 → Math.round(5 * DPR), 3 → Math.round(3 * DPR)
```

- [ ] **Step 2: Scale MenuScene text**

Import DPR in MenuScene. Search for all `fontSize:` occurrences and scale them. Title text, button text, class selection text — all get `fs()` treatment.

- [ ] **Step 3: Scale BootScene text**

Import DPR in BootScene. Scale title text, subtitle, loading bar text.

- [ ] **Step 4: Scale NPC labels**

In `src/entities/NPC.ts`, import DPR and scale:
- Quest marker (line 58): `fontSize: '18px'` → `fontSize: fs(18)`
- Name label (line 74): `fontSize: '11px'` → `fontSize: fs(13)`
- Stroke thicknesses × DPR

- [ ] **Step 5: Scale Monster name label**

In `src/entities/Monster.ts`, find the monster name/HP label text and scale font size and stroke by DPR.

- [ ] **Step 6: Verify — run `npm run dev`, check damage numbers, NPC labels, menu text are all crisp**

Run: `npm run dev`
Expected: All in-world text (damage, EXP, NPC names, monster names) and menu text renders crisply.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/ZoneScene.ts src/scenes/MenuScene.ts src/scenes/BootScene.ts src/entities/NPC.ts src/entities/Monster.ts
git commit -m "feat: DPR-scale all remaining text across scenes and entities"
```

---

## Task 4: Movement Momentum — Player

**Files:**
- Modify: `src/entities/Player.ts:165-225`

- [ ] **Step 1: Add momentum state to Player class**

Add instance variables near other movement state:

```typescript
private currentSpeed = 0;
private readonly acceleration = 8; // lerp factor — reaches full speed in ~150ms
private readonly deceleration = 12; // lerp factor — stops in ~100ms
```

- [ ] **Step 2: Replace linear movement with eased speed in updateMovement**

Replace the movement logic in `updateMovement()` (lines 165-203):

```typescript
private updateMovement(delta: number): void {
  const dt = delta / 1000;

  if (this.path.length === 0) {
    // Decelerate to stop
    this.currentSpeed = this.currentSpeed * (1 - this.deceleration * dt);
    if (this.currentSpeed < 0.5) {
      this.currentSpeed = 0;
      this.isMoving = false;
      this.animator.setIdle();
    }
    return;
  }
  this.animator.setWalk();

  // Accelerate toward target speed
  this.currentSpeed += (this.moveSpeed - this.currentSpeed) * this.acceleration * dt;

  const target = this.path[0];
  const targetWorld = cartToIso(target.col, target.row);
  const dx = targetWorld.x - this.sprite.x;
  const dy = targetWorld.y - this.sprite.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const step = this.currentSpeed * dt;

  if (dist <= step) {
    this.tileCol = target.col;
    this.tileRow = target.row;
    this.sprite.setPosition(targetWorld.x, targetWorld.y);
    this.sprite.setDepth(targetWorld.y + 100);
    this.spawnFootDust(targetWorld.x, targetWorld.y);
    this.path.shift();
    if (this.path.length === 0) {
      this.isMoving = false;
    }
  } else {
    const nx = dx / dist;
    const ny = dy / dist;
    this.sprite.x += nx * step;
    this.sprite.y += ny * step;
    this.sprite.setDepth(this.sprite.y + 100);

    this.tileCol += (target.col - this.tileCol) * (step / dist);
    this.tileRow += (target.row - this.tileRow) * (step / dist);
  }
}
```

- [ ] **Step 3: Enhance foot dust particles**

Update `spawnFootDust()` — spawn every step (remove modulo check), increase to 5 particles with wider spread:

```typescript
private spawnFootDust(x: number, y: number): void {
  for (let i = 0; i < 5; i++) {
    const p = this.scene.add.circle(
      x + (Math.random() - 0.5) * 16,
      y + 2 + Math.random() * 5,
      1.5 + Math.random() * 2,
      0x888877, 0.3,
    ).setDepth(this.sprite.depth - 1);
    this.scene.tweens.add({
      targets: p,
      alpha: 0, y: p.y - 8 - Math.random() * 6,
      x: p.x + (Math.random() - 0.5) * 12,
      scale: 0.2,
      duration: 350 + Math.random() * 250,
      ease: 'Power2',
      onComplete: () => p.destroy(),
    });
  }
}
```

- [ ] **Step 4: Verify — run `npm run dev`, click to move, confirm smooth start/stop**

Run: `npm run dev`
Expected: Player accelerates smoothly when starting to walk, decelerates with a slide when stopping. Dust is more prominent.

- [ ] **Step 5: Commit**

```bash
git add src/entities/Player.ts
git commit -m "feat: movement momentum with acceleration/deceleration curves"
```

---

## Task 5: Movement Momentum — Monster + Enhanced Knockback

**Files:**
- Modify: `src/entities/Monster.ts:193-247`

- [ ] **Step 1: Add momentum state to Monster**

Add instance variables to Monster class:

```typescript
private currentMoveSpeed = 0;
private readonly moveAccel = 6;
```

- [ ] **Step 2: Apply momentum to moveToward()**

Update `moveToward()` (lines 193-221) to use eased speed:

```typescript
private moveToward(targetCol: number, targetRow: number, delta: number, collisions: boolean[][]): boolean {
  const dx = targetCol - this.tileCol;
  const dy = targetRow - this.tileRow;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.1) return true;

  const targetSpeed = this.definition.speed * (delta / 1000) * 0.03;
  this.currentMoveSpeed += (targetSpeed - this.currentMoveSpeed) * this.moveAccel * (delta / 1000);

  const nx = dx / dist;
  const ny = dy / dist;
  const newCol = this.tileCol + nx * this.currentMoveSpeed;
  const newRow = this.tileRow + ny * this.currentMoveSpeed;

  const checkCol = Math.round(newCol);
  const checkRow = Math.round(newRow);
  if (checkCol >= 0 && checkCol < collisions[0].length &&
      checkRow >= 0 && checkRow < collisions.length &&
      collisions[checkRow][checkCol]) {
    this.tileCol = newCol;
    this.tileRow = newRow;
  }

  const worldPos = cartToIso(this.tileCol, this.tileRow);
  this.sprite.setPosition(worldPos.x, worldPos.y);
  this.sprite.setDepth(worldPos.y + 50);

  return false;
}
```

- [ ] **Step 3: Enhance knockback in takeDamage()**

Replace the knockback tween (lines 235-242) with longer, more dramatic knockback:

```typescript
const knockDist = 10;
this.scene.tweens.add({
  targets: this.sprite,
  x: this.sprite.x + (dx / dist) * knockDist,
  y: this.sprite.y + (dy / dist) * knockDist,
  duration: 200,
  yoyo: true,
  ease: 'Back.easeOut',
});
```

- [ ] **Step 4: Reset momentum on state transitions**

In the `update()` method, when monster state changes to `idle`, reset momentum:
```typescript
// In the leash return block and idle state:
this.currentMoveSpeed = 0;
```

- [ ] **Step 5: Verify — run `npm run dev`, check monster movement and knockback**

Run: `npm run dev`
Expected: Monsters accelerate when chasing, knockback is visibly larger and bouncier.

- [ ] **Step 6: Commit**

```bash
git add src/entities/Monster.ts
git commit -m "feat: monster movement momentum + enhanced knockback (10px/200ms)"
```

---

## Task 6: Animation System — Walk Cycle + Attack Phases

**Files:**
- Modify: `src/systems/CharacterAnimator.ts:39-66,295-402`

- [ ] **Step 1: Update HUMANOID_CONFIG walk presets**

Update the walk values in `HUMANOID_CONFIG` (lines 44-48):

```typescript
walkBobAmount: 6,
walkBobSpeed: 240,
walkTilt: 8,
walkSquash: 0.10,
```

Also update attack presets (lines 50-54):
```typescript
attackLunge: 14,
attackDuration: 500,
attackSquash: 0.25,
attackWindup: 150,
attackShake: true,
```

- [ ] **Step 2: Update walk animation for asymmetric bob**

Replace `updateWalk()` (lines 295-317) with asymmetric bob (sharp down, slow up):

```typescript
private updateWalk(): void {
  const phase = (this.animTime / this.config.walkBobSpeed) * Math.PI * 2;

  // Asymmetric bob: sharp drop, slow rise
  const rawBob = Math.sin(phase);
  const asymBob = rawBob < 0 ? rawBob : rawBob * 0.6;
  const newBobY = -Math.abs(asymBob) * this.config.walkBobAmount;
  this.container.y += newBobY - this.baseY;
  this.baseY = newBobY;

  // Body tilt with direction lean
  this.container.angle = Math.sin(phase) * this.config.walkTilt;

  // Squash/stretch on contact
  const sinVal = Math.abs(Math.sin(phase));
  if (this.config.deathStyle === 'splat') {
    const stretch = sinVal * this.config.walkSquash;
    this.container.scaleX = 1 + stretch;
    this.container.scaleY = 1 - stretch;
  } else if (sinVal < 0.2) {
    this.container.scaleX = 1 + this.config.walkSquash;
    this.container.scaleY = 1 - this.config.walkSquash;
  } else {
    this.container.scaleX = 1;
    this.container.scaleY = 1;
  }
}
```

- [ ] **Step 3: Replace attack animation with 5-phase timeline**

Replace `playAttack()` (lines 321-402) with the new 5-phase attack:

```typescript
playAttack(targetX: number, targetY: number): void {
  if (this.dead) return;
  this.cancelTweens();
  this.prevState = this.state;
  this.state = 'attack';
  this.playFrameAnim('attack');

  const originX = this.container.x;
  const originY = this.container.y;

  const dx = targetX - originX;
  const dy = targetY - originY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = dist > 0 ? dx / dist : 0;
  const ny = dist > 0 ? dy / dist : 0;

  const targetAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  const tiltAngle = targetAngle * 0.05;

  const total = this.config.attackDuration;
  const anticipateMs = this.config.attackWindup;
  const strikeMs = 80;
  const impactMs = 40;
  const followMs = Math.max(60, (total - anticipateMs - strikeMs - impactMs) * 0.5);
  const settleMs = Math.max(50, total - anticipateMs - strikeMs - impactMs - followMs);

  const pullbackX = originX - nx * this.config.attackLunge * 0.4;
  const pullbackY = originY - ny * this.config.attackLunge * 0.4;
  const lungeX = originX + nx * this.config.attackLunge;
  const lungeY = originY + ny * this.config.attackLunge;
  const overshootX = originX + nx * this.config.attackLunge * 0.3;
  const overshootY = originY + ny * this.config.attackLunge * 0.3;

  // Phase 1: Anticipation — pull back, compress
  this.addTween({
    targets: this.container,
    x: pullbackX,
    y: pullbackY,
    scaleY: 0.88,
    scaleX: 1.06,
    angle: -tiltAngle,
    duration: anticipateMs,
    ease: 'Back.easeIn',
    onComplete: () => {
      // Phase 2: Strike — fast snap forward
      this.addTween({
        targets: this.container,
        x: lungeX,
        y: lungeY,
        scaleY: 1.05,
        scaleX: 0.95,
        angle: tiltAngle * 1.5,
        duration: strikeMs,
        ease: 'Expo.easeOut',
        onComplete: () => {
          // Phase 3: Impact — squash + screen shake
          this.container.scaleX = 1 + this.config.attackSquash;
          this.container.scaleY = 1 - this.config.attackSquash;

          if (this.config.attackShake && this.scene.cameras?.main) {
            this.scene.cameras.main.shake(60, 0.004);
          }

          // Phase 4: Follow-through — overshoot
          this.scene.time.delayedCall(impactMs, () => {
            this.addTween({
              targets: this.container,
              x: overshootX,
              y: overshootY,
              scaleX: 1.02,
              scaleY: 0.98,
              angle: tiltAngle * 0.5,
              duration: followMs,
              ease: 'Quad.easeOut',
              onComplete: () => {
                // Phase 5: Settle — elastic return
                this.addTween({
                  targets: this.container,
                  x: originX,
                  y: originY,
                  scaleX: 1,
                  scaleY: 1,
                  angle: 0,
                  duration: settleMs,
                  ease: 'Elastic.easeOut',
                  onComplete: () => {
                    this.state = 'idle';
                    this.animTime = 0;
                    this.baseY = 0;
                    this.baseX = 0;
                    this.playFrameAnim('idle');
                  },
                });
              },
            });
          });
        },
      });
    },
  });
}
```

- [ ] **Step 4: Verify — run `npm run dev`, engage combat, observe attack weight**

Run: `npm run dev`
Expected: Attacks have visible wind-up, fast strike, squash on impact, follow-through overshoot, elastic settle. Walk cycle has more pronounced bob and tilt.

**Important**: Damage is emitted by ZoneScene's combat loop on its own timer — NOT tied to animation completion. The animation duration increase (300→500ms) is purely visual. Verify that attack rate/DPS hasn't changed by checking combat feels the same speed gameplay-wise.

- [ ] **Step 5: Commit**

```bash
git add src/systems/CharacterAnimator.ts
git commit -m "feat: 5-phase attack animation + enhanced walk cycle with asymmetric bob"
```

---

## Task 7: Animation System — State Transition Blending + Hit-Freeze

**Files:**
- Modify: `src/systems/CharacterAnimator.ts:145-160,271-317`

- [ ] **Step 1: Add transition blending state to CharacterAnimator**

Add instance variables to the class (after line 150):

```typescript
// Transition blending
private transitionProgress = 1; // 1 = fully in current state
private transitionDuration = 0;
private prevBobY = 0;
private prevScaleX = 1;
private prevScaleY = 1;
private prevAngle = 0;

// Hit-freeze
private hitFreezeTimer = 0;
```

- [ ] **Step 2: Add transition durations map and update state setters**

Add transition duration config:

```typescript
private static readonly TRANSITION_MS: Record<string, number> = {
  'idle->walk': 80,
  'walk->idle': 120,
  'walk->attack': 60,
  'attack->idle': 150,
  'idle->attack': 80,
};
```

Update `setIdle()` and `setWalk()` to capture outgoing state for blending:

```typescript
setIdle(): void {
  if (this.state === 'idle' || this.dead) return;
  this.startTransition('idle');
  this.state = 'idle';
  this.playFrameAnim('idle');
}

setWalk(): void {
  if (this.state === 'walk' || this.dead) return;
  this.startTransition('walk');
  this.state = 'walk';
  this.playFrameAnim('walk');
}

private startTransition(toState: string): void {
  const key = `${this.state}->${toState}`;
  const ms = CharacterAnimator.TRANSITION_MS[key] ?? 80;
  this.transitionDuration = ms;
  this.transitionProgress = 0;
  this.prevBobY = this.baseY;
  this.prevScaleX = this.container.scaleX;
  this.prevScaleY = this.container.scaleY;
  this.prevAngle = this.container.angle;
}
```

- [ ] **Step 3: Apply transition blending in update loop**

In the `update(delta)` method, add hit-freeze check and transition progress:

```typescript
update(delta: number): void {
  if (this.dead) { /* existing death logic */ return; }

  // Hit-freeze: skip animation updates
  if (this.hitFreezeTimer > 0) {
    this.hitFreezeTimer -= delta;
    return;
  }

  this.animTime += delta;

  // Advance transition
  if (this.transitionProgress < 1 && this.transitionDuration > 0) {
    this.transitionProgress = Math.min(1, this.transitionProgress + delta / this.transitionDuration);
  }

  // Run current state animation
  // ... existing state switch ...

  // Blend transforms if transitioning
  if (this.transitionProgress < 1) {
    const t = this.transitionProgress;
    const eased = t * t * (3 - 2 * t); // smoothstep

    // Lerp between previous state's transform snapshot and current state's output.
    // Current animation has already written to container; we blend toward it.
    const currentY = this.container.y;
    const currentScaleX = this.container.scaleX;
    const currentScaleY = this.container.scaleY;
    const currentAngle = this.container.angle;

    // Reconstruct where we'd be in the previous state
    const baseContainerY = currentY - this.baseY; // container Y without current bob
    const prevY = baseContainerY + this.prevBobY;

    this.container.y = prevY + (currentY - prevY) * eased;
    this.container.scaleX = this.prevScaleX + (currentScaleX - this.prevScaleX) * eased;
    this.container.scaleY = this.prevScaleY + (currentScaleY - this.prevScaleY) * eased;
    this.container.angle = this.prevAngle + (currentAngle - this.prevAngle) * eased;
  }
}
```

- [ ] **Step 4: Add public hit-freeze trigger method**

```typescript
/** Freeze animation for the given duration (ms). Called on damage. */
triggerHitFreeze(durationMs: number = 35): void {
  this.hitFreezeTimer = durationMs;
}
```

- [ ] **Step 5: Verify — run `npm run dev`, observe smooth idle↔walk transitions**

Run: `npm run dev`
Expected: Moving and stopping shows smooth blending instead of snap-cutting between states.

- [ ] **Step 6: Commit**

```bash
git add src/systems/CharacterAnimator.ts
git commit -m "feat: state transition blending + hit-freeze support in animator"
```

---

## Task 8: Combat Impact — Hit-Freeze, Screen Shake, Hit Flash

**Files:**
- Modify: `src/systems/VFXManager.ts:28-55,85-90,274-278`
- Modify: `src/scenes/ZoneScene.ts` (damage handling)

- [ ] **Step 1: Add damage-based screen shake scaling to VFXManager**

Update the COMBAT_DAMAGE handler (lines 30-55) to scale shake intensity with damage:

```typescript
EventBus.on(GameEvents.COMBAT_DAMAGE, (data: {
  targetId: string;
  damage: number;
  isDodged: boolean;
  isCrit: boolean;
  isPlayerTarget?: boolean;
  damageType?: string;
  targetMaxHP?: number;
}) => {
  if (data.isDodged) return;
  const maxHP = data.targetMaxHP || 100;
  const ratio = data.damage / maxHP;

  if (data.isPlayerTarget) {
    if (data.isCrit) {
      this.cameraShake(150, 0.008);
    } else if (data.damage > 0) {
      const intensity = Math.max(0.002, Math.min(0.006, ratio * 0.01));
      const duration = Math.max(50, Math.min(120, 50 + ratio * 100));
      this.cameraShake(duration, intensity);
    }
  } else {
    // Player dealing damage — scale with damage dealt
    const intensity = Math.max(0.001, Math.min(0.005, ratio * 0.008));
    const duration = Math.max(40, Math.min(100, 40 + ratio * 80));
    this.cameraShake(duration, intensity);
    if (data.isCrit) {
      this.cameraFlash(50, 0.3, 0xffffff);
    }
  }
});
```

- [ ] **Step 2: Add hit flash method to VFXManager**

Add a public method for white-flash on hit:

```typescript
/** Flash a game object white for one frame */
hitFlash(target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Container): void {
  if (target instanceof Phaser.GameObjects.Sprite) {
    target.setTintFill(0xffffff);
    this.scene.time.delayedCall(50, () => {
      target.clearTint();
    });
  }
}
```

- [ ] **Step 3: Enhance hit sparks — double size and count**

Update `hitSparks()` (line 275):

```typescript
hitSparks(x: number, y: number, count: number = 12): void {
  this.burstParticles(x, y, count, 'particle_spark',
    [0xffffff, 0xffffaa, 0xffd700],
    { speedMin: 20, speedMax: 55, scaleStart: 1.0, duration: 400 });
}
```

- [ ] **Step 4: Wire hit-freeze and hit-flash into ZoneScene damage flow**

In ZoneScene, search for all `EventBus.emit(GameEvents.COMBAT_DAMAGE, ...)` calls. Each emission must include `targetMaxHP` so VFXManager can scale shake intensity.

For monster taking damage (search for where monster.takeDamage is called):
```typescript
// Add targetMaxHP to the COMBAT_DAMAGE event data object:
EventBus.emit(GameEvents.COMBAT_DAMAGE, {
  // ...existing fields...
  targetMaxHP: monster.maxHp,   // Monster.maxHp property exists
});

// After the event emission, trigger hit-freeze and flash:
monster.animator.triggerHitFreeze(35);
this.player.animator.triggerHitFreeze(35);
if (this.vfx) this.vfx.hitFlash(monster.sprite);
```

For player taking damage (search for where player takes damage from monster):
```typescript
EventBus.emit(GameEvents.COMBAT_DAMAGE, {
  // ...existing fields...
  targetMaxHP: this.player.maxHp,  // Player.maxHp property exists
});
```

**Note**: Both `Monster` and `Player` classes have a `maxHp` property. Verify by searching for `maxHp` in both files.

- [ ] **Step 5: Verify — run `npm run dev`, attack monsters, observe hit impact**

Run: `npm run dev`
Expected: Each hit causes brief freeze, white flash on target, screen shake proportional to damage, bigger sparks.

- [ ] **Step 6: Commit**

```bash
git add src/systems/VFXManager.ts src/scenes/ZoneScene.ts
git commit -m "feat: damage-based screen shake, hit-freeze, hit flash, enhanced sparks"
```

---

## Task 9: Particle Texture Scaling

**Files:**
- Modify: `src/systems/SkillEffectSystem.ts:13-139`

- [ ] **Step 1: Scale all particle texture generation to 2x size**

Update `generateTextures()` to create larger, softer particles. Multiply all canvas sizes and coordinate values by 2:

- `particle_circle`: 8×8 → 16×16 (all fillCircle radii × 2)
- `particle_spark`: 6×6 → 12×12 (all Point coordinates × 2)
- `particle_flame`: 8×12 → 16×24 (all triangle/circle coords × 2)
- `particle_ice`: 8×8 → 16×16 (all Point coordinates × 2)
- `particle_arrow`: 4×12 → 8×24 (all rect/triangle coords × 2)
- `particle_slash`: 16×4 → 32×8 (all rect coords × 2)
- `particle_lightning`: 2×16 → 4×32 (all line coords × 2, lineWidth × 2)
- `particle_smoke`: 12×12 → 24×24 (all fillCircle × 2)
- `particle_poison`: 6×6 → 12×12 (all coords × 2)
- `particle_star`: 10×10 → 20×20 (all Point coords × 2)

Example for `particle_circle`:
```typescript
// particle_circle (16x16 soft circle)
g.clear();
g.fillStyle(0xffffff, 0.3);
g.fillCircle(8, 8, 8);
g.fillStyle(0xffffff, 0.6);
g.fillCircle(8, 8, 6);
g.fillStyle(0xffffff, 1.0);
g.fillCircle(8, 8, 3);
g.generateTexture('particle_circle', 16, 16);
```

Apply same 2× scaling pattern to all 10 particle textures.

- [ ] **Step 2: Adjust VFXManager burst scaleStart to compensate**

In `VFXManager`, since textures are 2× larger, halve the `scaleStart` values in burst calls to keep the same visual size, then bump them up slightly for the "larger particles" effect:

- `hitSparks`: `scaleStart: 0.6` (was effectively 1.0 at half texture size)
- `goldBurst`: `scaleStart: 0.5`
- `deathBurst`: `scaleStart: 0.4`
- `levelUpBurst`: `scaleStart: 0.5`

- [ ] **Step 3: Verify — run `npm run dev`, check particles look softer and larger**

Run: `npm run dev`
Expected: Hit sparks, death bursts, gold particles, etc. are smoother with more detail.

- [ ] **Step 4: Commit**

```bash
git add src/systems/SkillEffectSystem.ts src/systems/VFXManager.ts
git commit -m "feat: 2x particle texture resolution for softer painterly effects"
```

---

## Task 10: Camera Post-Processing

**Files:**
- Modify: `src/scenes/ZoneScene.ts` (create method or early in scene setup)

- [ ] **Step 1: Add camera PostFX in ZoneScene.create()**

After camera setup in ZoneScene, add post-processing:

```typescript
// Camera PostFX — painterly mood
if (this.renderer.type === Phaser.WEBGL) {
  const cam = this.cameras.main;

  // Subtle bloom for bright elements (magic, loot, fire)
  cam.postFX.addBloom(0xffffff, 1, 1, 1.2, 1.5);

  // Dark fantasy color grading — slight warm tint
  const colorMatrix = cam.postFX.addColorMatrix();
  colorMatrix.brightness(1.02);
  colorMatrix.contrast(0.04);
  colorMatrix.saturate(0.08);

  // Vignette for cinematic focus
  cam.postFX.addVignette(0.5, 0.5, 0.88, 0.35);
}
```

- [ ] **Step 2: Verify — run `npm run dev`, observe mood/glow changes**

Run: `npm run dev`
Expected: Subtle bloom glow on bright elements, slight warm color shift, dark vignette at edges. Not overdone — subtle enhancement.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/ZoneScene.ts
git commit -m "feat: camera PostFX pipeline — bloom, color grading, vignette"
```

---

## Task 11: DrawUtils Enhancements

**Files:**
- Modify: `src/graphics/DrawUtils.ts` (append new methods)

- [ ] **Step 1: Add soft outline helper**

Append to `DrawUtils` class:

```typescript
/**
 * Draw a soft (blurred) outline around a shape instead of a hard stroke.
 * Call this before drawing the shape fill for an outer glow effect.
 */
static softOutline(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number = 4,
  offsetX: number = 0,
  offsetY: number = 0,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = offsetX;
  ctx.shadowOffsetY = offsetY;
}

static softOutlineEnd(ctx: CanvasRenderingContext2D): void {
  ctx.restore();
}
```

- [ ] **Step 2: Add rim lighting helper**

```typescript
/**
 * Draw a rim light on the edge of a circular/elliptical shape.
 * Creates a subtle bright edge highlight on the side opposite to light direction.
 */
static rimLight(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rx: number, ry: number,
  color: string = 'rgba(255,255,255,0.15)',
  lightAngle: number = -0.7, // radians, top-left default
): void {
  const edgeX = cx + Math.cos(lightAngle + Math.PI) * rx * 0.8;
  const edgeY = cy + Math.sin(lightAngle + Math.PI) * ry * 0.8;
  const grad = ctx.createRadialGradient(edgeX, edgeY, 0, edgeX, edgeY, Math.max(rx, ry) * 0.6);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
```

- [ ] **Step 3: Add multi-layer gradient helper**

```typescript
/**
 * Fill a rectangle with a multi-layer gradient for volumetric depth.
 * Applies base → shadow → highlight in 3 passes.
 */
static volumeGradient(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  baseColor: string,
  shadowColor: string,
  highlightColor: string,
): void {
  // Base fill
  ctx.fillStyle = baseColor;
  ctx.fillRect(x, y, w, h);

  // Shadow gradient from bottom
  const shadowGrad = ctx.createLinearGradient(x, y, x, y + h);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(1, shadowColor);
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(x, y, w, h);

  // Highlight gradient from top-left
  const hlGrad = ctx.createLinearGradient(x, y, x + w * 0.6, y + h * 0.6);
  hlGrad.addColorStop(0, highlightColor);
  hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hlGrad;
  ctx.fillRect(x, y, w, h);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/graphics/DrawUtils.ts
git commit -m "feat: DrawUtils helpers for soft outlines, rim lighting, volume gradients"
```

---

## Task 12: Sprite Drawer Updates (Representative Sample)

**Files:**
- Modify: `src/graphics/sprites/monsters/Slime.ts`
- Modify: `src/graphics/sprites/players/PlayerWarrior.ts`

This task demonstrates the pattern for updating sprite drawers. Apply the same pattern to remaining drawers incrementally.

- [ ] **Step 1: Update Slime drawer to use soft outlines and rim lighting**

In the Slime drawer, wrap the main body drawing with `softOutline` for a glow edge, and add `rimLight` on the body after the main fill:

```typescript
// Before drawing the slime body:
DrawUtils.softOutline(ctx, 'rgba(30, 180, 60, 0.3)', 6);

// After the main body fills, before specular highlights:
DrawUtils.softOutlineEnd(ctx);
DrawUtils.rimLight(ctx, cx, cy, bodyW * 0.5, bodyH * 0.5, 'rgba(100,255,120,0.12)');
```

- [ ] **Step 2: Update PlayerWarrior drawer with volume gradients on armor**

In the Warrior drawer, replace flat armor fills with `volumeGradient`:

```typescript
// Instead of flat ctx.fillStyle for the torso plate:
DrawUtils.volumeGradient(ctx, torsoX, torsoY, torsoW, torsoH,
  '#2a3542', 'rgba(0,0,0,0.3)', 'rgba(255,255,255,0.08)');
```

- [ ] **Step 3: Verify — run `npm run dev`, check slime and warrior look softer**

Run: `npm run dev`
Expected: Slime has soft glow outline and rim highlight. Warrior armor has volumetric shading. Both look more painterly.

- [ ] **Step 4: Commit**

```bash
git add src/graphics/sprites/monsters/Slime.ts src/graphics/sprites/players/PlayerWarrior.ts
git commit -m "feat: painterly sprite updates — soft outlines, rim lighting, volume gradients"
```

---

## Task 13: Remaining Sprite Drawers (Batch)

**Files:**
- Modify: `src/graphics/sprites/**/*.ts` (all remaining drawers)

- [ ] **Step 1: Apply soft outline + rim lighting pattern to all monster drawers**

For each monster drawer, add `DrawUtils.softOutline()` before the main body draw and `DrawUtils.rimLight()` after. Use category-appropriate glow colors:
- Beasts: warm brown glow
- Undead: cold blue glow
- Demonic: red/orange glow
- Elemental: element-colored glow

- [ ] **Step 2: Apply volume gradients to all player class drawers**

For Mage and Rogue sprite drawers, apply `volumeGradient` to their main body/clothing areas, same pattern as Warrior.

- [ ] **Step 3: Apply soft outline to NPC drawers**

NPC drawers get subtle warm-toned soft outlines for a friendly glow.

- [ ] **Step 4: Verify — run `npm run dev`, cycle through zones, check all entities**

Run: `npm run dev`
Expected: All sprites across all zones have improved painterly quality.

- [ ] **Step 5: Commit**

```bash
git add src/graphics/sprites/
git commit -m "feat: painterly treatment across all sprite drawers"
```

---

## Execution Order & Dependencies

```
Task 1 (DPR foundation) ← MUST be first
  ├── Task 2 (UIScene fonts) ← depends on DPR
  ├── Task 3 (remaining fonts) ← depends on DPR
  │
  ├── Task 4 (player momentum) ← independent
  ├── Task 5 (monster momentum) ← independent
  │
  ├── Task 6 (walk + attack anim) ← independent
  ├── Task 7 (transitions + hit-freeze) ← depends on Task 6
  ├── Task 8 (combat impact VFX) ← depends on Task 7
  │
  ├── Task 9 (particle textures) ← independent
  ├── Task 10 (camera PostFX) ← independent
  │
  ├── Task 11 (DrawUtils helpers) ← independent
  ├── Task 12 (sample sprite drawers) ← depends on Task 11
  └── Task 13 (all sprite drawers) ← depends on Task 12
```

**Parallelizable groups:**
- Group A (fonts): Tasks 2, 3
- Group B (movement): Tasks 4, 5
- Group C (animation): Tasks 6 → 7 → 8
- Group D (rendering): Tasks 9, 10, 11 → 12 → 13
