/**
 * SoulEcho — the death penalty.
 *
 * Dying drops part of the hero's carried gold (and, on Nightmare / Hell, some
 * progress toward the next level) into a "soul echo" where they fell. Walking
 * back to it reclaims everything; dying again before that lets the old echo
 * fade and its contents are lost. New heroes (below level 5) lose nothing.
 */
import type { SoulEchoData } from '../data/types';

export type Difficulty = 'normal' | 'nightmare' | 'hell';

/** Heroes below this level die for free. */
export const SOUL_ECHO_MIN_LEVEL = 5;
const GOLD_SHARE: Record<Difficulty, number> = { normal: 0.1, nightmare: 0.15, hell: 0.2 };
const EXP_SHARE: Record<Difficulty, number> = { normal: 0, nightmare: 0.05, hell: 0.05 };
/** Echo is reclaimed within this many tiles. */
export const SOUL_ECHO_RANGE = 1.5;

export interface DeathPenaltyInput {
  level: number;
  gold: number;
  /** Progress toward the next level. */
  exp: number;
  expToNext: number;
  difficulty: Difficulty;
}

/** What a death costs. Exp comes only out of current-level progress, so it never de-levels. */
export function computeDeathPenalty(p: DeathPenaltyInput): { gold: number; exp: number } {
  if (p.level < SOUL_ECHO_MIN_LEVEL) return { gold: 0, exp: 0 };
  const gold = Math.floor(Math.max(0, p.gold) * GOLD_SHARE[p.difficulty]);
  const exp = Math.min(Math.max(0, p.exp), Math.floor(p.expToNext * EXP_SHARE[p.difficulty]));
  return { gold, exp };
}

/** Session state: at most one echo in the world. */
export class SoulEchoState {
  echo: SoulEchoData | null = null;

  /**
   * Leave a new echo (if the death cost anything). Returns the echo that was
   * still waiting, which is now lost.
   */
  leave(next: SoulEchoData): SoulEchoData | null {
    const lost = this.echo;
    this.echo = next.gold > 0 || next.exp > 0 ? next : null;
    return lost;
  }

  /** Take the echo back if the hero stands on it in `mapId`. */
  tryClaim(mapId: string, col: number, row: number): SoulEchoData | null {
    const e = this.echo;
    if (!e || e.mapId !== mapId) return null;
    if (Math.hypot(e.col - col, e.row - row) > SOUL_ECHO_RANGE) return null;
    this.echo = null;
    return e;
  }

  toSave(): SoulEchoData | null {
    return this.echo ? { ...this.echo } : null;
  }

  load(data: SoulEchoData | null | undefined): void {
    this.echo = data && Number.isFinite(data.col) && Number.isFinite(data.row) ? { ...data } : null;
  }
}
