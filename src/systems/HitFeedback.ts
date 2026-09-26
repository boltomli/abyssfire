/**
 * Hit feedback tuning — the single source of truth for how hard a hit "feels".
 *
 * Every damage event is classified into a weight tier; the tier drives
 * hit-stop, flash, recoil, camera shake and impact VFX so all damage sources
 * (auto-attacks, skills, mercenaries, pets) read consistently.
 */

export type HitWeight = 'tick' | 'light' | 'normal' | 'heavy' | 'crit' | 'kill';

export interface HitProfile {
  /** Freeze frames on the target (ms). */
  targetStopMs: number;
  /** Freeze frames on the attacker (ms) — sells the "blade bit in" moment. */
  attackerStopMs: number;
  /** Solid white silhouette flash (ms). */
  flashMs: number;
  /** Hurt recoil multiplier passed to the animator. */
  recoil: number;
  /** Camera shake. Zero duration disables. */
  shakeMs: number;
  shakeIntensity: number;
  /** Directional spark count for the impact burst. */
  sparks: number;
  /** Impact ring / core flash radius (world px). */
  ringRadius: number;
}

export const HIT_PROFILES: Readonly<Record<HitWeight, HitProfile>> = {
  tick:   { targetStopMs: 0,   attackerStopMs: 0,  flashMs: 40,  recoil: 0,    shakeMs: 0,   shakeIntensity: 0,      sparks: 0,  ringRadius: 0 },
  light:  { targetStopMs: 40,  attackerStopMs: 30, flashMs: 55,  recoil: 0.6,  shakeMs: 0,   shakeIntensity: 0,      sparks: 4,  ringRadius: 10 },
  normal: { targetStopMs: 60,  attackerStopMs: 45, flashMs: 70,  recoil: 1,    shakeMs: 60,  shakeIntensity: 0.0018, sparks: 6,  ringRadius: 13 },
  heavy:  { targetStopMs: 85,  attackerStopMs: 65, flashMs: 85,  recoil: 1.35, shakeMs: 90,  shakeIntensity: 0.0032, sparks: 9,  ringRadius: 17 },
  crit:   { targetStopMs: 110, attackerStopMs: 90, flashMs: 100, recoil: 1.6,  shakeMs: 120, shakeIntensity: 0.0045, sparks: 12, ringRadius: 22 },
  kill:   { targetStopMs: 130, attackerStopMs: 100, flashMs: 110, recoil: 2,   shakeMs: 140, shakeIntensity: 0.005,  sparks: 14, ringRadius: 24 },
};

export interface HitInfo {
  damage: number;
  maxHp: number;
  isCrit?: boolean;
  killed?: boolean;
  /** Damage-over-time tick — no recoil, no hit-stop. */
  isTick?: boolean;
}

/** Classify a hit. Kills trump crits, crits trump raw size. */
export function classifyHit(info: HitInfo): HitWeight {
  if (info.isTick) return 'tick';
  if (info.killed) return 'kill';
  if (info.isCrit) return 'crit';
  const ratio = info.maxHp > 0 ? info.damage / info.maxHp : 0;
  if (ratio >= 0.25) return 'heavy';
  if (ratio >= 0.06) return 'normal';
  return 'light';
}

/**
 * When the swing visually connects, in ms after the attack starts.
 * Damage is applied on this beat so numbers, flash and sparks land with
 * the blade instead of before the wind-up finishes.
 */
export function computeImpactDelay(windupMs: number, strikeMs: number, speedScale = 1): number {
  const scale = Math.max(0.2, Math.min(1, speedScale));
  return Math.round((windupMs + strikeMs * 0.6) * scale);
}

/**
 * Speed factor that makes an attack animation of `animMs` fit inside the
 * attack interval, so fast attack-speed builds don't cancel every swing.
 */
export function attackSpeedScale(animMs: number, attackIntervalMs?: number): number {
  if (!attackIntervalMs || attackIntervalMs <= 0 || animMs <= 0) return 1;
  return Math.max(0.35, Math.min(1, (attackIntervalMs * 0.9) / animMs));
}
