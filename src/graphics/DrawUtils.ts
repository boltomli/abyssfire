import { getCurrentZonePalette, standardOutlineBlur } from './ZonePalette';

/** Shared drawing primitives for entity sprite generation. */
export class DrawUtils {

  // ── Noise ──

  hash2d(x: number, y: number): number {
    let n = (x | 0) * 374761393 + (y | 0) * 668265263;
    n = ((n >> 13) ^ n) * 1274126177;
    return ((n >> 16) ^ n & 0x7fffffff) / 0x7fffffff;
  }

  noise2d(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = this.hash2d(ix, iy), n10 = this.hash2d(ix + 1, iy);
    const n01 = this.hash2d(ix, iy + 1), n11 = this.hash2d(ix + 1, iy + 1);
    return (n00 + (n10 - n00) * sx) + ((n01 + (n11 - n01) * sx) - (n00 + (n10 - n00) * sx)) * sy;
  }

  fbm(x: number, y: number, octaves: number): number {
    let v = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      v += this.noise2d(x * freq, y * freq) * amp;
      amp *= 0.5; freq *= 2;
    }
    return v;
  }

  // ── Color ──

  clamp(v: number): number { return Math.max(0, Math.min(255, v | 0)); }

  rgb(c: number, alpha?: number): string {
    const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
    return alpha !== undefined ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
  }

  hexRgb(c: number): [number, number, number] {
    return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
  }

  darken(c: number, amt: number): number {
    const [r, g, b] = this.hexRgb(c);
    return ((Math.max(0, r - amt) << 16) | (Math.max(0, g - amt) << 8) | Math.max(0, b - amt));
  }

  lighten(c: number, amt: number): number {
    const [r, g, b] = this.hexRgb(c);
    return ((Math.min(255, r + amt) << 16) | (Math.min(255, g + amt) << 8) | Math.min(255, b + amt));
  }

  lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

  // ── Canvas Primitives ──

  createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d', { willReadFrequently: true })!];
  }

  roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  fillEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  fillCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.fill();
  }

  drawPart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: number, radius: number = 0): void {
    const [r, g, b] = this.hexRgb(color);
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, `rgb(${this.clamp(r + 15)},${this.clamp(g + 15)},${this.clamp(b + 15)})`);
    grad.addColorStop(1, `rgb(${this.clamp(r - 20)},${this.clamp(g - 20)},${this.clamp(b - 20)})`);
    ctx.fillStyle = grad;
    if (radius > 0) { this.roundRect(ctx, x, y, w, h, radius); ctx.fill(); }
    else { ctx.fillRect(x, y, w, h); }
  }

  applyNoiseToRegion(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, intensity: number): void {
    const imageData = ctx.getImageData(x, y, w, h);
    const d = imageData.data;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4;
        if (d[i + 3] === 0) continue;
        const n = (this.fbm((x + px) * 0.025, (y + py) * 0.025, 4) - 0.5) * 2;
        const grain = (this.hash2d(px * 131 + py, py * 97 + px) - 0.5) * 0.08;
        const val = (n + grain) * intensity;
        d[i] = this.clamp(d[i] + val);
        d[i + 1] = this.clamp(d[i + 1] + val);
        d[i + 2] = this.clamp(d[i + 2] + val);
      }
    }
    ctx.putImageData(imageData, x, y);
  }
}
