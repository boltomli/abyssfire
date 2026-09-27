/**
 * NPC drawer factory: a FolkLook (Townsfolk.ts) plus a work-loop preset
 * becomes a full 24-frame NPC sheet (working 8, alert 4, idle 6, talking 6)
 * in the shared rigged style, drawn in the isometric front 3/4 view (`se`,
 * mirrored for sw when an NPC turns to face the player).
 */
import type { EntityDrawer, NPCAction } from '../types';
import {
  CENTER_X,
  GROUND_Y,
  cel,
  frameTime,
  glow,
  groundShadow,
  polyPath,
  renderRigFrame,
  samplePoseTrack,
  tone,
  vec,
  type Key,
  type V,
} from './Rig';
import { basePose, type HumanPose } from './Humanoid';
import {
  drawHumanoidView,
  hull,
  type HumanViewSkin,
  type ViewPart,
  type ViewRig,
  type ViewSkeleton,
} from './HumanView';
import { STAFF_ORB, UPRIGHT_PROPS, folkBuild, folkSkin, propTip, type FolkLook, type Prop } from './Townsfolk';
import { getCurrentZonePalette, standardOutlineBlur } from '../../ZonePalette';

export { STAFF_ORB, propTip };

/** The single view NPC sheets are drawn in. */
export const NPC_VIEW = 'se' as const;

/**
 * In the 3/4 view the feet (and scenery in front of the figure) drop below
 * the side-view ground line by half their depth toward the camera; the frame
 * only has ~5 units below GROUND_Y, so the figure is drawn this much higher.
 */
const NPC_LIFT = 3.5;

export const NPC_FRAME_COUNTS: Readonly<Record<NPCAction, number>> = {
  working: 8,
  alert: 4,
  idle: 6,
  talking: 6,
};

export type WorkStyle =
  | 'hammer' | 'ledger' | 'count' | 'read' | 'lookout' | 'guard' | 'smoke' | 'ready' | 'slump' | 'polish';

export interface NpcSpec {
  key: string;
  look: FolkLook;
  work: WorkStyle;
  /** Figure size within the 96-unit frame height (80×120 frames ≈ 1.0). */
  scale?: number;
  frameW?: number;
  frameH?: number;
  /**
   * Which hand gestures while talking. Defaults to the far (off) hand unless
   * it holds an upright prop such as a staff.
   */
  gesture?: 'near' | 'far';
  /** Adjust the resting pose (hands, stance, props). */
  ready?: Partial<HumanPose>;
  /**
   * Scenery set beside the NPC (anvil, counter…), painted in the same
   * projected space as the figure and inked with it. `sceneryZ` is its draw
   * depth among the body parts (0 = torso; default 0.5, in front of the
   * body but behind the arms and props).
   */
  scenery?: (ctx: CanvasRenderingContext2D, sk: ViewSkeleton, action: NPCAction, t: number) => void;
  sceneryZ?: number;
  /** Extra glows/particles over the inked figure (screen-space skeleton). */
  fx?: (ctx: CanvasRenderingContext2D, p: HumanPose, sk: ViewSkeleton, action: NPCAction, t: number) => void;
}

function readyFor(spec: NpcSpec): HumanPose {
  const prop = folkBuild(spec.look).prop;
  const item: Prop = spec.look.item ?? 'none';
  const off: Prop = spec.look.offItem ?? 'none';
  const rootY = GROUND_Y - prop.ankle - (prop.thigh + prop.shin) * 0.975;
  return basePose({
    root: vec(CENTER_X - 1, rootY),
    lean: 0.04,
    head: 0,
    footN: vec(CENTER_X + 4, GROUND_Y),
    footF: vec(CENTER_X - 4.5, GROUND_Y),
    handN: vec(CENTER_X + 5, rootY + 1),
    handF: vec(CENTER_X - 3, rootY + 1.5),
    wpn: 0.3,
    off: 0.2,
    flow: 0.08,
    // 3/4 view: arms hang a little away from the body; long upright props
    // are held out to the side so they don't cross the face.
    zN: UPRIGHT_PROPS.has(item) ? 7 : 1.4,
    zF: UPRIGHT_PROPS.has(off) ? -3 : off === 'shield' ? 1.2 : -1,
    ...(UPRIGHT_PROPS.has(item) ? { handN: vec(CENTER_X + 4, rootY - 5) } : {}),
    // An upright prop in the off hand is planted beside the far foot, in front.
    ...(UPRIGHT_PROPS.has(off) ? { handF: vec(CENTER_X + 6, rootY - 4), off: 0.05 } : {}),
    ...spec.ready,
  });
}

function loopKeys(keys: Key<HumanPose>[]): Key<HumanPose>[] {
  return [...keys, { at: 1, pose: keys[0].pose }];
}

function workTrack(style: WorkStyle, R: HumanPose): Key<HumanPose>[] {
  const P = (o: Partial<HumanPose>): HumanPose => ({ ...R, ...o });
  const y = R.root.y;
  switch (style) {
    case 'hammer':
      // The anvil stands at the smith's front-left (screen right), so the
      // hammer arm swings across the body onto it; the tongs hold the work.
      return loopKeys([
        { at: 0, pose: P({ handN: vec(CENTER_X - 4, y - 18), zN: 1, wpn: -1.1, lean: -0.08, head: 0.18, handF: vec(CENTER_X + 5, y + 2), zF: -0.5, off: 2.1 }) },
        { at: 0.32, ease: 'in', pose: P({ handN: vec(CENTER_X + 8.5, y - 3), zN: -10, wpn: 2.65, lean: 0.24, head: 0.32, root: vec(R.root.x + 1, y + 1.2), handF: vec(CENTER_X + 5, y + 3), zF: -0.5, off: 2.1, fx: 1 }) },
        { at: 0.45, pose: P({ handN: vec(CENTER_X + 8.5, y - 4.5), zN: -10, wpn: 2.4, lean: 0.2, head: 0.3, root: vec(R.root.x + 1, y + 0.8), handF: vec(CENTER_X + 5, y + 2.6), zF: -0.5, off: 2.1, fx: 0.4 }) },
        { at: 0.8, ease: 'out', pose: P({ handN: vec(CENTER_X - 3.5, y - 17), zN: 0.5, wpn: -1, lean: -0.06, head: 0.2, handF: vec(CENTER_X + 5, y + 2), zF: -0.5, off: 2.1 }) },
      ]);
    case 'ledger':
      return loopKeys([
        { at: 0, pose: P({ zN: -5, zF: -0.5, head: 0.3, handF: vec(CENTER_X + 8, y - 4), off: 1.5, handN: vec(CENTER_X + 9, y - 3), wpn: 0.6 }) },
        { at: 0.25, pose: P({ zN: -5, zF: -0.5, head: 0.32, handF: vec(CENTER_X + 8, y - 4), off: 1.5, handN: vec(CENTER_X + 10.5, y - 2.4), wpn: 0.7 }) },
        { at: 0.5, pose: P({ zN: -5, zF: -0.5, head: 0.28, handF: vec(CENTER_X + 8, y - 4.4), off: 1.5, handN: vec(CENTER_X + 9, y - 1.6), wpn: 0.6 }) },
        { at: 0.75, pose: P({ zN: -5, zF: -0.5, head: 0.3, handF: vec(CENTER_X + 8, y - 4), off: 1.5, handN: vec(CENTER_X + 11, y - 2.8), wpn: 0.75 }) },
      ]);
    case 'count':
      return loopKeys([
        { at: 0, pose: P({ head: 0.25, handF: vec(CENTER_X + 7, y - 2), off: 0, handN: vec(CENTER_X + 9, y - 6), wpn: 0.3 }) },
        { at: 0.3, ease: 'out', pose: P({ head: 0.18, handF: vec(CENTER_X + 7, y - 2), off: 0, handN: vec(CENTER_X + 10, y - 12), wpn: 0.3, fx: 1 }) },
        { at: 0.6, ease: 'in', pose: P({ head: 0.28, handF: vec(CENTER_X + 7, y - 2.4), off: 0, handN: vec(CENTER_X + 9, y - 5), wpn: 0.3 }) },
      ]);
    case 'read':
      return loopKeys([
        { at: 0, pose: P({ zF: 0.5, head: 0.3, handN: vec(CENTER_X + 9, y - 6), wpn: 0.1, handF: vec(CENTER_X + 7, y - 5), off: 0.2 }) },
        { at: 0.5, pose: P({ zF: 0.5, head: 0.36, lean: 0.07, handN: vec(CENTER_X + 9.5, y - 5.4), wpn: 0.14, handF: vec(CENTER_X + 7, y - 4.6), off: 0.2 }) },
      ]);
    case 'lookout':
      return loopKeys([
        { at: 0, pose: P({ head: -0.14, handN: vec(CENTER_X + 8, y - 19), wpn: 0.3, lean: 0.06 }) },
        { at: 0.5, pose: P({ head: -0.08, handN: vec(CENTER_X + 8.5, y - 18.5), wpn: 0.3, lean: 0.1, root: vec(R.root.x + 0.8, y + 0.3) }) },
      ]);
    case 'guard':
      return loopKeys([
        { at: 0, pose: P({ head: -0.02, lean: 0 }) },
        { at: 0.5, pose: P({ head: 0.04, lean: 0.03, root: vec(R.root.x, y + 0.5), handN: vec(R.handN.x, R.handN.y + 0.4) }) },
      ]);
    case 'smoke':
      return loopKeys([
        { at: 0, pose: P({ handN: vec(CENTER_X + 7, y - 4), wpn: 0.3 }) },
        { at: 0.35, ease: 'out', pose: P({ handN: vec(CENTER_X + 9, y - 13), wpn: 0.1, head: -0.08 }) },
        { at: 0.55, pose: P({ handN: vec(CENTER_X + 9, y - 13), wpn: 0.1, head: -0.12, stretch: 0.02, fx: 1 }) },
        { at: 0.8, ease: 'in', pose: P({ handN: vec(CENTER_X + 7, y - 4), wpn: 0.3, fx: 0.5 }) },
      ]);
    case 'ready':
      return loopKeys([
        { at: 0, pose: P({ root: vec(R.root.x, y + 1.2), lean: R.lean + 0.03 }) },
        { at: 0.25, pose: P({ root: vec(R.root.x, y + 0.2), lean: R.lean }) },
        { at: 0.5, pose: P({ root: vec(R.root.x, y + 1.2), lean: R.lean + 0.03 }) },
        { at: 0.75, pose: P({ root: vec(R.root.x, y + 0.2), lean: R.lean, head: R.head + 0.04 }) },
      ]);
    case 'slump':
      return loopKeys([
        { at: 0, pose: P({ root: vec(R.root.x - 1, y + 3), lean: 0.3, head: 0.35, handF: vec(CENTER_X + 2, y), handN: vec(CENTER_X + 5, y + 5) }) },
        { at: 0.5, pose: P({ root: vec(R.root.x - 1.4, y + 3.6), lean: 0.36, head: 0.42, handF: vec(CENTER_X + 2, y + 0.6), handN: vec(CENTER_X + 5, y + 5.6) }) },
      ]);
    case 'polish':
      return loopKeys([
        { at: 0, pose: P({ zN: -5, zF: -0.5, head: 0.25, handF: vec(CENTER_X + 8, y - 3), off: 1.2, handN: vec(CENTER_X + 10, y - 6), wpn: 0.3 }) },
        { at: 0.25, pose: P({ zN: -5, zF: -0.5, head: 0.25, handF: vec(CENTER_X + 8, y - 3), off: 1.2, handN: vec(CENTER_X + 12, y - 4.6), wpn: 0.3 }) },
        { at: 0.5, pose: P({ zN: -5, zF: -0.5, head: 0.27, handF: vec(CENTER_X + 8, y - 3), off: 1.2, handN: vec(CENTER_X + 10, y - 3), wpn: 0.3 }) },
        { at: 0.75, pose: P({ zN: -5, zF: -0.5, head: 0.25, handF: vec(CENTER_X + 8, y - 3), off: 1.2, handN: vec(CENTER_X + 8.5, y - 5), wpn: 0.3 }) },
      ]);
  }
}

export function npcDrawer(spec: NpcSpec): EntityDrawer {
  const skin = folkSkin(spec.look);
  const R = readyFor(spec);
  const work = workTrack(spec.work, R);
  const y = R.root.y;
  // Talking keeps the prop hand at rest and gestures with the other.
  const gestureNear = (spec.gesture ?? (UPRIGHT_PROPS.has(spec.look.offItem ?? 'none') ? 'near' : 'far')) === 'near';
  const talk: Key<HumanPose>[] = gestureNear
    ? loopKeys([
        { at: 0, pose: { ...R, handN: vec(CENTER_X + 6, y - 5), zN: -1, head: 0.02, fx: 1 } },
        { at: 0.33, pose: { ...R, handN: vec(CENTER_X + 9, y - 9), zN: -1.5, head: -0.06, lean: R.lean + 0.03, fx: 0 } },
        { at: 0.66, pose: { ...R, handN: vec(CENTER_X + 8, y - 3), zN: -1, head: 0.06, fx: 1 } },
      ])
    : loopKeys([
        { at: 0, pose: { ...R, handF: vec(CENTER_X + 6, y - 5), off: 0.9, head: 0.02, fx: 1 } },
        { at: 0.33, pose: { ...R, handF: vec(CENTER_X + 10, y - 9), off: 1.2, head: -0.06, lean: R.lean + 0.03, fx: 0 } },
        { at: 0.66, pose: { ...R, handF: vec(CENTER_X + 8, y - 3), off: 1, head: 0.06, fx: 1 } },
      ]);
  const workStart = samplePoseTrack(work, 0);
  const alert: Key<HumanPose>[] = [
    { at: 0, pose: workStart },
    { at: 0.4, pose: { ...R, head: -0.12, stretch: 0.02 } },
    { at: 1, ease: 'out', pose: { ...R, head: -0.06, handF: vec(CENTER_X + 4, y - 22), off: 0.2, stretch: 0.015 } },
  ];

  const pose = (act: NPCAction, t: number): HumanPose => {
    switch (act) {
      case 'working': return samplePoseTrack(work, t);
      case 'alert': return samplePoseTrack(alert, t);
      case 'talking': return samplePoseTrack(talk, t);
      case 'idle':
      default: {
        const ph = t * Math.PI * 2;
        const b = Math.sin(ph);
        return {
          ...R,
          root: vec(R.root.x, R.root.y + b * 0.5),
          stretch: b * -0.012,
          head: R.head + Math.sin(ph * 0.5) * 0.08,
          handN: vec(R.handN.x, R.handN.y + b * 0.4),
          handF: vec(R.handF.x, R.handF.y + Math.sin(ph - 0.5) * 0.5),
          flow: R.flow + b * 0.04,
        };
      }
    }
  };

  return {
    key: spec.key,
    frameW: spec.frameW ?? 80,
    frameH: spec.frameH ?? 120,
    totalFrames: 24,
    inked: true,
    drawFrame(ctx, frame, action, w, h) {
      const act = action as NPCAction;
      const count = NPC_FRAME_COUNTS[act] ?? 6;
      const t = frameTime(frame % count, count, act !== 'alert');
      const p = pose(act, t);
      const palette = getCurrentZonePalette();
      const scenery = spec.scenery;
      const frameSkin: HumanViewSkin = scenery
        ? {
            prop: skin.prop,
            build: skin.build,
            parts(c, sk, pp, tt): ViewPart[] {
              return [...skin.parts(c, sk, pp, tt), { z: spec.sceneryZ ?? 0.5, draw: () => scenery(c, sk, act, tt) }];
            },
          }
        : skin;
      let sk: ViewSkeleton | null = null;
      renderRigFrame(
        ctx, w, h,
        c => {
          c.translate(0, -NPC_LIFT);
          sk = drawHumanoidView(c, p, frameSkin, t, NPC_VIEW);
        },
        { glowColor: palette.npcOutlineColor, glowBlur: standardOutlineBlur(w, h), scale: spec.scale ?? 1 },
        c => { groundShadow(c, CENTER_X + 1, 13, 0, GROUND_Y + 1 - NPC_LIFT); },
        spec.fx ? c => {
          c.translate(0, -NPC_LIFT);
          if (sk) spec.fx!(c, p, sk, act, t);
        } : undefined,
      );
    },
  };
}

// ── Shared scenery & effects ────────────────────────────────────────────

const IRON = tone(0x5c6270, { light: 0.4 });
const STUMP = tone(0x6e4a2c);

/**
 * Anvil on a stump at the smith's front-left, in pose space (x forward from
 * CENTER_X, z toward the smith's right): projected with the figure, it sits
 * on the ground to the screen right, clear of his body.
 */
const ANVIL_X = CENTER_X + 11;
const ANVIL_Z = -5.5;
const ANVIL_TOP = GROUND_Y - 17;
const STUMP_R = 4;

function ring(rig: ViewRig, y: number, r: number, n = 16): V[] {
  const pts: V[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(rig.pt(ANVIL_X + Math.cos(a) * r, y, ANVIL_Z + Math.sin(a) * r));
  }
  return pts;
}

export function anvilScenery(ctx: CanvasRenderingContext2D, sk: ViewSkeleton): void {
  const rig = sk.rig;
  const stumpTop = ANVIL_TOP + 5;
  // Stump: a projected cylinder, bark side then the cut top.
  const side = hull([...ring(rig, GROUND_Y, STUMP_R + 0.5), ...ring(rig, stumpTop, STUMP_R)]);
  cel(ctx, () => polyPath(ctx, side), STUMP, { band: 0.9 });
  ctx.strokeStyle = 'rgba(40,24,12,0.45)';
  ctx.lineWidth = 0.5;
  for (const a of [0.9, 1.6, 2.4]) {
    const q0 = rig.pt(ANVIL_X + Math.cos(a) * STUMP_R, stumpTop + 1, ANVIL_Z + Math.sin(a) * STUMP_R);
    const q1 = rig.pt(ANVIL_X + Math.cos(a) * (STUMP_R + 0.5), GROUND_Y - 0.5, ANVIL_Z + Math.sin(a) * (STUMP_R + 0.5));
    ctx.beginPath();
    ctx.moveTo(q0.x, q0.y);
    ctx.lineTo(q1.x, q1.y);
    ctx.stroke();
  }
  cel(ctx, () => polyPath(ctx, ring(rig, stumpTop, STUMP_R)), tone(0x9a7048, { light: 0.3 }), { band: 0.4, stroke: 0.45 });
  // Anvil: the side profile (horn forward) extruded across z.
  const x = ANVIL_X;
  const top = ANVIL_TOP;
  const prof: [number, number][] = [
    [x - 6, top], [x + 3.4, top], [x + 7.5, top + 1], [x + 3.2, top + 2.4],
    [x + 2.2, top + 5], [x - 2.4, top + 5], [x - 3, top + 2.4], [x - 5.6, top + 1.6],
  ];
  const hw = 2.3;
  const face = (z: number): V[] => prof.map(([px, py]) => rig.pt(px, py, ANVIL_Z + z));
  const near = rig.facing(0, 0, 1) > 0 ? hw : -hw;
  const body = hull([...face(-hw), ...face(hw)]);
  cel(ctx, () => polyPath(ctx, body), IRON, { band: 0.9, hi: 0.5 });
  cel(ctx, () => polyPath(ctx, face(near)), IRON, { band: 0.7, hi: 0.4, stroke: 0.4 });
  // Working face on top
  const faceTop = [
    rig.pt(x - 6, top, ANVIL_Z - hw), rig.pt(x + 3.4, top, ANVIL_Z - hw * 0.9),
    rig.pt(x + 3.4, top, ANVIL_Z + hw * 0.9), rig.pt(x - 6, top, ANVIL_Z + hw),
  ];
  ctx.fillStyle = 'rgba(200,210,226,0.85)';
  ctx.beginPath();
  polyPath(ctx, faceTop);
  ctx.fill();
}

/** Where the hammer lands on the anvil face. */
export function anvilStrikePoint(sk: ViewSkeleton): V {
  return sk.rig.pt(ANVIL_X - 1, ANVIL_TOP, ANVIL_Z);
}

/** Forge sparks at the anvil face when the hammer lands. */
export function hammerSparks(ctx: CanvasRenderingContext2D, fx: number, t: number, sk: ViewSkeleton): void {
  if (fx < 0.3) return;
  const at = anvilStrikePoint(sk);
  glow(ctx, at, 5 * fx, 0xffa040, 0.7 * fx);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.45;
    const r = 3 + ((i * 37 + Math.round(t * 100)) % 5);
    glow(ctx, vec(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r * 0.8), 1.2, 0xffd070, fx);
  }
}
