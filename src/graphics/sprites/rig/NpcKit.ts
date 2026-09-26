/**
 * NPC drawer factory: a FolkLook (Townsfolk.ts) plus a work-loop preset
 * becomes a full 24-frame NPC sheet (working 8, alert 4, idle 6, talking 6)
 * in the shared rigged style.
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
} from './Rig';
import { basePose, drawHumanoid, solveSkeleton, type HumanPose, type Skeleton } from './Humanoid';
import { folkSkin, type FolkLook } from './Townsfolk';
import { getCurrentZonePalette, standardOutlineBlur } from '../../ZonePalette';

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
  /** Adjust the resting pose (hands, stance, props). */
  ready?: Partial<HumanPose>;
  /** Scenery drawn behind the NPC (anvil, counter…). */
  scenery?: (ctx: CanvasRenderingContext2D, action: NPCAction, t: number) => void;
  /** Extra glows/particles over the inked figure. */
  fx?: (ctx: CanvasRenderingContext2D, p: HumanPose, sk: Skeleton, action: NPCAction, t: number) => void;
}

function readyFor(spec: NpcSpec): HumanPose {
  const prop = folkSkin(spec.look).prop;
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
      return loopKeys([
        { at: 0, pose: P({ handN: vec(CENTER_X - 5.5, y - 18), wpn: -1.2, lean: -0.08, head: 0.12, handF: vec(CENTER_X + 11, y + 3), off: 1.35 }) },
        { at: 0.32, ease: 'in', pose: P({ handN: vec(CENTER_X + 11, y + 2), wpn: 1.9, lean: 0.24, head: 0.3, root: vec(R.root.x + 1, y + 1.2), handF: vec(CENTER_X + 11, y + 4), off: 1.35, fx: 1 }) },
        { at: 0.45, pose: P({ handN: vec(CENTER_X + 10.5, y), wpn: 1.6, lean: 0.2, head: 0.27, root: vec(R.root.x + 1, y + 0.8), handF: vec(CENTER_X + 11, y + 3.5), off: 1.35, fx: 0.4 }) },
        { at: 0.8, ease: 'out', pose: P({ handN: vec(CENTER_X - 5, y - 17), wpn: -1.1, lean: -0.06, head: 0.14, handF: vec(CENTER_X + 11, y + 3), off: 1.35 }) },
      ]);
    case 'ledger':
      return loopKeys([
        { at: 0, pose: P({ head: 0.3, handF: vec(CENTER_X + 8, y - 4), off: 1.5, handN: vec(CENTER_X + 9, y - 3), wpn: 0.6 }) },
        { at: 0.25, pose: P({ head: 0.32, handF: vec(CENTER_X + 8, y - 4), off: 1.5, handN: vec(CENTER_X + 10.5, y - 2.4), wpn: 0.7 }) },
        { at: 0.5, pose: P({ head: 0.28, handF: vec(CENTER_X + 8, y - 4.4), off: 1.5, handN: vec(CENTER_X + 9, y - 1.6), wpn: 0.6 }) },
        { at: 0.75, pose: P({ head: 0.3, handF: vec(CENTER_X + 8, y - 4), off: 1.5, handN: vec(CENTER_X + 11, y - 2.8), wpn: 0.75 }) },
      ]);
    case 'count':
      return loopKeys([
        { at: 0, pose: P({ head: 0.25, handF: vec(CENTER_X + 7, y - 2), off: 0, handN: vec(CENTER_X + 9, y - 6), wpn: 0.3 }) },
        { at: 0.3, ease: 'out', pose: P({ head: 0.18, handF: vec(CENTER_X + 7, y - 2), off: 0, handN: vec(CENTER_X + 10, y - 12), wpn: 0.3, fx: 1 }) },
        { at: 0.6, ease: 'in', pose: P({ head: 0.28, handF: vec(CENTER_X + 7, y - 2.4), off: 0, handN: vec(CENTER_X + 9, y - 5), wpn: 0.3 }) },
      ]);
    case 'read':
      return loopKeys([
        { at: 0, pose: P({ head: 0.3, handN: vec(CENTER_X + 9, y - 6), wpn: 0.1, handF: vec(CENTER_X + 7, y - 5), off: 0.2 }) },
        { at: 0.5, pose: P({ head: 0.36, lean: 0.07, handN: vec(CENTER_X + 9.5, y - 5.4), wpn: 0.14, handF: vec(CENTER_X + 7, y - 4.6), off: 0.2 }) },
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
        { at: 0, pose: P({ head: 0.25, handF: vec(CENTER_X + 8, y - 3), off: 1.2, handN: vec(CENTER_X + 10, y - 6), wpn: 0.3 }) },
        { at: 0.25, pose: P({ head: 0.25, handF: vec(CENTER_X + 8, y - 3), off: 1.2, handN: vec(CENTER_X + 12, y - 4.6), wpn: 0.3 }) },
        { at: 0.5, pose: P({ head: 0.27, handF: vec(CENTER_X + 8, y - 3), off: 1.2, handN: vec(CENTER_X + 10, y - 3), wpn: 0.3 }) },
        { at: 0.75, pose: P({ head: 0.25, handF: vec(CENTER_X + 8, y - 3), off: 1.2, handN: vec(CENTER_X + 8.5, y - 5), wpn: 0.3 }) },
      ]);
  }
}

export function npcDrawer(spec: NpcSpec): EntityDrawer {
  const skin = folkSkin(spec.look);
  const R = readyFor(spec);
  const work = workTrack(spec.work, R);
  const y = R.root.y;
  // Talking keeps the prop hand at rest and gestures with the other.
  const talk: Key<HumanPose>[] = loopKeys([
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
      renderRigFrame(
        ctx, w, h,
        c => { drawHumanoid(c, p, skin, t); },
        { glowColor: palette.npcOutlineColor, glowBlur: standardOutlineBlur(w, h), scale: spec.scale ?? 1 },
        c => {
          groundShadow(c, p.root.x + 1, 12, 0);
          spec.scenery?.(c, act, t);
        },
        spec.fx ? c => spec.fx!(c, p, solveSkeleton(p, skin.prop), act, t) : undefined,
      );
    },
  };
}

// ── Shared scenery & effects ────────────────────────────────────────────

const IRON = tone(0x5c6270, { light: 0.4 });

/** Small anvil on a stump in front of the smith. */
const ANVIL_X = CENTER_X + 19;
const ANVIL_TOP = GROUND_Y - 18;

export function anvilScenery(ctx: CanvasRenderingContext2D): void {
  const x = ANVIL_X;
  const top = ANVIL_TOP;
  cel(ctx, () => polyPath(ctx, [vec(x - 4.4, GROUND_Y), vec(x + 4.4, GROUND_Y), vec(x + 3.8, top + 5), vec(x - 3.8, top + 5)]), tone(0x6e4a2c), { band: 0.7 });
  ctx.strokeStyle = 'rgba(40,24,12,0.5)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(x, top + 5.2, 3.8, 1, 0, 0, Math.PI * 2);
  ctx.stroke();
  cel(ctx, () => polyPath(ctx, [
    vec(x - 7, top), vec(x + 3.6, top), vec(x + 8, top + 1), vec(x + 3.4, top + 2.4),
    vec(x + 2.4, top + 5), vec(x - 2.6, top + 5), vec(x - 3.2, top + 2.4), vec(x - 6.6, top + 1.6),
  ]), IRON, { band: 0.9, hi: 0.5 });
}

/** Forge sparks at the anvil face when the hammer lands. */
export function hammerSparks(ctx: CanvasRenderingContext2D, fx: number, t: number): void {
  if (fx < 0.3) return;
  const x = ANVIL_X - 2;
  const yy = ANVIL_TOP;
  glow(ctx, vec(x, yy), 5 * fx, 0xffa040, 0.7 * fx);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.45;
    const r = 3 + ((i * 37 + Math.round(t * 100)) % 5);
    glow(ctx, vec(x + Math.cos(a) * r, yy + Math.sin(a) * r * 0.8), 1.2, 0xffd070, fx);
  }
}
