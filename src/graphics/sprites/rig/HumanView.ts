/**
 * Isometric three-quarter views for the humanoid rig.
 *
 * The side-view rig (Humanoid.ts) keyframes poses in a 2D sagittal plane:
 * x = forward, y = down. This module lifts the same poses into 3D by adding a
 * lateral axis z (+ = the character's right / "near" side, the side the
 * profile view shows), then yaws the body ±45° and projects it the way the
 * isometric camera sees the world:
 *
 *   se — front 3/4: facing screen right-down, the chest turned to camera
 *   ne — back 3/4:  facing screen right-up, the back turned to camera
 *
 * (sw / nw are the same sheets mirrored.) Depth toward the camera also drops
 * a point down the screen by half its depth — the 2:1 iso ground ratio — so
 * a stride forward travels along the tile diagonal instead of sliding
 * sideways. Draw order is decided by projected depth, not a fixed list.
 */
import { CENTER_X, GROUND_Y, dist, lerpV, solveIK, vec, type V } from './Rig';
import type { HumanPose, Proportions, Skeleton } from './Humanoid';

export type HumanView = 'se' | 'ne';

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export function v3(x: number, y: number, z: number): V3 {
  return { x, y, z };
}

/** Screen drop per unit of depth toward the camera (2:1 isometric ground). */
export const ISO_DROP = 0.5;

/** Body yaw per view: + turns the chest toward the camera. */
export const VIEW_YAW: Readonly<Record<HumanView, number>> = {
  se: Math.PI / 4,
  ne: -Math.PI / 4,
};

/**
 * Pose-space → screen projection for one frame: applies the pose's body spin
 * (rolls, falls) in the sagittal plane, then the view yaw and iso drop.
 */
export class ViewRig {
  readonly view: HumanView;
  /** cos / sin of the yaw. */
  readonly c: number;
  readonly s: number;
  /** True for the front (se) view. */
  readonly front: boolean;
  private readonly px: number;
  private readonly py: number;
  private readonly sc: number;
  private readonly ss: number;
  private readonly d0: number;
  /** Screen-y shift (rests rotated bodies on the ground). */
  private yOff = 0;

  /** `rootX`: pose-space x whose ground point stays put on screen. */
  constructor(view: HumanView, spin: number, pivot: V, rootX: number) {
    this.view = view;
    const yaw = VIEW_YAW[view];
    this.c = Math.cos(yaw);
    this.s = Math.sin(yaw);
    this.front = view === 'se';
    this.px = pivot.x;
    this.py = pivot.y;
    this.sc = Math.cos(spin);
    this.ss = Math.sin(spin);
    // Drop is measured relative to the pelvis' ground point so the figure
    // stays anchored on its tile however far a pose leans or lunges.
    this.d0 = (rootX - CENTER_X) * this.s;
  }

  private spinX(x: number, y: number): number {
    return this.px + (x - this.px) * this.sc - (y - this.py) * this.ss;
  }

  private spinY(x: number, y: number): number {
    return this.py + (x - this.px) * this.ss + (y - this.py) * this.sc;
  }

  /** Screen position of a pose-space point with lateral offset z. */
  pt(x: number, y: number, z = 0): V {
    const sx = this.spinX(x, y);
    const sy = this.spinY(x, y);
    const f = sx - CENTER_X;
    const d = f * this.s + z * this.c;
    return { x: CENTER_X + f * this.c - z * this.s, y: sy + (d - this.d0) * ISO_DROP + this.yOff };
  }

  /** Shift every projected point vertically (see solveViewSkeleton). */
  setLift(dy: number): void {
    this.yOff = dy;
  }

  p(q: V3): V {
    return this.pt(q.x, q.y, q.z);
  }

  /** Depth toward the camera (bigger = nearer). */
  depth(x: number, y: number, z = 0): number {
    return (this.spinX(x, y) - CENTER_X) * this.s + z * this.c;
  }

  d(q: V3): number {
    return this.depth(q.x, q.y, q.z);
  }

  /** Screen vector of a pose-space direction (no translation). */
  vec(dx: number, dy: number, dz = 0): V {
    const rx = dx * this.sc - dy * this.ss;
    const ry = dx * this.ss + dy * this.sc;
    const d = rx * this.s + dz * this.c;
    return { x: rx * this.c - dz * this.s, y: ry + d * ISO_DROP };
  }

  /**
   * How squarely a pose-space surface normal faces the camera, −1…1. The
   * camera looks down at ~30°, so upward normals count a little too.
   */
  facing(nx: number, ny: number, nz = 0): number {
    const len = Math.hypot(nx, ny, nz) || 1;
    const rx = (nx * this.sc - ny * this.ss) / len;
    const ry = (nx * this.ss + ny * this.sc) / len;
    return (rx * this.s + (nz / len) * this.c) * 0.87 - ry * 0.5;
  }

  /**
   * Screen angle (dirUp convention: 0 = up, + = toward screen right) and
   * length scale of an item pointing along pose angle `angle`, optionally
   * tipped sideways by `lat` (lateral component per unit length).
   */
  dir(angle: number, lat = 0): { ang: number; k: number } {
    const v = this.vec(Math.sin(angle), -Math.cos(angle), lat);
    const len = Math.hypot(v.x, v.y);
    return { ang: Math.atan2(v.x, -v.y), k: len / Math.hypot(1, lat) };
  }

  /** Screen vector for one unit along the body's forward ground axis. */
  get fwd(): V {
    return this.vec(1, 0, 0);
  }

  /** Screen vector for one unit toward the near (right) side. */
  get side(): V {
    return this.vec(0, 0, 1);
  }
}

// ── Skeleton ────────────────────────────────────────────────────────────

export type Joint =
  | 'pelvis' | 'neck' | 'head'
  | 'hipN' | 'kneeN' | 'footN' | 'soleN'
  | 'hipF' | 'kneeF' | 'footF' | 'soleF'
  | 'shN' | 'elN' | 'handN'
  | 'shF' | 'elF' | 'handF';

/** Body widths used when lifting the sagittal pose into 3D. */
export interface ViewBuild {
  /** Half distance between the hip joints. */
  hipW: number;
  /** Half distance between the shoulder joints. */
  shW: number;
  /** How far elbows flare out from the shoulder→hand line. */
  elbowOut?: number;
  /** Extra lateral offset of the feet from the hips (stance width). */
  footOut?: number;
}

/**
 * A projected skeleton. The Skeleton fields are screen positions (so the
 * side-view limb painters work unchanged); `j` keeps the pose-space 3D
 * joints and `d` their depth toward the camera.
 */
export interface ViewSkeleton extends Skeleton {
  rig: ViewRig;
  j: Record<Joint, V3>;
  d: Record<Joint, number>;
  /** Spine length this frame (after squash/stretch). */
  torsoLen: number;
  /** Pose-space torso frame. */
  torso: Section;
  /** Pose-space head frame. */
  skull: Section;
}

function alongXY(from: V, angle: number, len: number): V {
  return { x: from.x + Math.sin(angle) * len, y: from.y - Math.cos(angle) * len };
}

export function solveViewSkeleton(p: HumanPose, prop: Proportions, build: ViewBuild, view: HumanView): ViewSkeleton {
  const torsoLen = prop.torso * (1 + p.stretch);
  const pelvis2 = p.root;
  const neck2 = alongXY(pelvis2, p.lean, torsoLen);
  const headAng = p.lean + p.head;
  const head2 = alongXY(neck2, headAng, prop.neck);
  const pivot = lerpV(pelvis2, neck2, p.pivot);
  // A body lying down (falls, rolls) spreads along the ground diagonal; take
  // the drop from mid-body then so the head doesn't sink out of the frame.
  const midX = (pelvis2.x + neck2.x) / 2;
  const midY = (pelvis2.y + neck2.y) / 2;
  const spunMidX = pivot.x + (midX - pivot.x) * Math.cos(p.spin) - (midY - pivot.y) * Math.sin(p.spin);
  const refX = pelvis2.x + (spunMidX - pelvis2.x) * Math.abs(Math.sin(p.spin));
  const rig = new ViewRig(view, p.spin, pivot, refX);

  const hipOut = build.hipW;
  const footOut = hipOut + (build.footOut ?? 0.3);
  const legN = solveIK(pelvis2, vec(p.footN.x, p.footN.y - prop.ankle), prop.thigh, prop.shin, 1);
  const legF = solveIK(pelvis2, vec(p.footF.x, p.footF.y - prop.ankle), prop.thigh, prop.shin, 1);

  // Shoulders sit on the spine a little below the neck point.
  const c = Math.cos(p.lean);
  const s = Math.sin(p.lean);
  const shY = (prop.shN.y + prop.shF.y) / 2;
  const sh2 = { x: neck2.x - shY * s, y: neck2.y + shY * c };
  const zN = build.shW + (p.zN ?? 0);
  const zF = -build.shW + (p.zF ?? 0);
  // IK in the sagittal plane with arm lengths shortened by the lateral travel
  // of the hand, so a hand brought across the body doesn't overstretch.
  const reach = (dz: number, l: number): number => Math.sqrt(Math.max(l * l * 0.4, l * l - (dz * dz) / 4));
  const armN = solveIK(sh2, p.handN, reach(zN - build.shW, prop.upperArm), reach(zN - build.shW, prop.foreArm), -1);
  const armF = solveIK(sh2, p.handF, reach(zF + build.shW, prop.upperArm), reach(zF + build.shW, prop.foreArm), -1);
  const out = build.elbowOut ?? 1.2;

  const j: Record<Joint, V3> = {
    pelvis: v3(pelvis2.x, pelvis2.y, 0),
    neck: v3(neck2.x, neck2.y, 0),
    head: v3(head2.x, head2.y, 0),
    hipN: v3(pelvis2.x, pelvis2.y, hipOut),
    kneeN: v3(legN.mid.x, legN.mid.y, (hipOut + footOut) / 2 + 0.3),
    footN: v3(legN.end.x, legN.end.y, footOut),
    soleN: v3(legN.end.x, legN.end.y + prop.ankle, footOut),
    hipF: v3(pelvis2.x, pelvis2.y, -hipOut),
    kneeF: v3(legF.mid.x, legF.mid.y, -(hipOut + footOut) / 2 - 0.3),
    footF: v3(legF.end.x, legF.end.y, -footOut),
    soleF: v3(legF.end.x, legF.end.y + prop.ankle, -footOut),
    shN: v3(sh2.x, sh2.y, build.shW),
    elN: v3(armN.mid.x, armN.mid.y, (build.shW + zN) / 2 + out),
    handN: v3(armN.end.x, armN.end.y, zN),
    shF: v3(sh2.x, sh2.y, -build.shW),
    elF: v3(armF.mid.x, armF.mid.y, (zF - build.shW) / 2 - out),
    handF: v3(armF.end.x, armF.end.y, zF),
  };
  const P = {} as Record<Joint, V>;
  const d = {} as Record<Joint, number>;
  const project = (): void => {
    for (const k of Object.keys(j) as Joint[]) {
      P[k] = rig.p(j[k]);
      d[k] = rig.d(j[k]);
    }
  };
  project();
  // Rolls and falls: rest the lowest part of the body on the ground rather
  // than letting the iso drop sink it below the frame.
  if (Math.abs(Math.sin(p.spin)) > 0.3) {
    const low = Math.max(P.head.y + prop.neck * 0.8, ...(Object.keys(P) as Joint[]).map(k => P[k].y));
    const excess = low - (GROUND_Y + 1.5);
    if (excess > 0) {
      rig.setLift(-excess * Math.min(1, Math.abs(Math.sin(p.spin))));
      project();
    }
  }
  const angOf = (a: V, b: V): number => Math.atan2(b.x - a.x, -(b.y - a.y));
  const up = v3(Math.sin(p.lean), -Math.cos(p.lean), 0);
  const fw = v3(Math.cos(p.lean), Math.sin(p.lean), 0);
  const hup = v3(Math.sin(headAng), -Math.cos(headAng), 0);
  const hfw = v3(Math.cos(headAng), Math.sin(headAng), 0);
  return {
    ...P,
    torsoAng: angOf(P.pelvis, P.neck),
    headAng: angOf(P.neck, P.head),
    rig,
    j,
    d,
    torsoLen,
    torso: new Section(rig, j.pelvis, up, fw),
    skull: new Section(rig, j.head, hup, hfw),
  };
}

// ── Body sections ───────────────────────────────────────────────────────

/** One elliptic cross-section of a lofted body mass. */
export interface Ring {
  /** Height along the section's up axis. */
  h: number;
  /** Front/back radius. */
  a: number;
  /** Side radius. */
  b: number;
  /** Forward offset of the ring centre (pot belly, sway). */
  f?: number;
}

/**
 * A local 3D frame on the body (torso or head): origin, up and forward axes
 * in pose space; lateral is always +z. Angles `phi` go round the section:
 * 0 = front, +π/2 = near (right) side, π = back.
 */
export class Section {
  readonly rig: ViewRig;
  readonly o: V3;
  readonly up: V3;
  readonly fw: V3;

  constructor(rig: ViewRig, o: V3, up: V3, fw: V3) {
    this.rig = rig;
    this.o = o;
    this.up = up;
    this.fw = fw;
  }

  p3(h: number, phi: number, a: number, b: number, f = 0): V3 {
    const ca = Math.cos(phi) * a + f;
    const sb = Math.sin(phi) * b;
    return {
      x: this.o.x + this.up.x * h + this.fw.x * ca,
      y: this.o.y + this.up.y * h + this.fw.y * ca,
      z: this.o.z + sb,
    };
  }

  /** Screen point on the section surface. */
  at(h: number, phi: number, a: number, b: number, f = 0): V {
    return this.rig.p(this.p3(h, phi, a, b, f));
  }

  /** Screen point along the axis (no radius). */
  axis(h: number, f = 0): V {
    return this.at(h, 0, 0, 0, f);
  }

  /** Depth of a surface point. */
  depth(h: number, phi: number, a: number, b: number): number {
    return this.rig.d(this.p3(h, phi, a, b));
  }

  /** Camera-facing score of the surface normal at `phi` (−1…1). */
  vis(phi: number, a = 1, b = 1): number {
    const nf = Math.cos(phi) * b;
    const nl = Math.sin(phi) * a;
    return this.rig.facing(this.fw.x * nf, this.fw.y * nf, nl);
  }

  /** The angle round the section that faces the camera most squarely. */
  get facePhi(): number {
    // facing ∝ cosφ·F + sinφ·L; maximised at atan2(L, F).
    const F = this.rig.facing(this.fw.x, this.fw.y, 0);
    const L = this.rig.facing(0, 0, 1);
    return Math.atan2(L, F);
  }

  /** Screen points of a ring arc from phi0 to phi1. */
  arc(r: Ring, phi0: number, phi1: number, n = 10): V[] {
    const pts: V[] = [];
    for (let i = 0; i <= n; i++) {
      const phi = phi0 + ((phi1 - phi0) * i) / n;
      pts.push(this.at(r.h, phi, r.a, r.b, r.f ?? 0));
    }
    return pts;
  }

  /**
   * Visible runs of a ring arc (front-facing parts only), for seams, belts
   * and trims that wrap round the body.
   */
  visibleArcs(r: Ring, phi0: number, phi1: number, n = 16, min = 0): V[][] {
    const runs: V[][] = [];
    let cur: V[] = [];
    for (let i = 0; i <= n; i++) {
      const phi = phi0 + ((phi1 - phi0) * i) / n;
      if (this.vis(phi, r.a, r.b) > min) {
        cur.push(this.at(r.h, phi, r.a, r.b, r.f ?? 0));
      } else if (cur.length) {
        runs.push(cur);
        cur = [];
      }
    }
    if (cur.length) runs.push(cur);
    return runs.filter(run => run.length > 1);
  }

  /**
   * Silhouette of a loft through `rings` (ordered top → bottom): the screen
   * outline of the swept ellipses, as a closed point list.
   */
  loft(rings: readonly Ring[], n = 24): V[] {
    const top = this.axis(rings[0].h, rings[0].f ?? 0);
    const bottom = this.axis(rings[rings.length - 1].h, rings[rings.length - 1].f ?? 0);
    let down = { x: bottom.x - top.x, y: bottom.y - top.y };
    let len = Math.hypot(down.x, down.y);
    if (len < 0.5) {
      down = { x: 0, y: 1 };
      len = 1;
    }
    down = { x: down.x / len, y: down.y / len };
    const right = { x: -down.y, y: down.x };
    const rings2 = rings.map(r => {
      const pts: V[] = [];
      for (let k = 0; k < n; k++) pts.push(this.at(r.h, (k / n) * Math.PI * 2, r.a, r.b, r.f ?? 0));
      let iL = 0;
      let iR = 0;
      pts.forEach((pt, k) => {
        const v = pt.x * right.x + pt.y * right.y;
        if (v < pts[iL].x * right.x + pts[iL].y * right.y) iL = k;
        if (v > pts[iR].x * right.x + pts[iR].y * right.y) iR = k;
      });
      return { pts, iL, iR };
    });
    const arcBetween = (ring: { pts: V[] }, from: number, to: number, wantLow: boolean): V[] => {
      const m = ring.pts.length;
      const walk = (step: number): V[] => {
        const out: V[] = [];
        for (let i = from; ; i = (i + step + m) % m) {
          out.push(ring.pts[i]);
          if (i === to || out.length > m) break;
        }
        return out;
      };
      const a = walk(1);
      const b = walk(-1);
      const score = (arr: V[]): number => arr.reduce((acc, q) => acc + q.x * down.x + q.y * down.y, 0) / arr.length;
      return (score(a) > score(b)) === wantLow ? a : b;
    };
    const first = rings2[0];
    const last = rings2[rings2.length - 1];
    const outline: V[] = [];
    outline.push(...arcBetween(first, first.iL, first.iR, false));
    for (let i = 1; i < rings2.length - 1; i++) outline.push(rings2[i].pts[rings2[i].iR]);
    outline.push(...arcBetween(last, last.iR, last.iL, true));
    for (let i = rings2.length - 2; i >= 1; i--) outline.push(rings2[i].pts[rings2[i].iL]);
    return outline;
  }
}

// ── Draw ordering ───────────────────────────────────────────────────────

/** A paint job with the depth it sits at (bigger = drawn later / nearer). */
export interface ViewPart {
  z: number;
  draw(): void;
}

export interface HumanViewSkin {
  prop: Proportions;
  build: ViewBuild;
  /** Collect the frame's parts; they are painted sorted by `z`. */
  parts(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number): ViewPart[];
}

export function drawHumanoidView(
  ctx: CanvasRenderingContext2D,
  p: HumanPose,
  skin: HumanViewSkin,
  t: number,
  view: HumanView,
): ViewSkeleton {
  const sk = solveViewSkeleton(p, skin.prop, skin.build, view);
  const parts = skin.parts(ctx, sk, p, t);
  parts.sort((a, b) => a.z - b.z);
  for (const part of parts) part.draw();
  return sk;
}

// ── Shared painters ─────────────────────────────────────────────────────

/** Smooth closed path through points (like blobPath) — re-exported helper. */
export function midpointPath(ctx: CanvasRenderingContext2D, pts: readonly V[]): void {
  const n = pts.length;
  const mid = (i: number): V => lerpV(pts[i % n], pts[(i + 1) % n], 0.5);
  const m0 = mid(n - 1);
  ctx.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  ctx.closePath();
}

/** Stroke an open polyline. */
export function strokeLine(ctx: CanvasRenderingContext2D, pts: readonly V[], color: string, width: number): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Convex hull (monotone chain) of screen points, counter-clockwise. */
export function hull(points: readonly V[]): V[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: V, a: V, b: V): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: V[] = [];
  for (const q of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: V[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const q = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

/**
 * Foot (boot/sabaton) as a projected 3D wedge: sole from heel to toe along
 * the forward axis, instep rising to the ankle. Lengths are in units.
 */
export function footOutline(rig: ViewRig, ankle: V3, sole: V3, toe: number, heel: number, width: number, cuff = 1.8): V[] {
  const w = width / 2;
  const pts: V3[] = [
    v3(sole.x - heel, sole.y, sole.z - w * 0.8),
    v3(sole.x - heel, sole.y, sole.z + w * 0.8),
    v3(sole.x + toe, sole.y, sole.z - w * 0.7),
    v3(sole.x + toe, sole.y, sole.z + w * 0.7),
    v3(sole.x + toe * 0.8, sole.y - 1.8, sole.z - w * 0.6),
    v3(sole.x + toe * 0.8, sole.y - 1.8, sole.z + w * 0.6),
    v3(ankle.x - cuff, ankle.y - 1.4, ankle.z - w),
    v3(ankle.x - cuff, ankle.y - 1.4, ankle.z + w),
    v3(ankle.x + cuff, ankle.y - 1.6, ankle.z - w),
    v3(ankle.x + cuff, ankle.y - 1.6, ankle.z + w),
  ];
  return hull(pts.map(q => rig.p(q)));
}

/**
 * Draw an item (weapon, staff) in its own local frame — origin at `at`,
 * local −y along the item — oriented and foreshortened for the view.
 */
export function inItem(
  ctx: CanvasRenderingContext2D,
  rig: ViewRig,
  at: V,
  angle: number,
  fn: (k: number) => void,
  lat = 0,
): void {
  const { ang, k } = rig.dir(angle, lat);
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(ang);
  ctx.scale(1, Math.max(0.35, k));
  fn(k);
  ctx.restore();
}

/** Midpoint of two screen points. */
export function mid(a: V, b: V): V {
  return lerpV(a, b, 0.5);
}

/** Distance helper re-exported for skins. */
export { dist, GROUND_Y };

/** Interpolated ring at height `h` between a loft's rings (top → bottom). */
export function ringAt(rings: readonly Ring[], h: number): Ring {
  if (h >= rings[0].h) return { ...rings[0], h };
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1];
    const b = rings[i];
    if (h >= b.h) {
      const k = (a.h - h) / Math.max(0.0001, a.h - b.h);
      return {
        h,
        a: a.a + (b.a - a.a) * k,
        b: a.b + (b.b - a.b) * k,
        f: (a.f ?? 0) + ((b.f ?? 0) - (a.f ?? 0)) * k,
      };
    }
  }
  return { ...rings[rings.length - 1], h };
}
