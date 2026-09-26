import Phaser from 'phaser';
import { AllClasses } from '../data/classes';
import { FxEngine, FX_DEPTH_AIR } from '../graphics/vfx/FxEngine';
import { FxKit, PAL, TILE_R, FLAT } from '../graphics/vfx/FxKit';
import { generateFxTextures } from '../graphics/vfx/FxTextures';

/** Chest height above the feet (world px) where most effects centre. */
const CH = 18;
/** Meteor fall time (ms) — see getProjectileTravelMs. */
const METEOR_FALL_MS = 300;
const AOE_CACHE = new Map<string, number>();

export class SkillEffectSystem {
  private scene: Phaser.Scene;
  private e: FxEngine;
  private fx: FxKit;
  /** Last aim direction (rad); used by skills that fire without a distinct target point. */
  private lastAim = Math.atan2(1, 2);

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.e = FxEngine.for(scene);
    this.fx = new FxKit(this.e);
  }

  // ── Generate particle textures (call from BootScene) ─────
  static generateTextures(scene: Phaser.Scene): void {
    generateFxTextures(scene);
  }

  // ── Generate 64×64 procedural skill icons ────────────────
  static generateSkillIcons(scene: Phaser.Scene): void {
    const S = 64; // icon size
    const C = S / 2; // center
    const g = scene.add.graphics();
    const P = Phaser.Geom.Point;

    const fillBg = (color: number, alpha = 0.35) => {
      g.clear();
      g.fillStyle(0x0c0c18, 1);
      g.fillRect(0, 0, S, S);
      g.fillStyle(color, alpha);
      g.fillRect(0, 0, S, S);
    };

    // ═══ WARRIOR ═══

    // slash — diagonal sword swing
    fillBg(0x663322);
    g.lineStyle(5, 0xcccccc, 0.9);
    g.beginPath(); g.moveTo(14, 8); g.lineTo(50, 56); g.strokePath();
    g.lineStyle(3, 0xffffff, 0.7);
    g.beginPath(); g.moveTo(14, 8); g.lineTo(50, 56); g.strokePath();
    g.fillStyle(0x8B4513, 1); g.fillRect(44, 48, 10, 6);
    g.fillStyle(0xddaa44, 0.8); g.fillRect(38, 46, 8, 3);
    // swing arc
    g.lineStyle(2, 0xffdd88, 0.5);
    g.beginPath();
    g.arc(32, 32, 24, Phaser.Math.DegToRad(-120), Phaser.Math.DegToRad(-30), false);
    g.strokePath();
    g.generateTexture('skill_icon_slash', S, S);

    // whirlwind — spinning blades circle
    fillBg(0x553311);
    for (let a = 0; a < 360; a += 60) {
      const rad = Phaser.Math.DegToRad(a);
      const x1 = C + Math.cos(rad) * 8, y1 = C + Math.sin(rad) * 8;
      const x2 = C + Math.cos(rad) * 26, y2 = C + Math.sin(rad) * 26;
      g.lineStyle(3, 0xccccdd, 0.8);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath();
    }
    g.lineStyle(2, 0xaabbcc, 0.4);
    g.strokeCircle(C, C, 22);
    g.lineStyle(1, 0xffffff, 0.3);
    g.strokeCircle(C, C, 16);
    g.fillStyle(0xffffff, 0.15);
    g.fillCircle(C, C, 6);
    g.generateTexture('skill_icon_whirlwind', S, S);

    // war_stomp — ground impact shockwave
    fillBg(0x664422);
    g.fillStyle(0x886644, 0.8);
    g.fillTriangle(C, 12, C - 14, 44, C + 14, 44); // boot/foot
    g.fillStyle(0xaa8866, 0.6);
    g.fillTriangle(C, 16, C - 10, 40, C + 10, 40);
    // shockwave rings
    g.lineStyle(2, 0xffcc44, 0.7);
    g.strokeCircle(C, 48, 12);
    g.lineStyle(1.5, 0xffcc44, 0.4);
    g.strokeCircle(C, 48, 20);
    g.lineStyle(1, 0xffcc44, 0.2);
    g.strokeCircle(C, 48, 28);
    // cracks
    g.lineStyle(1.5, 0xddaa33, 0.6);
    g.beginPath(); g.moveTo(C, 48); g.lineTo(C - 18, 58); g.strokePath();
    g.beginPath(); g.moveTo(C, 48); g.lineTo(C + 16, 60); g.strokePath();
    g.beginPath(); g.moveTo(C, 48); g.lineTo(C - 8, 62); g.strokePath();
    g.generateTexture('skill_icon_war_stomp', S, S);

    // shield_wall — a sturdy shield
    fillBg(0x223366);
    // Shield shape
    g.fillStyle(0x556688, 0.9);
    g.fillPoints([
      new P(C, 8), new P(C + 20, 14), new P(C + 18, 42), new P(C, 56),
      new P(C - 18, 42), new P(C - 20, 14),
    ], true);
    g.fillStyle(0x6688aa, 0.7);
    g.fillPoints([
      new P(C, 12), new P(C + 16, 17), new P(C + 14, 39), new P(C, 51),
      new P(C - 14, 39), new P(C - 16, 17),
    ], true);
    // Cross emblem
    g.fillStyle(0xddcc88, 0.8);
    g.fillRect(C - 2, 18, 4, 28);
    g.fillRect(C - 10, 28, 20, 4);
    // Border
    g.lineStyle(2, 0xccbb77, 0.6);
    g.strokePoints([
      new P(C, 8), new P(C + 20, 14), new P(C + 18, 42), new P(C, 56),
      new P(C - 18, 42), new P(C - 20, 14), new P(C, 8),
    ], false);
    g.generateTexture('skill_icon_shield_wall', S, S);

    // taunt_roar — roaring shockwave mouth
    fillBg(0x662222);
    // Head silhouette
    g.fillStyle(0x996644, 0.7);
    g.fillCircle(C, 26, 14);
    g.fillStyle(0x886644, 0.6);
    g.fillRect(C - 10, 26, 20, 14);
    // Open mouth
    g.fillStyle(0xcc3333, 0.8);
    g.fillCircle(C, 36, 8);
    g.fillStyle(0x440000, 0.9);
    g.fillCircle(C, 36, 5);
    // Sound waves
    g.lineStyle(2, 0xff6644, 0.6);
    g.beginPath(); g.arc(C, 36, 14, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(40), false); g.strokePath();
    g.lineStyle(1.5, 0xff6644, 0.4);
    g.beginPath(); g.arc(C, 36, 20, Phaser.Math.DegToRad(-35), Phaser.Math.DegToRad(35), false); g.strokePath();
    g.lineStyle(1, 0xff6644, 0.25);
    g.beginPath(); g.arc(C, 36, 26, Phaser.Math.DegToRad(-30), Phaser.Math.DegToRad(30), false); g.strokePath();
    g.generateTexture('skill_icon_taunt_roar', S, S);

    // vengeful_wrath — burning fist
    fillBg(0x662200);
    // Fist
    g.fillStyle(0xbb8855, 0.9);
    g.fillRoundedRect(C - 10, 22, 20, 22, 4);
    g.fillStyle(0xaa7744, 0.8);
    g.fillRect(C - 8, 20, 5, 8);
    g.fillRect(C - 2, 18, 5, 10);
    g.fillRect(C + 4, 20, 5, 8);
    g.fillStyle(0x997744, 0.7);
    g.fillRect(C - 12, 30, 6, 14);
    // Flames around fist
    g.fillStyle(0xff4400, 0.6);
    g.fillTriangle(C - 14, 24, C - 18, 8, C - 6, 20);
    g.fillTriangle(C, 18, C - 4, 4, C + 4, 16);
    g.fillTriangle(C + 14, 24, C + 18, 8, C + 6, 20);
    g.fillStyle(0xffaa00, 0.5);
    g.fillTriangle(C - 10, 22, C - 12, 12, C - 4, 20);
    g.fillTriangle(C + 10, 22, C + 12, 12, C + 4, 20);
    g.fillStyle(0xffdd44, 0.3);
    g.fillTriangle(C, 20, C - 2, 10, C + 2, 18);
    g.generateTexture('skill_icon_vengeful_wrath', S, S);

    // charge — rushing warrior with speed lines
    fillBg(0x553311);
    // Speed lines (horizontal)
    g.lineStyle(2, 0xffcc44, 0.5);
    g.beginPath(); g.moveTo(4, 18); g.lineTo(28, 18); g.strokePath();
    g.lineStyle(2, 0xffcc44, 0.4);
    g.beginPath(); g.moveTo(6, 30); g.lineTo(26, 30); g.strokePath();
    g.lineStyle(1.5, 0xffcc44, 0.3);
    g.beginPath(); g.moveTo(8, 42); g.lineTo(24, 42); g.strokePath();
    // Warrior silhouette charging forward
    g.fillStyle(0xccaa66, 0.8);
    g.fillCircle(C + 6, 20, 8); // head
    g.fillStyle(0xbb9955, 0.7);
    g.fillTriangle(C - 4, 52, C + 6, 26, C + 16, 52); // body lunging
    // Shoulder/weapon forward
    g.fillStyle(0xddbb77, 0.9);
    g.fillRect(C + 10, 22, 14, 4);
    // Dust trail behind
    g.fillStyle(0xccbb99, 0.3);
    g.fillCircle(12, 44, 6);
    g.fillCircle(8, 36, 5);
    g.fillCircle(14, 50, 4);
    g.generateTexture('skill_icon_charge', S, S);

    // lethal_strike — heavy blade with X mark
    fillBg(0x441111);
    // Large blade pointing down
    g.fillStyle(0xdddddd, 0.9);
    g.fillPoints([new P(C, 6), new P(C + 7, 38), new P(C, 44), new P(C - 7, 38)], true);
    g.fillStyle(0xeeeeee, 0.5);
    g.fillPoints([new P(C, 8), new P(C + 3, 36), new P(C, 42), new P(C - 3, 36)], true);
    // Guard and handle
    g.fillStyle(0xddaa44, 0.9);
    g.fillRect(C - 12, 42, 24, 4);
    g.fillStyle(0x664422, 0.9);
    g.fillRect(C - 3, 46, 6, 12);
    // X critical mark
    g.lineStyle(3, 0xff2222, 0.8);
    g.beginPath(); g.moveTo(C - 16, 12); g.lineTo(C + 16, 32); g.strokePath();
    g.beginPath(); g.moveTo(C + 16, 12); g.lineTo(C - 16, 32); g.strokePath();
    g.generateTexture('skill_icon_lethal_strike', S, S);

    // dual_wield_mastery — two crossed swords
    fillBg(0x443322);
    // Left sword
    g.fillStyle(0xcccccc, 0.9);
    g.fillPoints([new P(14, 8), new P(18, 10), new P(38, 42), new P(34, 44)], true);
    g.fillStyle(0xddaa44, 0.8);
    g.fillRect(32, 42, 10, 3);
    g.fillStyle(0x664422, 0.8);
    g.fillRect(35, 45, 4, 8);
    // Right sword
    g.fillStyle(0xcccccc, 0.9);
    g.fillPoints([new P(50, 8), new P(46, 10), new P(26, 42), new P(30, 44)], true);
    g.fillStyle(0xddaa44, 0.8);
    g.fillRect(22, 42, 10, 3);
    g.fillStyle(0x664422, 0.8);
    g.fillRect(25, 45, 4, 8);
    // Golden glow at cross point
    g.fillStyle(0xddcc88, 0.4);
    g.fillCircle(C, 28, 8);
    g.fillStyle(0xffdd99, 0.2);
    g.fillCircle(C, 28, 12);
    g.generateTexture('skill_icon_dual_wield_mastery', S, S);

    // iron_fortress — steel shield with rivets
    fillBg(0x223344);
    // Shield body (steel blue)
    g.fillStyle(0x667788, 0.9);
    g.fillPoints([
      new P(C, 6), new P(C + 22, 16), new P(C + 20, 44), new P(C, 58),
      new P(C - 20, 44), new P(C - 22, 16),
    ], true);
    g.fillStyle(0x778899, 0.7);
    g.fillPoints([
      new P(C, 10), new P(C + 18, 18), new P(C + 16, 41), new P(C, 53),
      new P(C - 16, 41), new P(C - 18, 18),
    ], true);
    // Central vertical bar
    g.fillStyle(0x88aacc, 0.6);
    g.fillRect(C - 2, 14, 4, 38);
    // Horizontal bar
    g.fillRect(C - 14, 28, 28, 4);
    // Rivets
    g.fillStyle(0xaabbcc, 0.8);
    g.fillCircle(C - 12, 20, 2);
    g.fillCircle(C + 12, 20, 2);
    g.fillCircle(C - 10, 42, 2);
    g.fillCircle(C + 10, 42, 2);
    // Border
    g.lineStyle(2, 0x88aacc, 0.6);
    g.strokePoints([
      new P(C, 6), new P(C + 22, 16), new P(C + 20, 44), new P(C, 58),
      new P(C - 20, 44), new P(C - 22, 16), new P(C, 6),
    ], false);
    g.generateTexture('skill_icon_iron_fortress', S, S);

    // unyielding — cracked but standing pillar
    fillBg(0x332211);
    // Stone pillar
    g.fillStyle(0xaa8866, 0.8);
    g.fillRect(C - 10, 10, 20, 46);
    g.fillStyle(0xccaa88, 0.6);
    g.fillRect(C - 8, 12, 16, 42);
    // Cracks in pillar
    g.lineStyle(2, 0x664422, 0.7);
    g.beginPath(); g.moveTo(C - 2, 14); g.lineTo(C + 4, 24); g.lineTo(C - 3, 32); g.strokePath();
    g.beginPath(); g.moveTo(C + 3, 34); g.lineTo(C - 4, 42); g.strokePath();
    // Base
    g.fillStyle(0x886644, 0.9);
    g.fillRect(C - 14, 52, 28, 6);
    g.fillRect(C - 12, 8, 24, 4);
    // Golden glow (resilience)
    g.fillStyle(0xddaa44, 0.3);
    g.fillCircle(C, C, 16);
    g.fillStyle(0xffcc66, 0.15);
    g.fillCircle(C, C, 22);
    g.generateTexture('skill_icon_unyielding', S, S);

    // life_regen — green heart with sparkles
    fillBg(0x112211);
    // Heart shape using two circles and a triangle
    g.fillStyle(0x33aa33, 0.8);
    g.fillCircle(C - 8, 22, 10);
    g.fillCircle(C + 8, 22, 10);
    g.fillTriangle(C - 18, 26, C, 50, C + 18, 26);
    g.fillStyle(0x44cc44, 0.6);
    g.fillCircle(C - 8, 22, 7);
    g.fillCircle(C + 8, 22, 7);
    g.fillTriangle(C - 14, 26, C, 46, C + 14, 26);
    // Inner glow
    g.fillStyle(0x66ff66, 0.3);
    g.fillCircle(C - 4, 24, 4);
    // Rising sparkles
    g.fillStyle(0x88ffaa, 0.7);
    g.fillCircle(C - 12, 12, 2);
    g.fillCircle(C + 14, 14, 1.5);
    g.fillCircle(C + 4, 8, 2);
    g.fillCircle(C - 6, 6, 1.5);
    // Plus sign (healing)
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(C - 1.5, 18, 3, 14);
    g.fillRect(C - 6, 23, 12, 3);
    g.generateTexture('skill_icon_life_regen', S, S);

    // frenzy — red rage face/energy
    fillBg(0x331111);
    // Red energy swirl
    g.lineStyle(3, 0xcc2222, 0.7);
    g.beginPath();
    g.arc(C, C, 20, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(270), false);
    g.strokePath();
    g.lineStyle(2, 0xff4444, 0.5);
    g.beginPath();
    g.arc(C, C, 14, Phaser.Math.DegToRad(90), Phaser.Math.DegToRad(360), false);
    g.strokePath();
    // Angry eyes
    g.fillStyle(0xff4444, 0.9);
    g.fillPoints([new P(C - 12, C - 4), new P(C - 4, C - 8), new P(C - 4, C), new P(C - 12, C)], true);
    g.fillPoints([new P(C + 12, C - 4), new P(C + 4, C - 8), new P(C + 4, C), new P(C + 12, C)], true);
    // Clenched teeth
    g.fillStyle(0xcc2222, 0.8);
    g.fillRect(C - 8, C + 6, 16, 6);
    g.lineStyle(1.5, 0xffcccc, 0.7);
    g.beginPath(); g.moveTo(C - 4, C + 6); g.lineTo(C - 4, C + 12); g.strokePath();
    g.beginPath(); g.moveTo(C, C + 6); g.lineTo(C, C + 12); g.strokePath();
    g.beginPath(); g.moveTo(C + 4, C + 6); g.lineTo(C + 4, C + 12); g.strokePath();
    // Red aura glow
    g.fillStyle(0xff2222, 0.15);
    g.fillCircle(C, C, 26);
    g.generateTexture('skill_icon_frenzy', S, S);

    // bleed_strike — slashing blade with blood drops
    fillBg(0x331111);
    // Blade (angled slash)
    g.fillStyle(0xcccccc, 0.9);
    g.fillPoints([new P(14, 8), new P(20, 10), new P(48, 44), new P(42, 48)], true);
    g.fillStyle(0xeeeeee, 0.5);
    g.fillPoints([new P(16, 10), new P(19, 12), new P(46, 44), new P(44, 46)], true);
    // Guard + handle
    g.fillStyle(0x886644, 0.9);
    g.fillRect(42, 44, 12, 3);
    g.fillStyle(0x664422, 0.8);
    g.fillRoundedRect(48, 47, 6, 10, 2);
    // Blood drops falling from blade
    g.fillStyle(0xcc2222, 0.9);
    g.fillCircle(24, 26, 3);
    g.fillTriangle(24, 23, 22, 26, 26, 26);
    g.fillStyle(0xaa1111, 0.8);
    g.fillCircle(30, 36, 2.5);
    g.fillTriangle(30, 33, 28, 36, 32, 36);
    g.fillStyle(0x991111, 0.7);
    g.fillCircle(20, 40, 2);
    g.fillCircle(36, 48, 2);
    g.generateTexture('skill_icon_bleed_strike', S, S);

    // rampage — explosive berserker whirlwind with red energy
    fillBg(0x441111);
    // Central figure silhouette (berserker pose)
    g.fillStyle(0xaa6633, 0.7);
    g.fillCircle(C, 16, 7); // head
    g.fillStyle(0x995522, 0.6);
    g.fillTriangle(C - 12, 50, C, 20, C + 12, 50); // body
    // Spinning blade arcs around figure
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const ax = C + Math.cos(angle) * 20;
      const ay = C + Math.sin(angle) * 18;
      g.lineStyle(3, 0xff4444, 0.8);
      g.beginPath();
      g.arc(ax, ay, 8, angle - 0.8, angle + 0.8, false);
      g.strokePath();
    }
    // Red energy ring
    g.lineStyle(2, 0xcc2222, 0.7);
    g.strokeCircle(C, C, 24);
    g.lineStyle(1.5, 0xff4444, 0.4);
    g.strokeCircle(C, C, 20);
    // Impact sparks
    g.fillStyle(0xffaa00, 0.7);
    g.fillCircle(C - 18, 14, 2);
    g.fillCircle(C + 20, 22, 2.5);
    g.fillCircle(C - 14, 48, 2);
    g.fillCircle(C + 16, 46, 2);
    // Red aura glow
    g.fillStyle(0xff2222, 0.15);
    g.fillCircle(C, C, 26);
    g.generateTexture('skill_icon_rampage', S, S);

    // ═══ MAGE ═══

    // fireball — flaming orb
    fillBg(0x441100);
    g.fillStyle(0xff4400, 0.7);
    g.fillCircle(C, C + 4, 16);
    g.fillStyle(0xff6600, 0.8);
    g.fillCircle(C, C + 4, 12);
    g.fillStyle(0xffaa00, 0.9);
    g.fillCircle(C, C + 4, 8);
    g.fillStyle(0xffdd44, 0.8);
    g.fillCircle(C, C + 2, 4);
    // Flame trail
    g.fillStyle(0xff4400, 0.5);
    g.fillTriangle(C - 8, C - 4, C, C - 24, C + 8, C - 4);
    g.fillStyle(0xff6600, 0.4);
    g.fillTriangle(C - 4, C - 6, C + 3, C - 18, C + 6, C - 2);
    g.fillStyle(0xffaa00, 0.3);
    g.fillTriangle(C - 2, C - 8, C, C - 14, C + 2, C - 4);
    g.generateTexture('skill_icon_fireball', S, S);

    // meteor — falling rock with fire trail
    fillBg(0x331100);
    // Fire trail (upper left)
    g.fillStyle(0xff4400, 0.4);
    g.fillTriangle(8, 4, 22, 18, 12, 22);
    g.fillStyle(0xff6600, 0.3);
    g.fillTriangle(12, 8, 26, 22, 16, 26);
    g.fillStyle(0xffaa00, 0.2);
    g.fillTriangle(16, 12, 28, 26, 20, 28);
    // Rock
    g.fillStyle(0x664422, 0.9);
    g.fillCircle(C + 4, C + 6, 14);
    g.fillStyle(0x886644, 0.7);
    g.fillCircle(C + 4, C + 6, 10);
    g.fillStyle(0xaa8866, 0.4);
    g.fillCircle(C + 2, C + 3, 6);
    // Impact glow
    g.fillStyle(0xff6600, 0.3);
    g.fillCircle(C + 4, C + 6, 20);
    g.generateTexture('skill_icon_meteor', S, S);

    // blizzard — snowflakes and ice shards
    fillBg(0x112244);
    // Snowflakes (simple crosses at various positions)
    const snowPositions = [[18, 14], [42, 18], [26, 38], [46, 44], [14, 48]];
    for (const [sx, sy] of snowPositions) {
      g.lineStyle(1.5, 0xccddff, 0.7);
      g.beginPath(); g.moveTo(sx - 4, sy); g.lineTo(sx + 4, sy); g.strokePath();
      g.beginPath(); g.moveTo(sx, sy - 4); g.lineTo(sx, sy + 4); g.strokePath();
      g.beginPath(); g.moveTo(sx - 3, sy - 3); g.lineTo(sx + 3, sy + 3); g.strokePath();
      g.beginPath(); g.moveTo(sx + 3, sy - 3); g.lineTo(sx - 3, sy + 3); g.strokePath();
    }
    // Wind lines
    g.lineStyle(1, 0x88aadd, 0.3);
    g.beginPath(); g.moveTo(4, 20); g.lineTo(60, 16); g.strokePath();
    g.beginPath(); g.moveTo(8, 34); g.lineTo(56, 30); g.strokePath();
    g.beginPath(); g.moveTo(2, 48); g.lineTo(58, 46); g.strokePath();
    // Central ice shard
    g.fillStyle(0x88ccff, 0.6);
    g.fillPoints([new P(C, 10), new P(C + 6, C), new P(C, C + 10), new P(C - 6, C)], true);
    g.generateTexture('skill_icon_blizzard', S, S);

    // ice_armor — crystalline armor/shell
    fillBg(0x113355);
    // Body outline
    g.fillStyle(0x88ccff, 0.5);
    g.fillPoints([
      new P(C, 6), new P(C + 18, 18), new P(C + 16, 46),
      new P(C, 58), new P(C - 16, 46), new P(C - 18, 18),
    ], true);
    // Crystal facets
    g.fillStyle(0xaaddff, 0.6);
    g.fillPoints([new P(C, 10), new P(C + 12, 20), new P(C, 34), new P(C - 12, 20)], true);
    g.fillStyle(0xcceeFF, 0.4);
    g.fillPoints([new P(C, 14), new P(C + 8, 22), new P(C, 30), new P(C - 8, 22)], true);
    // Shine
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(C - 4, 18, 3);
    // Border
    g.lineStyle(1.5, 0x88ccff, 0.6);
    g.strokePoints([
      new P(C, 6), new P(C + 18, 18), new P(C + 16, 46),
      new P(C, 58), new P(C - 16, 46), new P(C - 18, 18), new P(C, 6),
    ], false);
    g.generateTexture('skill_icon_ice_armor', S, S);

    // chain_lightning — branching lightning bolts
    fillBg(0x112255);
    // Main bolt
    g.lineStyle(3, 0x88aaff, 0.9);
    g.beginPath();
    g.moveTo(12, 6); g.lineTo(20, 18); g.lineTo(14, 24);
    g.lineTo(28, 36); g.lineTo(22, 40); g.lineTo(34, 54);
    g.strokePath();
    g.lineStyle(1.5, 0xccddff, 0.6);
    g.beginPath();
    g.moveTo(12, 6); g.lineTo(20, 18); g.lineTo(14, 24);
    g.lineTo(28, 36); g.lineTo(22, 40); g.lineTo(34, 54);
    g.strokePath();
    // Branch 1
    g.lineStyle(2, 0x88aaff, 0.6);
    g.beginPath(); g.moveTo(20, 18); g.lineTo(36, 22); g.lineTo(48, 16); g.strokePath();
    // Branch 2
    g.beginPath(); g.moveTo(28, 36); g.lineTo(42, 40); g.lineTo(52, 48); g.strokePath();
    // Glow at origin
    g.fillStyle(0xaaccff, 0.3);
    g.fillCircle(12, 6, 6);
    g.generateTexture('skill_icon_chain_lightning', S, S);

    // mana_shield — arcane bubble shield
    fillBg(0x220044);
    // Outer shield circle
    g.lineStyle(3, 0x9966ff, 0.6);
    g.strokeCircle(C, C, 24);
    g.lineStyle(1.5, 0xbb88ff, 0.4);
    g.strokeCircle(C, C, 20);
    // Inner glow
    g.fillStyle(0x6633cc, 0.25);
    g.fillCircle(C, C, 22);
    g.fillStyle(0x8855ff, 0.15);
    g.fillCircle(C, C, 16);
    // Rune/symbol inside — simple star
    g.lineStyle(1.5, 0xcc99ff, 0.7);
    const runeR = 10;
    for (let i = 0; i < 5; i++) {
      const a1 = Phaser.Math.DegToRad(i * 72 - 90);
      const a2 = Phaser.Math.DegToRad(((i + 2) % 5) * 72 - 90);
      g.beginPath();
      g.moveTo(C + Math.cos(a1) * runeR, C + Math.sin(a1) * runeR);
      g.lineTo(C + Math.cos(a2) * runeR, C + Math.sin(a2) * runeR);
      g.strokePath();
    }
    // Sparkles
    g.fillStyle(0xddbbff, 0.6);
    g.fillCircle(C - 8, C - 12, 2);
    g.fillCircle(C + 10, C - 6, 1.5);
    g.fillCircle(C + 6, C + 14, 2);
    g.generateTexture('skill_icon_mana_shield', S, S);

    // fire_wall — horizontal flame wall
    fillBg(0x441100);
    // Ground line
    g.fillStyle(0x664422, 0.6);
    g.fillRect(4, C + 10, 56, 6);
    // Flame pillars rising from ground
    const wallFlames = [10, 22, 32, 42, 52];
    for (const fx of wallFlames) {
      g.fillStyle(0xff4400, 0.8);
      g.fillTriangle(fx, C + 10, fx - 5, C - 8 - Math.random() * 6, fx + 5, C + 10);
      g.fillStyle(0xff6600, 0.6);
      g.fillTriangle(fx, C + 8, fx - 3, C - 4 - Math.random() * 4, fx + 3, C + 8);
      g.fillStyle(0xffaa00, 0.4);
      g.fillTriangle(fx, C + 6, fx - 2, C - 2, fx + 2, C + 6);
    }
    // Heat shimmer lines
    g.lineStyle(1, 0xffdd44, 0.3);
    g.beginPath(); g.moveTo(8, C - 12); g.lineTo(56, C - 14); g.strokePath();
    g.beginPath(); g.moveTo(10, C - 18); g.lineTo(54, C - 20); g.strokePath();
    // Orange glow at base
    g.fillStyle(0xff6600, 0.2);
    g.fillRect(4, C + 4, 56, 12);
    g.generateTexture('skill_icon_fire_wall', S, S);

    // combustion — internal explosion burst
    fillBg(0x441100);
    // Target silhouette (dark circle)
    g.fillStyle(0x663322, 0.5);
    g.fillCircle(C, C, 16);
    // Explosion lines radiating outward
    for (let a = 0; a < 360; a += 30) {
      const rad = Phaser.Math.DegToRad(a);
      g.lineStyle(3, 0xff4400, 0.8);
      g.beginPath();
      g.moveTo(C + Math.cos(rad) * 10, C + Math.sin(rad) * 10);
      g.lineTo(C + Math.cos(rad) * 26, C + Math.sin(rad) * 26);
      g.strokePath();
    }
    // Inner core — white hot
    g.fillStyle(0xffdd44, 0.9);
    g.fillCircle(C, C, 8);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(C, C, 4);
    // Outer fire ring
    g.lineStyle(2, 0xff6600, 0.6);
    g.strokeCircle(C, C, 20);
    g.lineStyle(1, 0xffaa00, 0.4);
    g.strokeCircle(C, C, 24);
    // Fire particles
    g.fillStyle(0xff4400, 0.7);
    g.fillCircle(C - 16, C - 14, 3);
    g.fillCircle(C + 18, C - 10, 2.5);
    g.fillCircle(C + 14, C + 16, 3);
    g.fillCircle(C - 12, C + 18, 2.5);
    g.generateTexture('skill_icon_combustion', S, S);

    // ice_arrow — frost projectile arrow
    fillBg(0x112244);
    // Arrow shaft (angled, pointing right)
    g.fillStyle(0xaaddff, 0.9);
    g.fillPoints([new P(12, C + 6), new P(14, C - 2), new P(50, C - 8), new P(50, C - 2)], true);
    // Arrow head (ice crystal)
    g.fillStyle(0x88ccff, 0.9);
    g.fillPoints([new P(50, C - 10), new P(58, C - 5), new P(50, C), new P(48, C - 5)], true);
    g.fillStyle(0xcceeFF, 0.5);
    g.fillPoints([new P(51, C - 8), new P(56, C - 5), new P(51, C - 2)], true);
    // Fletching (ice crystal)
    g.fillStyle(0x88ccff, 0.6);
    g.fillTriangle(12, C - 6, 6, C - 14, 16, C - 2);
    g.fillTriangle(12, C + 8, 6, C + 16, 16, C + 4);
    // Frost trail particles behind arrow
    g.fillStyle(0xaaddff, 0.4);
    g.fillCircle(8, C + 2, 3);
    g.fillCircle(14, C - 8, 2);
    g.fillCircle(10, C + 10, 2.5);
    // Icy glow around arrowhead
    g.fillStyle(0x88ccff, 0.2);
    g.fillCircle(52, C - 5, 10);
    g.generateTexture('skill_icon_ice_arrow', S, S);

    // freeze — ice crystal cage
    fillBg(0x112244);
    // Central frozen target (dark circle)
    g.fillStyle(0x4488aa, 0.4);
    g.fillCircle(C, C, 12);
    // Ice crystals around the target (6 crystals in a ring)
    for (let i = 0; i < 6; i++) {
      const ia = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const icx = C + Math.cos(ia) * 18;
      const icy = C + Math.sin(ia) * 18;
      g.fillStyle(0x88ccff, 0.8);
      g.fillPoints([
        new P(icx, icy - 8),
        new P(icx + 4, icy),
        new P(icx, icy + 4),
        new P(icx - 4, icy),
      ], true);
      g.fillStyle(0xaaddff, 0.5);
      g.fillPoints([
        new P(icx, icy - 6),
        new P(icx + 2, icy),
        new P(icx, icy + 2),
        new P(icx - 2, icy),
      ], true);
    }
    // Connecting lines between crystals (ice cage bars)
    g.lineStyle(1.5, 0x88ccff, 0.4);
    for (let i = 0; i < 6; i++) {
      const ia1 = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const ia2 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.moveTo(C + Math.cos(ia1) * 18, C + Math.sin(ia1) * 18);
      g.lineTo(C + Math.cos(ia2) * 18, C + Math.sin(ia2) * 18);
      g.strokePath();
    }
    // Frost glow
    g.fillStyle(0x88ccff, 0.15);
    g.fillCircle(C, C, 22);
    // White shine
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(C - 4, C - 6, 3);
    g.generateTexture('skill_icon_freeze', S, S);

    // teleport — arcane portal swirl
    fillBg(0x220044);
    // Outer arcane ring
    g.lineStyle(3, 0x8855cc, 0.7);
    g.strokeCircle(C, C, 22);
    g.lineStyle(2, 0x9966ff, 0.5);
    g.strokeCircle(C, C, 18);
    // Swirl inside the ring
    g.lineStyle(2, 0xbb88ff, 0.6);
    g.beginPath();
    for (let t = 0; t < Math.PI * 3; t += 0.15) {
      const sr = 14 * (1 - t / (Math.PI * 3));
      const sx = C + Math.cos(t) * sr;
      const sy = C + Math.sin(t) * sr;
      if (t === 0) g.moveTo(sx, sy); else g.lineTo(sx, sy);
    }
    g.strokePath();
    // Central bright point
    g.fillStyle(0xddbbff, 0.9);
    g.fillCircle(C, C, 4);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(C, C, 2);
    // Departure/arrival arrows (up arrow suggesting movement)
    g.fillStyle(0x9966ff, 0.6);
    g.fillTriangle(C, 4, C - 6, 14, C + 6, 14);
    g.fillStyle(0xbb88ff, 0.5);
    g.fillTriangle(C, 58, C - 6, 48, C + 6, 48);
    // Sparkles
    g.fillStyle(0xddbbff, 0.5);
    g.fillCircle(C - 14, C - 10, 2);
    g.fillCircle(C + 16, C - 8, 1.5);
    g.fillCircle(C + 12, C + 14, 2);
    g.fillCircle(C - 10, C + 16, 1.5);
    g.generateTexture('skill_icon_teleport', S, S);

    // arcane_torrent — arcane energy barrage
    fillBg(0x220044);
    // Multiple arcane bolts raining down
    const torrentPositions = [[18, 14], [32, 10], [46, 16], [24, 28], [40, 24], [14, 40], [34, 38], [50, 36]];
    for (const [bx, by] of torrentPositions) {
      g.fillStyle(0x9966ff, 0.8);
      g.fillCircle(bx, by, 3);
      g.fillStyle(0xbb88ff, 0.4);
      g.fillCircle(bx, by, 5);
      // Trail upward
      g.lineStyle(1, 0x8844cc, 0.5);
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - 1, by - 8); g.strokePath();
    }
    // Ground impact zone
    g.fillStyle(0x8855cc, 0.3);
    g.fillCircle(C, C + 8, 18);
    g.lineStyle(2, 0x9966ff, 0.5);
    g.strokeCircle(C, C + 8, 18);
    // Bright center glow
    g.fillStyle(0xbb88ff, 0.25);
    g.fillCircle(C, C, 12);
    g.generateTexture('skill_icon_arcane_torrent', S, S);

    // ═══ ROGUE ═══

    // backstab — dagger pointing down
    fillBg(0x222233);
    // Blade
    g.fillStyle(0xccccdd, 0.9);
    g.fillPoints([new P(C, 8), new P(C + 5, 36), new P(C, 40), new P(C - 5, 36)], true);
    g.fillStyle(0xeeeeff, 0.5);
    g.fillPoints([new P(C, 10), new P(C + 2, 34), new P(C, 38), new P(C - 2, 34)], true);
    // Guard
    g.fillStyle(0xddaa44, 0.9);
    g.fillRect(C - 10, 38, 20, 4);
    // Handle
    g.fillStyle(0x664422, 0.9);
    g.fillRect(C - 3, 42, 6, 14);
    g.fillStyle(0x553311, 0.7);
    g.fillRect(C - 4, 44, 8, 3);
    g.fillRect(C - 4, 50, 8, 3);
    // Blood drops
    g.fillStyle(0xcc2222, 0.6);
    g.fillCircle(C + 8, 20, 2.5);
    g.fillCircle(C + 12, 26, 2);
    g.fillCircle(C + 6, 30, 1.5);
    g.generateTexture('skill_icon_backstab', S, S);

    // poison_blade — dripping green blade
    fillBg(0x113311);
    // Blade (angled)
    g.fillStyle(0x99aa88, 0.9);
    g.fillPoints([new P(18, 8), new P(24, 10), new P(46, 40), new P(42, 44)], true);
    g.fillStyle(0xbbcc99, 0.5);
    g.fillPoints([new P(20, 10), new P(23, 12), new P(44, 40), new P(42, 42)], true);
    // Guard + handle
    g.fillStyle(0x556633, 0.9);
    g.fillRect(40, 40, 14, 4);
    g.fillStyle(0x664422, 0.9);
    g.fillRoundedRect(46, 44, 6, 12, 2);
    // Poison drips
    g.fillStyle(0x33cc33, 0.8);
    g.fillCircle(28, 24, 3);
    g.fillTriangle(28, 21, 26, 24, 30, 24);
    g.fillStyle(0x44dd44, 0.7);
    g.fillCircle(34, 34, 2.5);
    g.fillTriangle(34, 31, 32, 34, 36, 34);
    g.fillStyle(0x22bb22, 0.6);
    g.fillCircle(24, 36, 2);
    g.fillCircle(30, 44, 2.5);
    g.generateTexture('skill_icon_poison_blade', S, S);

    // vanish — shadow cloak / smoke
    fillBg(0x111122);
    // Dark figure silhouette
    g.fillStyle(0x222244, 0.7);
    g.fillCircle(C, 18, 10); // head
    g.fillTriangle(C - 16, 56, C, 22, C + 16, 56); // cloak
    g.fillStyle(0x333355, 0.5);
    g.fillCircle(C, 18, 8);
    g.fillTriangle(C - 12, 52, C, 24, C + 12, 52);
    // Fade/dissolve particles
    g.fillStyle(0x555588, 0.4);
    g.fillCircle(C - 14, 32, 4);
    g.fillCircle(C + 16, 28, 3);
    g.fillCircle(C - 10, 46, 3.5);
    g.fillCircle(C + 12, 44, 4);
    g.fillStyle(0x444477, 0.25);
    g.fillCircle(C - 20, 38, 5);
    g.fillCircle(C + 20, 36, 4.5);
    g.fillCircle(C, 52, 3);
    // Glowing eyes
    g.fillStyle(0xccaaff, 0.8);
    g.fillCircle(C - 4, 17, 1.5);
    g.fillCircle(C + 4, 17, 1.5);
    g.generateTexture('skill_icon_vanish', S, S);

    // multishot — three arrows fanning out
    fillBg(0x222222);
    // Central arrow
    g.fillStyle(0xcccccc, 0.9);
    g.fillRect(C - 1.5, 14, 3, 30);
    g.fillStyle(0xeeeeee, 0.9);
    g.fillTriangle(C, 8, C - 4, 16, C + 4, 16);
    g.fillStyle(0x886644, 0.7);
    g.fillRect(C - 3, 42, 6, 4);
    // Left arrow
    g.fillStyle(0xbbbbbb, 0.7);
    const la = Phaser.Math.DegToRad(-15);
    g.save?.();
    g.fillRect(12, 18, 3, 26);
    g.fillTriangle(13, 12, 8, 20, 18, 20);
    g.fillStyle(0x886644, 0.5);
    g.fillRect(10, 42, 6, 4);
    // Right arrow
    g.fillStyle(0xbbbbbb, 0.7);
    g.fillRect(48, 18, 3, 26);
    g.fillTriangle(49, 12, 44, 20, 54, 20);
    g.fillStyle(0x886644, 0.5);
    g.fillRect(46, 42, 6, 4);
    g.generateTexture('skill_icon_multishot', S, S);

    // arrow_rain — arrows falling from sky
    fillBg(0x1a1a22);
    // Sky cloud/arc
    g.fillStyle(0x334455, 0.5);
    g.fillCircle(C - 8, 10, 10);
    g.fillCircle(C + 8, 10, 10);
    g.fillCircle(C, 6, 10);
    // Falling arrows
    const arrowXs = [14, 26, 38, 50];
    for (const ax of arrowXs) {
      const ay = 18 + (ax % 7) * 3;
      g.fillStyle(0xbbbbcc, 0.8);
      g.fillRect(ax - 1, ay, 2, 22);
      g.fillStyle(0xddddee, 0.9);
      g.fillTriangle(ax, ay + 22, ax - 3, ay + 16, ax + 3, ay + 16);
      g.fillStyle(0x886644, 0.5);
      g.fillRect(ax - 2, ay, 4, 3);
    }
    // Impact marks on ground
    g.lineStyle(1, 0xffcc44, 0.4);
    g.strokeCircle(20, 56, 4);
    g.strokeCircle(44, 54, 3);
    g.generateTexture('skill_icon_arrow_rain', S, S);

    // explosive_trap — bomb/mine
    fillBg(0x331111);
    // Mine body
    g.fillStyle(0x664444, 0.9);
    g.fillCircle(C, C + 4, 14);
    g.fillStyle(0x885555, 0.7);
    g.fillCircle(C, C + 4, 10);
    // Danger symbol (skull-like: two dots + line)
    g.fillStyle(0xff4444, 0.8);
    g.fillCircle(C - 5, C + 2, 2.5);
    g.fillCircle(C + 5, C + 2, 2.5);
    g.fillRect(C - 4, C + 7, 8, 2);
    // Fuse on top
    g.lineStyle(2, 0xaa8844, 0.8);
    g.beginPath(); g.moveTo(C, C - 10); g.lineTo(C + 6, C - 18); g.strokePath();
    // Spark at fuse tip
    g.fillStyle(0xffdd44, 0.9);
    g.fillCircle(C + 6, C - 18, 3);
    g.fillStyle(0xffaa00, 0.5);
    g.fillCircle(C + 6, C - 18, 5);
    // Explosion lines
    g.lineStyle(1.5, 0xff6633, 0.4);
    for (let a = 0; a < 360; a += 45) {
      const rad = Phaser.Math.DegToRad(a);
      g.beginPath();
      g.moveTo(C + Math.cos(rad) * 18, C + 4 + Math.sin(rad) * 18);
      g.lineTo(C + Math.cos(rad) * 26, C + 4 + Math.sin(rad) * 26);
      g.strokePath();
    }
    g.generateTexture('skill_icon_explosive_trap', S, S);

    // ═══ NEW ROGUE SKILLS ═══

    // shadow_step — dark teleport dash silhouette
    fillBg(0x111122);
    // Dark figure silhouette (at destination)
    g.fillStyle(0x333355, 0.7);
    g.fillCircle(C + 6, 16, 8); // head
    g.fillTriangle(C - 6, 50, C + 6, 20, C + 18, 50); // body
    // Shadow trail behind (faded copy at origin)
    g.fillStyle(0x222244, 0.3);
    g.fillCircle(C - 10, 20, 7);
    g.fillTriangle(C - 20, 48, C - 10, 24, C, 48);
    // Motion lines connecting origin to destination
    g.lineStyle(2, 0x8866cc, 0.5);
    g.beginPath(); g.moveTo(C - 12, 22); g.lineTo(C + 4, 18); g.strokePath();
    g.lineStyle(1.5, 0x8866cc, 0.4);
    g.beginPath(); g.moveTo(C - 14, 34); g.lineTo(C + 2, 32); g.strokePath();
    g.lineStyle(1, 0x8866cc, 0.3);
    g.beginPath(); g.moveTo(C - 16, 44); g.lineTo(C, 42); g.strokePath();
    // Purple sparkles around destination
    g.fillStyle(0xbb88ff, 0.7);
    g.fillCircle(C + 16, 12, 2);
    g.fillCircle(C + 20, 24, 1.5);
    g.fillCircle(C + 14, 32, 2);
    // Dark aura
    g.fillStyle(0x6644aa, 0.15);
    g.fillCircle(C + 6, C, 22);
    g.generateTexture('skill_icon_shadow_step', S, S);

    // death_mark — skull with crossbones / death symbol
    fillBg(0x220022);
    // Skull circle (dark purple)
    g.fillStyle(0x663366, 0.7);
    g.fillCircle(C, C - 4, 14);
    g.fillStyle(0x884488, 0.5);
    g.fillCircle(C, C - 4, 10);
    // Eye sockets
    g.fillStyle(0xff44ff, 0.9);
    g.fillCircle(C - 5, C - 6, 3);
    g.fillCircle(C + 5, C - 6, 3);
    g.fillStyle(0x220022, 0.9);
    g.fillCircle(C - 5, C - 6, 1.5);
    g.fillCircle(C + 5, C - 6, 1.5);
    // Jaw/mouth
    g.fillStyle(0x553355, 0.8);
    g.fillRect(C - 6, C + 2, 12, 6);
    g.lineStyle(1.5, 0xcc44cc, 0.7);
    g.beginPath(); g.moveTo(C - 3, C + 2); g.lineTo(C - 3, C + 8); g.strokePath();
    g.beginPath(); g.moveTo(C, C + 2); g.lineTo(C, C + 8); g.strokePath();
    g.beginPath(); g.moveTo(C + 3, C + 2); g.lineTo(C + 3, C + 8); g.strokePath();
    // Cross mark behind skull
    g.lineStyle(3, 0xcc22cc, 0.6);
    g.beginPath(); g.moveTo(C - 18, C - 18); g.lineTo(C + 18, C + 18); g.strokePath();
    g.beginPath(); g.moveTo(C + 18, C - 18); g.lineTo(C - 18, C + 18); g.strokePath();
    // Outer glow ring
    g.lineStyle(2, 0xff44ff, 0.4);
    g.strokeCircle(C, C, 24);
    // Purple aura
    g.fillStyle(0xcc22cc, 0.15);
    g.fillCircle(C, C, 26);
    g.generateTexture('skill_icon_death_mark', S, S);

    // piercing_arrow — bright golden arrow with speed lines
    fillBg(0x222211);
    // Speed lines (horizontal, suggesting piercing motion)
    g.lineStyle(2, 0xffcc44, 0.4);
    g.beginPath(); g.moveTo(4, 16); g.lineTo(30, 16); g.strokePath();
    g.lineStyle(1.5, 0xffcc44, 0.3);
    g.beginPath(); g.moveTo(6, 28); g.lineTo(28, 28); g.strokePath();
    g.lineStyle(1, 0xffcc44, 0.2);
    g.beginPath(); g.moveTo(8, 40); g.lineTo(26, 40); g.strokePath();
    // Arrow shaft (angled, pointing right/forward)
    g.fillStyle(0xddcc88, 0.9);
    g.fillPoints([new P(10, C + 4), new P(12, C - 4), new P(52, C - 8), new P(52, C - 2)], true);
    // Arrow head (bright golden, larger for piercing emphasis)
    g.fillStyle(0xffdd44, 0.9);
    g.fillPoints([new P(50, C - 12), new P(60, C - 5), new P(50, C + 2), new P(48, C - 5)], true);
    g.fillStyle(0xffffff, 0.5);
    g.fillPoints([new P(52, C - 10), new P(58, C - 5), new P(52, C)], true);
    // Fletching
    g.fillStyle(0xccaa44, 0.6);
    g.fillTriangle(10, C - 6, 4, C - 14, 16, C - 2);
    g.fillTriangle(10, C + 6, 4, C + 14, 16, C + 2);
    // Piercing impact lines at head
    g.lineStyle(2, 0xffdd44, 0.7);
    g.beginPath(); g.moveTo(54, C - 14); g.lineTo(60, C - 18); g.strokePath();
    g.beginPath(); g.moveTo(56, C - 5); g.lineTo(62, C - 5); g.strokePath();
    g.beginPath(); g.moveTo(54, C + 4); g.lineTo(60, C + 8); g.strokePath();
    // Golden glow around arrowhead
    g.fillStyle(0xffcc00, 0.2);
    g.fillCircle(54, C - 5, 12);
    g.generateTexture('skill_icon_piercing_arrow', S, S);

    // poison_arrow — green-tipped arrow with poison drips
    fillBg(0x112211);
    // Arrow shaft (angled)
    g.fillStyle(0xaabb88, 0.9);
    g.fillPoints([new P(10, C + 4), new P(12, C - 2), new P(48, C - 6), new P(48, C)], true);
    // Arrow head (poison green crystal)
    g.fillStyle(0x33cc33, 0.9);
    g.fillPoints([new P(46, C - 10), new P(56, C - 3), new P(46, C + 4), new P(44, C - 3)], true);
    g.fillStyle(0x66ff66, 0.5);
    g.fillPoints([new P(47, C - 8), new P(54, C - 3), new P(47, C + 2)], true);
    // Fletching
    g.fillStyle(0x668844, 0.6);
    g.fillTriangle(10, C - 4, 4, C - 12, 16, C);
    g.fillTriangle(10, C + 6, 4, C + 14, 16, C + 2);
    // Poison drips from arrowhead
    g.fillStyle(0x33cc33, 0.8);
    g.fillCircle(48, C + 8, 2.5);
    g.fillTriangle(48, C + 5, 46, C + 8, 50, C + 8);
    g.fillStyle(0x44dd44, 0.7);
    g.fillCircle(44, C + 14, 2);
    g.fillTriangle(44, C + 11, 42, C + 14, 46, C + 14);
    g.fillStyle(0x22bb22, 0.6);
    g.fillCircle(50, C + 16, 1.5);
    // Green glow around tip
    g.fillStyle(0x33cc33, 0.2);
    g.fillCircle(50, C - 3, 10);
    g.generateTexture('skill_icon_poison_arrow', S, S);

    // poison_cloud — green toxic cloud
    fillBg(0x112211);
    // Multiple overlapping cloud puffs
    g.fillStyle(0x22aa22, 0.5);
    g.fillCircle(C - 10, C - 6, 14);
    g.fillCircle(C + 10, C - 4, 12);
    g.fillCircle(C, C + 4, 16);
    g.fillCircle(C - 14, C + 8, 10);
    g.fillCircle(C + 14, C + 6, 11);
    g.fillStyle(0x33cc33, 0.4);
    g.fillCircle(C - 6, C - 2, 10);
    g.fillCircle(C + 6, C, 9);
    g.fillCircle(C, C + 8, 12);
    // Skull silhouette in cloud (danger)
    g.fillStyle(0x44dd44, 0.7);
    g.fillCircle(C, C - 4, 6);
    g.fillStyle(0x112211, 0.9);
    g.fillCircle(C - 2, C - 5, 1.5);
    g.fillCircle(C + 2, C - 5, 1.5);
    g.fillRect(C - 3, C, 6, 3);
    // Poison droplets rising from cloud
    g.fillStyle(0x66ff66, 0.6);
    g.fillCircle(C - 12, C - 16, 2);
    g.fillCircle(C + 8, C - 18, 1.5);
    g.fillCircle(C + 16, C - 14, 2);
    g.fillCircle(C - 4, C - 20, 1.5);
    // Green glow
    g.fillStyle(0x33cc33, 0.15);
    g.fillCircle(C, C, 26);
    g.generateTexture('skill_icon_poison_cloud', S, S);

    // slow_trap — frost/ice trap device
    fillBg(0x112233);
    // Trap base (metallic circle)
    g.fillStyle(0x4466aa, 0.8);
    g.fillCircle(C, C + 4, 16);
    g.fillStyle(0x5588bb, 0.6);
    g.fillCircle(C, C + 4, 12);
    // Ice crystal on top of trap
    g.fillStyle(0x88ccff, 0.8);
    g.fillPoints([new P(C, C - 14), new P(C + 6, C), new P(C, C + 6), new P(C - 6, C)], true);
    g.fillStyle(0xaaddff, 0.5);
    g.fillPoints([new P(C, C - 12), new P(C + 3, C), new P(C, C + 4), new P(C - 3, C)], true);
    // Frost emanation rings
    g.lineStyle(2, 0x88ccff, 0.5);
    g.strokeCircle(C, C + 4, 20);
    g.lineStyle(1.5, 0xaaddff, 0.3);
    g.strokeCircle(C, C + 4, 26);
    // Icicle spikes around trap
    g.fillStyle(0x88ccff, 0.6);
    g.fillTriangle(C - 18, C + 4, C - 14, C - 4, C - 12, C + 4);
    g.fillTriangle(C + 18, C + 4, C + 14, C - 4, C + 12, C + 4);
    g.fillTriangle(C, C + 20, C - 4, C + 12, C + 4, C + 12);
    // Snowflake sparkles
    g.fillStyle(0xccddff, 0.7);
    g.fillCircle(C - 14, C - 8, 1.5);
    g.fillCircle(C + 12, C - 10, 2);
    g.fillCircle(C + 16, C + 14, 1.5);
    // Blue glow
    g.fillStyle(0x4488cc, 0.2);
    g.fillCircle(C, C + 4, 22);
    g.generateTexture('skill_icon_slow_trap', S, S);

    // chain_trap — linked chain device
    fillBg(0x222211);
    // Central trap mechanism
    g.fillStyle(0xaa8833, 0.8);
    g.fillCircle(C, C, 10);
    g.fillStyle(0xccaa44, 0.6);
    g.fillCircle(C, C, 7);
    // Chain links radiating outward (5 directions)
    for (let ci = 0; ci < 5; ci++) {
      const ca = (ci / 5) * Math.PI * 2 - Math.PI / 2;
      const linkDist = 18;
      const lcx = C + Math.cos(ca) * linkDist;
      const lcy = C + Math.sin(ca) * linkDist;
      // Chain line
      g.lineStyle(2.5, 0xccaa44, 0.7);
      g.beginPath(); g.moveTo(C, C); g.lineTo(lcx, lcy); g.strokePath();
      // Chain link circle at end
      g.lineStyle(2, 0xddbb55, 0.8);
      g.strokeCircle(lcx, lcy, 5);
      g.fillStyle(0xffcc44, 0.5);
      g.fillCircle(lcx, lcy, 3);
    }
    // Spark at center
    g.fillStyle(0xffdd44, 0.9);
    g.fillCircle(C, C, 4);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(C, C, 2);
    // Outer warning ring
    g.lineStyle(1.5, 0xffaa00, 0.4);
    g.strokeCircle(C, C, 26);
    // Golden aura
    g.fillStyle(0xffcc44, 0.12);
    g.fillCircle(C, C, 26);
    g.generateTexture('skill_icon_chain_trap', S, S);

    g.destroy();
  }

  // ── Play a skill effect ──────────────────────────────────
  /**
   * Flight time (ms) of a single-target skill's projectile, or 0 when the
   * skill hits instantly. Callers delay damage by this so numbers and hit
   * reactions land when the projectile does. The effects below animate
   * their projectiles with exactly this duration.
   */
  getProjectileTravelMs(skillId: string, casterX: number, casterY: number, targetX: number, targetY: number): number {
    const dist = Phaser.Math.Distance.Between(casterX, casterY - 16, targetX, targetY - 16);
    switch (skillId) {
      case 'fireball': return Math.max(300, Math.min(600, dist * 1.5));
      case 'ice_arrow':
      case 'poison_arrow': return Math.max(250, Math.min(500, dist * 1.5));
      // AoE drop: the meteor lands this long after the cast. (ZoneScene's AoE
      // path currently applies damage immediately; see effectMeteor.)
      case 'meteor': return METEOR_FALL_MS;
      default: return 0;
    }
  }

  play(
    skillId: string,
    casterX: number,
    casterY: number,
    targetX?: number,
    targetY?: number,
    targets?: { x: number; y: number }[],
  ): void {
    const tx = targetX ?? casterX;
    const ty = targetY ?? casterY;
    if (Math.abs(tx - casterX) + Math.abs(ty - casterY) > 6) this.lastAim = Math.atan2(ty - casterY, tx - casterX);
    else if (targets && targets.length > 0) this.lastAim = Math.atan2(targets[0].y - casterY, targets[0].x - casterX);
    switch (skillId) {
      // Warrior
      case 'slash': this.effectSlash(casterX, casterY, tx, ty); break;
      case 'whirlwind': this.effectWhirlwind(casterX, casterY); break;
      case 'shield_wall': this.effectShieldWall(casterX, casterY); break;
      case 'war_stomp': this.effectWarStomp(casterX, casterY); break;
      case 'taunt_roar': this.effectTauntRoar(casterX, casterY); break;
      case 'vengeful_wrath': this.effectVengefulWrath(casterX, casterY); break;
      case 'charge': this.effectCharge(casterX, casterY, tx, ty); break;
      case 'lethal_strike': this.effectLethalStrike(casterX, casterY, tx, ty); break;
      case 'iron_fortress': this.effectIronFortress(casterX, casterY); break;
      case 'frenzy': this.effectFrenzy(casterX, casterY); break;
      case 'bleed_strike': this.effectBleedStrike(casterX, casterY, tx, ty); break;
      case 'dual_wield_mastery': this.effectDualWieldMastery(casterX, casterY); break;
      case 'unyielding': this.effectUnyielding(casterX, casterY); break;
      case 'life_regen': this.effectLifeRegen(casterX, casterY); break;
      case 'rampage': this.effectRampage(casterX, casterY); break;
      // Mage
      case 'fireball': this.effectFireball(casterX, casterY, tx, ty); break;
      case 'blizzard': this.effectBlizzard(tx, ty); break;
      case 'mana_shield': this.effectManaShield(casterX, casterY); break;
      case 'meteor': this.effectMeteor(tx, ty); break;
      case 'ice_armor': this.effectIceArmor(casterX, casterY); break;
      case 'chain_lightning': this.effectChainLightning(casterX, casterY, targets ?? []); break;
      case 'fire_wall': this.effectFireWall(tx, ty); break;
      case 'combustion': this.effectCombustion(tx, ty); break;
      case 'ice_arrow': this.effectIceArrow(casterX, casterY, tx, ty); break;
      case 'freeze': this.effectFreeze(tx, ty); break;
      case 'teleport': this.effectTeleport(casterX, casterY, tx, ty); break;
      case 'arcane_torrent': this.effectArcaneTorrent(tx, ty); break;
      // Rogue
      case 'backstab': this.effectBackstab(casterX, casterY, tx, ty); break;
      case 'poison_blade': this.effectPoisonBlade(casterX, casterY); break;
      case 'multishot': this.effectMultishot(casterX, casterY, targets); break;
      case 'vanish': this.effectVanish(casterX, casterY); break;
      case 'explosive_trap': this.effectExplosiveTrap(tx, ty); break;
      case 'arrow_rain': this.effectArrowRain(tx, ty); break;
      case 'death_mark': this.effectDeathMark(tx, ty); break;
      case 'shadow_step': this.effectShadowStep(casterX, casterY, tx, ty); break;
      case 'piercing_arrow': this.effectPiercingArrow(casterX, casterY, targets); break;
      case 'poison_arrow': this.effectPoisonArrow(casterX, casterY, tx, ty); break;
      case 'poison_cloud': this.effectPoisonCloud(tx, ty); break;
      case 'slow_trap': this.effectSlowTrap(tx, ty); break;
      case 'chain_trap': this.effectChainTrap(tx, ty); break;
      default:
        this.effectGeneric(tx, ty, 0xf39c12);
        break;
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  /** Base AoE radius of a skill in world px (iso half-width). */
  private aoePx(skillId: string, fallbackTiles = 2): number {
    let r = AOE_CACHE.get(skillId);
    if (r === undefined) {
      r = fallbackTiles;
      for (const cls of Object.values(AllClasses)) {
        const s = cls.skills.find(k => k.id === skillId);
        if (s?.aoeRadius) { r = s.aoeRadius; break; }
      }
      AOE_CACHE.set(skillId, r);
    }
    return r * TILE_R;
  }

  /**
   * Move a projectile from (x0,y0) to (x1,y1) over `dur` ms (real time, in
   * lock-step with the damage timer). `head` is called every frame with the
   * current position/progress; `trailEvery` px of travel calls `trail`.
   */
  private fly(
    x0: number, y0: number, x1: number, y1: number, dur: number,
    head: (x: number, y: number, u: number) => void,
    trail: ((x: number, y: number) => void) | null, trailEvery: number,
    onArrive: () => void, arc = 0,
  ): void {
    let acc = 0, lx = x0, ly = y0;
    this.e.task(dur, (u) => {
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * arc;
      head(x, y, u);
      if (trail) {
        const dx = x - lx, dy = y - ly;
        const seg = Math.sqrt(dx * dx + dy * dy);
        acc += seg;
        while (acc >= trailEvery) {
          acc -= trailEvery;
          const f = seg > 0 ? acc / seg : 0;
          trail(x - dx * f, y - dy * f);
        }
      }
      lx = x; ly = y;
    }, onArrive);
  }

  // ── Play basic attack effect ─────────────────────────────
  playAttack(attackerX: number, attackerY: number, targetX: number, targetY: number, isPlayer: boolean): void {
    const angle = Math.atan2(targetY - attackerY, targetX - attackerX);
    if (isPlayer) this.lastAim = angle;
    const s = isPlayer ? 1 : 0.75;
    const y = targetY - CH;
    this.fx.slash(targetX - Math.cos(angle) * 6, y, angle, PAL.steel.rim, { radius: 20 * s, life: 150, thick: 0.8 });
    this.fx.sparks(targetX, y, isPlayer ? 5 : 3, 0xfff2c0, { angle, spread: 1.2, speed: [90, 170], size: 0.8 * s });
  }

  // ── Play monster attack effect ───────────────────────────
  /** Claw rake over the player (monster melee contact). */
  playMonsterAttack(x: number, y: number): void {
    const cy = y - CH;
    const flip = Math.random() > 0.5 ? 1 : -1;
    // dark under-stroke + hot rake on top
    this.e.spawn('fx_claw', x, cy - 2, 220).normal().at(FX_DEPTH_AIR - 1).color(0x5a0a14)
      .scaleXY(0.55 * flip, 0.4, 0.66 * flip, 0.66, 3).spinning(0.35 * flip).fade(0.85, 0, 0, 2).vel(0, 30);
    this.e.spawn('fx_claw', x, cy - 4, 180).color(0xff5a3a)
      .scaleXY(0.5 * flip, 0.34, 0.6 * flip, 0.62, 3).spinning(0.35 * flip).fade(1, 0, 0, 1.6).vel(0, 36);
    this.e.spawn('fx_claw', x, cy - 4, 120).scaleXY(0.47 * flip, 0.3, 0.56 * flip, 0.55, 3).spinning(0.35 * flip).fade(0.9, 0, 0, 1.4).vel(0, 36);
    this.fx.sparks(x, cy, 5, 0xff6a4a, { angle: Math.PI / 2 + 0.3 * flip, spread: 1.6, speed: [60, 130], size: 0.75 });
    this.fx.glow(x, cy, 0xff3a2a, 30, 160, 1.2, 0.5);
  }

  playMonsterRangedAttack(
    sx: number, sy: number, tx: number, ty: number, color: number = 0xff6600, onImpact?: () => void,
  ): void {
    const x0 = sx, y0 = sy - CH, x1 = tx, y1 = ty - CH;
    const dist = Phaser.Math.Distance.Between(x0, y0, x1, y1);
    const duration = Math.max(200, Math.min(500, dist * 2));
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const r = (color >> 16) & 255, b = color & 255;
    const kind = r > 200 && b < 120 ? 'fire' : b > 200 && r < 120 ? 'frost' : 'shadow';
    const pal = PAL[kind];

    this.fx.glow(x0, y0, pal.rim, 22, 140, 1.2, 0.7);
    const glow = this.e.spawn('fx_glow', x0, y0, duration).color(pal.rim).scale(0.5, 0.55).fade(0.8, 0.8);
    const comet = this.e.spawn('fx_comet', x0, y0, duration).color(pal.mid).scaleXY(0.42, 0.5, 0.48, 0.5).spinning(ang).fade(1, 1);
    const core = this.e.spawn('fx_core', x0, y0, duration).scale(0.34).fade(1, 1);
    this.fly(x0, y0, x1, y1, duration, (x, y) => {
      glow.x = comet.x = core.x = x; glow.y = comet.y = core.y = y;
    }, (x, y) => {
      if (kind === 'fire') this.e.spawn('fx_flame_fire', x, y, 220).normal().at(FX_DEPTH_AIR - 1).origin(0.5, 0.7).scale(0.32, 0.08).vel(0, -30).spinning(ang + Math.PI / 2).fade(0.9, 0);
      else this.e.spawn(kind === 'frost' ? 'fx_flake' : 'fx_glow', x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6, 260)
        .color(pal.mid).scale(kind === 'frost' ? 0.3 : 0.22, 0.05).vel(0, -12).spinning(0, 3).fade(0.9, 0);
    }, 7, () => {
      this.e.kill(glow); this.e.kill(comet); this.e.kill(core);
      this.fx.flash(x1, y1, pal.rim, 18, 150);
      this.fx.sparks(x1, y1, 7, pal.mid, { angle: ang, spread: 2.2, speed: [70, 150], size: 0.8 });
      this.fx.ring(x1, ty, pal.rim, 6, 22, 260, { alpha: 0.8 });
      if (kind === 'fire') this.fx.smoke(x1, y1, 2, 0x5a4a44, { size: [0.25, 0.35], life: [380, 480] });
      onImpact?.();
    });
  }

  // ══════════════════════════════════════════════════════════
  // WARRIOR EFFECTS
  // ══════════════════════════════════════════════════════════

  private effectSlash(cx: number, cy: number, tx: number, ty: number): void {
    const ang = this.aimTo(cx, cy, tx, ty);
    const R = Phaser.Math.Clamp(Phaser.Math.Distance.Between(cx, cy, tx, ty) * 0.85, 30, 58);
    const y = cy - CH + 2;
    // broad forehand sweep: gold-edged steel arc through the target
    this.fx.swipe(cx, y, ang - 1.5, ang + 1.1, R, PAL.holy.rim, { thick: 1.9, sweepMs: 70, life: 230 });
    this.fx.swipe(cx, y + 3, ang - 1.3, ang + 0.9, R * 0.8, PAL.steel.rim, { thick: 0.9, sweepMs: 70, life: 180, delay: 25, core: false });
    const ix = tx, iy = ty - CH;
    this.fx.flash(ix, iy, PAL.holy.mid, 16, 120, 40);
    this.fx.sparks(ix, iy, 8, PAL.holy.mid, { angle: ang + 0.5, spread: 1.4, speed: [110, 220], delay: 40 });
    this.fx.glint(ix, iy, 0xffffff, 26, 180, 40, ang);
  }

  private effectWhirlwind(cx: number, cy: number): void {
    const R = this.aoePx('whirlwind') * 0.62;
    const y = cy - 14;
    const a0 = this.lastAim;
    // two blades chasing each other round the warrior (1.25 turns)
    this.fx.swipe(cx, y, a0, a0 + Math.PI * 2.5, R, PAL.steel.rim, { thick: 1.3, sweepMs: 300, life: 200, step: 0.3 });
    this.fx.swipe(cx, y + 2, a0 + Math.PI, a0 + Math.PI * 3.3, R * 0.78, PAL.holy.rim, { thick: 0.8, sweepMs: 300, life: 170, step: 0.34, core: false, delay: 30 });
    for (let i = 0; i < 10; i++) {
      const a = a0 + (i / 10) * Math.PI * 2.5;
      this.e.spawn('fx_streak', cx + Math.cos(a) * R, y + Math.sin(a) * R * FLAT, 200).polar(a + Math.PI / 2, 180, 0.5).face(0, 0.4)
        .scaleXY(0.5, 0.7, 0.2, 0.3).color(0xffffff).fade(0.9, 0).wait(i * 30);
    }
    this.fx.ring(cx, cy, PAL.steel.rim, R * 0.4, R * 1.3, 420, { alpha: 0.7 });
    this.fx.shock(cx, cy, PAL.steel.mid, R * 0.3, R * 1.5, 480, 0.4, 120);
    // dust kicked out at the edge
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.fx.smoke(cx + Math.cos(a) * R, cy + Math.sin(a) * R * FLAT, 1, 0xc8b89a, { radius: 4, speed: [30, 60], size: [0.3, 0.45], life: [380, 520], rise: 10, alpha: 0.6, delay: i * 30 });
    }
  }

  private effectShieldWall(cx: number, cy: number): void {
    const y = cy - 24;
    const P = PAL.holy;
    this.fx.gather(cx, y, 10, 'fx_glow', P.mid, 44, 140, 0.2);
    this.fx.decal(cx, cy, 'fx_rune', P.rim, 40, 900, { add: true, alpha: 0.95, spin: 0.6, delay: 60, fadeIn: 0.1 });
    // a ring of golden plates snaps into place around the warrior
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      this.plate(cx, y + 4, 36, a, 0.6, 780, P.mid, P.dark, 0.15, 0.85, Math.sin(a) > 0, 100 + i * 22);
    }
    this.fx.flash(cx, y, P.mid, 26, 200, 110);
    this.fx.beam(cx, cy, P.rim, 90, 40, 520, { alpha: 0.4, delay: 100 });
    this.fx.motes(cx, y, 12, 'fx_spark', [P.core, P.mid], { radius: 30, speed: [10, 30], rise: 40, size: [0.2, 0.34], life: [400, 700], delay: 120 });
    this.fx.ring(cx, cy, P.rim, 16, 56, 420, { delay: 110 });
    this.fx.shock(cx, cy, P.mid, 12, 50, 380, 0.6, 110);
  }

  private effectWarStomp(cx: number, cy: number): void {
    const R = this.aoePx('war_stomp');
    this.e.shake(240, 0.011);
    this.fx.flash(cx, cy - 6, PAL.earth.core, 30, 160);
    this.fx.decal(cx, cy, 'fx_crack', 0xffffff, R * 0.55, 1300, { alpha: 0.95, pow: 4 });
    this.fx.decal(cx, cy, 'fx_crack_glow', PAL.fire.mid, R * 0.55, 420, { add: true, alpha: 1, pow: 1.5 });
    this.fx.shock(cx, cy, PAL.earth.mid, 10, R, 380, 0.9);
    this.fx.ring(cx, cy, 0xffffff, 8, R * 0.8, 260);
    this.fx.ring(cx, cy, PAL.earth.rim, 10, R * 1.1, 480, { delay: 60, alpha: 0.8 });
    this.fx.debris(cx, cy, 10, { speed: [70, 150] });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.fx.smoke(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45 * FLAT, 1, 0xc8b08a, {
        radius: 3, speed: [50, 90], size: [0.35, 0.55], life: [450, 650], rise: 12, alpha: 0.75, delay: 20,
      });
    }
    this.fx.sparks(cx, cy - 6, 8, PAL.earth.mid, { speed: [120, 220], flat: 0.5, gravity: 200 });
  }

  private effectTauntRoar(cx: number, cy: number): void {
    const R = this.aoePx('taunt_roar');
    const hy = cy - 36;
    this.fx.glow(cx, hy, PAL.rage.rim, 34, 260, 1.4, 0.8);
    // shout waves: crescents flying outward in 8 directions, twice
    for (let w = 0; w < 2; w++) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.e.spawn('fx_slash', cx + Math.cos(a) * 10, hy + Math.sin(a) * 6 + 10, 360).origin(0.5, 1).color(w ? PAL.rage.mid : PAL.rage.rim)
          .polar(a, 170, 0.55).damp(2).scaleXY(0.18, 0.08, 0.34, 0.14, 2).spinning(a + Math.PI / 2).fade(0.9, 0, 0.05, 1.5).wait(w * 110);
      }
    }
    this.fx.ring(cx, cy, PAL.rage.rim, 14, R, 480);
    this.fx.ring(cx, cy, PAL.rage.mid, 10, R * 0.8, 440, { delay: 110, alpha: 0.8 });
    this.fx.shock(cx, cy, PAL.rage.rim, 12, R * 0.9, 420, 0.5);
    this.fx.sparks(cx, hy, 10, PAL.rage.mid, { speed: [120, 220], flat: 0.6 });
  }

  private effectVengefulWrath(cx: number, cy: number): void {
    const P = PAL.rage;
    this.fx.gather(cx, cy - 24, 12, 'fx_ember', P.mid, 40, 150, 0.4);
    // eruption: crown of flames round the feet + a tall pillar behind
    this.fx.flames(cx, cy, 14, P.flame, { rx: 26, size: [0.8, 1.25], rise: [50, 90], life: [420, 620], delay: 120, stagger: 200 });
    this.fx.flames(cx, cy - 2, 5, PAL.fire.flame, { rx: 8, size: [1.1, 1.5], rise: [90, 130], life: [360, 480], delay: 130, stagger: 100, depthOff: 90 });
    this.fx.decal(cx, cy, 'fx_crack_glow', P.rim, 34, 600, { add: true, alpha: 0.9, delay: 120, pow: 2 });
    this.fx.glow(cx, cy - 24, P.rim, 80, 520, 1.2, 0.45, 120);
    this.fx.flash(cx, cy - 24, P.mid, 16, 160, 130);
    this.fx.shock(cx, cy, P.rim, 10, 64, 420, 0.9, 130);
    this.fx.ring(cx, cy, P.mid, 12, 70, 480, { delay: 150 });
    this.fx.motes(cx, cy - 16, 14, 'fx_ember', [P.mid, PAL.fire.mid, PAL.fire.core], { radius: 22, speed: [10, 40], rise: 110, size: [0.35, 0.55], life: [500, 800], delay: 180, spin: 4 });
  }

  private effectCharge(cx: number, cy: number, tx: number, ty: number): void {
    const ang = this.aimTo(cx, cy, tx, ty);
    const sy = cy - CH, ey = ty - CH;
    const dist = Phaser.Math.Distance.Between(cx, sy, tx, ey);
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    // speed lines streaking toward the target
    for (let i = 0; i < 9; i++) {
      const off = (Math.random() - 0.5) * 26;
      const u = Math.random() * 0.6;
      this.e.spawn('fx_streak', cx + Math.cos(ang) * dist * u + nx * off, sy + Math.sin(ang) * dist * u + ny * off * 0.6, 170)
        .polar(ang, 420, 1).face(0, 0.5).scaleXY(0.9, 0.7, 0.4, 0.3).color(i % 2 ? PAL.holy.mid : 0xffffff).fade(0.9, 0).wait(i * 12);
    }
    for (let i = 0; i < 5; i++) {
      const u = i / 5;
      this.fx.smoke(cx + (tx - cx) * u, cy + (ty - cy) * u, 1, 0xc8b89a, { radius: 5, speed: [15, 30], size: [0.28, 0.4], life: [360, 480], alpha: 0.6, delay: i * 18 });
    }
    // impact
    this.e.after(70, () => {
      this.e.shake(150, 0.008);
      this.fx.flash(tx, ey, PAL.holy.mid, 26, 170);
      this.fx.sparks(tx, ey, 12, PAL.holy.mid, { angle: ang, spread: 1.8, speed: [140, 260] });
      this.fx.shock(tx, ty, PAL.earth.mid, 8, 46, 340, 0.8);
      this.fx.glint(tx, ey, 0xffffff, 40, 200, 0, ang + Math.PI / 4);
      this.fx.debris(tx, ty, 4, { speed: [50, 100] });
    });
  }

  private effectLethalStrike(cx: number, cy: number, tx: number, ty: number): void {
    const ang = this.aimTo(cx, cy, tx, ty);
    const y = ty - CH;
    this.e.shake(160, 0.008);
    // overhead cleave: tall vertical crescent crashing down + counter-slash
    this.fx.slash(tx, y - 4, Math.PI / 2 + 0.25, PAL.blood.mid, { radius: 44, life: 260, thick: 0.9, sweep: 1.2 });
    this.fx.slash(tx, y, ang - 0.4, PAL.steel.rim, { radius: 30, life: 220, thick: 0.9, sweep: 1.1, delay: 70, flip: true });
    this.fx.flash(tx, y, PAL.blood.mid, 20, 150, 10);
    this.fx.glint(tx, y, 0xffffff, 50, 220, 10, Math.PI / 4);
    this.fx.glint(tx, y, PAL.blood.mid, 36, 260, 40, 0);
    this.fx.sparks(tx, y, 12, PAL.blood.mid, { speed: [140, 260], size: 1.1, delay: 10 });
    this.fx.shock(tx, ty, PAL.blood.rim, 8, 42, 320, 0.7, 20);
    this.bloodSpray(tx, y, ang, 7);
  }

  private effectIronFortress(cx: number, cy: number): void {
    const y = cy - 18;
    this.fx.gather(cx, y, 10, 'fx_glow', PAL.steel.rim, 44, 140, 0.18);
    this.fx.decal(cx, cy, 'fx_rune', PAL.steel.rim, 38, 900, { add: true, alpha: 0.85, spin: -0.5, delay: 60 });
    // two tiers of steel plates forming a dome
    for (let tier = 0; tier < 2; tier++) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + tier * (Math.PI / 6);
        const front = Math.sin(a) > 0;
        const r = tier ? 30 : 40;
        this.plate(cx, y - tier * 18 + 6, r, a, 0, 800, tier ? 0x9fb4d4 : 0x7f97bb, PAL.steel.dark, 0.2, 0.72 - tier * 0.12, front, 100 + tier * 60 + i * 20);
      }
    }
    this.e.after(170, () => {
      this.fx.flash(cx, y - 6, PAL.steel.mid, 26, 180);
      this.fx.glint(cx + 10, y - 20, 0xffffff, 40, 260, 0, 0.3);
      this.fx.ring(cx, cy, PAL.steel.rim, 14, 50, 420);
      this.fx.sparks(cx, y, 8, PAL.steel.mid, { speed: [80, 160], flat: 0.6 });
    });
  }

  private effectFrenzy(cx: number, cy: number): void {
    const y = cy - 20;
    // two heartbeat pulses
    for (let k = 0; k < 2; k++) {
      this.fx.glow(cx, y, PAL.rage.rim, 60, 260, 1.3, 0.75, k * 150);
      this.fx.ring(cx, cy, PAL.rage.rim, 10, 46, 320, { delay: k * 150 });
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.fx.flames(cx + Math.cos(a) * 26, cy + Math.sin(a) * 13, 1, PAL.rage.flame, { rx: 2, size: [0.45, 0.75], rise: [60, 100], life: [320, 460], delay: (i % 5) * 50 });
    }
    this.fx.sparks(cx, y, 10, PAL.rage.mid, { angle: -Math.PI / 2, spread: 2.2, speed: [90, 180], gravity: -80 });
    this.fx.motes(cx, y, 8, 'fx_ember', [PAL.rage.mid, PAL.rage.core], { radius: 14, rise: 110, speed: [10, 30], size: [0.3, 0.45], life: [400, 650], spin: 5, delay: 60 });
  }

  private effectBleedStrike(cx: number, cy: number, tx: number, ty: number): void {
    const ang = this.aimTo(cx, cy, tx, ty);
    const R = Phaser.Math.Clamp(Phaser.Math.Distance.Between(cx, cy, tx, ty) * 0.85, 30, 56);
    const y = ty - CH;
    // backhand rip: arc travels the other way, blood-red
    this.fx.swipe(cx, cy - CH + 2, ang + 1.3, ang - 1.2, R, PAL.blood.mid, { thick: 1.8, sweepMs: 70, life: 230 });
    this.fx.swipe(cx, cy - CH + 5, ang + 1.1, ang - 1.0, R * 0.8, PAL.blood.rim, { thick: 0.9, sweepMs: 70, life: 180, delay: 25, core: false });
    this.fx.flash(tx, y, PAL.blood.mid, 18, 140, 40);
    this.bloodSpray(tx, y, ang - 0.4, 10);
    // lingering drip
    for (let i = 0; i < 5; i++) {
      this.e.spawn('fx_drop', tx + (Math.random() - 0.5) * 12, y + 2, 360).normal().at(FX_DEPTH_AIR - 1).color(PAL.blood.mid)
        .vel(0, 20).accel(0, 260).scale(0.32, 0.26).fade(1, 0.6).wait(160 + i * 90);
    }
    this.fx.decal(tx, ty, 'fx_puddle', PAL.blood.rim, 11, 1300, { alpha: 0.75, grow: 1.4, delay: 200, fadeIn: 0.1 });
  }

  private effectDualWieldMastery(cx: number, cy: number): void {
    const y = cy - 22;
    this.fx.slash(cx, y, Math.PI * 0.25, PAL.holy.mid, { radius: 22, life: 240, sweep: 1.0 });
    this.fx.slash(cx, y, Math.PI * 0.75, PAL.steel.rim, { radius: 22, life: 240, sweep: 1.0, delay: 60, flip: true });
    this.fx.glint(cx, y - 4, 0xffffff, 40, 260, 110);
    this.fx.motes(cx, y, 8, 'fx_spark', [PAL.holy.mid, 0xffffff], { radius: 12, speed: [30, 70], size: [0.18, 0.3], life: [300, 500], delay: 110 });
  }

  private effectUnyielding(cx: number, cy: number): void {
    const y = cy - 20;
    this.fx.decal(cx, cy, 'fx_crack', 0xffffff, 26, 900, { alpha: 0.6 });
    this.fx.shock(cx, cy, PAL.earth.mid, 10, 44, 380, 0.8);
    // stone chips spiral up around the warrior
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.e.spawn(i % 2 ? 'fx_rock0' : 'fx_rock1', 0, 0, 620).circle(cx, cy - 4, 24, a, 4, -6, 0.5)
        .normal().world(Math.sin(a) > 0 ? 110 : 20).vel(0, -55).scale(0.9, 0.5).spinning(a, 6).fade(1, 0, 0.1, 3).wait(i * 20);
    }
    this.fx.beam(cx, cy, PAL.holy.rim, 64, 30, 520, { alpha: 0.55 });
    this.fx.glow(cx, y, PAL.holy.mid, 64, 480, 1.1, 0.6);
    this.fx.glint(cx, y - 14, 0xffffff, 36, 260, 80);
  }

  private effectLifeRegen(cx: number, cy: number): void {
    const y = cy - 16;
    this.fx.decal(cx, cy, 'fx_glow', PAL.nature.rim, 26, 700, { add: true, alpha: 0.6 });
    this.fx.ring(cx, cy, PAL.nature.mid, 8, 32, 420);
    this.fx.motes(cx, y, 6, 'fx_plus', [PAL.nature.mid, PAL.nature.core], { radius: 16, speed: [5, 15], rise: 50, size: [0.35, 0.5], life: [500, 750], drag: 2 });
    this.fx.motes(cx, y + 6, 10, 'fx_ember', [PAL.nature.mid, PAL.nature.rim, PAL.holy.mid], { radius: 18, speed: [10, 30], rise: 70, size: [0.28, 0.4], life: [500, 800], spin: 4 });
  }

  private effectRampage(cx: number, cy: number): void {
    const R = this.aoePx('rampage');
    this.e.shake(280, 0.012);
    const y = cy - 14;
    const a0 = this.lastAim;
    // blood-red cyclone: three blades spiralling outward
    this.fx.swipe(cx, y, a0, a0 + Math.PI * 3, R * 0.42, PAL.rage.mid, { thick: 1.3, sweepMs: 330, life: 190, step: 0.34 });
    this.fx.swipe(cx, y + 1, a0 + 2.1, a0 + 2.1 + Math.PI * 3, R * 0.55, PAL.blood.mid, { thick: 1.1, sweepMs: 330, life: 190, step: 0.36, core: false, delay: 20 });
    this.fx.swipe(cx, y + 2, a0 + 4.2, a0 + 4.2 + Math.PI * 2.5, R * 0.7, PAL.rage.rim, { thick: 0.9, sweepMs: 300, life: 170, step: 0.38, core: false, delay: 60 });
    this.fx.flash(cx, y, PAL.rage.core, 34, 200);
    this.fx.decal(cx, cy, 'fx_crack', 0xffffff, R * 0.55, 1300, { alpha: 0.9 });
    this.fx.decal(cx, cy, 'fx_crack_glow', PAL.rage.rim, R * 0.55, 700, { add: true, pow: 1.5 });
    this.fx.shock(cx, cy, PAL.rage.rim, 10, R, 420, 0.9);
    this.fx.ring(cx, cy, PAL.rage.mid, 10, R * 1.15, 520, { delay: 90 });
    this.fx.flames(cx, cy, 12, PAL.rage.flame, { rx: R * 0.4, size: [0.5, 0.9], rise: [50, 90], life: [300, 480], stagger: 220 });
    this.fx.debris(cx, cy, 8, { speed: [80, 160] });
    this.fx.sparks(cx, y, 14, PAL.rage.mid, { speed: [160, 280], flat: 0.55 });
    this.fx.smoke(cx, cy - 4, 6, 0x9a7a6a, { radius: R * 0.4, speed: [40, 70], size: [0.35, 0.55], life: [450, 650], alpha: 0.6, delay: 60 });
  }

  private effectFireball(cx: number, cy: number, tx: number, ty: number): void {
    const x0 = cx + Math.cos(this.lastAim) * 10, y0 = cy - 22, x1 = tx, y1 = ty - CH;
    const dur = this.getProjectileTravelMs('fireball', cx, cy, tx, ty);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const P = PAL.fire;
    // launch: muzzle bloom
    this.fx.flash(x0, y0, P.mid, 20, 160);
    this.fx.sparks(x0, y0, 4, P.mid, { angle: ang, spread: 1.2, speed: [60, 120], size: 0.7 });
    const glow = this.e.spawn('fx_glow', x0, y0, dur).color(P.rim).scale(0.75, 0.9).fade(0.85, 0.85);
    const comet = this.e.spawn('fx_comet', x0, y0, dur).color(P.mid).scaleXY(0.6, 0.75, 0.75, 0.75).spinning(ang).fade(1, 1);
    const flameHead = this.e.spawn(P.flame, x0, y0, dur).normal().at(FX_DEPTH_AIR - 1).origin(0.5, 0.55).scale(0.5, 0.5).spinning(ang - Math.PI / 2, 0).fade(1, 1);
    const core = this.e.spawn('fx_core', x0, y0, dur).scale(0.45, 0.5).fade(1, 1);
    let flip = 1;
    this.fly(x0, y0, x1, y1, dur, (x, y, u) => {
      glow.x = comet.x = core.x = flameHead.x = x; glow.y = comet.y = core.y = flameHead.y = y;
      flameHead.rot = ang - Math.PI / 2 + Math.sin(u * 40) * 0.12;
    }, (x, y) => {
      flip = -flip;
      this.e.spawn(P.flame, x + flip * 2, y, 260).normal().at(FX_DEPTH_AIR - 1).origin(0.5, 0.6)
        .scale(0.42, 0.1, 2).vel(-Math.cos(ang) * 20, -30).spinning(ang - Math.PI / 2 + flip * 0.3, flip * 2).fade(1, 0, 0, 1.4);
      if (Math.random() < 0.3) this.e.spawn('fx_ember', x, y, 380).color(P.mid).polar(Math.random() * 6.28, 30).accel(0, -60).scale(0.3, 0.05).fade(1, 0);
      if (Math.random() < 0.18) this.fx.smoke(x, y - 2, 1, 0x4a3a36, { radius: 2, speed: [5, 12], size: [0.18, 0.26], life: [320, 420], alpha: 0.5, rise: 30 });
    }, 6, () => {
      this.e.kill(glow); this.e.kill(comet); this.e.kill(core); this.e.kill(flameHead);
      this.fireballExplosion(x1, y1, ty, ang);
    });
  }

  private fireballExplosion(x: number, y: number, gy: number, ang: number): void {
    const P = PAL.fire;
    this.e.shake(90, 0.003);
    this.fx.flash(x, y, P.mid, 34, 170);
    this.fx.glow(x, y, P.rim, 90, 320, 1.2, 0.6);
    this.fx.shock(x, gy, P.rim, 8, 46, 320, 0.8);
    // flame petals bursting outward
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
      this.e.spawn(P.flame, x, y, 300 + Math.random() * 120).normal().at(FX_DEPTH_AIR - 1).origin(0.5, 0.9)
        .polar(a, 90 + Math.random() * 50, 0.7).damp(5).accel(0, -60).scaleXY(0.35, 0.3, 0.2, 0.75, 2).spinning(a + Math.PI / 2, 0).fade(1, 0, 0, 1.2);
    }
    this.fx.sparks(x, y, 10, P.mid, { angle: ang, spread: 3, speed: [120, 240], gravity: 160 });
    this.fx.motes(x, y, 8, 'fx_ember', [P.mid, P.core, P.rim], { speed: [40, 110], rise: 60, size: [0.25, 0.4], life: [400, 700], spin: 6 });
    this.fx.smoke(x, y - 4, 4, 0x4a3a36, { radius: 8, speed: [15, 35], size: [0.35, 0.5], life: [550, 800], rise: 35, alpha: 0.7, delay: 90 });
    this.fx.decal(x, gy, 'fx_scorch', 0xffffff, 18, 1400, { alpha: 0.7, delay: 40 });
  }

  private effectBlizzard(cx: number, cy: number): void {
    const R = this.aoePx('blizzard') * 0.85;
    const P = PAL.frost;
    this.fx.decal(cx, cy, 'fx_frost', 0xffffff, R, 1300, { alpha: 0.75, fadeIn: 0.15, grow: 1.08 });
    this.fx.ring(cx, cy, P.rim, R * 0.4, R, 500, { alpha: 0.7 });
    // wind-driven ice shards in three waves
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = R * Math.sqrt(Math.random());
      const gx = cx + Math.cos(a) * r, gy = cy + Math.sin(a) * r * FLAT;
      const d = (i % 3) * 180 + Math.random() * 160;
      const fall = 150 + Math.random() * 40;
      const drop = 110;
      this.e.spawn('fx_shard_frost', gx - drop * 0.35, gy - drop, fall).normal().at(FX_DEPTH_AIR - 1)
        .vel(drop * 0.35 / (fall / 1000), drop / (fall / 1000)).face(Math.PI / 2).scale(0.42, 0.5).fade(0.95, 1, 0.2).wait(d);
      this.e.spawn('fx_streak', gx - drop * 0.35, gy - drop, fall).vel(drop * 0.35 / (fall / 1000), drop / (fall / 1000)).face(0, 0).scaleXY(0.6, 0.5, 0.9, 0.3).color(P.mid).fade(0.5, 0.8).wait(d);
      this.e.after(d + fall, () => {
        this.e.spawn('fx_spark', gx, gy - 2, 200).color(P.mid).scale(0.35, 0.05, 2).fade(1, 0).spinning(Math.random() * 3);
        if (i % 3 === 0) this.fx.ring(gx, gy, P.mid, 2, 12, 240, { alpha: 0.8 });
        this.e.spawn('fx_shard_frost', gx, gy, 260 + Math.random() * 200).normal().world(60).origin(0.5, 0.9).scale(0.32, 0.28).spinning(0.4 + Math.random() * 0.3).fade(1, 0, 0, 3);
      });
    }
    this.fx.motes(cx, cy - 40, 16, 'fx_flake', [0xffffff, P.mid], { radius: R * 0.8, speed: [20, 50], gravity: 40, size: [0.3, 0.5], life: [600, 900], spin: 3, angle: 0.4, spread: 0.8 });
    this.fx.smoke(cx, cy - 6, 6, 0xcfefff, { radius: R * 0.7, speed: [10, 30], size: [0.45, 0.7], life: [700, 950], alpha: 0.35, rise: 8, delay: 200 });
  }

  private effectManaShield(cx: number, cy: number): void {
    const y = cy - 22;
    const P = PAL.arcane;
    this.fx.gather(cx, y, 12, 'fx_spark', P.mid, 44, 150, 0.22);
    this.fx.decal(cx, cy, 'fx_rune', P.rim, 34, 850, { add: true, alpha: 0.9, spin: 0.9, delay: 100 });
    // bubble pops in with overshoot, shimmers, fades
    this.e.spawn('fx_bubble', cx, y, 760).normal().at(FX_DEPTH_AIR - 1).color(P.rim).scaleXY(0.25, 0.25, 0.72, 0.7, 6).fade(0.6, 0, 0.1, 2.5).wait(120);
    this.e.spawn('fx_bubble', cx, y, 760).color(0x9a7cff).scaleXY(0.25, 0.25, 0.72, 0.7, 6).fade(0.9, 0, 0.1, 2.5).flicker(0.15).wait(120);
    this.e.spawn('fx_bubble', cx, y, 380).color(P.mid).scale(0.5, 0.85, 3).fade(0.6, 0, 0, 1.2).wait(120);
    this.fx.flash(cx, y, P.mid, 22, 180, 120);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.e.spawn('fx_spark', 0, 0, 640).color(i % 2 ? P.mid : P.core).circle(cx, y, 28, a, 3.5, 0, 0.55)
        .scale(0.3, 0.12).fade(1, 0, 0.1).world(Math.sin(a) > 0 ? 120 : 30).add().wait(140);
    }
  }

  private effectMeteor(cx: number, cy: number): void {
    const R = this.aoePx('meteor');
    const P = PAL.fire;
    const fall = METEOR_FALL_MS;
    // ZoneScene centres the AoE on the caster: land a little ahead of them so
    // the mage stays readable while the blast still covers the damage area.
    cx += Math.cos(this.lastAim) * R * 0.4;
    cy += Math.sin(this.lastAim) * R * 0.4 * FLAT;
    // warning rune + growing shadow
    this.fx.decal(cx, cy, 'fx_rune', P.rim, R * 0.7, fall + 200, { add: true, alpha: 0.9, spin: 1.2, fadeIn: 0.3, pow: 6 });
    this.e.spawn('fx_glow', cx, cy, fall).normal().ground(40).color(0x000000).scaleXY(0.3, 0.15, 1.2, 0.6).fade(0, 0.6);
    const x0 = cx - 90, y0 = cy - 260, y1 = cy - 10;
    const glow = this.e.spawn('fx_glow', x0, y0, fall).color(P.rim).scale(1.3, 1.6).fade(0.9, 0.9);
    const ang = Math.atan2(y1 - y0, cx - x0);
    const comet = this.e.spawn('fx_comet', x0, y0, fall).color(P.mid).scaleXY(1.4, 1.4, 1.6, 1.4).spinning(ang).fade(1, 1);
    const rock = this.e.spawn('fx_rock0', x0, y0, fall).normal().at(FX_DEPTH_AIR - 1).scale(1.8).spinning(0, 8).color(0x8a6a5a).fade(1, 1);
    this.fly(x0, y0, cx, y1, fall, (x, y) => {
      glow.x = comet.x = rock.x = x; glow.y = comet.y = rock.y = y;
    }, (x, y) => {
      this.e.spawn(P.flame, x, y, 280).normal().at(FX_DEPTH_AIR - 2).origin(0.5, 0.6).scale(0.8, 0.2, 2)
        .spinning(ang - Math.PI / 2 + (Math.random() - 0.5) * 0.5).vel(-20, -30).fade(1, 0, 0, 1.3);
      if (Math.random() < 0.4) this.fx.smoke(x, y, 1, 0x3a302e, { radius: 3, speed: [5, 15], size: [0.3, 0.45], life: [380, 520], alpha: 0.55, rise: 20 });
    }, 9, () => {
      this.e.kill(glow); this.e.kill(comet); this.e.kill(rock);
      this.meteorExplosion(cx, cy, R);
    });
  }

  private meteorExplosion(x: number, gy: number, R: number): void {
    const P = PAL.fire;
    const y = gy - 12;
    this.e.shake(320, 0.015);
    this.fx.flash(x, y, P.core, 50, 220);
    this.fx.glow(x, y, P.rim, R * 2, 420, 1.15, 0.7);
    this.fx.shock(x, gy, P.mid, 12, R * 1.1, 420, 0.75);
    this.fx.ring(x, gy, P.core, 10, R * 0.9, 300, { alpha: 0.8 });
    this.fx.ring(x, gy, P.rim, 12, R * 1.25, 560, { delay: 70 });
    this.fx.decal(x, gy, 'fx_scorch', 0xffffff, R * 0.6, 2200, { alpha: 0.85, pow: 5 });
    this.fx.decal(x, gy, 'fx_crack_glow', P.mid, R * 0.6, 900, { add: true, pow: 2 });
    this.fx.flames(x, gy, 16, P.flame, { rx: R * 0.55, size: [0.7, 1.2], rise: [60, 120], life: [360, 600], stagger: 200 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.e.spawn(P.flame, x, y, 360).normal().at(FX_DEPTH_AIR - 1).origin(0.5, 0.9)
        .polar(a, 150 + Math.random() * 60, 0.55).damp(5).accel(0, -80).scaleXY(0.45, 0.4, 0.3, 0.9, 2).spinning(a + Math.PI / 2).fade(1, 0, 0, 1.2);
    }
    this.fx.debris(x, gy, 12, { speed: [90, 180], tint: 0xb89a8a });
    this.fx.sparks(x, y, 14, P.mid, { speed: [160, 300], gravity: 200, size: 1.1 });
    this.fx.motes(x, y, 12, 'fx_ember', [P.mid, P.core, P.rim], { radius: R * 0.3, speed: [40, 120], rise: 80, size: [0.3, 0.5], life: [600, 1000], spin: 6 });
    this.fx.smoke(x, gy - 10, 10, 0x4a3c38, { radius: R * 0.4, speed: [20, 50], size: [0.5, 0.8], life: [800, 1100], rise: 40, alpha: 0.75, delay: 120 });
  }

  private effectIceArmor(cx: number, cy: number): void {
    const P = PAL.frost;
    this.fx.decal(cx, cy, 'fx_frost', 0xffffff, 30, 900, { alpha: 0.8, fadeIn: 0.15 });
    // crystal spikes erupt in a ring, then shatter into flakes
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const px = cx + Math.cos(a) * 20, py = cy + Math.sin(a) * 10;
      const lean = Math.cos(a) * 0.45;
      this.e.spawn('fx_shard_frost', px, py, 520).normal().world(Math.sin(a) > 0 ? 50 : -10).origin(0.5, 1)
        .scaleXY(0.5, 0.1, 0.55, 0.75, 6).spinning(lean).fade(1, 0, 0, 5).wait(i * 18);
      this.e.after(420 + i * 18, () => {
        this.fx.motes(px, py - 14, 2, 'fx_flake', [0xffffff, P.mid], { speed: [30, 70], gravity: 60, size: [0.25, 0.35], life: [300, 450], spin: 4 });
      });
    }
    this.fx.flash(cx, cy - 22, P.mid, 26, 200, 60);
    this.fx.ring(cx, cy, P.rim, 10, 42, 420, { delay: 40 });
    this.fx.glint(cx - 8, cy - 38, 0xffffff, 34, 260, 200);
    this.fx.motes(cx, cy - 20, 8, 'fx_spark', [0xffffff, P.mid], { radius: 18, speed: [10, 30], rise: 30, size: [0.15, 0.28], life: [400, 700], delay: 100 });
  }

  private effectChainLightning(cx: number, cy: number, targets: { x: number; y: number }[]): void {
    const P = PAL.lightning;
    const hx = cx + Math.cos(this.lastAim) * 8, hy = cy - 26;
    this.fx.flash(hx, hy, P.mid, 22, 160);
    if (targets.length === 0) {
      // Nothing in range: a bolt cracks down beside the caster
      const gx = cx + Math.cos(this.lastAim) * 30, gy = cy + Math.sin(this.lastAim) * 15;
      this.fx.bolt(gx, gy - 120, gx, gy, P.mid, 240, 2.2, 0, P.dark);
      this.fx.bolt(gx + 4, gy - 120, gx, gy, P.rim, 160, 1.4, 60);
      this.fx.flash(gx, gy - 4, P.mid, 22, 160);
      this.fx.ring(gx, gy, P.rim, 4, 24, 260);
      this.fx.sparks(gx, gy - 4, 8, P.mid, { speed: [80, 180] });
      return;
    }
    let px = hx, py = hy;
    targets.forEach((t, idx) => {
      const x0 = px, y0 = py, x1 = t.x, y1 = t.y - CH;
      const d = idx * 55;
      this.fx.bolt(x0, y0, x1, y1, P.mid, 240, 2.2, d, P.dark);
      this.fx.bolt(x0, y0, x1, y1, P.rim, 170, 1.4, d + 80);
      this.e.after(d, () => {
        this.fx.flash(x1, y1, P.mid, 22, 160);
        this.fx.sparks(x1, y1, 7, P.core, { speed: [90, 190], size: 0.85, tint2: P.rim });
        this.fx.ring(x1, t.y, P.rim, 4, 22, 260);
        this.fx.glint(x1, y1, 0xffffff, 30, 180);
      });
      px = x1; py = y1;
    });
  }

  private effectFireWall(cx: number, cy: number): void {
    const R = this.aoePx('fire_wall') * 0.8;
    const P = PAL.fire;
    this.fx.decal(cx, cy, 'fx_scorch', 0xffffff, R * 1.15, 1700, { alpha: 0.6, fadeIn: 0.1 });
    this.fx.shock(cx, cy, P.rim, R * 0.3, R, 360, 0.7);
    // ring of flame pillars sweeping around the caster
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const gx = cx + Math.cos(a) * R, gy = cy + Math.sin(a) * R * FLAT;
      const d = i * 18;
      for (let k = 0; k < 3; k++) {
        this.e.spawn(P.flame, gx + (Math.random() - 0.5) * 6, gy, 520 + k * 120).normal().world(10).origin(0.5, 0.9)
          .vel(0, -20).scaleXY(0.55 - k * 0.1, 0.2, 0.4 - k * 0.08, 1.2 - k * 0.25, 3).spinning((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.4)
          .fade(1, 0, 0.1, 2).wait(d + k * 110);
      }
      this.fx.glow(gx, gy - 12, P.rim, 34, 700, 1.1, 0.55, d);
      this.fx.motes(gx, gy - 10, 1, 'fx_ember', [P.mid, P.core], { speed: [10, 30], rise: 90, size: [0.25, 0.35], life: [500, 800], spin: 5, delay: d + 100 });
    }
    this.fx.smoke(cx, cy - 20, 5, 0x4a3c38, { radius: R, speed: [8, 20], size: [0.35, 0.55], life: [700, 900], rise: 40, alpha: 0.45, delay: 300 });
  }

  private effectCombustion(tx: number, ty: number): void {
    const P = PAL.fire;
    const y = ty - CH;
    // brief inward flare, then the target erupts
    this.fx.gather(tx, y, 8, 'fx_ember', P.mid, 26, 70, 0.35);
    this.e.after(60, () => {
      this.e.shake(140, 0.006);
      this.fx.flash(tx, y, P.core, 40, 200);
      this.fx.glow(tx, y, P.rim, 100, 360, 1.2, 0.7);
      this.fx.flames(tx, ty, 10, P.flame, { rx: 10, size: [0.7, 1.1], rise: [100, 160], life: [300, 460], stagger: 80 });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        this.e.spawn(P.flame, tx, y, 320).normal().at(FX_DEPTH_AIR - 1).origin(0.5, 0.9)
          .polar(a, 130 + Math.random() * 50, 0.65).damp(5).accel(0, -80).scaleXY(0.4, 0.35, 0.25, 0.8, 2).spinning(a + Math.PI / 2).fade(1, 0, 0, 1.2);
      }
      this.fx.shock(tx, ty, P.mid, 8, 56, 360, 0.9);
      this.fx.sparks(tx, y, 12, P.mid, { speed: [150, 280], gravity: 180 });
      this.fx.smoke(tx, y - 6, 5, 0x4a3c38, { radius: 10, speed: [20, 45], size: [0.35, 0.55], life: [600, 850], rise: 50, alpha: 0.7, delay: 100 });
      this.fx.decal(tx, ty, 'fx_scorch', 0xffffff, 22, 1500, { alpha: 0.7 });
    });
  }

  private effectIceArrow(cx: number, cy: number, tx: number, ty: number): void {
    const x0 = cx + Math.cos(this.lastAim) * 10, y0 = cy - 22, x1 = tx, y1 = ty - CH;
    const dur = this.getProjectileTravelMs('ice_arrow', cx, cy, tx, ty);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const P = PAL.frost;
    this.fx.flash(x0, y0, P.mid, 16, 140);
    const glow = this.e.spawn('fx_glow', x0, y0, dur).color(P.rim).scaleXY(0.8, 0.5).spinning(ang).fade(0.8, 0.8);
    const shard = this.e.spawn('fx_shard_frost', x0, y0, dur).normal().at(FX_DEPTH_AIR - 1).scaleXY(0.6, 0.85).spinning(ang + Math.PI / 2).fade(1, 1);
    const core = this.e.spawn('fx_comet', x0, y0, dur).color(P.mid).scaleXY(0.5, 0.4).spinning(ang).fade(0.9, 0.9);
    this.fly(x0, y0, x1, y1, dur, (x, y) => {
      glow.x = shard.x = core.x = x; glow.y = shard.y = core.y = y;
    }, (x, y) => {
      this.e.spawn(Math.random() < 0.5 ? 'fx_flake' : 'fx_spark', x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6, 320)
        .color(Math.random() < 0.5 ? 0xffffff : P.mid).vel(-Math.cos(ang) * 20, 10).scale(0.28, 0.05).spinning(0, 4).fade(1, 0);
      if (Math.random() < 0.25) this.fx.smoke(x, y, 1, 0xd8f4ff, { radius: 2, speed: [4, 10], size: [0.15, 0.22], life: [300, 400], alpha: 0.4, rise: 4 });
    }, 7, () => {
      this.e.kill(glow); this.e.kill(shard); this.e.kill(core);
      this.fx.flash(x1, y1, P.mid, 24, 170);
      for (let i = 0; i < 7; i++) {
        const a = ang + Math.PI + (Math.random() - 0.5) * 2.6;
        this.e.spawn('fx_shard_frost', x1, y1, 320).normal().at(FX_DEPTH_AIR - 1).polar(a, 100 + Math.random() * 70, 0.8).damp(3).accel(0, 180)
          .face(Math.PI / 2).scale(0.32, 0.18).fade(1, 0, 0, 2);
      }
      this.fx.motes(x1, y1, 6, 'fx_flake', [0xffffff, P.mid], { speed: [30, 80], gravity: 50, size: [0.25, 0.35], life: [350, 550], spin: 4 });
      this.fx.ring(x1, ty, P.rim, 4, 24, 300);
      this.fx.decal(x1, ty, 'fx_frost', 0xffffff, 16, 1000, { alpha: 0.7 });
    });
  }

  private effectFreeze(tx: number, ty: number): void {
    const P = PAL.frost;
    const y = ty - CH;
    // anticipation: frost ring snaps inward
    this.fx.ring(tx, ty, P.mid, 46, 12, 170, { pow: 2, alpha: 0.9 });
    this.fx.gather(tx, y, 10, 'fx_flake', 0xffffff, 36, 150, 0.35);
    this.e.after(140, () => {
      this.fx.flash(tx, y, P.core, 30, 200);
      this.fx.decal(tx, ty, 'fx_frost', 0xffffff, 28, 1300, { alpha: 0.85 });
      // crystal cage
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const px = tx + Math.cos(a) * 14, py = ty + Math.sin(a) * 7;
        this.e.spawn('fx_shard_frost', px, py, 900).normal().world(Math.sin(a) > 0 ? 70 : 10).origin(0.5, 1)
          .scaleXY(0.55, 0.12, 0.6, 0.9, 7).spinning(Math.cos(a) * 0.35).fade(0.95, 0, 0, 6).wait(i * 14);
        this.e.after(780 + i * 10, () => {
          this.e.spawn('fx_shard_frost', px, py - 14, 300).normal().at(FX_DEPTH_AIR - 1).polar(a, 60, 0.6).accel(0, 240).spinning(Math.random() * 3, 8).scale(0.3, 0.15).fade(1, 0);
        });
      }
      this.fx.glint(tx + 6, y - 14, 0xffffff, 36, 260, 120);
      this.fx.smoke(tx, ty - 4, 4, 0xe0f6ff, { radius: 16, speed: [8, 20], size: [0.3, 0.45], life: [600, 800], alpha: 0.4, rise: 5, delay: 60 });
    });
  }

  private effectTeleport(cx: number, cy: number, tx: number, ty: number): void {
    const P = PAL.arcane;
    const sy = cy - 20, ey = ty - 20;
    // departure: collapse inward
    this.fx.gather(cx, sy, 12, 'fx_spark', P.mid, 34, 180, 0.24);
    this.e.spawn('fx_glow', cx, sy, 200).color(P.rim).scale(1.3, 0.1, 2).fade(0.9, 0.2);
    this.fx.ring(cx, cy, P.mid, 32, 4, 200, { pow: 2 });
    this.fx.decal(cx, cy, 'fx_rune', P.rim, 26, 420, { add: true, alpha: 0.8, spin: 2 });
    // rift streak
    const ang = Math.atan2(ey - sy, tx - cx);
    const dist = Phaser.Math.Distance.Between(cx, sy, tx, ey);
    for (let i = 0; i < 6; i++) {
      const u = i / 6;
      this.e.spawn('fx_streak', cx + (tx - cx) * u, sy + (ey - sy) * u, 160).polar(ang, dist * 4, 1).face(0, 0).scaleXY(1.2, 0.8, 0.3, 0.3)
        .color(i % 2 ? P.mid : 0xffffff).fade(0.8, 0).wait(40 + i * 12);
    }
    // arrival: rune flare + burst
    this.e.after(100, () => {
      this.fx.decal(tx, ty, 'fx_rune', P.mid, 30, 600, { add: true, alpha: 1, spin: -1.5, grow: 1.15 });
      this.fx.flash(tx, ey, P.mid, 30, 200);
      this.fx.beam(tx, ty, P.rim, 70, 22, 360, { alpha: 0.7 });
      this.fx.ring(tx, ty, P.rim, 6, 40, 360);
      this.fx.sparks(tx, ey, 10, P.mid, { speed: [90, 190], tint2: P.rim });
      this.fx.motes(tx, ey, 8, 'fx_spark', [P.core, P.mid], { radius: 12, speed: [20, 50], rise: 40, size: [0.18, 0.3], life: [350, 600] });
    });
  }

  private effectArcaneTorrent(cx: number, cy: number): void {
    const R = this.aoePx('arcane_torrent') * 0.85;
    const P = PAL.arcane;
    this.fx.decal(cx, cy, 'fx_rune', P.rim, R * 0.9, 900, { add: true, alpha: 0.8, spin: 0.8, fadeIn: 0.1 });
    // arcane missiles rain onto the area
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, r = R * Math.sqrt(Math.random()) * 0.9;
      const gx = cx + Math.cos(a) * r, gy = cy + Math.sin(a) * r * FLAT;
      const d = i * 45;
      const x0 = gx - 40, y0 = gy - 150;
      const fall = 150;
      const vx = (gx - x0) / (fall / 1000), vy = (gy - 6 - y0) / (fall / 1000);
      this.e.spawn('fx_comet', x0, y0, fall).normal().at(FX_DEPTH_AIR - 1).color(P.dark).vel(vx, vy).face(0).scaleXY(1.1, 0.75).fade(0.6, 0.6).wait(d);
      this.e.spawn('fx_comet', x0, y0, fall).color(i % 2 ? P.rim : 0xb07cff).vel(vx, vy).face(0).scaleXY(1, 0.62).fade(1, 1).wait(d);
      this.e.spawn('fx_core', x0, y0, fall).vel(vx, vy).scale(0.45).fade(1, 1).wait(d);
      this.e.after(d + fall, () => {
        this.fx.flash(gx, gy - 6, P.mid, 16, 140);
        this.fx.ring(gx, gy, P.rim, 3, 20, 260);
        this.fx.sparks(gx, gy - 4, 4, P.mid, { speed: [60, 130], size: 0.7, flat: 0.5 });
      });
    }
    this.e.after(250, () => this.fx.shock(cx, cy, P.rim, R * 0.2, R, 420, 0.55));
    this.fx.motes(cx, cy - 10, 10, 'fx_spark', [P.core, P.mid], { radius: R * 0.8, speed: [10, 30], rise: 40, size: [0.15, 0.28], life: [500, 800], delay: 200 });
  }

  // ══════════════════════════════════════════════════════════
  // ROGUE EFFECTS
  // ══════════════════════════════════════════════════════════

  private effectBackstab(cx: number, cy: number, tx: number, ty: number): void {
    const ang = this.aimTo(cx, cy, tx, ty);
    const y = ty - CH;
    // two quick crossing daggers
    this.fx.slash(tx, y, ang - 0.7, PAL.shadow.rim, { radius: 32, life: 200, thick: 1, sweep: 1.1 });
    this.fx.slash(tx, y, ang + 0.7, PAL.shadow.mid, { radius: 32, life: 200, thick: 1, sweep: 1.1, flip: true, delay: 60 });
    this.fx.flash(tx, y, PAL.shadow.mid, 18, 140, 30);
    this.fx.glint(tx, y, 0xffffff, 44, 200, 60, Math.PI / 4);
    this.fx.sparks(tx, y, 6, PAL.shadow.mid, { angle: ang, spread: 1.3, speed: [120, 220], delay: 40 });
    this.bloodSpray(tx, y, ang, 6);
    this.fx.smoke(tx, y, 2, 0x4a3a5a, { radius: 6, speed: [10, 25], size: [0.25, 0.35], life: [350, 450], alpha: 0.6, delay: 60 });
  }

  private effectPoisonBlade(cx: number, cy: number): void {
    const P = PAL.poison;
    const y = cy - 20;
    this.fx.gather(cx, y, 8, 'fx_glow', P.mid, 32, 130, 0.2);
    this.fx.flames(cx, cy, 12, P.flame, { rx: 24, size: [0.5, 0.85], rise: [40, 70], life: [340, 520], delay: 110, stagger: 200 });
    this.fx.ring(cx, cy, P.rim, 10, 44, 420, { delay: 110 });
    this.fx.glow(cx, y, P.rim, 56, 420, 1.2, 0.45, 110);
    for (let i = 0; i < 7; i++) {
      this.e.spawn('fx_drop', cx + (Math.random() - 0.5) * 22, y + (Math.random() - 0.5) * 8, 380).normal().at(FX_DEPTH_AIR - 1).color(P.mid)
        .vel((Math.random() - 0.5) * 20, 10).accel(0, 300).scale(0.35, 0.3).fade(1, 0.5).wait(130 + i * 50);
    }
    this.fx.motes(cx, y, 8, 'fx_bubble', [P.mid, P.core], { radius: 14, speed: [5, 15], rise: 50, size: [0.06, 0.12], life: [400, 650], delay: 150 });
    this.fx.decal(cx, cy, 'fx_puddle', P.rim, 16, 900, { alpha: 0.6, grow: 1.3, delay: 250 });
  }

  private effectMultishot(cx: number, cy: number, targets?: { x: number; y: number }[]): void {
    const R = this.aoePx('multishot') * 1.1;
    const y = cy - 20;
    const dirs: number[] = [];
    if (targets && targets.length > 0) for (const t of targets.slice(0, 7)) dirs.push(Math.atan2(t.y - cy, t.x - cx));
    const base = this.lastAim;
    for (let i = dirs.length; i < 7; i++) dirs.push(base + (i / 6 - 0.5) * 1.6);
    this.fx.flash(cx + Math.cos(base) * 10, y, PAL.steel.mid, 20, 140);
    dirs.forEach((a, i) => this.arrow(cx + Math.cos(a) * 8, y + Math.sin(a) * 4, cx + Math.cos(a) * R, y + Math.sin(a) * R * FLAT, i * 12, PAL.steel.mid));
  }

  private effectVanish(cx: number, cy: number): void {
    const P = PAL.shadow;
    const y = cy - 18;
    this.fx.flash(cx, y, P.mid, 26, 140);
    this.fx.ring(cx, cy, P.rim, 40, 6, 240, { pow: 2 });
    // smoke bomb: dense dark puffs + violet glints
    this.fx.smoke(cx, y, 12, 0x4a3a5e, { radius: 12, speed: [50, 110], size: [0.45, 0.75], life: [550, 800], rise: 25, alpha: 0.9 });
    this.fx.smoke(cx, cy - 4, 6, 0x6a5a80, { radius: 16, speed: [30, 70], size: [0.35, 0.55], life: [500, 700], rise: 10, alpha: 0.7, delay: 40 });
    this.fx.motes(cx, y, 10, 'fx_spark', [P.mid, P.core], { radius: 16, speed: [30, 70], size: [0.18, 0.3], life: [300, 550], delay: 80 });
    this.fx.decal(cx, cy, 'fx_scorch', P.dark, 20, 800, { alpha: 0.5 });
  }

  private effectExplosiveTrap(cx: number, cy: number): void {
    const R = this.aoePx('explosive_trap');
    const P = PAL.fire;
    // arm blink, then detonate
    this.e.spawn('fx_glow', cx, cy - 4, 90).color(P.rim).scale(0.35, 0.55).fade(1, 0.6);
    this.fx.decal(cx, cy, 'fx_rune', P.rim, 18, 200, { add: true, alpha: 1, spin: 4 });
    this.e.after(80, () => {
      this.e.shake(200, 0.009);
      const y = cy - 10;
      this.fx.flash(cx, y, P.core, 40, 200);
      this.fx.glow(cx, y, P.rim, R * 1.6, 360, 1.2, 0.65);
      this.fx.shock(cx, cy, P.mid, 8, R, 380, 1);
      this.fx.ring(cx, cy, 0xffffff, 6, R * 0.85, 260);
      this.fx.flames(cx, cy, 12, P.flame, { rx: R * 0.4, size: [0.6, 1.0], rise: [70, 130], life: [300, 480], stagger: 120 });
      this.fx.debris(cx, cy, 8, { speed: [80, 150] });
      this.fx.sparks(cx, y, 12, P.mid, { speed: [150, 280], gravity: 220 });
      this.fx.smoke(cx, cy - 8, 7, 0x4a3c38, { radius: R * 0.3, speed: [20, 50], size: [0.45, 0.7], life: [650, 900], rise: 40, alpha: 0.75, delay: 90 });
      this.fx.decal(cx, cy, 'fx_scorch', 0xffffff, R * 0.5, 1800, { alpha: 0.8 });
    });
  }

  private effectArrowRain(cx: number, cy: number): void {
    const R = this.aoePx('arrow_rain') * 0.8;
    this.fx.ring(cx, cy, PAL.steel.rim, R * 0.9, R, 700, { alpha: 0.6, pow: 1 });
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, r = R * Math.sqrt(Math.random());
      const gx = cx + Math.cos(a) * r, gy = cy + Math.sin(a) * r * FLAT;
      const d = Math.random() * 420;
      const fall = 130;
      const x0 = gx - 30, y0 = gy - 130;
      const vx = (gx - x0) / (fall / 1000), vy = (gy - y0) / (fall / 1000);
      const ang = Math.atan2(vy, vx);
      this.e.spawn('fx_arrow', x0, y0, fall).normal().at(FX_DEPTH_AIR - 1).vel(vx, vy).spinning(ang).scale(0.55).fade(1, 1).wait(d);
      this.e.spawn('fx_streak', x0, y0, fall).vel(vx, vy).face(0).scaleXY(0.8, 0.5, 1.1, 0.3).color(PAL.steel.mid).fade(0.4, 0.8).wait(d);
      this.e.after(d + fall, () => {
        // arrow sticks in the ground, dust + glint
        this.e.spawn('fx_arrow', gx - Math.cos(ang) * 8, gy - Math.sin(ang) * 8, 420).normal().world(4).spinning(ang).scale(0.55).fade(1, 0, 0, 4);
        this.e.spawn('fx_spark', gx, gy - 2, 140).color(0xffffff).scale(0.3, 0.05).fade(1, 0);
        if (i % 2 === 0) this.fx.smoke(gx, gy - 2, 1, 0xc8b89a, { radius: 2, speed: [15, 30], size: [0.18, 0.26], life: [300, 420], alpha: 0.6, rise: 10 });
      });
    }
  }

  private effectDeathMark(tx: number, ty: number): void {
    const P = PAL.shadow;
    const hy = ty - 52;
    this.fx.decal(tx, ty, 'fx_rune', P.rim, 22, 1000, { add: true, alpha: 0.85, spin: -1.2, fadeIn: 0.1 });
    this.fx.gather(tx, ty - 22, 10, 'fx_glow', P.mid, 34, 180, 0.2);
    // skull sigil stamps down over the target's head, then hangs and fades
    this.e.spawn('fx_skull', tx, hy, 1000).color(P.mid).scale(1.2, 0.5, 6).fade(1, 0, 0.08, 4);
    this.e.spawn('fx_skull', tx, hy, 260).scale(0.8, 0.55, 3).fade(0.9, 0);
    this.e.spawn('fx_ring', tx, hy, 360).color(P.rim).scaleXY(0.9, 0.9, 0.35, 0.35, 3).fade(0.9, 0);
    this.fx.glint(tx, hy, 0xffffff, 36, 220, 60);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.e.spawn('fx_ember', 0, 0, 700).color(P.mid).circle(tx, ty - 20, 22, a, 3, -10, 0.6).scale(0.35, 0.1).spinning(0, 5).fade(1, 0, 0.1).wait(80);
    }
  }

  private effectShadowStep(cx: number, cy: number, tx: number, ty: number): void {
    const P = PAL.shadow;
    const sy = cy - 18, ey = ty - 18;
    // departure: shadow puff where the rogue stood
    this.fx.smoke(cx, sy, 7, 0x3a2e4e, { radius: 8, speed: [30, 70], size: [0.35, 0.55], life: [420, 600], rise: 20, alpha: 0.85 });
    this.fx.ring(cx, cy, P.rim, 26, 4, 180, { pow: 2 });
    // violet afterimage streak
    const ang = Math.atan2(ey - sy, tx - cx);
    const dist = Phaser.Math.Distance.Between(cx, sy, tx, ey);
    for (let i = 0; i < 5; i++) {
      const u = i / 5;
      this.e.spawn('fx_streak', cx + (tx - cx) * u, sy + (ey - sy) * u, 150).polar(ang, dist * 3, 1).face(0).scaleXY(1.1, 1, 0.3, 0.3)
        .color(i % 2 ? P.mid : P.rim).fade(0.8, 0).wait(i * 14);
    }
    // arrival: shadow slash out of the smoke
    this.e.after(80, () => {
      this.fx.smoke(tx, ey, 4, 0x3a2e4e, { radius: 6, speed: [20, 50], size: [0.3, 0.45], life: [380, 520], rise: 15, alpha: 0.75 });
      this.fx.flash(tx, ey, P.mid, 22, 160);
      this.fx.slash(tx, ey, ang, P.mid, { radius: 24, life: 180, thick: 0.8 });
      this.fx.motes(tx, ey, 8, 'fx_spark', [P.core, P.mid], { speed: [40, 90], size: [0.18, 0.3], life: [300, 500] });
    });
  }

  private effectPiercingArrow(cx: number, cy: number, targets?: { x: number; y: number }[]): void {
    const ang = targets && targets.length > 0 ? Math.atan2(targets[0].y - cy, targets[0].x - cx) : this.lastAim;
    const y = cy - 20;
    const range = 240;
    const x1 = cx + Math.cos(ang) * range, y1 = y + Math.sin(ang) * range * 0.75;
    const P = PAL.holy;
    // draw: gathering glint on the bow
    this.fx.glint(cx + Math.cos(ang) * 10, y, P.mid, 34, 160);
    const dur = 260;
    const glow = this.e.spawn('fx_comet', cx, y, dur).color(P.mid).spinning(Math.atan2(y1 - y, x1 - cx)).scaleXY(1.1, 0.7).fade(0.9, 0.9);
    const arrow = this.e.spawn('fx_arrow', cx, y, dur).normal().at(FX_DEPTH_AIR + 1).spinning(Math.atan2(y1 - y, x1 - cx)).scale(0.8).fade(1, 1);
    this.fly(cx, y, x1, y1, dur, (x, yy) => { glow.x = arrow.x = x; glow.y = arrow.y = yy; }, (x, yy) => {
      this.e.spawn('fx_streak', x, yy, 220).spinning(Math.atan2(y1 - y, x1 - cx)).scaleXY(0.9, 0.9, 0.4, 0.2).color(P.mid).fade(0.8, 0);
      if (Math.random() < 0.4) this.e.spawn('fx_spark', x, yy + (Math.random() - 0.5) * 8, 240).color(P.core).scale(0.22, 0.05).fade(1, 0);
    }, 9, () => {
      this.e.kill(glow); this.e.kill(arrow);
      this.e.spawn('fx_arrow', x1, y1, 160).normal().spinning(Math.atan2(y1 - y, x1 - cx)).scale(0.8).fade(1, 0).polar(ang, 200);
    });
    // shock rings along the path read as "pierces through everything"
    for (let i = 1; i <= 3; i++) {
      const u = i / 4;
      this.e.spawn('fx_ring', cx + (x1 - cx) * u, y + (y1 - y) * u, 220).color(P.mid).scaleXY(0.08, 0.2, 0.18, 0.5, 3)
        .spinning(Math.atan2(y1 - y, x1 - cx)).fade(0.9, 0).wait(dur * u);
    }
  }

  private effectPoisonArrow(cx: number, cy: number, tx: number, ty: number): void {
    const x0 = cx + Math.cos(this.lastAim) * 10, y0 = cy - 22, x1 = tx, y1 = ty - CH;
    const dur = this.getProjectileTravelMs('poison_arrow', cx, cy, tx, ty);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const P = PAL.poison;
    const glow = this.e.spawn('fx_comet', x0, y0, dur).color(P.mid).spinning(ang).scaleXY(0.8, 0.6).fade(0.9, 0.9);
    const arrow = this.e.spawn('fx_arrow', x0, y0, dur).normal().at(FX_DEPTH_AIR + 1).spinning(ang).scale(0.7).fade(1, 1);
    this.fly(x0, y0, x1, y1, dur, (x, y) => { glow.x = arrow.x = x; glow.y = arrow.y = y; }, (x, y) => {
      if (Math.random() < 0.5) this.e.spawn('fx_drop', x, y, 320).normal().at(FX_DEPTH_AIR - 1).color(P.mid).vel(0, 10).accel(0, 260).scale(0.26, 0.2).fade(1, 0.3);
      else this.e.spawn('fx_glow', x, y, 260).color(P.rim).scale(0.2, 0.05).vel(0, -15).fade(0.8, 0);
    }, 8, () => {
      this.e.kill(glow); this.e.kill(arrow);
      this.fx.flash(x1, y1, P.mid, 20, 150);
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
        this.e.spawn('fx_drop', x1, y1, 420).normal().at(FX_DEPTH_AIR - 1).color(i % 2 ? P.mid : P.rim).polar(a, 70 + Math.random() * 60, 1).accel(0, 380)
          .face(-Math.PI / 2).scale(0.32, 0.22).fade(1, 0.2);
      }
      this.fx.smoke(x1, y1, 3, 0x7ac84a, { radius: 6, speed: [10, 25], size: [0.3, 0.45], life: [500, 700], rise: 18, alpha: 0.55 });
      this.fx.decal(x1, ty, 'fx_puddle', P.rim, 14, 1200, { alpha: 0.7, grow: 1.3 });
      this.fx.motes(x1, ty - 4, 4, 'fx_bubble', [P.mid, P.core], { radius: 8, speed: [2, 8], rise: 35, size: [0.06, 0.1], life: [400, 700], delay: 150 });
    });
  }

  private effectPoisonCloud(cx: number, cy: number): void {
    const R = this.aoePx('poison_cloud') * 0.7;
    const P = PAL.poison;
    this.fx.decal(cx, cy, 'fx_puddle', P.rim, R * 0.8, 1600, { alpha: 0.55, grow: 1.2, fadeIn: 0.1 });
    this.fx.decal(cx, cy, 'fx_glow', P.mid, R, 1300, { add: true, alpha: 0.4, fadeIn: 0.15 });
    // billowing toxic smoke: two layers, slowly rising
    this.fx.smoke(cx, cy - 10, 12, 0x6ab83a, { radius: R, speed: [15, 40], size: [0.55, 0.9], life: [900, 1300], rise: 10, alpha: 0.7 });
    this.fx.smoke(cx, cy - 16, 8, 0xa8e05a, { radius: R * 0.7, speed: [10, 25], size: [0.45, 0.7], life: [800, 1200], rise: 18, alpha: 0.6, delay: 120 });
    this.fx.motes(cx, cy - 6, 12, 'fx_bubble', [P.mid, P.core], { radius: R * 0.8, speed: [2, 10], rise: 40, size: [0.06, 0.12], life: [500, 900], delay: 100 });
    this.fx.shock(cx, cy, P.rim, R * 0.3, R * 1.2, 420, 0.5);
  }

  private effectSlowTrap(cx: number, cy: number): void {
    const R = this.aoePx('slow_trap');
    const P = PAL.frost;
    this.fx.decal(cx, cy, 'fx_rune', P.rim, 16, 200, { add: true, alpha: 1, spin: 5 });
    this.e.after(100, () => {
      this.fx.flash(cx, cy - 8, P.mid, 26, 170);
      this.fx.decal(cx, cy, 'fx_frost', 0xffffff, R * 0.8, 1500, { alpha: 0.75, fadeIn: 0.1 });
      this.fx.decal(cx, cy, 'fx_rune', P.mid, R * 0.7, 900, { add: true, alpha: 0.8, spin: 0.6 });
      for (let k = 0; k < 3; k++) this.fx.ring(cx, cy, k ? P.mid : P.rim, 8, R, 520, { delay: k * 150, alpha: 0.85 - k * 0.2, pow: 2 });
      this.fx.motes(cx, cy - 20, 10, 'fx_flake', [0xffffff, P.mid], { radius: R * 0.6, speed: [10, 30], gravity: 30, size: [0.25, 0.4], life: [600, 900], spin: 3 });
      this.fx.smoke(cx, cy - 4, 5, 0xd8f4ff, { radius: R * 0.6, speed: [5, 15], size: [0.35, 0.5], life: [700, 900], alpha: 0.35, rise: 4 });
    });
  }

  private effectChainTrap(cx: number, cy: number): void {
    const R = this.aoePx('chain_trap') * 0.75;
    this.e.shake(120, 0.004);
    this.fx.flash(cx, cy - 8, PAL.holy.mid, 26, 160);
    this.fx.decal(cx, cy, 'fx_rune', PAL.holy.rim, 20, 700, { add: true, alpha: 0.9, spin: 2 });
    this.fx.ring(cx, cy, PAL.holy.rim, 8, R, 420);
    // chains lash out in five directions, link by link, then crackle
    for (let c = 0; c < 5; c++) {
      const a = (c / 5) * Math.PI * 2 + Math.random() * 0.4;
      const ex = cx + Math.cos(a) * R, ey = cy - 8 + Math.sin(a) * R * FLAT;
      const ang = Math.atan2(ey - (cy - 8), ex - cx);
      const links = 7;
      for (let i = 1; i <= links; i++) {
        const u = i / links;
        this.e.spawn('fx_chain', cx + (ex - cx) * u, cy - 8 + (ey - cy + 8) * u, 620 - i * 20).normal().world(40)
          .spinning(ang + (i % 2 ? 0 : 0.25)).scaleXY(0.5, i % 2 ? 0.5 : 0.3).fade(1, 0, 0, 4).wait(c * 20 + i * 14);
      }
      this.e.after(c * 20 + links * 14, () => {
        this.fx.bolt(cx, cy - 8, ex, ey, PAL.holy.mid, 160, 1.2, 0, PAL.holy.dark);
        this.fx.sparks(ex, ey, 5, PAL.holy.mid, { speed: [60, 130], size: 0.7 });
        this.fx.glint(ex, ey, 0xffffff, 24, 160);
      });
    }
  }

  /**
   * Hex shield plate orbiting (cx, cy): solid tinted body + additive glow.
   * Plates in front of the caster stay translucent so the character still reads.
   */
  private plate(cx: number, cy: number, r: number, a: number, w: number, life: number, tint: number, ink: number, s0: number, s1: number, front: boolean, delay: number): void {
    const off = front ? 120 : 30;
    const k = front ? 0.45 : 1;
    this.e.spawn('fx_hex', 0, 0, life).normal().color(ink).circle(cx, cy, r, a, w, -6, 0.55)
      .scaleXY(s0 * 1.08, s0 * 1.08, s1 * 1.08, s1, 5).fade(0.7 * k, 0, 0.1, 3).world(off).wait(delay);
    this.e.spawn('fx_hex', 0, 0, life).normal().color(tint).circle(cx, cy, r, a, w, -6, 0.55)
      .scaleXY(s0, s0, s1, s1 * 0.92, 5).fade(0.9 * k, 0, 0.1, 3).world(off + 1).wait(delay);
    this.e.spawn('fx_hex', 0, 0, life * 0.8).add().color(tint).circle(cx, cy, r, a, w, -6, 0.55)
      .scaleXY(s0, s0, s1, s1 * 0.92, 5).fade(0.7 * k, 0, 0.1, 2).world(off + 2).wait(delay);
  }

  /** Blood droplets + red streaks thrown along the hit direction. */
  private bloodSpray(x: number, y: number, ang: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * 1.4 - 0.3;
      this.e.spawn('fx_drop', x, y, 360 + Math.random() * 120).normal().at(FX_DEPTH_AIR - 1).color(i % 3 ? PAL.blood.mid : PAL.blood.rim)
        .polar(a, 80 + Math.random() * 90, 0.8).accel(0, 420).face(-Math.PI / 2).scale(0.3 + Math.random() * 0.12, 0.15).fade(1, 0.3);
    }
  }

  /** Flying arrow (cel sprite + glow trail) that fades at the end. */
  private arrow(x0: number, y0: number, x1: number, y1: number, delay: number, glowTint: number): void {
    const dur = 220;
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const vx = (x1 - x0) / (dur / 1000), vy = (y1 - y0) / (dur / 1000);
    this.e.spawn('fx_arrow', x0, y0, dur).normal().at(FX_DEPTH_AIR + 1).vel(vx, vy).spinning(ang).scale(0.6).fade(1, 0.2, 0, 4).wait(delay);
    this.e.spawn('fx_comet', x0, y0, dur).vel(vx, vy).spinning(ang).color(glowTint).scaleXY(0.7, 0.35).fade(0.7, 0, 0, 2).wait(delay);
    this.e.after(delay + dur * 0.9, () => this.e.spawn('fx_spark', x1, y1, 160).color(0xffffff).scale(0.3, 0.05).fade(1, 0));
  }

  /** Aim angle toward a target, falling back to the last aim when on top of it. */
  private aimTo(cx: number, cy: number, tx: number, ty: number): number {
    return Math.abs(tx - cx) + Math.abs(ty - cy) > 4 ? Math.atan2(ty - cy, tx - cx) : this.lastAim;
  }

  // ══════════════════════════════════════════════════════════
  // GENERIC FALLBACK
  // ══════════════════════════════════════════════════════════

  private effectGeneric(x: number, y: number, color: number): void {
    const cy = y - CH;
    this.fx.flash(x, cy, color, 24, 180);
    this.fx.sparks(x, cy, 8, color, { speed: [80, 160] });
    this.fx.ring(x, y, color, 6, 30, 300);
  }
}
