/**
 * Parametric human "townsfolk" skin for NPCs on the humanoid rig.
 *
 * An NPC is described by a FolkLook (skin tone, hair, beard, hat, clothing
 * layers, build, held props) and turned into a HumanSkin, so every NPC
 * shares the heroes' cel-shaded, ink-outlined style while staying cheap to
 * author and easy to vary.
 */
import {
  blobPath,
  capsulePath,
  cel,
  clothChain,
  ellipsePath,
  inBone,
  lerpV,
  limb,
  polyPath,
  tone,
  vec,
  type Tone,
  type V,
} from './Rig';
import type { HumanPose, HumanSkin, Proportions, Skeleton } from './Humanoid';

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
  eyes?: number;
  item?: Prop;
  offItem?: Prop;
}

const BUILDS: Record<Build, { prop: Proportions; girth: number }> = {
  slim: {
    prop: { thigh: 12, shin: 12, upperArm: 9.5, foreArm: 9, torso: 16, neck: 7.2, ankle: 2.1, hipN: vec(1.6, 0), hipF: vec(-2, -0.4), shN: vec(1, 3.6), shF: vec(-3.8, 3) },
    girth: 0.88,
  },
  normal: {
    prop: { thigh: 12, shin: 11.5, upperArm: 9.5, foreArm: 9, torso: 16.5, neck: 7.2, ankle: 2.2, hipN: vec(1.9, 0), hipF: vec(-2.3, -0.4), shN: vec(1.2, 3.8), shF: vec(-4.2, 3.2) },
    girth: 1,
  },
  stout: {
    prop: { thigh: 11.5, shin: 11, upperArm: 9.5, foreArm: 9, torso: 16.5, neck: 7, ankle: 2.2, hipN: vec(2.2, 0), hipF: vec(-2.6, -0.4), shN: vec(1.4, 4), shF: vec(-4.8, 3.4) },
    girth: 1.2,
  },
  dwarf: {
    prop: { thigh: 8.5, shin: 8, upperArm: 8.5, foreArm: 8, torso: 15, neck: 6.8, ankle: 2, hipN: vec(2.2, 0), hipF: vec(-2.6, -0.4), shN: vec(1.4, 3.8), shF: vec(-4.8, 3.2) },
    girth: 1.25,
  },
};

const METAL = tone(0x9aa3b2, { light: 0.5 });
const METAL_DARK = tone(0x5a606e);
const WOOD = tone(0x7a5230, { light: 0.3 });
const PAPER = tone(0xefe3c2, { light: 0.4, shadow: 0.25 });
const GOLD = tone(0xd9a640, { light: 0.5 });
const LEATHER = tone(0x6a4228);

interface FolkTones {
  skin: Tone; skinFar: Tone;
  top: Tone; topFar: Tone;
  sleeve: Tone; sleeveFar: Tone;
  legs: Tone; legsFar: Tone;
  boots: Tone; bootsFar: Tone;
  hair?: Tone; beard?: Tone; hat?: Tone; hatAccent?: Tone;
  trim?: Tone; apron?: Tone; belt: Tone; cape?: Tone; mantle?: Tone; armor?: Tone; pack?: Tone;
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
    hat: look.hat ? tone(look.hat.color) : undefined,
    hatAccent: look.hat?.accent !== undefined ? tone(look.hat.accent, { light: 0.45 }) : undefined,
    trim: look.top.trim !== undefined ? tone(look.top.trim, { light: 0.45 }) : undefined,
    apron: look.apron !== undefined ? tone(look.apron) : undefined,
    belt: tone(look.belt ?? 0x4a2f1c),
    cape: look.cape !== undefined ? tone(look.cape) : undefined,
    mantle: look.mantle !== undefined ? tone(look.mantle, { light: 0.35 }) : undefined,
    armor: look.armor !== undefined ? tone(look.armor, { light: 0.5 }) : undefined,
    pack: look.pack !== undefined ? tone(look.pack) : undefined,
  };
}

// ── Body parts ──────────────────────────────────────────────────────────

function leg(ctx: CanvasRenderingContext2D, hip: V, knee: V, ankle: V, sole: V, far: boolean, T: FolkTones, g: number): void {
  limb(ctx, hip, knee, 3.4 * g, 2.8 * g, far ? T.legsFar : T.legs);
  limb(ctx, knee, ankle, 2.8 * g, 2.3 * g, far ? T.legsFar : T.legs);
  cel(ctx, () => polyPath(ctx, [
    vec(ankle.x - 2.5 * g, ankle.y - 3), vec(ankle.x + 2 * g, ankle.y - 3),
    vec(sole.x + 5.2, sole.y - 1.4), vec(sole.x + 5.6, sole.y), vec(sole.x - 2.8, sole.y),
  ]), far ? T.bootsFar : T.boots, { band: 0.8 });
}

function arm(ctx: CanvasRenderingContext2D, sh: V, el: V, hand: V, far: boolean, T: FolkTones, g: number): void {
  limb(ctx, sh, el, 2.9 * g, 2.5 * g, far ? T.sleeveFar : T.sleeve);
  limb(ctx, el, lerpV(el, hand, 0.8), 2.5 * g, 2.3 * g, far ? T.sleeveFar : T.sleeve);
}

function hand(ctx: CanvasRenderingContext2D, at: V, far: boolean, T: FolkTones): void {
  cel(ctx, () => ellipsePath(ctx, at, 2.1, 2), far ? T.skinFar : T.skin, { band: 0.6, stroke: 0.4 });
}

function torso(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number, look: FolkLook, T: FolkTones, g: number): void {
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    const w = 6 * g;
    const body = [vec(-w, 0.6), vec(1, -0.6), vec(w + 0.4, 1.8), vec(w + 1.4 * g, len * 0.5), vec(w, len + 0.4), vec(-w + 0.6, len + 0.6), vec(-w - 0.6, len * 0.5)];
    cel(ctx, () => blobPath(ctx, body), T.top, { band: 1.5 });
    if (look.top.kind === 'vest') {
      // Shirt shows down the front under an open vest
      cel(ctx, () => polyPath(ctx, [vec(1.6, 0), vec(w - 0.6, 1), vec(w + 0.8, len - 1), vec(2.4, len - 1)]), T.sleeve, { band: 0.6 });
    }
    if (T.trim) {
      ctx.strokeStyle = T.trim.base;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(2.4, 0.2);
      ctx.quadraticCurveTo(3.4, len * 0.5, 2.6, len);
      ctx.stroke();
    }
    if (T.armor) {
      cel(ctx, () => blobPath(ctx, [vec(-w + 0.8, 2.2), vec(1.4, 0.8), vec(w + 0.2, 2.4), vec(w + 1, len * 0.5), vec(w - 0.6, len - 2), vec(-w + 1, len - 2)]), T.armor, { band: 1.2, hi: 0.6 });
      ctx.strokeStyle = T.armor.light;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(3.4, 2);
      ctx.quadraticCurveTo(5, len * 0.45, 3.6, len - 2.4);
      ctx.stroke();
    }
    // Belt
    cel(ctx, () => polyPath(ctx, [vec(-w + 0.2, len - 2.4), vec(w + 0.4, len - 2.6), vec(w + 0.6, len - 0.4), vec(-w + 0.2, len - 0.2)]), T.belt, { band: 0.4 });
    cel(ctx, () => polyPath(ctx, [vec(2.8, len - 2.9), vec(4.8, len - 2.9), vec(4.8, len), vec(2.8, len)]), GOLD, { band: 0.3 });
    if (T.apron) {
      cel(ctx, () => polyPath(ctx, [vec(0.2, 2.4), vec(w + 0.6, 2.6), vec(w + 2.4, len + 9), vec(1.6, len + 9.6)]), T.apron, { band: 1 });
      ctx.strokeStyle = T.apron.shade;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-2, 0.6);
      ctx.lineTo(0.6, 2.6);
      ctx.stroke();
    }
    if (T.mantle) {
      const m = [vec(-w - 1.6, 1.4), vec(-2, -2), vec(3, -1.8), vec(w + 1.4, 1.6), vec(w + 0.6, 5.4), vec(0, 6.4), vec(-w - 1, 5.6)];
      cel(ctx, () => blobPath(ctx, m), T.mantle, { band: 1 });
    }
    if (look.bandage) {
      ctx.fillStyle = 'rgba(240,236,224,0.95)';
      ctx.save();
      ctx.rotate(-0.35);
      ctx.fillRect(-w + 1, len * 0.45, w * 2 - 0.5, 2);
      ctx.fillStyle = 'rgba(170,30,30,0.8)';
      ctx.fillRect(1, len * 0.45 + 0.4, 1.8, 1.2);
      ctx.restore();
    }
  });
}

/** Long skirt for robes and coat tails, draped over the legs. */
function skirt(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number, look: FolkLook, T: FolkTones, g: number): void {
  if (look.top.kind !== 'robe' && look.top.kind !== 'coat') return;
  const waist = sk.pelvis;
  const long = look.top.kind === 'robe';
  const hemY = long ? Math.min(sk.soleN.y, sk.soleF.y) - 3.2 : (sk.kneeN.y + sk.kneeF.y) / 2 + 2;
  const back = Math.min(sk.footF.x, sk.kneeF.x, sk.kneeN.x) - (long ? 4.6 : 3.4) - p.flow * 3;
  const front = Math.max(sk.footN.x, sk.kneeN.x, sk.kneeF.x) + (long ? 4.2 : 3);
  const wave = Math.sin(t * Math.PI * 4) * 0.5;
  const pts = [
    vec(waist.x - 5.8 * g, waist.y - 2), vec(waist.x + 5.8 * g, waist.y - 2),
    vec(front, hemY + wave * 0.4), vec((back + front) / 2, hemY + 1.4 - wave), vec(back, hemY - 0.6),
  ];
  cel(ctx, () => blobPath(ctx, pts), T.top, { band: 1.6 });
  if (T.trim) {
    ctx.strokeStyle = T.trim.base;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(back + 0.6, hemY - 0.4);
    ctx.quadraticCurveTo((back + front) / 2, hemY + 1.8, front - 0.4, hemY);
    ctx.stroke();
  }
}

function cape(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number, T: FolkTones): void {
  if (!T.cape) return;
  const anchor = vec(sk.neck.x - 3.4, sk.neck.y + 2);
  const chain = clothChain(anchor, Math.max(20, sk.soleF.y - anchor.y - 6), 6, p.flow + 0.05, 0.8, t * Math.PI * 2);
  const left: V[] = [];
  const right: V[] = [];
  chain.forEach((pt, i) => {
    const k = i / (chain.length - 1);
    left.push(vec(pt.x - (2.6 + k * 3.6), pt.y));
    right.push(vec(pt.x + (2.6 + k * 2.4), pt.y + k));
  });
  cel(ctx, () => blobPath(ctx, [...left, ...right.reverse()]), T.cape, { band: 1.3 });
}

function backpack(ctx: CanvasRenderingContext2D, sk: Skeleton, T: FolkTones): void {
  if (!T.pack) return;
  inBone(ctx, sk.neck, sk.pelvis, (len) => {
    cel(ctx, () => blobPath(ctx, [vec(-12, 1), vec(-6, -0.6), vec(-5, len * 0.8), vec(-11.6, len * 0.85)]), T.pack!, { band: 1 });
    cel(ctx, () => polyPath(ctx, [vec(-12.4, -1.2), vec(-5.6, -1.8), vec(-5.4, 1.4), vec(-12, 2)]), LEATHER, { band: 0.5 });
    // Bedroll on top
    cel(ctx, () => capsulePath(ctx, vec(-12.6, -2.6), vec(-5.2, -3.2), 1.8, 1.8), tone(0x8a6a4a), { band: 0.5 });
  });
}

// ── Head ────────────────────────────────────────────────────────────────

function hairBack(ctx: CanvasRenderingContext2D, look: FolkLook, T: FolkTones, p: HumanPose, t: number): void {
  if (!look.hair || !T.hair) return;
  const sway = Math.sin(t * Math.PI * 2) * 0.4 + p.flow * 1.5;
  switch (look.hair.style) {
    case 'long':
      cel(ctx, () => blobPath(ctx, [vec(-6.4, -3), vec(-1, -6.4), vec(-2, 4), vec(-4 - sway, 11), vec(-8 - sway, 9.6), vec(-7.4, 2)]), T.hair, { band: 1 });
      break;
    case 'ponytail':
    case 'braid': {
      const chain = clothChain(vec(-5.6, -1.6), 9, 4, 0.5 + p.flow, 1, t * Math.PI * 2);
      for (let i = 1; i < chain.length; i++) {
        const r = look.hair.style === 'braid' ? 1.5 : 1.8 - i * 0.2;
        cel(ctx, () => capsulePath(ctx, chain[i - 1], chain[i], r, r * 0.85), T.hair!, { band: 0.4 });
      }
      break;
    }
    case 'bun':
      cel(ctx, () => ellipsePath(ctx, vec(-5.4, -5.2), 2.6, 2.4), T.hair, { band: 0.6 });
      break;
    default:
      break;
  }
}

function hairTop(ctx: CanvasRenderingContext2D, look: FolkLook, T: FolkTones): void {
  if (!look.hair || !T.hair || look.hair.style === 'bald') return;
  const wild = look.hair.style === 'wild';
  const cap = wild
    ? [vec(-6.8, -1), vec(-7.6, -6), vec(-4, -9.2), vec(0.4, -10), vec(4.8, -8.6), vec(7, -4.4), vec(5, -5.4), vec(2, -4.6), vec(-2.4, -3.6), vec(-4.6, 0.8)]
    : [vec(-6.4, -0.6), vec(-6.2, -5.6), vec(-1.6, -8.4), vec(3.8, -7.8), vec(6.6, -4.4), vec(3.4, -4.6), vec(-1.2, -3.8), vec(-3.8, 0.8)];
  cel(ctx, () => blobPath(ctx, cap), T.hair, { band: 1 });
}

function beard(ctx: CanvasRenderingContext2D, look: FolkLook, T: FolkTones, p: HumanPose, t: number): void {
  if (!look.beard || !T.beard) return;
  const sway = Math.sin(t * Math.PI * 2 + 0.8) * 0.3 - p.flow * 1;
  switch (look.beard.style) {
    case 'stubble':
      ctx.fillStyle = 'rgba(40,30,30,0.28)';
      ctx.beginPath();
      blobPath(ctx, [vec(0.8, 2), vec(6.6, 2.4), vec(6.4, 5.2), vec(2, 6.2)]);
      ctx.fill();
      break;
    case 'mustache':
      cel(ctx, () => blobPath(ctx, [vec(3.4, 2.6), vec(7.6, 2.4), vec(8.2, 3.6), vec(5.2, 3.4), vec(3.2, 4)]), T.beard, { band: 0.3, stroke: 0.35 });
      break;
    case 'short':
      cel(ctx, () => blobPath(ctx, [vec(0.4, 1.4), vec(3.6, 2.8), vec(7.4, 2.6), vec(6.6, 6.2), vec(3.2, 7.4), vec(0.4, 5)]), T.beard, { band: 0.6, stroke: 0.4 });
      break;
    case 'full':
      cel(ctx, () => blobPath(ctx, [vec(-0.6, 0.6), vec(3.6, 2.6), vec(7.8, 2.4), vec(7, 7.6), vec(3.8 + sway, 10.4), vec(0.4, 7.4)]), T.beard, { band: 0.8, stroke: 0.45 });
      break;
    case 'long':
    case 'braided': {
      cel(ctx, () => blobPath(ctx, [vec(-0.6, 0.6), vec(3.6, 2.6), vec(7.8, 2.4), vec(7, 8), vec(4.6 + sway, 14.4), vec(2.4 + sway, 12), vec(0.4, 7.4)]), T.beard, { band: 0.8, stroke: 0.45 });
      if (look.beard.style === 'braided') {
        ctx.fillStyle = GOLD.base;
        ctx.fillRect(3.4 + sway, 10, 2.2, 1);
      }
      break;
    }
  }
}

function hat(ctx: CanvasRenderingContext2D, look: FolkLook, T: FolkTones, p: HumanPose, t: number): void {
  if (!look.hat || !T.hat) return;
  const acc = T.hatAccent ?? GOLD;
  switch (look.hat.kind) {
    case 'hood': {
      const sway = Math.sin(t * Math.PI * 2) * 0.4 + p.flow * 2;
      cel(ctx, () => blobPath(ctx, [vec(-6.8, 2.4), vec(-7.2, -3.4), vec(-3.4, -8.2), vec(2, -8.8), vec(6.4, -5.4), vec(7.2, -2.6), vec(4, -4.6), vec(0.4, -4.4), vec(-1.6, 0), vec(-1, 6.6), vec(-7.6 - sway, 6.8)]), T.hat, { band: 1.4 });
      break;
    }
    case 'cap':
      cel(ctx, () => blobPath(ctx, [vec(-6.2, -3.6), vec(-3.6, -8.6), vec(2.4, -9), vec(6.6, -5.6), vec(9.2, -4), vec(6.6, -3.4), vec(-5.6, -2.4)]), T.hat, { band: 1 });
      break;
    case 'turban':
      cel(ctx, () => blobPath(ctx, [vec(-6.8, -2.4), vec(-7, -7), vec(-2, -10.6), vec(4, -10), vec(7.4, -6), vec(6.8, -2.8), vec(0, -3.4)]), T.hat, { band: 1.2 });
      ctx.strokeStyle = T.hat.shade;
      ctx.lineWidth = 0.6;
      for (const y of [-5, -7.4]) {
        ctx.beginPath();
        ctx.moveTo(-6, y + 1);
        ctx.quadraticCurveTo(0, y - 1.4, 6.8, y + 0.6);
        ctx.stroke();
      }
      cel(ctx, () => ellipsePath(ctx, vec(4.8, -5.2), 1.3, 1.5), acc, { band: 0.3 });
      break;
    case 'widebrim':
      cel(ctx, () => blobPath(ctx, [vec(-5, -3.6), vec(-4, -9.6), vec(1.6, -11), vec(5.6, -8.8), vec(6, -3.8)]), T.hat, { band: 1 });
      cel(ctx, () => ellipsePath(ctx, vec(0.6, -3.6), 11.4, 2.2, -0.05), T.hat, { band: 0.8 });
      ctx.fillStyle = acc.base;
      ctx.fillRect(-4.6, -5.6, 10.6, 1.3);
      break;
    case 'helm':
      cel(ctx, () => blobPath(ctx, [vec(-6.4, -1), vec(-5.4, -7), vec(0.8, -9.4), vec(6.2, -7), vec(7.4, -2.4), vec(6.6, -1.4), vec(0, -2.8)]), METAL, { band: 1.2, hi: 0.6 });
      cel(ctx, () => polyPath(ctx, [vec(-6.8, -2.8), vec(7.6, -3), vec(7.6, -1.4), vec(-6.8, -1.2)]), METAL_DARK, { band: 0.3 });
      if (look.hat.accent !== undefined) {
        cel(ctx, () => blobPath(ctx, [vec(-1, -9), vec(1.6, -12.6), vec(-3.4, -13), vec(-8.6, -10.4), vec(-4, -9.4)]), acc, { band: 0.6 });
      }
      break;
    case 'headband':
      cel(ctx, () => polyPath(ctx, [vec(-6.4, -4.4), vec(6.6, -3.6), vec(6.6, -2), vec(-6.4, -2.8)]), T.hat, { band: 0.4 });
      cel(ctx, () => polyPath(ctx, [vec(-6.2, -3.6), vec(-10, -2), vec(-9.4, -0.4), vec(-6, -2.4)]), T.hat, { band: 0.4 });
      break;
    case 'bandana':
      cel(ctx, () => blobPath(ctx, [vec(-6.4, -2.6), vec(-5.4, -7.4), vec(0.6, -9), vec(6, -6.4), vec(6.8, -3.2)]), T.hat, { band: 0.9 });
      cel(ctx, () => polyPath(ctx, [vec(-6, -3.6), vec(-10.4, -1.2), vec(-9, 0.6), vec(-5.4, -2)]), T.hat, { band: 0.4 });
      break;
    case 'coif':
      cel(ctx, () => blobPath(ctx, [vec(-6.8, 5), vec(-7.2, -3.4), vec(-3, -8.4), vec(2.6, -8.8), vec(6.8, -4.6), vec(5.2, -3.2), vec(0.4, -3.2), vec(-0.8, 6.6)]), METAL_DARK, { band: 1 });
      break;
    case 'feathered':
      cel(ctx, () => blobPath(ctx, [vec(-6.4, -3), vec(-5, -8.4), vec(1.4, -9.8), vec(6.6, -7), vec(8.4, -3.8), vec(0, -3)]), T.hat, { band: 1 });
      cel(ctx, () => blobPath(ctx, [vec(-2, -8.6), vec(-7, -15), vec(-11.4, -14.4), vec(-4.6, -8.2)]), acc, { band: 0.6 });
      break;
  }
}

function head(ctx: CanvasRenderingContext2D, sk: Skeleton, p: HumanPose, t: number, look: FolkLook, T: FolkTones): void {
  ctx.save();
  ctx.translate(sk.head.x, sk.head.y);
  ctx.rotate(sk.headAng);
  hairBack(ctx, look, T, p, t);
  // Skull + jaw in 3/4 profile
  const skull = [vec(-6, -0.4), vec(-5.2, -5.6), vec(0.4, -7.6), vec(5.4, -5.4), vec(6.6, -1.2), vec(7.4, 1.4), vec(6.4, 4.6), vec(2.4, 6.4), vec(-2.6, 5.4)];
  cel(ctx, () => blobPath(ctx, skull), T.skin, { band: 1.3 });
  // Ear
  cel(ctx, () => ellipsePath(ctx, vec(-1.8, 0.8), 1.5, 2), T.skin, { band: 0.5, stroke: 0.4 });
  // Nose
  cel(ctx, () => polyPath(ctx, [vec(6.4, -0.8), vec(8.6, 1.8), vec(6.6, 2.4)]), T.skin, { band: 0.3, stroke: 0.4 });
  // Eyes
  const eye = look.eyes ?? 0x2a1c14;
  ctx.fillStyle = '#fbf6ea';
  ctx.beginPath();
  ctx.ellipse(3.6, -0.6, 1.3, 1.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `#${eye.toString(16).padStart(6, '0')}`;
  ctx.beginPath();
  ctx.ellipse(4, -0.5, 0.75, 0.9, 0, 0, Math.PI * 2);
  ctx.ellipse(6.4, -0.4, 0.45, 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(3.8, -1, 0.5, 0.5);
  // Brows
  ctx.strokeStyle = T.hair?.shade ?? T.skin.line;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(2.2, -2.2);
  ctx.lineTo(5, -2.4);
  ctx.moveTo(5.8, -2.3);
  ctx.lineTo(7, -2);
  ctx.stroke();
  // Mouth
  ctx.strokeStyle = T.skin.line;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(4.4, 3.6);
  ctx.quadraticCurveTo(5.4, 3.9 + p.fx * 0.6, 6.4, 3.4);
  ctx.stroke();
  // Cheek blush
  ctx.fillStyle = 'rgba(210,90,70,0.18)';
  ctx.beginPath();
  ctx.ellipse(2.8, 2, 1.4, 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  beard(ctx, look, T, p, t);
  hairTop(ctx, look, T);
  hat(ctx, look, T, p, t);
  ctx.restore();
}

// ── Props ───────────────────────────────────────────────────────────────

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
      ctx.strokeStyle = METAL_DARK.base;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-0.4, 2);
      ctx.lineTo(-1.2, -12);
      ctx.moveTo(0.4, 2);
      ctx.lineTo(1.2, -12);
      ctx.stroke();
      break;
    case 'staff':
    case 'crutch':
      cel(ctx, () => polyPath(ctx, [vec(-0.9, 16), vec(0.9, 16), vec(0.8, -18), vec(-0.8, -18)]), WOOD, { band: 0.3 });
      if (prop === 'staff') {
        cel(ctx, () => ellipsePath(ctx, vec(0, -19.6), 2.2, 2.2), tone(0x7fd6a0, { light: 0.5 }), { band: 0.6 });
      } else {
        cel(ctx, () => polyPath(ctx, [vec(-3.4, -19), vec(3.4, -19), vec(3.4, -17.4), vec(-3.4, -17.4)]), WOOD, { band: 0.3 });
      }
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
      ctx.strokeStyle = WOOD.base;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-1, -14);
      ctx.quadraticCurveTo(5, 0, -1, 14);
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
      ctx.strokeStyle = WOOD.shade;
      ctx.lineWidth = 0.5;
      for (const x of [-1.5, 1.5, 4.5]) {
        ctx.beginPath();
        ctx.moveTo(x, -8.8);
        ctx.lineTo(x, 6.8);
        ctx.stroke();
      }
      ctx.strokeStyle = METAL_DARK.base;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(1.5, -1, 6.1, 8.1, 0, 0, Math.PI * 2);
      ctx.stroke();
      cel(ctx, () => ellipsePath(ctx, vec(1.5, -1), 2.4, 2.6), METAL, { band: 0.5, hi: 0.4 });
      break;
    case 'lantern':
      ctx.strokeStyle = METAL_DARK.base;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 2.6);
      ctx.stroke();
      cel(ctx, () => polyPath(ctx, [vec(-2.6, 2.6), vec(2.6, 2.6), vec(2.2, 9.4), vec(-2.2, 9.4)]), METAL_DARK, { band: 0.4 });
      ctx.fillStyle = `rgba(255,${200 + Math.round(Math.sin(t * 20) * 20)},110,0.95)`;
      ctx.fillRect(-1.6, 3.8, 3.2, 4.4);
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
        cel(ctx, () => polyPath(ctx, [vec(-1.5, -6), vec(1.5, -6), vec(1.5, 4), vec(-1.5, 4)]), PAPER, { band: 0.4 });
        cel(ctx, () => capsulePath(ctx, vec(-2.4, -6), vec(2.4, -6), 1, 1), WOOD, { band: 0.2 });
        cel(ctx, () => capsulePath(ctx, vec(-2.4, 4), vec(2.4, 4), 1, 1), WOOD, { band: 0.2 });
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
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(4, -1.4);
      ctx.stroke();
      cel(ctx, () => polyPath(ctx, [vec(3.4, -3.4), vec(5.4, -3.4), vec(5.2, -0.6), vec(3.6, -0.6)]), WOOD, { band: 0.3 });
      break;
    case 'key':
      ctx.strokeStyle = GOLD.base;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(0, -1.6, 1.4, 0, Math.PI * 2);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(1.4, 5);
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

// ── Skin factory ───────────────────────────────────────────────────────

export function folkSkin(look: FolkLook): HumanSkin {
  const T = tones(look);
  const build = BUILDS[look.build ?? 'normal'];
  const g = build.girth;
  const item = look.item ?? 'none';
  const off = look.offItem ?? 'none';
  return {
    prop: build.prop,
    back(ctx, sk, p, t) {
      cape(ctx, sk, p, t, T);
      backpack(ctx, sk, T);
    },
    armFar(ctx, sk, p, t) {
      arm(ctx, sk.shF, sk.elF, sk.handF, true, T, g);
      if (off !== 'shield') drawProp(ctx, off, sk.handF, p.off, t, p.fx);
      hand(ctx, sk.handF, true, T);
    },
    legFar(ctx, sk) {
      leg(ctx, sk.hipF, sk.kneeF, sk.footF, sk.soleF, true, T, g);
    },
    legNear(ctx, sk, p, t) {
      leg(ctx, sk.hipN, sk.kneeN, sk.footN, sk.soleN, false, T, g);
      skirt(ctx, sk, p, t, look, T, g);
    },
    torso(ctx, sk, p, t) {
      torso(ctx, sk, p, t, look, T, g);
    },
    head(ctx, sk, p, t) {
      head(ctx, sk, p, t, look, T);
    },
    offFront(ctx, sk, p, t) {
      if (off === 'shield') drawProp(ctx, 'shield', vec(sk.handF.x + 2, sk.handF.y), p.off, t, p.fx);
    },
    armNear(ctx, sk) {
      arm(ctx, sk.shN, sk.elN, sk.handN, false, T, g);
    },
    weapon(ctx, sk, p, t) {
      drawProp(ctx, item, sk.handN, p.wpn, t, p.fx);
      hand(ctx, sk.handN, false, T);
    },
  };
}
