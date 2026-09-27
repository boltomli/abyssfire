import Phaser from 'phaser';
import { gameConfig } from './config';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import './systems/audio/AudioManager';
import { getLocale } from './i18n';
import { initializeFontManager } from './rendering/FontManager';
import { installMobileShell } from './systems/MobileShell';
import { installTextResolution } from './rendering/RenderScalePhaser';

const config: Phaser.Types.Core.GameConfig = {
  ...gameConfig,
  scene: [BootScene, MenuScene],
};

void initializeFontManager(getLocale()).finally(() => {
  installTextResolution();
  const game = new Phaser.Game(config);
  installMobileShell(game);
});
