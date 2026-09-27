/**
 * RenderScale — how many backing pixels the canvas gets per logical pixel.
 *
 * The game is laid out in 1280×720 logical pixels. Rendering exactly that and
 * letting the browser stretch it to a big or high-DPI window blurs everything
 * (a 1440p laptop at 2× shows each game pixel ~2.3× enlarged). Instead the
 * canvas is rendered at up to 2× and the cameras zoom to match; the render
 * quality caps it so phones and weak machines keep their frame rate.
 */
import { resolutionForQuality, resolveRenderQuality } from './RenderQuality';

/** Render scale for a window of the current size (1, 1.5 or 2). `?res=1|1.5|2` overrides for testing. */
export function detectRenderScale(gameWidth: number, gameHeight: number): number {
  if (typeof window === 'undefined') return 1;
  const forced = Number(new URLSearchParams(window.location.search).get('res'));
  if (forced === 1 || forced === 1.5 || forced === 2) return forced;
  const dpr = window.devicePixelRatio || 1;
  // Device pixels the fitted 1280×720 canvas actually covers, per logical pixel.
  const fit = Math.min((window.innerWidth || gameWidth) / gameWidth, (window.innerHeight || gameHeight) / gameHeight) * dpr;
  return renderScaleFor(fit, resolveRenderQuality());
}

/** Pure part, for tests: device pixels per logical pixel, capped by quality. */
export function renderScaleFor(devicePxPerLogical: number, quality: Parameters<typeof resolutionForQuality>[0]): number {
  return resolutionForQuality(quality, Math.max(1, devicePxPerLogical));
}
