// src/graphics/sprites/monsters/Zombie.ts
//
// 僵尸 — a shambling corpse risen from a forest grave: sickly grey-green skin
// mottled with violet bruises, a lolling head with a slack jaw and one
// glowing eye, a torn teal shirt showing ribs, a ripped trouser leg and a
// bare foot it drags behind. One arm is always reaching; it attacks with a
// lurching two-handed rake.
import type { MonsterAction } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  blobPath,
  cel,
  clothChain,
  ellipsePath,
  glow,
  inBone,
  lerpV,
  limb,
  polyPath,
  samplePoseTrack,
  tone,
  vec,
  type Key,
  type Tone,
  type V,
} from '../rig/Rig';
import { basePose, drawHumanoid, solveSkeleton, spun, type HumanPose, type HumanSkin, type Skeleton } from '../rig/Humanoid';
import { humanoidTracks, rigMonster, type HumanoidMonsterSpec } from '../rig/MonsterKit';

// ── Palette ─────────────────────────────────────────────────────────────
const FLESH = tone(0x93a37c, { light: 0.3, shadow: 0.4 });
const FLESH_FAR = tone(0x66745a, { light: 0.15 });
const ROT = tone(0x6c5a74, { light: 0.2 });
const SHIRT = tone(0x4f727a, { light: 0.28 });
const SHIRT_IN = tone(0x2e4550, { light: 0.1 });
const PANTS = tone(0x5a4838, { light: 0.25 });
const PANTS_FAR = tone(0x3e3228, { light: 0.12 });
const BOOT = tone(0x3a2c24);
const ROPE = tone(0x9a8a62);
const BONE = tone(0xe0d8c0, { light: 0.35, shadow: 0.3 });
const HAIR = tone(0x2e2a30, { light: 0.25 });
const GUTS = tone(0x8a3a4a);
const EYE = 0xd6ff5a;

// ── Parts ───────────────────────────────────────────────────────────────

function bruise(ctx: CanvasRenderingContext2D, c: V, r: number): void {
  ctx.fillStyle = 'rgba(110,70,130,0.42)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, r, r * 0.75, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function hand(ctx: CanvasRenderingContext2D, at: V, dir: number, t: Tone, curl: number): void {
  // Palm + three hooked, dirty-nailed fingers pointing along `dir`.
  cel(ctx, () => ellipsePath(ctx, at, 1.9, 1.6, dir), t, { band: 0.5, stroke: 0.45 });
  const c = Math.cos(dir);
  const s = Math.sin(dir);
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 1.1;
    const base = vec(at.x + c * 1.2 - s * off, at.y + s * 1.2 + c * off);
    const bend = dir + 0.5 * curl + (i - 1) * 0.12;
    const tip = vec(base.x + Math.cos(bend) * 2.8, base.y + Math.sin(bend) * 2.8);
    limb(ctx, base, tip, 0.6, 0.45, t, 0.2);
    ctx.fillStyle = '#3a3226';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
}

function leg(ctx: CanvasRenderingContext2D, sk: Skeleton, near: boolean): void {
  const hip = near ? sk.hipN : sk.hipF;
  const knee = near ? sk.kneeN : sk.kneeF;
  const ankle = near ? sk.footN : sk.footF;
  const sole = near ? sk.soleN : sk.soleF;
  const cloth = near ? PANTS : PANTS_FAR;
  const flesh = near ? FLESH : FLESH_FAR;
  if (near) {
    // Trouser leg torn off at the knee: bare, bruised shin and a bare foot.
    limb(ctx, knee, ankle, 2.1, 1.7, flesh);
    bruise(ctx, lerpV(knee, ankle, 0.45), 1.3);
    cel(ctx, () => polyPath(ctx, [
      vec(ankle.x - 1.8, ankle.y - 0.8), vec(ankle.x + 1.4, ankle.y - 1),
      vec(sole.x + 5, sole.y - 1.2), vec(sole.x + 5.6, sole.y), vec(sole.x - 2.2, sole.y),
    ]), flesh, { band: 0.6 });
    ctx.fillStyle = '#3a3226';
    ctx.fillRect(sole.x + 3.6, sole.y - 1, 0.5, 0.9);
    ctx.fillRect(sole.x + 4.7, sole.y - 0.9, 0.5, 0.8);
    limb(ctx, hip, knee, 3.1, 2.6, cloth);
    // Ragged hem
    const d = vec(knee.x - hip.x, knee.y - hip.y);
    const l = Math.hypot(d.x, d.y) || 1;
    const n = vec(-d.y / l, d.x / l);
    const u = vec(d.x / l, d.y / l);
    const at = (a: number, b: number): V => vec(knee.x + n.x * a + u.x * b, knee.y + n.y * a + u.y * b);
    cel(ctx, () => polyPath(ctx, [at(-2.8, -1.5), at(2.8, -1.5), at(2.6, 1.6), at(1.2, 0.6), at(0.2, 2.2), at(-1.2, 0.8), at(-2.6, 1.8)]), cloth, { band: 0.5 });
  } else {
    limb(ctx, hip, knee, 3, 2.5, cloth);
    limb(ctx, knee, ankle, 2.5, 2, cloth);
    // Split old boot
    cel(ctx, () => polyPath(ctx, [
      vec(ankle.x - 2.2, ankle.y - 1.4), vec(ankle.x + 1.8, ankle.y - 1.6),
      vec(sole.x + 5.4, sole.y - 1.6), vec(sole.x + 5.8, sole.y), vec(sole.x - 2.6, sole.y),
    ]), BOOT, { band: 0.7 });
  }
}

function armFar(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose): void {
  limb(ctx, sk.shF, sk.elF, 2.3, 1.9, SHIRT_IN);
  limb(ctx, sk.elF, sk.handF, 1.8, 1.5, FLESH_FAR);
  const dir = Math.atan2(sk.handF.y - sk.elF.y, sk.handF.x - sk.elF.x);
  hand(ctx, sk.handF, dir, FLESH_FAR, 0.6 + p.fx * 0.4);
}

function armNear(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose): void {
  // Sleeve ripped away: rotten upper arm with a bite wound, bone showing at the elbow.
  limb(ctx, sk.shN, sk.elN, 2.4, 2, FLESH);
  bruise(ctx, lerpV(sk.shN, sk.elN, 0.55), 1.5);
  const w = lerpV(sk.shN, sk.elN, 0.35);
  cel(ctx, () => ellipsePath(ctx, w, 1.2, 0.8, 0.6), GUTS, { band: 0.3, stroke: 0.3 });
  limb(ctx, sk.elN, sk.handN, 2, 1.6, FLESH);
  cel(ctx, () => ellipsePath(ctx, sk.elN, 1.2, 1), BONE, { band: 0.3, stroke: 0.35 });
  // Tattered sleeve cuff at the shoulder
  cel(ctx, () => polyPath(ctx, [
    vec(sk.shN.x - 3, sk.shN.y - 1.6), vec(sk.shN.x + 2.6, sk.shN.y - 2), vec(sk.shN.x + 3, sk.shN.y + 1.8),
    vec(sk.shN.x + 1.4, sk.shN.y + 0.8), vec(sk.shN.x + 0.2, sk.shN.y + 2.8), vec(sk.shN.x - 1.4, sk.shN.y + 1),
    vec(sk.shN.x - 2.8, sk.shN.y + 2.2),
  ]), SHIRT, { band: 0.7 });
  const dir = Math.atan2(sk.handN.y - sk.elN.y, sk.handN.x - sk.elN.x);
  hand(ctx, sk.handN, dir, FLESH, 0.35 + p.fx * 0.6);
}

function torso(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    // Gaunt body
    const body = [vec(-5, 0.4), vec(0.6, -0.8), vec(5.4, 1.4), vec(5.8, len * 0.55), vec(4.6, len + 0.6), vec(-4.4, len + 0.8), vec(-5.6, len * 0.5)];
    cel(ctx, () => blobPath(ctx, body), FLESH, { band: 1.5 });
    // Torn shirt: covers most of the torso, with a ragged hole over the ribs
    const ph = t * Math.PI * 2;
    const shirt = [vec(-5.6, 0), vec(0.4, -1.2), vec(5.8, 1.2), vec(6.4, len * 0.6), vec(6, len + 1.4)];
    // Tattered hem trailing in the lurch
    const hemA = clothChain(vec(5.4, len + 0.8), 4.5, 3, p.flow, 1, ph);
    const hemB = clothChain(vec(0.6, len + 1), 5.5, 3, p.flow, 1, ph + 1.2);
    const hemC = clothChain(vec(-4, len + 0.6), 4, 3, p.flow, 1, ph + 2.1);
    cel(ctx, () => {
      ctx.moveTo(shirt[0].x, shirt[0].y);
      for (const q of shirt) ctx.lineTo(q.x, q.y);
      ctx.lineTo(hemA[3].x, hemA[3].y);
      ctx.lineTo(3.2, len + 2);
      ctx.lineTo(hemB[3].x, hemB[3].y);
      ctx.lineTo(-1.6, len + 1.6);
      ctx.lineTo(hemC[3].x, hemC[3].y);
      ctx.lineTo(-6, len * 0.5);
      ctx.closePath();
    }, SHIRT, { band: 1.2 });
    // Hole in the shirt showing a rotten patch with ribs
    const hole = [vec(0.6, len * 0.2), vec(4.4, len * 0.16), vec(5.4, len * 0.38), vec(3.8, len * 0.56), vec(0.8, len * 0.5), vec(-0.2, len * 0.34)];
    cel(ctx, () => polyPath(ctx, hole), ROT, { band: 0.5, stroke: 0.5 });
    ctx.strokeStyle = BONE.base;
    ctx.lineWidth = 0.75;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const y = len * 0.26 + i * len * 0.09;
      ctx.beginPath();
      ctx.moveTo(0.6, y);
      ctx.quadraticCurveTo(3, y - 0.9, 4.8, y + 0.6);
      ctx.stroke();
    }
    // Stains & rips
    ctx.fillStyle = 'rgba(40,30,40,0.35)';
    ctx.beginPath();
    ctx.ellipse(-2.6, len * 0.7, 2, 1.4, 0.3, 0, Math.PI * 2);
    ctx.ellipse(4, len * 0.82, 1.2, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = SHIRT.shade;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(-3.6, 2);
    ctx.lineTo(-2.2, len * 0.4);
    ctx.moveTo(-4.8, len * 0.35);
    ctx.lineTo(-3.6, len * 0.62);
    ctx.stroke();
    // Collar
    cel(ctx, () => polyPath(ctx, [vec(-4.6, -0.2), vec(0.4, -1.6), vec(4.2, 0.2), vec(2.6, 2), vec(0.2, 0.6), vec(-3.6, 1.6)]), SHIRT_IN, { band: 0.5 });
    // Rope belt holding up the trousers
    cel(ctx, () => polyPath(ctx, [vec(-5, len - 1), vec(6, len - 1.6), vec(6.2, len + 0.2), vec(-5, len + 0.8)]), ROPE, { band: 0.35, stroke: 0.4 });
    const knot = clothChain(vec(4.6, len), 4, 2, p.flow, 1, ph + 0.5);
    ctx.strokeStyle = ROPE.shade;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(knot[0].x, knot[0].y);
    for (const q of knot) ctx.lineTo(q.x, q.y);
    ctx.stroke();
  });
}

function head(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  // Scrawny neck
  limb(ctx, sk.neck, lerpV(sk.neck, sk.head, 0.7), 1.9, 1.7, FLESH);
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  const ph = t * Math.PI * 2;
  // Stringy hair behind, swinging with the lurch
  for (let i = 0; i < 3; i++) {
    const strand = clothChain(vec(-3.8 + i * 1.6, -4.6 + i * 0.4), 6.5 - i, 3, p.flow + 0.2, 1.6, ph + i);
    ctx.strokeStyle = HAIR.base;
    ctx.lineWidth = 1.1 - i * 0.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(strand[0].x, strand[0].y);
    for (const q of strand) ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  // Slack lower jaw (drops with the attack)
  const jaw = 0.25 + p.fx * 0.45 + Math.max(0, Math.sin(ph * 2)) * 0.08;
  ctx.save();
  ctx.translate(0, 2.4);
  ctx.rotate(jaw * 0.6);
  cel(ctx, () => polyPath(ctx, [vec(-2, -0.4), vec(5, 0), vec(5.8, 1.8), vec(3.4, 3.6), vec(-0.6, 3)]), FLESH, { band: 0.6 });
  ctx.fillStyle = '#2a1820';
  ctx.beginPath();
  ctx.moveTo(1, -0.2);
  ctx.lineTo(5, 0.1);
  ctx.lineTo(4.4, 1.2);
  ctx.lineTo(1.4, 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = BONE.base;
  ctx.fillRect(2.2, -0.1, 0.7, 0.9);
  ctx.fillRect(4, 0, 0.6, 0.7);
  ctx.restore();
  // Cranium
  const skull = [vec(-5, -0.6), vec(-4.2, -5.2), vec(0.6, -6.8), vec(5, -5), vec(6.6, -1.4), vec(6.2, 2.4), vec(3.2, 3), vec(-1, 2.6), vec(-4, 2.2)];
  cel(ctx, () => blobPath(ctx, skull), FLESH, { band: 1.4 });
  bruise(ctx, vec(-1.6, -3.2), 1.8);
  // Exposed skull patch + stitched scar
  cel(ctx, () => ellipsePath(ctx, vec(1.6, -5.2), 2.1, 1.2, 0.2), BONE, { band: 0.4, stroke: 0.4 });
  ctx.strokeStyle = '#2a2026';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(-3.8, -3.6);
  ctx.lineTo(-1, -1.2);
  for (let i = 0; i < 3; i++) {
    const c = lerpV(vec(-3.8, -3.6), vec(-1, -1.2), (i + 0.5) / 3);
    ctx.moveTo(c.x - 0.7, c.y + 0.6);
    ctx.lineTo(c.x + 0.7, c.y - 0.6);
  }
  ctx.stroke();
  // Upper teeth
  ctx.fillStyle = BONE.light;
  ctx.fillRect(2.4, 2.4, 0.8, 1);
  ctx.fillRect(3.8, 2.3, 0.7, 1.2);
  ctx.fillRect(5, 2.2, 0.7, 0.8);
  // Sunken sockets: near eye glows, far eye is milky
  ctx.fillStyle = '#231a26';
  ctx.beginPath();
  ctx.ellipse(3.4, -1.4, 1.8, 1.5, 0.15, 0, Math.PI * 2);
  ctx.ellipse(6.2, -1.2, 0.8, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8ff9a';
  ctx.beginPath();
  ctx.arc(3.8, -1.3, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8b8a8';
  ctx.beginPath();
  ctx.arc(6.3, -1.1, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Heavy brow + nose stub
  cel(ctx, () => polyPath(ctx, [vec(1.4, -3.4), vec(6.8, -2.8), vec(6.6, -2), vec(1.4, -2.4)]), FLESH_FAR, { band: 0.3, stroke: 0.3 });
  ctx.fillStyle = '#2a2026';
  ctx.beginPath();
  ctx.ellipse(6.6, 0.8, 0.5, 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Torn ear
  cel(ctx, () => polyPath(ctx, [vec(-1.6, -1.8), vec(0.4, -2.2), vec(0.6, 0.2), vec(-0.4, 0.8), vec(-1, 0)]), FLESH_FAR, { band: 0.4, stroke: 0.4 });
  ctx.restore();
}

// ── Skin & poses ────────────────────────────────────────────────────────

const SKIN: HumanSkin = {
  prop: {
    thigh: 10, shin: 10, upperArm: 9, foreArm: 8.4,
    torso: 14.5, neck: 5.8, ankle: 1.6,
    hipN: vec(1.6, 0), hipF: vec(-2, -0.4),
    shN: vec(1.4, 2.8), shF: vec(-3.4, 2.4),
  },
  armFar(ctx, sk, p) { armFar(ctx, sk, p); },
  legFar(ctx, sk) { leg(ctx, sk, false); },
  legNear(ctx, sk) { leg(ctx, sk, true); },
  torso(ctx, sk, p, t) { torso(ctx, sk, p, t); },
  head(ctx, sk, p, t) { head(ctx, sk, p, t); },
  armNear(ctx, sk, p) { armNear(ctx, sk, p); },
  weapon() { /* bare-handed */ },
};

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 2.5, 71),
  lean: 0.34,
  head: 0.32,
  footN: vec(CENTER_X + 5, GROUND_Y),
  footF: vec(CENTER_X - 7.5, GROUND_Y),
  // The near arm is always reaching for the living; the far one dangles.
  handN: vec(CENTER_X + 20, 61),
  handF: vec(CENTER_X + 9.5, 76.5),
  flow: 0.15,
});

const P = (o: Partial<HumanPose>): HumanPose => ({ ...READY, ...o });

function idle(t: number): HumanPose {
  const ph = t * Math.PI * 2;
  const s = Math.sin(ph);
  return P({
    root: vec(READY.root.x + s * 0.8, READY.root.y + Math.abs(Math.cos(ph)) * 0.7),
    lean: READY.lean + Math.sin(ph + 0.6) * 0.04,
    head: READY.head + Math.sin(ph - 0.8) * 0.12,
    handN: vec(READY.handN.x + s * 0.8, READY.handN.y + Math.sin(ph + 1) * 1.2),
    handF: vec(READY.handF.x + Math.sin(ph - 1) * 1.2, READY.handF.y),
    flow: 0.15 + s * 0.08,
  });
}

/**
 * Shambling gait: the far leg steps, the bare near foot drags and scuffs
 * forward; the body lurches down and forward onto every step.
 */
function walk(t: number): HumanPose {
  const ph = t * Math.PI * 2;
  const c = Math.cos(ph);
  const lift = Math.max(0, -Math.sin(ph));
  const dragLift = Math.max(0, Math.sin(ph));
  const lurch = Math.max(0, Math.sin(ph - 0.7));
  return P({
    root: vec(READY.root.x + c * 0.8, READY.root.y + 0.8 + lurch * 1.6 - Math.abs(Math.sin(ph)) * 0.6),
    lean: READY.lean + 0.04 + lurch * 0.1,
    head: READY.head + Math.sin(ph + 1.4) * 0.16,
    // Stepping far leg
    footF: vec(CENTER_X - 1.5 - c * 6, GROUND_Y - lift * 4),
    // Dragging near leg: short stride, toes barely leave the ground
    footN: vec(CENTER_X + 2 + c * 5, GROUND_Y - dragLift * 1.2),
    handN: vec(READY.handN.x - 1 + Math.sin(ph) * 1.5, READY.handN.y + lurch * 2),
    handF: vec(READY.handF.x + c * 2.4, READY.handF.y - lift * 1),
    flow: 0.35 + lurch * 0.2,
  });
}

const SPEC: HumanoidMonsterSpec = {
  key: 'monster_zombie',
  // Wide for the reaching arm and lurching rake; width doesn't move the sprite in-game.
  frameW: 68,
  frameH: 60,
  scale: 1.46,
  skin: SKIN,
  ready: READY,
  attack: 'claw',
  deathDir: 1,
};
const GEN = humanoidTracks(SPEC);

/** Rear up with both arms high, lurch in, then rake down across the target. */
const ATTACK: Key<HumanPose>[] = [
  { at: 0, pose: READY },
  { at: 0.33, ease: 'out', pose: P({
    root: vec(CENTER_X - 4.5, 70), lean: 0.02, head: -0.12,
    handN: vec(CENTER_X + 5, 44), handF: vec(CENTER_X + 10, 43),
    footN: vec(CENTER_X + 5, GROUND_Y), footF: vec(CENTER_X - 8, GROUND_Y),
    stretch: 0.05, fx: 0.25, flow: 0.1,
  }) },
  { at: 0.67, ease: 'in', pose: P({
    root: vec(CENTER_X - 1, 71), lean: 0.3, head: 0.08,
    handN: vec(CENTER_X + 16, 47), handF: vec(CENTER_X + 20, 46),
    footN: vec(CENTER_X + 8, GROUND_Y), footF: vec(CENTER_X - 7.5, GROUND_Y),
    fx: 0.6, flow: 0.3,
  }) },
  { at: 1, ease: 'linear', pose: P({
    root: vec(CENTER_X + 2.5, 73), lean: 0.62, head: 0.06,
    handN: vec(CENTER_X + 22, 71), handF: vec(CENTER_X + 25, 76),
    footN: vec(CENTER_X + 10.5, GROUND_Y), footF: vec(CENTER_X - 6.5, GROUND_Y),
    fx: 1, flow: 0.5, stretch: -0.04,
  }) },
];
/** Death: knees give out, it slumps onto them, then flops face-down. */
const DEATH: Key<HumanPose>[] = [
  GEN.death[0],
  { at: 0.33, pose: P({
    ...GEN.death[0].pose, root: vec(READY.root.x - 1, READY.root.y + 7), lean: 0.2, head: 0.7,
    footN: vec(READY.footN.x + 1, GROUND_Y), footF: vec(READY.footF.x, GROUND_Y),
    handN: vec(READY.root.x + 12, READY.root.y + 2), handF: vec(READY.root.x + 6, READY.root.y + 10), flow: 0.3,
  }) },
  { at: 0.67, ease: 'in', pose: P({
    root: vec(READY.root.x + 1, GROUND_Y - 8.5), lean: 0.75, head: 0.5, spin: 0.3,
    footN: vec(READY.root.x + 9, GROUND_Y), footF: vec(READY.root.x + 4, GROUND_Y),
    handN: vec(READY.root.x + 19, GROUND_Y - 4), handF: vec(READY.root.x + 14, GROUND_Y - 2), flow: 0.4,
  }) },
  GEN.death[3],
];
const TRACKS: Record<'attack' | 'hurt' | 'death', Key<HumanPose>[]> = { ...GEN, attack: ATTACK, death: DEATH };

function zombiePose(act: MonsterAction, t: number): HumanPose {
  switch (act) {
    case 'idle': return idle(t);
    case 'walk': return walk(t);
    default: return samplePoseTrack(TRACKS[act], t);
  }
}

function zombieFx(ctx: CanvasRenderingContext2D, p: HumanPose, act: MonsterAction, t: number): void {
  const sk = solveSkeleton(p, SKIN.prop);
  // Rake streaks on the contact frame
  if (act === 'attack' && p.fx > 0.9) {
    const h = spun(p, sk.handN, sk);
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const o = (i - 1) * 2.2;
      ctx.strokeStyle = `rgba(214,255,120,${0.55 - i * 0.08})`;
      ctx.lineWidth = 1.1 - i * 0.2;
      ctx.beginPath();
      ctx.moveTo(h.x + 1 + o, h.y - 11 + o * 0.4);
      ctx.quadraticCurveTo(h.x + 8 + o, h.y - 5, h.x + 6 + o * 0.6, h.y + 4 + o * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Sickly glow in the one working eye + a whiff of grave miasma
  if (act === 'death' && t > 0.6) return;
  const eye = spun(p, vec(
    sk.head.x + Math.cos(sk.headAng) * 3.8 + Math.sin(sk.headAng) * 1.3,
    sk.head.y + Math.sin(sk.headAng) * 3.8 - Math.cos(sk.headAng) * 1.3,
  ), sk);
  glow(ctx, eye, 2.8 + p.fx, EYE, 0.5 + p.fx * 0.25);
  for (let i = 0; i < 3; i++) {
    const k = (i / 3 + t) % 1;
    const base = spun(p, lerpV(sk.pelvis, sk.neck, 0.4 + i * 0.2), sk);
    glow(ctx, vec(base.x - 3 - k * 4 + Math.sin(i * 2 + t * 6), base.y - k * 6), 2.2 * (1 - k * 0.5), 0x9ad07a, 0.22 * (1 - k));
  }
}

export const ZombieDrawer = rigMonster<HumanPose>({
  key: SPEC.key,
  frameW: SPEC.frameW,
  frameH: SPEC.frameH,
  scale: SPEC.scale,
  pose: zombiePose,
  draw: (ctx, p, _act, t) => { drawHumanoid(ctx, p, SKIN, t); },
  shadow: (p) => ({
    x: Math.abs(p.spin) > 1 ? p.root.x + (p.spin > 0 ? 8 : -8) : p.root.x + 1,
    r: Math.abs(p.spin) > 1 ? 16 : 11,
    lift: Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y)),
  }),
  fx: zombieFx,
});
