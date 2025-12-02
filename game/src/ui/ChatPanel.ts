import Phaser from 'phaser';
import { Stats, DIAGNOSIS_NAMES, TREATMENT_NAMES } from '@/systems/PlayerStats';
import { RHEA_FERTILITY_INFO, RHEA_WEBSITE } from '@/data/rheaFertilityInfo';
import { GAME_HEIGHT } from '@/config/game.config';

/**
 * AI Chat panel - fertility assistant powered by OpenAI
 */
export class ChatPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private messagesContainer: Phaser.GameObjects.Container;
  private inputText: Phaser.GameObjects.Text;
  private messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private currentInput: string = '';
  private isLoading: boolean = false;
  private statsRef: () => Stats;
  
  private readonly PANEL_WIDTH = 320;
  private readonly PANEL_HEIGHT = 380;
  private readonly MINIMIZED_HEIGHT = 36;
  private readonly PANEL_X = 12;
  private readonly PANEL_Y: number;
  
  private scrollOffset: number = 0;
  private maxScroll: number = 0;
  private isMinimized: boolean = false;
  private panelContent!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, getStats: () => Stats) {
    this.scene = scene;
    this.statsRef = getStats;
    this.PANEL_Y = GAME_HEIGHT - this.PANEL_HEIGHT - 12;
    
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(999);
    
    this.messagesContainer = scene.add.container(0, 0);
    this.panelContent = scene.add.container(0, 0);
    
    this.inputText = scene.add.text(0, 0, '', {});
    
    this.createPanel();
    this.addWelcomeMessage();
    this.setupKeyboard();
  }

  private createPanel(): void {
    // Panel background (will be redrawn on minimize/expand)
    const bg = this.scene.add.graphics();
    this.drawPanelBackground(bg);
    this.container.add(bg);

    // Header (always visible)
    const header = this.scene.add.graphics();
    header.fillStyle(0x1a1a2e, 1);
    header.fillRoundedRect(this.PANEL_X, this.PANEL_Y, this.PANEL_WIDTH, 36, { tl: 10, tr: 10, bl: 0, br: 0 });
    this.container.add(header);

    const title = this.scene.add.text(
      this.PANEL_X + 12, 
      this.PANEL_Y + 10,
      '🤖 Fertility Assistant',
      { fontSize: '14px', color: '#f4a261', fontFamily: 'system-ui', fontStyle: 'bold' }
    );
    this.container.add(title);

    // Minimize/Expand button
    const minimizeBtn = this.scene.add.text(
      this.PANEL_X + this.PANEL_WIDTH - 12,
      this.PANEL_Y + 10,
      '−',
      { fontSize: '18px', color: '#808090', fontFamily: 'system-ui', fontStyle: 'bold' }
    ).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.container.add(minimizeBtn);

    minimizeBtn.on('pointerover', () => minimizeBtn.setColor('#f4a261'));
    minimizeBtn.on('pointerout', () => minimizeBtn.setColor('#808090'));
    minimizeBtn.on('pointerdown', () => {
      this.isMinimized = !this.isMinimized;
      minimizeBtn.setText(this.isMinimized ? '+' : '−');
      this.panelContent.setVisible(!this.isMinimized);
      
      // Redraw background
      bg.clear();
      this.drawPanelBackground(bg);
    });

    // Content container (hidden when minimized)
    this.panelContent = this.scene.add.container(0, 0);
    this.container.add(this.panelContent);

    // Messages area (with mask)
    const messagesY = this.PANEL_Y + 44;
    const messagesHeight = this.PANEL_HEIGHT - 100;
    
    // Mask for messages
    const maskShape = this.scene.make.graphics({});
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(this.PANEL_X + 8, messagesY, this.PANEL_WIDTH - 16, messagesHeight);
    const mask = maskShape.createGeometryMask();
    
    this.messagesContainer = this.scene.add.container(0, 0);
    this.messagesContainer.setMask(mask);
    this.panelContent.add(this.messagesContainer);

    // Input area
    const inputY = this.PANEL_Y + this.PANEL_HEIGHT - 48;
    
    const inputBg = this.scene.add.graphics();
    inputBg.fillStyle(0x1a1a2e, 1);
    inputBg.fillRoundedRect(this.PANEL_X + 8, inputY, this.PANEL_WIDTH - 16, 36, 6);
    inputBg.lineStyle(1, 0x3a3a5a, 1);
    inputBg.strokeRoundedRect(this.PANEL_X + 8, inputY, this.PANEL_WIDTH - 16, 36, 6);
    this.panelContent.add(inputBg);

    this.inputText = this.scene.add.text(
      this.PANEL_X + 16, 
      inputY + 10,
      'Type a question...',
      { fontSize: '12px', color: '#606080', fontFamily: 'system-ui' }
    );
    this.panelContent.add(this.inputText);

    // Send hint
    const sendHint = this.scene.add.text(
      this.PANEL_X + this.PANEL_WIDTH - 16,
      inputY + 10,
      'Enter ↵',
      { fontSize: '10px', color: '#404060', fontFamily: 'system-ui' }
    ).setOrigin(1, 0);
    this.panelContent.add(sendHint);

    // Make input interactive
    const inputHitArea = this.scene.add.rectangle(
      this.PANEL_X + 8 + (this.PANEL_WIDTH - 16) / 2,
      inputY + 18,
      this.PANEL_WIDTH - 16,
      36,
      0x000000, 0
    ).setInteractive({ useHandCursor: true });
    this.panelContent.add(inputHitArea);

    inputHitArea.on('pointerdown', () => {
      // Focus effect
      inputBg.clear();
      inputBg.fillStyle(0x1a1a2e, 1);
      inputBg.fillRoundedRect(this.PANEL_X + 8, inputY, this.PANEL_WIDTH - 16, 36, 6);
      inputBg.lineStyle(2, 0xf4a261, 1);
      inputBg.strokeRoundedRect(this.PANEL_X + 8, inputY, this.PANEL_WIDTH - 16, 36, 6);
    });

    // Scroll handling
    this.panelContent.setInteractive(
      new Phaser.Geom.Rectangle(this.PANEL_X, messagesY, this.PANEL_WIDTH, messagesHeight),
      Phaser.Geom.Rectangle.Contains
    );
    
    this.scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _dx: number, _dy: number, dz: number) => {
      if (this.isMinimized) return;
      this.scrollOffset = Phaser.Math.Clamp(
        this.scrollOffset + dz * 0.5,
        0,
        this.maxScroll
      );
      this.updateMessagesPosition();
    });
  }

  private drawPanelBackground(bg: Phaser.GameObjects.Graphics): void {
    const height = this.isMinimized ? this.MINIMIZED_HEIGHT : this.PANEL_HEIGHT;
    const radius = this.isMinimized ? 10 : 10;
    
    bg.fillStyle(0x0a0a14, 0.97);
    bg.fillRoundedRect(
      this.PANEL_X, 
      this.PANEL_Y, 
      this.PANEL_WIDTH, 
      height, 
      radius
    );
    bg.lineStyle(1, 0x3a3a5a, 1);
    bg.strokeRoundedRect(
      this.PANEL_X, 
      this.PANEL_Y, 
      this.PANEL_WIDTH, 
      height, 
      radius
    );
  }

  private addWelcomeMessage(): void {
    this.messages.push({
      role: 'assistant',
      content: `Hi! I'm your fertility journey assistant. 

I can help explain:
• Your test results (AMH, FSH, etc.)
• Treatment options
• What to expect next
• General fertility questions

Just type your question below!`
    });
    this.renderMessages();
  }

  private setupKeyboard(): void {
    this.scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (this.isLoading) return;
      
      if (event.key === 'Enter' && this.currentInput.trim()) {
        this.sendMessage();
      } else if (event.key === 'Backspace') {
        this.currentInput = this.currentInput.slice(0, -1);
        this.updateInputDisplay();
      } else if (event.key.length === 1 && this.currentInput.length < 200) {
        this.currentInput += event.key;
        this.updateInputDisplay();
      }
    });
  }

  private updateInputDisplay(): void {
    if (this.currentInput) {
      this.inputText.setText(this.currentInput);
      this.inputText.setColor('#e0e0e0');
    } else {
      this.inputText.setText('Type a question...');
      this.inputText.setColor('#606080');
    }
  }

  private async sendMessage(): Promise<void> {
    const userMessage = this.currentInput.trim();
    this.currentInput = '';
    this.updateInputDisplay();
    
    this.messages.push({ role: 'user', content: userMessage });
    this.renderMessages();
    
    this.isLoading = true;
    this.messages.push({ role: 'assistant', content: '...' });
    this.renderMessages();
    
    try {
      const response = await this.callOpenAI(userMessage);
      this.messages[this.messages.length - 1].content = response;
    } catch (error) {
      console.error('OpenAI error:', error);
      this.messages[this.messages.length - 1].content = 
        'Sorry, I encountered an error. Please try again.';
    }
    
    this.isLoading = false;
    this.renderMessages();
  }

  private async callOpenAI(userMessage: string): Promise<string> {
    const stats = this.statsRef();
    
    // Build context about current game state
    const gameContext = `
Current patient status:
- Names: ${stats.patientName} & ${stats.partnerName}
- Age: ${stats.age}
- Treatment stage: ${TREATMENT_NAMES[stats.treatmentStage]}
- Months trying: ${stats.monthsElapsed}
- Cycles attempted: ${stats.cyclesAttempted}
${stats.bloodworkDone ? `
Blood results:
- AMH: ${stats.amh.toFixed(2)} ng/mL
- FSH: ${stats.fsh.toFixed(1)} mIU/mL
- AFC: ${stats.afc} follicles` : '- Blood work: Not done yet'}
${stats.spermAnalysisDone ? `
Sperm analysis:
- Count: ${stats.spermCount.toFixed(0)} million/mL
- Motility: ${stats.spermMotility.toFixed(0)}%` : ''}
${stats.diagnosisRevealed ? `
Diagnosis: ${stats.diagnoses.map(d => DIAGNOSIS_NAMES[d]).join(', ') || 'Unexplained'}` : ''}
- Current stats: Physical ${stats.physical}%, Mental ${stats.mental}%, Relationship ${stats.relationship}%, Hope ${stats.hope}%
- Money: $${stats.money.toLocaleString()}
`;

    const systemPrompt = `You are "Dr. Hope", a friendly NPC guide in a fertility journey game.

CRITICAL: Answer in 1-2 sentences MAX. Be brief like game dialogue!

STYLE: Warm, casual, encouraging. Use 1 emoji per response. 💜✨🎯

RULES:
- Use GAME DATA below for patient questions (age, stats, results)
- Off-topic? Say: "Let's focus on your journey! 🎯"
- For real help, say: "Visit ${RHEA_WEBSITE} for real guidance! 💜"

GAME DATA:
${gameContext}

RHEA FERTILITY INFO:
${RHEA_FERTILITY_INFO}

Remember: 1-2 sentences only! Short and sweet.`;

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      return `I'm not connected to an AI service right now. 

Based on your current status, here are some tips:
${!stats.bloodworkDone ? '• Visit the clinic to get blood work done first' : ''}
${!stats.spermAnalysisDone && stats.bloodworkDone ? '• Consider getting a sperm analysis' : ''}
${stats.cyclesAttempted > 3 ? '• After several cycles, ask Dr. Chen about IUI' : ''}

You can still explore the game and learn about the fertility journey!`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        messages: [
          { role: 'system', content: systemPrompt },
          ...this.messages.slice(-6).map(m => ({
            role: m.role,
            content: m.content
          })),
          { role: 'user', content: userMessage }
        ],
        max_completion_tokens: 3000,  // Allow internal reasoning, but prompt asks for 1-2 sentences
      }),
    });

    const data = await response.json();
    
    // Debug logging
    console.log('OpenAI response status:', response.status);
    console.log('OpenAI response data:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('OpenAI API error details:', data);
      throw new Error(`API error: ${response.status} - ${data.error?.message || JSON.stringify(data)}`);
    }

    // Check for various response formats
    const content = data.choices?.[0]?.message?.content;
    console.log('Extracted content:', content);
    
    if (!content) {
      console.error('No content in response. Full data:', data);
      console.error('Choices:', data.choices);
      console.error('First choice:', data.choices?.[0]);
      console.error('Message:', data.choices?.[0]?.message);
    }

    return content || 'Sorry, no response received. Check console for details.';
  }

  private renderMessages(): void {
    this.messagesContainer.removeAll(true);
    
    const messagesY = this.PANEL_Y + 44;
    const messagesHeight = this.PANEL_HEIGHT - 100;
    let y = messagesY + 8;
    
    for (const msg of this.messages) {
      const isUser = msg.role === 'user';
      const maxWidth = this.PANEL_WIDTH - 50;
      
      // Message bubble
      const bubble = this.scene.add.graphics();
      const text = this.scene.add.text(
        0, 0,
        msg.content,
        {
          fontSize: '11px',
          color: isUser ? '#ffffff' : '#e0e0e0',
          fontFamily: 'system-ui',
          wordWrap: { width: maxWidth - 16 },
          lineSpacing: 3,
        }
      );
      
      const bubbleWidth = Math.min(maxWidth, text.width + 16);
      const bubbleHeight = text.height + 12;
      const bubbleX = isUser 
        ? this.PANEL_X + this.PANEL_WIDTH - 16 - bubbleWidth 
        : this.PANEL_X + 16;
      
      bubble.fillStyle(isUser ? 0x3b82f6 : 0x2a2a3a, 1);
      bubble.fillRoundedRect(bubbleX, y, bubbleWidth, bubbleHeight, 8);
      
      text.setPosition(bubbleX + 8, y + 6);
      
      this.messagesContainer.add(bubble);
      this.messagesContainer.add(text);
      
      y += bubbleHeight + 8;
    }
    
    // Calculate scroll
    const totalHeight = y - messagesY;
    this.maxScroll = Math.max(0, totalHeight - messagesHeight);
    
    // Auto-scroll to bottom
    this.scrollOffset = this.maxScroll;
    this.updateMessagesPosition();
  }

  private updateMessagesPosition(): void {
    this.messagesContainer.y = -this.scrollOffset;
  }
}

