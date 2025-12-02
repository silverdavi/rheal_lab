import Phaser from 'phaser';
import { Stats, TREATMENT_NAMES, DIAGNOSIS_NAMES } from '@/systems/PlayerStats';

// Tooltips for medical terms
const TOOLTIPS: Record<string, string> = {
  amh: 'AMH (Anti-Müllerian Hormone): Indicates ovarian reserve.\n<1.0 = low, 1-3.5 = normal, >3.5 = high (possible PCOS)',
  fsh: 'FSH (Follicle Stimulating Hormone): Lower is better.\n<10 = good, 10-15 = fair, >15 = concerning',
  afc: 'AFC (Antral Follicle Count): Resting follicles visible on ultrasound.\n>12 = good reserve, 6-12 = fair, <6 = low',
  sperm_count: 'Sperm concentration in millions per mL.\n>15M/mL is normal. Lower may need IUI or IVF.',
  sperm_motility: 'Percentage of sperm swimming forward.\n>40% is normal. Low motility affects natural conception.',
  pcos: 'PCOS: More follicles but may not mature properly.\nOften responds well to medication.',
  endometriosis: 'Endometriosis: Tissue outside uterus can affect fertility.\nMay benefit from surgery or IVF.',
  male_factor: 'Male factor: Sperm issues contributing to infertility.\nIUI or ICSI can help bypass the issue.',
};

// Next step suggestions based on state
function getNextStep(stats: Stats): string {
  if (!stats.bloodworkDone) return '→ Get blood work at clinic';
  if (!stats.spermAnalysisDone) return '→ Get sperm analysis';
  if (!stats.diagnosisRevealed) return '→ Consult doctor for diagnosis';
  if (stats.cyclesAttempted < 3) return '→ Try timed intercourse cycles';
  if (stats.iuiAttempts < 3) return '→ Consider IUI treatment';
  if (stats.ivfAttempts < 2) return '→ Discuss IVF with doctor';
  return '→ Continue treatment plan';
}

/**
 * Compact stats panel with tooltips
 */
export class StatsPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bars: Map<string, { fill: Phaser.GameObjects.Graphics; baseY: number }> = new Map();
  private texts: Map<string, Phaser.GameObjects.Text> = new Map();
  private tooltip: Phaser.GameObjects.Container | null = null;
  private nextStepText!: Phaser.GameObjects.Text;
  
  private readonly PANEL_WIDTH = 210;
  private readonly PANEL_X = 12;
  private readonly PANEL_Y = 56;
  private readonly BAR_HEIGHT = 8;
  private readonly ROW_HEIGHT = 26;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(1000);
  }

  createPanel(stats: Stats): void {
    // Panel background - compact
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a14, 0.95);
    bg.fillRoundedRect(this.PANEL_X - 4, this.PANEL_Y - 4, this.PANEL_WIDTH + 8, 350, 8);
    bg.lineStyle(1, 0x2a2a4a, 1);
    bg.strokeRoundedRect(this.PANEL_X - 4, this.PANEL_Y - 4, this.PANEL_WIDTH + 8, 350, 8);
    this.container.add(bg);

    let y = this.PANEL_Y;

    // Names & Age
    const nameText = this.scene.add.text(
      this.PANEL_X + this.PANEL_WIDTH / 2, y,
      `${stats.patientName} & ${stats.partnerName}, ${stats.age}`,
      { fontSize: '13px', color: '#f4a261', fontFamily: 'Georgia, serif', fontStyle: 'bold' }
    ).setOrigin(0.5, 0);
    this.container.add(nameText);
    this.texts.set('header', nameText);
    y += 20;

    // Wellbeing bars (compact)
    this.createStatBar('physical', '💪', y, 0x4ade80);
    y += this.ROW_HEIGHT;
    this.createStatBar('mental', '🧠', y, 0x60a5fa);
    y += this.ROW_HEIGHT;
    this.createStatBar('relationship', '💕', y, 0xf472b6);
    y += this.ROW_HEIGHT;
    this.createStatBar('hope', '✨', y, 0xfbbf24);
    y += this.ROW_HEIGHT + 4;

    // Journey info (compact)
    this.addDivider(y);
    y += 8;
    
    this.createInfoRow('treatment', '📋', y);
    y += 16;
    this.createInfoRow('time', '⏱️', y);
    y += 16;
    this.createInfoRow('money', '💰', y);
    y += 16;
    this.createInfoRow('loan', '💳', y);
    y += 20;

    // Medical section with tooltips
    this.addDivider(y);
    y += 8;
    
    this.createInfoRowWithTooltip('bloodwork', '🩸', y, 'amh');
    y += 16;
    this.createInfoRowWithTooltip('sperm', '🔬', y, 'sperm_count');
    y += 16;
    this.createInfoRowWithTooltip('diagnosis', '📝', y, 'diagnosis');
    y += 22;

    // NEXT STEP - prominent
    this.addDivider(y);
    y += 10;
    
    const nextLabel = this.scene.add.text(this.PANEL_X, y, 'NEXT STEP', {
      fontSize: '9px', color: '#f4a261', fontFamily: 'system-ui', letterSpacing: 1
    });
    this.container.add(nextLabel);
    y += 14;
    
    this.nextStepText = this.scene.add.text(this.PANEL_X, y, '', {
      fontSize: '12px', color: '#22c55e', fontFamily: 'system-ui', fontStyle: 'bold',
      wordWrap: { width: this.PANEL_WIDTH }
    });
    this.container.add(this.nextStepText);

    this.update(stats);
  }

  private addDivider(y: number): void {
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, 0x2a2a4a, 0.6);
    divider.lineBetween(this.PANEL_X, y, this.PANEL_X + this.PANEL_WIDTH, y);
    this.container.add(divider);
  }

  private createStatBar(key: string, icon: string, y: number, _color: number): void {
    const label = this.scene.add.text(this.PANEL_X, y, icon, { fontSize: '11px' });
    this.container.add(label);

    const barY = y + 2;
    const barX = this.PANEL_X + 22;
    const barWidth = this.PANEL_WIDTH - 50;
    
    const barBg = this.scene.add.graphics();
    barBg.fillStyle(0x1a1a2a, 1);
    barBg.fillRoundedRect(barX, barY, barWidth, this.BAR_HEIGHT, 3);
    this.container.add(barBg);

    const barFill = this.scene.add.graphics();
    this.container.add(barFill);
    this.bars.set(key, { fill: barFill, baseY: barY });

    const valueText = this.scene.add.text(
      this.PANEL_X + this.PANEL_WIDTH, barY + this.BAR_HEIGHT / 2,
      '80%',
      { fontSize: '10px', color: '#a0a0a0', fontFamily: 'system-ui' }
    ).setOrigin(1, 0.5);
    this.container.add(valueText);
    this.texts.set(key, valueText);
  }

  private createInfoRow(key: string, icon: string, y: number): void {
    const label = this.scene.add.text(this.PANEL_X, y, icon, { fontSize: '11px' });
    this.container.add(label);

    const valueText = this.scene.add.text(this.PANEL_X + 22, y, '', {
      fontSize: '11px', color: '#c0c0c0', fontFamily: 'system-ui',
      wordWrap: { width: this.PANEL_WIDTH - 26 }
    });
    this.container.add(valueText);
    this.texts.set(key, valueText);
  }

  private createInfoRowWithTooltip(key: string, icon: string, y: number, tooltipKey: string): void {
    const label = this.scene.add.text(this.PANEL_X, y, icon, { fontSize: '11px' });
    this.container.add(label);

    const valueText = this.scene.add.text(this.PANEL_X + 22, y, '', {
      fontSize: '11px', color: '#c0c0c0', fontFamily: 'system-ui',
      wordWrap: { width: this.PANEL_WIDTH - 40 }
    });
    this.container.add(valueText);
    this.texts.set(key, valueText);

    // Info button for tooltip
    const infoBtn = this.scene.add.text(
      this.PANEL_X + this.PANEL_WIDTH, y,
      'ⓘ',
      { fontSize: '11px', color: '#606080' }
    ).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.container.add(infoBtn);

    infoBtn.on('pointerover', () => {
      infoBtn.setColor('#f4a261');
      this.showTooltip(tooltipKey, this.PANEL_X + this.PANEL_WIDTH + 10, y);
    });
    infoBtn.on('pointerout', () => {
      infoBtn.setColor('#606080');
      this.hideTooltip();
    });
  }

  private showTooltip(key: string, x: number, y: number): void {
    this.hideTooltip();
    
    const text = TOOLTIPS[key] || 'Information not available';
    
    this.tooltip = this.scene.add.container(x, y);
    this.tooltip.setScrollFactor(0);
    this.tooltip.setDepth(2000);
    
    const tooltipText = this.scene.add.text(8, 8, text, {
      fontSize: '10px', color: '#e0e0e0', fontFamily: 'system-ui',
      wordWrap: { width: 200 }, lineSpacing: 2
    });
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.98);
    bg.fillRoundedRect(0, 0, tooltipText.width + 16, tooltipText.height + 16, 6);
    bg.lineStyle(1, 0xf4a261, 0.5);
    bg.strokeRoundedRect(0, 0, tooltipText.width + 16, tooltipText.height + 16, 6);
    
    this.tooltip.add(bg);
    this.tooltip.add(tooltipText);
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  update(stats: Stats): void {
    // Header
    const header = this.texts.get('header');
    if (header) {
      header.setText(`${stats.patientName} & ${stats.partnerName}, ${stats.age}`);
    }

    // Bars
    this.updateBar('physical', stats.physical, 0x4ade80);
    this.updateBar('mental', stats.mental, 0x60a5fa);
    this.updateBar('relationship', stats.relationship, 0xf472b6);
    this.updateBar('hope', stats.hope, 0xfbbf24);

    // Journey
    this.setText('treatment', TREATMENT_NAMES[stats.treatmentStage]);
    const months = stats.monthsElapsed;
    const years = Math.floor(months / 12);
    const totalDays = stats.totalDays || 0;
    const timeStr = years > 0 
      ? `${years}y ${months % 12}m`
      : `${months}m`;
    this.setText('time', `${timeStr} (${totalDays}d) · CD${stats.cycleDay}`);
    this.setText('money', `$${stats.money.toLocaleString()}`);
    
    // Loan info
    if (stats.loanBalance > 0) {
      this.setText('loan', `Owe $${stats.loanBalance.toLocaleString()} ($${stats.monthlyPayment}/mo)`);
    } else {
      this.setText('loan', 'No debt');
    }

    // Medical
    if (stats.bloodworkDone) {
      this.setText('bloodwork', `AMH ${stats.amh.toFixed(1)} · FSH ${stats.fsh.toFixed(0)} · AFC ${stats.afc}`);
    } else {
      this.setText('bloodwork', 'Not tested');
    }

    if (stats.spermAnalysisDone) {
      const ok = stats.spermCount >= 15 && stats.spermMotility >= 40;
      this.setText('sperm', `${stats.spermCount.toFixed(0)}M · ${stats.spermMotility.toFixed(0)}% ${ok ? '✓' : '⚠️'}`);
    } else {
      this.setText('sperm', 'Not tested');
    }

    if (stats.diagnosisRevealed && stats.diagnoses.length > 0) {
      this.setText('diagnosis', stats.diagnoses.map(d => DIAGNOSIS_NAMES[d]).join(', '));
    } else if (stats.diagnosisRevealed) {
      this.setText('diagnosis', 'Unexplained');
    } else {
      this.setText('diagnosis', 'Pending');
    }

    // Next step
    this.nextStepText.setText(getNextStep(stats));
  }

  private setText(key: string, text: string): void {
    const t = this.texts.get(key);
    if (t) t.setText(text);
  }

  private updateBar(key: string, value: number, baseColor: number): void {
    const bar = this.bars.get(key);
    const text = this.texts.get(key);
    
    if (bar) {
      bar.fill.clear();
      
      let color = baseColor;
      if (value < 30) color = 0xef4444;
      else if (value < 50) color = 0xf59e0b;
      
      bar.fill.fillStyle(color, 1);
      const barX = this.PANEL_X + 22;
      const barWidth = this.PANEL_WIDTH - 50;
      const width = Math.max(3, (barWidth * value) / 100);
      bar.fill.fillRoundedRect(barX, bar.baseY, width, this.BAR_HEIGHT, 3);
    }
    
    if (text) {
      text.setText(`${Math.round(value)}%`);
    }
  }
}
