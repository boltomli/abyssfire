/**
 * Isometric 3/4 views for monsters.
 *
 * Monsters are drawn with the same HumanView projection as the heroes (se =
 * front 3/4, ne = back 3/4; sw / nw mirror them). Most monster art was
 * authored for the side-view humanoid rig, so this module lets a monster keep
 * its side-view limb, weapon and effect painters — they receive projected
 * joints, or are flattened onto the body's sagittal plane — and only replace
 * what must turn with the body: torso and head, built as 3D lofts with the
 * features placed on their surfaces.
 */
import { CENTER_X, GROUND_Y, blobPath, cel, polyPath, type Tone, type V } from './Rig';
import { solveSkeleton, type HumanPose, type HumanSkin, type Skeleton } from './Humanoid';
import {
  hull,
  Section,
  ringAt,
  strokeLine,
  type HumanView,
  type HumanViewSkin,
  type Ring,
  type V3,
  type ViewBuild,
  type ViewPart,
  type ViewRig,
  type ViewSkeleton,
} from './HumanView';

export const MONSTER_VIEWS: readonly HumanView[] = ['se', 'ne'];

// ── Flattened side-view art ─────────────────────────────────────────────

/**
 * Draw side-view art (pose space: x forward, y down) flattened onto the body's
 * sagittal plane at lateral offset `z`, as the view sees it. With `anchor`
 * the side-view point `from` is pinned to the screen point `to` (e.g. a
 * weapon painted at the side-view hand, placed at the projected hand).
 */
export function sagittal(
  ctx: CanvasRenderingContext2D,
  rig: ViewRig,
  z: number,
  fn: () => void,
  anchor?: { from: V; to: V },
): void {
  const o = rig.pt(0, 0, z);
  const ax = rig.pt(1, 0, z);
  const ay = rig.pt(0, 1, z);
  const a = { x: ax.x - o.x, y: ax.y - o.y };
  const b = { x: ay.x - o.x, y: ay.y - o.y };
  let e = o.x;
  let f = o.y;
  if (anchor) {
    e = anchor.to.x - (a.x * anchor.from.x + b.x * anchor.from.y);
    f = anchor.to.y - (a.y * anchor.from.x + b.y * anchor.from.y);
  }
  ctx.save();
  ctx.transform(a.x, a.y, b.x, b.y, e, f);
  fn();
  ctx.restore();
}

/** Apply the affine map that sends points through `map` (sampled at 3 points). */
export function withAffine(ctx: CanvasRenderingContext2D, map: (q: V) => V, fn: () => void): void {
  const o = map({ x: 0, y: 0 });
  const ax = map({ x: 1, y: 0 });
  const ay = map({ x: 0, y: 1 });
  ctx.save();
  ctx.transform(ax.x - o.x, ax.y - o.y, ay.x - o.x, ay.y - o.y, o.x, o.y);
  fn();
  ctx.restore();
}

/**
 * Like `sagittal`, for side-view art that already applied the pose's body
 * spin itself (effects drawn with `spun()` outside `drawHumanoid`).
 */
export function sagittalSpun(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, fn: () => void): void {
  const piv = {
    x: sk.j.pelvis.x + (sk.j.neck.x - sk.j.pelvis.x) * p.pivot,
    y: sk.j.pelvis.y + (sk.j.neck.y - sk.j.pelvis.y) * p.pivot,
  };
  const c = Math.cos(-p.spin);
  const s = Math.sin(-p.spin);
  withAffine(ctx, q => {
    const dx = q.x - piv.x;
    const dy = q.y - piv.y;
    return sk.rig.pt(piv.x + dx * c - dy * s, piv.y + dx * s + dy * c, 0);
  }, fn);
}

/** Shadow x for a side-view x: projected in a 3/4 view, unchanged otherwise. */
export function groundX(view: HumanView | undefined, x: number): number {
  return view ? viewGroundX(view, x) : x;
}

/** Ground-plane x of a pose-space x in the view (for shadows). */
export function viewGroundX(view: HumanView, x: number): number {
  return CENTER_X + (x - CENTER_X) * Math.cos(view === 'se' ? Math.PI / 4 : -Math.PI / 4);
}

// ── Turned sections ─────────────────────────────────────────────────────

/**
 * A section yawed about its own up axis by `psi` (+ turns the front toward
 * the near side). Monsters in the front view turn their heads toward the
 * camera a little, so faces read instead of sliding to the silhouette edge.
 */
export class TurnedSection extends Section {
  readonly psi: number;
  private readonly cp: number;
  private readonly spsi: number;

  constructor(base: Section, psi: number) {
    super(base.rig, base.o, base.up, base.fw);
    this.psi = psi;
    this.cp = Math.cos(psi);
    this.spsi = Math.sin(psi);
  }

  override p3(h: number, phi: number, a: number, b: number, f = 0): V3 {
    const ca = Math.cos(phi) * a + f;
    const sb = Math.sin(phi) * b;
    // fw' = fw·cos + lat·sin ; lat' = lat·cos − fw·sin (lat = +z).
    const kf = ca * this.cp - sb * this.spsi;
    return {
      x: this.o.x + this.up.x * h + this.fw.x * kf,
      y: this.o.y + this.up.y * h + this.fw.y * kf,
      z: this.o.z + ca * this.spsi + sb * this.cp,
    };
  }

  override vis(phi: number, a = 1, b = 1): number {
    const nf = Math.cos(phi) * b;
    const nl = Math.sin(phi) * a;
    const kf = nf * this.cp - nl * this.spsi;
    const kl = nf * this.spsi + nl * this.cp;
    return this.rig.facing(this.fw.x * kf, this.fw.y * kf, kl);
  }
}

/** Head turned toward the camera in the front view (`psi` rad), as-is in the back view. */
export function turnedHead(sk: ViewSkeleton, psi = 0.45, back = 0): Section {
  const k = sk.rig.front ? psi : back;
  return k === 0 ? sk.skull : new TurnedSection(sk.skull, k);
}

// ── Local section coordinates ───────────────────────────────────────────

/** Section-local point: `h` along up, `f` forward, `l` lateral (+ = near/right side). */
export function lp(S: Section, h: number, f: number, l: number): V3 {
  return S.p3(h, Math.PI / 2, 0, l, f);
}

/** Screen position of a section-local point. */
export function sp(S: Section, h: number, f: number, l: number): V {
  return S.rig.p(lp(S, h, f, l));
}

/** Depth (toward the camera) of a section-local point. */
export function sd(S: Section, h: number, f: number, l: number): number {
  return S.rig.d(lp(S, h, f, l));
}

export type L3 = readonly [number, number, number];

/** Cel-filled polygon from section-local [h, f, l] points. */
export function poly3(
  ctx: CanvasRenderingContext2D,
  S: Section,
  pts: readonly L3[],
  t: Tone,
  opts: { band?: number; hi?: number; stroke?: number; smooth?: boolean } = {},
): void {
  const scr = pts.map(q => sp(S, q[0], q[1], q[2]));
  cel(ctx, () => (opts.smooth ? blobPath(ctx, scr) : polyPath(ctx, scr)), t, opts);
}

/** Cel-filled convex hull of section-local points (noses, horns, snouts). */
export function hull3(
  ctx: CanvasRenderingContext2D,
  S: Section,
  pts: readonly L3[],
  t: Tone,
  opts: { band?: number; hi?: number; stroke?: number; smooth?: boolean } = {},
): V[] {
  const scr = hull(pts.map(q => sp(S, q[0], q[1], q[2])));
  cel(ctx, () => (opts.smooth ? blobPath(ctx, scr) : polyPath(ctx, scr)), t, opts);
  return scr;
}

/** Mirror a list of local points to the other side (l → −l). */
export function mirrorL(pts: readonly L3[]): L3[] {
  return pts.map(q => [q[0], q[1], -q[2]] as const);
}

/** Average depth of local points (for sorting). */
export function depthOf(S: Section, pts: readonly L3[]): number {
  let d = 0;
  for (const q of pts) d += sd(S, q[0], q[1], q[2]);
  return d / Math.max(1, pts.length);
}

// ── Lofted volumes ──────────────────────────────────────────────────────

/**
 * Rings for a volume whose side profile is `pts` (x forward, y down), as
 * drawn in a side-view painter. `hOf` converts profile y to section height;
 * `width(a, h)` gives the side (lateral) radius for a front/back radius.
 * Rings come out ordered top → bottom, as `Section.loft` expects.
 */
export function profileRings(
  pts: readonly V[],
  hOf: (y: number) => number,
  width: (a: number, h: number) => number,
  samples = 7,
): Ring[] {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const q of pts) {
    minY = Math.min(minY, q.y);
    maxY = Math.max(maxY, q.y);
  }
  const rings: Ring[] = [];
  for (let i = 0; i < samples; i++) {
    // Cosine spacing: denser near the caps so domes stay round; the ends are
    // sampled slightly inside so the caps aren't degenerate.
    const k = (1 - Math.cos(Math.PI * (0.05 + (0.9 * i) / (samples - 1)))) / 2;
    const y = minY + (maxY - minY) * k;
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j];
      const b = pts[(j + 1) % pts.length];
      if ((a.y <= y && b.y >= y) || (b.y <= y && a.y >= y)) {
        const u = Math.abs(b.y - a.y) < 1e-6 ? 0.5 : (y - a.y) / (b.y - a.y);
        const x = a.x + (b.x - a.x) * u;
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    }
    if (!isFinite(lo)) continue;
    const a = Math.max(0.4, (hi - lo) / 2);
    const h = hOf(y);
    rings.push({ h, a, b: width(a, h), f: (hi + lo) / 2 });
  }
  rings.sort((p, q) => q.h - p.h);
  return rings;
}

/**
 * Screen silhouette of a lofted volume as convex pieces: the hull of every
 * pair of neighbouring rings. Their union is exact for domes, bellies and
 * waists alike (a single outline from ring extremes is not, once the iso
 * drop turns rings into tilted ellipses).
 */
export function loftPieces(S: Section, rings: readonly Ring[], n = 20): V[][] {
  const pts = rings.map(r => {
    const out: V[] = [];
    for (let k = 0; k < n; k++) out.push(S.at(r.h, (k / n) * Math.PI * 2, r.a, r.b, r.f ?? 0));
    return out;
  });
  if (pts.length === 1) return [hull(pts[0])];
  const pieces: V[][] = [];
  for (let i = 0; i + 1 < pts.length; i++) pieces.push(hull([...pts[i], ...pts[i + 1]]));
  return pieces;
}

/** Path of a union of convex pieces (nonzero fill). */
export function piecesPath(ctx: CanvasRenderingContext2D, pieces: readonly (readonly V[])[]): void {
  for (const pc of pieces) polyPath(ctx, pc);
}

/**
 * Cel-shade a union of pieces with one clean outline: strokes of every
 * piece go down first and the fill covers their inner halves (and all the
 * seams between pieces).
 */
export function celPieces(
  ctx: CanvasRenderingContext2D,
  pieces: readonly (readonly V[])[],
  t: Tone,
  opts: { band?: number; hi?: number; stroke?: number } = {},
): void {
  const stroke = opts.stroke ?? 0.55;
  if (stroke > 0) {
    ctx.beginPath();
    piecesPath(ctx, pieces);
    ctx.strokeStyle = t.line;
    ctx.lineWidth = stroke * 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  cel(ctx, () => piecesPath(ctx, pieces), t, { ...opts, stroke: 0 });
}

/** Fill a lofted volume with cel shading; returns its pieces (for clipping). */
export function loftFill(
  ctx: CanvasRenderingContext2D,
  S: Section,
  rings: readonly Ring[],
  t: Tone,
  opts: { band?: number; hi?: number; stroke?: number } = {},
): V[][] {
  const pieces = loftPieces(S, rings);
  celPieces(ctx, pieces, t, opts);
  return pieces;
}

/** Run `fn` clipped to a union of pieces. */
export function clipTo(ctx: CanvasRenderingContext2D, pieces: readonly (readonly V[])[], fn: () => void): void {
  ctx.save();
  ctx.beginPath();
  piecesPath(ctx, pieces);
  ctx.clip();
  fn();
  ctx.restore();
}

/**
 * The part of a loft between heights hMin and hMax, radii grown by `lift`
 * (armour plates, helms, sleeves over a body).
 */
export function ringsBetween(rings: readonly Ring[], hMin: number, hMax: number, lift = 0, scaleB = 1): Ring[] {
  const out: Ring[] = [ringAt(rings, hMax)];
  for (const r of rings) if (r.h < hMax && r.h > hMin) out.push(r);
  out.push(ringAt(rings, hMin));
  return out.map(r => ({ ...r, a: r.a + lift, b: (r.b + lift) * scaleB }));
}

/** 3D point on a loft's surface at height h, angle phi (0 front, +π/2 near side). */
export function surf3(S: Section, rings: readonly Ring[], h: number, phi: number, lift = 0): V3 {
  const r = ringAt(rings, h);
  return S.p3(h, phi, r.a + lift, r.b + lift, r.f ?? 0);
}

export function surf(S: Section, rings: readonly Ring[], h: number, phi: number, lift = 0): V {
  return S.rig.p(surf3(S, rings, h, phi, lift));
}

/** How squarely the surface at phi faces the camera (−1…1). */
export function surfVis(S: Section, rings: readonly Ring[], h: number, phi: number): number {
  const r = ringAt(rings, h);
  return S.vis(phi, r.a, r.b);
}

/**
 * Draw a flat decal on a loft surface: `fn` draws in local units with the
 * origin at (h, phi), +x round the body toward +phi and +y down the surface.
 * Returns false (and draws nothing) when the spot faces away.
 */
export function decal(
  ctx: CanvasRenderingContext2D,
  S: Section,
  rings: readonly Ring[],
  h: number,
  phi: number,
  fn: () => void,
  opts: { lift?: number; minVis?: number } = {},
): boolean {
  if (surfVis(S, rings, h, phi) < (opts.minVis ?? 0)) return false;
  const lift = opts.lift ?? 0;
  const c3 = surf3(S, rings, h, phi, lift);
  const e = 0.05;
  const a3 = surf3(S, rings, h, phi + e, lift);
  const b3 = surf3(S, rings, h, phi - e, lift);
  const d3 = surf3(S, rings, h - 0.3, phi, lift);
  const u3 = norm3(a3.x - b3.x, a3.y - b3.y, a3.z - b3.z);
  const v3d = norm3(d3.x - c3.x, d3.y - c3.y, d3.z - c3.z);
  const u = S.rig.vec(u3.x, u3.y, u3.z);
  const v = S.rig.vec(v3d.x, v3d.y, v3d.z);
  const c = S.rig.p(c3);
  ctx.save();
  ctx.transform(u.x, u.y, v.x, v.y, c.x, c.y);
  fn();
  ctx.restore();
  return true;
}

function norm3(x: number, y: number, z: number): V3 {
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
}

/** Stroke the camera-facing runs of a band around a loft at height h. */
export function band(
  ctx: CanvasRenderingContext2D,
  S: Section,
  rings: readonly Ring[],
  h: number,
  t: Tone,
  width: number,
  lift = 0.25,
): void {
  const r = ringAt(rings, h);
  for (const run of S.visibleArcs({ ...r, a: r.a + lift, b: r.b + lift }, 0, Math.PI * 2, 32, -0.12)) {
    strokeLine(ctx, run, t.line, width + 0.8);
    strokeLine(ctx, run, t.base, width);
  }
}

/**
 * Visible runs of a curve drawn on a loft surface through (h, phi) control
 * points (linearly interpolated), e.g. straps, seams, scars.
 */
export function surfCurve(
  S: Section,
  rings: readonly Ring[],
  ctrl: readonly (readonly [number, number])[],
  lift = 0.2,
  n = 16,
  minVis = -0.08,
): V[][] {
  const runs: V[][] = [];
  let cur: V[] = [];
  const total = n * (ctrl.length - 1);
  for (let i = 0; i <= total; i++) {
    const seg = Math.min(ctrl.length - 2, Math.floor(i / n));
    const k = (i - seg * n) / n;
    const h = ctrl[seg][0] + (ctrl[seg + 1][0] - ctrl[seg][0]) * k;
    const phi = ctrl[seg][1] + (ctrl[seg + 1][1] - ctrl[seg][1]) * k;
    if (surfVis(S, rings, h, phi) > minVis) cur.push(surf(S, rings, h, phi, lift));
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs.filter(r => r.length > 1);
}

/** Stroke a surface curve as an inked strap. */
export function strap(
  ctx: CanvasRenderingContext2D,
  S: Section,
  rings: readonly Ring[],
  ctrl: readonly (readonly [number, number])[],
  t: Tone,
  width: number,
  lift = 0.25,
): void {
  for (const run of surfCurve(S, rings, ctrl, lift)) {
    strokeLine(ctx, run, t.line, width + 0.8);
    strokeLine(ctx, run, t.base, width);
  }
}

/**
 * Closed patch on a loft surface between heights h0 > h1 and angles
 * phi0 < phi1 (brows, masks, mouths). Empty when it faces away.
 */
export function surfPatch(
  S: Section,
  rings: readonly Ring[],
  h0: number,
  h1: number,
  phi0: number,
  phi1: number,
  lift = 0.15,
  n = 8,
  bottom?: (k: number) => number,
): V[] {
  const top: V[] = [];
  const bot: V[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const phi = phi0 + (phi1 - phi0) * k;
    top.push(surf(S, rings, h0, phi, lift));
    bot.push(surf(S, rings, bottom ? bottom(k) : h1, phi, lift));
  }
  return [...top, ...bot.reverse()];
}

/** Paint jobs sorted by depth (far first). */
export function sorted(items: { d: number; draw: () => void }[]): void {
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();
}

// ── Skin adapter ────────────────────────────────────────────────────────

export type ViewPainter = (ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number) => void;

export interface MonsterViewOpts {
  build: ViewBuild;
  /** 3D torso. Default: the side-view torso flattened onto the body plane. */
  torso?: ViewPainter;
  /** 3D head. Default: the side-view head flattened onto the body plane. */
  head?: ViewPainter;
  /** Tail / cape; default: the side-view `back` flattened, sorted by the back's depth. */
  back?: ViewPainter;
  /** Extra depth-sorted parts (wings, horns on the torso, etc.). */
  extra?(ctx: CanvasRenderingContext2D, sk: ViewSkeleton, p: HumanPose, t: number, d0: number): ViewPart[];
  /** Override limb painters (default: the side-view ones with projected joints). */
  legNear?: ViewPainter;
  legFar?: ViewPainter;
  armNear?: ViewPainter;
  armFar?: ViewPainter;
  /** Head sort bias over its depth (default 2.5). */
  headBias?: number;
  /** Draw the head behind the torso when it sits this far behind (back view of hunched bodies). */
  weaponBias?: number;
  /** Tweak the torso sort depth. */
  torsoZ?: number;
  /** Replace the side-view weapon painter. */
  weapon?: ViewPainter;
  /** Replace the side-view fx painter (drawn last, inked). */
  fx?: ViewPainter;
}

/** Side-view skeleton matching a pose (for painters that need side coordinates). */
export function sideSkeleton(p: HumanPose, skin: HumanSkin): Skeleton {
  return solveSkeleton(p, skin.prop);
}

/**
 * Build a 3/4-view skin from a side-view HumanSkin plus 3D torso/head
 * painters. Limbs reuse the side painters with projected joints; the weapon
 * and off-hand items are flattened onto the body plane at the hand.
 */
export function monsterViewSkin(skin: HumanSkin, o: MonsterViewOpts): HumanViewSkin {
  return {
    prop: skin.prop,
    build: o.build,
    parts(ctx, sk, p, t) {
      const d0 = sk.d.pelvis;
      const side = (): Skeleton => solveSkeleton(p, skin.prop);
      const armZ = (near: boolean): number => (near
        ? sk.d.elN * 0.6 + sk.d.handN * 0.4
        : sk.d.elF * 0.6 + sk.d.handF * 0.4) - d0;
      const legZ = (near: boolean): number => -0.6 + 0.02 * ((near ? sk.d.kneeN + sk.d.footN : sk.d.kneeF + sk.d.footF) / 2 - d0);
      const backZ = sk.torso.depth(sk.torsoLen * 0.3, Math.PI, 5, 0) - d0;
      const headZ = sk.d.head - d0 + (o.headBias ?? 2.5);
      const parts: ViewPart[] = [
        { z: legZ(true), draw: () => (o.legNear ? o.legNear(ctx, sk, p, t) : skin.legNear(ctx, sk, p, t)) },
        { z: legZ(false), draw: () => (o.legFar ? o.legFar(ctx, sk, p, t) : skin.legFar(ctx, sk, p, t)) },
        {
          z: o.torsoZ ?? 0,
          draw: () => (o.torso ? o.torso(ctx, sk, p, t) : sagittal(ctx, sk.rig, 0, () => skin.torso(ctx, side(), p, t))),
        },
        { z: armZ(false), draw: () => (o.armFar ? o.armFar(ctx, sk, p, t) : skin.armFar(ctx, sk, p, t)) },
        { z: armZ(true), draw: () => (o.armNear ? o.armNear(ctx, sk, p, t) : skin.armNear(ctx, sk, p, t)) },
        {
          z: headZ,
          draw: () => (o.head ? o.head(ctx, sk, p, t) : sagittal(ctx, sk.rig, 0, () => skin.head(ctx, side(), p, t))),
        },
        {
          z: Math.max(armZ(true), sk.d.handN - d0) + 0.02 + (o.weaponBias ?? 0),
          draw: () => {
            if (o.weapon) {
              o.weapon(ctx, sk, p, t);
              return;
            }
            const s = side();
            sagittal(ctx, sk.rig, 0, () => skin.weapon(ctx, s, p, t), { from: s.handN, to: sk.handN });
          },
        },
      ];
      if (o.back || skin.back) {
        parts.push({
          z: backZ,
          draw: () => (o.back ? o.back(ctx, sk, p, t) : sagittal(ctx, sk.rig, 0, () => skin.back!(ctx, side(), p, t))),
        });
      }
      if (skin.offFront) {
        parts.push({
          z: Math.max(armZ(false), sk.d.handF - d0) + 0.01,
          draw: () => {
            const s = side();
            sagittal(ctx, sk.rig, 0, () => skin.offFront!(ctx, s, p, t), { from: s.handF, to: sk.handF });
          },
        });
      }
      if (o.extra) parts.push(...o.extra(ctx, sk, p, t, d0));
      if (o.fx || skin.fx) {
        parts.push({
          z: 1e4,
          draw: () => (o.fx ? o.fx(ctx, sk, p, t) : sagittal(ctx, sk.rig, 0, () => skin.fx!(ctx, side(), p, t))),
        });
      }
      return parts;
    },
  };
}

/** Screen position of a side-view (pose space, z = 0) point in the view. */
export function sideToView(rig: ViewRig, pt: V, z = 0): V {
  return rig.pt(pt.x, pt.y, z);
}

export { GROUND_Y };

// ── Solids with attached parts ──────────────────────────────────────────

/** A 3D part hung off a lofted solid (ears, horns, tusks, noses, flaps). */
export interface Part3 {
  pts: readonly L3[];
  tone: Tone;
  /** Tone for the mirrored copy on the far side (default `tone`). */
  farTone?: Tone;
  /** Also draw the part mirrored to the other side (l → −l). */
  mirror?: boolean;
  /** Fill the convex hull of the points instead of the polygon. */
  hull?: boolean;
  smooth?: boolean;
  band?: number;
  stroke?: number;
  /** Depth bias (+ draws later). */
  bias?: number;
  /** Extra painting after the part (inner ear, details). */
  after?: (mirrored: boolean) => void;
}

/**
 * Draw a lofted solid (head or body) with its parts sorted by depth. `face`
 * paints surface details clipped to the solid; `over` paints on top (helms,
 * straps that stick out).
 */
export function solid3(
  ctx: CanvasRenderingContext2D,
  S: Section,
  rings: readonly Ring[],
  t: Tone,
  opts: {
    parts?: readonly Part3[];
    face?: (pieces: V[][]) => void;
    over?: (pieces: V[][]) => void;
    band?: number;
    hi?: number;
  } = {},
): V[][] {
  const items: { d: number; draw: () => void }[] = [];
  let pieces: V[][] = [];
  const c = S.rig.d(S.o);
  for (const part of opts.parts ?? []) {
    const variants: [readonly L3[], boolean][] = [[part.pts, false]];
    if (part.mirror) variants.push([mirrorL(part.pts), true]);
    for (const [pts, mirrored] of variants) {
      items.push({
        d: depthOf(S, pts) + (part.bias ?? 0),
        draw: () => {
          const tn = mirrored ? part.farTone ?? part.tone : part.tone;
          const o = { band: part.band ?? 0.7, stroke: part.stroke, smooth: part.smooth };
          if (part.hull) hull3(ctx, S, pts, tn, o);
          else poly3(ctx, S, pts, tn, o);
          part.after?.(mirrored);
        },
      });
    }
  }
  items.push({
    d: c,
    draw: () => {
      pieces = loftFill(ctx, S, rings, t, { band: opts.band ?? 1.4, hi: opts.hi });
      if (opts.face) clipTo(ctx, pieces, () => opts.face!(pieces));
      opts.over?.(pieces);
    },
  });
  sorted(items);
  return pieces;
}

/** Eye on a loft surface: socket, iris and optional slit/pupil. Returns false when hidden. */
export function eye3(
  ctx: CanvasRenderingContext2D,
  S: Section,
  rings: readonly Ring[],
  h: number,
  phi: number,
  opts: { rx: number; ry: number; socket?: string; iris: string; irisR?: number; pupil?: string; slit?: boolean; tilt?: number; minVis?: number },
): boolean {
  return decal(ctx, S, rings, h, phi, () => {
    const tilt = (opts.tilt ?? 0) * Math.sign(phi || 1);
    if (opts.socket) {
      ctx.fillStyle = opts.socket;
      ctx.beginPath();
      ctx.ellipse(0, 0, opts.rx, opts.ry, tilt, 0, Math.PI * 2);
      ctx.fill();
    }
    const k = opts.irisR ?? (opts.socket ? 0.62 : 1);
    ctx.fillStyle = opts.iris;
    ctx.beginPath();
    ctx.ellipse(0, 0, opts.rx * k, opts.ry * k, tilt, 0, Math.PI * 2);
    ctx.fill();
    if (opts.pupil) {
      ctx.fillStyle = opts.pupil;
      if (opts.slit) ctx.fillRect(-0.22, -opts.ry * k, 0.44, opts.ry * k * 2);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(opts.rx, opts.ry) * k * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, { minVis: opts.minVis ?? 0.02 });
}

/** Screen points of visible eyes (for glows drawn in the fx pass). */
export function eyeGlowPoints(S: Section, rings: readonly Ring[], h: number, phis: readonly number[], minVis = 0.25): V[] {
  return phis.filter(phi => surfVis(S, rings, h, phi) > minVis).map(phi => surf(S, rings, h, phi, 0.2));
}

/**
 * Spiky tufts (mane, spines, crystals) standing off a loft's back (phi = π)
 * between heights h0 > h1, as depth-sortable items.
 */
export function backSpikes(
  _S: Section,
  rings: readonly Ring[],
  h0: number,
  h1: number,
  rows: number,
  cols: readonly number[],
  length: (i: number) => number,
  widthL = 1.8,
): L3[][] {
  const out: L3[][] = [];
  for (let i = 0; i < rows; i++) {
    const h = h0 + ((h1 - h0) * i) / Math.max(1, rows - 1);
    const r = ringAt(rings, h);
    for (const s of cols) {
      const back = (r.f ?? 0) - r.a * 0.85;
      const lat = s * r.b * 0.5;
      const L = length(i);
      out.push([
        [h + 1.6, back, lat - widthL],
        [h + 1.6, back, lat + widthL],
        [h - 1.4, back, lat - widthL * 0.6],
        [h - 1.4, back, lat + widthL * 0.6],
        [h + 0.2, back + 1.2, lat],
        [h + 1.2 + L * 0.8, back - L * 0.65, lat * 1.2],
      ]);
    }
  }
  return out;
}

/** Tube through section-local points (horns, tails, tentacles), drawn as capsules. */
export function tube3(
  ctx: CanvasRenderingContext2D,
  S: Section,
  pts: readonly L3[],
  radii: readonly number[],
  t: Tone,
): void {
  const scr = pts.map(q => sp(S, q[0], q[1], q[2]));
  for (let i = 0; i + 1 < scr.length; i++) {
    cel(ctx, () => {
      const a = scr[i];
      const b = scr[i + 1];
      const ra = radii[Math.min(i, radii.length - 1)];
      const rb = radii[Math.min(i + 1, radii.length - 1)];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.arc(a.x, a.y, ra, ang + Math.PI / 2, ang - Math.PI / 2, false);
      ctx.arc(b.x, b.y, rb, ang - Math.PI / 2, ang + Math.PI / 2, false);
      ctx.closePath();
    }, t, { band: Math.min(radii[0], 1.2) * 0.4, stroke: 0.45 });
  }
}

/**
 * Draw side-view wing art (pose space: wing root at `root2`, extending back
 * along −x) in its own plane: the wing's back axis is turned out toward
 * side `s` (+1 near, −1 far) by `spread` radians, pivoting at the 3D point
 * `anchor` on the body.
 */
export function wingPlane(
  ctx: CanvasRenderingContext2D,
  rig: ViewRig,
  anchor: V3,
  root2: V,
  s: 1 | -1,
  spread: number,
  fn: () => void,
): void {
  const c = Math.cos(spread);
  const sn = Math.sin(spread);
  withAffine(ctx, q => {
    const dx = q.x - root2.x;
    return rig.pt(anchor.x + dx * c, anchor.y + (q.y - root2.y), anchor.z - dx * s * sn);
  }, fn);
}

/** Depth of a wing drawn with `wingPlane`, sampled `reach` units back along it. */
export function wingDepth(rig: ViewRig, anchor: V3, s: 1 | -1, spread: number, reach: number): number {
  return rig.depth(anchor.x - reach * Math.cos(spread), anchor.y, anchor.z + reach * s * Math.sin(spread));
}

/**
 * Head frame for monsters whose side art counter-rotates the face (a neck
 * jutting forward with the face kept level): the skull axes tilted back by
 * `tilt`, then turned toward the camera in the front view.
 */
export function tiltedHead(sk: ViewSkeleton, p: HumanPose, tilt: number, psi = 0.4, backTilt = 0): Section {
  const a = p.lean + p.head - tilt + (sk.rig.front ? 0 : backTilt);
  const S = new Section(sk.rig, sk.j.head, { x: Math.sin(a), y: -Math.cos(a), z: 0 }, { x: Math.cos(a), y: Math.sin(a), z: 0 });
  return sk.rig.front && psi !== 0 ? new TurnedSection(S, psi) : S;
}
