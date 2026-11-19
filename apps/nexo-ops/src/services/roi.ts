import type { AutonomyLevel, GovernanceControls, RoiInputs, RoiResult } from '../types/domain';

/**
 * ROI operativo NETO de supervisión.
 * La mayoría de calculadoras ignoran que lo automatizado también se revisa.
 * Aquí la gobernanza tiene coste explícito: si HITL está activo, una parte de
 * los casos automatizados pasa por un humano durante una fracción del tiempo.
 */

export const HITL_ASSUMPTIONS: Record<AutonomyLevel, { reviewedShare: number; reviewTimeShare: number; label: string }> = {
  asistido: { reviewedShare: 1, reviewTimeShare: 0.2, label: 'el humano valida el 100 % de las propuestas (20 % del tiempo manual)' },
  semiautonomo: { reviewedShare: 0.25, reviewTimeShare: 0.3, label: 'el 25 % de los casos supera el umbral y se revisa (30 % del tiempo manual)' },
  autonomo: { reviewedShare: 0.08, reviewTimeShare: 0.35, label: 'solo excepciones: 8 % de los casos (35 % del tiempo manual)' },
};

export const HITL_LABEL_EN: Record<AutonomyLevel, string> = {
  asistido: 'a human validates 100% of proposals (20% of manual time)',
  semiautonomo: '25% of cases exceed the threshold and are reviewed (30% of manual time)',
  autonomo: 'exceptions only: 8% of cases (35% of manual time)',
};

export const DEFAULT_ROI: RoiInputs = {
  monthlyVolume: 12_000,
  manualMinutesPerItem: 9,
  hourlyCostEur: 24,
  automationRatePct: 55,
  setupCostEur: 85_000,
  monthlyRunCostEur: 4_200,
};

// #region guia:roi
export function computeRoi(i: RoiInputs, g: Pick<GovernanceControls, 'autonomyLevel' | 'hitlEnabled'>): RoiResult {
  const rate = Math.min(90, Math.max(0, i.automationRatePct)) / 100;
  const manualHours = (i.monthlyVolume * i.manualMinutesPerItem) / 60;
  const grossHoursAutomated = manualHours * rate;
  const a = HITL_ASSUMPTIONS[g.autonomyLevel];
  const hitlReviewHours = g.hitlEnabled ? grossHoursAutomated * a.reviewedShare * a.reviewTimeShare : 0;
  const hoursFreed = grossHoursAutomated - hitlReviewHours;
  const monthlySavingsEur = hoursFreed * i.hourlyCostEur;
  const netMonthlyEur = monthlySavingsEur - i.monthlyRunCostEur;
  const annualSavingsEur = monthlySavingsEur * 12;
  const firstYearNetEur = netMonthlyEur * 12 - i.setupCostEur;
  const firstYearCost = i.setupCostEur + i.monthlyRunCostEur * 12;
  const roiPct = firstYearCost > 0 ? (firstYearNetEur / firstYearCost) * 100 : 0;
  const paybackMonths = netMonthlyEur > 0 ? i.setupCostEur / netMonthlyEur : null;
// #endregion guia:roi
  return {
    grossHoursAutomated,
    hitlReviewHours,
    hoursFreed,
    monthlySavingsEur,
    netMonthlyEur,
    annualSavingsEur,
    firstYearNetEur,
    roiPct,
    paybackMonths,
  };
}

/** Punto de equilibrio: tasa de automatización mínima para cubrir el coste recurrente. */
export function breakEvenAutomationPct(i: RoiInputs, g: Pick<GovernanceControls, 'autonomyLevel' | 'hitlEnabled'>): number | null {
  const a = HITL_ASSUMPTIONS[g.autonomyLevel];
  const effective = g.hitlEnabled ? 1 - a.reviewedShare * a.reviewTimeShare : 1;
  const valuePerPct = ((i.monthlyVolume * i.manualMinutesPerItem) / 60) * 0.01 * effective * i.hourlyCostEur;
  if (valuePerPct <= 0) return null;
  const pct = i.monthlyRunCostEur / valuePerPct;
  return pct > 90 ? null : pct;
}
