import Phaser from 'phaser';
import { JOURNEY_STAGES } from '@/systems/PlayerStats';
import { GAME_WIDTH } from '@/config/game.config';

/**
 * Top progress bar showing journey stages
 */
export class ProgressTracker {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private stageNodes: Map<string, {
    bg: Phaser.GameObjects.Graphics;
    icon: Phaser.GameObjects.Text;
  }> = new Map();
  private progressLine!: Phaser.GameObjects.Graphics;
  private currentStage: string = 'start';

  private readonly TRACK_Y = 30;
  private readonly NODE_RADIUS = 16;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(1001);
    
    this.createTracker();
  }

  private createTracker(): void {
    const startX = 260;
    const endX = GAME_WIDTH - 40;
    const spacing = (endX - startX) / (JOURNEY_STAGES.length - 1);

    // Background track line
    const trackBg = this.scene.add.graphics();
    trackBg.lineStyle(4, 0x2a2a4a, 1);
    trackBg.lineBetween(startX, this.TRACK_Y, endX, this.TRACK_Y);
    this.container.add(trackBg);

    // Progress line (filled portion)
    this.progressLine = this.scene.add.graphics();
    this.container.add(this.progressLine);

    // Stage nodes
    JOURNEY_STAGES.forEach((stage, index) => {
      const x = startX + index * spacing;
      
      // Node background
      const nodeBg = this.scene.add.graphics();
      nodeBg.fillStyle(0x1a1a2e, 1);
      nodeBg.fillCircle(x, this.TRACK_Y, this.NODE_RADIUS);
      nodeBg.lineStyle(2, 0x3a3a5a, 1);
      nodeBg.strokeCircle(x, this.TRACK_Y, this.NODE_RADIUS);
      this.container.add(nodeBg);

      // Icon
      const icon = this.scene.add.text(x, this.TRACK_Y, stage.icon, {
        fontSize: '14px',
      }).setOrigin(0.5);
      this.container.add(icon);

      // Label below
      const label = this.scene.add.text(x, this.TRACK_Y + 22, stage.label, {
        fontSize: '9px',
        color: '#6a6a8a',
        fontFamily: 'system-ui',
      }).setOrigin(0.5, 0);
      this.container.add(label);

      this.stageNodes.set(stage.key, { bg: nodeBg, icon });
    });

    this.updateProgress('start');
  }

  updateProgress(currentStageKey: string): void {
    this.currentStage = currentStageKey;
    
    const currentIndex = JOURNEY_STAGES.findIndex(s => s.key === currentStageKey);
    if (currentIndex === -1) return;

    const startX = 260;
    const endX = GAME_WIDTH - 40;
    const spacing = (endX - startX) / (JOURNEY_STAGES.length - 1);

    // Update progress line
    this.progressLine.clear();
    if (currentIndex > 0) {
      this.progressLine.lineStyle(4, 0xf4a261, 1);
      this.progressLine.lineBetween(startX, this.TRACK_Y, startX + currentIndex * spacing, this.TRACK_Y);
    }

    // Update nodes
    JOURNEY_STAGES.forEach((stage, index) => {
      const node = this.stageNodes.get(stage.key);
      if (!node) return;

      const x = startX + index * spacing;
      node.bg.clear();

      if (index < currentIndex) {
        // Completed - green
        node.bg.fillStyle(0x22c55e, 1);
        node.bg.fillCircle(x, this.TRACK_Y, this.NODE_RADIUS);
        node.bg.lineStyle(2, 0x16a34a, 1);
        node.bg.strokeCircle(x, this.TRACK_Y, this.NODE_RADIUS);
      } else if (index === currentIndex) {
        // Current - orange/gold, pulsing
        node.bg.fillStyle(0xf4a261, 1);
        node.bg.fillCircle(x, this.TRACK_Y, this.NODE_RADIUS);
        node.bg.lineStyle(3, 0xfbbf24, 1);
        node.bg.strokeCircle(x, this.TRACK_Y, this.NODE_RADIUS);
        
        // Add glow effect
        node.bg.lineStyle(6, 0xfbbf24, 0.3);
        node.bg.strokeCircle(x, this.TRACK_Y, this.NODE_RADIUS + 4);
      } else {
        // Future - dim
        node.bg.fillStyle(0x1a1a2e, 1);
        node.bg.fillCircle(x, this.TRACK_Y, this.NODE_RADIUS);
        node.bg.lineStyle(2, 0x3a3a5a, 1);
        node.bg.strokeCircle(x, this.TRACK_Y, this.NODE_RADIUS);
      }
    });
  }

  /**
   * Animate moving to next stage
   */
  advanceTo(stageKey: string): void {
    const oldIndex = JOURNEY_STAGES.findIndex(s => s.key === this.currentStage);
    const newIndex = JOURNEY_STAGES.findIndex(s => s.key === stageKey);
    
    if (newIndex > oldIndex) {
      // Animate progress
      this.scene.tweens.addCounter({
        from: oldIndex,
        to: newIndex,
        duration: 500,
        ease: 'Power2',
        onUpdate: (tween) => {
          const value = tween.getValue();
          const progress = Math.floor(value ?? oldIndex);
          this.updateProgress(JOURNEY_STAGES[progress].key);
        },
        onComplete: () => {
          this.updateProgress(stageKey);
        },
      });
    } else {
      this.updateProgress(stageKey);
    }
  }
}

