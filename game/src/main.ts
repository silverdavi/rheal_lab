import Phaser from 'phaser';
import { gameConfig } from '@/config/game.config';
import { GameScene } from '@/scenes/GameScene';

// Register scenes
const config: Phaser.Types.Core.GameConfig = {
  ...gameConfig,
  scene: [GameScene],
};

// Boot the game
new Phaser.Game(config);

console.log('🍼 Fertility Journey - Game initialized');

