# NPC Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul all 11 NPC sprites with proportional art (80x120), 4-state animations, ambient VFX, and a state machine that makes NPCs react to the player.

**Architecture:** Rewrite `makeNPCSheet()` in SpriteGenerator for detailed proportional drawing with 24 frames (4 states). Add state machine to NPC entity driven by player proximity and EventBus events. Attach subtle Phaser particle emitters per NPC role.

**Tech Stack:** Phaser 3, TypeScript, Canvas 2D drawing, Phaser ParticleEmitter

**Spec:** `docs/plans/2026-03-16-npc-visual-overhaul-design.md`

**No test framework** — this project has no tests set up. Each task ends with a manual verification step (run `npm run dev`, visually confirm in browser).

---

## File Map

| File | Role | Action |
|------|------|--------|
| `src/utils/EventBus.ts` | Event definitions | Modify: add `DIALOGUE_CLOSE` |
| `src/scenes/UIScene.ts` | Dialogue UI | Modify: emit `DIALOGUE_CLOSE` in `closeDialogue()` |
| `src/scenes/ZoneScene.ts` | Main game scene | Modify: add `npcId` to event payloads, call `npc.update()` in loop |
| `src/graphics/SpriteGenerator.ts` | Sprite generation | Modify: rewrite `makeNPCSheet()`, update frame constants, update animation registration |
| `src/entities/NPC.ts` | NPC entity | Modify: add state machine, VFX emitters, update method |

---

## Chunk 1: EventBus + Scene Wiring

### Task 1: Add DIALOGUE_CLOSE event and wire it

**Files:**
- Modify: `src/utils/EventBus.ts:21` (add after SHOP_CLOSE)
- Modify: `src/scenes/UIScene.ts:984-987` (emit in closeDialogue)

- [ ] **Step 1: Add DIALOGUE_CLOSE to GameEvents**

In `src/utils/EventBus.ts`, add after line 21 (`SHOP_CLOSE`):

```typescript
DIALOGUE_CLOSE: 'dialogue:close',
```

- [ ] **Step 2: Emit DIALOGUE_CLOSE in UIScene.closeDialogue()**

In `src/scenes/UIScene.ts`, modify `closeDialogue()` (line 984) to emit the event before destroying panels:

```typescript
private closeDialogue(): void {
  EventBus.emit(GameEvents.DIALOGUE_CLOSE);
  if (this.dialogueBackdrop) { this.dialogueBackdrop.destroy(); this.dialogueBackdrop = null; }
  if (this.dialoguePanel) { this.dialoguePanel.destroy(); this.dialoguePanel = null; }
}
```

This requires adding the import — check if `EventBus` and `GameEvents` are already imported in UIScene. They likely are (line 229 uses them).

- [ ] **Step 3: Add npcId to NPC_INTERACT payload in ZoneScene**

In `src/scenes/ZoneScene.ts`, at line 1046, add `npcId: def.id` to the emit payload:

```typescript
EventBus.emit(GameEvents.NPC_INTERACT, {
  npcId: def.id,
  npcName: def.name,
  dialogue: dialogueText,
  actions,
});
```

- [ ] **Step 4: Add npcId to stash UI_TOGGLE_PANEL payload in ZoneScene**

In `src/scenes/ZoneScene.ts`, at line 1054, add `npcId`:

```typescript
case 'stash':
  EventBus.emit(GameEvents.UI_TOGGLE_PANEL, { panel: 'stash', npcId: def.id });
  break;
```

- [ ] **Step 5: Verify the game still runs**

Run: `npm run dev`
Expected: Game loads, NPC interaction (click blacksmith/merchant/quest/stash) works exactly as before. No console errors related to events.

- [ ] **Step 6: Commit**

```bash
git add src/utils/EventBus.ts src/scenes/UIScene.ts src/scenes/ZoneScene.ts
git commit -m "feat(npc): add DIALOGUE_CLOSE event, add npcId to interaction payloads"
```

---

## Chunk 2: Sprite Generation Overhaul

### Task 3: Rewrite makeNPCSheet() with proportional sprites and 4-state animations

This is the largest task — it rewrites the NPC procedural drawing. The NPC sprite sheet changes from 8 frames at 48x80 to 24 frames at 80x120.

**Files:**
- Modify: `src/graphics/SpriteGenerator.ts:1316-1598` (makeNPCSheet method)
- Modify: `src/graphics/SpriteGenerator.ts:1981-1996` (NPC animation registration)
- Modify: `src/graphics/SpriteGenerator.ts:6` (frame layout constants — add NPC constants)

- [ ] **Step 1: Add NPC frame layout constants**

At the top of `src/graphics/SpriteGenerator.ts`, after line 12 (`const MONSTER_FRAMES = 20;`), add:

```typescript
// NPC frame layout (24 frames total per NPC)
const NPC_FW = 80;   // frame width (before TEXTURE_SCALE)
const NPC_FH = 120;  // frame height (before TEXTURE_SCALE)
const NPC_WORK_START = 0, NPC_WORK_COUNT = 8;
const NPC_ALERT_START = 8, NPC_ALERT_COUNT = 4;
const NPC_IDLE_START = 12, NPC_IDLE_COUNT = 6;
const NPC_TALK_START = 18, NPC_TALK_COUNT = 6;
const NPC_TOTAL_FRAMES = 24;
```

- [ ] **Step 2: Rewrite makeNPCSheet()**

Replace the entire `makeNPCSheet()` method (lines 1322-1598) with the new proportional drawing implementation. The new method must:

1. Create a canvas of `NPC_FW * s * NPC_TOTAL_FRAMES` by `NPC_FH * s` (where `s = TEXTURE_SCALE`)
2. Draw 24 frames across 4 states, each with the proper pose
3. Use proportional body ratios (head ~25% of height, torso ~30%, legs ~30%, boots ~15%)
4. Add gradient shading, outlines, detailed eyes (whites + iris + highlight), eyebrows, nose, mouth
5. Per-state pose differences driven by `npc.accessory` field

The structure of the rewritten method:

```typescript
private makeNPCSheet(npc: NPCConfig): void {
  const s = TEXTURE_SCALE;
  const fw = NPC_FW * s, fh = NPC_FH * s;
  const [canvas, ctx] = this.createCanvas(fw * NPC_TOTAL_FRAMES, fh);
  const skin = npc.skinColor ?? 0xb08960;
  const hair = npc.hairColor ?? 0x3a2a1a;
  const acc = npc.accessory ?? 'none';
  const bw = npc.bulky ? 1.15 : 1;

  for (let f = 0; f < NPC_TOTAL_FRAMES; f++) {
    const ox = f * fw;
    ctx.save();
    ctx.translate(ox, 0);

    // Determine which state this frame belongs to
    let state: 'working' | 'alert' | 'idle' | 'talking';
    let stateFrame: number; // frame index within this state
    let stateCount: number;
    if (f < NPC_ALERT_START) {
      state = 'working'; stateFrame = f - NPC_WORK_START; stateCount = NPC_WORK_COUNT;
    } else if (f < NPC_IDLE_START) {
      state = 'alert'; stateFrame = f - NPC_ALERT_START; stateCount = NPC_ALERT_COUNT;
    } else if (f < NPC_TALK_START) {
      state = 'idle'; stateFrame = f - NPC_IDLE_START; stateCount = NPC_IDLE_COUNT;
    } else {
      state = 'talking'; stateFrame = f - NPC_TALK_START; stateCount = NPC_TALK_COUNT;
    }

    const phase = (stateFrame / stateCount) * Math.PI * 2;

    // Calculate pose parameters based on state + accessory
    const pose = this.calcNPCPose(state, phase, acc);

    // Draw the NPC frame
    this.drawNPCFrame(ctx, fw, fh, s, npc, skin, hair, bw, pose);

    ctx.restore();
  }

  this.applyNoiseToRegion(ctx, 0, 0, canvas.width, canvas.height, 3);

  const key = npc.key;
  if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
  const canvasTex = this.scene.textures.addCanvas(key, canvas)!;
  for (let i = 0; i < NPC_TOTAL_FRAMES; i++) {
    canvasTex.add(i, 0, i * fw, 0, fw, fh);
  }
}
```

- [ ] **Step 3: Implement calcNPCPose() helper**

Add a new private method that returns pose parameters for each state/accessory combo:

```typescript
private calcNPCPose(
  state: 'working' | 'alert' | 'idle' | 'talking',
  phase: number,
  accessory: string
): {
  bob: number; leftArmY: number; rightArmY: number;
  headTilt: number; bodyLean: number;
  mouthOpen: boolean; eyebrowRaise: number;
  gestureHand: 'none' | 'left' | 'right';
} {
  // Default values
  let bob = Math.sin(phase) * 1.0;
  let leftArmY = 0, rightArmY = 0;
  let headTilt = 0, bodyLean = 0;
  let mouthOpen = false, eyebrowRaise = 0;
  let gestureHand: 'none' | 'left' | 'right' = 'none';

  switch (state) {
    case 'working':
      // Role-specific busy animations (same as existing but enhanced)
      switch (accessory) {
        case 'hammer':
          bob = Math.sin(phase) * 0.5;
          const strike = Math.sin(phase);
          rightArmY = strike > 0 ? -strike * 12 : strike * 5;
          leftArmY = Math.sin(phase + 0.5) * 2;
          bodyLean = strike > 0 ? -0.8 : 0.8;
          break;
        case 'pickaxe':
          bob = Math.sin(phase) * 0.5;
          const dig = Math.sin(phase);
          rightArmY = dig > 0 ? -dig * 14 : dig * 4;
          leftArmY = Math.sin(phase + 0.3) * 2;
          bodyLean = dig > 0 ? -1 : 1;
          headTilt = dig * 0.05;
          break;
        case 'coinbag':
          bob = Math.sin(phase) * 1.5;
          rightArmY = Math.sin(phase * 2) * 4;
          leftArmY = Math.sin(phase + 1) * 1.5;
          bodyLean = Math.sin(phase) * 0.5;
          break;
        case 'staff':
          bob = Math.sin(phase) * 0.8;
          rightArmY = Math.sin(phase) * 1.5;
          leftArmY = Math.sin(phase + 2) * 2;
          bodyLean = Math.sin(phase) * 0.8;
          headTilt = Math.sin(phase + 1) * 0.03;
          break;
        case 'sword':
          bob = Math.sin(phase) * 0.5;
          rightArmY = Math.sin(phase) * 1.5;
          leftArmY = Math.sin(phase + Math.PI) * 2;
          bodyLean = Math.sin(phase) * 0.3;
          headTilt = Math.sin(phase * 2) * 0.02;
          break;
        case 'lantern':
          bob = Math.sin(phase) * 1.0;
          rightArmY = Math.sin(phase) * 5;
          leftArmY = Math.sin(phase + 1.5) * 2;
          bodyLean = Math.sin(phase + 0.5) * 0.6;
          break;
        case 'book':
          bob = Math.sin(phase) * 0.6;
          rightArmY = Math.sin(phase * 2) * 2;
          leftArmY = Math.sin(phase) * 0.5;
          headTilt = 0.06 + Math.sin(phase) * 0.02;
          break;
        default:
          leftArmY = Math.sin(phase) * 2;
          rightArmY = Math.sin(phase + Math.PI) * 2;
          break;
      }
      break;

    case 'alert':
      // Head turns toward player, body straightens, arm pauses
      bob = Math.sin(phase) * 0.3;
      headTilt = -0.05; // slight turn toward camera
      eyebrowRaise = 0.5;
      bodyLean = 0;
      leftArmY = 0;
      rightArmY = 0;
      break;

    case 'idle':
      // Gentle breathing, weight shift
      bob = Math.sin(phase) * 0.8;
      leftArmY = Math.sin(phase) * 1.5;
      rightArmY = Math.sin(phase + Math.PI) * 1.5;
      bodyLean = Math.sin(phase) * 0.3;
      break;

    case 'talking':
      // Hand gestures, mouth opens on some frames
      bob = Math.sin(phase) * 0.6;
      gestureHand = 'left';
      leftArmY = Math.sin(phase) * 6 - 4; // arm raises for gesture
      rightArmY = Math.sin(phase + 1) * 1;
      bodyLean = Math.sin(phase) * 0.4 + 0.3; // slight lean forward
      headTilt = Math.sin(phase * 2) * 0.03;
      mouthOpen = Math.sin(phase * 2) > 0.3;
      eyebrowRaise = Math.sin(phase) > 0 ? 0.3 : 0;
      break;
  }

  return { bob, leftArmY, rightArmY, headTilt, bodyLean, mouthOpen, eyebrowRaise, gestureHand };
}
```

- [ ] **Step 4: Implement drawNPCFrame() helper**

Add the complete drawing method. This is the core of the visual overhaul.

```typescript
private drawNPCFrame(
  ctx: CanvasRenderingContext2D,
  fw: number, fh: number, s: number,
  npc: NPCConfig, skin: number, hair: number, bw: number,
  pose: { bob: number; leftArmY: number; rightArmY: number;
          headTilt: number; bodyLean: number;
          mouthOpen: boolean; eyebrowRaise: number;
          gestureHand: 'none' | 'left' | 'right' }
): void {
  const cx = fw / 2;
  const ground = fh - 8 * s;
  const by = ground + pose.bob * s;
  const bodyW = Math.round(16 * bw);
  const acc = npc.accessory ?? 'none';
  const hs = npc.hairStyle ?? 'none';

  // 1. Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  this.fillEllipse(ctx, cx, ground + 3 * s, 18 * s, 5 * s);

  // 2. Cloak (behind body)
  if (npc.cloakColor) {
    const cg = ctx.createLinearGradient(cx - (bodyW + 3) * s, by - 50 * s, cx + (bodyW + 3) * s, by - 18 * s);
    cg.addColorStop(0, this.rgb(lightenHex(npc.cloakColor, 10)));
    cg.addColorStop(1, this.rgb(darkenHex(npc.cloakColor, 15)));
    ctx.fillStyle = cg;
    this.roundRect(ctx, cx - (bodyW + 3) * s + pose.bodyLean * s, by - 50 * s, (bodyW * 2 + 6) * s, 36 * s, 4 * s);
    ctx.fill();
  }

  // 3. Legs + boots
  const legDark = darkenHex(npc.bodyColor, 20);
  // Left leg
  this.drawPart(ctx, cx - 8 * s, by - 22 * s, 7 * s, 20 * s, legDark, 2 * s);
  // Right leg
  this.drawPart(ctx, cx + 1 * s, by - 22 * s, 7 * s, 20 * s, legDark, 2 * s);
  // Left boot
  this.drawPart(ctx, cx - 9 * s, by - 4 * s, 9 * s, 7 * s, 0x2a1a0a, 3 * s);
  ctx.fillStyle = this.rgb(0x1a0a00);
  ctx.fillRect(cx - 9 * s, by - 1 * s, 9 * s, 1.5 * s); // sole
  // Right boot
  this.drawPart(ctx, cx, by - 4 * s, 9 * s, 7 * s, 0x2a1a0a, 3 * s);
  ctx.fillStyle = this.rgb(0x1a0a00);
  ctx.fillRect(cx, by - 1 * s, 9 * s, 1.5 * s); // sole

  // 4. Body torso (with gradient shading)
  const bodyTop = by - 48 * s;
  const bodyH = 28 * s;
  // Outline
  this.drawPart(ctx, cx - (bodyW + 1) * s + pose.bodyLean * s, bodyTop - 1 * s,
    (bodyW * 2 + 2) * s, bodyH + 2 * s, darkenHex(npc.bodyColor, 30), 4 * s);
  // Fill with gradient
  const bg = ctx.createLinearGradient(
    cx - bodyW * s, bodyTop, cx + bodyW * s, bodyTop + bodyH);
  bg.addColorStop(0, this.rgb(lightenHex(npc.bodyColor, 15)));
  bg.addColorStop(1, this.rgb(darkenHex(npc.bodyColor, 15)));
  ctx.fillStyle = bg;
  this.roundRect(ctx, cx - bodyW * s + pose.bodyLean * s, bodyTop, bodyW * 2 * s, bodyH, 4 * s);
  ctx.fill();
  // Collar / neckline
  ctx.fillStyle = this.rgb(darkenHex(npc.bodyColor, 10));
  this.fillEllipse(ctx, cx + pose.bodyLean * s, bodyTop + 2 * s, 6 * s, 3 * s);

  // 5. Belt + buckle
  const beltY = by - 22 * s;
  this.drawPart(ctx, cx - bodyW * s + pose.bodyLean * s, beltY, bodyW * 2 * s, 5 * s,
    darkenHex(npc.bodyColor, 25), 1 * s);
  ctx.fillStyle = this.rgb(0xb8860b);
  this.fillCircle(ctx, cx + pose.bodyLean * s, beltY + 2.5 * s, 2 * s);

  // 6. Left arm + hand
  const laX = cx - (bodyW + 5) * s + pose.bodyLean * s;
  const laY = by - 46 * s;
  // Arm outline
  this.drawPart(ctx, laX - 0.5 * s, laY - 0.5 * s, 7 * s, 18 * s,
    darkenHex(npc.bodyColor, 30), 3 * s);
  // Arm fill
  const lag = ctx.createLinearGradient(laX, laY, laX + 6 * s, laY + 16 * s);
  lag.addColorStop(0, this.rgb(lightenHex(npc.bodyColor, 10)));
  lag.addColorStop(1, this.rgb(darkenHex(npc.bodyColor, 10)));
  ctx.fillStyle = lag;
  this.roundRect(ctx, laX, laY, 6 * s, 16 * s, 3 * s);
  ctx.fill();
  // Left hand
  const lhX = laX + 3 * s;
  const lhY = laY + 16 * s + pose.leftArmY * s;
  ctx.fillStyle = this.rgb(skin);
  this.fillCircle(ctx, lhX, lhY, 3.5 * s);

  // 7. Right arm + hand
  const raX = cx + (bodyW - 1) * s + pose.bodyLean * s;
  const raY = by - 46 * s;
  // Arm outline
  this.drawPart(ctx, raX - 0.5 * s, raY - 0.5 * s, 7 * s, 18 * s,
    darkenHex(npc.bodyColor, 30), 3 * s);
  // Arm fill
  const rag = ctx.createLinearGradient(raX, raY, raX + 6 * s, raY + 16 * s);
  rag.addColorStop(0, this.rgb(lightenHex(npc.bodyColor, 10)));
  rag.addColorStop(1, this.rgb(darkenHex(npc.bodyColor, 10)));
  ctx.fillStyle = rag;
  this.roundRect(ctx, raX, raY, 6 * s, 16 * s, 3 * s);
  ctx.fill();
  // Right hand
  const rhX = raX + 3 * s;
  const rhY = raY + 16 * s + pose.rightArmY * s;
  ctx.fillStyle = this.rgb(skin);
  this.fillCircle(ctx, rhX, rhY, 3.5 * s);

  // 8. Accessory in right hand
  ctx.fillStyle = this.rgb(npc.itemColor);
  switch (acc) {
    case 'hammer':
      ctx.fillStyle = this.rgb(0x5a3a18);
      ctx.fillRect(rhX - 1.5 * s, rhY - 12 * s, 3 * s, 18 * s);
      // Hammer head with metallic gradient
      const hg = ctx.createLinearGradient(rhX - 5 * s, rhY - 16 * s, rhX + 5 * s, rhY - 10 * s);
      hg.addColorStop(0, this.rgb(0x9a9aa0));
      hg.addColorStop(0.5, this.rgb(0x7a7a80));
      hg.addColorStop(1, this.rgb(0x5a5a60));
      ctx.fillStyle = hg;
      this.drawPart(ctx, rhX - 5 * s, rhY - 16 * s, 10 * s, 6 * s, npc.itemColor, 2 * s);
      break;
    case 'pickaxe':
      ctx.fillStyle = this.rgb(0x5a3a18);
      ctx.fillRect(rhX - 1.5 * s, rhY - 14 * s, 3 * s, 20 * s);
      ctx.fillStyle = this.rgb(npc.itemColor);
      ctx.beginPath();
      ctx.moveTo(rhX - 6 * s, rhY - 14 * s);
      ctx.lineTo(rhX + 6 * s, rhY - 17 * s);
      ctx.lineTo(rhX + 6 * s, rhY - 13 * s);
      ctx.closePath(); ctx.fill();
      break;
    case 'coinbag':
      this.fillCircle(ctx, rhX, rhY - 5 * s, 5.5 * s);
      // Drawstring
      ctx.strokeStyle = this.rgb(0x5a4020);
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(rhX - 3 * s, rhY - 9 * s);
      ctx.lineTo(rhX, rhY - 11 * s);
      ctx.lineTo(rhX + 3 * s, rhY - 9 * s);
      ctx.stroke();
      // Coin symbol
      ctx.fillStyle = this.rgb(0x8a7020);
      this.fillCircle(ctx, rhX, rhY - 5 * s, 2.5 * s);
      break;
    case 'staff':
      ctx.fillStyle = this.rgb(0x4a3018);
      ctx.fillRect(rhX - 1.5 * s, rhY - 22 * s, 3 * s, 28 * s);
      // Orb at top with glow
      const og = ctx.createRadialGradient(rhX, rhY - 23 * s, 0, rhX, rhY - 23 * s, 4 * s);
      og.addColorStop(0, this.rgb(lightenHex(npc.itemColor, 40)));
      og.addColorStop(1, this.rgb(npc.itemColor));
      ctx.fillStyle = og;
      this.fillCircle(ctx, rhX, rhY - 23 * s, 4 * s);
      break;
    case 'sword':
      // Blade with metallic gradient
      const sg = ctx.createLinearGradient(rhX - 1 * s, rhY - 18 * s, rhX + 3 * s, rhY);
      sg.addColorStop(0, '#b0b0b8');
      sg.addColorStop(0.5, '#888898');
      sg.addColorStop(1, '#686878');
      ctx.fillStyle = sg;
      ctx.fillRect(rhX - 1 * s, rhY - 18 * s, 3 * s, 20 * s);
      // Crossguard
      ctx.fillStyle = this.rgb(0x5a4020);
      ctx.fillRect(rhX - 3 * s, rhY, 7 * s, 2.5 * s);
      // Pommel
      ctx.fillStyle = this.rgb(0x3a2010);
      this.fillCircle(ctx, rhX + 0.5 * s, rhY + 4 * s, 1.5 * s);
      break;
    case 'lantern': {
      // Handle
      ctx.fillStyle = this.rgb(0x4a4a50);
      ctx.fillRect(rhX - 2 * s, rhY - 10 * s, 4 * s, 3 * s);
      // Glass body with glow
      const lg = ctx.createRadialGradient(rhX, rhY - 4 * s, 0, rhX, rhY - 4 * s, 4 * s);
      lg.addColorStop(0, 'rgba(255,200,50,0.9)');
      lg.addColorStop(1, 'rgba(255,150,30,0.4)');
      ctx.fillStyle = lg;
      this.roundRect(ctx, rhX - 3.5 * s, rhY - 7 * s, 7 * s, 8 * s, 1.5 * s);
      ctx.fill();
      // Outer glow
      ctx.fillStyle = `rgba(255,200,50,0.15)`;
      this.fillCircle(ctx, rhX, rhY - 4 * s, 7 * s);
      break;
    }
    case 'book':
      // Book cover
      ctx.fillStyle = this.rgb(npc.itemColor);
      this.roundRect(ctx, rhX - 4 * s, rhY - 7 * s, 8 * s, 10 * s, 1.5 * s);
      ctx.fill();
      // Pages
      ctx.fillStyle = this.rgb(lightenHex(npc.itemColor, 50));
      ctx.fillRect(rhX - 3 * s, rhY - 6 * s, 6 * s, 8 * s);
      // Spine
      ctx.fillStyle = this.rgb(darkenHex(npc.itemColor, 20));
      ctx.fillRect(rhX - 4 * s, rhY - 7 * s, 1.5 * s, 10 * s);
      break;
    case 'scroll':
      ctx.fillStyle = this.rgb(0xd4c8a0);
      this.roundRect(ctx, rhX - 3 * s, rhY - 8 * s, 6 * s, 10 * s, 2 * s);
      ctx.fill();
      ctx.fillStyle = this.rgb(0x8a3020);
      ctx.fillRect(rhX - 3.5 * s, rhY - 8 * s, 7 * s, 2 * s);
      ctx.fillRect(rhX - 3.5 * s, rhY + 1 * s, 7 * s, 2 * s);
      break;
  }

  // 9. Neck
  ctx.fillStyle = this.rgb(skin);
  ctx.fillRect(cx - 4 * s + pose.bodyLean * s, by - 54 * s, 8 * s, 8 * s);

  // 10. Head (with tilt rotation)
  ctx.save();
  ctx.translate(cx + pose.bodyLean * s, by - 58 * s);
  ctx.rotate(pose.headTilt);

  // Head shape — rounded rect with jaw
  ctx.fillStyle = this.rgb(darkenHex(skin, 20)); // outline
  this.roundRect(ctx, -11 * s, -12 * s, 22 * s, 22 * s, 7 * s);
  ctx.fill();
  ctx.fillStyle = this.rgb(skin);
  this.roundRect(ctx, -10 * s, -11 * s, 20 * s, 20 * s, 6 * s);
  ctx.fill();

  // 11. Eyes (whites, iris, highlight, eyebrows)
  // Eye whites
  ctx.fillStyle = '#e8e4e0';
  this.fillEllipse(ctx, -5 * s, -1 * s, 4 * s, 4.5 * s);
  this.fillEllipse(ctx, 5 * s, -1 * s, 4 * s, 4.5 * s);
  // Iris
  ctx.fillStyle = '#2a1a10';
  this.fillEllipse(ctx, -4 * s, 0, 2.5 * s, 3 * s);
  this.fillEllipse(ctx, 6 * s, 0, 2.5 * s, 3 * s);
  // Highlight
  ctx.fillStyle = '#ffffff';
  this.fillCircle(ctx, -3 * s, -1.5 * s, 1 * s);
  this.fillCircle(ctx, 7 * s, -1.5 * s, 1 * s);
  // Eyebrows (offset by pose.eyebrowRaise)
  ctx.fillStyle = this.rgb(hair);
  const browY = -6 * s - pose.eyebrowRaise * 2 * s;
  this.drawPart(ctx, -8 * s, browY, 6 * s, 2 * s, hair, 1 * s);
  this.drawPart(ctx, 2 * s, browY, 6 * s, 2 * s, hair, 1 * s);

  // 12. Nose, mouth
  ctx.fillStyle = this.rgb(darkenHex(skin, 15));
  this.fillCircle(ctx, 0, 3 * s, 1.5 * s);
  if (pose.mouthOpen) {
    ctx.fillStyle = '#3a1a10';
    this.fillEllipse(ctx, 0, 7 * s, 3 * s, 2 * s);
  } else {
    ctx.strokeStyle = this.rgb(darkenHex(skin, 25));
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(-3 * s, 7 * s);
    ctx.quadraticCurveTo(0, 9 * s, 3 * s, 7 * s);
    ctx.stroke();
  }

  // 13. Hair / hat / hood (head-local rotated space)
  ctx.fillStyle = this.rgb(hair);
  if (hs === 'short') {
    this.roundRect(ctx, -10 * s, -14 * s, 20 * s, 10 * s, 4 * s);
    ctx.fill();
  } else if (hs === 'long') {
    this.roundRect(ctx, -11 * s, -15 * s, 22 * s, 12 * s, 4 * s);
    ctx.fill();
    // Side hair
    ctx.fillRect(-11 * s, -6 * s, 4 * s, 16 * s);
    ctx.fillRect(7 * s, -6 * s, 4 * s, 16 * s);
  } else if (hs === 'hood') {
    ctx.fillStyle = this.rgb(npc.cloakColor ?? hair);
    ctx.beginPath();
    ctx.moveTo(0, -18 * s);
    ctx.lineTo(-14 * s, 5 * s);
    ctx.lineTo(14 * s, 5 * s);
    ctx.closePath(); ctx.fill();
    // Hood rim
    ctx.fillStyle = this.rgb(darkenHex(npc.cloakColor ?? hair, 15));
    ctx.beginPath();
    ctx.arc(0, 3 * s, 12 * s, Math.PI, 0);
    ctx.closePath(); ctx.fill();
  }

  // Hat (on top of hair, non-hood only)
  if (hs !== 'hood') {
    this.drawPart(ctx, -11 * s, -16 * s, 22 * s, 7 * s, npc.hatColor, 3 * s);
  }

  // 14. Beard (if present)
  if (npc.beard) {
    ctx.fillStyle = this.rgb(hair);
    ctx.beginPath();
    ctx.moveTo(-6 * s, 5 * s);
    ctx.lineTo(6 * s, 5 * s);
    ctx.lineTo(4 * s, 16 * s);
    ctx.lineTo(0, 18 * s);
    ctx.lineTo(-4 * s, 16 * s);
    ctx.closePath(); ctx.fill();
  }

  ctx.restore(); // end head rotation
}
```

- [ ] **Step 5: Update animation registration for 4 states per NPC**

Replace the NPC animation registration block (lines 1981-1996) with:

```typescript
// NPC state animations (4 per NPC: working, alert, idle, talking)
for (const npc of NPC_CONFIGS) {
  const key = npc.key;

  // Working (looping)
  const workKey = `${key}_working`;
  if (anims.exists(workKey)) anims.remove(workKey);
  let workRate = 5;
  if (npc.accessory === 'hammer' || npc.accessory === 'pickaxe') workRate = 6;
  else if (npc.accessory === 'staff' || npc.accessory === 'book') workRate = 3;
  else if (npc.accessory === 'lantern') workRate = 4;
  anims.create({
    key: workKey,
    frames: anims.generateFrameNumbers(key, { start: NPC_WORK_START, end: NPC_WORK_START + NPC_WORK_COUNT - 1 }),
    frameRate: workRate,
    repeat: -1,
  });

  // Alert (play once, hold last frame)
  const alertKey = `${key}_alert`;
  if (anims.exists(alertKey)) anims.remove(alertKey);
  anims.create({
    key: alertKey,
    frames: anims.generateFrameNumbers(key, { start: NPC_ALERT_START, end: NPC_ALERT_START + NPC_ALERT_COUNT - 1 }),
    frameRate: 6,
    repeat: 0, // play once
  });

  // Idle (looping)
  const idleKey = `${key}_idle`;
  if (anims.exists(idleKey)) anims.remove(idleKey);
  anims.create({
    key: idleKey,
    frames: anims.generateFrameNumbers(key, { start: NPC_IDLE_START, end: NPC_IDLE_START + NPC_IDLE_COUNT - 1 }),
    frameRate: 4,
    repeat: -1,
  });

  // Talking (looping)
  const talkKey = `${key}_talking`;
  if (anims.exists(talkKey)) anims.remove(talkKey);
  anims.create({
    key: talkKey,
    frames: anims.generateFrameNumbers(key, { start: NPC_TALK_START, end: NPC_TALK_START + NPC_TALK_COUNT - 1 }),
    frameRate: 5,
    repeat: -1,
  });
}
```

- [ ] **Step 6: Verify sprites render correctly**

Run: `npm run dev`
Expected: NPCs in camp render with new proportional sprites. They should be taller and more detailed than before — visible body shading, distinct eyes, proper clothing detail.

Note: The NPC.ts constructor currently plays `${spriteKey}_idle`. The `_idle` animation now maps to frames 12-17 (gentle breathing) instead of the old frames 0-7 (busy activity). This means NPCs will show a calm breathing animation instead of their working animation until Task 4 updates the constructor to use `_working`. This is a temporary visual regression — not a bug.

- [ ] **Step 7: Commit**

```bash
git add src/graphics/SpriteGenerator.ts
git commit -m "feat(npc): rewrite sprite generation with proportional art and 4-state animations"
```

---

## Chunk 3: NPC State Machine + VFX

### Task 4: Add state machine and ambient VFX to NPC entity

**Files:**
- Modify: `src/entities/NPC.ts` (full rewrite of class)

- [ ] **Step 1: Add imports and state type**

At the top of `src/entities/NPC.ts`, update imports:

```typescript
import Phaser from 'phaser';
import { TEXTURE_SCALE } from '../config';
import { cartToIso } from '../utils/IsometricUtils';
import { EventBus, GameEvents } from '../utils/EventBus';
import type { NPCDefinition } from '../data/types';

type NPCState = 'working' | 'alert' | 'idle' | 'talking';
```

- [ ] **Step 2: Add state machine properties**

Add new properties to the `NPC` class after the existing ones:

```typescript
state: NPCState = 'working';
private npcSprite: Phaser.GameObjects.Sprite | null = null;
private spriteKey: string = '';
private alertTimer: Phaser.Time.TimerEvent | null = null;
private stashOpen = false;
private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
```

- [ ] **Step 3: Update constructor to use _working animation and create VFX**

In the constructor, replace the sprite creation block (lines 26-37) with:

```typescript
// Use animated sprite sheet: try unique npc_<id> first, fall back to npc_<type>
const uniqueKey = `npc_${definition.id}`;
const typeKey = `npc_${definition.type}`;
this.spriteKey = scene.textures.exists(uniqueKey) ? uniqueKey : typeKey;
if (scene.textures.exists(this.spriteKey)) {
  this.npcSprite = scene.add.sprite(0, -40, this.spriteKey, 0).setScale(1 / TEXTURE_SCALE);
  this.sprite.add(this.npcSprite);
  const workKey = `${this.spriteKey}_working`;
  if (scene.anims.exists(workKey)) {
    this.npcSprite.play(workKey);
  } else {
    const idleKey = `${this.spriteKey}_idle`;
    if (scene.anims.exists(idleKey)) this.npcSprite.play(idleKey);
  }
} else {
  this.drawProceduralNPC(scene);
}
```

Note: The Y offset changes from `-32` to `-40` because the new sprites are taller (120 vs 80).

Also update the quest marker Y position from `-68` to `-80` and the hit zone dimensions:

```typescript
// Quest marker
if (definition.type === 'quest') {
  this.questMarker = scene.add.text(0, -80, '!', {
    // ... same style config ...
  }).setOrigin(0.5);
  // ...
}

// Name label — adjust Y for taller sprite
this.nameLabel = scene.add.text(0, 16, definition.name, {
  // ... same style config ...
}).setOrigin(0.5);

// Interactive hit area — taller to match new sprite
const hitZone = scene.add.rectangle(0, -28, 48, 90, 0xffffff, 0);
hitZone.setInteractive({ useHandCursor: true });
this.sprite.add(hitZone);
this.sprite.setSize(48, 90);
this.sprite.setInteractive(new Phaser.Geom.Rectangle(-24, -76, 48, 100), Phaser.Geom.Rectangle.Contains);
```

- [ ] **Step 4: Create ambient VFX emitter in constructor**

After the hit zone setup, add particle emitter creation:

```typescript
// Ambient VFX
this.createAmbientVFX();

// EventBus listeners for state transitions
this.setupEventListeners();
```

Implement `createAmbientVFX()`:

```typescript
private createAmbientVFX(): void {
  const type = this.definition.type;
  let particleKey = 'particle_spark';
  let tint = 0xffa040;
  let frequency = 400;
  let lifespan = 600;
  let speedY = { min: -30, max: -10 };
  let speedX = { min: -5, max: 5 };
  let alpha = { start: 0.6, end: 0 };
  let scale = { start: 0.4, end: 0.1 };
  let emitX = 12; // relative to NPC center (near right hand)
  let emitY = -30;

  switch (type) {
    case 'blacksmith':
      // Forge sparks — orange, drifting up from hammer
      particleKey = 'particle_spark';
      tint = 0xff8030;
      frequency = 400;
      lifespan = 500;
      break;
    case 'merchant':
      // Coin glints — gold, quick flash
      particleKey = 'particle_spark';
      tint = 0xffd700;
      frequency = 800;
      lifespan = 300;
      speedY = { min: -15, max: -5 };
      alpha = { start: 0.8, end: 0 };
      scale = { start: 0.3, end: 0 };
      emitX = 10;
      emitY = -20;
      break;
    case 'quest':
      // Mystic wisps — color from NPC's itemColor via spriteKey lookup
      particleKey = 'particle_circle';
      tint = this.getWispColor();
      frequency = 600;
      lifespan = 1200;
      speedY = { min: -10, max: -3 };
      speedX = { min: -12, max: 12 };
      alpha = { start: 0.4, end: 0 };
      scale = { start: 0.3, end: 0.15 };
      emitX = 0;
      emitY = -35;
      break;
    case 'stash':
      // Purple motes — dim, from book area
      particleKey = 'particle_circle';
      tint = 0x8a5ac0;
      frequency = 1000;
      lifespan = 800;
      speedY = { min: -20, max: -5 };
      alpha = { start: 0.35, end: 0 };
      scale = { start: 0.25, end: 0.1 };
      emitX = 8;
      emitY = -22;
      break;
  }

  if (this.scene.textures.exists(particleKey)) {
    this.emitter = this.scene.add.particles(emitX, emitY, particleKey, {
      tint,
      frequency,
      lifespan,
      speedY,
      speedX,
      alpha,
      scale,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.sprite.add(this.emitter);
  }
}

private getWispColor(): number {
  // Map NPC id to wisp color (from itemColor in NPC_CONFIGS)
  const colorMap: Record<string, number> = {
    quest_elder: 0xb8860b,
    quest_scout: 0x4a6a3a,
    forest_hermit: 0x5a8a4a,
    quest_dwarf: 0x8a7a5a,
    quest_nomad: 0xc09a30,
    quest_warden: 0x6a2a3a,
  };
  return colorMap[this.definition.id] ?? 0xb8860b;
}
```

- [ ] **Step 5: Implement setupEventListeners()**

```typescript
private setupEventListeners(): void {
  // Enter Talking state
  EventBus.on(GameEvents.NPC_INTERACT, (data: { npcId?: string }) => {
    if (data.npcId === this.definition.id) this.setState('talking');
  });
  EventBus.on(GameEvents.SHOP_OPEN, (data: { npcId?: string }) => {
    if (data.npcId === this.definition.id) this.setState('talking');
  });

  // Exit Talking state
  EventBus.on(GameEvents.DIALOGUE_CLOSE, () => {
    if (this.state === 'talking') this.setState('alert');
  });
  EventBus.on(GameEvents.SHOP_CLOSE, () => {
    if (this.state === 'talking') this.setState('alert');
  });

  // Stash toggle
  EventBus.on(GameEvents.UI_TOGGLE_PANEL, (data: { panel: string; npcId?: string }) => {
    if (data.panel === 'stash' && data.npcId === this.definition.id) {
      this.stashOpen = !this.stashOpen;
      if (this.stashOpen) {
        this.setState('talking');
      } else {
        this.setState('alert');
      }
    }
  });
}
```

- [ ] **Step 6: Implement setState() and update()**

```typescript
private setState(newState: NPCState): void {
  if (this.state === newState) return;
  this.state = newState;

  // Cancel pending alert timer
  if (this.alertTimer) {
    this.alertTimer.destroy();
    this.alertTimer = null;
  }

  // Update animation
  if (!this.npcSprite) return;
  const animKey = `${this.spriteKey}_${newState}`;
  if (this.scene.anims.exists(animKey)) {
    this.npcSprite.play(animKey);
  }

  // Toggle VFX — only active in working state
  if (this.emitter) {
    if (newState === 'working') {
      this.emitter.start();
    } else {
      this.emitter.stop();
    }
  }
}

update(playerCol: number, playerRow: number): void {
  const near = this.isNearPlayer(playerCol, playerRow, 3);

  switch (this.state) {
    case 'working':
      if (near) {
        this.setState('alert');
      }
      break;

    case 'alert':
      if (!near) {
        // Debounce: wait 500ms before going back to working
        if (!this.alertTimer) {
          this.alertTimer = this.scene.time.delayedCall(500, () => {
            this.alertTimer = null;
            if (this.state === 'alert') {
              this.setState('working');
            }
          });
        }
      } else {
        // Player still in range — cancel any pending return-to-working
        if (this.alertTimer) {
          this.alertTimer.destroy();
          this.alertTimer = null;
        }
      }
      break;

    case 'talking':
      // Stay in talking until EventBus says otherwise
      break;

    case 'idle':
      // Same as working for transition purposes
      if (near) {
        this.setState('alert');
      }
      break;
  }
}
```

- [ ] **Step 7: Add destroy() method for EventBus listener cleanup**

Add a `destroy()` method to the NPC class that cleans up EventBus listeners and timers. This prevents memory leaks on zone transitions.

```typescript
destroy(): void {
  EventBus.off(GameEvents.NPC_INTERACT);
  EventBus.off(GameEvents.SHOP_OPEN);
  EventBus.off(GameEvents.DIALOGUE_CLOSE);
  EventBus.off(GameEvents.SHOP_CLOSE);
  EventBus.off(GameEvents.UI_TOGGLE_PANEL);
  if (this.alertTimer) {
    this.alertTimer.destroy();
    this.alertTimer = null;
  }
  if (this.emitter) {
    this.emitter.destroy();
    this.emitter = null;
  }
  this.sprite.destroy();
}
```

Note: The existing fallback methods (`getNPCColor()`, `getHatColor()`, `drawProceduralNPC()`) are kept unchanged — they still serve as safety fallbacks when no sprite sheet texture is found.

- [ ] **Step 8: Add NPC update call in ZoneScene game loop**

In `src/scenes/ZoneScene.ts`, in the `update()` method, after the monster loop (after line 301) and before `this.handleCombat(time)` (line 304), add:

```typescript
// Update NPC state machines
for (const npc of this.npcs) {
  npc.update(this.player.tileCol, this.player.tileRow);
}
```

- [ ] **Step 9: Verify full NPC behavior**

Run: `npm run dev`
Expected:
1. NPCs display with new proportional sprites and "working" animation by default
2. Walk near an NPC → they transition to "alert" (head turn animation)
3. Walk away → after ~500ms they return to "working"
4. Click an NPC → dialogue/shop opens → NPC enters "talking" state (gestures)
5. Close dialogue/shop → NPC returns to "alert", then "working" when you walk away
6. Subtle particles visible: sparks near blacksmith, gold glints near merchant, wisps near quest givers, purple motes near stash keeper
7. Particles stop when NPC is in alert/talking state, resume when working

- [ ] **Step 10: Commit**

```bash
git add src/entities/NPC.ts src/scenes/ZoneScene.ts
git commit -m "feat(npc): add state machine with working/alert/talking states and ambient VFX"
```

---

### Task 5: Final adjustments and cleanup

**Files:**
- Possibly adjust: `src/entities/NPC.ts` (Y offsets, hit zones)
- Possibly adjust: `src/graphics/SpriteGenerator.ts` (drawing tweaks)

- [ ] **Step 1: Visual QA pass**

Run: `npm run dev`
Manually check each NPC in the camp:
- Do proportions look right? Head not too big/small?
- Are accessories visible and recognizable?
- Do animations look smooth? No jittering?
- Are name labels positioned correctly below the sprite?
- Are quest markers (!) positioned above the head?
- Is the hit zone large enough for easy clicking?
- Do particles blend well with the scene? Not too bright?

- [ ] **Step 2: Fix any visual issues found**

Adjust Y offsets, sizes, or drawing code as needed based on QA. Common issues:
- Name label too high/low: adjust the Y parameter in `nameLabel` creation
- Quest marker clipping into hat: adjust quest marker Y
- Particles too prominent: reduce alpha or increase frequency interval
- Sprite too large/small on screen: adjust `setScale(1 / TEXTURE_SCALE)` or the base frame size

- [ ] **Step 3: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix(npc): visual QA adjustments for proportional sprites"
```
