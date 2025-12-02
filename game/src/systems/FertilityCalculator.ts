/**
 * Fertility Calculator - Science-based predictions
 * Based on clinical data for realistic game outcomes
 */

// AMH percentiles by age (median values)
const AMH_BY_AGE: Record<number, number> = {
  20: 4.27, 22: 3.61, 24: 2.99, 26: 2.52, 28: 2.17,
  30: 1.92, 32: 1.76, 34: 1.63, 36: 1.43, 38: 1.12,
  40: 0.74, 42: 0.44, 44: 0.24,
};

// Attrition rates by stage and age
const ATTRITION_RATES: Record<string, Record<number, number>> = {
  frozen: { 30: 0.775, 35: 0.675, 40: 0.475, 45: 0.225 },
  thawed: { 30: 0.875, 35: 0.825, 40: 0.725, 45: 0.575 },
  fertilized: { 30: 0.775, 35: 0.675, 40: 0.575, 45: 0.475 },
  good_embryos: { 30: 0.475, 35: 0.375, 40: 0.225, 45: 0.1125 },
  implanted: { 30: 0.575, 35: 0.475, 40: 0.375, 45: 0.2625 },
};

// Condition factors
const CONDITION_FACTORS_EGGS: Record<string, number> = {
  pcos: 1.2,        // More eggs but quality issues
  endometriosis: 0.9,
  low_ovarian_reserve: 0.6,
  male_factor: 1.0, // Doesn't affect egg count
  unexplained: 1.0,
};

const CONDITION_FACTORS_SUCCESS: Record<string, number> = {
  pcos: 0.9,
  endometriosis: 0.8,
  low_ovarian_reserve: 0.7,
  male_factor: 0.85,
  unexplained: 0.9,
};

export interface FertilityProfile {
  age: number;
  amh?: number;
  afc?: number;
  diagnoses: string[];
}

export interface CycleOutcome {
  eggsExpected: number;
  eggsRange: [number, number];
  fertilizationRate: number;
  embryosExpected: number;
  successRate: number;
  successRatePerEmbryo: number;
}

export interface IVFPrediction {
  retrievedEggs: number;
  frozenEggs: number;
  fertilized: number;
  goodEmbryos: number;
  implantationChance: number;
  livebirthChance: number;
}

/**
 * Scientific fertility calculator
 */
export class FertilityCalculator {
  
  /**
   * Get normal AMH for age
   */
  static normalAMH(age: number): number {
    const clampedAge = Math.max(20, Math.min(44, age));
    const bracket = Math.floor(clampedAge / 2) * 2;
    return AMH_BY_AGE[bracket] ?? 1.5;
  }

  /**
   * Calculate expected eggs from retrieval
   */
  static expectedEggs(profile: FertilityProfile): CycleOutcome {
    const { age, amh, diagnoses } = profile;
    
    // Base eggs by age (sigmoid curve)
    let baseEggs = this.oocytesByAge(age);
    
    // Adjust for AMH if known
    if (amh !== undefined) {
      const normalAmh = this.normalAMH(age);
      const amhRatio = amh / normalAmh;
      baseEggs *= this.gompertz(amhRatio);
    }
    
    // Apply condition factors
    for (const diagnosis of diagnoses) {
      baseEggs *= CONDITION_FACTORS_EGGS[diagnosis] ?? 1.0;
    }
    
    const eggsExpected = Math.max(1, Math.floor(baseEggs));
    const variance = Math.max(2, Math.floor(eggsExpected * 0.3));
    
    // Calculate success rates
    let successRate = this.livebirthRateByAge(age);
    for (const diagnosis of diagnoses) {
      successRate *= CONDITION_FACTORS_SUCCESS[diagnosis] ?? 1.0;
    }
    
    const fertilizationRate = this.getAttritionRate(age, 'fertilized');
    const embryosExpected = Math.max(1, Math.floor(eggsExpected * fertilizationRate * 0.5));
    
    return {
      eggsExpected,
      eggsRange: [Math.max(1, eggsExpected - variance), eggsExpected + variance],
      fertilizationRate: Math.round(fertilizationRate * 100),
      embryosExpected,
      successRate: Math.round(successRate * 100),
      successRatePerEmbryo: Math.round(this.getAttritionRate(age, 'implanted') * 100),
    };
  }

  /**
   * Full IVF cycle prediction
   */
  static ivfPrediction(profile: FertilityProfile): IVFPrediction {
    const { age, diagnoses } = profile;
    const outcome = this.expectedEggs(profile);
    
    const retrieved = outcome.eggsExpected;
    const frozen = Math.floor(retrieved * this.getAttritionRate(age, 'frozen'));
    const fertilized = Math.floor(frozen * this.getAttritionRate(age, 'fertilized'));
    const goodEmbryos = Math.max(1, Math.floor(fertilized * this.getAttritionRate(age, 'good_embryos')));
    
    let implantationChance = this.getAttritionRate(age, 'implanted');
    let livebirthChance = implantationChance * 0.8;
    
    // Apply condition factors
    for (const diagnosis of diagnoses) {
      const factor = CONDITION_FACTORS_SUCCESS[diagnosis] ?? 1.0;
      implantationChance *= factor;
      livebirthChance *= factor;
    }
    
    return {
      retrievedEggs: retrieved,
      frozenEggs: frozen,
      fertilized,
      goodEmbryos,
      implantationChance: Math.round(implantationChance * 100),
      livebirthChance: Math.round(livebirthChance * 100),
    };
  }

  /**
   * Timed intercourse success rate
   */
  static timedIntercourseProbability(profile: FertilityProfile): number {
    const { age, diagnoses } = profile;
    
    // Base rate by age (natural conception per cycle)
    let rate = 0.25; // 25% at peak
    if (age > 30) rate -= (age - 30) * 0.015;
    if (age > 35) rate -= (age - 35) * 0.02;
    if (age > 40) rate -= (age - 40) * 0.03;
    
    // Apply condition factors
    for (const diagnosis of diagnoses) {
      rate *= CONDITION_FACTORS_SUCCESS[diagnosis] ?? 1.0;
    }
    
    return Math.max(0.02, Math.min(0.25, rate));
  }

  /**
   * IUI success rate
   */
  static iuiProbability(profile: FertilityProfile): number {
    const timedRate = this.timedIntercourseProbability(profile);
    return Math.min(0.25, timedRate * 1.5); // IUI is ~50% better than timed
  }

  // Helper functions based on calculator.py
  
  private static oocytesByAge(age: number): number {
    // Sigmoid curve for egg count
    const a = -1.4, b = 22, c = 37, d = -0.13;
    return a + (b - a) / (1 + Math.exp(-(age - c) * d));
  }

  private static livebirthRateByAge(age: number): number {
    const a = 13, b = 1.5, c = 33, d = 0.5;
    return (a + (b - a) / (1 + Math.exp(-(age - c) * d))) / 100;
  }

  private static gompertz(x: number): number {
    const A = 0.9, K = 4.52, T = 0.8, S = 0.4;
    return A * Math.exp(-Math.exp(-K * (x - T))) + S;
  }

  private static getAttritionRate(age: number, stage: string): number {
    const rates = ATTRITION_RATES[stage];
    if (!rates) return 0.5;
    
    const ages = Object.keys(rates).map(Number).sort((a, b) => a - b);
    
    if (age <= ages[0]) return rates[ages[0]];
    if (age >= ages[ages.length - 1]) return rates[ages[ages.length - 1]];
    
    // Interpolate
    for (let i = 0; i < ages.length - 1; i++) {
      if (age < ages[i + 1]) {
        const ratio = (age - ages[i]) / (ages[i + 1] - ages[i]);
        return rates[ages[i]] + ratio * (rates[ages[i + 1]] - rates[ages[i]]);
      }
    }
    
    return 0.5;
  }
}

