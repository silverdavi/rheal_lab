import Phaser from 'phaser';

// Isometric tile dimensions (2:1 ratio is standard)
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

// Game canvas size
export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;

// Min/max viewport constraints for mobile responsiveness
export const MIN_WIDTH = 320;
export const MIN_HEIGHT = 480;
export const MAX_WIDTH = 1920;
export const MAX_HEIGHT = 1080;

// Grid size for the game world
export const GRID_WIDTH = 20;
export const GRID_HEIGHT = 20;

// Movement speed (pixels per second)
export const MOVE_SPEED = 100;

// Colors (warm, hopeful palette)
export const COLORS = {
  background: 0x1a1a2e,
  ground: 0x4a6741,
  groundLight: 0x5a7751,
  path: 0xc9b896,
  pathLight: 0xd9c8a6,
  building: 0xe8d5b7,
  buildingDark: 0xc4b49a,
  accent: 0xf4a261,
  highlight: 0x2a9d8f,
  shadow: 0x264653,
};

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: COLORS.background,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: MIN_WIDTH,
      height: MIN_HEIGHT,
    },
    max: {
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
    },
  },
};

