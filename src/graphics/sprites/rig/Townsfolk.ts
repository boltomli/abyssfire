/**
 * Parametric human "townsfolk" skin for NPCs.
 *
 * An NPC is described by a FolkLook (skin tone, hair, beard, hat, clothing
 * layers, build, held props) and turned into a HumanViewSkin: the figure is
 * drawn in the isometric front 3/4 view (HumanView.ts, `se`: facing the
 * camera, turned toward screen right-down; mirrored for sw). Bodies, heads,
 * hats and garments are lofted 3D shapes projected per frame and painted in
 * depth order, so every NPC shares the heroes' cel-shaded, ink-outlined
 * style while staying cheap to author and easy to vary.
 */
import {
  blobPath,
  capsulePath,
  cel,
  clothChain,
  ellipsePath,
  lerpV,
  limb,
  polyPath,
  tone,
  vec,
  type Tone,
  type V,
} from './Rig';
import type { HumanPose, Proportions } from './Humanoid';
import {
  Section,
  footOutline,
  inItem,
  midpointPath,
  ringAt,
  strokeLine,
  v3,
  type HumanViewSkin,
  type Ring,
  type V3,
  type ViewBuild,
  type ViewPart,
  type ViewRig,
  type ViewSkeleton,
} from './HumanView';

export type HairStyle = 'short' | 'long' | 'bald' | 'ponytail' | 'bun' | 'wild' | 'braid';
export type BeardStyle = 'stubble' | 'short' | 'full' | 'long' | 'braided' | 'mustache';
export type HatKind = 'hood' | 'cap' | 'turban' | 'widebrim' | 'helm' | 'headband' | 'bandana' | 'coif' | 'feathered';
export type TopKind = 'tunic' | 'robe' | 'vest' | 'coat';
export type Build = 'slim' | 'normal' | 'stout' | 'dwarf';
export type Prop =
  | 'hammer' | 'tongs' | 'scroll' | 'staff' | 'lantern' | 'pouch' | 'spear' | 'bow'
  | 'book' | 'pipe' | 'ledger' | 'key' | 'sword' | 'shield' | 'pickaxe' | 'dagger'
  | 'mace' | 'wand' | 'crutch' | 'none';

export interface FolkLook {
  skin: number;
  build?: Build;
  hair?: { color: number; style: HairStyle };
  beard?: { color: number; style: BeardStyle };
  hat?: { kind: HatKind; color: number; accent?: number };
  top: { color: number; kind: TopKind; trim?: number };
  sleeves?: number;
  apron?: number;
  belt?: number;
  legs: number;
  boots: number;
  cape?: number;
  mantle?: number;
  armor?: number;
  pack?: number;
  /** Bandage/injury marks for wounded NPCs. */
  bandage?: boolean;
  /** Round spectacles. */
  specs?: boolean;
  eyes?: number;
  item?: Prop;
  offItem?: Prop;
}

interface BuildSpec {
  prop: Proportions;
  girth: number;
  view: ViewBuild;
  /** Forward belly bulge (units). */
  belly: number;
}

const BUILDS: Record<Build, BuildSpec> = {
  slim: {
    prop: { thigh: 12, shin: 12, upperArm: 9.5, foreArm: 9, torso: 16, neck: 7.2, ankle: 2.1, hipN: vec(1.6, 0), hipF: vec(-2, -0.4), shN: vec(1, 3.6), shF: vec(-3.8, 3) },
    girth: 0.88,
    view: { hipW: 2.2, shW: 4.9, elbowOut: 1.1, footOut: 0.3 },
    belly: 0,
  },
  normal: {
    prop: { thigh: 12, shin: 11.5, upperArm: 9.5, foreArm: 9, torso: 16.5, neck: 7.2, ankle: 2.2, hipN: vec(1.9, 0), hipF: vec(-2.3, -0.4), shN: vec(1.2, 3.8), shF: vec(-4.2, 3.2) },
    girth: 1,
    view: { hipW: 2.5, shW: 5.5, elbowOut: 1.2, footOut: 0.4 },
    belly: 0,
  },
  stout: {
    prop: { thigh: 11.5, shin: 11, upperArm: 9.5, foreArm: 9, torso: 16.5, neck: 7, ankle: 2.2, hipN: vec(2.2, 0), hipF: vec(-2.6, -0.4), shN: vec(1.4, 4), shF: vec(-4.8, 3.4) },
    girth: 1.2,
    view: { hipW: 3, shW: 6.4, elbowOut: 1.4, footOut: 0.5 },
    belly: 1.6,
  },
  dwarf: {
    prop: { thigh: 8.5, shin: 8, upperArm: 8.5, foreArm: 8, torso: 15, neck: 6.8, ankle: 2, hipN: vec(2.2, 0), hipF: vec(-2.6, -0.4), shN: vec(1.4, 3.8), shF: vec(-4.8, 3.2) },
    girth: 1.25,
    view: { hipW: 3, shW: 6.6, elbowOut: 1.5, footOut: 0.7 },
    belly: 1.4,
  },
};

/** Proportions and 3D body widths of a build. */
export function folkBuild(look: FolkLook): { prop: Proportions; view: ViewBuild } {
  const b = BUILDS[look.build ?? 'normal'];
  return { prop: b.prop, view: b.view };
}

const METAL = tone(0x9aa3b2, { light: 0.5 });
const METAL_DARK = tone(0x5a606e);
const WOOD = tone(0x7a5230, { light: 0.3 });
const PAPER = tone(0xefe3c2, { light: 0.4, shadow: 0.25 });
const GOLD = tone(0xd9a640, { light: 0.5 });
const LEATHER = tone(0x6a4228);
const BEDROLL = tone(0x8a6a4a);

interface FolkTones {
  skin: Tone; skinFar: Tone;
  top: Tone; topFar: Tone;
  sleeve: Tone; sleeveFar: Tone;
  legs: Tone; legsFar: Tone;
  boots: Tone; bootsFar: Tone;
  hair?: Tone; beard?: Tone; hat?: Tone; hatAccent?: Tone;
  trim?: Tone; apron?: Tone; belt: Tone; cape?: Tone; capeIn?: Tone; mantle?: Tone; armor?: Tone; pack?: Tone;
}

function farTone(c: number): Tone {
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return tone(((r * 0.7) << 16) | ((g * 0.7) << 8) | (b * 0.72), { light: 0.18 });
}

function tones(look: FolkLook): FolkTones {
  const sleeves = look.sleeves ?? look.top.color;
  return {
    skin: tone(look.skin, { shadow: 0.3, light: 0.25 }),
    skinFar: farTone(look.skin),
    top: tone(look.top.color),
    topFar: farTone(look.top.color),
    sleeve: tone(sleeves),
    sleeveFar: farTone(sleeves),
    legs: tone(look.legs),
    legsFar: farTone(look.legs),
    boots: tone(look.boots),
    bootsFar: farTone(look.boots),
    hair: look.hair ? tone(look.hair.color, { light: 0.35 }) : undefined,
    beard: look.beard ? tone(look.beard.color, { light: 0.35 }) : undefined,
    hat: look.hat ? tone(look.hat.color, { light: look.hat.kind === 'helm' ? 0.5 : 0.32 }) : undefined,
    hatAccent: look.hat?.accent !== undefined ? tone(look.hat.accent, { light: 0.45 }) : undefined,
    trim: look.top.trim !== undefined ? tone(look.top.trim, { light: 0.45 }) : undefined,
    apron: look.apron !== undefined ? tone(look.apron) : undefined,
    belt: tone(look.belt ?? 0x4a2f1c),
    cape: look.cape !== undefined ? tone(look.cape) : undefined,
    capeIn: look.cape !== undefined ? farTone(look.cape) : undefined,
    mantle: look.mantle !== undefined ? tone(look.mantle, { light: 0.35 }) : undefined,
    armor: look.armor !== undefined ? tone(look.armor, { light: 0.5 }) : undefined,
    pack: look.pack !== undefined ? tone(look.pack) : undefined,
  };
}

/** Everything a part painter needs for one frame. */
interface Ctx {
  ctx: CanvasRenderingContext2D;
  sk: ViewSkeleton;
  p: HumanPose;
  t: number;
  look: FolkLook;
  T: FolkTones;
  g: number;
  b: BuildSpec;
}

function clipTo(ctx: CanvasRenderingContext2D, pts: readonly V[]): void {
  ctx.beginPath();
  midpointPath(ctx, pts);
  ctx.clip();
}

// ── Body ────────────────────────────────────────────────────────────────

function torsoRings(len: number, g: number, belly: number): Ring[] {
  return [
    { h: len + 0.8, a: 2.2 * g, b: 2.9 * g },
    { h: len - 1.2, a: 3.6 * g, b: 5.3 * g },
    { h: len - 5.5, a: 3.9 * g, b: 5.4 * g, f: 0.3 },
    { h: len * 0.4, a: 3.6 * g + belly, b: 5 * g + belly * 0.4, f: belly * 0.9 },
    { h: 1.2, a: 3.8 * g + belly * 0.4, b: 5.2 * g, f: belly * 0.4 },
    { h: -2.4, a: 4.1 * g, b: 5.6 * g },
  ];
}

function viewLeg(c: Ctx, near: boolean): void {
  const { ctx, sk, T, g } = c;
  const hip = near ? sk.hipN : sk.hipF;
  const knee = near ? sk.kneeN : sk.kneeF;
  const ankle = near ? sk.footN : sk.footF;
  const legs = near ? T.legs : T.legsFar;
  const boots = near ? T.boots : T.bootsFar;
  limb(ctx, hip, knee, 3.3 * g, 2.8 * g, legs);
  limb(ctx, knee, ankle, 2.8 * g, 2.2 * g, legs);
  // Boot shaft up the shin, then the projected foot.
  limb(ctx, lerpV(knee, ankle, 0.5), ankle, 2.6 * g, 2.4 * g, boots, 0.6);
  const j = near ? sk.j.footN : sk.j.footF;
  const sole = near ? sk.j.soleN : sk.j.soleF;
  cel(ctx, () => polyPath(ctx, footOutline(sk.rig, j, sole, 5.4, 2.6, 4.6 * g, 2)), boots, { band: 0.8 });
}

function viewArm(c: Ctx, near: boolean): void {
  const { ctx, sk, T, g } = c;
  const sh = near ? sk.shN : sk.shF;
  const el = near ? sk.elN : sk.elF;
  const hand = near ? sk.handN : sk.handF;
  const sl = near ? T.sleeve : T.sleeveFar;
  limb(ctx, sh, el, 2.9 * g, 2.5 * g, sl);
  limb(ctx, el, lerpV(el, hand, 0.8), 2.5 * g, 2.3 * g, sl);
  if (T.armor) {
    // Pauldron over the shoulder
    const a = near ? T.armor : farTone(c.look.armor ?? 0);
    cel(ctx, () => ellipsePath(ctx, vec(sh.x, sh.y - 0.6), 3.8 * g, 3 * g, 0), a, { band: 0.9, hi: 0.5 });
    ctx.strokeStyle = a.light;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y - 0.2, 3.1 * g, 2.2 * g, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
}

function viewHand(c: Ctx, near: boolean): void {
  const { ctx, sk, T } = c;
  const at = near ? sk.handN : sk.handF;
  cel(ctx, () => ellipsePath(ctx, at, 2.1, 2), near ? T.skin : T.skinFar, { band: 0.6, stroke: 0.4 });
}

/** Robe / coat skirt hanging plumb from the waist round both legs. */
function viewSkirt(c: Ctx): void {
  const { ctx, sk, p, t, look, T, g } = c;
  if (look.top.kind !== 'robe' && look.top.kind !== 'coat') return;
  const long = look.top.kind === 'robe';
  const S = new Section(sk.rig, sk.j.pelvis, v3(0, -1, 0), v3(1, 0, 0));
  const fN = sk.j.footN;
  const fF = sk.j.footF;
  const spread = Math.abs(fN.x - fF.x);
  const groundY = Math.max(fN.y, fF.y);
  const kneeY = (sk.j.kneeN.y + sk.j.kneeF.y) / 2;
  const hemY = long ? groundY - 2.8 : Math.min(groundY - 5, kneeY + 4);
  const hemH = sk.j.pelvis.y - hemY;
  const mid = (fN.x + fF.x) / 2 - sk.j.pelvis.x - p.flow * 2.4;
  const wave = Math.sin(t * Math.PI * 4) * 0.35;
  const flare = long ? 1 : 0.6;
  const rings: Ring[] = [
    { h: 2.2, a: 3.9 * g, b: 5.3 * g },
    { h: -2, a: 4.4 * g, b: 5.9 * g, f: mid * 0.3 },
    { h: hemH * 0.55, a: (4.8 + spread * 0.2 * flare) * g, b: (6.4 + flare * 0.4) * g, f: mid * 0.65 },
    { h: hemH + wave, a: (5.2 + spread * 0.4 * flare) * g, b: (7 + flare * 0.8) * g, f: mid },
  ];
  const outline = S.loft(rings, 28);
  cel(ctx, () => midpointPath(ctx, outline), T.top, { band: 1.6 });
  ctx.save();
  clipTo(ctx, outline);
  // Fold lines down the front
  for (const phi of [-0.45, 0.55, 1.2]) {
    if (S.vis(phi) > 0.05) strokeLine(ctx, rings.slice(1).map(r => S.at(r.h, phi, r.a, r.b, r.f ?? 0)), T.top.shade, 0.55);
  }
  if (!long || T.trim) {
    // Front opening (coat) / trimmed placket (robe)
    const edge = rings.map(r => S.at(r.h, 0.12, r.a + 0.05, r.b + 0.05, r.f ?? 0));
    strokeLine(ctx, edge, T.trim ? T.trim.base : T.top.line, T.trim ? 0.9 : 0.6);
  }
  ctx.restore();
  const hem = rings[rings.length - 1];
  if (T.trim) {
    for (const run of S.visibleArcs({ ...hem, h: hem.h + 0.7, a: hem.a + 0.05, b: hem.b + 0.05 }, 0, Math.PI * 2, 32, -0.3)) {
      strokeLine(ctx, run, T.trim.base, 1);
    }
  }
}

function viewTorso(c: Ctx): void {
  const { ctx, sk, look, T, g, b } = c;
  const S = sk.torso;
  const len = sk.torsoLen;
  const rings = torsoRings(len, g, b.belly);
  const shell = S.loft(rings, 28);
  cel(ctx, () => midpointPath(ctx, shell), T.top, { band: 1.5 });
  const R = (h: number, phi: number, lift = 0): V => {
    const r = ringAt(rings, h);
    return S.at(h, phi, r.a + lift, r.b + lift, r.f ?? 0);
  };
  const R3 = (h: number, phi: number, lift = 0): V3 => {
    const r = ringAt(rings, h);
    return S.p3(h, phi, r.a + lift, r.b + lift, r.f ?? 0);
  };
  ctx.save();
  clipTo(ctx, shell);
  if (look.top.kind === 'vest') {
    // Shirt down the front under an open vest
    const panel: V[] = [];
    for (let i = 0; i <= 8; i++) panel.push(R(len + 0.4 - (len + 2.6) * (i / 8), -0.34 + Math.sin((i / 8) * Math.PI) * 0.06, 0.05));
    for (let i = 8; i >= 0; i--) panel.push(R(len + 0.4 - (len + 2.6) * (i / 8), 0.58 - Math.sin((i / 8) * Math.PI) * 0.06, 0.05));
    cel(ctx, () => polyPath(ctx, panel), T.sleeve, { band: 0.6, stroke: 0 });
    for (const phi of [-0.34, 0.58]) {
      const edge: V[] = [];
      for (let h = len + 0.4; h >= -2.4; h -= 1.4) edge.push(R(h, phi, 0.1));
      strokeLine(ctx, edge, T.trim ? T.trim.base : T.top.shade, 0.9);
    }
  } else {
    // Collar V and a placket / trim line down the front
    const collar = [R(len + 0.2, -0.55), R(len - 3.2, 0.12), R(len + 0.2, 0.8)];
    strokeLine(ctx, collar, T.trim ? T.trim.base : T.top.shade, T.trim ? 0.9 : 0.6);
    if (T.trim) {
      const line: V[] = [];
      for (let h = len - 3.2; h >= -2.4; h -= 1.3) line.push(R(h, 0.12, 0.05));
      strokeLine(ctx, line, T.trim.base, 0.8);
    }
  }
  // Side fold under the near arm
  const fold: V[] = [];
  for (let h = len - 4; h >= 0; h -= 2) fold.push(R(h, 1.35));
  strokeLine(ctx, fold, T.top.shade, 0.6);
  ctx.restore();

  if (T.armor) {
    const plate: Ring[] = [
      { h: len - 0.2, a: 3.4 * g, b: 4.9 * g },
      { h: len - 2, a: 4.2 * g, b: 5.6 * g, f: 0.2 },
      { h: len - 6, a: 4.5 * g, b: 5.7 * g, f: 0.6 },
      { h: len * 0.4, a: 4.1 * g + b.belly, b: 5.3 * g, f: 0.4 + b.belly * 0.9 },
      { h: 2.4, a: 4.1 * g + b.belly * 0.4, b: 5.5 * g, f: b.belly * 0.4 },
    ];
    const cuirass = S.loft(plate, 28);
    cel(ctx, () => midpointPath(ctx, cuirass), T.armor, { band: 1.6, hi: 0.8 });
    ctx.save();
    clipTo(ctx, cuirass);
    const ridge: V[] = [];
    for (let h = len - 1.5; h >= 3; h -= 1.2) {
      const r = ringAt(plate, h);
      ridge.push(S.at(h, 0, r.a, r.b, r.f ?? 0));
    }
    strokeLine(ctx, ridge, T.armor.light, 0.9);
    for (const side of [-1, 1]) {
      const seam: V[] = [];
      for (let h = len - 2; h >= 3; h -= 1.5) {
        const r = ringAt(plate, h);
        seam.push(S.at(h, side * 1.2, r.a, r.b, r.f ?? 0));
      }
      strokeLine(ctx, seam, T.armor.shade, 0.5);
    }
    if (T.trim) {
      for (const run of S.visibleArcs({ ...ringAt(plate, 3.2) }, 0, Math.PI * 2, 28, -0.2)) strokeLine(ctx, run, T.trim.base, 0.8);
    }
    ctx.restore();
  }

  // Belt with buckle
  const beltR = ringAt(rings, 1.1);
  for (const run of S.visibleArcs({ ...beltR, a: beltR.a + 0.25, b: beltR.b + 0.25 }, 0, Math.PI * 2, 32, -0.15)) {
    strokeLine(ctx, run, T.belt.line, 2.6);
    strokeLine(ctx, run, T.belt.base, 1.9);
  }
  if (S.vis(0.3) > 0) {
    const bk = R(1.1, 0.3, 0.35);
    cel(ctx, () => polyPath(ctx, [vec(bk.x - 1.2, bk.y - 1.3), vec(bk.x + 1.2, bk.y - 1.3), vec(bk.x + 1.2, bk.y + 1.3), vec(bk.x - 1.2, bk.y + 1.3)]), GOLD, { band: 0.3, stroke: 0.4 });
  }

  if (T.apron) viewApron(c, R3);

  if (T.pack) {
    // Pack straps over the shoulders
    for (const phi of [-0.5, 0.95]) {
      const strap: V[] = [];
      for (let h = len + 0.6; h >= len - 8; h -= 1.2) strap.push(R(h, phi + (len - h) * 0.03, 0.2));
      strokeLine(ctx, strap, LEATHER.line, 1.8);
      strokeLine(ctx, strap, LEATHER.base, 1.2);
    }
  }

  if (T.mantle) {
    const mr: Ring[] = [
      { h: len + 1.6, a: 2.8 * g, b: 3.6 * g },
      { h: len - 0.6, a: 4.8 * g, b: 6.6 * g },
      { h: len - 5, a: 5.1 * g + b.belly * 0.4, b: 7 * g, f: 0.3 },
    ];
    const m = S.loft(mr, 28);
    cel(ctx, () => midpointPath(ctx, m), T.mantle, { band: 1.1 });
    const edge = { ...mr[2], h: mr[2].h + 0.6 };
    for (const run of S.visibleArcs(edge, 0, Math.PI * 2, 28, -0.2)) strokeLine(ctx, run, T.mantle.shade, 0.8);
    if (T.trim) {
      const clasp = S.at(len - 0.6, 0.15, mr[1].a + 0.2, mr[1].b + 0.2);
      cel(ctx, () => ellipsePath(ctx, clasp, 1.2, 1.2), GOLD, { band: 0.3, stroke: 0.4 });
    }
  }

  if (T.cape) {
    // Cape draped over the shoulders, clasped at the collar.
    const cr = { h: len - 0.4, a: 4.2 * g, b: 5.9 * g };
    for (const run of S.visibleArcs(cr, Math.PI * 0.55, Math.PI * 1.45, 16, -0.05)) {
      strokeLine(ctx, run, T.cape.line, 2.8);
      strokeLine(ctx, run, T.cape.base, 2.1);
    }
    for (const phi of [-0.75, 1.05]) {
      if (S.vis(phi) > 0) {
        const q = S.at(len - 0.2, phi, cr.a, cr.b);
        cel(ctx, () => ellipsePath(ctx, q, 1.1, 1.1), GOLD, { band: 0.3, stroke: 0.4 });
      }
    }
  }

  if (look.bandage) {
    const strap: V[] = [];
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      strap.push(R(len - 1.5 - k * (len - 5), 1.25 - k * 2.1, 0.3));
    }
    strokeLine(ctx, strap, 'rgba(120,110,96,0.9)', 2.5);
    strokeLine(ctx, strap, 'rgba(240,236,224,0.97)', 1.9);
    const spot = strap[4];
    ctx.fillStyle = 'rgba(170,30,30,0.85)';
    ctx.beginPath();
    ctx.ellipse(spot.x, spot.y, 1, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function viewApron(c: Ctx, R3: (h: number, phi: number, lift?: number) => V3): void {
  const { ctx, sk, p, t, T } = c;
  if (!T.apron) return;
  const len = sk.torsoLen;
  const rig = sk.rig;
  const sway = Math.sin(t * Math.PI * 2) * 0.3 - p.flow * 1.5;
  const drop = (q: V3, dy: number, dx = 0): V => rig.pt(q.x + dx, q.y + dy, q.z);
  const hang = 11;
  const top = len - 3.2;
  const pts: V[] = [
    rig.p(R3(top, -0.42, 0.3)),
    rig.p(R3(top, 0.62, 0.3)),
    rig.p(R3(len * 0.4, 0.95, 0.35)),
    rig.p(R3(1, 1.05, 0.4)),
    drop(R3(1, 1.05, 0.4), hang, 0.8 + sway),
    drop(R3(1, 0.1, 0.5), hang + 0.8, 1.2 + sway),
    drop(R3(1, -0.85, 0.4), hang, 0.8 + sway),
    rig.p(R3(1, -0.85, 0.4)),
    rig.p(R3(len * 0.4, -0.75, 0.35)),
  ];
  cel(ctx, () => polyPath(ctx, pts), T.apron, { band: 1 });
  // Neck strap and a pocket
  strokeLine(ctx, [rig.p(R3(top, -0.42, 0.3)), rig.p(R3(len + 0.6, -0.9, 0.2))], T.apron.shade, 0.8);
  strokeLine(ctx, [rig.p(R3(top, 0.62, 0.3)), rig.p(R3(len + 0.6, 1.2, 0.2))], T.apron.shade, 0.8);
  const pk = drop(R3(1, 0.3, 0.5), 3, 0.3 + sway * 0.3);
  ctx.strokeStyle = T.apron.shade;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(pk.x - 2, pk.y - 1.2, 4, 2.8);
}

function capeGeometry(c: Ctx): { left: V[]; right: V[]; hem: V[]; outer: boolean } {
  const { sk, p, t, g } = c;
  const S = sk.torso;
  const len = sk.torsoLen;
  const anchor = S.p3(len - 1, Math.PI, 3.4 * g, 0);
  const hang = Math.max(18, sk.j.soleF.y - anchor.y - 5);
  const chain = clothChain(vec(anchor.x, anchor.y), hang, 6, p.flow + 0.05, 1, t * Math.PI * 2);
  const left: V[] = [];
  const right: V[] = [];
  let hem: V[] = [];
  chain.forEach((pt, i) => {
    const k = i / (chain.length - 1);
    const half = (6.2 + k * 2.6) * g;
    const curl = 3.2 * (1 - k) * (1 - k) + 1.6;
    const ripple = Math.sin(t * Math.PI * 2 + k * 3) * 0.5 * k;
    const row = [-1, -0.5, 0, 0.5, 1].map(u => sk.rig.pt(pt.x + curl * u * u, pt.y + ripple * u, u * half));
    let lo = row[0];
    let hi = row[0];
    for (const q of row) {
      if (q.x < lo.x) lo = q;
      if (q.x > hi.x) hi = q;
    }
    left.push(lo);
    right.push(hi);
    if (i === chain.length - 1) hem = row;
  });
  return { left, right, hem, outer: sk.rig.facing(-1, 0, 0) > 0 };
}

function viewCape(c: Ctx): void {
  const { ctx, T } = c;
  if (!T.cape || !T.capeIn) return;
  const { left, right, hem, outer } = capeGeometry(c);
  const outline = [...left, ...[...right].reverse()];
  cel(ctx, () => midpointPath(ctx, outline), outer ? T.cape : T.capeIn, { band: 1.3 });
  ctx.save();
  clipTo(ctx, outline);
  strokeLine(ctx, hem.map(q => vec(q.x, q.y - 0.6)), T.cape.shade, 1);
  ctx.restore();
}

/** Travel pack: a projected box on the back with a bedroll on top. */
function viewPack(c: Ctx): void {
  const { ctx, sk, T, g } = c;
  if (!T.pack) return;
  const S = sk.torso;
  const len = sk.torsoLen;
  const rig = sk.rig;
  const up = S.up;
  const fw = S.fw;
  const back = 3.9 * g + 2.4;
  const ctr = v3(
    S.o.x + up.x * len * 0.5 - fw.x * back,
    S.o.y + up.y * len * 0.5 - fw.y * back,
    0,
  );
  const W = 4.8 * g;
  const D = 2.4;
  const H = 6.4;
  const corner = (u: number, f: number, z: number): V => rig.pt(
    ctr.x + up.x * H * u + fw.x * D * f,
    ctr.y + up.y * H * u + fw.y * D * f,
    z * W,
  );
  const faces: { n: V3; pts: V[]; tone: string }[] = [
    { n: v3(-fw.x, -fw.y, 0), pts: [corner(1, -1, -1), corner(1, -1, 1), corner(-1, -1, 1), corner(-1, -1, -1)], tone: T.pack.shade },
    { n: v3(0, 0, 1), pts: [corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1), corner(-1, -1, 1)], tone: T.pack.base },
    { n: v3(0, 0, -1), pts: [corner(1, -1, -1), corner(1, 1, -1), corner(-1, 1, -1), corner(-1, -1, -1)], tone: T.pack.shade },
    { n: v3(up.x, up.y, 0), pts: [corner(1, -1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(1, -1, 1)], tone: T.pack.light },
  ];
  for (const f of faces) {
    if (rig.facing(f.n.x, f.n.y, f.n.z) <= 0) continue;
    ctx.beginPath();
    polyPath(ctx, f.pts);
    ctx.fillStyle = f.tone;
    ctx.fill();
    ctx.strokeStyle = T.pack.line;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  // Flap
  const flap = [corner(1.02, -1.05, -1.02), corner(1.02, -1.05, 1.02), corner(0.45, -1.05, 1.02), corner(0.45, -1.05, -1.02)];
  if (rig.facing(-fw.x, -fw.y, 0) > 0) cel(ctx, () => polyPath(ctx, flap), LEATHER, { band: 0.4 });
  // Bedroll across the top
  const a = rig.pt(ctr.x + up.x * (H + 1.6), ctr.y + up.y * (H + 1.6), -W - 0.6);
  const b = rig.pt(ctr.x + up.x * (H + 1.6), ctr.y + up.y * (H + 1.6), W + 0.6);
  cel(ctx, () => capsulePath(ctx, a, b, 1.9, 1.9), BEDROLL, { band: 0.6 });
  strokeLine(ctx, [lerpV(a, b, 0.3), vec(lerpV(a, b, 0.3).x, lerpV(a, b, 0.3).y + 0.1)], LEATHER.base, 1.9);
  strokeLine(ctx, [lerpV(a, b, 0.72), vec(lerpV(a, b, 0.72).x, lerpV(a, b, 0.72).y + 0.1)], LEATHER.base, 1.9);
}

// ── Head ────────────────────────────────────────────────────────────────

const HEAD_RINGS: Ring[] = [
  { h: 7.6, a: 1.3, b: 1.2 },
  { h: 6.4, a: 4.4, b: 4, f: -0.3 },
  { h: 3.6, a: 6.2, b: 5.5, f: -0.2 },
  { h: 0.4, a: 6.6, b: 5.8 },
  { h: -2.6, a: 6.1, b: 5.3, f: 0.4 },
  { h: -4.8, a: 4.6, b: 4.2, f: 0.9 },
  { h: -6.3, a: 2.3, b: 2.2, f: 1.5 },
];

/** Surface of the head (optionally lifted off it). */
interface HeadSurf {
  H: Section;
  p3(h: number, phi: number, lift?: number): V3;
  at(h: number, phi: number, lift?: number): V;
  vis(phi: number): number;
}

function headSurf(H: Section): HeadSurf {
  const p3 = (h: number, phi: number, lift = 0): V3 => {
    const r = ringAt(HEAD_RINGS, h);
    return H.p3(h, phi, r.a + lift, r.b + lift, r.f ?? 0);
  };
  return { H, p3, at: (h, phi, lift = 0) => H.rig.p(p3(h, phi, lift)), vis: phi => H.vis(phi) };
}

function lift(rings: readonly Ring[], d: number, top = d): Ring[] {
  return rings.map((r, i) => ({ ...r, h: i === 0 ? r.h + top : r.h, a: r.a + d, b: r.b + d }));
}

/** Hairline (h, φ) from the far temple round the brow and ear to the nape. */
const HAIRLINE: [number, number][] = [
  [2.2, -1.1], [2.8, -0.7], [3.4, -0.25], [3.6, 0.25], [3.3, 0.7], [2.6, 1.05], [1.6, 1.3],
  [-0.9, 1.36], [-0.9, 1.5], [1.4, 1.58], [1.4, 1.92], [-2.4, 2.05], [-4.6, 2.4], [-5, 3],
];

/** Clip to everything above the hairline (in screen space). */
function clipAboveHairline(ctx: CanvasRenderingContext2D, F: HeadSurf, line: [number, number][]): void {
  const pts = line.map(([h, phi]) => F.at(h, phi));
  const first = pts[0];
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.moveTo(first.x + 40, first.y);
  for (const q of pts) ctx.lineTo(q.x, q.y);
  ctx.lineTo(last.x - 40, last.y);
  ctx.lineTo(last.x - 40, last.y - 80);
  ctx.lineTo(first.x + 40, first.y - 80);
  ctx.closePath();
  ctx.clip();
}

function hairThickness(style: HairStyle): number {
  switch (style) {
    case 'wild': return 1.3;
    case 'long': return 0.85;
    case 'short': return 0.6;
    default: return 0.5;
  }
}

/** Hair that hangs behind the head and shoulders (drawn behind the torso). */
function viewHairBack(c: Ctx): void {
  const { ctx, sk, p, t, look, T } = c;
  if (!look.hair || !T.hair) return;
  const F = headSurf(sk.skull);
  const rig = sk.rig;
  const sway = Math.sin(t * Math.PI * 2) * 0.4 + p.flow * 1.5;
  switch (look.hair.style) {
    case 'long': {
      const tl = F.p3(0.5, 2.3, 0.9);
      const tr = F.p3(0.5, -0.9, 0.9);
      const back = F.p3(0, Math.PI, 0.9);
      const hang = 13;
      const pts = [
        rig.p(tl),
        rig.p(back),
        rig.p(tr),
        rig.pt(tr.x - 1.2 - sway, tr.y + hang - 2, tr.z - 0.5),
        rig.pt(back.x - 2 - sway, back.y + hang + 1, back.z),
        rig.pt(tl.x - 1.2 - sway, tl.y + hang - 1, tl.z + 0.8),
      ];
      cel(ctx, () => blobPath(ctx, pts), T.hair, { band: 1 });
      break;
    }
    case 'ponytail':
    case 'braid': {
      const root = F.p3(1.2, Math.PI - 0.35, 0.6);
      const chain = clothChain(vec(root.x, root.y), look.hair.style === 'braid' ? 12 : 10, 5, 0.12 + p.flow * 0.6, 1, t * Math.PI * 2);
      const pts = chain.map((q, i) => rig.pt(q.x, q.y, root.z + i * 0.35));
      for (let i = 1; i < pts.length; i++) {
        const r = look.hair.style === 'braid' ? 1.6 - i * 0.08 : 2 - i * 0.22;
        cel(ctx, () => capsulePath(ctx, pts[i - 1], pts[i], r, r * 0.88), T.hair, { band: 0.4 });
      }
      const tie = pts[1];
      cel(ctx, () => ellipsePath(ctx, tie, 1.3, 1.3), LEATHER, { band: 0.3, stroke: 0.4 });
      break;
    }
    default:
      break;
  }
}

/** Hair cap on the head, clipped above the hairline. */
function viewHairTop(c: Ctx, F: HeadSurf): void {
  const { ctx, look, T, sk, p, t } = c;
  if (!look.hair || !T.hair) return;
  const style = look.hair.style;
  const H = F.H;
  if (style === 'bald') {
    // Horseshoe fringe round the back of the head
    const pts: V[] = [];
    for (let phi = 1.45; phi <= 3.2; phi += 0.25) pts.push(F.at(1.2, phi, 0.4));
    for (let phi = 3.2; phi >= 1.45; phi -= 0.25) pts.push(F.at(-2.6, phi, 0.4));
    ctx.save();
    ctx.globalAlpha = 0.9;
    cel(ctx, () => blobPath(ctx, pts), T.hair, { band: 0.5, stroke: 0.4 });
    ctx.restore();
    return;
  }
  const thick = hairThickness(style);
  const shell = H.loft(lift(HEAD_RINGS.slice(0, 6), thick, thick * 0.8), 28);
  if (style === 'bun') {
    const bun = F.at(5, Math.PI - 0.55, 2.4);
    cel(ctx, () => ellipsePath(ctx, bun, 3, 2.8), T.hair, { band: 0.8 });
  }
  ctx.save();
  clipAboveHairline(ctx, F, HAIRLINE);
  cel(ctx, () => midpointPath(ctx, shell), T.hair, { band: 1 });
  if (style === 'wild') {
    // Unkempt tufts round the crown
    const cx = H.axis(2.5);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 1.02 + i * 0.36 + Math.sin(i * 2.3) * 0.1;
      const r = 7.2 + (i % 2) * 0.6;
      const tip = vec(cx.x + Math.cos(a + 0.12) * (r + 1.9), cx.y + Math.sin(a + 0.12) * (r + 1.9));
      const b1 = vec(cx.x + Math.cos(a - 0.22) * (r - 1.2), cx.y + Math.sin(a - 0.22) * (r - 1.2));
      const b2 = vec(cx.x + Math.cos(a + 0.22) * (r - 1.2), cx.y + Math.sin(a + 0.22) * (r - 1.2));
      const m = vec(cx.x + Math.cos(a - 0.05) * (r + 0.6), cx.y + Math.sin(a - 0.05) * (r + 0.6));
      cel(ctx, () => blobPath(ctx, [b1, m, tip, b2]), T.hair, { band: 0.4, stroke: 0.4 });
    }
  }
  // Strands combed back from the brow
  for (const phi of [-0.2, 0.35, 0.9]) {
    const s = [F.at(3.5, phi, thick), F.at(5.6, phi + 0.35, thick), F.at(7, phi + 0.9, thick * 0.8)];
    if (F.vis(phi) > 0) strokeLine(ctx, s, T.hair.shade, 0.55);
  }
  ctx.restore();
  if (style === 'long') {
    // A lock falling in front of the near shoulder
    const sway = Math.sin(t * Math.PI * 2) * 0.3 + p.flow;
    const a = F.p3(1.2, 1.7, thick);
    const b = F.p3(1.4, 2.2, thick);
    const lock = [
      sk.rig.p(a),
      sk.rig.p(b),
      sk.rig.pt(b.x - 0.6 - sway, b.y + 10, b.z + 0.6),
      sk.rig.pt(a.x - sway, a.y + 11.5, a.z + 0.8),
    ];
    cel(ctx, () => blobPath(ctx, lock), T.hair, { band: 0.7 });
  }
}

function viewFace(c: Ctx, F: HeadSurf): void {
  const { ctx, look, T, p } = c;
  const H = F.H;
  const skull = H.loft(HEAD_RINGS, 28);
  cel(ctx, () => midpointPath(ctx, skull), T.skin, { band: 1.3 });
  // Near ear
  if (F.vis(1.62) > -0.1) {
    const e = F.at(-0.2, 1.62, 0.2);
    cel(ctx, () => ellipsePath(ctx, e, 1.2, 1.9), T.skin, { band: 0.5, stroke: 0.4 });
    ctx.strokeStyle = T.skin.shade;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.ellipse(e.x + 0.2, e.y, 0.6, 1.1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Cheek blush
  ctx.fillStyle = 'rgba(210,90,70,0.16)';
  for (const phi of [0.85, -0.3]) {
    if (F.vis(phi) > 0.1) {
      const q = F.at(-2, phi);
      ctx.beginPath();
      ctx.ellipse(q.x, q.y, 1.5 * Math.min(1, F.vis(phi) * 1.6), 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Eyes: near one full, far one foreshortened toward the cheek edge.
  const eye = look.eyes ?? 0x2a1c14;
  const glowing = look.eyes !== undefined && ((look.eyes >> 16) & 0xff) > 0x90;
  const eyeCss = `#${eye.toString(16).padStart(6, '0')}`;
  for (const phi of [0.6, -0.2]) {
    const v = F.vis(phi);
    if (v <= 0.02) continue;
    const sq = Math.max(0.45, Math.min(1, v * 1.35));
    const e = F.at(0.3, phi, 0.05);
    if (glowing) {
      ctx.fillStyle = eyeCss;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 1.2 * sq, 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,0.9)';
      ctx.fillRect(e.x - 0.3, e.y - 0.3, 0.6, 0.6);
    } else {
      ctx.fillStyle = '#fbf6ea';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 1.25 * sq, 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = eyeCss;
      ctx.beginPath();
      ctx.ellipse(e.x + 0.35 * sq, e.y + 0.05, 0.72 * sq, 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(e.x + 0.1, e.y - 0.45, 0.45, 0.45);
    }
    // Brow
    const b0 = F.at(2.1, phi + 0.3, 0.1);
    const b1 = F.at(2.3, phi - 0.28, 0.1);
    strokeLine(ctx, [b0, b1], T.hair?.shade ?? T.beard?.shade ?? T.skin.line, 0.75);
  }
  // Nose: a small wedge standing off the face
  const nb = F.at(-0.6, 0.25, 0.1);
  const nt = F.at(-1.9, 0.05, 1.1);
  const nl = F.at(-2.5, 0.3, 0.2);
  const nr = F.at(-2.2, 0.55, 0.2);
  cel(ctx, () => blobPath(ctx, [nb, nt, nl, nr]), T.skin, { band: 0.4, stroke: 0.4 });
  // Mouth
  const m0 = F.at(-3.4, 0.55);
  const m1 = F.at(-3.7 - p.fx * 0.5, 0.2);
  const m2 = F.at(-3.35, -0.12);
  ctx.strokeStyle = T.skin.line;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(m0.x, m0.y);
  ctx.quadraticCurveTo(m1.x, m1.y, m2.x, m2.y);
  ctx.stroke();
}

function viewSpecs(c: Ctx, F: HeadSurf): void {
  if (!c.look.specs) return;
  const { ctx } = c;
  ctx.strokeStyle = 'rgba(160,210,240,0.95)';
  ctx.lineWidth = 0.5;
  const lens: V[] = [];
  for (const phi of [0.6, -0.2]) {
    const v = F.vis(phi);
    if (v <= 0.02) continue;
    const e = F.at(0.3, phi, 0.5);
    lens.push(e);
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, 1.7 * Math.max(0.45, Math.min(1, v * 1.35)), 1.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (lens.length === 2) strokeLine(ctx, [F.at(0.4, 0.38, 0.7), F.at(0.4, 0.02, 0.7)], 'rgba(160,210,240,0.95)', 0.5);
  const arm = [F.at(0.5, 1, 0.4), F.at(0.6, 1.6, 0.3)];
  strokeLine(ctx, arm, 'rgba(160,210,240,0.95)', 0.5);
}

function viewBeard(c: Ctx, F: HeadSurf): void {
  const { ctx, look, T, p, t, sk } = c;
  if (!look.beard || !T.beard) return;
  const rig = sk.rig;
  const sway = Math.sin(t * Math.PI * 2 + 0.8) * 0.3 - p.flow;
  const hang = (h: number, phi: number, dy: number, lf = 0.6, dx = 0): V => {
    const q = F.p3(h, phi, lf);
    return rig.pt(q.x + dx + sway * (dy / 10), q.y + dy, q.z);
  };
  const style = look.beard.style;
  if (style === 'stubble') {
    const pts = [F.at(-0.6, 1.45), F.at(-3.8, 1.4), F.at(-6, 0.6), F.at(-6.3, -0.2), F.at(-3.8, -0.7), F.at(-2.8, -0.2), F.at(-2.7, 0.7)];
    ctx.fillStyle = 'rgba(40,30,30,0.28)';
    ctx.beginPath();
    blobPath(ctx, pts);
    ctx.fill();
    return;
  }
  const mustache = (): void => {
    const pts = [F.at(-2.3, 0.75, 0.5), F.at(-2.2, 0.25, 0.9), F.at(-2.4, -0.25, 0.6), F.at(-3.6, -0.45, 0.5), F.at(-3, 0.15, 0.9), F.at(-3.7, 0.85, 0.5)];
    cel(ctx, () => blobPath(ctx, pts), T.beard!, { band: 0.3, stroke: 0.4 });
  };
  if (style === 'mustache') {
    mustache();
    return;
  }
  const len = style === 'short' ? 0.8 : style === 'full' ? 3.4 : 9;
  const pts: V[] = [
    F.at(0.2, 1.48, 0.4),
    F.at(-3, 1.46, 0.6),
    hang(-4.8, 1.05, len * 0.45),
    hang(-5.6, 0.5, len * 0.85),
    hang(-6.2, 0.15, len),
    hang(-5.6, -0.3, len * 0.8),
    hang(-4.2, -0.72, len * 0.35),
    F.at(-2.6, -0.8, 0.5),
    F.at(-3.2, -0.2, 0.7),
    F.at(-3, 0.6, 0.7),
    F.at(-1.4, 1.15, 0.5),
  ];
  cel(ctx, () => blobPath(ctx, pts), T.beard, { band: 0.8, stroke: 0.45 });
  ctx.save();
  clipTo(ctx, pts);
  for (const phi of [0.9, 0.35, -0.2]) {
    strokeLine(ctx, [F.at(-4, phi, 0.7), hang(-5.4, phi * 0.8, len * 0.8)], T.beard.shade, 0.5);
  }
  ctx.restore();
  mustache();
  if (style === 'braided') {
    const tip = hang(-6.2, 0.15, len);
    const q = hang(-6.2, 0.15, len - 2.2);
    cel(ctx, () => capsulePath(ctx, q, vec(tip.x, tip.y + 2.6), 1.5, 1), T.beard, { band: 0.4, stroke: 0.4 });
    ctx.fillStyle = GOLD.base;
    ctx.fillRect(q.x - 1.3, q.y - 0.3, 2.6, 1.1);
    ctx.fillStyle = GOLD.light;
    ctx.fillRect(q.x - 1.1, q.y - 0.3, 1, 0.4);
  }
}

// ── Hats ────────────────────────────────────────────────────────────────

const HOOD_RINGS: Ring[] = [
  { h: 8.8, a: 1.6, b: 1.6, f: -0.8 },
  { h: 6.8, a: 5.8, b: 5.6, f: -0.6 },
  { h: 1.5, a: 7.6, b: 6.9, f: -0.3 },
  { h: -4.2, a: 7.1, b: 6.8 },
  { h: -7.6, a: 5.6, b: 6.8, f: -0.6 },
];

const COIF_RINGS: Ring[] = [
  { h: 8.2, a: 1.4, b: 1.4, f: -0.4 },
  { h: 6.6, a: 5.2, b: 4.9, f: -0.4 },
  { h: 1.5, a: 7.1, b: 6.4, f: -0.2 },
  { h: -4.2, a: 6.6, b: 6.1, f: 0.2 },
  { h: -7.8, a: 5.2, b: 6.4, f: -0.2 },
];

/** Hood / coif: a shell round the head with an oval face opening. */
function hoodOpening(F: HeadSurf, rings: readonly Ring[], wide: number): V[] {
  const open: V[] = [];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const h = Math.sin(a) * 5.4 - 0.9;
    const phi = 0.3 + Math.cos(a) * wide;
    const r = ringAt(rings, h);
    open.push(F.H.at(h, phi, r.a + 0.2, r.b + 0.2, r.f ?? 0));
  }
  return open;
}

function viewHooded(c: Ctx, F: HeadSurf, coif: boolean): void {
  const { ctx, T, look, p, t, sk } = c;
  const hat = T.hat!;
  const H = F.H;
  const rings = coif ? COIF_RINGS : HOOD_RINGS;
  if (!coif) {
    // Hood point hanging behind
    const sway = Math.sin(t * Math.PI * 2) * 0.5 + p.flow * 2.5;
    const tip = [
      H.at(3, Math.PI, 6.6, 6),
      H.at(-2, Math.PI, 8.2 + sway, 5.8),
      H.at(-7.6 - sway * 0.3, Math.PI, 11 + sway * 1.4, 0),
      H.at(-5, Math.PI - 0.5, 6.6, 6.4),
      H.at(-5, Math.PI + 0.5, 6.6, 6.4),
    ];
    cel(ctx, () => blobPath(ctx, tip), farTone(look.hat!.color), { band: 1.2 });
  }
  const shell = H.loft(rings, 28);
  cel(ctx, () => midpointPath(ctx, shell), hat, { band: 1.6 });
  const open = hoodOpening(F, rings, coif ? 1.1 : 1.05);
  ctx.save();
  clipTo(ctx, shell);
  ctx.fillStyle = coif ? hat.shade : '#1a1424';
  ctx.beginPath();
  midpointPath(ctx, open);
  ctx.fill();
  ctx.save();
  clipTo(ctx, open);
  viewFace(c, F);
  // Fringe of hair under the rim
  if (look.hair && T.hair && look.hair.style !== 'bald') {
    const fr = [F.at(3.6, -0.7, 0.4), F.at(4.4, 0.3, 0.6), F.at(3.6, 1.3, 0.4), F.at(2, 1.1, 0.4), F.at(2.8, 0.3, 0.5), F.at(2, -0.5, 0.4)];
    cel(ctx, () => blobPath(ctx, fr), T.hair, { band: 0.6, stroke: 0.4 });
  }
  if (!coif) {
    // Shadow the hood casts over the brow
    const brow: V[] = [];
    for (let phi = -0.8; phi <= 1.4; phi += 0.25) brow.push(F.at(3.4, phi, 0.2));
    strokeLine(ctx, brow, 'rgba(20,12,30,0.45)', 3);
  }
  ctx.restore();
  ctx.strokeStyle = (T.hatAccent ?? T.trim)?.base ?? hat.light;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  midpointPath(ctx, open);
  ctx.stroke();
  if (coif) {
    // Quilted seams
    ctx.strokeStyle = hat.shade;
    ctx.lineWidth = 0.45;
    for (const h of [5, 2.5]) {
      for (const run of H.visibleArcs(ringAt(rings, h), 0, Math.PI * 2, 24, 0)) strokeLine(ctx, run, hat.shade, 0.45);
    }
  }
  ctx.restore();
  viewBeard(c, F);
  viewSpecs(c, F);
  void sk;
}

function viewHat(c: Ctx, F: HeadSurf): void {
  const { ctx, look, T, p, t, sk } = c;
  if (!look.hat || !T.hat) return;
  const H = F.H;
  const hat = T.hat;
  const acc = T.hatAccent ?? GOLD;
  const ring = (h: number, a: number, b: number, f = 0): Ring => ({ h, a, b, f });
  switch (look.hat.kind) {
    case 'cap': {
      const dome = [ring(8.2, 1.6, 1.5), ring(6.9, 5.2, 4.8), ring(4.4, 6.9, 6.2), ring(2.6, 7.1, 6.4)];
      const sh = H.loft(dome, 28);
      cel(ctx, () => midpointPath(ctx, sh), hat, { band: 1.2 });
      ctx.save();
      clipTo(ctx, sh);
      for (const phi of [0.2, 1.4, -1]) {
        strokeLine(ctx, dome.map(r => H.at(r.h, phi, r.a, r.b, r.f ?? 0)), hat.shade, 0.5);
      }
      ctx.restore();
      // Visor jutting forward
      const visor: V[] = [];
      for (let i = 0; i <= 10; i++) {
        const phi = -1.25 + (2.5 * i) / 10;
        visor.push(H.at(2.6, phi, 7.1 + Math.cos(phi) * 3.6, 6.4 + Math.cos(phi) * 1.2));
      }
      for (let i = 10; i >= 0; i--) {
        const phi = -1.25 + (2.5 * i) / 10;
        visor.push(H.at(2.8, phi, 6.9, 6.2));
      }
      cel(ctx, () => polyPath(ctx, visor), hat, { band: 0.6 });
      if (look.hat.accent !== undefined) {
        // Miner's lamp on the brow
        const lamp = H.at(4.6, 0.25, 7.4, 6.6);
        cel(ctx, () => ellipsePath(ctx, lamp, 1.9, 1.9), METAL_DARK, { band: 0.4 });
        cel(ctx, () => ellipsePath(ctx, lamp, 1.2, 1.2), acc, { band: 0.2, stroke: 0.3 });
      }
      break;
    }
    case 'turban': {
      const wrap = [ring(9.6, 2.6, 2.4, -0.4), ring(8.8, 6.1, 5.5, -0.4), ring(5.4, 7.8, 7, -0.2), ring(2.2, 7.4, 6.7), ring(1.2, 7, 6.3)];
      const sh = H.loft(wrap, 28);
      cel(ctx, () => midpointPath(ctx, sh), hat, { band: 1.3 });
      ctx.save();
      clipTo(ctx, sh);
      // Diagonal wraps
      for (let i = 0; i < 3; i++) {
        const pts: V[] = [];
        for (let k = 0; k <= 20; k++) {
          const phi = -1.2 + (k / 20) * 3.6;
          const h = 3 + i * 2 + Math.sin(phi - 0.3) * 1.4;
          if (F.vis(phi) > -0.1) {
            const r = ringAt(wrap, h);
            pts.push(H.at(h, phi, r.a, r.b, r.f ?? 0));
          }
        }
        strokeLine(ctx, pts, hat.shade, 0.7);
      }
      ctx.restore();
      const jewel = H.at(4.6, 0.3, 7.9, 7.1);
      cel(ctx, () => ellipsePath(ctx, jewel, 1.5, 1.7), acc, { band: 0.3, stroke: 0.4 });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(jewel.x - 0.6, jewel.y - 0.8, 0.5, 0.5);
      break;
    }
    case 'widebrim': {
      const hb = 3.8;
      const brim: V[] = [];
      for (let i = 0; i < 28; i++) {
        const phi = (i / 28) * Math.PI * 2;
        brim.push(H.at(hb + 0.6 + Math.cos(phi) * 0.9, phi, 10.6, 9.8, -0.3));
      }
      cel(ctx, () => midpointPath(ctx, brim), hat, { band: 1 });
      const rim: V[] = [];
      for (let i = 0; i < 28; i++) {
        const phi = (i / 28) * Math.PI * 2;
        rim.push(H.at(hb + 0.6 + Math.cos(phi) * 0.9, phi, 9.6, 8.8, -0.3));
      }
      ctx.strokeStyle = hat.shade;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      midpointPath(ctx, rim);
      ctx.stroke();
      const crown = [ring(hb + 6.4, 3.6, 3.4, -0.3), ring(hb + 5.4, 5.2, 5, -0.3), ring(hb + 1, 6.4, 6, -0.3)];
      const sh = H.loft(crown, 28);
      cel(ctx, () => midpointPath(ctx, sh), hat, { band: 1 });
      ctx.save();
      clipTo(ctx, sh);
      for (const run of H.visibleArcs(ring(hb + 2, 6.3, 5.9, -0.3), 0, Math.PI * 2, 28, -0.3)) {
        strokeLine(ctx, run, acc.line, 2.1);
        strokeLine(ctx, run, acc.base, 1.5);
      }
      // Pinched crease on top
      strokeLine(ctx, [H.at(hb + 6, -0.6, 3.4, 3.2, -0.3), H.at(hb + 5.4, 0.5, 2, 2, -0.3), H.at(hb + 6, Math.PI - 0.4, 3.4, 3.2, -0.3)], hat.shade, 0.6);
      ctx.restore();
      break;
    }
    case 'helm': {
      const dome = [ring(8.8, 1.6, 1.5), ring(7.2, 5.6, 5.1), ring(3.6, 7.3, 6.6), ring(1.6, 7.4, 6.7)];
      if (look.hat.accent !== undefined && sk.rig.front) viewHelmCrest(c, F, acc, true);
      const sh = H.loft(dome, 28);
      cel(ctx, () => midpointPath(ctx, sh), hat, { band: 1.4, hi: 0.7 });
      ctx.save();
      clipTo(ctx, sh);
      strokeLine(ctx, dome.map(r => H.at(r.h, 0.1, r.a, r.b, r.f ?? 0)), hat.light, 0.8);
      ctx.restore();
      for (const run of H.visibleArcs(ring(2.2, 7.5, 6.8), 0, Math.PI * 2, 28, -0.2)) {
        strokeLine(ctx, run, hat.line, 2.2);
        strokeLine(ctx, run, hat.shade, 1.6);
      }
      // Rivets on the brow band
      ctx.fillStyle = hat.light;
      for (const phi of [-0.3, 0.3, 0.9, 1.5]) {
        if (F.vis(phi) > 0.1) {
          const q = H.at(2.2, phi, 7.6, 6.9);
          ctx.fillRect(q.x - 0.35, q.y - 0.35, 0.7, 0.7);
        }
      }
      // Nasal guard
      const n0 = H.at(2.4, 0.12, 7.6, 6.8);
      const n1 = F.at(-1.9, 0.08, 1.8);
      strokeLine(ctx, [n0, n1], hat.line, 1.7);
      strokeLine(ctx, [n0, n1], hat.base, 1.1);
      if (look.hat.accent !== undefined && !sk.rig.front) viewHelmCrest(c, F, acc, false);
      break;
    }
    case 'headband': {
      const band = ring(2.8, 6.95, 6.2, -0.1);
      for (const run of H.visibleArcs(band, 0, Math.PI * 2, 28, -0.2)) {
        strokeLine(ctx, run, hat.line, 2.4);
        strokeLine(ctx, run, hat.base, 1.8);
      }
      // Knot and tails at the back
      const knot = H.at(2.8, Math.PI - 0.5, 7, 6.3, -0.1);
      if (F.vis(Math.PI - 0.5) > -0.3) {
        const sway = Math.sin(t * Math.PI * 2) * 0.4 + p.flow * 2;
        const k3 = F.p3(2.8, Math.PI - 0.5, 0.4);
        for (const [dx, dy] of [[-2.6 - sway, 6], [-1 - sway * 0.6, 7.5]]) {
          const tip = sk.rig.pt(k3.x + dx, k3.y + dy, k3.z + 0.6);
          cel(ctx, () => capsulePath(ctx, knot, tip, 1, 0.7), hat, { band: 0.3, stroke: 0.4 });
        }
        cel(ctx, () => ellipsePath(ctx, knot, 1.3, 1.2), hat, { band: 0.3, stroke: 0.4 });
      }
      break;
    }
    case 'bandana': {
      const wrap = [ring(8.3, 1.8, 1.7), ring(7, 5.4, 5), ring(4.4, 7, 6.3), ring(2.6, 7.1, 6.4), ring(1, 7, 6.3)];
      const sh = H.loft(wrap, 28);
      cel(ctx, () => midpointPath(ctx, sh), hat, { band: 1.1 });
      ctx.save();
      clipTo(ctx, sh);
      for (const h of [5.2, 3.2]) {
        for (const run of H.visibleArcs(ringAt(wrap, h), 0, Math.PI * 2, 28, 0)) strokeLine(ctx, run, hat.shade, 0.6);
      }
      ctx.restore();
      // Tail of the wrap hanging behind the near ear
      const sway = Math.sin(t * Math.PI * 2) * 0.4 + p.flow * 2;
      const k3 = F.p3(2, Math.PI - 0.6, 1);
      const tail = [
        sk.rig.p(k3),
        sk.rig.p(F.p3(3.6, Math.PI - 0.9, 1)),
        sk.rig.pt(k3.x - 2 - sway, k3.y + 9, k3.z + 1.2),
        sk.rig.pt(k3.x - 0.4 - sway, k3.y + 10, k3.z + 0.2),
      ];
      cel(ctx, () => blobPath(ctx, tail), hat, { band: 0.6 });
      break;
    }
    case 'feathered': {
      const sway = Math.sin(t * Math.PI * 2) * 0.5 + p.flow * 1.5;
      const brim: V[] = [];
      for (let i = 0; i < 24; i++) {
        const phi = (i / 24) * Math.PI * 2;
        brim.push(H.at(2.8, phi, 8.4 + Math.cos(phi) * 0.8, 7.6, 0));
      }
      cel(ctx, () => midpointPath(ctx, brim), hat, { band: 0.7 });
      const crown = [ring(8.6, 2.2, 2, -0.3), ring(7.4, 5.4, 5, -0.2), ring(3, 6.8, 6.2)];
      const sh = H.loft(crown, 28);
      cel(ctx, () => midpointPath(ctx, sh), hat, { band: 1 });
      // Feather sweeping back from the near side
      const base = F.p3(4.6, 1.8, 1.4);
      const feather = [
        sk.rig.p(base),
        sk.rig.pt(base.x - 4.5 - sway, base.y - 3.6, base.z + 0.6),
        sk.rig.pt(base.x - 9.5 - sway * 1.4, base.y - 5, base.z + 1),
        sk.rig.pt(base.x - 6 - sway, base.y - 2, base.z + 1.2),
        sk.rig.pt(base.x - 2.2, base.y - 0.6, base.z + 0.8),
      ];
      cel(ctx, () => blobPath(ctx, feather), acc, { band: 0.6 });
      strokeLine(ctx, [feather[0], lerpV(feather[1], feather[3], 0.5), feather[2]], acc.shade, 0.5);
      break;
    }
    default:
      break;
  }
}

function viewHelmCrest(c: Ctx, F: HeadSurf, acc: Tone, behind: boolean): void {
  const { ctx, p, t } = c;
  const H = F.H;
  const sway = Math.sin(t * Math.PI * 2) * 0.6 + p.flow * 2.5;
  const src = [
    vec(-1, -7.8), vec(2, -9.6), vec(-3, -10.6 - sway * 0.2), vec(-8.5 - sway, -8.6),
    vec(-11.5 - sway * 1.3, -4 + sway * 0.3), vec(-8 - sway, -5.4), vec(-4, -6.4),
  ];
  const pts = src.map(q => H.at(-q.y * 1.05, 0, 0, 0, q.x * 1.05));
  cel(ctx, () => blobPath(ctx, pts), acc, { band: behind ? 0.9 : 1.1 });
}

function viewHead(c: Ctx): void {
  const F = headSurf(c.sk.skull);
  const kind = c.look.hat?.kind;
  if (kind === 'hood' || kind === 'coif') {
    viewHooded(c, F, kind === 'coif');
    return;
  }
  viewFace(c, F);
  viewBeard(c, F);
  viewHairTop(c, F);
  viewSpecs(c, F);
  viewHat(c, F);
}

// ── Props ───────────────────────────────────────────────────────────────

/** Props that hang plumb from the hand rather than following its angle. */
const HANGING: ReadonlySet<Prop> = new Set<Prop>(['lantern', 'pouch', 'key']);

/** Long props held upright that lean out to the side, clear of the face. */
export const UPRIGHT_PROPS: ReadonlySet<Prop> = new Set<Prop>(['staff', 'crutch', 'spear']);

/** Sideways tilt of a held prop in the 3/4 view. */
function propLat(prop: Prop): number {
  return UPRIGHT_PROPS.has(prop) ? 0.3 : 0;
}

/**
 * Paint a prop in its own flat frame: origin at the grip, local −y along the
 * item. Callers orient it (inItem for the 3/4 view).
 */
export function drawProp(ctx: CanvasRenderingContext2D, prop: Prop, at: V, angle: number, t: number, fx: number): void {
  if (prop === 'none') return;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  switch (prop) {
    case 'hammer':
      cel(ctx, () => polyPath(ctx, [vec(-0.8, 4), vec(0.8, 4), vec(0.8, -11), vec(-0.8, -11)]), WOOD, { band: 0.3 });
      cel(ctx, () => polyPath(ctx, [vec(-4.2, -14.6), vec(3.4, -14.6), vec(3.4, -10), vec(-4.2, -10)]), METAL, { band: 0.7, hi: 0.4 });
      break;
    case 'tongs':
      ctx.strokeStyle = METAL_DARK.line;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-0.4, 2);
      ctx.lineTo(-1.2, -12);
      ctx.moveTo(0.4, 2);
      ctx.lineTo(1.2, -12);
      ctx.stroke();
      ctx.strokeStyle = METAL.base;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      break;
    case 'staff':
      // Long enough to reach the ground from a chest-high grip.
      cel(ctx, () => polyPath(ctx, [vec(-0.9, 26), vec(0.9, 26), vec(0.8, -22), vec(-0.8, -22)]), WOOD, { band: 0.3 });
      cel(ctx, () => ellipsePath(ctx, vec(0, -23.6), 2.2, 2.2), tone(0x7fd6a0, { light: 0.5 }), { band: 0.6 });
      break;
    case 'crutch':
      cel(ctx, () => polyPath(ctx, [vec(-0.9, 16), vec(0.9, 16), vec(0.8, -18), vec(-0.8, -18)]), WOOD, { band: 0.3 });
      cel(ctx, () => polyPath(ctx, [vec(-3.4, -19), vec(3.4, -19), vec(3.4, -17.4), vec(-3.4, -17.4)]), WOOD, { band: 0.3 });
      break;
    case 'spear':
      cel(ctx, () => polyPath(ctx, [vec(-0.7, 12), vec(0.7, 12), vec(0.6, -20), vec(-0.6, -20)]), WOOD, { band: 0.3 });
      cel(ctx, () => polyPath(ctx, [vec(-1.8, -20), vec(0, -26), vec(1.8, -20), vec(0, -19)]), METAL, { band: 0.5 });
      break;
    case 'sword':
      cel(ctx, () => polyPath(ctx, [vec(-1.2, -2), vec(1.2, -2), vec(1, -17), vec(0, -19.5), vec(-1, -17)]), METAL, { band: 0.6, hi: 0.4 });
      cel(ctx, () => polyPath(ctx, [vec(-3.4, -2.4), vec(3.4, -2.4), vec(3.4, -0.8), vec(-3.4, -0.8)]), GOLD, { band: 0.3 });
      cel(ctx, () => polyPath(ctx, [vec(-0.8, -0.8), vec(0.8, -0.8), vec(0.8, 3), vec(-0.8, 3)]), LEATHER, { band: 0.2 });
      break;
    case 'dagger':
      cel(ctx, () => polyPath(ctx, [vec(-1, -1.6), vec(1, -1.6), vec(0.6, -9), vec(0, -10.4), vec(-0.6, -9)]), METAL, { band: 0.4 });
      cel(ctx, () => polyPath(ctx, [vec(-2.4, -2), vec(2.4, -2), vec(2.4, -0.8), vec(-2.4, -0.8)]), GOLD, { band: 0.2 });
      break;
    case 'mace':
      cel(ctx, () => polyPath(ctx, [vec(-0.8, 4), vec(0.8, 4), vec(0.8, -10), vec(-0.8, -10)]), WOOD, { band: 0.3 });
      cel(ctx, () => ellipsePath(ctx, vec(0, -12.4), 3, 3), METAL, { band: 0.7 });
      ctx.fillStyle = METAL_DARK.base;
      for (const [x, y] of [[-3.4, -12.4], [3.4, -12.4], [0, -15.8]]) ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
      break;
    case 'pickaxe':
      cel(ctx, () => polyPath(ctx, [vec(-0.8, 4), vec(0.8, 4), vec(0.8, -12), vec(-0.8, -12)]), WOOD, { band: 0.3 });
      cel(ctx, () => { ctx.moveTo(-7, -9.4); ctx.quadraticCurveTo(0, -15, 7, -9.4); ctx.lineTo(6, -8.6); ctx.quadraticCurveTo(0, -12.6, -6, -8.6); ctx.closePath(); }, METAL, { band: 0.5 });
      break;
    case 'bow':
      ctx.strokeStyle = WOOD.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-1, -14);
      ctx.quadraticCurveTo(5, 0, -1, 14);
      ctx.stroke();
      ctx.strokeStyle = WOOD.base;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(240,235,220,0.8)';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(-1, -14);
      ctx.lineTo(-1, 14);
      ctx.stroke();
      break;
    case 'shield':
      cel(ctx, () => ellipsePath(ctx, vec(1.5, -1), 6.6, 8.6), WOOD, { band: 1 });
      cel(ctx, () => ellipsePath(ctx, vec(1.5, -1), 2.4, 2.6), METAL, { band: 0.5, hi: 0.4 });
      break;
    case 'lantern':
      ctx.strokeStyle = METAL_DARK.base;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 2.6);
      ctx.stroke();
      cel(ctx, () => polyPath(ctx, [vec(-2.8, 2.6), vec(2.8, 2.6), vec(2.4, 9.8), vec(-2.4, 9.8)]), METAL_DARK, { band: 0.4 });
      ctx.fillStyle = `rgba(255,${200 + Math.round(Math.sin(t * 20) * 20)},110,0.95)`;
      ctx.fillRect(-1.7, 3.8, 3.4, 4.8);
      cel(ctx, () => polyPath(ctx, [vec(-3.2, 2.8), vec(0, 0.8), vec(3.2, 2.8)]), METAL_DARK, { band: 0.3, stroke: 0.4 });
      break;
    case 'pouch':
      cel(ctx, () => blobPath(ctx, [vec(-2.8, 0.6), vec(2.8, 0.6), vec(3.6, 5.6), vec(0, 7.2), vec(-3.6, 5.6)]), LEATHER, { band: 0.6 });
      ctx.fillStyle = GOLD.base;
      ctx.fillRect(-1.6, 0, 3.2, 1.2);
      break;
    case 'scroll':
    case 'ledger':
    case 'book':
      if (prop === 'scroll') {
        cel(ctx, () => polyPath(ctx, [vec(-1.8, -6), vec(1.8, -6), vec(1.8, 4), vec(-1.8, 4)]), PAPER, { band: 0.4 });
        cel(ctx, () => capsulePath(ctx, vec(-2.6, -6), vec(2.6, -6), 1, 1), WOOD, { band: 0.2 });
        cel(ctx, () => capsulePath(ctx, vec(-2.6, 4), vec(2.6, 4), 1, 1), WOOD, { band: 0.2 });
      } else {
        cel(ctx, () => polyPath(ctx, [vec(-3.6, -4.6), vec(3.6, -4.6), vec(3.6, 4.6), vec(-3.6, 4.6)]), prop === 'ledger' ? tone(0x6a3a26) : tone(0x3a4a7a), { band: 0.6 });
        ctx.fillStyle = PAPER.base;
        ctx.fillRect(2.8, -4, 0.8, 8);
        ctx.fillStyle = GOLD.base;
        ctx.fillRect(-2.4, -1, 4, 1);
      }
      break;
    case 'pipe':
      ctx.strokeStyle = WOOD.shade;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(4, -1.4);
      ctx.stroke();
      cel(ctx, () => polyPath(ctx, [vec(3.4, -3.6), vec(5.6, -3.6), vec(5.3, -0.6), vec(3.6, -0.6)]), WOOD, { band: 0.3 });
      break;
    case 'key':
      ctx.strokeStyle = GOLD.line;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 1.8, 1.5, 0, Math.PI * 2);
      ctx.moveTo(0, 3.3);
      ctx.lineTo(0, 8);
      ctx.lineTo(1.5, 8);
      ctx.stroke();
      ctx.strokeStyle = GOLD.base;
      ctx.lineWidth = 0.9;
      ctx.stroke();
      break;
    case 'wand':
      cel(ctx, () => polyPath(ctx, [vec(-0.5, 2), vec(0.5, 2), vec(0.4, -10), vec(-0.4, -10)]), WOOD, { band: 0.2 });
      ctx.fillStyle = `rgba(190,160,255,${0.7 + fx * 0.3})`;
      ctx.beginPath();
      ctx.arc(0, -11, 1.2 + fx, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}

/** Paint a held prop in the 3/4 view. */
function viewProp(c: Ctx, prop: Prop, near: boolean): void {
  if (prop === 'none' || prop === 'shield') return;
  const { ctx, sk, p, t } = c;
  const at = near ? sk.handN : sk.handF;
  const angle = near ? p.wpn : p.off;
  if (HANGING.has(prop)) {
    drawProp(ctx, prop, at, 0, t, p.fx);
    return;
  }
  inItem(ctx, sk.rig, at, angle, () => drawProp(ctx, prop, vec(0, 0), 0, t, p.fx), propLat(prop) * (near ? 1 : -1));
}

/**
 * Screen tip of a held prop `len` units from the grip (for glows); a staff's
 * orb is `STAFF_ORB` from the grip.
 */
export const STAFF_ORB = 23.6;

export function propTip(sk: ViewSkeleton, angle: number, len: number, near = true, prop: Prop = 'none'): V {
  const at = near ? sk.handN : sk.handF;
  const { ang, k } = sk.rig.dir(angle, propLat(prop) * (near ? 1 : -1));
  const kk = Math.max(0.35, k);
  return vec(at.x + Math.sin(ang) * len * kk, at.y - Math.cos(ang) * len * kk);
}

/** Round shield on the off arm, facing forward and turned in a little. */
const SHIELD_TURN = 0.35;

function shieldFrame(sk: ViewSkeleton, p: HumanPose): { at: (x: number, y: number) => V; faceUp: boolean } {
  const n = v3(Math.cos(SHIELD_TURN), 0, Math.sin(SHIELD_TURN));
  const w = v3(Math.sin(SHIELD_TURN), 0, -Math.cos(SHIELD_TURN));
  const h = sk.j.handF;
  const cc = v3(h.x + 1.6 + n.x, h.y + 1, h.z + n.z);
  const co = Math.cos(p.off * 0.3);
  const si = Math.sin(p.off * 0.3);
  const at = (x: number, y: number): V => {
    const rx = x * co - y * si;
    const ry = x * si + y * co;
    return sk.rig.pt(cc.x + w.x * rx, cc.y + ry, cc.z + w.z * rx);
  };
  return { at, faceUp: sk.rig.facing(n.x, n.y, n.z) > 0 };
}

function viewShield(c: Ctx): void {
  const { ctx, sk, p } = c;
  const { at, faceUp } = shieldFrame(sk, p);
  const rim: V[] = [];
  const inner: V[] = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    rim.push(at(Math.cos(a) * 7.4, Math.sin(a) * 7.4));
    inner.push(at(Math.cos(a) * 6.3, Math.sin(a) * 6.3));
  }
  cel(ctx, () => midpointPath(ctx, rim), METAL_DARK, { band: 0.8 });
  cel(ctx, () => midpointPath(ctx, inner), faceUp ? WOOD : tone(0x5a3c22), { band: 1.2 });
  ctx.save();
  clipTo(ctx, inner);
  for (const x of [-3, 0, 3]) strokeLine(ctx, [at(x, -7), at(x, 7)], WOOD.shade, 0.5);
  ctx.restore();
  if (faceUp) {
    const boss: V[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      boss.push(at(Math.cos(a) * 2.4, Math.sin(a) * 2.4));
    }
    cel(ctx, () => midpointPath(ctx, boss), METAL, { band: 0.5, hi: 0.4 });
  }
}

// ── Skin factory ───────────────────────────────────────────────────────

/** The NPC skin: parts of the figure sorted by depth each frame. */
export function folkSkin(look: FolkLook): HumanViewSkin {
  const T = tones(look);
  const b = BUILDS[look.build ?? 'normal'];
  const g = b.girth;
  const item = look.item ?? 'none';
  const off = look.offItem ?? 'none';
  return {
    prop: b.prop,
    build: b.view,
    parts(ctx, sk, p, t): ViewPart[] {
      const c: Ctx = { ctx, sk, p, t, look, T, g, b };
      const d0 = sk.d.pelvis;
      const S = sk.torso;
      const armZ = (near: boolean): number => (near
        ? sk.d.elN * 0.6 + sk.d.handN * 0.4
        : sk.d.elF * 0.6 + sk.d.handF * 0.4) - d0;
      const legZ = (near: boolean): number => -0.6 + 0.02 * ((near ? sk.d.kneeN + sk.d.footN : sk.d.kneeF + sk.d.footF) / 2 - d0);
      const backZ = S.depth(sk.torsoLen * 0.6, Math.PI, 4 * g, 0) - d0;
      const headZ = Math.max(sk.d.head - d0 + 2.5, 0.3);
      const shieldZ = Math.max(armZ(false) + 0.05, sk.d.handF - d0 + 1.5);
      const parts: ViewPart[] = [
        { z: backZ - 0.2, draw: () => viewCape(c) },
        { z: backZ - 0.1, draw: () => viewPack(c) },
        { z: backZ, draw: () => viewHairBack(c) },
        { z: legZ(true), draw: () => viewLeg(c, true) },
        { z: legZ(false), draw: () => viewLeg(c, false) },
        { z: 0, draw: () => { viewSkirt(c); viewTorso(c); } },
        { z: armZ(false), draw: () => { viewProp(c, off, false); viewArm(c, false); viewHand(c, false); } },
        { z: headZ, draw: () => viewHead(c) },
        { z: armZ(true), draw: () => viewArm(c, true) },
        { z: Math.max(armZ(true), sk.d.handN - d0) + 0.02, draw: () => { viewProp(c, item, true); viewHand(c, true); } },
      ];
      if (off === 'shield') parts.push({ z: shieldZ, draw: () => viewShield(c) });
      return parts;
    },
  };
}
