# Fertility Journey Game - Architecture Documentation

## Overview

An educational isometric game about the IVF/fertility journey, built with **Phaser 3** and **TypeScript**. Features an AI-powered chat assistant (GPT-5-nano), scientific fertility calculations, and guided gameplay.

## Tech Stack

- **Game Engine**: Phaser 3.80+
- **Language**: TypeScript 5.3+
- **Build Tool**: Vite 5.0+
- **AI Chat**: OpenAI GPT-5-nano API
- **Deployment**: AWS Amplify (git-connected)

## Project Structure

```
game/
├── src/
│   ├── main.ts                 # Entry point, Phaser game config
│   ├── assets/
│   │   └── rhea_logo.svg       # Rhea Fertility logo
│   │
│   ├── config/
│   │   └── game.config.ts      # Game constants (tile sizes, colors, dimensions)
│   │
│   ├── core/
│   │   ├── index.ts
│   │   ├── IsoUtils.ts         # Isometric coordinate conversion
│   │   └── Pathfinder.ts       # A* pathfinding for character movement
│   │
│   ├── entities/
│   │   ├── index.ts
│   │   ├── Entity.ts           # Base class for all game objects
│   │   ├── Building.ts         # Isometric buildings with hints system
│   │   └── Character.ts        # Player character with pathfinding
│   │
│   ├── scenes/
│   │   └── GameScene.ts        # Main game scene (1000+ lines)
│   │                            # - Building layout
│   │                            # - Road network
│   │                            # - All game menus and dialogs
│   │                            # - Treatment flow logic
│   │
│   ├── systems/
│   │   ├── index.ts
│   │   ├── PlayerStats.ts      # Player state (health, money, medical data)
│   │   ├── FertilityCalculator.ts  # Science-based IVF predictions
│   │   └── GameHistory.ts      # Event logging and medical records
│   │
│   ├── ui/
│   │   ├── index.ts
│   │   ├── ChatPanel.ts        # AI assistant (GPT-5-nano)
│   │   ├── MessageBox.ts       # Dialog/decision popups
│   │   ├── StatsPanel.ts       # Left sidebar with player stats
│   │   └── ProgressTracker.ts  # Top progress bar
│   │
│   └── data/
│       └── rheaFertilityInfo.ts  # Clinic info for AI context
│
├── amplify.yml                 # AWS Amplify deployment config
├── buildspec.yml               # AWS CodeBuild config
├── DEPLOY.md                   # Deployment guide
├── package.json
├── tsconfig.json
└── vite.config.ts              # Loads .env from parent directory
```

## Key Systems

### 1. Isometric Grid System (`IsoUtils.ts`)

Converts between grid coordinates and screen positions:

```typescript
// Grid to screen
screenX = (gridX - gridY) * (TILE_WIDTH / 2) + X_OFFSET
screenY = (gridX + gridY) * (TILE_HEIGHT / 2) + Y_OFFSET

// In isometric view:
// - Low gridY = BACK (top of screen)
// - High gridY = FRONT (bottom of screen)
// - Low gridX = WEST (left)
// - High gridX = EAST (right)
```

### 2. Building System (`Building.ts`)

- Buildings positioned at center of their footprint
- Hint system: `'next_step'` (blinking star), `'active'` (glow), `'none'`
- Types: `home`, `clinic`, `pharmacy`, `lab`, `hospital`

### 3. Player Stats (`PlayerStats.ts`)

```typescript
interface Stats {
  // Core stats (0-100)
  physical, mental, relationship, hope: number;
  
  // Resources
  money: number;
  
  // Medical data
  age, amh, fsh, afc: number;
  spermCount, spermMotility: number;
  diagnoses: Diagnosis[];
  
  // Progress
  treatmentStage: TreatmentStage;
  cyclesAttempted, iuiAttempts, ivfAttempts: number;
}
```

### 4. Fertility Calculator (`FertilityCalculator.ts`)

Science-based predictions using clinical data:

- **AMH percentiles by age** (from research data)
- **Attrition rates** for each IVF stage
- **Condition factors**: PCOS (+20% eggs), endometriosis (-20% success)
- **Methods**:
  - `expectedEggs(profile)` - predicted egg retrieval
  - `ivfPrediction(profile)` - full IVF outcome prediction
  - `timedIntercourseProbability(profile)` - natural conception rate
  - `iuiProbability(profile)` - IUI success rate

### 5. AI Chat (`ChatPanel.ts`)

- Model: `gpt-5-nano` (fast, cheap)
- Max tokens: 3000 (allows internal reasoning)
- System prompt includes:
  - Game character "Dr. Hope"
  - Current game state (stats, diagnoses)
  - Rhea Fertility clinic info
  - Instruction for 1-2 sentence responses

### 6. Mobile Viewport (`game.config.ts` + `index.html`)

Responsive scaling with min/max constraints:

```typescript
// Viewport bounds
MIN_WIDTH: 320, MIN_HEIGHT: 480   // Small phones
MAX_WIDTH: 1920, MAX_HEIGHT: 1080 // Large monitors

// Phaser scale config
scale: {
  mode: Phaser.Scale.FIT,      // Scales to fit container
  autoCenter: CENTER_BOTH,      // Centers in viewport
  min: { width, height },       // Won't shrink below this
  max: { width, height },       // Won't grow beyond this
}
```

HTML features:
- `viewport-fit=cover` for notched devices (iPhone X+)
- `touch-action: none` prevents pull-to-refresh
- Safe area insets for iOS notch/home indicator
- `100dvh` dynamic viewport height for mobile browsers

### 7. Game History (`GameHistory.ts`)

Tracks all events for analytics:

```typescript
interface GameEvent {
  type: EventType;  // 'test_done', 'cycle_attempt', etc.
  description: string;
  gameDay, cycleDay, monthsElapsed: number;
  statsSnapshot: {...};
  details?: Record<string, unknown>;
}

interface MedicalRecord {
  amh?, fsh?, afc?: number;
  diagnoses: string[];
  treatmentCycles: TreatmentCycle[];
}
```

## Game Flow

```
1. INTRO
   └── First Choice: Book Clinic / Wait

2. FIRST CONSULTATION
   └── Testing Options

3. TESTING PHASE
   ├── Blood Work ($200) → AMH, FSH, AFC
   └── Sperm Analysis ($150) → Count, Motility

4. DIAGNOSIS
   └── Reveals conditions (PCOS, endometriosis, etc.)

5. TREATMENT PLAN
   └── Shows personalized success rates

6. TREATMENT CYCLES
   ├── Try at Home ("Go to Bed Together")
   │   └── Two Week Wait → Result
   ├── IUI (at clinic)
   └── IVF (at clinic + lab)

7. OUTCOME
   ├── Positive → Pregnant!
   └── Negative → Continue journey
```

## Town Layout (Isometric)

```
              BACK (gridY=2)
                [CLINIC]
                  /    \
                /        \
    [HOME]    /    ╳      \    [LAB]
    gridX=3  /   center    \   gridX=11
    gridY=7 /    (7,7)      \  gridY=7
            \               /
             \ [FINANCE]   /
              \  (7,10)   /
               \    |    /
                [PHARMACY]
                 (7,12)
              FRONT (gridY=12)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | In root `.env`, auto-loaded by Vite |
| `VITE_OPENAI_API_KEY` | Alt | Direct Vite env var |

## Key Files to Edit

| Task | File(s) |
|------|---------|
| Add new building | `GameScene.ts` → `createBuildings()` |
| Modify game flow | `GameScene.ts` → `show*Menu()` methods |
| Change predictions | `FertilityCalculator.ts` |
| Update AI behavior | `ChatPanel.ts` → system prompt |
| Add new stat | `PlayerStats.ts` → `Stats` interface |
| Modify UI layout | `StatsPanel.ts`, `ChatPanel.ts`, `MessageBox.ts` |

## Common Patterns

### Adding a Menu Option

```typescript
this.messageBox.show({
  title: 'Menu Title',
  icon: '🏠',
  text: 'Description text',
  type: 'decision',  // or 'info', 'success', 'warning'
  choices: [
    { text: '✅ Option 1', callback: () => this.doSomething() },
    { text: '🚪 Leave', callback: () => {} },
  ],
});
```

### Applying Effects

```typescript
this.playerStats.applyEffect({
  physical: -10,      // Decrease
  mental: 5,          // Increase
  money: -200,        // Spend
  hope: 10,
  days: 7,            // Advance time
});
```

### Logging Events

```typescript
gameHistory.logEvent('treatment_started', 'Started IUI cycle', {
  gameDay, cycleDay, monthsElapsed,
  physical, mental, relationship, hope, money,
}, { treatmentType: 'iui', cycleNumber: 1 }, 'clinic');
```

## Deployment

### AWS Amplify (Recommended)

1. Connect repo to Amplify Console
2. Set environment variable: `OPENAI_API_KEY`
3. Amplify uses `amplify.yml` automatically

### Manual Build

```bash
cd game
npm ci
npm run build
# Output in dist/
```

## Future Improvements

- [ ] Add more treatment options (egg freezing, donor)
- [ ] Implement IUI and IVF detailed flows
- [ ] Add sound effects and music
- [x] Mobile responsive layout (min/max viewport constraints added)
- [ ] Save/load game state
- [ ] Analytics dashboard from GameHistory
- [ ] Multiplayer support stories

