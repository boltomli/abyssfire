import {
  CENTER_X,
  GROUND_Y,
  along,
  dirUp,
  solveIK,
  vec,
  type V,
} from './Rig';

/**
 * A keyframeable humanoid pose, in 96-unit sprite space, facing right.
 * Feet and hands are IK targets; everything else is angles/scalars.
 */
export interface HumanPose {
  /** Pelvis position. */
  root: V;
  /** Torso lean from vertical (radians, + = forward). */
  lean: number;
  /** Extra head tilt on top of the torso (radians, + = nod forward). */
  head: number;
  footN: V;
  footF: V;
  handN: V;
  handF: V;
  /** Main-hand item angle (0 = pointing up, + = forward). */
  wpn: number;
  /** Off-hand item angle. */
  off: number;
  /** Whole-body rotation (rolls, falls) about the spin pivot. */
  spin: number;
  /** Spin pivot along the spine: 0 = pelvis, 1 = neck. */
  pivot: number;
  /** How far cloth streams back (0 hanging … 1 streaming). */
  flow: number;
  /** Effect intensity: charge glow, smear strength etc. */
  fx: number;
  /** Squash (−) / stretch (+) of the upper body along the spine. */
  stretch: number;
  /**
   * 3/4 views only (HumanView.ts): lateral offsets of the near / far hand
   * from its shoulder (+ = toward the near side), e.g. a shield brought
   * across the chest. Ignored by the side view.
   */
  zN?: number;
  zF?: number;
}

export interface Proportions {
  thigh: number;
  shin: number;
  upperArm: number;
  foreArm: number;
  /** Pelvis → neck. */
  torso: number;
  /** Neck → head centre. */
  neck: number;
  /** Sole → ankle height; foot targets in poses are soles on the ground. */
  ankle: number;
  /** Near/far hip offsets from the pelvis (in torso-local x/y). */
  hipN: V;
  hipF: V;
  /** Near/far shoulder offsets from the neck (in torso-local x/y). */
  shN: V;
  shF: V;
}

export interface Skeleton {
  pelvis: V;
  neck: V;
  head: V;
  /** Torso "up" angle and head angle (dirUp convention). */
  torsoAng: number;
  headAng: number;
  /** footN/footF are ankles; soleN/soleF the ground contact points. */
  hipN: V; kneeN: V; footN: V; soleN: V;
  hipF: V; kneeF: V; footF: V; soleF: V;
  shN: V; elN: V; handN: V;
  shF: V; elF: V; handF: V;
}

/** Offset in torso-local space (x forward, y down) rotated by the lean. */
function local(origin: V, lean: number, off: V): V {
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  return { x: origin.x + off.x * c - off.y * s, y: origin.y + off.x * s + off.y * c };
}

export function solveSkeleton(p: HumanPose, prop: Proportions): Skeleton {
  const pelvis = p.root;
  const torsoLen = prop.torso * (1 + p.stretch);
  const neck = along(pelvis, p.lean, torsoLen);
  const headAng = p.lean + p.head;
  const head = along(neck, headAng, prop.neck);

  const hipN = local(pelvis, p.lean * 0.3, prop.hipN);
  const hipF = local(pelvis, p.lean * 0.3, prop.hipF);
  const legN = solveIK(hipN, vec(p.footN.x, p.footN.y - prop.ankle), prop.thigh, prop.shin, 1);
  const legF = solveIK(hipF, vec(p.footF.x, p.footF.y - prop.ankle), prop.thigh, prop.shin, 1);

  const shN = local(neck, p.lean, prop.shN);
  const shF = local(neck, p.lean, prop.shF);
  const armN = solveIK(shN, p.handN, prop.upperArm, prop.foreArm, -1);
  const armF = solveIK(shF, p.handF, prop.upperArm, prop.foreArm, -1);

  return {
    pelvis, neck, head,
    torsoAng: p.lean, headAng,
    hipN, kneeN: legN.mid, footN: legN.end, soleN: vec(legN.end.x, legN.end.y + prop.ankle),
    hipF, kneeF: legF.mid, footF: legF.end, soleF: vec(legF.end.x, legF.end.y + prop.ankle),
    shN, elN: armN.mid, handN: armN.end,
    shF, elF: armF.mid, handF: armF.end,
  };
}

/** Class-specific art hooks, called in back-to-front order. */
export interface HumanSkin {
  prop: Proportions;
  /** Cloth/capes behind everything. */
  back?(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void;
  armFar(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void;
  legFar(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void;
  legNear(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void;
  torso(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void;
  head(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void;
  /** Off-hand item held in front of the body (shield, orb). */
  offFront?(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void;
  armNear(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void;
  /** Main-hand weapon, drawn over the near arm unless `weaponBehindHand`. */
  weapon(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void;
  /** Glows, sparks, smears — drawn last, not ink-outlined. */
  fx?(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number): void;
}

export function drawHumanoid(ctx: CanvasRenderingContext2D, p: HumanPose, skin: HumanSkin, t: number): Skeleton {
  const sk = solveSkeleton(p, skin.prop);
  ctx.save();
  if (p.spin !== 0) {
    const c = spinPivot(sk, p);
    ctx.translate(c.x, c.y);
    ctx.rotate(p.spin);
    ctx.translate(-c.x, -c.y);
  }
  skin.back?.(ctx, sk, p, t);
  skin.armFar(ctx, sk, p, t);
  skin.legFar(ctx, sk, p, t);
  skin.legNear(ctx, sk, p, t);
  skin.torso(ctx, sk, p, t);
  skin.offFront?.(ctx, sk, p, t);
  skin.armNear(ctx, sk, p, t);
  // A weapon cocked behind the shoulder passes behind the head; otherwise
  // the head sits between the near arm and the weapon.
  if (sk.handN.x < sk.neck.x - 1) {
    skin.weapon(ctx, sk, p, t);
    skin.head(ctx, sk, p, t);
  } else {
    skin.head(ctx, sk, p, t);
    skin.weapon(ctx, sk, p, t);
  }
  ctx.restore();
  return sk;
}

function spinPivot(sk: Skeleton, p: HumanPose): V {
  return {
    x: sk.pelvis.x + (sk.neck.x - sk.pelvis.x) * p.pivot,
    y: sk.pelvis.y + (sk.neck.y - sk.pelvis.y) * p.pivot,
  };
}

/** Apply a pose's body spin to a point (for effects drawn outside the rig). */
export function spun(p: HumanPose, pt: V, sk: Skeleton): V {
  if (p.spin === 0) return pt;
  const o = spinPivot(sk, p);
  const c = Math.cos(p.spin);
  const s = Math.sin(p.spin);
  const dx = pt.x - o.x;
  const dy = pt.y - o.y;
  return { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c };
}

// ── Pose authoring helpers ──────────────────────────────────────────────

export function basePose(over: Partial<HumanPose> = {}): HumanPose {
  return {
    root: vec(CENTER_X, 65),
    lean: 0,
    head: 0,
    footN: vec(CENTER_X + 5, GROUND_Y),
    footF: vec(CENTER_X - 4, GROUND_Y),
    handN: vec(CENTER_X + 6, 66),
    handF: vec(CENTER_X - 5, 66),
    wpn: 0,
    off: 0,
    spin: 0,
    pivot: 0,
    flow: 0.1,
    fx: 0,
    stretch: 0,
    zN: 0,
    zF: 0,
    ...over,
  };
}

/**
 * Side-view walk/run gait. `t` ∈ [0,1) loops. Feet slide back while planted
 * and arc forward while lifted; the pelvis rides highest as the legs pass.
 */
export function gait(t: number, opts: {
  stride: number;
  lift: number;
  bob: number;
  rootY: number;
  footSpread?: number;
}): { footN: V; footF: V; rootY: number; swing: number } {
  const ph = t * Math.PI * 2;
  const foot = (p: number, xOff: number): V => ({
    x: CENTER_X + xOff + opts.stride * Math.cos(p),
    y: GROUND_Y - opts.lift * Math.max(0, -Math.sin(p)),
  });
  const spread = opts.footSpread ?? 1;
  return {
    footN: foot(ph, spread),
    footF: foot(ph + Math.PI, -spread),
    rootY: opts.rootY - opts.bob * Math.abs(Math.sin(ph)),
    // +1 when the near leg is forward — arms counter-swing against this.
    swing: Math.cos(ph),
  };
}

export { dirUp };
