import Phaser from 'phaser';
import { IsoUtils } from '@/core/IsoUtils';
import { Pathfinder } from '@/core/Pathfinder';
import { Character } from '@/entities/Character';
import { Building } from '@/entities/Building';
import { PlayerStats } from '@/systems/PlayerStats';
import { StatsPanel } from '@/ui/StatsPanel';
import { MessageBox } from '@/ui/MessageBox';
import { ProgressTracker } from '@/ui/ProgressTracker';
import { ChatPanel } from '@/ui/ChatPanel';
import { FertilityCalculator } from '@/systems/FertilityCalculator';
import { gameHistory } from '@/systems/GameHistory';
import { 
  GRID_WIDTH, GRID_HEIGHT, TILE_WIDTH, TILE_HEIGHT, 
  COLORS, GAME_WIDTH, GAME_HEIGHT 
} from '@/config/game.config';

/**
 * Main game scene - the fertility journey
 */
export class GameScene extends Phaser.Scene {
  private pathfinder!: Pathfinder;
  private patient!: Character;
  private buildings: Map<string, Building> = new Map();
  private gridGraphics!: Phaser.GameObjects.Graphics;
  
  // Game systems
  private playerStats!: PlayerStats;
  private statsPanel!: StatsPanel;
  private messageBox!: MessageBox;
  private progressTracker!: ProgressTracker;
  private _chatPanel!: ChatPanel;
  
  // Game state
  private introShown: boolean = false;
  private currentBuilding: string | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Load Rhea Fertility logo at good quality, scale down via setScale instead
    this.load.svg('rhea_logo', '/rhea_logo.svg', { width: 64, height: 64 });
  }

  create(): void {
    this.pathfinder = new Pathfinder(GRID_WIDTH, GRID_HEIGHT);
    this.playerStats = new PlayerStats('Alex', 'Sam', 32);
    
    this.drawGrid();
    this.createBuildings();
    this.createCharacters();
    this.createUI();
    this.setupInput();
    
    // Start with intro
    this.time.delayedCall(500, () => this.showIntro());
    
    // Initial building hints
    this.time.delayedCall(1000, () => this.updateBuildingHints());
  }

  private createUI(): void {
    // Progress tracker at top
    this.progressTracker = new ProgressTracker(this);
    
    // Stats panel (left, upper)
    this.statsPanel = new StatsPanel(this);
    this.statsPanel.createPanel(this.playerStats.current);
    
    // Chat panel (left, lower) - the AI assistant
    this._chatPanel = new ChatPanel(this, () => this.playerStats.current);
    
    // Subscribe to stat changes
    this.playerStats.onChange((stats) => {
      this.statsPanel.update(stats);
      this.progressTracker.updateProgress(this.playerStats.getJourneyStage());
    });
    
    // Message box for dialog
    this.messageBox = new MessageBox(this);
    
    // Quick actions (top right)
    this.createQuickActions();
  }

  private objectiveText!: Phaser.GameObjects.Text;
  private objectiveBg!: Phaser.GameObjects.Graphics;

  private createQuickActions(): void {
    const x = GAME_WIDTH - 16;
    let y = 70;
    
    const skipBtn = this.add.text(x, y, '⏭️ Skip Days', {
      fontSize: '12px',
      color: '#808090',
      fontFamily: 'system-ui',
      backgroundColor: '#12121a',
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });
    
    skipBtn.on('pointerover', () => skipBtn.setColor('#f4a261'));
    skipBtn.on('pointerout', () => skipBtn.setColor('#808090'));
    skipBtn.on('pointerdown', () => this.showSkipOptions());
    
    // Start Over button (bottom right, subtle)
    const restartBtn = this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 70, '🔄 Start Over', {
      fontSize: '11px',
      color: '#606070',
      fontFamily: 'system-ui',
      backgroundColor: '#0a0a14cc',
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(1000).setInteractive({ useHandCursor: true });
    
    restartBtn.on('pointerover', () => restartBtn.setColor('#ef4444'));
    restartBtn.on('pointerout', () => restartBtn.setColor('#606070'));
    restartBtn.on('pointerdown', () => this.confirmRestart());
    
    // Current Objective panel (bottom right)
    this.objectiveBg = this.add.graphics();
    this.objectiveBg.setScrollFactor(0).setDepth(999);
    
    this.objectiveText = this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 16, '', {
      fontSize: '13px',
      color: '#ffffff',
      fontFamily: 'system-ui',
      backgroundColor: '#1a1a2eee',
      padding: { x: 12, y: 8 },
      align: 'right',
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(1000);
    
    this.updateObjective();
    
    // Update objective when stats change
    this.playerStats.onChange(() => this.updateObjective());
  }
  
  private updateObjective(): void {
    const stats = this.playerStats.current;
    let objective = '';
    let hint = '';
    
    if (!stats.bloodworkDone) {
      objective = '🎯 Visit the Clinic for blood work';
      hint = 'Click on the Fertility Clinic building';
    } else if (!stats.spermAnalysisDone) {
      objective = '🎯 Get sperm analysis at Clinic';
      hint = 'Click on the Fertility Clinic building';
    } else if (!stats.diagnosisRevealed) {
      objective = '🎯 Consult doctor for diagnosis';
      hint = 'Click on the Fertility Clinic building';
    } else if (stats.physical < 30) {
      objective = '⚠️ Rest at Home - energy low!';
      hint = 'Click on Home to rest';
    } else if (stats.mental < 30) {
      objective = '⚠️ Take a break - mental health low!';
      hint = 'Click on Home to rest or date night';
    } else if (stats.money < 100) {
      objective = '💼 Work from Home to earn money';
      hint = 'Click on Home → Work';
    } else if (stats.cyclesAttempted < 2) {
      objective = '🌙 Try for baby during fertile window';
      hint = 'Go Home → Try for Baby';
    } else if (stats.iuiAttempts < 2 && stats.cyclesAttempted >= 2) {
      objective = '💉 Consider IUI treatment';
      hint = 'Visit Clinic → Consult → Start IUI';
    } else if (stats.ivfAttempts < 2 && stats.iuiAttempts >= 2) {
      objective = '🧫 Consider IVF treatment';
      hint = 'Visit Clinic → Consult → Start IVF';
    } else {
      objective = '🎯 Continue your fertility journey';
      hint = 'Visit Clinic for treatment options';
    }
    
    this.objectiveText.setText(`${objective}\n${hint}`);
  }

  private showSkipOptions(): void {
    if (this.messageBox.visible) return;
    
    this.messageBox.show({
      title: 'Time Passes...',
      icon: '⏳',
      text: `Skip ahead to rest and wait. Physical energy recovers, but 
relationship may suffer without quality time together.`,
      type: 'decision',
      choices: [
        { text: '1 Week', callback: () => this.doSkip(7) },
        { text: '2 Weeks', callback: () => this.doSkip(14) },
        { text: 'Cancel', callback: () => {} },
      ],
    });
  }

  private confirmRestart(): void {
    if (this.messageBox.visible) return;
    
    this.messageBox.show({
      title: 'Start Over?',
      icon: '🔄',
      text: `This will reset your entire journey and start fresh.

All progress will be lost. Are you sure?`,
      type: 'warning',
      choices: [
        { 
          text: '✅ Yes, Restart', 
          callback: () => {
            // Clear game history
            gameHistory.clear();
            // Restart the scene
            this.scene.restart();
          }
        },
        { text: '❌ Cancel', callback: () => {} },
      ],
    });
  }

  private doSkip(days: number): void {
    const result = this.playerStats.skipDays(days);
    const _stats = this.playerStats.current;
    
    let text = `${days} days pass. You feel more rested.`;
    if (result.monthsPassed > 0) {
      text += `\n\nA new cycle begins.`;
    }
    if (result.relationshipLost > 5) {
      text += `\n\n"We should spend more time together..." 💔`;
    }
    
    this.messageBox.show({
      title: '📅 Time Passes',
      icon: '',
      text,
      type: result.relationshipLost > 5 ? 'warning' : 'info',
    });
  }

  private showIntro(): void {
    if (this.introShown) return;
    this.introShown = true;
    
    const stats = this.playerStats.current;
    
    this.messageBox.show({
      title: 'A New Chapter',
      icon: '💑',
      text: `${stats.patientName} and ${stats.partnerName} have been trying to start a family.
After months of hoping and waiting, they've decided to seek help.

Their journey begins today.`,
      type: 'info',
    }, () => {
      this.showFirstChoice();
    });
  }

  private showFirstChoice(): void {
    this.messageBox.show({
      title: 'First Steps',
      icon: '🏥',
      text: `The fertility clinic has an opening next week. 
Making that first appointment feels huge.`,
      type: 'decision',
      choices: [
        { text: '📞 Book It', callback: () => this.onBookClinic() },
        { text: '⏳ One More Month', callback: () => this.onWaitMore() },
      ],
    });
  }

  private onBookClinic(): void {
    this.playerStats.applyEffect({ mental: -5, hope: 10, money: -150, days: 7 });
    const stats = this.playerStats.current;
    
    this.messageBox.show({
      title: 'Appointment Booked',
      icon: '✅',
      text: `First consultation scheduled. ${stats.partnerName} squeezes ${stats.patientName}'s hand.
"Whatever happens, we're doing this together."`,
      type: 'success',
    }, () => {
      this.movePatientToBuilding('clinic', () => this.showFirstConsultation());
    });
  }

  private onWaitMore(): void {
    this.playerStats.applyEffect({ mental: -10, hope: -5, days: 28 });
    this.playerStats.modify({ cyclesAttempted: this.playerStats.current.cyclesAttempted + 1 });
    
    this.messageBox.show({
      title: 'Another Month',
      icon: '📅',
      text: `Another month of hoping. The two-week wait is agonizing.
Day 28. Negative. Again.`,
      type: 'warning',
    }, () => this.showFirstChoice());
  }

  private showFirstConsultation(): void {
    const stats = this.playerStats.current;
    
    this.messageBox.show({
      title: 'First Consultation',
      icon: '👩‍⚕️',
      text: `Dr. Chen reviews their history.

"Let's start with some tests—blood work for ${stats.patientName}, 
semen analysis for ${stats.partnerName}."`,
      type: 'info',
    }, () => {
      this.playerStats.modify({ treatmentStage: 'timed' });
      this.showTestingOptions();
    });
  }

  private showTestingOptions(): void {
    const stats = this.playerStats.current;
    
    const choices = [];
    if (!stats.bloodworkDone) {
      choices.push({ text: '🩸 Blood Work ($200)', callback: () => this.doBloodwork() });
    }
    if (!stats.spermAnalysisDone) {
      choices.push({ text: '🔬 Sperm Test ($150)', callback: () => this.doSpermAnalysis() });
    }
    if (stats.bloodworkDone && stats.spermAnalysisDone && !stats.diagnosisRevealed) {
      choices.push({ text: '📋 Get Diagnosis', callback: () => this.revealDiagnosis() });
    }
    choices.push({ text: '🚪 Leave', callback: () => {} });
    
    this.messageBox.show({
      title: 'Testing',
      icon: '🔬',
      text: stats.bloodworkDone && stats.spermAnalysisDone 
        ? 'All basic tests are done. Ready for diagnosis.'
        : 'Which tests should we do?',
      type: 'decision',
      choices,
    });
  }

  private doBloodwork(): void {
    this.playerStats.applyEffect({ physical: -5, mental: -5, money: -200, days: 5 });
    this.playerStats.revealBloodwork();
    const stats = this.playerStats.current;
    
    let note = '';
    if (stats.amh < 1.0) note = '\n\n⚠️ AMH is low for your age—fewer eggs, but quality matters.';
    else if (stats.amh > 3.5) note = '\n\n📝 AMH is high—possibly PCOS. More follicles available.';
    else note = '\n\n✅ Numbers look normal for your age.';
    
    this.messageBox.show({
      title: 'Blood Work Results',
      icon: '🩸',
      text: `• AMH: ${stats.amh.toFixed(2)} ng/mL
• FSH: ${stats.fsh.toFixed(1)} mIU/mL
• AFC: ${stats.afc} follicles${note}`,
      type: stats.amh < 1.0 ? 'warning' : 'success',
    }, () => this.showTestingOptions());
  }

  private doSpermAnalysis(): void {
    this.playerStats.applyEffect({ mental: -5, money: -150, days: 3 });
    this.playerStats.revealSpermAnalysis();
    const stats = this.playerStats.current;
    
    const ok = stats.spermCount >= 15 && stats.spermMotility >= 40;
    
    this.messageBox.show({
      title: 'Sperm Analysis',
      icon: '🔬',
      text: `• Count: ${stats.spermCount.toFixed(0)} M/mL ${stats.spermCount >= 15 ? '✅' : '⚠️'}
• Motility: ${stats.spermMotility.toFixed(0)}% ${stats.spermMotility >= 40 ? '✅' : '⚠️'}

${ok ? '✅ Parameters look good!' : '⚠️ Some values below normal range.'}`,
      type: ok ? 'success' : 'warning',
    }, () => this.showTestingOptions());
  }

  private revealDiagnosis(): void {
    this.playerStats.revealDiagnosis();
    const stats = this.playerStats.current;
    
    const diagnoses = stats.diagnoses;
    let text = '';
    
    if (diagnoses.includes('unexplained')) {
      text = 'All tests normal, yet no pregnancy. "Unexplained infertility"—frustrating but common.';
      this.playerStats.applyEffect({ hope: -10 });
    } else {
      const names = diagnoses.map(d => {
        if (d === 'pcos') return 'PCOS';
        if (d === 'endometriosis') return 'Endometriosis';
        if (d === 'male_factor') return 'Male Factor';
        if (d === 'low_ovarian_reserve') return 'Low Ovarian Reserve';
        return d;
      });
      text = `Diagnosis: ${names.join(', ')}\n\nThis helps us plan the right treatment approach.`;
    }
    
    this.messageBox.show({
      title: 'Diagnosis',
      icon: '📋',
      text,
      type: 'info',
    }, () => {
      this.progressTracker.advanceTo('testing');
      this.showTreatmentPlan();
    });
  }

  private showTreatmentPlan(): void {
    const stats = this.playerStats.current;
    const profile = {
      age: stats.age,
      amh: stats.bloodworkDone ? stats.amh : undefined,
      diagnoses: stats.diagnoses,
    };
    
    const timedChance = Math.round(FertilityCalculator.timedIntercourseProbability(profile) * 100);
    const iuiChance = Math.round(FertilityCalculator.iuiProbability(profile) * 100);
    const ivfPrediction = FertilityCalculator.ivfPrediction(profile);
    
    // Log to history
    gameHistory.logEvent('consultation', 'Treatment plan discussed', {
      gameDay: stats.cycleDay,
      cycleDay: stats.cycleDay,
      monthsElapsed: stats.monthsElapsed,
      physical: stats.physical,
      mental: stats.mental,
      relationship: stats.relationship,
      hope: stats.hope,
      money: stats.money,
    }, { timedChance, iuiChance, ivfPrediction }, 'clinic');
    
    this.messageBox.show({
      title: 'Treatment Plan',
      icon: '📝',
      text: `Dr. Chen outlines your options:

"Based on your results, here's what we recommend:
• Trying at home: ~${timedChance}% per cycle
• IUI treatment: ~${iuiChance}% per cycle  
• IVF: ~${ivfPrediction.livebirthChance}% success (expect ~${ivfPrediction.retrievedEggs} eggs)"`,
      type: 'info',
    }, () => {
      this.progressTracker.advanceTo('timed');
    });
  }

  /**
   * Move patient to a building and set it as active
   */
  private movePatientToBuilding(buildingKey: string, onArrive?: () => void): void {
    const building = this.buildings.get(buildingKey);
    if (!building) {
      onArrive?.();
      return;
    }
    
    // Clear previous building highlight
    if (this.currentBuilding) {
      this.buildings.get(this.currentBuilding)?.setHint('none');
    }
    
    const entry = building.getEntryPoint();
    
    this.patient?.moveTo(entry.x, entry.y, () => {
      // Set this building as active
      this.currentBuilding = buildingKey;
      building.setHint('active');
      
      if (onArrive) {
        this.time.delayedCall(300, onArrive);
      }
    });
  }

  /**
   * Set visual hints for buildings based on game state
   */
  private updateBuildingHints(): void {
    const stats = this.playerStats.current;
    
    // Clear all hints first
    for (const [key, building] of this.buildings) {
      if (key !== this.currentBuilding) {
        building.setHint('none');
      }
    }
    
    // Set hints based on game progression
    if (!stats.bloodworkDone || !stats.spermAnalysisDone) {
      // Hint to go to clinic for tests
      if (this.currentBuilding !== 'clinic') {
        this.buildings.get('clinic')?.setHint('next_step');
      }
    } else if (!stats.diagnosisRevealed) {
      // Need diagnosis
      if (this.currentBuilding !== 'clinic') {
        this.buildings.get('clinic')?.setHint('next_step');
      }
    } else if (stats.physical < 30 || stats.mental < 30) {
      // Need rest
      if (this.currentBuilding !== 'home') {
        this.buildings.get('home')?.setHint('next_step');
      }
    }
  }

  private drawGrid(): void {
    this.gridGraphics = this.add.graphics();
    
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const screen = IsoUtils.gridToScreen(x, y);
        
        const noise = Math.sin(x * 0.5) * Math.cos(y * 0.7) * 0.1;
        const baseColor = (x + y) % 2 === 0 ? COLORS.ground : COLORS.groundLight;
        const r = Math.max(0, Math.min(255, ((baseColor >> 16) & 0xff) + Math.floor(noise * 20)));
        const g = Math.max(0, Math.min(255, ((baseColor >> 8) & 0xff) + Math.floor(noise * 30)));
        const b = Math.max(0, Math.min(255, (baseColor & 0xff) + Math.floor(noise * 10)));
        const color = (r << 16) | (g << 8) | b;
        
        this.gridGraphics.fillStyle(color, 1);
        this.gridGraphics.beginPath();
        this.gridGraphics.moveTo(screen.x, screen.y - TILE_HEIGHT / 2);
        this.gridGraphics.lineTo(screen.x + TILE_WIDTH / 2, screen.y);
        this.gridGraphics.lineTo(screen.x, screen.y + TILE_HEIGHT / 2);
        this.gridGraphics.lineTo(screen.x - TILE_WIDTH / 2, screen.y);
        this.gridGraphics.closePath();
        this.gridGraphics.fillPath();
      }
    }
    
    this.addPaths();
    this.gridGraphics.setDepth(-1);
  }

  private addPaths(): void {
    /*
     * ISOMETRIC ROAD NETWORK
     * 
     * Roads follow grid lines which appear as DIAGONALS on screen:
     * - Constant gridX = diagonal going ↗ to ↙ (NE-SW on screen)
     * - Constant gridY = diagonal going ↖ to ↘ (NW-SE on screen)
     * 
     * Center crossroad at (7, 7)
     */
    const pathTiles = [
      // === NORTH-SOUTH MAIN ROAD (constant X=7, varying Y) ===
      // This appears as a diagonal from top-right to bottom-left
      [7, 4], [7, 5], [7, 6], [7, 7], [7, 8], [7, 9], [7, 10], [7, 11], [7, 13],
      [8, 4], [8, 5], // widen near clinic
      
      // === EAST-WEST ROAD (constant Y=7, varying X) ===
      // This appears as a diagonal from top-left to bottom-right
      [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [12, 7],
      [5, 8], [6, 8], // branch toward home
      [12, 8], [13, 8], // branch toward lab
      
      // === CENTER PLAZA (widen the intersection) ===
      [6, 6], [8, 6], [6, 8], [8, 8],
      
      // === CLINIC ENTRANCE ===
      [8, 3], [9, 4],
      
      // === HOME ENTRANCE ===  
      [4, 8], [5, 9],
      
      // === LAB ENTRANCE ===
      [12, 9], [13, 8],
      
      // === PHARMACY AREA ===
      [6, 13], [8, 13], [7, 14],
    ];
    
    for (const [x, y] of pathTiles) {
      const screen = IsoUtils.gridToScreen(x, y);
      this.gridGraphics.fillStyle(COLORS.path, 1);
      this.gridGraphics.beginPath();
      this.gridGraphics.moveTo(screen.x, screen.y - TILE_HEIGHT / 2);
      this.gridGraphics.lineTo(screen.x + TILE_WIDTH / 2, screen.y);
      this.gridGraphics.lineTo(screen.x, screen.y + TILE_HEIGHT / 2);
      this.gridGraphics.lineTo(screen.x - TILE_WIDTH / 2, screen.y);
      this.gridGraphics.closePath();
      this.gridGraphics.fillPath();
    }
  }

  private createBuildings(): void {
    /*
     * ISOMETRIC TOWN LAYOUT
     * 
     * In isometric view (camera from bottom-left looking up-right):
     * - Low gridY = BACK (appears higher on screen)
     * - High gridY = FRONT (appears lower on screen)
     * - Low gridX = WEST/LEFT  
     * - High gridX = EAST/RIGHT
     *
     * Screen formula: 
     *   screenX = (gridX - gridY) * 32 + offset
     *   screenY = (gridX + gridY) * 16 + offset
     *
     *              BACK (low Y)
     *                [CLINIC]
     *                  /  \
     *                /      \
     *      [HOME]  /    +    \  [LAB]
     *       WEST  \   center  /  EAST
     *              \   |     /
     *               \  |    /
     *              [FINANCE]
     *                  |
     *              [PHARMACY]
     *              FRONT (high Y)
     */
    
    // CLINIC - Back center (low Y = appears at top of diamond)
    const clinic = new Building({
      scene: this, gridX: 7, gridY: 2,
      name: 'Fertility Clinic', type: 'clinic',
      width: 3, height: 2,
      floorColor: 0xf0f4f8, wallColor: 0x94a3b8,
      pathfinder: this.pathfinder,
      floatingLogo: 'rhea_logo', // Rhea logo floats above clinic
    });
    this.buildings.set('clinic', clinic);

    // HOME - West side (low X = appears on left)
    const home = new Building({
      scene: this, gridX: 3, gridY: 7,
      name: 'Home', type: 'home',
      width: 2, height: 2,
      floorColor: 0xf5e6d3, wallColor: 0xdda15e,
      pathfinder: this.pathfinder,
    });
    this.buildings.set('home', home);

    // LAB - East side (high X = appears on right)
    const lab = new Building({
      scene: this, gridX: 11, gridY: 7,
      name: 'Embryology Lab', type: 'lab',
      width: 2, height: 2,
      floorColor: 0xfafafa, wallColor: 0x78909c,
      pathfinder: this.pathfinder,
      floatingLogo: 'rhea_logo', // Rhea logo floats above lab
    });
    this.buildings.set('lab', lab);

    // FINANCING - South of center (medium Y)
    const financing = new Building({
      scene: this, gridX: 7, gridY: 10,
      name: 'Financing', type: 'pharmacy',
      width: 1, height: 1,
      floorColor: 0xfef3c7, wallColor: 0xd97706,
      pathfinder: this.pathfinder,
    });
    this.buildings.set('financing', financing);

    // PHARMACY - Front/South (high Y = appears at bottom of diamond)
    const pharmacy = new Building({
      scene: this, gridX: 7, gridY: 12,
      name: 'Pharmacy', type: 'pharmacy',
      width: 2, height: 2,
      floorColor: 0xe8f5e9, wallColor: 0x66bb6a,
      pathfinder: this.pathfinder,
    });
    this.buildings.set('pharmacy', pharmacy);
  }

  private createCharacters(): void {
    // Single patient entity representing the person/couple on their journey
    // Start at the central intersection
    this.patient = new Character({
      scene: this, gridX: 7, gridY: 7,
      name: 'Patient', color: 0x7c3aed,
      pathfinder: this.pathfinder,
    });
  }

  private setupInput(): void {
    // Only allow clicking on buildings - no free movement
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.messageBox.visible) return;
      
      const grid = IsoUtils.screenToGrid(pointer.x, pointer.y);
      
      // Check buildings - clicking a building shows travel menu
      for (const [key, building] of this.buildings) {
        const entry = building.getEntryPoint();
        const dist = Math.abs(entry.x - grid.x) + Math.abs(entry.y - grid.y);
        if (dist <= 3) {
          this.showTravelConfirm(key);
          return;
        }
      }
      
      // Clicking elsewhere shows navigation menu
      this.showWhereToGo();
    });
  }

  /**
   * Show confirmation to travel to a building
   */
  private showTravelConfirm(key: string): void {
    const building = this.buildings.get(key);
    if (!building) return;
    
    // If already at this building, show its menu
    if (this.currentBuilding === key) {
      this.onBuildingClicked(key);
      return;
    }
    
    this.messageBox.show({
      title: `Go to ${building.name}?`,
      icon: this.getBuildingIcon(key),
      text: `Would you like to visit ${building.name}?`,
      type: 'decision',
      choices: [
        { text: '✅ Yes', callback: () => this.travelToBuilding(key) },
        { text: '❌ No', callback: () => {} },
      ],
    });
  }

  /**
   * Show navigation menu
   */
  private showWhereToGo(): void {
    const stats = this.playerStats.current;
    
    this.messageBox.show({
      title: 'Where to go?',
      icon: '🗺️',
      text: 'Choose your destination:',
      type: 'decision',
      choices: [
        { text: '🏠 Home', callback: () => this.travelToBuilding('home') },
        { text: '🏥 Clinic', callback: () => this.travelToBuilding('clinic') },
        { text: '💊 Pharmacy', callback: () => this.travelToBuilding('pharmacy') },
        { text: stats.money < 500 ? '💳 Financing ❗' : '💳 Financing', callback: () => this.travelToBuilding('financing') },
      ],
    });
  }

  private getBuildingIcon(key: string): string {
    const icons: Record<string, string> = {
      home: '🏠', clinic: '🏥', pharmacy: '💊', lab: '🔬', financing: '💳'
    };
    return icons[key] || '🏢';
  }

  /**
   * Travel to a building and show its menu
   */
  private travelToBuilding(key: string): void {
    const building = this.buildings.get(key);
    if (!building) return;
    
    // Clear previous building highlight
    if (this.currentBuilding) {
      this.buildings.get(this.currentBuilding)?.setHint('none');
    }
    
    const entry = building.getEntryPoint();
    this.patient?.moveTo(entry.x, entry.y, () => {
      this.currentBuilding = key;
      building.setHint('active');
      this.updateBuildingHints();
      // Show building menu after arrival
      this.time.delayedCall(200, () => this.onBuildingClicked(key));
    });
  }

  private onBuildingClicked(key: string): void {
    // Show the menu for this building
    switch (key) {
      case 'home': this.showHomeMenu(); break;
      case 'clinic': this.showClinicMenu(); break;
      case 'pharmacy': this.showPharmacyMenu(); break;
      case 'lab': this.showLabInfo(); break;
      case 'financing': this.showFinancingMenu(); break;
    }
  }

  private showFinancingMenu(): void {
    const stats = this.playerStats.current;
    
    let statusText = 'Fertility treatments can be expensive. We offer flexible payment options.';
    if (stats.loanBalance > 0) {
      statusText = `Current loan: $${stats.loanBalance.toLocaleString()} remaining\nMonthly payment: $${stats.monthlyPayment}/month`;
    }
    
    const choices: Array<{ text: string; callback: () => void }> = [];
    
    // Only show loan options if no existing loan or small balance
    if (stats.loanBalance === 0) {
      choices.push({
        text: '💵 Small Loan ($2,000)',
        callback: () => this.takeLoan(2000, 12),
      });
      choices.push({
        text: '💰 Medium Loan ($5,000)',
        callback: () => this.takeLoan(5000, 18),
      });
      choices.push({
        text: '🏦 IVF Loan ($15,000)',
        callback: () => this.takeLoan(15000, 36),
      });
    } else {
      // Can pay off loan early
      choices.push({
        text: `💸 Pay Extra ($${Math.min(500, stats.loanBalance)})`,
        callback: () => this.makeExtraPayment(500),
      });
      if (stats.money >= stats.loanBalance) {
        choices.push({
          text: `✅ Pay Off Full ($${stats.loanBalance})`,
          callback: () => this.payOffLoan(),
        });
      }
    }
    
    choices.push({
      text: '📋 Learn About Options',
      callback: () => {
        this.messageBox.show({
          title: 'Financing Options',
          icon: '📋',
          text: `Real-world options include:
• Personal loans (8-15% APR)
• Medical credit cards  
• Clinic payment plans
• Fertility grants & scholarships

Visit rheafertility.com for resources.`,
          type: 'info',
        });
      },
    });
    
    choices.push({ text: '🚪 Leave', callback: () => {} });
    
    this.messageBox.show({
      title: 'Fertility Financing',
      icon: '💳',
      text: statusText,
      type: 'decision',
      choices,
    });
  }
  
  private takeLoan(amount: number, months: number): void {
    const result = this.playerStats.takeLoan(amount, months, 0.08);
    const stats = this.playerStats.current;
    
    gameHistory.logEvent('loan_taken', `Took out $${amount} loan`, {
      gameDay: stats.cycleDay, cycleDay: stats.cycleDay, monthsElapsed: stats.monthsElapsed,
      physical: stats.physical, mental: stats.mental, relationship: stats.relationship,
      hope: stats.hope, money: stats.money,
    }, { amount, months, monthlyPayment: result.monthlyPayment }, 'financing');
    
    this.messageBox.show({
      title: 'Loan Approved! 💳',
      icon: '✅',
      text: `You've received $${amount.toLocaleString()}.

Monthly payment: $${result.monthlyPayment}/month for ${months} months.
Payments are automatic each cycle.`,
      type: 'success',
    }, () => this.updateBuildingHints());
  }
  
  private makeExtraPayment(amount: number): void {
    const stats = this.playerStats.current;
    const payment = Math.min(amount, stats.loanBalance, stats.money);
    
    if (payment <= 0 || stats.money < payment) {
      this.messageBox.show({
        title: 'Insufficient Funds',
        icon: '❌',
        text: 'You don\'t have enough money for this payment.',
        type: 'warning',
      });
      return;
    }
    
    this.playerStats.applyEffect({ money: -payment });
    this.playerStats.modify({ loanBalance: stats.loanBalance - payment });
    
    const newStats = this.playerStats.current;
    
    this.messageBox.show({
      title: 'Payment Made',
      icon: '✅',
      text: newStats.loanBalance > 0 
        ? `Paid $${payment}. Remaining balance: $${newStats.loanBalance.toLocaleString()}`
        : 'Congratulations! Your loan is fully paid off! 🎉',
      type: 'success',
    });
  }
  
  private payOffLoan(): void {
    const stats = this.playerStats.current;
    const amount = stats.loanBalance;
    
    this.playerStats.applyEffect({ money: -amount });
    this.playerStats.modify({ loanBalance: 0, monthlyPayment: 0 });
    
    this.messageBox.show({
      title: 'Loan Paid Off! 🎉',
      icon: '✅',
      text: `You've paid off your entire loan of $${amount.toLocaleString()}!

No more monthly payments. Financial freedom!`,
      type: 'success',
    });
  }

  private showHomeMenu(): void {
    const stats = this.playerStats.current;
    const profile = {
      age: stats.age,
      amh: stats.bloodworkDone ? stats.amh : undefined,
      diagnoses: stats.diagnoses,
    };
    
    // Get fertility window status
    const fertileStatus = this.playerStats.getFertileWindowStatus();
    
    const choices: Array<{ text: string; callback: () => void }> = [];
    
    // "Try for baby" option - only show after diagnosis is revealed
    if (stats.diagnosisRevealed) {
      const baseChance = FertilityCalculator.timedIntercourseProbability(profile);
      const windowBonus = fertileStatus.inWindow ? 1.5 : 0.3;
      const chance = Math.round(baseChance * windowBonus * 100);
      
      choices.push({
        text: fertileStatus.inWindow ? 'Try for Baby' : 'Try Tonight',
        callback: () => this.tryForBaby(chance, fertileStatus.inWindow),
      });
    }
    
    choices.push({
      text: 'Work +$500',
      callback: () => {
        this.playerStats.applyEffect({ physical: -10, mental: -5, money: 500, days: 3 });
        gameHistory.logEvent('work', 'Worked for 3 days', {
          gameDay: stats.cycleDay, cycleDay: stats.cycleDay, monthsElapsed: stats.monthsElapsed,
          physical: stats.physical - 10, mental: stats.mental - 5, relationship: stats.relationship,
          hope: stats.hope, money: stats.money + 500,
        }, { earned: 500 }, 'home');
        this.messageBox.show({
          title: 'Worked',
          text: '+$500  |  -10 energy  -5 mental',
          type: 'success',
        }, () => this.updateBuildingHints());
      },
    });
    
    choices.push({
      text: 'Rest',
      callback: () => {
        this.playerStats.applyEffect({ physical: 15, mental: 10, days: 1 });
        this.messageBox.show({
          title: 'Rested',
          text: '+15 energy  +10 mental',
          type: 'success',
        }, () => this.updateBuildingHints());
      },
    });
    
    choices.push({
      text: 'Date Night $60',
      callback: () => {
        this.playerStats.applyEffect({ relationship: 15, mental: 10, hope: 5, money: -60, days: 1 });
        this.messageBox.show({
          title: 'Date Night',
          text: '+15 relationship  +10 mental  +5 hope',
          type: 'success',
        });
      },
    });
    
    // Build description
    let descText = stats.diagnosisRevealed 
      ? `Day ${stats.cycleDay} — ${fertileStatus.message}`
      : 'What would you like to do?';
    
    this.messageBox.show({
      title: 'Home',
      text: descText,
      type: 'decision',
      choices,
    });
  }

  /**
   * Try for baby - tasteful handling of timed intercourse
   */
  private tryForBaby(successChance: number, inFertileWindow: boolean): void {
    const stats = this.playerStats.current;
    
    const description = inFertileWindow 
      ? `Fertile window! Best time to try. ~${successChance}% chance.`
      : `Day ${stats.cycleDay}. ~${successChance}% chance.`;
    
    this.messageBox.show({
      title: inFertileWindow ? 'Fertile Window' : 'Tonight',
      text: description,
      type: 'decision',
      choices: [
        {
          text: 'Try Tonight',
          callback: () => {
            const bonusHope = inFertileWindow ? 10 : 3;
            this.playerStats.applyEffect({ relationship: 10, hope: bonusHope, physical: -5, days: 1 });
            this.playerStats.modify({ cyclesAttempted: stats.cyclesAttempted + 1 });
            
            gameHistory.logEvent('cycle_attempt', 'Tried for baby at home', {
              gameDay: stats.cycleDay, cycleDay: stats.cycleDay, monthsElapsed: stats.monthsElapsed,
              physical: stats.physical, mental: stats.mental, relationship: stats.relationship,
              hope: stats.hope, money: stats.money,
            }, { 
              type: 'timed', 
              cycleNumber: stats.cyclesAttempted + 1, 
              successChance,
              inFertileWindow,
              cycleDay: stats.cycleDay,
            }, 'home');
            
            gameHistory.startTreatmentCycle('timed', stats.monthsElapsed);
            
            this.messageBox.show({
              title: 'Two Week Wait',
              text: 'Now begins the wait...',
              type: 'info',
            }, () => this.startTwoWeekWait(successChance));
          },
        },
        {
          text: 'Wait for Better Time',
          callback: () => {
            const fertileStatus = this.playerStats.getFertileWindowStatus();
            if (fertileStatus.daysUntil > 0 && fertileStatus.daysUntil <= 10) {
              this.playerStats.applyEffect({ physical: 5, days: fertileStatus.daysUntil });
              this.messageBox.show({
                title: 'Waiting',
                text: `Skipped ${fertileStatus.daysUntil} days.`,
                type: 'info',
              }, () => this.showHomeMenu());
            } else {
              this.playerStats.applyEffect({ physical: 10, days: 1 });
            }
          },
        },
      ],
    });
  }

  /**
   * Two week wait and result
   */
  private startTwoWeekWait(successChance: number): void {
    // Skip 14 days
    this.playerStats.applyEffect({ mental: -10, hope: -5, days: 14 });
    
    // Calculate outcome
    const success = Math.random() * 100 < successChance;
    const stats = this.playerStats.current;
    
    this.time.delayedCall(500, () => {
      if (success) {
        gameHistory.completeTreatmentCycle('positive', stats.monthsElapsed);
        this.messageBox.show({
          title: 'Positive! 🎉',
          icon: '🤰',
          text: `The test shows two lines. After all this time...
          
You're pregnant!`,
          type: 'success',
        }, () => {
          this.playerStats.modify({ treatmentStage: 'pregnant' });
          this.playerStats.applyEffect({ hope: 50, mental: 30, relationship: 20 });
          this.progressTracker.advanceTo('pregnant');
        });
      } else {
        gameHistory.completeTreatmentCycle('negative', stats.monthsElapsed);
        this.messageBox.show({
          title: 'Not This Time',
          icon: '💔',
          text: `One line. Not this month.
          
It's okay to feel disappointed. Take care of each other.`,
          type: 'warning',
        }, () => {
          this.playerStats.applyEffect({ hope: -15, mental: -10 });
          this.updateBuildingHints();
        });
      }
    });
  }

  private showClinicMenu(): void {
    const _stats = this.playerStats.current;
    
    this.messageBox.show({
      title: 'Fertility Clinic',
      icon: '🏥',
      text: `Dr. Chen's office. What brings you in today?`,
      type: 'decision',
      choices: [
        {
          text: '🔬 Testing',
          callback: () => this.showTestingOptions(),
        },
        {
          text: '👩‍⚕️ Consult ($100)',
          callback: () => {
            this.playerStats.applyEffect({ money: -100, days: 1 });
            this.showConsultation();
          },
        },
        { text: '🚪 Leave', callback: () => {} },
      ],
    });
  }

  private showConsultation(): void {
    const stats = this.playerStats.current;
    const profile = {
      age: stats.age,
      amh: stats.bloodworkDone ? stats.amh : undefined,
      diagnoses: stats.diagnoses,
    };
    
    // Need tests first
    if (!stats.bloodworkDone || !stats.spermAnalysisDone || !stats.diagnosisRevealed) {
      let advice = '';
      if (!stats.bloodworkDone) {
        advice = '"Let\'s get some baseline blood work first."';
      } else if (!stats.spermAnalysisDone) {
        advice = '"We should do a semen analysis to complete the picture."';
      } else {
        advice = '"Ready to discuss your results and diagnosis."';
      }
      this.messageBox.show({
        title: 'Dr. Chen',
        icon: '👩‍⚕️',
        text: advice,
        type: 'info',
      });
      return;
    }
    
    // Show treatment options based on progression
    const timedChance = Math.round(FertilityCalculator.timedIntercourseProbability(profile) * 100);
    const iuiChance = Math.round(FertilityCalculator.iuiProbability(profile) * 100);
    const ivf = FertilityCalculator.ivfPrediction(profile);
    
    const choices: Array<{ text: string; callback: () => void }> = [];
    
    // Always show timed option (can do at home)
    choices.push({
      text: `📅 Timed (~${timedChance}%)`,
      callback: () => {
        this.messageBox.show({
          title: 'Timed Intercourse',
          icon: '📅',
          text: `Track ovulation and try at home during your fertile window.\n\n~${timedChance}% chance per cycle. Go Home to try.`,
          type: 'info',
        });
      },
    });
    
    // IUI available after 2+ timed cycles or immediately if issues
    const canDoIUI = stats.cyclesAttempted >= 2 || stats.diagnoses.includes('male_factor');
    if (canDoIUI) {
      choices.push({
        text: `💉 Start IUI ($1,500)`,
        callback: () => this.startIUI(iuiChance),
      });
    }
    
    // IVF available after 2+ IUI attempts or 5+ timed cycles, or severe issues
    const canDoIVF = stats.iuiAttempts >= 2 || stats.cyclesAttempted >= 5 || 
                     stats.diagnoses.includes('low_ovarian_reserve') ||
                     stats.diagnoses.includes('tubal_factor');
    if (canDoIVF) {
      choices.push({
        text: `🧫 Start IVF ($12,000)`,
        callback: () => this.startIVF(ivf),
      });
    }
    
    choices.push({ text: '🚪 Leave', callback: () => {} });
    
    // Build recommendation text
    let recommendation = '';
    if (stats.cyclesAttempted < 2) {
      recommendation = `"Try at home first—${timedChance}% per cycle."`;
    } else if (!canDoIVF) {
      recommendation = `"IUI is our next step—${iuiChance}% success rate."`;
    } else {
      recommendation = `"IVF gives the best odds—${ivf.livebirthChance}% with ~${ivf.retrievedEggs} eggs."`;
    }
    
    this.messageBox.show({
      title: 'Treatment Options',
      icon: '👩‍⚕️',
      text: `Dr. Chen: ${recommendation}\n\nCycles tried: ${stats.cyclesAttempted} | IUI: ${stats.iuiAttempts} | IVF: ${stats.ivfAttempts}`,
      type: 'decision',
      choices,
    });
  }

  private startIUI(successChance: number): void {
    const stats = this.playerStats.current;
    
    if (stats.money < 1500) {
      this.messageBox.show({
        title: 'Insufficient Funds',
        icon: '💳',
        text: `IUI costs $1,500. You have $${stats.money}.\n\nVisit Financing for loan options.`,
        type: 'warning',
      });
      return;
    }
    
    this.messageBox.show({
      title: 'Start IUI Cycle?',
      icon: '💉',
      text: `IUI (Intrauterine Insemination) places washed sperm directly in the uterus.\n\nCost: $1,500\nSuccess rate: ~${successChance}%\nTime: ~2 weeks`,
      type: 'decision',
      choices: [
        {
          text: '✅ Begin IUI',
          callback: () => {
            this.playerStats.applyEffect({ money: -1500, physical: -15, mental: -10, days: 14 });
            this.playerStats.modify({ 
              iuiAttempts: stats.iuiAttempts + 1,
              treatmentStage: 'iui',
            });
            
            gameHistory.logEvent('treatment_started', 'Started IUI cycle', {
              gameDay: stats.cycleDay, cycleDay: stats.cycleDay, monthsElapsed: stats.monthsElapsed,
              physical: stats.physical, mental: stats.mental, relationship: stats.relationship,
              hope: stats.hope, money: stats.money,
            }, { type: 'iui', cycleNumber: stats.iuiAttempts + 1, successChance }, 'clinic');
            
            gameHistory.startTreatmentCycle('iui', stats.monthsElapsed);
            
            this.progressTracker.advanceTo('iui');
            
            this.messageBox.show({
              title: 'IUI Complete',
              icon: '💉',
              text: 'The procedure went smoothly. Now we wait...',
              type: 'info',
            }, () => this.startTwoWeekWait(successChance));
          },
        },
        { text: '❌ Not Yet', callback: () => {} },
      ],
    });
  }

  private startIVF(prediction: { retrievedEggs: number; livebirthChance: number }): void {
    const stats = this.playerStats.current;
    
    if (stats.money < 12000) {
      this.messageBox.show({
        title: 'Insufficient Funds',
        icon: '💳',
        text: `IVF costs $12,000. You have $${stats.money}.\n\nVisit Financing for loan options.`,
        type: 'warning',
      });
      return;
    }
    
    this.messageBox.show({
      title: 'Start IVF Cycle?',
      icon: '🧫',
      text: `IVF involves egg retrieval, fertilization in the lab, and embryo transfer.\n\nCost: $12,000\nExpected eggs: ~${prediction.retrievedEggs}\nSuccess rate: ~${prediction.livebirthChance}%\nTime: ~4 weeks`,
      type: 'decision',
      choices: [
        {
          text: '✅ Begin IVF',
          callback: () => this.runIVFCycle(prediction),
        },
        { text: '❌ Not Yet', callback: () => {} },
      ],
    });
  }

  private runIVFCycle(prediction: { retrievedEggs: number; livebirthChance: number }): void {
    const stats = this.playerStats.current;
    
    // Phase 1: Stimulation
    this.playerStats.applyEffect({ money: -12000, physical: -20, mental: -15, days: 10 });
    this.playerStats.modify({ 
      ivfAttempts: stats.ivfAttempts + 1,
      treatmentStage: 'ivf_stims',
    });
    
    this.progressTracker.advanceTo('ivf');
    
    gameHistory.logEvent('treatment_started', 'Started IVF cycle', {
      gameDay: stats.cycleDay, cycleDay: stats.cycleDay, monthsElapsed: stats.monthsElapsed,
      physical: stats.physical, mental: stats.mental, relationship: stats.relationship,
      hope: stats.hope, money: stats.money,
    }, { type: 'ivf', cycleNumber: stats.ivfAttempts + 1, prediction }, 'clinic');
    
    gameHistory.startTreatmentCycle('ivf', stats.monthsElapsed);
    
    this.messageBox.show({
      title: 'Stimulation Phase',
      icon: '💉',
      text: '10 days of hormone injections to stimulate egg production.\n\nThis is physically and emotionally demanding.',
      type: 'info',
    }, () => {
      // Phase 2: Retrieval
      const eggsRetrieved = Math.max(1, Math.round(prediction.retrievedEggs * (0.7 + Math.random() * 0.6)));
      
      this.playerStats.applyEffect({ physical: -15, days: 2 });
      this.playerStats.modify({ treatmentStage: 'ivf_retrieval' });
      
      this.messageBox.show({
        title: 'Egg Retrieval',
        icon: '🥚',
        text: `Retrieved ${eggsRetrieved} eggs!\n\nNow they go to the embryology lab for fertilization.`,
        type: eggsRetrieved >= 5 ? 'success' : 'info',
      }, () => {
        // Phase 3: Fertilization & Development
        const fertilized = Math.max(1, Math.round(eggsRetrieved * (0.6 + Math.random() * 0.3)));
        const embryos = Math.max(1, Math.round(fertilized * (0.4 + Math.random() * 0.4)));
        
        this.playerStats.applyEffect({ days: 5, hope: embryos >= 2 ? 10 : -5 });
        
        this.messageBox.show({
          title: 'Embryo Development',
          icon: '🧫',
          text: `${fertilized} eggs fertilized → ${embryos} embryo(s) developing well.\n\nReady for transfer!`,
          type: embryos >= 2 ? 'success' : 'info',
        }, () => {
          // Phase 4: Transfer
          this.playerStats.applyEffect({ physical: -5, days: 1 });
          this.playerStats.modify({ treatmentStage: 'ivf_transfer' });
          this.progressTracker.advanceTo('transfer');
          
          // Calculate actual success chance based on embryo quality
          const adjustedChance = Math.min(65, prediction.livebirthChance * (embryos >= 2 ? 1.2 : 0.8));
          
          this.messageBox.show({
            title: 'Embryo Transfer',
            icon: '🎯',
            text: `1 embryo transferred. ${embryos > 1 ? `${embryos - 1} frozen for future use.` : ''}\n\nNow begins the two-week wait...`,
            type: 'success',
          }, () => this.startTwoWeekWait(adjustedChance));
        });
      });
    });
  }

  private showPharmacyMenu(): void {
    this.messageBox.show({
      title: 'Pharmacy',
      icon: '💊',
      text: 'Prenatal vitamins, ovulation tests, and supplies.',
      type: 'decision',
      choices: [
        {
          text: '🧪 Buy Supplies ($80)',
          callback: () => {
            this.playerStats.applyEffect({ money: -80, hope: 5 });
            this.messageBox.show({
              title: 'Stocked Up',
              icon: '✅',
              text: 'Vitamins, OPKs, and pregnancy tests.\n\n+5 ✨',
              type: 'success',
            });
          },
        },
        { text: '🚪 Leave', callback: () => {} },
      ],
    });
  }

  private showLabInfo(): void {
    this.messageBox.show({
      title: 'Embryology Lab',
      icon: '🔬',
      text: 'Through the window, embryologists work carefully.\nThis is where IVF magic happens—when you\'re ready.',
      type: 'info',
    });
  }

  update(_time: number, delta: number): void {
    this.patient?.update(delta);
  }
}
