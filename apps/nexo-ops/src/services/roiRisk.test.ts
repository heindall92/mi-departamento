import { describe, expect, it } from 'vitest';
import type { GovernanceControls } from '../types/domain';
import { breakEvenAutomationPct, computeRoi, DEFAULT_ROI } from './roi';
import { assessRisk, tierFromScore } from './riskIndex';

describe('computeRoi', () => {
  const noHitl = { autonomyLevel: 'semiautonomo' as const, hitlEnabled: false };
  it('fórmulas básicas', () => {
    const r = computeRoi({ monthlyVolume: 1000, manualMinutesPerItem: 6, hourlyCostEur: 20, automationRatePct: 50, setupCostEur: 12000, monthlyRunCostEur: 500 }, noHitl);
    expect(r.grossHoursAutomated).toBe(50);
    expect(r.monthlySavingsEur).toBe(1000);
    expect(r.netMonthlyEur).toBe(500);
    expect(r.firstYearNetEur).toBe(-6000);
    expect(r.paybackMonths).toBe(24);
    expect(r.roiPct).toBeCloseTo((-6000 / 18000) * 100);
  });
  it('HITL tiene coste explícito', () => {
    const on = computeRoi(DEFAULT_ROI, { autonomyLevel: 'semiautonomo', hitlEnabled: true });
    const off = computeRoi(DEFAULT_ROI, { autonomyLevel: 'semiautonomo', hitlEnabled: false });
    expect(on.hitlReviewHours).toBeGreaterThan(0);
    expect(on.monthlySavingsEur).toBeLessThan(off.monthlySavingsEur);
  });
  it('sin ahorro neto → payback null', () => {
    expect(computeRoi({ ...DEFAULT_ROI, monthlyRunCostEur: 1e9 }, noHitl).paybackMonths).toBeNull();
  });
  it('limita la automatización al 90 %', () => {
    expect(computeRoi({ ...DEFAULT_ROI, automationRatePct: 150 }, noHitl).grossHoursAutomated)
      .toBeCloseTo(computeRoi({ ...DEFAULT_ROI, automationRatePct: 90 }, noHitl).grossHoursAutomated);
  });
  it('punto de equilibrio coherente', () => {
    const pct = breakEvenAutomationPct(DEFAULT_ROI, noHitl)!;
    expect(computeRoi({ ...DEFAULT_ROI, automationRatePct: pct }, noHitl).netMonthlyEur).toBeCloseTo(0, 6);
  });
  it('escenario por defecto es rentable (demo)', () => {
    const r = computeRoi(DEFAULT_ROI, { autonomyLevel: 'semiautonomo', hitlEnabled: true });
    expect(r.roiPct).toBeGreaterThan(0);
    expect(r.paybackMonths!).toBeLessThan(12);
  });
});

describe('assessRisk', () => {
  const safe: GovernanceControls = { autonomyLevel: 'asistido', dataSensitivity: 'publico', hitlEnabled: true, auditLoggingEnabled: true, piiRedactionEnabled: true, useCase: 'licitaciones_interno' };
  it('umbrales', () => {
    expect([0, 3, 4, 6, 7, 9, 10].map(tierFromScore)).toEqual(['Bajo', 'Bajo', 'Moderado', 'Moderado', 'Alto', 'Alto', 'Crítico']);
  });
  it('configuración segura → Bajo', () => {
    expect(assessRisk(safe).tier).toBe('Bajo');
  });
  it('autónomo + PII financiera sin controles → Crítico con controles bloqueantes', () => {
    const r = assessRisk({ ...safe, autonomyLevel: 'autonomo', dataSensitivity: 'pii_financiero', hitlEnabled: false, auditLoggingEnabled: false, piiRedactionEnabled: false });
    expect(r.tier).toBe('Crítico');
    expect(r.controls.filter((c) => c.blocking).map((c) => c.id)).toEqual(expect.arrayContaining(['hitl', 'audit', 'pii', 'scope', 'dpia']));
  });
  it('alto riesgo legal: los controles no bajan la categoría por debajo de Alto', () => {
    const r = assessRisk({ ...safe, useCase: 'elegibilidad_servicios' });
    expect(r.tier).toBe('Alto');
    expect(r.floorReason).toBeDefined();
    expect(r.controls.map((c) => c.id)).toEqual(expect.arrayContaining(['rms', 'data_gov', 'fria']));
  });
  it('atención al cliente exige transparencia (Art. 50)', () => {
    expect(assessRisk({ ...safe, useCase: 'atencion_cliente' }).controls.some((c) => c.id === 'transparency')).toBe(true);
  });
  it('bloqueantes primero', () => {
    const c = assessRisk({ ...safe, autonomyLevel: 'autonomo', hitlEnabled: false }).controls;
    const firstNonBlocking = c.findIndex((x) => !x.blocking);
    expect(c.slice(firstNonBlocking).every((x) => !x.blocking)).toBe(true);
  });
});
