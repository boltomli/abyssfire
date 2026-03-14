import Phaser from 'phaser';

export const EventBus = new Phaser.Events.EventEmitter();

export const GameEvents = {
  PLAYER_HEALTH_CHANGED: 'player:health',
  PLAYER_MANA_CHANGED: 'player:mana',
  PLAYER_EXP_CHANGED: 'player:exp',
  PLAYER_LEVEL_UP: 'player:levelup',
  PLAYER_DIED: 'player:died',
  MONSTER_DIED: 'monster:died',
  COMBAT_DAMAGE: 'combat:damage',
  SKILL_USED: 'skill:used',
  ITEM_PICKED: 'item:picked',
  ZONE_ENTERED: 'zone:entered',
  LOG_MESSAGE: 'log:message',
} as const;
