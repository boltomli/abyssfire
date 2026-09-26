// src/graphics/sprites/monsters/GoblinChief.ts
//
// 哥布林首领 — a bulkier goblin warlord: horned iron helm with nose guard,
// wolf-pelt mantle with a skull pauldron, studded leather, red war paint
// and a huge rusted cleaver brought down in an overhead chop.
import {
  CENTER_X,
  GROUND_Y,
  blobPath,
  cel,
  ellipsePath,
  glow,
  inBone,
  lerpV,
  limb,
  polyPath,
  tone,
  vec,
  type V,
} from '../rig/Rig';
import { basePose, type HumanPose, type HumanSkin, type Skeleton } from '../rig/Humanoid';
import { humanoidMonster } from '../rig/MonsterKit';
import { goblinArm, goblinHand, goblinHead, goblinLeg, type GoblinLook } from './Goblin';

const LOOK: GoblinLook = {
  skin: tone(0x65913a, { light: 0.32 }),
  skinFar: tone(0x42632a, { light: 0.18 }),
  cloth: tone(0x6a3b24),
  strap: tone(0x3e2616),
};

const IRON = tone(0x7f8694, { light: 0.45 });
const IRON_DARK = tone(0x4d5260);
const HORN = tone(0xe6dab8, { light: 0.4, shadow: 0.3 });
const FUR = tone(0x7a6e62, { light: 0.35 });
const FUR_DARK = tone(0x4f463e);
const LEATHER = tone(0x5e3a22, { light: 0.3 });
const RUST = tone(0x9c5a2c);
const BONE = tone(0xece2c6, { light: 0.4, shadow: 0.3 });

function studdedTorso(ctx: CanvasRenderingContext2D, sk: Skeleton): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    const body = [vec(-6, 0.4), vec(1, -1), vec(6.6, 1.6), vec(8.6, len * 0.55), vec(6.6, len + 0.6), vec(-5.4, len + 0.8), vec(-7, len * 0.5)];
    cel(ctx, () => blobPath(ctx, body), LOOK.skin, { band: 1.6 });
    // Leather cuirass with iron studs
    const armor = [vec(-5.6, 3.6), vec(6.8, 3.4), vec(8, len * 0.62), vec(6.2, len - 1), vec(-5, len - 0.6), vec(-6.4, len * 0.5)];
    cel(ctx, () => blobPath(ctx, armor), LEATHER, { band: 1.2 });
    ctx.fillStyle = IRON.light;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillRect(-2.6 + c * 3.4, 5.4 + r * 3.2, 0.9, 0.9);
      }
    }
    // Belt with a trophy skull buckle
    cel(ctx, () => polyPath(ctx, [vec(-5.8, len - 1.6), vec(7.2, len - 2), vec(7.4, len + 0.8), vec(-5.8, len + 1.2)]), LOOK.strap, { band: 0.4 });
    cel(ctx, () => ellipsePath(ctx, vec(3.8, len - 0.4), 2, 1.8), BONE, { band: 0.4 });
    ctx.fillStyle = '#2a1a12';
    ctx.fillRect(3, len - 0.9, 0.7, 0.7);
    ctx.fillRect(4.3, len - 0.9, 0.7, 0.7);
    // Loincloth flaps
    cel(ctx, () => polyPath(ctx, [vec(0.8, len + 0.8), vec(7, len), vec(6.4, len + 8.4), vec(3.8, len + 7.2), vec(1.4, len + 8.6)]), LOOK.cloth, { band: 0.8 });
    // Wolf-pelt mantle
    const mantle = [vec(-8, 1.6), vec(-3, -2.2), vec(3.6, -1.6), vec(8.4, 1.8), vec(7.6, 5.6), vec(1, 6.6), vec(-6, 6.2), vec(-9.4, 4.6)];
    cel(ctx, () => blobPath(ctx, mantle), FUR, { band: 1.2 });
    ctx.strokeStyle = FUR_DARK.base;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const x = -7 + i * 2.7;
      ctx.beginPath();
      ctx.moveTo(x, 4.4);
      ctx.lineTo(x + 0.6, 6.8);
      ctx.stroke();
    }
  });
}

function hornedHelm(ctx: CanvasRenderingContext2D, sk: Skeleton): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  // Horns (far one first)
  cel(ctx, () => polyPath(ctx, [vec(-3, -5.4), vec(-7, -10), vec(-4.6, -14.6), vec(-3.6, -10), vec(-0.6, -6.6)]), tone(0xbcae8c), { band: 0.6 });
  // Dome
  const dome = [vec(-5.6, -1.4), vec(-4.6, -6.6), vec(1.2, -8.8), vec(6.4, -6), vec(7.6, -1.8), vec(2, -0.8)];
  cel(ctx, () => blobPath(ctx, dome), IRON, { band: 1.4, hi: 0.7 });
  // Rim band + nose guard
  cel(ctx, () => polyPath(ctx, [vec(-6, -2.4), vec(7.8, -2.8), vec(7.8, -1), vec(-6, -0.6)]), IRON_DARK, { band: 0.5 });
  cel(ctx, () => polyPath(ctx, [vec(6, -2), vec(7.6, -2), vec(7.8, 2.6), vec(6.8, 3.4)]), IRON_DARK, { band: 0.3 });
  ctx.fillStyle = IRON.light;
  for (const x of [-3.4, 0, 3.4]) ctx.fillRect(x, -2, 0.8, 0.8);
  // Near horn
  cel(ctx, () => polyPath(ctx, [vec(1.4, -7.6), vec(2.4, -12.6), vec(-1.6, -17.2), vec(0.6, -12.2), vec(-1.2, -7.8)]), HORN, { band: 0.7 });
  ctx.restore();
}

function warPaint(ctx: CanvasRenderingContext2D, sk: Skeleton): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  ctx.strokeStyle = 'rgba(190,30,30,0.9)';
  ctx.lineWidth = 0.8;
  for (const y of [1.4, 2.8]) {
    ctx.beginPath();
    ctx.moveTo(1.2, y);
    ctx.lineTo(4.2, y + 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

function skullPauldron(ctx: CanvasRenderingContext2D, sh: V): void {
  cel(ctx, () => ellipsePath(ctx, vec(sh.x + 0.4, sh.y - 0.4), 4, 3.4), BONE, { band: 0.9 });
  ctx.fillStyle = '#2a1a12';
  ctx.beginPath();
  ctx.ellipse(sh.x + 1.6, sh.y - 0.6, 0.9, 1.1, 0, 0, Math.PI * 2);
  ctx.ellipse(sh.x - 0.8, sh.y - 0.6, 0.9, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(sh.x - 0.2, sh.y + 1.2, 1.4, 1.2);
}

function cleaver(ctx: CanvasRenderingContext2D, at: V, angle: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  cel(ctx, () => polyPath(ctx, [vec(-0.9, 5), vec(0.9, 5), vec(0.9, -3), vec(-0.9, -3)]), LEATHER, { band: 0.3 });
  cel(ctx, () => ellipsePath(ctx, vec(0, 5.6), 1.3, 1.3), IRON_DARK, { band: 0.3 });
  // Broad chopping blade, spine on the back (−x), edge forward (+x)
  const blade = [vec(-1.6, -2.6), vec(1.4, -3.2), vec(6.4, -6.4), vec(6.8, -15.4), vec(-1.2, -16.8), vec(-2.2, -15)];
  cel(ctx, () => polyPath(ctx, blade), IRON, { band: 1, hi: 0.5 });
  // Rust blotches and a bright honed edge
  ctx.fillStyle = RUST.base;
  ctx.beginPath();
  ctx.ellipse(1.4, -12.2, 1.6, 1.1, 0.3, 0, Math.PI * 2);
  ctx.ellipse(3.6, -8, 1.1, 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(240,244,250,0.85)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(6.2, -6.8);
  ctx.lineTo(6.5, -15);
  ctx.stroke();
  ctx.fillStyle = '#2a2a30';
  ctx.beginPath();
  ctx.arc(0.6, -14.4, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const SKIN: HumanSkin = {
  prop: {
    thigh: 10.5, shin: 10.5, upperArm: 9, foreArm: 8.5,
    torso: 14.5, neck: 6.8, ankle: 1.8,
    hipN: vec(2, 0), hipF: vec(-2.4, -0.4),
    shN: vec(1.2, 3.4), shF: vec(-4.2, 3),
  },
  armFar(ctx, sk) {
    goblinArm(ctx, sk.shF, sk.elF, sk.handF, LOOK.skinFar);
    goblinHand(ctx, sk.handF, LOOK.skinFar);
  },
  legFar(ctx, sk) {
    goblinLeg(ctx, sk.hipF, sk.kneeF, sk.footF, sk.soleF, LOOK.skinFar);
  },
  legNear(ctx, sk) {
    goblinLeg(ctx, sk.hipN, sk.kneeN, sk.footN, sk.soleN, LOOK.skin);
    // Iron knee guard
    cel(ctx, () => ellipsePath(ctx, vec(sk.kneeN.x + 0.8, sk.kneeN.y), 2.4, 2.1), IRON, { band: 0.6 });
  },
  torso(ctx, sk) {
    studdedTorso(ctx, sk);
  },
  head(ctx, sk, p, t) {
    goblinHead(ctx, sk, p, t, LOOK, 1.6);
    warPaint(ctx, sk);
    hornedHelm(ctx, sk);
  },
  armNear(ctx, sk) {
    goblinArm(ctx, sk.shN, sk.elN, sk.handN, LOOK.skin);
    limb(ctx, lerpV(sk.elN, sk.handN, 0.2), lerpV(sk.elN, sk.handN, 0.8), 2.2, 2, LEATHER);
    skullPauldron(ctx, sk.shN);
  },
  weapon(ctx, sk, p) {
    cleaver(ctx, sk.handN, p.wpn);
    goblinHand(ctx, sk.handN, LOOK.skin);
  },
};

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 1.5, 71.5),
  lean: 0.24,
  head: -0.2,
  footN: vec(CENTER_X + 6, GROUND_Y),
  footF: vec(CENTER_X - 6.5, GROUND_Y),
  handN: vec(CENTER_X + 8, 67),
  handF: vec(CENTER_X + 2.5, 68),
  wpn: 0.9,
  flow: 0.1,
});

export const GoblinChiefDrawer = humanoidMonster({
  key: 'monster_goblin_chief',
  // Wide for the cleaver arc; width doesn't move the sprite in-game.
  frameW: 84,
  frameH: 68,
  scale: 1.32,
  skin: SKIN,
  ready: READY,
  attack: 'overhead',
  contactWpn: 2.1,
  walk: { stride: 6, lift: 3.4, bob: 1.5, lean: 0.06, armSwing: 2.4 },
  shadowR: 12,
  fx: (ctx, p, sk, act) => {
    // Elite menace: faint ember glow in the eyes
    if (act === 'death') return;
    const eye = vec(sk.head.x + Math.sin(sk.headAng + 1.2) * 5, sk.head.y - Math.cos(sk.headAng + 1.2) * 5);
    glow(ctx, eye, 2.4, 0xff5a2a, 0.35 + p.fx * 0.3);
  },
});
