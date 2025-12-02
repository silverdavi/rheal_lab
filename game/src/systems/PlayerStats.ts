/**
 * Medical conditions that affect fertility
 */
export type Diagnosis = 
  | 'endometriosis'
  | 'pcos'
  | 'male_factor'
  | 'unexplained'
  | 'low_ovarian_reserve'
  | 'tubal_factor';

export const DIAGNOSIS_NAMES: Record<Diagnosis, string> = {
  endometriosis: 'Endometriosis',
  pcos: 'PCOS',
  male_factor: 'Male Factor',
  unexplained: 'Unexplained',
  low_ovarian_reserve: 'Low Ovarian Reserve',
  tubal_factor: 'Tubal Factor',
};

/**
 * Player stats that affect gameplay and outcomes
 */
export interface Stats {
  // Demographics
  patientName: string;
  partnerName: string;
  
  // Core stats (0-100)
  physical: number;
  mental: number;
  relationship: number;
  hope: number;
  
  // Resources
  money: number;
  loanBalance: number;    // Outstanding loan amount
  monthlyPayment: number; // Monthly loan payment due
  
  // Time
  cycleDay: number;
  monthsElapsed: number;
  
  // Treatment progress
  treatmentStage: TreatmentStage;
  cyclesAttempted: number;
  iuiAttempts: number;
  ivfAttempts: number;
  
  // Medical data
  age: number;
  amh: number;
  afc: number;
  fsh: number;           // FSH level
  
  // What's been revealed
  bloodworkDone: boolean;
  diagnosisRevealed: boolean;
  diagnoses: Diagnosis[];
  
  // Partner sperm analysis
  spermAnalysisDone: boolean;
  spermCount: number;     // millions/mL (normal > 15)
  spermMotility: number;  // % (normal > 40%)
}

export type TreatmentStage = 
  | 'natural'
  | 'timed'
  | 'ovulation_meds'
  | 'iui'
  | 'ivf_prep'
  | 'ivf_stims'
  | 'ivf_retrieval'
  | 'ivf_transfer'
  | 'tww'
  | 'pregnant'
  | 'ended';

export const TREATMENT_NAMES: Record<TreatmentStage, string> = {
  natural: 'Trying Naturally',
  timed: 'Timed Intercourse',
  ovulation_meds: 'Ovulation Induction',
  iui: 'IUI Treatment',
  ivf_prep: 'IVF Preparation',
  ivf_stims: 'IVF Stimulation',
  ivf_retrieval: 'Egg Retrieval',
  ivf_transfer: 'Embryo Transfer',
  tww: 'Two Week Wait',
  pregnant: 'Pregnant!',
  ended: 'Journey Ended',
};

// Progress stages for the journey tracker
export const JOURNEY_STAGES = [
  { key: 'start', label: 'Start', icon: '🌱' },
  { key: 'testing', label: 'Testing', icon: '🔬' },
  { key: 'timed', label: 'Timed', icon: '📅' },
  { key: 'iui', label: 'IUI', icon: '💉' },
  { key: 'ivf', label: 'IVF', icon: '🧫' },
  { key: 'transfer', label: 'Transfer', icon: '🎯' },
  { key: 'pregnant', label: 'Pregnant', icon: '🤰' },
  { key: 'baby', label: 'Baby!', icon: '👶' },
];

/**
 * Manages player stats with change events
 */
export class PlayerStats {
  private stats: Stats;
  private listeners: Array<(stats: Stats) => void> = [];

  constructor(
    patientName: string = 'Alex',
    partnerName: string = 'Sam',
    initialAge: number = 32
  ) {
    // Random chance for conditions
    const hasPCOS = Math.random() < 0.15;        // 15% chance
    const hasEndo = Math.random() < 0.10;        // 10% chance
    const hasMaleFactor = Math.random() < 0.30;  // 30% of infertility cases
    
    this.stats = {
      patientName,
      partnerName,
      physical: 80,
      mental: 75,
      relationship: 85,
      hope: 90,
      money: 5000,  // Starting savings for fertility journey
      loanBalance: 0,
      monthlyPayment: 0,
      cycleDay: 1,
      monthsElapsed: 0,
      treatmentStage: 'natural',
      cyclesAttempted: 0,
      iuiAttempts: 0,
      ivfAttempts: 0,
      age: initialAge,
      amh: this.calculateAMH(initialAge, hasPCOS),
      afc: this.calculateAFC(initialAge, hasPCOS),
      fsh: this.calculateFSH(initialAge),
      bloodworkDone: false,
      diagnosisRevealed: false,
      diagnoses: this.generateDiagnoses(hasPCOS, hasEndo, hasMaleFactor),
      spermAnalysisDone: false,
      spermCount: hasMaleFactor ? 8 + Math.random() * 10 : 40 + Math.random() * 60,
      spermMotility: hasMaleFactor ? 20 + Math.random() * 20 : 50 + Math.random() * 30,
    };
  }
  
  /**
   * Take out a loan for fertility treatment
   * @param amount Principal amount
   * @param months Repayment term in months
   * @param interestRate Annual interest rate (e.g., 0.08 for 8%)
   */
  takeLoan(amount: number, months: number = 24, interestRate: number = 0.08): { monthlyPayment: number } {
    // Calculate monthly payment (simple interest for game simplicity)
    const totalInterest = amount * interestRate * (months / 12);
    const totalOwed = amount + totalInterest;
    const monthlyPayment = Math.ceil(totalOwed / months);
    
    this.stats.money += amount;
    this.stats.loanBalance += totalOwed;
    this.stats.monthlyPayment += monthlyPayment;
    
    this.notifyListeners();
    return { monthlyPayment };
  }
  
  /**
   * Make a loan payment
   */
  makeLoanPayment(): { paid: number; remaining: number } {
    if (this.stats.loanBalance <= 0) return { paid: 0, remaining: 0 };
    
    const payment = Math.min(this.stats.monthlyPayment, this.stats.loanBalance, this.stats.money);
    this.stats.money -= payment;
    this.stats.loanBalance -= payment;
    
    if (this.stats.loanBalance <= 0) {
      this.stats.loanBalance = 0;
      this.stats.monthlyPayment = 0;
    }
    
    this.notifyListeners();
    return { paid: payment, remaining: this.stats.loanBalance };
  }
  
  /**
   * Check if fertile window (cycle days 10-16)
   */
  isInFertileWindow(): boolean {
    return this.stats.cycleDay >= 10 && this.stats.cycleDay <= 16;
  }
  
  /**
   * Get fertility window status message
   */
  getFertileWindowStatus(): { inWindow: boolean; message: string; daysUntil: number } {
    const day = this.stats.cycleDay;
    
    if (day >= 10 && day <= 16) {
      return { 
        inWindow: true, 
        message: '🌟 Fertile window! Best time to try.',
        daysUntil: 0
      };
    } else if (day < 10) {
      return { 
        inWindow: false, 
        message: `Fertile window starts in ${10 - day} days`,
        daysUntil: 10 - day
      };
    } else {
      // After day 16, wait for next cycle
      const daysUntilNextWindow = (28 - day) + 10;
      return { 
        inWindow: false, 
        message: `Next fertile window in ~${daysUntilNextWindow} days`,
        daysUntil: daysUntilNextWindow
      };
    }
  }

  private generateDiagnoses(hasPCOS: boolean, hasEndo: boolean, hasMaleFactor: boolean): Diagnosis[] {
    const diagnoses: Diagnosis[] = [];
    if (hasPCOS) diagnoses.push('pcos');
    if (hasEndo) diagnoses.push('endometriosis');
    if (hasMaleFactor) diagnoses.push('male_factor');
    // If nothing else, might be unexplained (added later after testing)
    return diagnoses;
  }

  private calculateAMH(age: number, hasPCOS: boolean): number {
    let base: number;
    if (age < 30) base = 2.5 + Math.random() * 1.5;
    else if (age < 35) base = 1.5 + Math.random() * 1.2;
    else if (age < 38) base = 1.0 + Math.random() * 0.8;
    else if (age < 40) base = 0.6 + Math.random() * 0.6;
    else if (age < 42) base = 0.3 + Math.random() * 0.4;
    else base = 0.1 + Math.random() * 0.3;
    
    // PCOS typically has higher AMH
    if (hasPCOS) base *= 1.5;
    
    return Math.round(base * 100) / 100;
  }

  private calculateAFC(age: number, hasPCOS: boolean): number {
    let base: number;
    if (age < 30) base = 14 + Math.floor(Math.random() * 8);
    else if (age < 35) base = 10 + Math.floor(Math.random() * 6);
    else if (age < 38) base = 7 + Math.floor(Math.random() * 5);
    else if (age < 40) base = 5 + Math.floor(Math.random() * 4);
    else base = 3 + Math.floor(Math.random() * 3);
    
    if (hasPCOS) base = Math.min(30, base + 8); // PCOS = more follicles
    return base;
  }

  private calculateFSH(age: number): number {
    // FSH tends to rise with age (normal < 10)
    let base = 5 + Math.random() * 3;
    if (age > 35) base += 2;
    if (age > 38) base += 2;
    if (age > 40) base += 3;
    return Math.round(base * 10) / 10;
  }

  get current(): Readonly<Stats> {
    return { ...this.stats };
  }

  /**
   * Reveal bloodwork results
   */
  revealBloodwork(): void {
    this.stats.bloodworkDone = true;
    this.notifyListeners();
  }

  /**
   * Reveal sperm analysis
   */
  revealSpermAnalysis(): void {
    this.stats.spermAnalysisDone = true;
    this.notifyListeners();
  }

  /**
   * Reveal diagnosis after testing
   */
  revealDiagnosis(): void {
    this.stats.diagnosisRevealed = true;
    // If no conditions found, mark as unexplained
    if (this.stats.diagnoses.length === 0) {
      this.stats.diagnoses.push('unexplained');
    }
    // Check for low ovarian reserve
    if (this.stats.amh < 1.0 && !this.stats.diagnoses.includes('low_ovarian_reserve')) {
      this.stats.diagnoses.push('low_ovarian_reserve');
    }
    this.notifyListeners();
  }

  /**
   * Get current journey stage for progress bar
   */
  getJourneyStage(): string {
    const stage = this.stats.treatmentStage;
    if (stage === 'pregnant') return 'pregnant';
    if (stage === 'ivf_transfer' || stage === 'tww') return 'transfer';
    if (stage === 'ivf_prep' || stage === 'ivf_stims' || stage === 'ivf_retrieval') return 'ivf';
    if (stage === 'iui') return 'iui';
    if (stage === 'timed' || stage === 'ovulation_meds') return 'timed';
    if (this.stats.bloodworkDone) return 'testing';
    return 'start';
  }

  modify(changes: Partial<Stats>): void {
    const clamp = (val: number, min: number, max: number) => 
      Math.max(min, Math.min(max, val));

    if (changes.physical !== undefined) {
      this.stats.physical = clamp(changes.physical, 0, 100);
    }
    if (changes.mental !== undefined) {
      this.stats.mental = clamp(changes.mental, 0, 100);
    }
    if (changes.relationship !== undefined) {
      this.stats.relationship = clamp(changes.relationship, 0, 100);
    }
    if (changes.hope !== undefined) {
      this.stats.hope = clamp(changes.hope, 0, 100);
    }
    if (changes.money !== undefined) {
      this.stats.money = Math.max(0, changes.money);
    }
    if (changes.loanBalance !== undefined) {
      this.stats.loanBalance = Math.max(0, changes.loanBalance);
    }
    if (changes.monthlyPayment !== undefined) {
      this.stats.monthlyPayment = Math.max(0, changes.monthlyPayment);
    }
    if (changes.cycleDay !== undefined) {
      this.stats.cycleDay = ((changes.cycleDay - 1) % 28) + 1;
    }
    if (changes.monthsElapsed !== undefined) {
      this.stats.monthsElapsed = changes.monthsElapsed;
    }
    if (changes.treatmentStage !== undefined) {
      this.stats.treatmentStage = changes.treatmentStage;
    }
    if (changes.cyclesAttempted !== undefined) {
      this.stats.cyclesAttempted = changes.cyclesAttempted;
    }
    if (changes.iuiAttempts !== undefined) {
      this.stats.iuiAttempts = changes.iuiAttempts;
    }
    if (changes.ivfAttempts !== undefined) {
      this.stats.ivfAttempts = changes.ivfAttempts;
    }

    this.notifyListeners();
  }

  applyEffect(effect: {
    physical?: number;
    mental?: number;
    relationship?: number;
    hope?: number;
    money?: number;
    days?: number;
  }): void {
    this.modify({
      physical: this.stats.physical + (effect.physical ?? 0),
      mental: this.stats.mental + (effect.mental ?? 0),
      relationship: this.stats.relationship + (effect.relationship ?? 0),
      hope: this.stats.hope + (effect.hope ?? 0),
      money: this.stats.money + (effect.money ?? 0),
    });
    
    if (effect.days) {
      this.advanceDays(effect.days);
    }
  }

  /**
   * Skip ahead multiple days (with relationship decay)
   */
  skipDays(days: number): { relationshipLost: number; monthsPassed: number } {
    const relationshipDecay = Math.floor(days / 7) * 3; // -3 per week without quality time
    const physicalGain = Math.min(20, days * 2); // Rest helps
    const mentalDrain = Math.floor(days / 3); // Waiting is hard
    
    const monthsBefore = this.stats.monthsElapsed;
    
    this.applyEffect({
      physical: physicalGain,
      mental: -mentalDrain,
      relationship: -relationshipDecay,
      days: days,
    });
    
    return {
      relationshipLost: relationshipDecay,
      monthsPassed: this.stats.monthsElapsed - monthsBefore,
    };
  }

  advanceDays(days: number): { loanPaymentsMade: number } {
    let newDay = this.stats.cycleDay + days;
    let monthsToAdd = 0;
    
    while (newDay > 28) {
      newDay -= 28;
      monthsToAdd++;
    }
    
    this.stats.cycleDay = newDay;
    this.stats.monthsElapsed += monthsToAdd;
    
    // Process loan payments for each month passed
    let totalLoanPayments = 0;
    if (monthsToAdd > 0 && this.stats.loanBalance > 0) {
      for (let i = 0; i < monthsToAdd; i++) {
        const payment = Math.min(this.stats.monthlyPayment, this.stats.loanBalance);
        if (payment > 0 && this.stats.money >= payment) {
          this.stats.money -= payment;
          this.stats.loanBalance -= payment;
          totalLoanPayments += payment;
        }
        if (this.stats.loanBalance <= 0) {
          this.stats.loanBalance = 0;
          this.stats.monthlyPayment = 0;
          break;
        }
      }
    }
    
    // Age increases every 12 months
    if (Math.floor((this.stats.monthsElapsed) / 12) > 
        Math.floor((this.stats.monthsElapsed - monthsToAdd) / 12)) {
      this.stats.age++;
      this.stats.amh = Math.max(0.1, this.stats.amh * 0.92);
      this.stats.afc = Math.max(2, this.stats.afc - 1);
    }
    
    this.notifyListeners();
    return { loanPaymentsMade: totalLoanPayments };
  }

  onChange(listener: (stats: Stats) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const snapshot = this.current;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  canAfford(cost: number): boolean {
    return this.stats.money >= cost;
  }

  canContinue(): boolean {
    return (
      this.stats.mental > 10 &&
      this.stats.physical > 10 &&
      this.stats.relationship > 20 &&
      this.stats.hope > 5
    );
  }
}
