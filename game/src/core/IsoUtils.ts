import { TILE_WIDTH, TILE_HEIGHT, GAME_WIDTH } from '@/config/game.config';

/**
 * Isometric coordinate utilities
 * Handles conversion between grid coords (x,y) and screen coords (px, py)
 */
export class IsoUtils {
  /**
   * Convert grid coordinates to screen position
   */
  // Offset to shift grid right (away from left dashboard)
  private static readonly X_OFFSET = GAME_WIDTH / 2 + 120;
  
  static gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    const screenX = (gridX - gridY) * (TILE_WIDTH / 2) + this.X_OFFSET;
    const screenY = (gridX + gridY) * (TILE_HEIGHT / 2) + 100; // offset from top
    return { x: screenX, y: screenY };
  }

  /**
   * Convert screen position to grid coordinates
   */
  static screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
    const adjustedX = screenX - this.X_OFFSET;
    const adjustedY = screenY - 100;
    
    const gridX = (adjustedX / (TILE_WIDTH / 2) + adjustedY / (TILE_HEIGHT / 2)) / 2;
    const gridY = (adjustedY / (TILE_HEIGHT / 2) - adjustedX / (TILE_WIDTH / 2)) / 2;
    
    return { x: Math.floor(gridX), y: Math.floor(gridY) };
  }

  /**
   * Get depth value for proper sprite ordering (back-to-front)
   */
  static getDepth(gridX: number, gridY: number, zOffset: number = 0): number {
    return (gridX + gridY) * 10 + zOffset;
  }

  /**
   * Calculate distance between two grid points
   */
  static gridDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1); // Manhattan distance
  }

  /**
   * Get neighboring grid cells (4-directional)
   */
  static getNeighbors(x: number, y: number): Array<{ x: number; y: number; dir: string }> {
    return [
      { x: x - 1, y: y, dir: 'west' },
      { x: x + 1, y: y, dir: 'east' },
      { x: x, y: y - 1, dir: 'north' },
      { x: x, y: y + 1, dir: 'south' },
    ];
  }

  /**
   * Check if grid position is within bounds
   */
  static isInBounds(x: number, y: number, width: number, height: number): boolean {
    return x >= 0 && x < width && y >= 0 && y < height;
  }
}

