import Phaser from 'phaser';

export interface Message {
  title: string;
  text: string;
  icon?: string;
  type?: 'info' | 'success' | 'warning' | 'decision';
  choices?: Array<{
    text: string;
    callback: () => void;
  }>;
}

/**
 * Dialog box for story text and decisions
 */
export class MessageBox {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private isVisible: boolean = false;
  private isAnimating: boolean = false;
  private pendingMessage: { message: Message; onComplete?: () => void } | null = null;
  
  private readonly BOX_WIDTH = 480;
  private readonly MIN_BOX_HEIGHT = 160;
  private readonly BUTTON_HEIGHT = 36;
  private readonly BUTTON_SPACING = 8;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Position to the right to avoid overlapping the chat panel on the left
    this.container = scene.add.container(
      scene.cameras.main.width / 2 + 160,
      scene.cameras.main.height - 130
    );
    this.container.setScrollFactor(0);
    this.container.setDepth(2000);
    this.container.setVisible(false);
  }

  show(message: Message, onComplete?: () => void): void {
    // If animating, queue this message
    if (this.isAnimating) {
      this.pendingMessage = { message, onComplete };
      return;
    }
    
    // If already visible, hide first then show new
    if (this.isVisible) {
      this.pendingMessage = { message, onComplete };
      this.hideImmediate();
      this.scene.time.delayedCall(50, () => {
        if (this.pendingMessage) {
          const pending = this.pendingMessage;
          this.pendingMessage = null;
          this.showImmediate(pending.message, pending.onComplete);
        }
      });
      return;
    }
    
    this.showImmediate(message, onComplete);
  }

  private showImmediate(message: Message, onComplete?: () => void): void {
    this.container.removeAll(true);
    
    const colors = {
      info: { bg: 0x1e3a5f, border: 0x3b82f6, glow: 0x3b82f6 },
      success: { bg: 0x14532d, border: 0x22c55e, glow: 0x22c55e },
      warning: { bg: 0x78350f, border: 0xf59e0b, glow: 0xf59e0b },
      decision: { bg: 0x3f1f5c, border: 0xa855f7, glow: 0xa855f7 },
    };
    const style = colors[message.type ?? 'info'];

    // Measure body text height first
    const tempBody = this.scene.add.text(0, 0, message.text, {
      fontSize: '14px',
      fontFamily: 'system-ui',
      wordWrap: { width: this.BOX_WIDTH - 50 },
      lineSpacing: 4,
    });
    const bodyHeight = tempBody.height;
    tempBody.destroy();

    // Calculate button layout
    const numChoices = message.choices?.length ?? 0;
    const buttonsPerRow = numChoices <= 3 ? numChoices : 2;
    const numRows = Math.ceil(numChoices / buttonsPerRow);
    const buttonsHeight = numChoices > 0 
      ? numRows * this.BUTTON_HEIGHT + (numRows - 1) * this.BUTTON_SPACING + 20
      : 30;

    // Calculate dynamic box height
    const titleHeight = 40;
    const padding = 30;
    const boxHeight = Math.max(
      this.MIN_BOX_HEIGHT,
      titleHeight + bodyHeight + buttonsHeight + padding
    );

    // Glow effect
    const glow = this.scene.add.graphics();
    glow.fillStyle(style.glow, 0.15);
    glow.fillRoundedRect(
      -this.BOX_WIDTH / 2 - 8, 
      -boxHeight / 2 - 8, 
      this.BOX_WIDTH + 16, 
      boxHeight + 16, 
      16
    );
    this.container.add(glow);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(style.bg, 0.97);
    bg.fillRoundedRect(-this.BOX_WIDTH / 2, -boxHeight / 2, this.BOX_WIDTH, boxHeight, 12);
    bg.lineStyle(2, style.border, 1);
    bg.strokeRoundedRect(-this.BOX_WIDTH / 2, -boxHeight / 2, this.BOX_WIDTH, boxHeight, 12);
    this.container.add(bg);

    // Title (no icon in title - cleaner)
    const title = this.scene.add.text(0, -boxHeight / 2 + 16, message.title, {
      fontSize: '17px',
      color: '#ffffff',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Body text - positioned below title
    const bodyY = -boxHeight / 2 + titleHeight + bodyHeight / 2;
    const body = this.scene.add.text(0, bodyY, message.text, {
      fontSize: '14px',
      color: '#e0e0e0',
      fontFamily: 'system-ui',
      wordWrap: { width: this.BOX_WIDTH - 50 },
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5, 0.5);
    this.container.add(body);

    // Choices or continue prompt
    if (message.choices && message.choices.length > 0) {
      this.createChoiceButtons(message.choices, boxHeight);
    } else {
      const continueText = this.scene.add.text(0, boxHeight / 2 - 24, '▶ Click to continue', {
        fontSize: '12px',
        color: '#a0a0c0',
        fontFamily: 'system-ui',
      }).setOrigin(0.5);
      this.container.add(continueText);

      this.scene.tweens.add({
        targets: continueText,
        alpha: 0.5,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });

      const hitArea = this.scene.add.rectangle(0, 0, this.BOX_WIDTH, boxHeight, 0x000000, 0).setInteractive();
      this.container.add(hitArea);
      
      hitArea.once('pointerdown', () => {
        this.hide(onComplete);
      });
    }

    this.container.setVisible(true);
    this.isVisible = true;
    this.isAnimating = true;

    this.container.setAlpha(0);
    this.container.setScale(0.95);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.isAnimating = false;
      },
    });
  }

  private createChoiceButtons(
    choices: Array<{ text: string; callback: () => void }>,
    boxHeight: number
  ): void {
    const numChoices = choices.length;
    
    // Grid layout: 2-3 buttons per row
    const buttonsPerRow = numChoices <= 3 ? numChoices : 2;
    const numRows = Math.ceil(numChoices / buttonsPerRow);
    
    // Calculate button width to fit nicely
    const horizontalPadding = 30;
    const horizontalSpacing = 10;
    const buttonWidth = (this.BOX_WIDTH - horizontalPadding * 2 - (buttonsPerRow - 1) * horizontalSpacing) / buttonsPerRow;
    
    // Start Y position for buttons
    const totalButtonsHeight = numRows * this.BUTTON_HEIGHT + (numRows - 1) * this.BUTTON_SPACING;
    let y = boxHeight / 2 - 15 - totalButtonsHeight;
    
    for (let row = 0; row < numRows; row++) {
      const startIdx = row * buttonsPerRow;
      const rowChoices = choices.slice(startIdx, startIdx + buttonsPerRow);
      
      // Center this row
      const rowWidth = rowChoices.length * buttonWidth + (rowChoices.length - 1) * horizontalSpacing;
      let x = -rowWidth / 2 + buttonWidth / 2;
      
      for (const choice of rowChoices) {
        this.createSingleButton(x, y, buttonWidth, this.BUTTON_HEIGHT, choice);
        x += buttonWidth + horizontalSpacing;
      }
      
      y += this.BUTTON_HEIGHT + this.BUTTON_SPACING;
    }
  }
  
  private createSingleButton(
    x: number, 
    y: number, 
    buttonWidth: number, 
    buttonHeight: number, 
    choice: { text: string; callback: () => void }
  ): void {
    // Button background
    const btn = this.scene.add.graphics();
    btn.fillStyle(0x4a4a6a, 1);
    btn.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
    btn.setPosition(x, y);
    
    // Button text
    const btnText = this.scene.add.text(x, y, choice.text, {
      fontSize: '13px',
      color: '#ffffff',
      fontFamily: 'system-ui',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Hit area
    const hitArea = this.scene.add.rectangle(
      x, y, buttonWidth, buttonHeight, 0x000000, 0
    ).setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      btn.clear();
      btn.fillStyle(0x6a6a9a, 1);
      btn.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
      btn.lineStyle(2, 0xa0a0c0, 1);
      btn.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
    });
    
    hitArea.on('pointerout', () => {
      btn.clear();
      btn.fillStyle(0x4a4a6a, 1);
      btn.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
    });
    
    hitArea.once('pointerdown', () => {
      // Execute callback after hide completes
      this.hide(() => {
        choice.callback();
      });
    });

    this.container.add(btn);
    this.container.add(btnText);
    this.container.add(hitArea);
  }

  hide(onComplete?: () => void): void {
    if (!this.isVisible || this.isAnimating) return;
    
    this.isAnimating = true;
    
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scale: 0.95,
      duration: 150,
      onComplete: () => {
        this.container.setVisible(false);
        this.isVisible = false;
        this.isAnimating = false;
        
        // Check for pending message first
        if (this.pendingMessage) {
          const pending = this.pendingMessage;
          this.pendingMessage = null;
          this.scene.time.delayedCall(50, () => {
            this.showImmediate(pending.message, pending.onComplete);
          });
        } else if (onComplete) {
          // Delay callback slightly to prevent race conditions
          this.scene.time.delayedCall(50, onComplete);
        }
      },
    });
  }

  private hideImmediate(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.setVisible(false);
    this.container.setAlpha(1);
    this.container.setScale(1);
    this.isVisible = false;
    this.isAnimating = false;
  }

  get visible(): boolean {
    return this.isVisible;
  }
}
