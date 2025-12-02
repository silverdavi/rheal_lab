import Phaser from 'phaser';
import { Entity, EntityConfig } from './Entity';
import { Pathfinder } from '@/core/Pathfinder';
import { TILE_WIDTH, TILE_HEIGHT, COLORS } from '@/config/game.config';

export type BuildingType = 'home' | 'clinic' | 'pharmacy' | 'lab' | 'hospital';

export interface BuildingConfig extends EntityConfig {
  name: string;
  type: BuildingType;
  width?: number;
  height?: number;
  floorColor?: number;
  wallColor?: number;
  pathfinder: Pathfinder;
  entryOffset?: { x: number; y: number };
  floatingLogo?: string; // Texture key for floating logo above building
}

export type HintType = 'next_step' | 'active' | 'none';

/**
 * Building with isometric floor view (walls on back, open floor visible)
 */
export class Building extends Entity {
  readonly name: string;
  readonly type: BuildingType;
  readonly buildingWidth: number;
  readonly buildingHeight: number;
  readonly entryPoint: { x: number; y: number };
  
  private pathfinder: Pathfinder;
  private floorColor: number;
  private wallColor: number;
  private _interactionZone!: Phaser.GameObjects.Zone;
  
  // Visual hint system
  private hintIndicator?: Phaser.GameObjects.Text;
  private glowGraphics?: Phaser.GameObjects.Graphics;
  private hintTween?: Phaser.Tweens.Tween;
  private currentHint: HintType = 'none';
  
  // Floating logo
  private floatingLogo?: Phaser.GameObjects.Image;
  private logoTween?: Phaser.Tweens.Tween;

  constructor(config: BuildingConfig) {
    // Position at center of building footprint for proper alignment
    const centerGridX = config.gridX + (config.width ?? 2) / 2;
    const centerGridY = config.gridY + (config.height ?? 2) / 2;
    super({ ...config, gridX: centerGridX, gridY: centerGridY });
    
    // Store original grid position for obstacle registration
    this._originGridX = config.gridX;
    this._originGridY = config.gridY;
    
    this.name = config.name;
    this.type = config.type;
    this.buildingWidth = config.width ?? 2;
    this.buildingHeight = config.height ?? 2;
    this.floorColor = config.floorColor ?? 0xf5f0e6;
    this.wallColor = config.wallColor ?? COLORS.building;
    this.pathfinder = config.pathfinder;
    
    const defaultEntry = {
      x: config.gridX + Math.floor(this.buildingWidth / 2),
      y: config.gridY + this.buildingHeight,
    };
    this.entryPoint = config.entryOffset 
      ? { x: config.gridX + config.entryOffset.x, y: config.gridY + config.entryOffset.y }
      : defaultEntry;
    
    this.createVisuals();
    this.createHintIndicators();
    this.registerObstacles();
    
    // Create floating logo if specified
    if (config.floatingLogo) {
      this.createFloatingLogo(config.floatingLogo);
    }
    
    // Buildings use screen Y for depth (front buildings render on top)
    this.sprite.setDepth(this.sprite.y * 10);
  }
  
  private _originGridX: number = 0;
  private _originGridY: number = 0;

  private createVisuals(): void {
    // Use exact tile dimensions for perfect alignment
    const tileW = TILE_WIDTH / 2;  // 32 - half width for iso diamond
    const tileH = TILE_HEIGHT / 2; // 16 - half height for iso diamond
    const w = this.buildingWidth * tileW;
    const h = this.buildingHeight * tileH;
    const wallHeight = 28;
    
    const graphics = this.scene.add.graphics();
    
    // Shadow - matches floor shape exactly, offset down-right
    graphics.fillStyle(0x000000, 0.2);
    graphics.beginPath();
    graphics.moveTo(4, -h + 6);      // top
    graphics.lineTo(-w + 4, 6);      // left
    graphics.lineTo(4, h + 6);       // bottom
    graphics.lineTo(w + 4, 6);       // right
    graphics.closePath();
    graphics.fillPath();
    
    // Floor (isometric diamond) - exact same angles as grid tiles
    graphics.fillStyle(this.floorColor, 1);
    graphics.beginPath();
    graphics.moveTo(0, -h);          // top
    graphics.lineTo(-w, 0);          // left
    graphics.lineTo(0, h);           // bottom
    graphics.lineTo(w, 0);           // right
    graphics.closePath();
    graphics.fillPath();
    
    // Floor border for definition
    graphics.lineStyle(1, 0x000000, 0.2);
    graphics.beginPath();
    graphics.moveTo(0, -h);
    graphics.lineTo(-w, 0);
    graphics.lineTo(0, h);
    graphics.lineTo(w, 0);
    graphics.closePath();
    graphics.strokePath();
    
    // Floor pattern (tiles) - grid lines matching tile proportions
    graphics.lineStyle(1, 0x000000, 0.08);
    for (let i = 1; i < this.buildingWidth; i++) {
      const startX = -w + i * tileW;
      const startY = -h + i * tileH;
      graphics.lineBetween(startX, startY, startX + (this.buildingHeight * tileW), startY + (this.buildingHeight * tileH));
    }
    for (let j = 1; j < this.buildingHeight; j++) {
      const startX = -w + j * tileW;
      const startY = j * tileH;
      graphics.lineBetween(startX, startY, startX + (this.buildingWidth * tileW), startY - (this.buildingWidth * tileH));
    }
    
    // Back-left wall (north-west side)
    graphics.fillStyle(this.wallColor, 1);
    graphics.beginPath();
    graphics.moveTo(-w, 0);
    graphics.lineTo(-w, -wallHeight);
    graphics.lineTo(0, -h - wallHeight);
    graphics.lineTo(0, -h);
    graphics.closePath();
    graphics.fillPath();
    
    // Back-right wall (north-east side)
    graphics.fillStyle(this.darkenColor(this.wallColor, 0.8), 1);
    graphics.beginPath();
    graphics.moveTo(w, 0);
    graphics.lineTo(w, -wallHeight);
    graphics.lineTo(0, -h - wallHeight);
    graphics.lineTo(0, -h);
    graphics.closePath();
    graphics.fillPath();
    
    // Wall top edge highlight
    graphics.lineStyle(2, this.lightenColor(this.wallColor, 1.3), 1);
    graphics.beginPath();
    graphics.moveTo(-w, -wallHeight);
    graphics.lineTo(0, -h - wallHeight);
    graphics.lineTo(w, -wallHeight);
    graphics.strokePath();
    
    this.sprite.add(graphics);
    
    // Add interior details based on type
    this.addInteriorDetails();
    
    // Building label with background
    const labelBg = this.scene.add.graphics();
    labelBg.fillStyle(0x000000, 0.6);
    labelBg.fillRoundedRect(-50, -h - wallHeight - 28, 100, 18, 4);
    this.sprite.add(labelBg);
    
    const label = this.scene.add.text(0, -h - wallHeight - 20, this.name, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'system-ui',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.sprite.add(label);
  }

  private addInteriorDetails(): void {
    const w = this.buildingWidth * TILE_WIDTH / 2;
    const h = this.buildingHeight * TILE_HEIGHT / 2;
    const details = this.scene.add.graphics();
    
    switch (this.type) {
      case 'home':
        // Bed
        details.fillStyle(0x8ecae6, 1);
        details.fillRect(-w * 0.6, -h * 0.3, 20, 12);
        // Couch
        details.fillStyle(0xe07a5f, 1);
        details.fillRect(w * 0.2, h * 0.1, 18, 10);
        // Plant
        details.fillStyle(0x588157, 1);
        details.fillCircle(-w * 0.3, h * 0.4, 6);
        break;
        
      case 'clinic':
        // Reception desk
        details.fillStyle(0xdda15e, 1);
        details.fillRect(-w * 0.5, h * 0.2, 30, 8);
        // Chairs
        details.fillStyle(0x457b9d, 1);
        details.fillRect(w * 0.1, h * 0.3, 8, 8);
        details.fillRect(w * 0.3, h * 0.3, 8, 8);
        // Medical cross
        details.fillStyle(0xe63946, 1);
        details.fillRect(-w * 0.15, -h * 0.5, 12, 4);
        details.fillRect(-w * 0.15 + 4, -h * 0.5 - 4, 4, 12);
        break;
        
      case 'pharmacy':
        // Shelves
        details.fillStyle(0xa8dadc, 1);
        details.fillRect(-w * 0.4, -h * 0.2, 24, 6);
        details.fillRect(-w * 0.4, h * 0.1, 24, 6);
        // Counter
        details.fillStyle(0xf1faee, 1);
        details.fillRect(w * 0.1, h * 0.2, 16, 8);
        break;
        
      case 'lab':
        // Lab benches
        details.fillStyle(0xe9ecef, 1);
        details.fillRect(-w * 0.5, -h * 0.3, 28, 8);
        details.fillRect(w * 0.1, -h * 0.3, 28, 8);
        // Microscope
        details.fillStyle(0x343a40, 1);
        details.fillCircle(-w * 0.3, -h * 0.25, 4);
        break;
        
      case 'hospital':
        // Bed
        details.fillStyle(0xf8f9fa, 1);
        details.fillRect(-w * 0.4, 0, 24, 14);
        // Monitor
        details.fillStyle(0x212529, 1);
        details.fillRect(w * 0.2, -h * 0.3, 10, 8);
        details.fillStyle(0x40c057, 1);
        details.fillRect(w * 0.22, -h * 0.28, 6, 4);
        break;
    }
    
    this.sprite.add(details);
  }

  private registerObstacles(): void {
    for (let dx = 0; dx < this.buildingWidth; dx++) {
      for (let dy = 0; dy < this.buildingHeight; dy++) {
        this.pathfinder.setObstacle(this._originGridX + dx, this._originGridY + dy);
      }
    }
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

  getEntryPoint(): { x: number; y: number } {
    return this.entryPoint;
  }

  private createHintIndicators(): void {
    const _w = this.buildingWidth * TILE_WIDTH / 2;
    const h = this.buildingHeight * TILE_HEIGHT / 2;
    
    // Glow effect (for active building)
    this.glowGraphics = this.scene.add.graphics();
    this.glowGraphics.setVisible(false);
    this.sprite.add(this.glowGraphics);
    // Move glow to back
    this.sprite.sendToBack(this.glowGraphics);
    
    // Star indicator (for next step hint)
    this.hintIndicator = this.scene.add.text(
      0, -h - 50,
      '✨',
      { fontSize: '24px' }
    ).setOrigin(0.5);
    this.hintIndicator.setVisible(false);
    this.sprite.add(this.hintIndicator);
  }

  /**
   * Create a small floating logo above the building
   */
  private createFloatingLogo(textureKey: string): void {
    const h = this.buildingHeight * TILE_HEIGHT / 2;
    const wallHeight = 28;
    
    // Create the floating logo image - position it just above the building label
    // Logo is loaded at 64x64, scale down to ~20px for small building icon
    this.floatingLogo = this.scene.add.image(0, -h - wallHeight - 35, textureKey);
    this.floatingLogo.setScale(0.3); // Scale from 64px to ~20px
    this.floatingLogo.setAlpha(0.85);
    this.floatingLogo.setOrigin(0.5);
    
    // Add to sprite container
    this.sprite.add(this.floatingLogo);
    
    // Create gentle floating animation (bob up and down)
    const baseY = -h - wallHeight - 35;
    this.logoTween = this.scene.tweens.add({
      targets: this.floatingLogo,
      y: { from: baseY, to: baseY - 4 },
      alpha: { from: 0.85, to: 1 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  /**
   * Set visual hint for this building
   */
  setHint(hint: HintType): void {
    if (this.currentHint === hint) return;
    this.currentHint = hint;
    
    // Clear existing animations
    if (this.hintTween) {
      this.hintTween.stop();
      this.hintTween = undefined;
    }
    
    const w = this.buildingWidth * TILE_WIDTH / 2;
    const h = this.buildingHeight * TILE_HEIGHT / 2;
    
    switch (hint) {
      case 'next_step':
        // Show blinking star
        this.hintIndicator?.setVisible(true);
        this.glowGraphics?.setVisible(false);
        
        if (this.hintIndicator) {
          this.hintTween = this.scene.tweens.add({
            targets: this.hintIndicator,
            alpha: { from: 1, to: 0.3 },
            y: { from: -h - 50, to: -h - 55 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
        break;
        
      case 'active':
        // Show glow around building
        this.hintIndicator?.setVisible(false);
        this.glowGraphics?.setVisible(true);
        
        if (this.glowGraphics) {
          this.glowGraphics.clear();
          // Pulsing glow effect
          this.glowGraphics.fillStyle(0xf4a261, 0.25);
          this.glowGraphics.beginPath();
          this.glowGraphics.moveTo(0, -h - 10);
          this.glowGraphics.lineTo(-w - 10, 5);
          this.glowGraphics.lineTo(0, h + 10);
          this.glowGraphics.lineTo(w + 10, 5);
          this.glowGraphics.closePath();
          this.glowGraphics.fillPath();
          
          this.hintTween = this.scene.tweens.add({
            targets: this.glowGraphics,
            alpha: { from: 1, to: 0.4 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
        break;
        
      case 'none':
      default:
        this.hintIndicator?.setVisible(false);
        this.glowGraphics?.setVisible(false);
        break;
    }
  }

  update(_delta: number): void {}

  destroy(): void {
    // Clean up logo tween
    if (this.logoTween) {
      this.logoTween.stop();
      this.logoTween = undefined;
    }
    
    for (let dx = 0; dx < this.buildingWidth; dx++) {
      for (let dy = 0; dy < this.buildingHeight; dy++) {
        this.pathfinder.removeObstacle(this._originGridX + dx, this._originGridY + dy);
      }
    }
    super.destroy();
  }
}
