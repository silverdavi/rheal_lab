import Phaser from 'phaser';
import { Entity, EntityConfig } from './Entity';
import { IsoUtils } from '@/core/IsoUtils';
import { Pathfinder } from '@/core/Pathfinder';
import { MOVE_SPEED, COLORS } from '@/config/game.config';

export type CharacterState = 'idle' | 'walking' | 'busy';
export type Direction = 'north' | 'south' | 'east' | 'west';

export interface CharacterConfig extends EntityConfig {
  name: string;
  color?: number;
  pathfinder: Pathfinder;
}

/**
 * Character entity with movement and pathfinding
 */
export class Character extends Entity {
  readonly name: string;
  private color: number;
  private pathfinder: Pathfinder;
  
  private state: CharacterState = 'idle';
  private direction: Direction = 'south';
  private path: Array<{ x: number; y: number }> = [];
  private pathIndex: number = 0;
  
  private body!: Phaser.GameObjects.Ellipse;
  private head!: Phaser.GameObjects.Ellipse;
  private shadow!: Phaser.GameObjects.Ellipse;
  
  private onArriveCallback?: () => void;

  constructor(config: CharacterConfig) {
    super(config);
    this.name = config.name;
    this.color = config.color ?? COLORS.accent;
    this.pathfinder = config.pathfinder;
    
    this.createVisuals();
  }

  private createVisuals(): void {
    // Shadow
    this.shadow = this.scene.add.ellipse(0, 10, 28, 14, 0x000000, 0.3);
    this.sprite.add(this.shadow);
    
    // Body (slightly larger to represent patient/s)
    this.body = this.scene.add.ellipse(0, -6, 24, 32, this.color);
    this.sprite.add(this.body);
    
    // Body outline for definition
    const bodyOutline = this.scene.add.graphics();
    bodyOutline.lineStyle(2, this.darkenColor(this.color, 0.7), 1);
    bodyOutline.strokeEllipse(0, -6, 24, 32);
    this.sprite.add(bodyOutline);
    
    // Head
    this.head = this.scene.add.ellipse(0, -30, 18, 18, this.lightenColor(this.color, 1.1));
    this.sprite.add(this.head);
    
    // Face features (simple)
    const face = this.scene.add.graphics();
    face.fillStyle(0x333333, 0.8);
    // Eyes
    face.fillCircle(-4, -32, 2);
    face.fillCircle(4, -32, 2);
    // Smile
    face.lineStyle(1.5, 0x333333, 0.7);
    face.beginPath();
    face.arc(0, -28, 5, 0.2, Math.PI - 0.2, false);
    face.strokePath();
    this.sprite.add(face);
    
    // Heart icon above (symbolizing hope/fertility journey)
    const heart = this.scene.add.text(0, -48, '💜', { fontSize: '12px' }).setOrigin(0.5);
    heart.setAlpha(0.8);
    this.sprite.add(heart);
  }

  private darkenColor(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * factor);
    const g = Math.floor(((color >> 8) & 0xff) * factor);
    const b = Math.floor((color & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

  private lightenColor(color: number, factor: number): number {
    const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
    const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
    const b = Math.min(255, Math.floor((color & 0xff) * factor));
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Move to target grid position using pathfinding
   */
  moveTo(targetX: number, targetY: number, onArrive?: () => void): boolean {
    const path = this.pathfinder.findPath(
      this._gridX, this._gridY,
      targetX, targetY
    );

    if (path.length === 0) {
      return false;
    }

    this.path = path;
    this.pathIndex = 0;
    this.state = 'walking';
    this.onArriveCallback = onArrive;
    return true;
  }

  /**
   * Stop movement immediately
   */
  stop(): void {
    this.path = [];
    this.pathIndex = 0;
    this.state = 'idle';
  }

  /**
   * Set character busy (cannot move)
   */
  setBusy(busy: boolean): void {
    this.state = busy ? 'busy' : 'idle';
  }

  getState(): CharacterState {
    return this.state;
  }

  getDirection(): Direction {
    return this.direction;
  }

  update(delta: number): void {
    // Always update depth based on current screen position
    const currentDepth = (this.sprite.y + 50) * 10;
    this.sprite.setDepth(currentDepth);
    
    if (this.state !== 'walking' || this.path.length === 0) {
      return;
    }

    const target = this.path[this.pathIndex];
    const targetScreen = IsoUtils.gridToScreen(target.x, target.y);
    
    const dx = targetScreen.x - this.sprite.x;
    const dy = targetScreen.y - this.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Update direction based on movement
    this.updateDirection(target.x - this._gridX, target.y - this._gridY);
    
    const moveAmount = (MOVE_SPEED * delta) / 1000;
    
    if (distance <= moveAmount) {
      // Reached current waypoint
      this._gridX = target.x;
      this._gridY = target.y;
      this.sprite.setPosition(targetScreen.x, targetScreen.y);
      
      this.pathIndex++;
      
      if (this.pathIndex >= this.path.length) {
        // Reached destination
        this.state = 'idle';
        this.path = [];
        this.pathIndex = 0;
        
        if (this.onArriveCallback) {
          this.onArriveCallback();
          this.onArriveCallback = undefined;
        }
      }
    } else {
      // Move towards target
      const ratio = moveAmount / distance;
      this.sprite.x += dx * ratio;
      this.sprite.y += dy * ratio;
    }
    
    // Simple walk animation (bob up and down)
    const bobAmount = Math.sin(Date.now() / 100) * 2;
    this.body.y = -8 + bobAmount;
    this.head.y = -28 + bobAmount;
  }

  private updateDirection(dx: number, dy: number): void {
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? 'east' : 'west';
    } else {
      this.direction = dy > 0 ? 'south' : 'north';
    }
  }
}

