/**
 * Monster drawer factory on the shared rig.
 *
 * Monster sheets have 20 frames: idle 4 (loop), walk 6 (loop), attack 4,
 * hurt 2, death 4. The blow connects on the LAST attack frame
 * (AnimConfig.attackContact = 1), so attack tracks end on the contact pose;
 * recovery is handled by the CharacterAnimator tween.
 *
 * Humanoid monsters only need a skin, a READY pose and an attack style —
 * walk/attack/hurt/death tracks are generated from those, and any track can
 * be overridden when a monster needs bespoke motion.
 */
import type { EntityDrawer, MonsterAction } from '../types';
import { drawHumanoidView, solveViewSkeleton, type HumanView, type ViewSkeleton } from './HumanView';
import { MONSTER_VIEWS, monsterViewSkin, sagittalSpun, viewGroundX, type MonsterViewOpts } from './MonsterView';
import {
  CENTER_X,
  GROUND_Y,
  frameTime,
  groundShadow,
  renderRigFrame,
  samplePoseTrack,
  vec,
  type Key,
  type V,
} from './Rig';
import {
  drawHumanoid,
  gait,
  solveSkeleton,
  type HumanPose,
  type HumanSkin,
  type Skeleton,
} from './Humanoid';
import { getCurrentZonePalette, standardOutlineBlur } from '../../ZonePalette';

export const MONSTER_FRAME_COUNTS: Readonly<Record<MonsterAction, number>> = {
  idle: 4,
  walk: 6,
  attack: 4,
  hurt: 2,
  death: 4,
};

export function monsterTime(action: MonsterAction, frame: number): number {
  const count = MONSTER_FRAME_COUNTS[action];
  return frameTime(frame % count, count, action === 'idle' || action === 'walk');
}

/** Pose → any drawing; lets non-humanoid monsters share the compositor. */
export interface RigMonsterSpec<P> {
  key: string;
  frameW: number;
  frameH: number;
  /** Figure size within the 96-unit frame height. */
  scale: number;
  pose(action: MonsterAction, t: number, view?: HumanView): P;
  /**
   * Isometric 3/4 views the drawer paints (se front, ne back). The sheet
   * then holds all 20 frames once per view, and draw/shadow/fx get the view.
   * Omitted: a single view (radially symmetric / amorphous creatures).
   */
  views?: readonly HumanView[];
  draw(ctx: CanvasRenderingContext2D, p: P, action: MonsterAction, t: number, view?: HumanView): void;
  /** Ground shadow centre x and radius for a pose. */
  shadow(p: P, action: MonsterAction, t: number, view?: HumanView): { x: number; r: number; lift: number };
  /** Glows, smears, particles — drawn over the inked body. */
  fx?(ctx: CanvasRenderingContext2D, p: P, action: MonsterAction, t: number, view?: HumanView): void;
  /** Ink colour override (e.g. ghostly monsters). */
  ink?: string;
  rim?: string;
}

export function rigMonster<P>(spec: RigMonsterSpec<P>): EntityDrawer {
  return {
    key: spec.key,
    frameW: spec.frameW,
    frameH: spec.frameH,
    totalFrames: 20 * (spec.views?.length ?? 1),
    inked: true,
    views: spec.views,
    drawFrame(ctx, frame, action, w, h, _utils, view) {
      const act = action as MonsterAction;
      const t = monsterTime(act, frame);
      const v = spec.views ? (view ?? spec.views[0]) : undefined;
      const p = spec.pose(act, t, v);
      const palette = getCurrentZonePalette();
      const sh = spec.shadow(p, act, t, v);
      renderRigFrame(
        ctx, w, h,
        c => spec.draw(c, p, act, t, v),
        {
          glowColor: palette.entityOutlineColor,
          glowBlur: standardOutlineBlur(w, h),
          scale: spec.scale,
          ink: spec.ink,
          rim: spec.rim,
        },
        c => groundShadow(c, sh.x, sh.r, sh.lift),
        spec.fx ? c => spec.fx!(c, p, act, t, v) : undefined,
      );
    },
  };
}

// ── Humanoid monsters ───────────────────────────────────────────────────

export type AttackStyle = 'overhead' | 'thrust' | 'claw' | 'slam' | 'cast';

export interface HumanoidMonsterSpec {
  key: string;
  frameW: number;
  frameH: number;
  scale: number;
  skin: HumanSkin;
  ready: HumanPose;
  attack: AttackStyle;
  walk?: { stride?: number; lift?: number; bob?: number; lean?: number; armSwing?: number; spread?: number };
  /** −1 falls backward (default), +1 pitches forward. */
  deathDir?: 1 | -1;
  /** Weapon angle at the contact pose (default depends on style). */
  contactWpn?: number;
  tracks?: Partial<Record<MonsterAction, Key<HumanPose>[]>>;
  idle?: (t: number, ready: HumanPose) => HumanPose;
  fx?(ctx: CanvasRenderingContext2D, p: HumanPose, sk: Skeleton, action: MonsterAction, t: number): void;
  shadowR?: number;
  ink?: string;
  /**
   * Isometric 3/4 views (se + ne): torso/head painters that turn with the
   * body; limbs and weapon reuse the side-view skin. Omitted: side view only.
   */
  view?: MonsterViewOpts;
  /** Effects for the 3/4 views (default: `fx` flattened onto the body plane). */
  viewFx?(ctx: CanvasRenderingContext2D, p: HumanPose, sk: ViewSkeleton, action: MonsterAction, t: number): void;
}

function offset(p: V, dx: number, dy: number): V {
  return vec(p.x + dx, p.y + dy);
}

/** Generate the standard monster tracks from a READY pose. */
export function humanoidTracks(spec: HumanoidMonsterSpec): Record<Exclude<MonsterAction, 'idle' | 'walk'>, Key<HumanPose>[]> {
  const R = spec.ready;
  const prop = spec.skin.prop;
  const sk = solveSkeleton(R, prop);
  const reach = prop.upperArm + prop.foreArm;
  const sh = sk.shN;
  const P = (over: Partial<HumanPose>): HumanPose => ({ ...R, ...over });
  const fwdFoot = offset(R.footN, 3.5, 0);

  let wind: HumanPose;
  let mid: HumanPose;
  let hit: HumanPose;
  switch (spec.attack) {
    case 'thrust':
      wind = P({ root: offset(R.root, -2.5, 0.8), lean: R.lean - 0.12, handN: offset(sh, -0.4 * reach, 0.3 * reach), wpn: 1.35, handF: offset(sh, 0.2 * reach, 0.25 * reach), stretch: 0.02 });
      mid = P({ root: offset(R.root, 1, 1), lean: R.lean + 0.15, handN: offset(sh, 0.3 * reach, 0.2 * reach), wpn: 1.45, footN: fwdFoot, fx: 0.7 });
      hit = P({ root: offset(R.root, 3.5, 1.6), lean: R.lean + 0.32, handN: offset(sh, 0.98 * reach, 0.12 * reach), wpn: spec.contactWpn ?? 1.55, handF: offset(sh, -0.2 * reach, 0.35 * reach), footN: offset(R.footN, 5, 0), fx: 1, stretch: -0.03 });
      break;
    case 'claw':
      wind = P({ root: offset(R.root, -2, 0.5), lean: R.lean - 0.2, head: R.head - 0.1, handN: offset(sh, -0.2 * reach, -0.7 * reach), handF: offset(sh, 0.2 * reach, -0.6 * reach), wpn: -0.5, stretch: 0.04 });
      mid = P({ root: offset(R.root, 1.5, 0.5), lean: R.lean + 0.15, handN: offset(sh, 0.55 * reach, -0.45 * reach), handF: offset(sh, 0.5 * reach, -0.2 * reach), wpn: 0.8, footN: fwdFoot, fx: 0.7 });
      hit = P({ root: offset(R.root, 4, 1.8), lean: R.lean + 0.42, head: R.head + 0.1, handN: offset(sh, 0.85 * reach, 0.5 * reach), handF: offset(sh, 0.55 * reach, 0.62 * reach), wpn: spec.contactWpn ?? 2.3, footN: offset(R.footN, 5, 0), fx: 1, stretch: -0.04 });
      break;
    case 'slam':
      wind = P({ root: offset(R.root, -1.5, -0.5), lean: R.lean - 0.28, head: R.head - 0.15, handN: offset(sh, -0.05 * reach, -0.95 * reach), handF: offset(sh, -0.25 * reach, -0.85 * reach), wpn: -0.3, stretch: 0.05 });
      mid = P({ root: offset(R.root, 1, 0), lean: R.lean, handN: offset(sh, 0.45 * reach, -0.75 * reach), handF: offset(sh, 0.25 * reach, -0.7 * reach), wpn: 0.6, fx: 0.7 });
      hit = P({ root: offset(R.root, 3, 3.5), lean: R.lean + 0.5, head: R.head + 0.15, handN: offset(sh, 0.8 * reach, 0.7 * reach), handF: offset(sh, 0.6 * reach, 0.75 * reach), wpn: spec.contactWpn ?? 2.6, footN: offset(R.footN, 4, 0), fx: 1, stretch: -0.07 });
      break;
    case 'cast':
      wind = P({ root: offset(R.root, -1.5, 0.5), lean: R.lean - 0.15, head: R.head - 0.15, handN: offset(sh, 0.1 * reach, -0.75 * reach), handF: offset(sh, -0.1 * reach, -0.5 * reach), wpn: 0.1, fx: 0.8, stretch: 0.04 });
      mid = P({ root: offset(R.root, 0.5, 0.5), lean: R.lean + 0.05, handN: offset(sh, 0.45 * reach, -0.55 * reach), handF: offset(sh, 0.3 * reach, -0.3 * reach), wpn: 0.6, fx: 0.9 });
      hit = P({ root: offset(R.root, 2.5, 1), lean: R.lean + 0.28, handN: offset(sh, 0.95 * reach, -0.1 * reach), handF: offset(sh, 0.8 * reach, 0.05 * reach), wpn: spec.contactWpn ?? 1.35, footN: fwdFoot, fx: 1 });
      break;
    case 'overhead':
    default:
      wind = P({ root: offset(R.root, -2, 0.8), lean: R.lean - 0.24, head: R.head + 0.04, handN: offset(sh, -0.25 * reach, -0.8 * reach), wpn: -0.85, handF: offset(sh, 0.3 * reach, 0.15 * reach), stretch: 0.035 });
      mid = P({ root: offset(R.root, 1.2, 1), lean: R.lean + 0.1, handN: offset(sh, 0.45 * reach, -0.7 * reach), wpn: 0.75, handF: offset(sh, 0.15 * reach, 0.25 * reach), footN: fwdFoot, fx: 0.7 });
      hit = P({ root: offset(R.root, 3.8, 1.8), lean: R.lean + 0.38, head: R.head + 0.08, handN: offset(sh, 0.85 * reach, 0.4 * reach), wpn: spec.contactWpn ?? 2.2, handF: offset(sh, -0.1 * reach, 0.35 * reach), footN: offset(R.footN, 5, 0), fx: 1, stretch: -0.035 });
      break;
  }

  const recoil = P({
    root: offset(R.root, -3.5, 1), lean: R.lean - 0.34, head: R.head - 0.35,
    handN: offset(R.handN, -2.5, -3), handF: offset(R.handF, -2, -4), wpn: R.wpn - 0.4,
    footF: offset(R.footF, -1.5, 0), flow: 0.45, stretch: -0.04,
  });
  const dir = spec.deathDir ?? -1;
  const legLen = prop.thigh + prop.shin;
  const lying = P({
    root: vec(R.root.x + dir * -2, GROUND_Y - 4.8), spin: dir * 1.52, lean: 0, head: dir * 0.2,
    footN: vec(R.root.x + 1.5, GROUND_Y - 4.8 + legLen), footF: vec(R.root.x - 1, GROUND_Y - 5 + legLen),
    handN: offset(R.root, 4, -8), handF: offset(R.root, -2, -10), wpn: R.wpn + dir * 1.4, flow: 0.05,
  });

  return {
    attack: [
      { at: 0, pose: R },
      { at: 0.33, ease: 'out', pose: wind },
      { at: 0.67, ease: 'in', pose: mid },
      { at: 1, ease: 'linear', pose: hit },
    ],
    hurt: [
      { at: 0, pose: recoil },
      { at: 1, pose: P({ ...recoil, root: offset(R.root, -1.8, 0.5), lean: R.lean - 0.14, head: R.head - 0.12, handN: offset(R.handN, -1, -1), handF: offset(R.handF, -1, -1.5), wpn: R.wpn - 0.15 }) },
    ],
    death: [
      { at: 0, pose: recoil },
      { at: 0.33, pose: P({ ...recoil, root: offset(R.root, -2.5, 7), lean: R.lean + 0.2 * dir, head: 0.4 * dir, footN: offset(R.footN, -1, 0), footF: offset(R.footF, 0, 0), handN: offset(R.root, 5, 4), handF: offset(R.root, 1, 2) }) },
      { at: 0.67, ease: 'in', pose: P({ ...lying, root: vec(R.root.x + dir * -1.5, GROUND_Y - 10), spin: dir * 0.95, head: dir * -0.1 }) },
      { at: 1, ease: 'out', pose: lying },
    ],
  };
}

export function humanoidMonster(spec: HumanoidMonsterSpec): EntityDrawer {
  const R = spec.ready;
  const generated = humanoidTracks(spec);
  const tracks = { ...generated, ...spec.tracks };
  const w = spec.walk ?? {};
  const shR = spec.shadowR ?? 12;

  const idle = spec.idle ?? ((t: number, ready: HumanPose): HumanPose => {
    const ph = t * Math.PI * 2;
    const b = Math.sin(ph);
    return {
      ...ready,
      root: vec(ready.root.x, ready.root.y + b * 0.6),
      stretch: b * -0.015,
      head: ready.head + Math.sin(ph - 0.6) * 0.04,
      handN: vec(ready.handN.x, ready.handN.y + b * 0.5),
      handF: vec(ready.handF.x, ready.handF.y + Math.sin(ph - 0.5) * 0.6),
      wpn: ready.wpn + Math.sin(ph - 0.3) * 0.04,
      flow: ready.flow + Math.sin(ph) * 0.05,
    };
  });

  const walk = (t: number): HumanPose => {
    const g = gait(t, {
      stride: w.stride ?? 6,
      lift: w.lift ?? 3.5,
      bob: w.bob ?? 1.2,
      rootY: R.root.y + 0.3,
      footSpread: w.spread ?? 1,
    });
    const ph = t * Math.PI * 2;
    const swing = w.armSwing ?? 3;
    return {
      ...R,
      root: vec(R.root.x, g.rootY),
      lean: R.lean + (w.lean ?? 0.05),
      footN: vec(g.footN.x + (R.footN.x + R.footF.x) / 2 - CENTER_X, g.footN.y),
      footF: vec(g.footF.x + (R.footN.x + R.footF.x) / 2 - CENTER_X, g.footF.y),
      handN: vec(R.handN.x - g.swing * swing, R.handN.y + Math.abs(g.swing) * 0.5),
      handF: vec(R.handF.x + g.swing * swing * 0.8, R.handF.y),
      wpn: R.wpn - g.swing * 0.1,
      flow: R.flow + 0.25 + Math.sin(ph * 2) * 0.06,
    };
  };

  const pose = (act: MonsterAction, t: number): HumanPose => {
    switch (act) {
      case 'idle': return idle(t, R);
      case 'walk': return walk(t);
      default: return samplePoseTrack(tracks[act], t);
    }
  };

  const vskin = spec.view ? monsterViewSkin(spec.skin, spec.view) : undefined;
  return rigMonster<HumanPose>({
    key: spec.key,
    frameW: spec.frameW,
    frameH: spec.frameH,
    scale: spec.scale,
    ink: spec.ink,
    views: vskin ? MONSTER_VIEWS : undefined,
    pose,
    draw: (ctx, p, _act, t, view) => {
      if (vskin && view) drawHumanoidView(ctx, p, vskin, t, view);
      else drawHumanoid(ctx, p, spec.skin, t);
    },
    shadow: (p, _act, _t, view) => {
      const x = p.spin !== 0 && Math.abs(p.spin) > 1 ? p.root.x + (p.spin > 0 ? 8 : -8) : p.root.x + 1;
      return {
        x: view ? viewGroundX(view, x) : x,
        r: Math.abs(p.spin) > 1 ? shR * 1.5 : shR,
        lift: Math.max(0, GROUND_Y - Math.max(p.footN.y, p.footF.y)),
      };
    },
    fx: spec.fx || spec.viewFx
      ? (ctx, p, act, t, view) => {
        if (!vskin || !view) {
          spec.fx?.(ctx, p, solveSkeleton(p, spec.skin.prop), act, t);
          return;
        }
        const vsk = solveViewSkeleton(p, vskin.prop, vskin.build, view);
        if (spec.viewFx) spec.viewFx(ctx, p, vsk, act, t);
        else sagittalSpun(ctx, vsk, p, () => spec.fx!(ctx, p, solveSkeleton(p, spec.skin.prop), act, t));
      }
      : undefined,
  });
}
