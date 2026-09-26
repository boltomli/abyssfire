// src/graphics/sprites/monsters/ShadowWeaver.ts
//
// 暗影织者 — a shadow sorceress fused to the body of a great spider: an
// ash-lilac torso and cowled head with a crown of extra eyes, rising from a
// chitin cephalothorax on eight jointed legs, a bloated abdomen marked with
// a glowing violet sigil, and long fingers that forever weave threads of
// darkness. Rears on her hind legs and flings a web of shadow.
import type { MonsterAction } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  add,
  along,
  blobPath,
  capsulePath,
  cel,
  clothChain,
  ellipsePath,
  glow,
  lerpV,
  limb,
  polyPath,
  samplePoseTrack,
  solveIK,
  tone,
  vec,
  type Key,
  type V,
} from '../rig/Rig';
import { rigMonster } from '../rig/MonsterKit';

interface WeaverPose {
  /** Spider-body junction x and its height above the ground. */
  x: number;
  lift: number;
  /** Abdomen pitch (+ tail up) and upper-body lean (+ forward). */
  pitch: number;
  lean: number;
  head: number;
  /** Hand targets as offsets from the shoulders. */
  handN: V;
  handF: V;
  /** Gait phase, stride and foot lift (walk). */
  step: number;
  stride: number;
  legLift: number;
  /** Front legs raised 0..1 and all legs curled under 0..1 (death). */
  rear: number;
  curl: number;
  flow: number;
  fx: number;
}

const CHITIN = tone(0x44366a, { light: 0.42, shadow: 0.45 });
const CHITIN_FAR = tone(0x221a36, { light: 0.25 });
const ABDOMEN = tone(0x2e2448, { light: 0.35, shadow: 0.45 });
const SKIN = tone(0x9c8cc0, { light: 0.35, shadow: 0.35 });
const SKIN_FAR = tone(0x6e6090, { light: 0.2 });
const COWL = tone(0x1c1630, { light: 0.3 });
const HAIR = tone(0xcfc6ec, { light: 0.4, shadow: 0.4 });
const SILVER = tone(0xc8c0e0, { light: 0.5 });
const MARK = '#c27dff';
const VIOLET = 0xb070ff;

const FOOT_X = [23, 12, -9, -20];
const ROOT_X = [3.6, 1.6, -0.4, -2.4];

const REST: WeaverPose = {
  x: CENTER_X + 1, lift: 16, pitch: 0.1, lean: 0.12, head: -0.08,
  handN: vec(8, 5), handF: vec(6.5, 3),
  step: 0, stride: 0, legLift: 0, rear: 0, curl: 0, flow: 0.15, fx: 0,
};
const P = (o: Partial<WeaverPose>): WeaverPose => ({ ...REST, ...o });

const ATTACK: Key<WeaverPose>[] = [
  { at: 0, pose: REST },
  { at: 0.33, ease: 'out', pose: P({ x: CENTER_X - 1, lift: 19.5, pitch: -0.16, lean: -0.22, head: -0.2, handN: vec(-9, -11), handF: vec(-11.5, -7.5), rear: 1, fx: 0.6, flow: 0.3 }) },
  { at: 0.67, ease: 'in', pose: P({ x: CENTER_X + 1, lift: 18.5, pitch: -0.05, lean: 0.12, head: -0.1, handN: vec(11.5, -13), handF: vec(8.5, -12), rear: 0.75, fx: 0.8, flow: 0.4 }) },
  { at: 1, ease: 'linear', pose: P({ x: CENTER_X + 4, lift: 15, pitch: 0.2, lean: 0.48, head: 0.05, handN: vec(13.5, 2), handF: vec(12, 3.5), rear: 0.25, fx: 1, flow: 0.55 }) },
];

const RECOIL = P({ x: CENTER_X - 2.5, lift: 17, pitch: 0.28, lean: -0.36, head: -0.4, handN: vec(2, -3), handF: vec(-1, -4), rear: 0.35, flow: 0.45 });

const HURT: Key<WeaverPose>[] = [
  { at: 0, pose: RECOIL },
  { at: 1, pose: P({ ...RECOIL, x: CENTER_X - 1, lean: -0.12, head: -0.15, handN: vec(6, 2), handF: vec(4, 1), rear: 0.1, flow: 0.25 }) },
];

const DEATH: Key<WeaverPose>[] = [
  { at: 0, pose: RECOIL },
  { at: 0.33, pose: P({ x: CENTER_X - 2, lift: 18, pitch: 0.35, lean: -0.5, head: -0.5, handN: vec(0, -10), handF: vec(-3, -9), rear: 0.8, curl: 0.15, flow: 0.4 }) },
  { at: 0.67, ease: 'in', pose: P({ x: CENTER_X - 1, lift: 10, pitch: 0.05, lean: 0.4, head: 0.4, handN: vec(9, 8), handF: vec(7, 9), rear: 0.2, curl: 0.55, flow: 0.2 }) },
  { at: 1, ease: 'out', pose: P({ x: CENTER_X - 1, lift: 5.5, pitch: -0.08, lean: 1.05, head: 0.3, handN: vec(11, 9), handF: vec(9, 10), rear: 0, curl: 1, flow: 0.05 }) },
];

function weaverPose(act: MonsterAction, t: number): WeaverPose {
  const ph = t * Math.PI * 2;
  switch (act) {
    case 'idle':
      return P({
        lift: REST.lift + Math.sin(ph) * 0.7,
        pitch: REST.pitch + Math.sin(ph - 0.6) * 0.04,
        head: REST.head + Math.sin(ph - 0.9) * 0.05,
        // Hands circle each other, weaving
        handN: vec(REST.handN.x + Math.cos(ph) * 1.6, REST.handN.y + Math.sin(ph) * 1.6),
        handF: vec(REST.handF.x - Math.cos(ph) * 1.4, REST.handF.y - Math.sin(ph) * 1.4),
        flow: 0.15 + Math.sin(ph) * 0.06,
        fx: 0.25,
      });
    case 'walk':
      return P({
        lift: REST.lift + Math.abs(Math.sin(ph * 2)) * 0.8,
        lean: 0.2,
        pitch: 0.1 + Math.sin(ph * 2) * 0.04,
        step: t,
        stride: 4.5,
        legLift: 4,
        handN: vec(7 + Math.cos(ph) * 1, 5),
        handF: vec(5 - Math.cos(ph) * 1, 4),
        flow: 0.45 + Math.sin(ph * 2) * 0.06,
        fx: 0.2,
      });
    case 'attack': return samplePoseTrack(ATTACK, t);
    case 'hurt': return samplePoseTrack(HURT, t);
    case 'death': return samplePoseTrack(DEATH, t);
  }
}

// ── Skeleton ────────────────────────────────────────────────────────────

interface Leg { root: V; knee: V; foot: V; far: boolean }

interface WeaverBody {
  J: V;
  abd: V;
  abdAng: number;
  waist: V;
  neck: V;
  head: V;
  headAng: number;
  shN: V;
  shF: V;
  armN: { mid: V; end: V };
  armF: { mid: V; end: V };
  legs: Leg[];
}

function rot(o: V, ang: number, l: V): V {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return vec(o.x + l.x * c - l.y * s, o.y + l.x * s + l.y * c);
}

function solveWeaver(p: WeaverPose): WeaverBody {
  const J = vec(p.x, GROUND_Y - p.lift);
  const abdAng = -p.pitch;
  const abd = rot(J, abdAng, vec(-11.5, -3.5));
  const waist = vec(J.x + 3.4, J.y - 3.6);
  const neck = along(waist, p.lean, 14.5);
  const headAng = p.lean + p.head;
  const head = along(neck, headAng, 7);
  const shN = rot(neck, p.lean, vec(1.4, 3.2));
  const shF = rot(neck, p.lean, vec(-3.6, 2.6));
  const legs: Leg[] = [];
  for (const far of [true, false]) {
    FOOT_X.forEach((lx, i) => {
      const root = vec(J.x + ROOT_X[i] - (far ? 1.4 : 0), J.y + (far ? -1 : 0.6));
      let fx = J.x + lx + (far ? -2.6 : 0);
      let fy = GROUND_Y - (far ? 1.6 : 0);
      if (p.stride > 0) {
        const ph = p.step * Math.PI * 2 + (i % 2 === 0 ? 0 : Math.PI) + (far ? Math.PI : 0);
        fx += p.stride * Math.cos(ph);
        fy -= p.legLift * Math.max(0, -Math.sin(ph));
      }
      if (i === 0 && p.rear > 0) {
        fx += (J.x + 16 + (far ? -2 : 0) - fx) * p.rear;
        fy += (J.y - 13 + (far ? 1 : 0) - fy) * p.rear;
      }
      if (p.curl > 0) {
        const cx = root.x + (lx > 0 ? 5 : -5);
        const cy = J.y + 3;
        fx += (cx - fx) * p.curl;
        fy += (cy - fy) * p.curl;
      }
      const foot = vec(fx, Math.min(GROUND_Y, fy));
      // Spider knees arch high above the body; placed directly rather than
      // by IK so every leg keeps that silhouette whatever the foot does.
      const kneeH = (21 - Math.abs(i - 1.5) * 2) * (1 - p.curl * 0.55) - (far ? 1 : 0);
      const side = foot.x > root.x ? 1 : -1;
      const knee = add(lerpV(root, foot, 0.45), vec(side * 1, -kneeH));
      legs.push({ root, knee, foot, far });
    });
  }
  return {
    J, abd, abdAng, waist, neck, head, headAng, shN, shF,
    armN: solveIK(shN, add(shN, p.handN), 8.6, 8.2, -1),
    armF: solveIK(shF, add(shF, p.handF), 8.6, 8.2, -1),
    legs,
  };
}

// ── Drawing ─────────────────────────────────────────────────────────────

function leg(ctx: CanvasRenderingContext2D, l: Leg): void {
  const t = l.far ? CHITIN_FAR : CHITIN;
  cel(ctx, () => capsulePath(ctx, l.root, l.knee, 1.7, 1.2), t, { band: 0.7 });
  cel(ctx, () => capsulePath(ctx, l.knee, l.foot, 1.2, 0.2), t, { band: 0.5 });
  // Knee spur and violet band
  cel(ctx, () => ellipsePath(ctx, l.knee, 1.5, 1.4), t, { band: 0.5 });
  const band = lerpV(l.knee, l.foot, 0.35);
  ctx.fillStyle = l.far ? 'rgba(150,90,220,0.5)' : MARK;
  ctx.beginPath();
  ctx.ellipse(band.x, band.y, 1.2, 0.6, Math.atan2(l.foot.y - l.knee.y, l.foot.x - l.knee.x) + Math.PI / 2, 0, Math.PI * 2);
  ctx.fill();
  cel(ctx, () => polyPath(ctx, [vec(l.knee.x - 0.8, l.knee.y - 1), vec(l.knee.x + 0.1, l.knee.y - 3.4), vec(l.knee.x + 0.9, l.knee.y - 1)]), t, { band: 0.2, stroke: 0.35 });
}

function abdomen(ctx: CanvasRenderingContext2D, b: WeaverBody, t: number): void {
  const breathe = 1 + Math.sin(t * Math.PI * 2) * 0.03;
  ctx.save();
  ctx.translate(b.abd.x, b.abd.y);
  ctx.rotate(b.abdAng - 0.22);
  ctx.scale(breathe, breathe);
  // Spinnerets at the tail
  cel(ctx, () => polyPath(ctx, [vec(-10.6, -1.6), vec(-14.2, 0.2), vec(-10.4, 2.4)]), CHITIN, { band: 0.4 });
  const shape = [vec(-11.6, 0), vec(-9.4, -6.8), vec(-2, -9.6), vec(6.8, -7.2), vec(11, -1.4), vec(9, 5.4), vec(1, 8.4), vec(-7.4, 6.6)];
  cel(ctx, () => blobPath(ctx, shape), ABDOMEN, { band: 2.4, hi: 1 });
  // Chitin segment lines
  ctx.strokeStyle = CHITIN_FAR.base;
  ctx.lineWidth = 0.6;
  for (const x of [-5, 1.5]) {
    ctx.beginPath();
    ctx.moveTo(x - 1.4, -8.4);
    ctx.quadraticCurveTo(x + 1.6, -0.6, x - 0.6, 7.4);
    ctx.stroke();
  }
  // Glowing sigil: hourglass with an eye
  ctx.fillStyle = MARK;
  ctx.beginPath();
  ctx.moveTo(-5.2, -6.4);
  ctx.lineTo(0.8, -6.8);
  ctx.lineTo(-2.2, -3.4);
  ctx.closePath();
  ctx.moveTo(-2.2, -3.4);
  ctx.lineTo(1.4, 0.2);
  ctx.lineTo(-5.6, 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2e4ff';
  ctx.beginPath();
  ctx.arc(-2.2, -3.4, 0.9, 0, Math.PI * 2);
  ctx.fill();
  // Pale spots along the flank
  ctx.fillStyle = 'rgba(200,170,255,0.55)';
  for (const [x, y] of [[4.4, -4.6], [6.6, -1.4], [3.6, 2.6]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function cephalothorax(ctx: CanvasRenderingContext2D, b: WeaverBody): void {
  const J = b.J;
  cel(ctx, () => blobPath(ctx, [vec(J.x - 6.5, J.y + 0.5), vec(J.x - 4, J.y - 4.5), vec(J.x + 3, J.y - 5.6), vec(J.x + 7.6, J.y - 2.4), vec(J.x + 7, J.y + 2.6), vec(J.x + 1, J.y + 4.2), vec(J.x - 5, J.y + 3.6)]), CHITIN, { band: 1.4 });
  // Fanged chelicerae under the waist
  cel(ctx, () => polyPath(ctx, [vec(J.x + 5.4, J.y + 1.6), vec(J.x + 7.6, J.y + 1.2), vec(J.x + 7.2, J.y + 5.4), vec(J.x + 6.2, J.y + 3.2)]), CHITIN_FAR, { band: 0.3, stroke: 0.4 });
}

function hairBack(ctx: CanvasRenderingContext2D, b: WeaverBody, p: WeaverPose, t: number): void {
  const anchor = rot(b.head, b.headAng, vec(-5.5, -2.5));
  for (let i = 0; i < 3; i++) {
    const chain = clothChain(vec(anchor.x + i * 0.8, anchor.y + i * 1.6), 18 - i * 2.5, 5, 0.55 + p.flow * 0.7, 1.6, t * Math.PI * 2 + i * 1.1);
    const l: V[] = [];
    const r: V[] = [];
    chain.forEach((pt, j) => {
      const w = 2.4 * (1 - j / chain.length) + 0.3;
      l.push(vec(pt.x - w * 0.5, pt.y - w));
      r.push(vec(pt.x + w * 0.5, pt.y + w));
    });
    cel(ctx, () => blobPath(ctx, [...l, ...r.reverse()]), HAIR, { band: 0.7 });
  }
}

function torso(ctx: CanvasRenderingContext2D, b: WeaverBody): void {
  ctx.save();
  ctx.translate(b.neck.x, b.neck.y);
  ctx.rotate(Math.atan2(b.waist.y - b.neck.y, b.waist.x - b.neck.x) - Math.PI / 2);
  const len = Math.hypot(b.waist.x - b.neck.x, b.waist.y - b.neck.y);
  ctx.scale(1.18, 1);
  const body = [vec(-4, 0.4), vec(1, -0.6), vec(4.6, 1.4), vec(5.2, 5.4), vec(3.6, len * 0.62), vec(4.6, len + 1.4), vec(-4.4, len + 1.6), vec(-3.4, len * 0.6), vec(-4.8, 5)];
  cel(ctx, () => blobPath(ctx, body), SKIN, { band: 1.4 });
  // Chitin plates fusing into the spider body
  cel(ctx, () => blobPath(ctx, [vec(-4.8, len - 3), vec(4.8, len - 3.6), vec(5.6, len + 2), vec(-5, len + 2.4)]), CHITIN, { band: 0.8 });
  ctx.strokeStyle = CHITIN.light;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(-4.4, len - 1);
  ctx.lineTo(5, len - 1.6);
  ctx.stroke();
  // Shadow-silk wrap across the chest
  cel(ctx, () => polyPath(ctx, [vec(-4.6, 2.4), vec(5, 3), vec(5.4, 7.2), vec(-4.2, 6)]), COWL, { band: 0.6 });
  ctx.strokeStyle = 'rgba(210,180,255,0.55)';
  ctx.lineWidth = 0.35;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-4.2, 3 + i * 1.2);
    ctx.lineTo(5, 3.8 + i * 1.2);
    ctx.stroke();
  }
  // Silver collar with a violet gem
  cel(ctx, () => ellipsePath(ctx, vec(0.6, 0.6), 4.2, 1.8), SILVER, { band: 0.5 });
  ctx.fillStyle = MARK;
  ctx.beginPath();
  ctx.arc(2.8, 1.2, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function headAndCowl(ctx: CanvasRenderingContext2D, b: WeaverBody): void {
  ctx.save();
  ctx.translate(b.head.x, b.head.y);
  ctx.rotate(b.headAng);
  ctx.scale(1.25, 1.25);
  // Cowl
  const cowl = [vec(-6, 3), vec(-6.4, -3), vec(-2.6, -7.6), vec(2.4, -8), vec(5.8, -4.6), vec(4.6, -1.4), vec(1.6, -2.4), vec(0.4, 4.6), vec(-3, 6.4)];
  cel(ctx, () => blobPath(ctx, cowl), COWL, { band: 1.4 });
  // Face: sharp, gaunt, pointed chin
  const face = [vec(0.2, -3.6), vec(4.2, -3.4), vec(5.8, -0.8), vec(5.2, 2.2), vec(3.4, 5.2), vec(1.4, 4.4), vec(0, 0.8)];
  cel(ctx, () => blobPath(ctx, face), SKIN, { band: 0.9, stroke: 0.4 });
  // Dark lips
  ctx.fillStyle = '#3a1848';
  ctx.fillRect(3.2, 2.6, 1.8, 0.6);
  // Main eyes (glow added in fx) and the extra spider eyes on the brow
  ctx.fillStyle = '#1a0a2a';
  ctx.beginPath();
  ctx.ellipse(3.4, -0.6, 1.2, 0.7, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0dcff';
  ctx.fillRect(3.2, -0.9, 1, 0.6);
  ctx.fillStyle = '#e0b8ff';
  for (const [x, y, r] of [[2.6, -2.5, 0.45], [3.8, -2.7, 0.5], [4.9, -2.3, 0.4]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cowl rim and silver circlet with a crescent
  ctx.strokeStyle = COWL.light;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, -4.4);
  ctx.quadraticCurveTo(4, -5.2, 5.6, -4);
  ctx.stroke();
  cel(ctx, () => {
    ctx.moveTo(1.4, -6.2);
    ctx.quadraticCurveTo(3.4, -10.2, 0.6, -12);
    ctx.quadraticCurveTo(2, -9.4, 0, -6.4);
    ctx.closePath();
  }, SILVER, { band: 0.3, stroke: 0.35 });
  ctx.restore();
}

function arm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean): void {
  const t = far ? SKIN_FAR : SKIN;
  limb(ctx, sh, el, 2, 1.7, t);
  limb(ctx, el, hand, 1.7, 1.3, t);
  // Shadow-silk sleeve bands
  const a = lerpV(el, hand, 0.2);
  const c = lerpV(el, hand, 0.65);
  cel(ctx, () => capsulePath(ctx, a, c, 1.9, 1.6), far ? tone(0x151024) : COWL, { band: 0.5 });
  // Long clawed fingers
  const ang = Math.atan2(hand.y - el.y, hand.x - el.x);
  cel(ctx, () => ellipsePath(ctx, hand, 1.5, 1.3), t, { band: 0.4, stroke: 0.35 });
  for (let i = -1; i <= 1; i++) {
    const tip = vec(hand.x + Math.cos(ang + i * 0.4) * 3.6, hand.y + Math.sin(ang + i * 0.4) * 3.6);
    cel(ctx, () => capsulePath(ctx, hand, tip, 0.5, 0.15), t, { band: 0.2, stroke: 0.3 });
  }
}

function drawWeaver(ctx: CanvasRenderingContext2D, p: WeaverPose, t: number): void {
  const b = solveWeaver(p);
  for (const l of b.legs.filter(l => l.far)) leg(ctx, l);
  abdomen(ctx, b, t);
  hairBack(ctx, b, p, t);
  arm(ctx, b.shF, b.armF.mid, b.armF.end, true);
  cephalothorax(ctx, b);
  for (const l of b.legs.filter(l => !l.far)) leg(ctx, l);
  torso(ctx, b);
  headAndCowl(ctx, b);
  arm(ctx, b.shN, b.armN.mid, b.armN.end, false);
}

// ── Effects ─────────────────────────────────────────────────────────────

function thread(ctx: CanvasRenderingContext2D, a: V, c: V, sag: number, alpha: number, w = 0.45): void {
  if (alpha <= 0.02) return;
  const m = vec((a.x + c.x) / 2, (a.y + c.y) / 2 + sag);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(216,184,255,${alpha})`;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(m.x, m.y, c.x, c.y);
  ctx.stroke();
  ctx.restore();
}

function weaverFx(ctx: CanvasRenderingContext2D, p: WeaverPose, act: MonsterAction, t: number): void {
  const b = solveWeaver(p);
  const live = act === 'death' ? Math.max(0, 1 - t * 1.3) : 1;
  const eye = rot(b.head, b.headAng, vec(3.8, -0.6));
  glow(ctx, eye, 2.6 + p.fx, VIOLET, (0.55 + p.fx * 0.3) * live);
  // Abdomen sigil pulse
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
  glow(ctx, rot(b.abd, b.abdAng - 0.22, vec(-2.2, -3.4)), 5 + pulse * 1.5, VIOLET, (0.35 + pulse * 0.15) * live);
  // Threads strung between the weaving fingers
  const hN = b.armN.end;
  const hF = b.armF.end;
  const ph = t * Math.PI * 2;
  for (let i = 0; i < 3; i++) {
    thread(ctx, vec(hN.x, hN.y + i * 0.6), vec(hF.x, hF.y + i * 0.8), 2 + i * 1.2 + Math.sin(ph + i) * 0.8, (0.55 - i * 0.12) * live);
  }
  glow(ctx, hN, 2.2 + p.fx * 1.8, VIOLET, (0.3 + p.fx * 0.4) * live);
  glow(ctx, hF, 2 + p.fx * 1.5, VIOLET, (0.25 + p.fx * 0.35) * live);
  // Silk line trailing from the spinnerets
  const spin = rot(b.abd, b.abdAng - 0.22, vec(-14, 0.2));
  thread(ctx, spin, vec(spin.x - 6 - p.flow * 4, GROUND_Y - 0.5), 1.5, 0.35 * live, 0.35);
  if (act === 'attack' && p.fx > 0.55) {
    // A web woven between the raised hands, then flung forward
    const k = Math.max(0, (t - 0.67) / 0.33);
    const centre = lerpV(lerpV(hN, hF, 0.5), vec(hN.x + 8, hN.y - 1), k);
    const r = 3.5 + k * 3.5;
    for (let i = 0; i < 6; i++) {
      const a = i * (Math.PI / 3) + t * 2;
      thread(ctx, centre, vec(centre.x + Math.cos(a) * r, centre.y + Math.sin(a) * r * 0.8), 0, 0.8 * p.fx);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(216,184,255,${0.6 * p.fx})`;
    ctx.lineWidth = 0.4;
    for (const rr of [0.45, 0.8]) {
      ctx.beginPath();
      ctx.ellipse(centre.x, centre.y, r * rr, r * rr * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    glow(ctx, centre, r + 3, VIOLET, 0.35 * p.fx);
    if (k > 0) {
      thread(ctx, hN, centre, 1, 0.7);
      thread(ctx, hF, centre, 1.5, 0.6);
    }
  }
}

export const ShadowWeaverDrawer = rigMonster<WeaverPose>({
  key: 'monster_shadow_weaver',
  // Wider than the old 52 for the eight-legged body and the flung web.
  frameW: 88,
  frameH: 64,
  scale: 1.36,
  pose: weaverPose,
  draw: (ctx, p, _act, t) => drawWeaver(ctx, p, t),
  shadow: (p) => ({ x: p.x - 2, r: 20, lift: 0 }),
  fx: weaverFx,
  rim: 'rgba(210,180,255,0.5)',
});
