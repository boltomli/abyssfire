// src/graphics/sprites/monsters/SubAltarKeeper.ts
//
// 祭坛守卫者 — high priest of the blood altar: a gaunt figure in crimson
// vestments and a black stole stitched with glowing blood sigils, a
// weeping porcelain mask under a spiked iron circlet, a swinging brass
// censer trailing red smoke, and a hooked sacrificial sickle brought down
// in a ritual overhead cut.
import {
  CENTER_X,
  GROUND_Y,
  along,
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
  smear,
  tone,
  vec,
  type V,
} from '../rig/Rig';
import { basePose, solveSkeleton, spun, type HumanPose, type HumanSkin, type Skeleton } from '../rig/Humanoid';
import { humanoidMonster, humanoidTracks, type HumanoidMonsterSpec } from '../rig/MonsterKit';

const ROBE = tone(0x7a1628, { light: 0.3, shadow: 0.45 });
const ROBE_FAR = tone(0x4a0c1a, { light: 0.18 });
const LINING = tone(0x2a0e14, { light: 0.2 });
const STOLE = tone(0x1e1218, { light: 0.25 });
const BRASS = tone(0xb89040, { light: 0.5 });
const BRASS_DARK = tone(0x7a5a24);
const MASK = tone(0xece6dc, { light: 0.45, shadow: 0.3 });
const FLESH = tone(0xb8a8a4, { shadow: 0.35, light: 0.25 });
const FLESH_FAR = tone(0x8a7a7a, { shadow: 0.3, light: 0.15 });
const IRON = tone(0x4a4652, { light: 0.4 });
const BLADE = tone(0xcfd2da, { light: 0.6, shadow: 0.3 });
const BONE = tone(0xe2d8c0, { light: 0.4, shadow: 0.3 });
const BLOOD = '#c0102a';
const SIGIL = 0xff2244;
const SMOKE = 0xa01830;

const BLADE_LEN = 15;

function headPt(sk: Skeleton, l: V): V {
  const c = Math.cos(sk.headAng);
  const s = Math.sin(sk.headAng);
  return vec(sk.head.x + l.x * c - l.y * s, sk.head.y + l.x * s + l.y * c);
}

// ── Body ────────────────────────────────────────────────────────────────

function shin(ctx: CanvasRenderingContext2D, knee: V, ankle: V, sole: V, far: boolean): void {
  limb(ctx, knee, ankle, 2.2, 1.8, far ? tone(0x1a1014) : tone(0x2a1a20));
  cel(ctx, () => polyPath(ctx, [
    vec(ankle.x - 2.2, ankle.y - 1.2), vec(ankle.x + 1.6, ankle.y - 1.6),
    vec(sole.x + 5.4, sole.y - 1), vec(sole.x + 5.8, sole.y), vec(sole.x - 2.4, sole.y),
  ]), far ? tone(0x1a1014) : tone(0x2e2024), { band: 0.7 });
}

function vestment(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const waist = along(sk.pelvis, p.lean, 3);
  const ph = t * Math.PI * 2;
  const back = Math.min(sk.footF.x, sk.footN.x, sk.kneeF.x) - 5.6 - p.flow * 4;
  const front = Math.max(sk.footN.x, sk.footF.x, sk.kneeN.x) + 4.4 - p.flow * 1.5;
  const hemY = Math.min(GROUND_Y - 2.6, Math.max(sk.footN.y, sk.footF.y) - 0.8);
  const wave = Math.sin(ph * 2) * 0.7;
  const mid = (back + front) / 2;
  const pts = [
    vec(waist.x - 6, waist.y), vec(waist.x + 5.6, waist.y),
    vec(front + 0.8, hemY - 3), vec(front, hemY + wave * 0.4),
    vec(mid + 2.4, hemY + 1.2 - wave), vec(mid - 3, hemY + 0.4 + wave),
    vec(back, hemY - 0.2 - wave * 0.4), vec(back - 1 - p.flow * 2.4, hemY - 5),
  ];
  cel(ctx, () => blobPath(ctx, pts), ROBE, { band: 1.9 });
  ctx.save();
  ctx.beginPath();
  blobPath(ctx, pts);
  ctx.clip();
  // Front split showing the dark under-robe
  cel(ctx, () => polyPath(ctx, [vec(waist.x + 2.4, waist.y + 1), vec(waist.x + 5, waist.y), vec(front + 1, hemY), vec(front - 4.6, hemY + 2)]), LINING, { band: 0.6, stroke: 0.4 });
  // Blood-soaked hem
  ctx.fillStyle = 'rgba(40,0,8,0.45)';
  ctx.fillRect(back - 4, hemY - 3.2, front - back + 8, 6);
  ctx.restore();
  // Stole tail hanging down the front
  const top = vec(waist.x + 1.8, waist.y - 1);
  const sw = Math.sin(ph + 0.4) * 0.8 - p.flow * 3;
  const stole = [vec(top.x - 2, top.y), vec(top.x + 2, top.y), vec(top.x + 2.4 + sw * 0.6, top.y + 13), vec(top.x + 0.2 + sw, top.y + 15.4), vec(top.x - 2 + sw * 0.8, top.y + 13)];
  cel(ctx, () => polyPath(ctx, stole), STOLE, { band: 0.7 });
  ctx.strokeStyle = BRASS.base;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(stole[2].x - 0.3, stole[2].y - 0.6);
  ctx.lineTo(stole[3].x, stole[3].y - 0.9);
  ctx.lineTo(stole[4].x + 0.3, stole[4].y - 0.6);
  ctx.stroke();
  sigils(ctx, lerpV(top, stole[3], 0.25), lerpV(top, stole[3], 0.8), 2);
}

/** Vertical run of angular blood runes. */
function sigils(ctx: CanvasRenderingContext2D, a: V, b: V, n: number): void {
  ctx.strokeStyle = '#ff4060';
  ctx.lineWidth = 0.5;
  ctx.lineJoin = 'miter';
  for (let i = 0; i < n; i++) {
    const c = lerpV(a, b, n === 1 ? 0.5 : i / (n - 1));
    ctx.beginPath();
    if (i % 2 === 0) {
      ctx.moveTo(c.x - 0.9, c.y - 1.1);
      ctx.lineTo(c.x + 0.9, c.y - 1.1);
      ctx.lineTo(c.x, c.y + 1.2);
      ctx.closePath();
      ctx.moveTo(c.x, c.y - 1.9);
      ctx.lineTo(c.x, c.y + 1.9);
    } else {
      ctx.arc(c.x, c.y, 1, 0, Math.PI * 2);
      ctx.moveTo(c.x - 1.6, c.y);
      ctx.lineTo(c.x + 1.6, c.y);
    }
    ctx.stroke();
  }
}

function priestTorso(ctx: CanvasRenderingContext2D, sk: Skeleton): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    const body = [vec(-5.4, 0.5), vec(1, -0.8), vec(6, 1.4), vec(6.6, 7), vec(5.2, len - 1), vec(-5.2, len - 1), vec(-6.2, 7)];
    cel(ctx, () => blobPath(ctx, body), ROBE, { band: 1.5 });
    // Vertebrae belt
    cel(ctx, () => polyPath(ctx, [vec(-5.6, len - 3.6), vec(6.2, len - 4), vec(6, len - 1.2), vec(-5.6, len - 0.8)]), STOLE, { band: 0.5 });
    ctx.fillStyle = BONE.base;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(-3.6 + i * 2.9, len - 2.4, 1.1, 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Black stole over the shoulders, sigils down the front
    cel(ctx, () => polyPath(ctx, [vec(-1.4, -0.8), vec(4.6, 0), vec(4.4, len - 3.6), vec(1.2, len - 3.6)]), STOLE, { band: 0.8 });
    ctx.strokeStyle = BRASS.base;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(1.6, 0);
    ctx.lineTo(1.4, len - 3.8);
    ctx.moveTo(4.2, 0.4);
    ctx.lineTo(4.1, len - 3.8);
    ctx.stroke();
    sigils(ctx, vec(2.8, 4), vec(2.8, len - 6), 3);
    // High collar/mantle
    const mantle = [vec(-6.6, 0.4), vec(-1, -2.4), vec(5.8, -0.6), vec(7.2, 3.6), vec(2, 5.6), vec(-6, 4.8)];
    cel(ctx, () => blobPath(ctx, mantle), ROBE_FAR, { band: 1 });
    ctx.strokeStyle = BRASS.base;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-5.8, 4.4);
    ctx.quadraticCurveTo(1.4, 6.6, 7, 3.4);
    ctx.stroke();
    // Brass chain across the chest to a heart-shaped reliquary
    ctx.strokeStyle = BRASS_DARK.light;
    ctx.lineWidth = 0.45;
    ctx.setLineDash([0.7, 0.5]);
    ctx.beginPath();
    ctx.moveTo(-4.6, 4.6);
    ctx.quadraticCurveTo(0, 9, 5.6, 5);
    ctx.stroke();
    ctx.setLineDash([]);
    cel(ctx, () => blobPath(ctx, [vec(1.2, 7.4), vec(3.2, 7), vec(3.6, 8.8), vec(2.2, 10.6), vec(0.8, 8.8)]), BRASS, { band: 0.4, stroke: 0.4 });
    ctx.fillStyle = BLOOD;
    ctx.beginPath();
    ctx.arc(2.2, 8.6, 0.7, 0, Math.PI * 2);
    ctx.fill();
  });
}

function hood(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  const sway = Math.sin(t * Math.PI * 2) * 0.5 + p.flow * 2.5;
  const shell = [
    vec(-6.6, 2.4), vec(-7.2, -3.6), vec(-3.6, -8.6), vec(1.2, -10.6), vec(6.2, -6),
    vec(7.4, 1), vec(5.8, 7), vec(-2, 8), vec(-8.6 - sway, 6.6), vec(-10.4 - sway * 1.4, 10 + sway * 0.2), vec(-8.4 - sway, 2.6),
  ];
  cel(ctx, () => blobPath(ctx, shell), ROBE, { band: 1.7 });
  const opening = [vec(-0.2, -6), vec(5.6, -4.4), vec(7.2, 1.4), vec(5.6, 6), vec(-0.2, 5.6)];
  ctx.fillStyle = '#12060a';
  ctx.beginPath();
  blobPath(ctx, opening);
  ctx.fill();
  // Porcelain mask: smooth, expressionless, weeping blood
  const plate = [vec(1.6, -4.2), vec(5.4, -3.6), vec(7.6, -0.6), vec(7.8, 2.6), vec(6, 5.2), vec(3, 5), vec(1.6, 1.4)];
  cel(ctx, () => blobPath(ctx, plate), MASK, { band: 1, stroke: 0.4 });
  ctx.fillStyle = '#1a0608';
  ctx.beginPath();
  ctx.moveTo(3.4, -1.4);
  ctx.lineTo(6.4, -1.2);
  ctx.lineTo(6, -0.4);
  ctx.lineTo(3.6, -0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd0d6';
  ctx.fillRect(4.4, -1.2, 1.2, 0.5);
  ctx.strokeStyle = BLOOD;
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.moveTo(4.2, -0.4);
  ctx.quadraticCurveTo(4.5, 1.6, 4, 3.6);
  ctx.stroke();
  // Thin mouth seam
  ctx.strokeStyle = MASK.line;
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(5.2, 3.4);
  ctx.lineTo(7.2, 3.2);
  ctx.stroke();
  // Spiked iron circlet over the hood
  cel(ctx, () => polyPath(ctx, [vec(-4.8, -6.2), vec(5.4, -5.4), vec(5.6, -4), vec(-4.8, -4.6)]), IRON, { band: 0.4 });
  const spikes: [number, number][] = [[-3.6, 4], [-0.6, 5.4], [2.4, 5.8], [5, 4.4]];
  for (const [x, h] of spikes) {
    cel(ctx, () => polyPath(ctx, [vec(x - 1, -5.8), vec(x + 0.2, -5.8 - h), vec(x + 1.1, -5.6)]), IRON, { band: 0.3, stroke: 0.4 });
  }
  ctx.fillStyle = BLOOD;
  ctx.beginPath();
  ctx.arc(0.8, -5.1, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function sleeveArm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  const cloth = far ? ROBE_FAR : ROBE;
  limb(ctx, sh, el, 2.9, 2.6, cloth);
  const dir = { x: hand.x - el.x, y: hand.y - el.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  const nx = -dir.y / len;
  const ny = dir.x / len;
  const cuff = lerpV(el, hand, 0.78);
  const pts = [
    vec(el.x + nx * 2.6, el.y + ny * 2.6),
    vec(cuff.x + nx * 4.4, cuff.y + ny * 4.4 + 1.4),
    vec(cuff.x - nx * 3.4, cuff.y - ny * 3.4 + 1.8),
    vec(el.x - nx * 2.6, el.y - ny * 2.6),
  ];
  cel(ctx, () => polyPath(ctx, pts), cloth, { band: 1 });
  ctx.strokeStyle = far ? BRASS.shade : BRASS.base;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.stroke();
}

function hand(ctx: CanvasRenderingContext2D, at: V, far: boolean): void {
  const t = far ? FLESH_FAR : FLESH;
  cel(ctx, () => ellipsePath(ctx, at, 1.9, 1.8), t, { band: 0.6, stroke: 0.4 });
  // Long dark nails
  ctx.fillStyle = '#2a1418';
  ctx.fillRect(at.x + 1.2, at.y + 0.6, 1.2, 0.6);
}

function censer(ctx: CanvasRenderingContext2D, from: V, p: HumanPose, t: number): V {
  const swing = Math.sin(t * Math.PI * 2 + 0.6) * 0.35 - p.flow * 0.7;
  const bob = vec(from.x + Math.sin(swing) * 8.5, from.y + Math.cos(swing) * 8.5);
  ctx.strokeStyle = BRASS_DARK.base;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([0.8, 0.5]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(bob.x, bob.y - 2.4);
  ctx.stroke();
  ctx.setLineDash([]);
  // Brass orb with pierced vents and a spike finial
  cel(ctx, () => polyPath(ctx, [vec(bob.x - 1, bob.y - 3.8), vec(bob.x + 1, bob.y - 3.8), vec(bob.x, bob.y - 5.4)]), BRASS, { band: 0.3, stroke: 0.3 });
  cel(ctx, () => ellipsePath(ctx, bob, 2.8, 2.9), BRASS, { band: 0.9 });
  cel(ctx, () => polyPath(ctx, [vec(bob.x - 2.9, bob.y - 0.4), vec(bob.x + 2.9, bob.y - 0.4), vec(bob.x + 2.9, bob.y + 0.5), vec(bob.x - 2.9, bob.y + 0.5)]), BRASS_DARK, { band: 0.2, stroke: 0.3 });
  ctx.fillStyle = '#ff5a4a';
  for (const dx of [-1.2, 0.6]) ctx.fillRect(bob.x + dx, bob.y - 2, 0.7, 1.1);
  ctx.fillRect(bob.x - 0.3, bob.y + 1.2, 0.7, 0.9);
  return bob;
}

function censerPoint(sk: Skeleton, p: HumanPose, t: number): V {
  const swing = Math.sin(t * Math.PI * 2 + 0.6) * 0.35 - p.flow * 0.7;
  return vec(sk.handF.x + Math.sin(swing) * 8.5, sk.handF.y + Math.cos(swing) * 8.5);
}

function sickle(ctx: CanvasRenderingContext2D, at: V, angle: number): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  // Bone grip with brass pommel
  cel(ctx, () => polyPath(ctx, [vec(-0.9, 4.6), vec(0.9, 4.6), vec(0.8, -2), vec(-0.8, -2)]), BONE, { band: 0.3 });
  cel(ctx, () => ellipsePath(ctx, vec(0, 5.2), 1.3, 1.1), BRASS, { band: 0.3 });
  cel(ctx, () => polyPath(ctx, [vec(-2, -2.4), vec(2, -2.4), vec(1.6, -1.2), vec(-1.6, -1.2)]), BRASS, { band: 0.3 });
  // Hooked blade curving forward
  cel(ctx, () => {
    ctx.moveTo(-1.2, -2.4);
    ctx.quadraticCurveTo(-3.2, -BLADE_LEN * 0.75, 4.8, -BLADE_LEN);
    ctx.quadraticCurveTo(0.8, -BLADE_LEN * 0.66, 1.2, -2.4);
    ctx.closePath();
  }, BLADE, { band: 0.8, hi: 0.4 });
  // Blood channel and a fresh stain on the edge
  ctx.strokeStyle = BLOOD;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-0.6, -4);
  ctx.quadraticCurveTo(-1.6, -BLADE_LEN * 0.7, 3, -BLADE_LEN + 0.8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(170,10,30,0.8)';
  ctx.beginPath();
  ctx.ellipse(0.9, -6.4, 0.6, 1.4, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function stoleTails(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void {
  const knot = along(sk.neck, p.lean, -2);
  const chain = clothChain(vec(knot.x - 4, knot.y), 20, 5, 0.2 + p.flow, 1.2, t * Math.PI * 2 + 1);
  const l: V[] = [];
  const r: V[] = [];
  chain.forEach((pt, j) => {
    const w = 1.8 + j * 0.2;
    l.push(vec(pt.x - w, pt.y));
    r.push(vec(pt.x + w * 0.6, pt.y));
  });
  cel(ctx, () => polyPath(ctx, [...l, ...r.reverse()]), ROBE_FAR, { band: 0.8 });
}

function haloCentre(sk: Skeleton): V {
  return headPt(sk, vec(-3.2, -2.4));
}

/** Iron sigil-wheel mounted behind the head: the altar's mark of office. */
function halo(ctx: CanvasRenderingContext2D, sk: Skeleton, t: number): void {
  const c = haloCentre(sk);
  const rot = t * Math.PI * 0.5;
  for (let i = 0; i < 8; i++) {
    const a = rot + i * (Math.PI / 4);
    const len = i % 2 === 0 ? 14.5 : 12;
    cel(ctx, () => polyPath(ctx, [
      vec(c.x + Math.cos(a - 0.12) * 9, c.y + Math.sin(a - 0.12) * 9),
      vec(c.x + Math.cos(a) * len, c.y + Math.sin(a) * len),
      vec(c.x + Math.cos(a + 0.12) * 9, c.y + Math.sin(a + 0.12) * 9),
    ]), IRON, { band: 0.4, stroke: 0.4 });
  }
  cel(ctx, () => {
    ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
    ctx.moveTo(c.x + 8, c.y);
    ctx.arc(c.x, c.y, 8, 0, Math.PI * 2, true);
  }, IRON, { band: 0.8 });
  ctx.strokeStyle = '#ff3a5a';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([1.2, 1]);
  ctx.beginPath();
  ctx.arc(c.x, c.y, 9, -rot, -rot + Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

const SKIN: HumanSkin = {
  prop: {
    thigh: 12, shin: 12, upperArm: 9.4, foreArm: 9,
    torso: 16.5, neck: 7, ankle: 2,
    hipN: vec(1.8, 0), hipF: vec(-2.2, -0.4),
    shN: vec(1, 3.6), shF: vec(-3.8, 3),
  },
  back(ctx, sk, p, t) {
    halo(ctx, sk, t);
    stoleTails(ctx, sk, p, t);
  },
  armFar(ctx, sk, p, t) {
    sleeveArm(ctx, sk.shF, sk.elF, sk.handF, true);
    censer(ctx, sk.handF, p, t);
    hand(ctx, sk.handF, true);
  },
  legFar(ctx, sk) {
    shin(ctx, sk.kneeF, sk.footF, sk.soleF, true);
  },
  legNear(ctx, sk, p, t) {
    shin(ctx, sk.kneeN, sk.footN, sk.soleN, false);
    vestment(ctx, sk, p, t);
  },
  torso(ctx, sk) {
    priestTorso(ctx, sk);
  },
  head(ctx, sk, p, t) {
    hood(ctx, sk, p, t);
  },
  armNear(ctx, sk) {
    sleeveArm(ctx, sk.shN, sk.elN, sk.handN, false);
  },
  weapon(ctx, sk, p) {
    sickle(ctx, sk.handN, p.wpn);
    hand(ctx, sk.handN, false);
  },
};

const READY: HumanPose = basePose({
  root: vec(CENTER_X - 2, 65),
  lean: 0.14,
  head: 0.06,
  footN: vec(CENTER_X + 4, GROUND_Y),
  footF: vec(CENTER_X - 5.5, GROUND_Y),
  handN: vec(CENTER_X + 9, 64),
  handF: vec(CENTER_X - 12, 63),
  wpn: 1.1,
  flow: 0.12,
});

const SPEC: HumanoidMonsterSpec = {
  key: 'monster_sub_altar_keeper',
  // Wider than the old 56 for the sickle arc; width doesn't move the sprite.
  frameW: 84,
  frameH: 68,
  scale: 1.24,
  skin: SKIN,
  ready: READY,
  attack: 'overhead',
  contactWpn: 2.3,
  walk: { stride: 5.5, lift: 2.8, bob: 1, lean: 0.06, armSwing: 2 },
  shadowR: 13,
};

const TRACKS = humanoidTracks(SPEC);

export const SubAltarKeeperDrawer = humanoidMonster({
  ...SPEC,
  tracks: {
    // Long vestments fall wider than the generated pose assumes: keep the mid-fall clear of the frame floor.
    death: TRACKS.death.map(k => (k.at > 0.5 && k.at < 1 ? { ...k, pose: { ...k.pose, root: vec(k.pose.root.x, k.pose.root.y - 3) } } : k)),
  },
  fx: (ctx, p, sk, act, t) => {
    const live = act === 'death' ? Math.max(0, 1 - t * 1.2) : 1;
    const S = (pt: V): V => spun(p, pt, sk);
    // Eye slit and reliquary glow
    glow(ctx, S(headPt(sk, vec(5, -0.9))), 2.6 + p.fx, SIGIL, (0.5 + p.fx * 0.3) * live);
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
    glow(ctx, S(haloCentre(sk)), 11, SIGIL, (0.12 + pulse * 0.06 + p.fx * 0.12) * live);
    // Censer embers and rising blood-red smoke
    const cp = S(censerPoint(sk, p, t));
    glow(ctx, cp, 4 + pulse, SIGIL, (0.35 + pulse * 0.15) * live);
    for (let i = 0; i < 4; i++) {
      const k = (i / 4 + t * 0.75) % 1;
      const pt = vec(cp.x - k * 5 + Math.sin(k * 7 + i) * 1.6, cp.y - 2 - k * 13);
      glow(ctx, pt, 2 + k * 2.6, SMOKE, 0.4 * (1 - k) * live);
    }
    // Stole sigils smoulder
    const st = S(lerpV(sk.neck, sk.pelvis, 0.5));
    glow(ctx, vec(st.x + 3, st.y), 3 + pulse, SIGIL, 0.22 * live);
    if (act === 'attack' && t > 0.5) {
      const tips: V[] = [];
      const bases: V[] = [];
      for (let i = 6; i >= 0; i--) {
        const sp = samplePoseTrack(TRACKS.attack, Math.max(0.34, t - i * 0.05));
        const ssk = solveSkeleton(sp, SKIN.prop);
        tips.push(spun(sp, along(ssk.handN, sp.wpn + 0.3, BLADE_LEN), ssk));
        bases.push(spun(sp, along(ssk.handN, sp.wpn, 4), ssk));
      }
      smear(ctx, tips, bases, 0xff3050, 0.55 * p.fx);
    }
    if (act === 'attack' && t >= 0.99) {
      // Blood sigil flares on the ground under the blow
      ctx.save();
      ctx.strokeStyle = 'rgba(255,50,80,0.75)';
      ctx.lineWidth = 0.8;
      const cx = sk.handN.x + 6;
      ctx.beginPath();
      ctx.ellipse(cx, GROUND_Y, 9, 2.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 4 / 5);
        const x = cx + Math.cos(a) * 7.5;
        const y = GROUND_Y + Math.sin(a) * 2.1;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      glow(ctx, vec(cx, GROUND_Y - 1), 8, SIGIL, 0.35);
    }
  },
});
