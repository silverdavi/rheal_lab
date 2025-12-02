/**
 * Game History & State Tracker
 * Tracks all player actions, medical events, and outcomes
 */

export type EventType = 
  | 'game_start'
  | 'visit_location'
  | 'test_done'
  | 'diagnosis_revealed'
  | 'treatment_started'
  | 'cycle_attempt'
  | 'cycle_result'
  | 'medication_taken'
  | 'rest'
  | 'work'
  | 'financing'
  | 'loan_taken'
  | 'loan_payment'
  | 'consultation';

export interface GameEvent {
  id: number;
  timestamp: number;
  gameDay: number;
  cycleDay: number;
  monthsElapsed: number;
  type: EventType;
  location?: string;
  description: string;
  details?: Record<string, unknown>;
  statsSnapshot?: {
    physical: number;
    mental: number;
    relationship: number;
    hope: number;
    money: number;
  };
}

export interface TreatmentCycle {
  cycleNumber: number;
  type: 'timed' | 'iui' | 'ivf';
  startMonth: number;
  endMonth?: number;
  eggsRetrieved?: number;
  embryosCreated?: number;
  embryosTransferred?: number;
  outcome: 'ongoing' | 'negative' | 'positive' | 'miscarriage';
  notes: string[];
}

export interface MedicalRecord {
  // Test results
  amh?: number;
  fsh?: number;
  afc?: number;
  spermCount?: number;
  spermMotility?: number;
  
  // Diagnoses
  diagnoses: string[];
  diagnosisDate?: number;
  
  // Treatment history
  treatmentCycles: TreatmentCycle[];
  
  // Medications
  medications: string[];
}

/**
 * Singleton game history tracker
 */
export class GameHistory {
  private static instance: GameHistory;
  
  private events: GameEvent[] = [];
  private nextEventId: number = 1;
  private medicalRecord: MedicalRecord = {
    diagnoses: [],
    treatmentCycles: [],
    medications: [],
  };
  
  private constructor() {}
  
  static getInstance(): GameHistory {
    if (!GameHistory.instance) {
      GameHistory.instance = new GameHistory();
    }
    return GameHistory.instance;
  }
  
  /**
   * Clear all history (for restart)
   */
  clear(): void {
    this.events = [];
    this.nextEventId = 1;
    this.medicalRecord = {
      diagnoses: [],
      treatmentCycles: [],
      medications: [],
    };
    console.log('[GameHistory] Cleared');
  }
  
  /**
   * Log a game event
   */
  logEvent(
    type: EventType,
    description: string,
    gameState: {
      gameDay: number;
      cycleDay: number;
      monthsElapsed: number;
      physical: number;
      mental: number;
      relationship: number;
      hope: number;
      money: number;
    },
    details?: Record<string, unknown>,
    location?: string
  ): GameEvent {
    const event: GameEvent = {
      id: this.nextEventId++,
      timestamp: Date.now(),
      gameDay: gameState.gameDay,
      cycleDay: gameState.cycleDay,
      monthsElapsed: gameState.monthsElapsed,
      type,
      location,
      description,
      details,
      statsSnapshot: {
        physical: gameState.physical,
        mental: gameState.mental,
        relationship: gameState.relationship,
        hope: gameState.hope,
        money: gameState.money,
      },
    };
    
    this.events.push(event);
    console.log(`[GameHistory] ${type}: ${description}`, details);
    return event;
  }
  
  /**
   * Record test results
   */
  recordTestResults(results: Partial<MedicalRecord>): void {
    if (results.amh !== undefined) this.medicalRecord.amh = results.amh;
    if (results.fsh !== undefined) this.medicalRecord.fsh = results.fsh;
    if (results.afc !== undefined) this.medicalRecord.afc = results.afc;
    if (results.spermCount !== undefined) this.medicalRecord.spermCount = results.spermCount;
    if (results.spermMotility !== undefined) this.medicalRecord.spermMotility = results.spermMotility;
  }
  
  /**
   * Record diagnosis
   */
  recordDiagnosis(diagnoses: string[], gameMonth: number): void {
    this.medicalRecord.diagnoses = diagnoses;
    this.medicalRecord.diagnosisDate = gameMonth;
  }
  
  /**
   * Start a treatment cycle
   */
  startTreatmentCycle(type: 'timed' | 'iui' | 'ivf', startMonth: number): TreatmentCycle {
    const cycle: TreatmentCycle = {
      cycleNumber: this.medicalRecord.treatmentCycles.length + 1,
      type,
      startMonth,
      outcome: 'ongoing',
      notes: [],
    };
    this.medicalRecord.treatmentCycles.push(cycle);
    return cycle;
  }
  
  /**
   * Complete a treatment cycle
   */
  completeTreatmentCycle(
    outcome: 'negative' | 'positive' | 'miscarriage',
    endMonth: number,
    details?: Partial<TreatmentCycle>
  ): void {
    const currentCycle = this.medicalRecord.treatmentCycles[
      this.medicalRecord.treatmentCycles.length - 1
    ];
    if (currentCycle) {
      currentCycle.outcome = outcome;
      currentCycle.endMonth = endMonth;
      if (details) {
        Object.assign(currentCycle, details);
      }
    }
  }
  
  /**
   * Get all events
   */
  getEvents(): GameEvent[] {
    return [...this.events];
  }
  
  /**
   * Get events by type
   */
  getEventsByType(type: EventType): GameEvent[] {
    return this.events.filter(e => e.type === type);
  }
  
  /**
   * Get medical record
   */
  getMedicalRecord(): Readonly<MedicalRecord> {
    return { ...this.medicalRecord };
  }
  
  /**
   * Get treatment summary
   */
  getTreatmentSummary(): string {
    const cycles = this.medicalRecord.treatmentCycles;
    if (cycles.length === 0) return 'No treatments yet';
    
    const timedCycles = cycles.filter(c => c.type === 'timed').length;
    const iuiCycles = cycles.filter(c => c.type === 'iui').length;
    const ivfCycles = cycles.filter(c => c.type === 'ivf').length;
    const positives = cycles.filter(c => c.outcome === 'positive').length;
    
    const parts: string[] = [];
    if (timedCycles > 0) parts.push(`${timedCycles} timed cycles`);
    if (iuiCycles > 0) parts.push(`${iuiCycles} IUI`);
    if (ivfCycles > 0) parts.push(`${ivfCycles} IVF`);
    if (positives > 0) parts.push(`${positives} positive`);
    
    return parts.join(', ');
  }
  
  /**
   * Export full history as JSON
   */
  exportHistory(): string {
    return JSON.stringify({
      events: this.events,
      medicalRecord: this.medicalRecord,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }
  
  /**
   * Reset history (new game)
   */
  reset(): void {
    this.events = [];
    this.nextEventId = 1;
    this.medicalRecord = {
      diagnoses: [],
      treatmentCycles: [],
      medications: [],
    };
  }
}

// Export singleton instance
export const gameHistory = GameHistory.getInstance();

