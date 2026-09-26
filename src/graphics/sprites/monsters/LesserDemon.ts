// src/graphics/sprites/monsters/LesserDemon.ts
//
// 下级恶魔 — a hunched, gorilla-armed brute of cold crimson hide and black
// carapace. Forward-hooked bull horns, a tusked underbite, a barrel chest
// split by molten hellfire cracks, broken slave shackles on its wrists and
// cloven digitigrade hooves. It rears up, hands locked overhead while its
// chest furnace flares, then hammers both fists into the ground in a burst
// of abyssfire.
import type { MonsterAction } from '../types';
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
  type Key,
  type Tone,
  type V,
} from '../rig/Rig';
import { basePose, spun, type HumanPose, type HumanSkin, type Skeleton } from '../rig/Humanoid';
import { humanoidMonster } from '../rig/MonsterKit';
import { curlChain, demonTail, embers, flameTongue, hash01, hornPath, hornRidges, localPt } from './Imp';

const HIDE = tone(0x7a1c32, { light: 0.32 });
const HIDE_FAR = tone(0x4e1024, { light: 0.16 });
const CARAPACE = tone(0x2e1a2c, { light: 0.34 });
const CARAPACE_FAR = tone(0x1e1220, { light: 0.2 });
const HORN = tone(0x33262e, { light: 0.35 });
const HORN_TIP = tone(0xcfbd9c, { light: 0.4 });
const TALON = tone(0x1c1418, { light: 0.4 });
const IRON = tone(0x5c5866, { light: 0.4 });
const CLOTH = tone(0x221420, { light: 0.2 });
const TUSK = tone(0xece0c2, { light: 0.4, shadow: 0.3 });
const HELLFIRE = 0xff5a14;
const CORE = 0xffc050;

/** Neck juts forward from the hump; the face is counter-rotated upright. */
const HT = 0.95;

const PROP = {
  thigh: 11, shin: 10.5, upperArm: 11.5, foreArm: 11,
  torso: 17, neck: 5.6, ankle: 5,
  hipN: vec(2.6, 0), hipF: vec(-3, -0.6),
  shN: vec(3, 4.2), shF: vec(-6, 3.4),
};

// ── Parts ───────────────────────────────────────────────────────────────

/** Digitigrade leg: thick thigh, back-slanted shin, raised hock, cloven hoof. */
function leg(ctx: CanvasRenderingContext2D, hip: V, knee: V, ankle: V, sole: V, t: Tone, plate: Tone): void {
  limb(ctx, hip, knee, 4.6, 3.6, t);
  limb(ctx, knee, ankle, 3.2, 2.2, t);
  const toe = vec(sole.x + 4.6, sole.y - 1.2);
  limb(ctx, ankle, toe, 2.1, 1.8, t);
  // Carapace knee plate with a spur
  cel(ctx, () => polyPath(ctx, [vec(knee.x - 1.6, knee.y - 3), vec(knee.x + 3.4, knee.y - 1.4), vec(knee.x + 4.2, knee.y + 1.6), vec(knee.x - 0.4, knee.y + 3)]), plate, { band: 0.7 });
  // Cloven hoof
  cel(ctx, () => polyPath(ctx, [vec(toe.x - 2.6, toe.y - 1.4), vec(toe.x + 2.4, toe.y - 1.6), vec(toe.x + 4, sole.y), vec(toe.x - 3, sole.y)]), TALON, { band: 0.6 });
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(toe.x + 1, toe.y - 1);
  ctx.lineTo(toe.x + 1.4, sole.y);
  ctx.stroke();
}

function shackle(ctx: CanvasRenderingContext2D, el: V, hand: V, far: boolean, swing: number): void {
  const at = lerpV(el, hand, 0.72);
  const ang = Math.atan2(hand.y - el.y, hand.x - el.x);
  const P = (x: number, y: number): V => localPt(at, ang, x, y);
  cel(ctx, () => polyPath(ctx, [P(-1.6, -3.6), P(1.6, -3.4), P(1.6, 3.4), P(-1.6, 3.6)]), far ? CARAPACE_FAR : IRON, { band: 0.6 });
  ctx.fillStyle = IRON.light;
  ctx.fillRect(P(0, -2).x - 0.4, P(0, -2).y - 0.4, 0.8, 0.8);
  if (far) return;
  // Broken chain hanging from the cuff
  let prev = P(0, 3.4);
  for (let i = 0; i < 4; i++) {
    const nxt = vec(prev.x - swing * 0.6 - 0.2 * i, prev.y + 2);
    ctx.strokeStyle = IRON.line;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse((prev.x + nxt.x) / 2, (prev.y + nxt.y) / 2, i % 2 ? 0.55 : 0.95, 1.25, Math.atan2(nxt.y - prev.y, nxt.x - prev.x) + Math.PI / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = IRON.base;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    prev = nxt;
  }
}

function clawHand(ctx: CanvasRenderingContext2D, el: V, hand: V, t: Tone, fire: number): void {
  const ang = Math.atan2(hand.y - el.y, hand.x - el.x);
  const P = (a: number, x: number, y: number): V => localPt(hand, ang + a, x, y);
  cel(ctx, () => blobPath(ctx, [P(0, -2.4, -2.2), P(0, 2, -2.8), P(0, 3.6, 0), P(0, 2.2, 2.8), P(0, -2.4, 2.4)]), t, { band: 0.9 });
  const hot = fire > 0.75;
  for (let i = -1; i <= 1; i++) {
    const a = i * 0.42;
    cel(ctx, () => {
      const b1 = P(a, 2.8, -0.9);
      const b2 = P(a, 2.8, 0.9);
      const tip = P(a + 0.35, 7.4, 1.8);
      hornPath(ctx, b1, b2, P(a, 6.2, -0.6), tip);
    }, hot ? tone(0xff9a3a, { light: 0.5 }) : TALON, { band: 0.3, stroke: 0.35 });
  }
  // Thumb talon
  cel(ctx, () => polyPath(ctx, [P(0, 0.6, -2.4), P(0, 4.2, -3.8), P(0, 1.8, -1.2)]), hot ? tone(0xff9a3a) : TALON, { band: 0.2, stroke: 0.3 });
}

function arm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean, fire: number, swing: number): void {
  const t = far ? HIDE_FAR : HIDE;
  const plate = far ? CARAPACE_FAR : CARAPACE;
  limb(ctx, sh, el, 4.8, 3.6, t);
  // Bulging bicep
  cel(ctx, () => ellipsePath(ctx, lerpV(sh, el, 0.45), 4.4, 3.2, Math.atan2(el.y - sh.y, el.x - sh.x)), t, { band: 1.2 });
  limb(ctx, el, hand, 4.2, 3.1, t);
  // Carapace bracer along the outer forearm
  const ang = Math.atan2(hand.y - el.y, hand.x - el.x);
  cel(ctx, () => blobPath(ctx, [localPt(el, ang, 0.5, -3.6), localPt(el, ang, 7, -3.4), localPt(el, ang, 8.4, -1.4), localPt(el, ang, 1.6, -0.6), localPt(el, ang, -1.4, -2.6)]), plate, { band: 0.6 });
  // Elbow spike
  const up = Math.atan2(el.y - sh.y, el.x - sh.x);
  cel(ctx, () => polyPath(ctx, [localPt(el, up, -0.8, -2.6), localPt(el, up, 4.4, -1.6), localPt(el, up, 0.8, 1)]), plate, { band: 0.3 });
  shackle(ctx, el, hand, far, swing);
  clawHand(ctx, el, hand, t, fire);
}

function shoulderPlate(ctx: CanvasRenderingContext2D, sh: V, lean: number, far: boolean): void {
  const plate = far ? CARAPACE_FAR : CARAPACE;
  ctx.save();
  ctx.translate(sh.x, sh.y);
  ctx.rotate(lean * 0.9);
  ctx.translate(-0.5, -2.2);
  cel(ctx, () => blobPath(ctx, [vec(-5.4, 1.6), vec(-4.6, -2.6), vec(0, -4.2), vec(4.8, -2.6), vec(5.6, 1.8), vec(0, 3.2)]), plate, { band: 1 });
  // Two backward-raked spikes
  for (const [x, h] of [[-2.4, 6], [1.6, 4.4]] as const) {
    cel(ctx, () => polyPath(ctx, [vec(x - 1.6, -3.8), vec(x - 3.6, -3.8 - h), vec(x + 1.4, -4.4)]), HORN, { band: 0.4 });
  }
  ctx.restore();
}

function torso(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Loincloth behind + in front of the hips
    const sway = Math.sin(t * Math.PI * 2) * 0.5 - p.flow * 2;
    cel(ctx, () => polyPath(ctx, [vec(-6.4, len - 1), vec(-2.4, len - 1), vec(-3 + sway, len + 9), vec(-4.6 + sway, len + 7.6), vec(-6.6 + sway, len + 9.4)]), CLOTH, { band: 0.8 });
    // Dorsal spikes along the hunched spine
    for (let i = 0; i < 4; i++) {
      const y = -2.4 + i * 3.8;
      const h = 4.6 - i * 0.8;
      const x = -8.4 - (i === 0 ? -1 : 0.4);
      cel(ctx, () => polyPath(ctx, [vec(x, y - 1.6), vec(x - h, y + 0.6), vec(x + 0.4, y + 2.2)]), HORN, { band: 0.3 });
    }
    // Barrel chest tapering to the waist
    const body = [vec(-9.6, 1.4), vec(-6, -4.6), vec(1, -5.2), vec(7.4, -2), vec(11.4, 4), vec(10.4, len * 0.55), vec(6.6, len - 1), vec(-5.4, len + 0.6), vec(-9.4, len * 0.5)];
    cel(ctx, () => blobPath(ctx, body), HIDE, { band: 2, hi: 0.9 });
    // Pectoral + ab contours
    ctx.strokeStyle = HIDE.shade;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(1, 6.6);
    ctx.quadraticCurveTo(6, 8.6, 9.6, 5.6);
    ctx.moveTo(4, len * 0.62);
    ctx.lineTo(8.4, len * 0.6);
    ctx.moveTo(3.6, len * 0.78);
    ctx.lineTo(7.6, len * 0.77);
    ctx.stroke();
    // Molten cracks radiating from the heart furnace
    const heat = 0.55 + p.fx * 0.45;
    const cx = 5.4;
    const cy = 4.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const cracks: V[][] = [
      [vec(cx, cy), vec(cx + 2.4, cy - 2.4), vec(cx + 3.2, cy - 4.2)],
      [vec(cx, cy), vec(cx + 3.6, cy + 0.8), vec(cx + 4.6, cy + 3.4)],
      [vec(cx, cy), vec(cx - 1.4, cy + 3.4), vec(cx + 0.2, cy + 6.4), vec(cx - 0.6, cy + 8.8)],
      [vec(cx, cy), vec(cx - 3, cy - 1.4), vec(cx - 5, cy - 0.2)],
    ];
    for (const [w, col] of [[1.6, `rgba(120,20,10,${0.9})`], [0.9, `rgba(255,${110 + p.fx * 60},30,${heat})`], [0.35, `rgba(255,230,150,${heat})`]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      for (const c of cracks) {
        ctx.beginPath();
        ctx.moveTo(c[0].x, c[0].y);
        for (let i = 1; i < c.length; i++) ctx.lineTo(c[i].x, c[i].y);
        ctx.stroke();
      }
    }
    ctx.fillStyle = `rgba(255,200,90,${heat})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 1.5 + p.fx * 0.6, 1.8 + p.fx * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Iron-ringed war belt + front flap
    cel(ctx, () => polyPath(ctx, [vec(-6, len - 2.2), vec(8, len - 3.2), vec(8.6, len - 0.2), vec(-6, len + 1)]), CARAPACE, { band: 0.5 });
    cel(ctx, () => ellipsePath(ctx, vec(5.2, len - 1.4), 1.7, 1.7), IRON, { band: 0.4 });
    ctx.fillStyle = CARAPACE.shade;
    ctx.beginPath();
    ctx.arc(5.2, len - 1.4, 0.8, 0, Math.PI * 2);
    ctx.fill();
    const fs = sway * 0.6;
    cel(ctx, () => polyPath(ctx, [vec(1.4, len - 0.4), vec(8, len - 1), vec(7 + fs, len + 8), vec(5 + fs, len + 6.6), vec(3 + fs, len + 8.4), vec(1.6 + fs, len + 6)]), CLOTH, { band: 0.7 });
  });
}

function head(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng - HT);
  // Far horn (behind the skull)
  const f = [vec(-3.6, -3.6), vec(0.2, -5.4), vec(-8, -13), vec(1.4, -17.6)] as const;
  cel(ctx, () => hornPath(ctx, f[0], f[1], f[2], f[3]), tone(0x241a22), { band: 0.6 });
  // Blocky skull with a heavy underbite jaw
  const skull = [vec(-5.4, -1.6), vec(-4, -5.4), vec(1.8, -6.4), vec(6.4, -4), vec(7.6, 0), vec(8.4, 3.4), vec(6.6, 6.4), vec(0.6, 6.8), vec(-4.2, 4)];
  cel(ctx, () => blobPath(ctx, skull), HIDE, { band: 1.4 });
  // Bony brow shelf
  cel(ctx, () => polyPath(ctx, [vec(0.4, -3.6), vec(5.6, -4.4), vec(8.4, -2), vec(7.6, -0.8), vec(3, -1.6), vec(0.4, -1.8)]), CARAPACE, { band: 0.4, stroke: 0.35 });
  // Eyes: deep sockets with hellfire pupils
  ctx.fillStyle = '#12060a';
  ctx.beginPath();
  ctx.ellipse(5.2, -0.3, 1.9, 1.1, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgb(255,${120 + p.fx * 80},40)`;
  ctx.beginPath();
  ctx.ellipse(5.5, -0.3, 1.2, 0.65, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // Nostril slits
  ctx.fillStyle = '#1c0810';
  ctx.fillRect(7.6, 1.4, 0.9, 0.5);
  // Jaw line, lower tusks jutting up past the lip
  ctx.strokeStyle = HIDE.line;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(1.6, 3.6);
  ctx.quadraticCurveTo(5, 4.4 + p.fx, 8.2, 3.4);
  ctx.stroke();
  for (const [x, h] of [[7, 3.2], [3.8, 2.4]] as const) {
    cel(ctx, () => polyPath(ctx, [vec(x - 0.8, 4.6), vec(x + 0.2, 4.6 - h), vec(x + 0.9, 4.4)]), TUSK, { band: 0.2, stroke: 0.3 });
  }
  // Near horn: thick bull horn sweeping out, forward and up
  const b1 = vec(-2.6, -4.6);
  const b2 = vec(2.8, -6.2);
  const ctrl = vec(-4.6, -14.4);
  const tip = vec(6.4, -17.4);
  cel(ctx, () => hornPath(ctx, b1, b2, ctrl, tip), HORN, { band: 0.9 });
  hornRidges(ctx, b1, b2, ctrl, tip, 4, HORN.shade, 0.5);
  cel(ctx, () => hornPath(ctx, lerpV(b1, tip, 0.72), lerpV(b2, tip, 0.72), lerpV(ctrl, tip, 0.6), tip), HORN_TIP, { band: 0.3, stroke: 0.3 });
  ctx.restore();
}

// ── Skin ────────────────────────────────────────────────────────────────

const SKIN: HumanSkin = {
  prop: PROP,
  back(ctx, sk, p, t) {
    const root = localPt(sk.pelvis, p.lean * 0.3, -5, 1);
    const tail = curlChain(root, -2.3 + p.lean * 0.3, 1.2, 15, 7, 1 + p.flow, t * Math.PI * 2);
    demonTail(ctx, tail, 2.2, HIDE_FAR, HORN, 3);
  },
  armFar(ctx, sk, p, t) {
    shoulderPlate(ctx, sk.shF, p.lean, true);
    arm(ctx, sk.shF, sk.elF, sk.handF, true, p.fx, 0);
    void t;
  },
  legFar(ctx, sk) {
    leg(ctx, sk.hipF, sk.kneeF, sk.footF, sk.soleF, HIDE_FAR, CARAPACE_FAR);
  },
  legNear(ctx, sk) {
    leg(ctx, sk.hipN, sk.kneeN, sk.footN, sk.soleN, HIDE, CARAPACE);
  },
  torso(ctx, sk, p, t) {
    torso(ctx, sk, p, t);
  },
  head(ctx, sk, p) {
    head(ctx, sk, p);
  },
  armNear(ctx, sk, p, t) {
    arm(ctx, sk.shN, sk.elN, sk.handN, false, p.fx, Math.sin(t * Math.PI * 2) + p.flow * 2);
    shoulderPlate(ctx, sk.shN, p.lean, false);
  },
  weapon() {
    // Bare claws — drawn with the arm.
  },
};

// ── Animation ───────────────────────────────────────────────────────────

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 4, 68),
  lean: 0.55,
  head: -0.62 + HT,
  footN: vec(CENTER_X + 5, GROUND_Y),
  footF: vec(CENTER_X - 10, GROUND_Y),
  handN: vec(CENTER_X + 15, 79),
  handF: vec(CENTER_X + 8, 80),
  flow: 0.1,
});

const P = (o: Partial<HumanPose>): HumanPose => ({ ...READY, ...o });
const R = READY.root;

const ATTACK: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.33, ease: 'out', pose: P({
    root: vec(R.x - 3, R.y - 2), lean: -0.02, head: -0.42 + HT,
    handN: vec(R.x + 3, 32), handF: vec(R.x - 2, 33),
    footN: vec(CENTER_X + 7, GROUND_Y), footF: vec(CENTER_X - 10, GROUND_Y),
    fx: 0.65, stretch: 0.06, flow: 0.2,
  }) },
  { at: 0.67, ease: 'in', pose: P({
    root: vec(R.x + 1, R.y - 0.5), lean: 0.35, head: -0.2 + HT,
    handN: vec(R.x + 17, 36), handF: vec(R.x + 13, 38),
    footN: vec(CENTER_X + 10, GROUND_Y), footF: vec(CENTER_X - 9, GROUND_Y),
    fx: 0.85, stretch: 0.03, flow: 0.4,
  }) },
  { at: 1, ease: 'linear', pose: P({
    root: vec(R.x + 4.5, R.y + 4.5), lean: 0.95, head: -0.05 + HT,
    handN: vec(R.x + 24, 88), handF: vec(R.x + 20, 89),
    footN: vec(CENTER_X + 11, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    fx: 1, stretch: -0.06, flow: 0.6,
  }) },
];

const RECOIL = P({
  root: vec(R.x - 3.5, R.y - 0.5), lean: 0.02, head: -0.7 + HT,
  handN: vec(R.x + 6, 64), handF: vec(R.x + 1, 66),
  footF: vec(CENTER_X - 11, GROUND_Y), flow: 0.45, stretch: -0.02,
});

const HURT: Key<HumanPose>[] = [
  { at: 0, pose: RECOIL },
  { at: 1, pose: P({ ...RECOIL, root: vec(R.x - 2, R.y), lean: 0.22, head: -0.5 + HT, handN: vec(R.x + 9, 70), handF: vec(R.x + 3, 71) }) },
];

const DEATH: Key<HumanPose>[] = [
  { at: 0, pose: RECOIL },
  // Drops to its knees, arms slack
  { at: 0.33, pose: P({
    root: vec(R.x - 2, 76), lean: 0.3, head: 0.3 + HT,
    footN: vec(CENTER_X + 12, GROUND_Y), footF: vec(CENTER_X - 13, GROUND_Y),
    handN: vec(R.x + 10, 88), handF: vec(R.x + 5, 89), fx: 0.3,
  }) },
  { at: 0.67, ease: 'in', pose: P({
    root: vec(R.x, 79), spin: 0.8, lean: 0.2, head: 0.3 + HT,
    footN: vec(R.x + 1, 101), footF: vec(R.x - 4, 100),
    handN: vec(R.x + 12, 80), handF: vec(R.x + 8, 82), fx: 0.1,
  }) },
  { at: 1, ease: 'out', pose: P({
    root: vec(R.x + 1, GROUND_Y - 8.4), spin: 1.5, lean: 0, head: 0.25 + HT,
    footN: vec(R.x + 2, GROUND_Y - 6.5 + 20), footF: vec(R.x - 2, GROUND_Y - 7 + 20),
    handN: vec(R.x + 9, GROUND_Y - 12), handF: vec(R.x + 4, GROUND_Y - 16), fx: 0,
  }) },
];

export const LesserDemonDrawer = humanoidMonster({
  key: 'monster_lesser_demon',
  // Wide for the forward slam and the fallen body; width doesn't move the sprite.
  frameW: 72,
  frameH: 64,
  scale: 1.24,
  skin: SKIN,
  ready: READY,
  attack: 'slam',
  deathDir: 1,
  tracks: { attack: ATTACK, hurt: HURT, death: DEATH },
  walk: { stride: 6.5, lift: 3.6, bob: 1.8, lean: 0.06, armSwing: 3.4, spread: 1.5 },
  shadowR: 16,
  fx: (ctx, p, sk, act, t) => {
    const dead = act === 'death';
    const heat = dead ? p.fx : 0.35 + p.fx * 0.65;
    // Heart furnace and eye glow
    const heart = spun(p, localPt(sk.neck, sk.torsoAng, 5.4, 4.6), sk);
    glow(ctx, heart, 7 + p.fx * 5, HELLFIRE, 0.4 * heat + 0.05);
    glow(ctx, heart, 2.8, CORE, 0.6 * heat);
    if (!dead || t < 0.5) {
      const eye = spun(p, localPt(sk.head, sk.headAng - HT, 5.5, -0.3), sk);
      glow(ctx, eye, 3, 0xff6a2a, 0.5 + p.fx * 0.3);
    }
    if (act === 'attack') {
      // Fists wreathed in flame while charging
      for (const h of [sk.handN, sk.handF]) {
        glow(ctx, h, 4 + p.fx * 3, HELLFIRE, 0.35 * p.fx);
      }
      if (t > 0.85) {
        // Ground-shattering abyssfire burst at the impact point
        const at = vec((sk.handN.x + sk.handF.x) / 2 + 2, GROUND_Y);
        glow(ctx, vec(at.x, at.y - 3), 18, HELLFIRE, 0.55);
        glow(ctx, vec(at.x, at.y - 2), 7, CORE, 0.8);
        for (let i = 0; i < 7; i++) {
          const a = -1.1 + (i / 6) * 2.2;
          const h = 7 + hash01(i * 3.1) * 7 - Math.abs(a) * 3;
          flameTongue(ctx, vec(at.x + a * 9, at.y + 0.5), a * 0.5, h, 1.8, i * 1.7, 'rgba(255,90,20,0.85)', 'rgba(255,214,120,0.9)');
        }
        ctx.strokeStyle = 'rgba(255,150,60,0.85)';
        ctx.lineWidth = 0.8;
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const a = (i / 4 - 0.5) * 2.4;
          ctx.beginPath();
          ctx.moveTo(at.x, at.y);
          ctx.lineTo(at.x + Math.sin(a) * 9, at.y + Math.cos(a) * 1.6 + 0.8);
          ctx.lineTo(at.x + Math.sin(a) * 15, at.y + Math.cos(a) * 1.4 + 0.4);
          ctx.stroke();
        }
      }
    }
    if (dead) {
      const c = spun(p, sk.pelvis, sk);
      embers(ctx, { x: c.x - 8, y: c.y - 10, w: 30, h: 10 }, 12, t, 0.2 + t * 0.6, HELLFIRE, 9);
    }
  },
});
