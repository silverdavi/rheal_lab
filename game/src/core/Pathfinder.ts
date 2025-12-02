import { IsoUtils } from './IsoUtils';

interface PathNode {
  x: number;
  y: number;
  g: number; // cost from start
  h: number; // heuristic to end
  f: number; // total cost
  parent: PathNode | null;
}

/**
 * A* Pathfinding for isometric grid
 */
export class Pathfinder {
  private width: number;
  private height: number;
  private obstacles: Set<string>;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.obstacles = new Set();
  }

  /**
   * Mark a cell as blocked
   */
  setObstacle(x: number, y: number): void {
    this.obstacles.add(`${x},${y}`);
  }

  /**
   * Remove obstacle from cell
   */
  removeObstacle(x: number, y: number): void {
    this.obstacles.delete(`${x},${y}`);
  }

  /**
   * Check if cell is walkable
   */
  isWalkable(x: number, y: number): boolean {
    if (!IsoUtils.isInBounds(x, y, this.width, this.height)) return false;
    return !this.obstacles.has(`${x},${y}`);
  }

  /**
   * Find path from start to end using A*
   */
  findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Array<{ x: number; y: number }> {
    if (!this.isWalkable(endX, endY)) return [];

    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();

    const startNode: PathNode = {
      x: startX,
      y: startY,
      g: 0,
      h: IsoUtils.gridDistance(startX, startY, endX, endY),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    while (openSet.length > 0) {
      // Get node with lowest f score
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      
      // Reached destination
      if (current.x === endX && current.y === endY) {
        return this.reconstructPath(current);
      }

      closedSet.add(`${current.x},${current.y}`);

      // Check neighbors
      for (const neighbor of IsoUtils.getNeighbors(current.x, current.y)) {
        const key = `${neighbor.x},${neighbor.y}`;
        
        if (closedSet.has(key) || !this.isWalkable(neighbor.x, neighbor.y)) {
          continue;
        }

        const g = current.g + 1;
        const h = IsoUtils.gridDistance(neighbor.x, neighbor.y, endX, endY);
        const f = g + h;

        const existingNode = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
        
        if (!existingNode) {
          openSet.push({
            x: neighbor.x,
            y: neighbor.y,
            g,
            h,
            f,
            parent: current,
          });
        } else if (g < existingNode.g) {
          existingNode.g = g;
          existingNode.f = f;
          existingNode.parent = current;
        }
      }
    }

    return []; // No path found
  }

  private reconstructPath(node: PathNode): Array<{ x: number; y: number }> {
    const path: Array<{ x: number; y: number }> = [];
    let current: PathNode | null = node;
    
    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    
    return path;
  }
}

