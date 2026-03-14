# Character Animation System Design

## Problem

Player and monster sprites are static single-frame textures. Movement looks like sliding rigid bodies. No attack, skill, hit, or death animations exist on the character sprites themselves. SkillEffectSystem adds VFX particles but characters remain frozen.

## Approach

Tween-based animation on existing sprite Containers. No new textures or spritesheets. A `CharacterAnimator` class manipulates Container position offset, rotation, and scale to create the illusion of movement, weight, and impact.

## Architecture

### CharacterAnimator

Attaches to any entity's `Phaser.GameObjects.Container` and drives tweens based on state.

```
CharacterAnimator
  entity reference (Player | Monster)
  sprite container reference
  current state: AnimState
  active tweens registry (for cancellation)
  config: AnimConfig

  setState(newState) - cancels current tweens, plays new ones
  update(delta) - drives continuous animations (idle, walk)
  cleanup() - kills all tweens on destroy
```

### State Machine

```
idle <--> walk
idle <--> attack --> idle
idle <--> cast --> idle
any  --> hurt --> (previous state)
any  --> death (terminal)
```

### AnimConfig

```ts
interface AnimConfig {
  idleBobAmount: number;      // vertical bob pixels (2-4)
  idleBobSpeed: number;       // cycle duration ms (800-1200)
  idleScalePulse: number;     // breathing scale delta (0.02-0.05)

  walkBobAmount: number;      // bounce height (3-6)
  walkBobSpeed: number;       // per-step cycle ms (200-400)
  walkTilt: number;           // rotation degrees (3-8)
  walkSquash: number;         // horizontal squash on land (0.03-0.08)

  attackLunge: number;        // pixels toward target (8-16)
  attackDuration: number;     // lunge+recover ms (200-400)
  attackSquash: number;       // impact squash (0.1-0.2)
  attackWindup: number;       // pull-back before lunge ms (80-150)

  castLean: number;           // lean-back pixels (4-8)
  castDuration: number;       // full cast anim ms (300-500)
  castGlow: boolean;          // flash tint during cast

  hurtKnockback: number;      // recoil pixels (6-12)
  hurtDuration: number;       // stagger ms (150-250)
  hurtFlash: boolean;         // red tint flash

  deathStyle: 'collapse' | 'dissolve' | 'splat';
  deathDuration: number;      // ms (400-800)
}
```

### Preset Categories

| Category | Entities | Key traits |
|----------|----------|-----------|
| humanoid | Player (all classes), Goblin, Skeleton, Zombie | Standard bob, lunge attack, collapse death |
| slime | Slime | Exaggerated squash-stretch, splat death |
| beast | Werewolf, Scorpion | Fast aggressive lunge, wider tilt |
| large | Golem, Troll, Demon Lord | Slow heavy bob, ground-shake attack, slow collapse |
| flying | Gargoyle, Phoenix, Imp | Hover float (continuous Y oscillation), swoop attack |
| serpentine | Sandworm | Side-sway instead of bob, dissolve death |
| demonic | Lesser Demon, Succubus | Quick twitchy idle, dissolve death |

Player class tweaks on humanoid base:
- Warrior: larger attackLunge, more attackSquash (heavy hits)
- Mage: longer castDuration, castGlow true, smaller attackLunge
- Rogue: fastest attackDuration, more walkTilt (agile feel)

## Animation State Details

### Idle (looping, interruptible)
- Y offset: sine wave bob
- ScaleY: subtle pulse 1.0 to 1+idleScalePulse (breathing)
- Slimes: alternate scaleX/scaleY inversely (jelly wobble)
- Flying: larger Y amplitude + slight X drift

### Walk (looping while isMoving)
- Y offset: faster bounce synced to step rhythm
- Rotation: alternate left/right tilt per step
- ScaleX: brief squash on each landing
- Slimes: exaggerated stretch on rise, squash on land
- Flying: forward tilt + swoop motion

### Attack - melee (one-shot, returns to idle)
1. Windup (attackWindup ms): pull back away from target, scaleY compress
2. Lunge (100ms): snap toward target by attackLunge px, rotate toward target
3. Impact (50ms): brief scaleX squash, camera micro-shake for large types
4. Recover (remaining attackDuration): ease back to origin

### Cast - ranged/skill (one-shot, returns to idle)
1. Charge (40% of castDuration): lean back, scale up 1.05
2. Release (30%): snap forward, brief tint flash
3. Settle (30%): ease to neutral

### Hurt (one-shot, resumes previous state)
- Snap hurtKnockback px away from damage source
- Red tint flash (100ms)
- ScaleX squeeze (flinch)
- Ease back over hurtDuration
- Replaces existing takeDamage tint logic in Monster.ts

### Death (one-shot, terminal)
- collapse: rotation 90 deg, drop Y, scaleY to 0.2, fade alpha to 0
- splat (slimes): scaleY to 0.1, scaleX to 2.0, fade out
- dissolve (demons/worm): flicker alpha rapidly, scale down, fade

## File Changes

### New
- `src/systems/CharacterAnimator.ts` - AnimConfig, preset configs, CharacterAnimator class

### Modified
- `Player.ts` - Add animator field, create in constructor, call update(), delegate attack/cast/hurt/death
- `Monster.ts` - Add animator field, config by category, call update(), replace takeDamage tint and die() fade with animator calls
- `ZoneScene.ts` - Trigger player.playAttack/playCast/playHurt on combat events, trigger monster attack anims
- `data/types.ts` - Add optional monsterCategory to MonsterDefinition
- Monster data files - Add category field per monster

### Not modified
- `BootScene.ts` - No new textures needed
- `SkillEffectSystem.ts` - Continues independently (VFX particles layer on top)
- `CombatSystem.ts` - Pure calculation, no visual concern

## Key Constraints
- CharacterAnimator stores a tween registry and cancels active tweens before starting new ones (no animation conflicts)
- All animations apply to the Container so HP bars and shadows move naturally
- Config-driven: same code, different feel per entity type
