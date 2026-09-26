/**
 * MobileShell — the page around the canvas on phones and tablets.
 *
 * - First tap asks for fullscreen and locks landscape (where the browser allows).
 * - Held upright, a "rotate your device" card covers the game and the game
 *   loop sleeps, so nothing attacks the hero while the player turns the phone.
 * - Long-press menus and pinch/double-tap zoom are suppressed on the game.
 */
import type Phaser from 'phaser';
import { getLocale } from '../i18n';
import { isMobileDevice } from './MobileControlsSystem';

const ROTATE_TEXT: Record<string, { title: string; body: string }> = {
  'zh-CN': { title: '请横置设备', body: '渊火需要横屏游玩' },
  en: { title: 'Rotate your device', body: 'Abyssfire plays in landscape' },
};

/** True while a touch device is held upright. */
export function isPortraitTouch(): boolean {
  return window.matchMedia('(orientation: portrait) and (pointer: coarse)').matches;
}

async function goFullscreenLandscape(): Promise<void> {
  const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  try {
    if (!document.fullscreenElement) {
      if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
      else await root.webkitRequestFullscreen?.();
    }
  } catch { /* iPhone Safari has no element fullscreen; the manifest covers home-screen installs */ }
  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.('landscape');
  } catch { /* only allowed in fullscreen / installed apps */ }
}

function buildRotateCard(): HTMLElement {
  const text = ROTATE_TEXT[getLocale()] ?? ROTATE_TEXT.en;
  const card = document.createElement('div');
  card.id = 'rotate-hint';
  card.innerHTML = `<div class="rotate-phone"><div class="rotate-screen"></div></div>
    <div class="rotate-title"></div><div class="rotate-body"></div>`;
  (card.querySelector('.rotate-title') as HTMLElement).textContent = text.title;
  (card.querySelector('.rotate-body') as HTMLElement).textContent = text.body;
  document.body.appendChild(card);
  return card;
}

export function installMobileShell(game: Phaser.Game): void {
  if (!isMobileDevice()) return;
  document.documentElement.classList.add('touch');

  const container = document.getElementById('game-container');
  container?.addEventListener('contextmenu', e => e.preventDefault());
  // iOS still honours gesture events despite user-scalable=no.
  document.addEventListener('gesturestart', e => e.preventDefault());

  const onFirstTap = (): void => {
    window.removeEventListener('pointerup', onFirstTap);
    void goFullscreenLandscape();
  };
  window.addEventListener('pointerup', onFirstTap);

  const card = buildRotateCard();
  let sleeping = false;
  const sync = (): void => {
    const upright = isPortraitTouch();
    card.classList.toggle('show', upright);
    if (upright && !sleeping && game.loop) { game.loop.sleep(); sleeping = true; }
    if (!upright && sleeping) { game.loop.wake(); sleeping = false; }
    // The canvas size can change without a window resize (fullscreen, bars).
    game.scale?.refresh();
  };
  window.matchMedia('(orientation: portrait)').addEventListener('change', sync);
  window.addEventListener('resize', sync);
  document.addEventListener('fullscreenchange', sync);
  // The loop starts after boot; check once it is running.
  game.events.once('poststep', sync);
}
