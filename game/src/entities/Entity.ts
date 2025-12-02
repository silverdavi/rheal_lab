import Phaser from 'phaser';
import { IsoUtils } from '@/core/IsoUtils';

export interface EntityConfig {
  scene: Phaser.Scene;
  gridX: number;
  gridY: number;
  key?: string;
}

/**
 * Base class for all game entities (characters, buildings, items)
 */
export abstract class Entity {
  protected scene: Phaser.Scene;
  protected sprite: Phaser.GameObjects.Container;
  protected _gridX: number;
  protected _gridY: number;

  constructor(config: EntityConfig) {
    this.scene = config.scene;
    this._gridX = config.gridX;
    this._gridY = config.gridY;
    
    const screen = IsoUtils.gridToScreen(config.gridX, config.gridY);
    this.sprite = this.scene.add.container(screen.x, screen.y);
    this.updateDepth();
  }

  get gridX(): number { return this._gridX; }
  get gridY(): number { return this._gridY; }
  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  /**
   * Update sprite depth based on grid position
   */
  protected updateDepth(zOffset: number = 0): void {
    this.sprite.setDepth(IsoUtils.getDepth(this._gridX, this._gridY, zOffset));
  }

  /**
   * Set grid position (instant, no animation)
   */
  setGridPosition(gridX: number, gridY: number): void {
    this._gridX = gridX;
    this._gridY = gridY;
    const screen = IsoUtils.gridToScreen(gridX, gridY);
    this.sprite.setPosition(screen.x, screen.y);
    this.updateDepth();
  }

  /**
   * Destroy the entity and its sprite
   */
  destroy(): void {
    this.sprite.destroy();
  }

  /**
   * Abstract method for frame updates
   */
  abstract update(delta: number): void;
}

