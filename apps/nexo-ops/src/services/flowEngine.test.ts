import { describe, expect, it } from 'vitest';
import { CHAOS_INCIDENTS } from '../data/cxFlowScenarios';
import type { IncidentId } from '../types/domain';
import { classifyIntent, mask, runFlow } from './flowEngine';

const ids: (IncidentId | null)[] = [null, ...CHAOS_INCIDENTS.map((i) => i.id)];

describe('runFlow', () => {
  it.each(ids.flatMap((id) => [[id, true], [id, false]] as const))('incidente %s · guardrails %s → 6 etapas en orden', (id, g) => {
    const r = runFlow(id, g);
    expect(r.events.map((e) => e.stage)).toEqual(['intake', 'classifier', 'crm_lookup', 'resolver', 'hitl', 'crm_close']);
    // tiempos monótonos
    r.events.reduce((prev, e) => (expect(e.tMs).toBeGreaterThanOrEqual(prev), e.tMs), 0);
  });

  it('es determinista', () => {
    expect(runFlow('prompt_injection', false)).toEqual(runFlow('prompt_injection', false));
  });

  it('caso base: igual resultado con y sin guardrails (el riesgo es invisible)', () => {
    expect(runFlow(null, false).outcome.kind).toBe('resolved');
    expect(runFlow(null, true).outcome.kind).toBe('resolved');
  });

  it.each(CHAOS_INCIDENTS.map((i) => i.id))('%s: OFF = brecha, ON = contenido (criterio de aceptación Fase 2)', (id) => {
    const off = runFlow(id, false);
    const on = runFlow(id, true);
    expect(off.outcome.kind).toBe('breach');
    expect(on.outcome.kind).toBe('contained');
    expect(on.outcome.recordsExposed + on.outcome.piiFieldsExposed + on.outcome.unauthorizedCommitmentEur).toBe(0);
    expect(off.events.some((e) => e.status === 'leak')).toBe(true);
    expect(on.events.some((e) => e.status === 'leak')).toBe(false);
  });

  it('prompt injection OFF expone 2 fichas de terceros; ON las deniega', () => {
    expect(runFlow('prompt_injection', false).outcome.recordsExposed).toBe(2);
    const crm = runFlow('prompt_injection', true).events.find((e) => e.stage === 'crm_lookup')!;
    expect(crm.status).toBe('blocked');
    expect(crm.findings.join(' ')).toContain('DENY crm.getCustomer("C-1002")');
  });

  it('alucinación: compromiso no autorizado = 450 € − política (3 días)', () => {
    expect(runFlow('policy_hallucination', false).outcome.unauthorizedCommitmentEur).toBe(447);
    const hitl = runFlow('policy_hallucination', true).events.find((e) => e.stage === 'hitl')!;
    expect(hitl.status).toBe('escalated');
  });

  it('fuga PII: ON envía payload tokenizado sin datos reales', () => {
    const res = runFlow('pii_webhook_leak', true).events.find((e) => e.stage === 'resolver')!;
    expect(res.payloadAfter).toContain('[DNI_1]');
    expect(res.payloadAfter).not.toContain('12345678Z');
    expect(runFlow('pii_webhook_leak', false).outcome.piiFieldsExposed).toBe(3);
  });

  it('dual: cada evento tiene frase técnica y de negocio', () => {
    for (const id of ids) for (const g of [true, false]) for (const e of runFlow(id, g).events) {
      expect(e.technical.length).toBeGreaterThan(10);
      expect(e.business.length).toBeGreaterThan(10);
    }
  });
});

describe('utilidades', () => {
  it('classifyIntent', () => {
    expect(classifyIntent('me habéis cobrado dos veces la factura').intent).toBe('Facturación');
    expect(classifyIntent('Llevo 3 días sin fibra, inaceptable').urgency).toBe('Alta');
  });
  it('mask no re-expone el dato', () => {
    expect(mask('12345678Z')).toBe('12••••78Z');
  });
});
