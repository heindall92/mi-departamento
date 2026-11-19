import { describe, expect, it } from 'vitest';
import { DEFAULT_CAPABILITIES, DEFAULT_TEAM_FTE, DEFAULT_WEIGHTS, TENDER_SCENARIOS } from '../data/tenderScenarios';
import { parseBudgetEur, parseDeadlineDays, parseTender, splitSentences } from './deterministicParser';
import { buildProposalOutline, estimateEffort, evaluateTender } from './tenderScoring';

const [A, B] = TENDER_SCENARIOS as [typeof TENDER_SCENARIOS[0], typeof TENDER_SCENARIOS[0]];
const caps = { ...DEFAULT_CAPABILITIES };

describe('evaluateTender', () => {
  it('A (CX omnicanal) sale Go con las capacidades por defecto', () => {
    const e = evaluateTender(A, caps, DEFAULT_WEIGHTS, DEFAULT_TEAM_FTE);
    expect(e.verdict).toBe('Go');
    expect(e.vetoes).toHaveLength(0);
  });
  it('A sin ENS MEDIA → No-Go por veto (cambia en vivo)', () => {
    const e = evaluateTender(A, { ...caps, ens_media: false }, DEFAULT_WEIGHTS, DEFAULT_TEAM_FTE);
    expect(e.verdict).toBe('No-Go');
    expect(e.vetoes.map((c) => c.id)).toEqual(['A2']);
    expect(e.explanation).toMatch(/veto/i);
  });
  it('B (IA regulada) es No-Go por ENS ALTA y pasa a Revisar al cubrirlo', () => {
    expect(evaluateTender(B, caps, DEFAULT_WEIGHTS, DEFAULT_TEAM_FTE).verdict).toBe('No-Go');
    const withEns = evaluateTender(B, { ...caps, ens_alta: true }, DEFAULT_WEIGHTS, DEFAULT_TEAM_FTE);
    expect(withEns.vetoes).toHaveLength(0);
    expect(withEns.verdict).toBe('Revisar');
  });
  it('B con todas las capacidades → Go', () => {
    const all = Object.fromEntries(Object.keys(caps).map((k) => [k, true])) as typeof caps;
    const e = evaluateTender(B, all, DEFAULT_WEIGHTS, 4, { B12: true });
    expect(e.verdict).toBe('Go');
  });
  it('los pesos cambian la puntuación', () => {
    const a = evaluateTender(B, { ...caps, ens_alta: true }, { technicalFit: 10, compliance: 70, deadline: 10, contractual: 10 }, 3);
    const b = evaluateTender(B, { ...caps, ens_alta: true }, { technicalFit: 70, compliance: 10, deadline: 10, contractual: 10 }, 3);
    expect(a.total).not.toBe(b.total);
  });
  it('dimensiones en rango 0-100', () => {
    for (const s of TENDER_SCENARIOS) for (const v of Object.values(evaluateTender(s, caps, DEFAULT_WEIGHTS, 1).dimensions)) {
      expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100);
    }
  });
  it('menos equipo → peor holgura de plazo', () => {
    const big = evaluateTender(B, caps, DEFAULT_WEIGHTS, 6).dimensions.deadline;
    const small = evaluateTender(B, caps, DEFAULT_WEIGHTS, 1).dimensions.deadline;
    expect(big).toBeGreaterThan(small);
  });
});

describe('esfuerzo e índice', () => {
  it('las brechas añaden jornadas a Seguridad/QA', () => {
    const base = estimateEffort(B, Object.fromEntries(Object.keys(caps).map((k) => [k, true])) as typeof caps, { B12: true });
    const gaps = estimateEffort(B, caps);
    const qa = (p: typeof base) => p.find((x) => x.key === 'securityQA')!.totalDays;
    expect(qa(gaps)).toBeGreaterThan(qa(base));
    expect(base.find((x) => x.key === 'securityQA')!.gapDays).toBe(0);
  });
  it('perfiles suman las jornadas de la fase', () => {
    for (const p of estimateEffort(A, caps)) {
      expect(p.profiles.reduce((s, x) => s + x.days, 0)).toBeCloseTo(p.totalDays, 0);
    }
  });
  it('el índice añade planes de brecha', () => {
    expect(buildProposalOutline(B, caps).some((l) => l.startsWith('Plan de cierre de brecha'))).toBe(true);
  });
});

describe('parser determinista', () => {
  it('extrae plazo y presupuesto', () => {
    expect(parseDeadlineDays('Plazo de ejecución: 6 meses desde la firma')).toBe(180);
    expect(parseDeadlineDays('plazo de ejecución de 90 días')).toBe(90);
    expect(parseBudgetEur('Presupuesto base de licitación: 1.200.000 euros')).toBe(1_200_000);
  });
  it('segmenta por líneas y numeración', () => {
    expect(splitSentences('1. Primera cláusula suficientemente larga.\n2. Segunda cláusula suficientemente larga.')).toHaveLength(2);
  });
  it.each([A, B])('reconstruye los 5 bloques del pliego %#', (s) => {
    const r = parseTender(s.sourceText!);
    const cats = new Set(r.scenario.clauses.map((c) => c.category));
    for (const c of ['excluyente', 'plazo', 'tecnico', 'cumplimiento', 'dependencia']) expect(cats).toContain(c);
    expect(r.scenario.deadlineDays).toBe(s.deadlineDays);
    expect(r.scenario.budgetEur).toBe(s.budgetEur);
    // los excluyentes del parser coinciden con los curados
    const curated = s.clauses.filter((c) => c.category === 'excluyente').length;
    expect(r.scenario.clauses.filter((c) => c.category === 'excluyente').length).toBe(curated);
  });
  it('detecta marcos y capacidades en el pliego B', () => {
    const cl = parseTender(B.sourceText!).scenario.clauses;
    expect(cl.some((c) => c.framework === 'EU AI Act' && c.requires === 'ai_act_conformity')).toBe(true);
    expect(cl.some((c) => c.requires === 'ens_alta')).toBe(true);
    expect(cl.find((c) => /99,9/.test(c.summary))?.penaltyPct).toBe(20);
  });
  it('texto que no es pliego → sin cláusulas y aviso', () => {
    const r = parseTender('Hola, esto es una lista de la compra con pan, leche y huevos para el sábado.');
    expect(r.scenario.clauses).toHaveLength(0);
    expect(r.notes.length).toBeGreaterThan(0);
  });
  it('el pliego parseado se puede evaluar', () => {
    const r = parseTender(A.sourceText!);
    expect(['Go', 'Revisar', 'No-Go']).toContain(evaluateTender(r.scenario, caps, DEFAULT_WEIGHTS, 3).verdict);
  });
});
