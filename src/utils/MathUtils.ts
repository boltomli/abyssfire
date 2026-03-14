export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function chance(percent: number): boolean {
  return Math.random() * 100 < percent;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
