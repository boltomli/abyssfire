// src/graphics/sprites/monsters/Goblin.ts
//
// 哥布林 — hunched, big-headed raider with swept-back ears, a hooked nose,
// toothy grin, bone necklace and a crude stone-tipped spear.
import {
  CENTER_X,
  GROUND_Y,
  blobPath,
  cel,
  ellipsePath,
  inBone,
  lerpV,
  limb,
  polyPath,
  tone,
  vec,
  type Tone,
  type V,
} from '../rig/Rig';
import { basePose, type HumanPose, type HumanSkin, type Skeleton } from '../rig/Humanoid';
import { humanoidMonster } from '../rig/MonsterKit';

export interface GoblinLook {
  skin: Tone;
  skinFar: Tone;
  cloth: Tone;
  strap: Tone;
}

export const GOBLIN_LOOK: GoblinLook = {
  skin: tone(0x76a33e, { light: 0.35 }),
  skinFar: tone(0x4e742a, { light: 0.2 }),
  cloth: tone(0x7c4f2d),
  strap: tone(0x4a2f1c),
};

const BONE = tone(0xece2c6, { light: 0.4, shadow: 0.3 });
const WOOD = tone(0x7b5330, { light: 0.3 });
const STONE = tone(0x9a948a, { light: 0.45 });
const ROPE = tone(0xb89a62);

export function goblinFoot(ctx: CanvasRenderingContext2D, ankle: V, sole: V, t: Tone): void {
  cel(ctx, () => polyPath(ctx, [
    vec(ankle.x - 2, ankle.y - 1), vec(ankle.x + 1.6, ankle.y - 1.4),
    vec(sole.x + 5.4, sole.y - 1.4), vec(sole.x + 6, sole.y), vec(sole.x - 2.4, sole.y),
  ]), t, { band: 0.7 });
  ctx.fillStyle = BONE.base;
  ctx.fillRect(sole.x + 5.2, sole.y - 1, 1.2, 0.9);
}

export function goblinLeg(ctx: CanvasRenderingContext2D, hip: V, knee: V, ankle: V, sole: V, t: Tone): void {
  limb(ctx, hip, knee, 2.7, 2.1, t);
  limb(ctx, knee, ankle, 2.1, 1.7, t);
  goblinFoot(ctx, ankle, sole, t);
}

export function goblinArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, t: Tone): void {
  limb(ctx, sh, el, 2.3, 1.9, t);
  limb(ctx, el, hand, 1.9, 1.7, t);
}

export function goblinHand(ctx: CanvasRenderingContext2D, at: V, t: Tone): void {
  cel(ctx, () => ellipsePath(ctx, at, 2.3, 2.1), t, { band: 0.6 });
  ctx.fillStyle = BONE.shade;
  ctx.fillRect(at.x + 1.4, at.y + 0.8, 1, 0.8);
}

export function goblinTorso(ctx: CanvasRenderingContext2D, sk: Skeleton, look: GoblinLook): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Pot belly
    const body = [vec(-4.6, 0.4), vec(1, -0.6), vec(5, 1.8), vec(7.2, len * 0.6), vec(5.2, len + 0.6), vec(-4, len + 0.8), vec(-5.6, len * 0.5)];
    cel(ctx, () => blobPath(ctx, body), look.skin, { band: 1.5 });
    // Belly highlight
    ctx.fillStyle = 'rgba(255,250,210,0.14)';
    ctx.beginPath();
    ctx.ellipse(3.4, len * 0.6, 2.4, 3.4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Shoulder strap
    cel(ctx, () => polyPath(ctx, [vec(-3.6, 0), vec(-1.6, -0.4), vec(5.8, len * 0.72), vec(4.4, len * 0.86)]), look.strap, { band: 0.4 });
    // Rope belt + loincloth
    cel(ctx, () => polyPath(ctx, [vec(-4.8, len - 1), vec(6, len - 1.6), vec(6.2, len + 0.6), vec(-4.8, len + 1)]), ROPE, { band: 0.4 });
    cel(ctx, () => polyPath(ctx, [vec(0.6, len), vec(6.4, len - 0.8), vec(5.8, len + 7.2), vec(3.4, len + 6.2), vec(1.2, len + 7.4)]), look.cloth, { band: 0.8 });
    // Bone-tooth necklace
    for (let i = 0; i < 4; i++) {
      const b = lerpV(vec(-1.8, 1.6), vec(4.8, 2.8), i / 3);
      cel(ctx, () => polyPath(ctx, [vec(b.x - 0.6, b.y), vec(b.x + 0.6, b.y), vec(b.x, b.y + 2.2)]), BONE, { band: 0.2, stroke: 0.3 });
    }
  });
}

/** Big goblin head: ears, hooked nose, grin, glaring eyes. */
export function goblinHead(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number, look: GoblinLook, grin = 1): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  const flick = Math.sin(t * Math.PI * 2 + 1) * 0.6 + p.flow * 1.5;
  // Far ear
  cel(ctx, () => polyPath(ctx, [vec(-2.4, -2.6), vec(-12.5 - flick, -6.5), vec(-3, 1)]), look.skinFar, { band: 0.8 });
  // Cranium + jaw
  const skull = [vec(-5.8, -1), vec(-4.8, -6), vec(1, -7.6), vec(6, -5), vec(7.4, 0), vec(6.6, 4.6), vec(1.4, 6.4), vec(-4.2, 4.6)];
  cel(ctx, () => blobPath(ctx, skull), look.skin, { band: 1.5 });
  // Brow ridge
  cel(ctx, () => polyPath(ctx, [vec(0.8, -3.6), vec(7.2, -2.4), vec(7, -1), vec(1, -1.8)]), look.skinFar, { band: 0.4, stroke: 0.3 });
  // Eyes: yellow with slit pupils
  cel(ctx, () => ellipsePath(ctx, vec(4.4, -0.6), 1.7, 1.2), tone(0xffd83a, { light: 0.4 }), { band: 0.3, stroke: 0.35 });
  ctx.fillStyle = '#1a0e08';
  ctx.fillRect(4.7, -1.5, 0.7, 1.8);
  cel(ctx, () => ellipsePath(ctx, vec(7.3, -0.3), 0.8, 1), tone(0xe0b82e), { band: 0.2, stroke: 0.3 });
  // Hooked nose
  cel(ctx, () => polyPath(ctx, [vec(6, -1), vec(10.8, 1.6), vec(9.6, 3.2), vec(6.8, 2.4)]), look.skin, { band: 0.6, stroke: 0.45 });
  // Grin with teeth
  ctx.fillStyle = '#2a0f0a';
  ctx.beginPath();
  ctx.moveTo(2, 3.2);
  ctx.quadraticCurveTo(5.4, 5.4 + grin, 8, 3.4);
  ctx.quadraticCurveTo(5.4, 4.2, 2, 3.2);
  ctx.fill();
  ctx.fillStyle = BONE.base;
  for (const x of [3.4, 5, 6.6]) ctx.fillRect(x, 3.6, 0.8, 1.1);
  // Near ear (in front of the head)
  cel(ctx, () => polyPath(ctx, [vec(-3, -2), vec(-13.5 - flick * 1.2, -4.2), vec(-11 - flick, -2.4), vec(-3.4, 2)]), look.skin, { band: 0.9 });
  ctx.strokeStyle = look.skinFar.shade;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-4.4, -0.8);
  ctx.lineTo(-11 - flick, -3.4);
  ctx.stroke();
  ctx.restore();
}

function spear(ctx: CanvasRenderingContext2D, at: V, angle: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  cel(ctx, () => polyPath(ctx, [vec(-0.7, 9), vec(0.7, 9), vec(0.6, -12), vec(-0.6, -12)]), WOOD, { band: 0.3, hi: 0.2 });
  // Rope binding
  cel(ctx, () => polyPath(ctx, [vec(-1, -12.8), vec(1, -12.8), vec(1, -10.8), vec(-1, -10.8)]), ROPE, { band: 0.3 });
  // Knapped stone head
  cel(ctx, () => polyPath(ctx, [vec(-1.8, -12.6), vec(0, -18.4), vec(1.8, -12.6), vec(0, -11.4)]), STONE, { band: 0.6, hi: 0.4 });
  ctx.restore();
}

const SKIN: HumanSkin = {
  prop: {
    thigh: 9, shin: 9, upperArm: 7.6, foreArm: 7.2,
    torso: 12.5, neck: 6.2, ankle: 1.6,
    hipN: vec(1.6, 0), hipF: vec(-2, -0.4),
    shN: vec(1, 3), shF: vec(-3.2, 2.6),
  },
  armFar(ctx, sk) {
    goblinArm(ctx, sk.shF, sk.elF, sk.handF, GOBLIN_LOOK.skinFar);
    goblinHand(ctx, sk.handF, GOBLIN_LOOK.skinFar);
  },
  legFar(ctx, sk) {
    goblinLeg(ctx, sk.hipF, sk.kneeF, sk.footF, sk.soleF, GOBLIN_LOOK.skinFar);
  },
  legNear(ctx, sk) {
    goblinLeg(ctx, sk.hipN, sk.kneeN, sk.footN, sk.soleN, GOBLIN_LOOK.skin);
  },
  torso(ctx, sk) {
    goblinTorso(ctx, sk, GOBLIN_LOOK);
  },
  head(ctx, sk, p, t) {
    goblinHead(ctx, sk, p, t, GOBLIN_LOOK);
  },
  armNear(ctx, sk) {
    goblinArm(ctx, sk.shN, sk.elN, sk.handN, GOBLIN_LOOK.skin);
  },
  weapon(ctx, sk, p) {
    spear(ctx, sk.handN, p.wpn);
    goblinHand(ctx, sk.handN, GOBLIN_LOOK.skin);
  },
};

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 1, 74),
  lean: 0.34,
  head: -0.3,
  footN: vec(CENTER_X + 5, GROUND_Y),
  footF: vec(CENTER_X - 5.5, GROUND_Y),
  handN: vec(CENTER_X + 7, 70),
  handF: vec(CENTER_X + 3, 71),
  wpn: 1.2,
  flow: 0.1,
});

export const GoblinDrawer = humanoidMonster({
  key: 'monster_goblin',
  // Wider than tall so the spear thrust isn't clipped (width doesn't move the sprite).
  frameW: 72,
  frameH: 56,
  scale: 1.45,
  skin: SKIN,
  ready: READY,
  attack: 'thrust',
  contactWpn: 1.5,
  walk: { stride: 5.5, lift: 3.4, bob: 1.3, lean: 0.06, armSwing: 2.6 },
  shadowR: 10,
});
