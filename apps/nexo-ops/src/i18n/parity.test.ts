import { describe, expect, it } from 'vitest';
import { CHAOS_INCIDENTS, chaosIncidents, flowSteps } from '../data/cxFlowScenarios';
import { capabilities, DEFAULT_CAPABILITIES, DEFAULT_TEAM_FTE, DEFAULT_WEIGHTS, TENDER_SCENARIOS, tenderScenarios } from '../data/tenderScenarios';
import { parseTender } from '../services/deterministicParser';
import { runFlow } from '../services/flowEngine';
import { toMarkdown, type ReportData } from '../services/reportExporter';
import { assessRisk } from '../services/riskIndex';
import { computeRoi, DEFAULT_ROI } from '../services/roi';
import { buildProposalOutline, estimateEffort, evaluateTender } from '../services/tenderScoring';
import type { GovernanceControls, IncidentId } from '../types/domain';

/** Palabras funcionales del español que no deberían aparecer en un texto en inglés. */
const SPANISH = /\b(el|los|las|del|para|con|que|una|está|sin|por|según|también|cliente|caso)\b|[¿¡]/i;
const ids: (IncidentId | null)[] = [null, ...CHAOS_INCIDENTS.map((i) => i.id)];

describe('paridad ES/EN del Módulo 1', () => {
  it.each(ids.flatMap((id) => [[id, true], [id, false]] as const))('%s · guardrails %s: misma lógica, distinto idioma', (id, g) => {
    const es = runFlow(id, g, 'es');
    const en = runFlow(id, g, 'en');
    expect(en.events.map((e) => [e.stage, e.status, e.compliance, e.latencyMs, e.tMs])).toEqual(es.events.map((e) => [e.stage, e.status, e.compliance, e.latencyMs, e.tMs]));
    const { headline: _a, controlsFired: ca, ...oes } = es.outcome;
    const { headline: _b, controlsFired: cb, ...oen } = en.outcome;
    expect(oen).toEqual(oes);
    expect(cb.length).toBe(ca.length);
    for (const e of en.events) {
      for (const t of [e.decision, e.technical, e.business, e.permission]) expect(t, t).not.toMatch(SPANISH);
    }
    expect(en.outcome.headline).not.toMatch(SPANISH);
  });

  it('pasos e incidentes traducidos por completo', () => {
    for (const s of flowSteps('en')) for (const v of [s.label, s.normalOutput, s.protectedBehavior, s.businessImpact]) expect(v, v).not.toMatch(SPANISH);
    for (const i of chaosIncidents('en')) {
      for (const v of [i.title, i.technicalFailure, i.businessConsequence, i.samplePayload]) expect(v, v).not.toMatch(SPANISH);
      expect(i.complianceRefs.join(' ')).not.toMatch(/RGPD/);
      if (i.id === 'pii_webhook_leak') expect(i.complianceRefs).toContain('GDPR Art. 5(1)(c)');
    }
  });
});

describe('paridad ES/EN del Módulo 2', () => {
  it.each(TENDER_SCENARIOS.map((s) => s.id))('%s: mismo veredicto y puntuación', (id) => {
    for (const caps of [DEFAULT_CAPABILITIES, { ...DEFAULT_CAPABILITIES, ens_media: false }, { ...DEFAULT_CAPABILITIES, ens_alta: true }]) {
      const es = evaluateTender(TENDER_SCENARIOS.find((s) => s.id === id)!, caps, DEFAULT_WEIGHTS, DEFAULT_TEAM_FTE, {}, 'es');
      const sc = tenderScenarios('en').find((s) => s.id === id)!;
      const en = evaluateTender(sc, caps, DEFAULT_WEIGHTS, DEFAULT_TEAM_FTE, {}, 'en');
      expect([en.verdict, en.total, en.dimensions]).toEqual([es.verdict, es.total, es.dimensions]);
      expect(en.explanation).not.toMatch(SPANISH);
      for (const d of en.drivers) expect(d.reason).not.toMatch(SPANISH);
      for (const c of sc.clauses) expect(c.summary + c.business, c.id).not.toMatch(SPANISH);
      for (const l of buildProposalOutline(sc, caps, {}, 'en')) expect(l).not.toMatch(SPANISH);
      for (const p of estimateEffort(sc, caps, {}, 'en')) expect(p.label + p.profiles.map((x) => x.role).join(' ')).not.toMatch(SPANISH);
    }
  });

  it.each(tenderScenarios('en'))('parser en inglés reconstruye el pliego $id', (s) => {
    const r = parseTender(s.sourceText!, undefined, 'en');
    const cats = new Set(r.scenario.clauses.map((c) => c.category));
    for (const c of ['excluyente', 'plazo', 'tecnico', 'cumplimiento', 'dependencia']) expect(cats).toContain(c);
    expect(r.scenario.deadlineDays).toBe(s.deadlineDays);
    expect(r.scenario.budgetEur).toBe(s.budgetEur);
    expect(r.scenario.clauses.filter((c) => c.category === 'excluyente').length).toBe(s.clauses.filter((c) => c.category === 'excluyente').length);
    expect(r.scenario.title).toBe('Pasted tender (rule-based analysis)');
  });

  it('capacidades traducidas', () => {
    for (const c of capabilities('en')) expect(c.label).not.toMatch(SPANISH);
  });
});

describe('paridad ES/EN del Módulo 3 y del informe', () => {
  const g: GovernanceControls = { autonomyLevel: 'autonomo', dataSensitivity: 'pii_financiero', hitlEnabled: false, auditLoggingEnabled: false, piiRedactionEnabled: false, useCase: 'elegibilidad_servicios' };
  it('mismo nivel, mismos controles; textos en inglés', () => {
    const es = assessRisk(g, 'es');
    const en = assessRisk(g, 'en');
    expect([en.tier, en.score, en.controls.map((c) => [c.id, c.blocking])]).toEqual([es.tier, es.score, es.controls.map((c) => [c.id, c.blocking])]);
    for (const c of en.controls) expect(c.title + ' ' + c.why, c.id).not.toMatch(SPANISH);
    for (const d of en.drivers) expect(d.label).not.toMatch(SPANISH);
    expect(en.aiActCategory).toBe('HIGH RISK — Annex III, point 5(a)');
  });

  it('el One-Pager en inglés no contiene español (salvo nombres propios)', () => {
    const sc = tenderScenarios('en')[0]!;
    const d: ReportData = {
      lang: 'en',
      generatedAt: '19 November 2026',
      flow: { incidentTitle: 'Prompt injection in a support ticket', guardrails: true, run: runFlow('prompt_injection', true, 'en'), counterfactual: runFlow('prompt_injection', false, 'en') },
      tender: { scenario: sc, evaluation: evaluateTender(sc, DEFAULT_CAPABILITIES, DEFAULT_WEIGHTS, 3, {}, 'en'), effort: estimateEffort(sc, DEFAULT_CAPABILITIES, {}, 'en'), outline: buildProposalOutline(sc, DEFAULT_CAPABILITIES, {}, 'en') },
      roi: { inputs: DEFAULT_ROI, result: computeRoi(DEFAULT_ROI, g), governance: g, risk: assessRisk(g, 'en') },
    };
    const md = toMarkdown(d);
    expect(md).toContain('# NEXO-OPS · Executive One-Pager');
    expect(md.replace(/Aguas del Litoral/g, '')).not.toMatch(SPANISH);
  });
});
