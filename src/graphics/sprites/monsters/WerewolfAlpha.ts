// src/graphics/sprites/monsters/WerewolfAlpha.ts
//
// 狼人首领 — the pack leader: a bigger, heavier werewolf with charcoal fur
// and a silver-backed mane, battle scars across muzzle and chest, a torn
// ear, blood-red eyes and a spiked iron collar trailing a snapped chain.
// Stands lower and wider than its kin, rears up to full height and brings
// both claws crashing down together.
import { CENTER_X, tone, vec } from '../rig/Rig';
import { werewolfDrawer, type WolfLook } from './Werewolf';

const ALPHA_LOOK: WolfLook = {
  fur: tone(0x4a4452, { light: 0.28 }),
  furFar: tone(0x2e2a36, { light: 0.14 }),
  mane: tone(0xc6cad8, { light: 0.45, shadow: 0.45 }),
  pale: tone(0x9e98a8, { light: 0.35 }),
  pants: tone(0x5a2436, { light: 0.2 }),
  claw: tone(0xf2ecdc, { light: 0.4, shadow: 0.3 }),
  nose: '#120e16',
  gum: '#7a1a2a',
  eye: 0xff3a2a,
  eyeCore: '#ffb4a0',
  furLine: 'rgba(16,12,22,0.6)',
  scars: true,
  tornEar: true,
  collar: true,
};

export const WerewolfAlphaDrawer = werewolfDrawer({
  key: 'monster_werewolf_alpha',
  // Wide for the bulk, tail and two-handed maul; width doesn't move the sprite in-game.
  frameW: 96,
  frameH: 68,
  scale: 1.52,
  look: ALPHA_LOOK,
  bulk: 1.2,
  attack: 'maul',
  shadowR: 15,
  ready: {
    root: vec(CENTER_X - 5, 67.5),
    lean: 0.92,
    head: -0.4,
    footN: vec(CENTER_X + 0.5, 91),
    footF: vec(CENTER_X - 12, 91),
    handN: vec(CENTER_X + 17, 79),
    handF: vec(CENTER_X + 9, 80),
    flow: 0.25,
  },
});
