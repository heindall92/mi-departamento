import type {
  CapabilityId,
  RiskLevel,
  ScoreDriver,
  TenderClause,
  TenderEvaluation,
  TenderScenario,
  TenderWeights,
  Verdict,
} from '../types/domain';
import { clamp } from '../utils/format';

/**
 * Motor Go / Revisar / No-Go. Todo es explicable: cada punto que se resta
 * queda como `driver` con su motivo, y los vetos (excluyentes no cumplidos)
 * se muestran aparte porque no se compensan con puntuación.
 */

export const RISK_WEIGHT: Record<RiskLevel, number> = { Bajo: 1, Medio: 2, Alto: 3 };
export const GO_THRESHOLD = 70;
export const REVIEW_THRESHOLD = 50;

export type ClauseOverrides = Record<string, boolean>;
export type Capabilities = Record<CapabilityId, boolean>;

export function isMet(c: TenderClause, caps: Capabilities, overrides: ClauseOverrides = {}): boolean {
  if (c.requires) return caps[c.requires] ?? false;
  return overrides[c.id] ?? c.metByTeam;
}

function weightedMet(clauses: TenderClause[], met: (c: TenderClause) => boolean): number {
  const total = clauses.reduce((s, c) => s + RISK_WEIGHT[c.riskLevel], 0);
  if (total === 0) return 100;
  return (clauses.reduce((s, c) => s + (met(c) ? RISK_WEIGHT[c.riskLevel] : 0), 0) / total) * 100;
}

/* ───────────────────────── Esfuerzo ───────────────────────── */

export interface EffortPhase {
  key: 'discovery' | 'build' | 'securityQA' | 'rollout';
  label: string;
  baseDays: number;
  gapDays: number;
  totalDays: number;
  profiles: { role: string; days: number }[];
}

const PHASES: Array<{ key: EffortPhase['key']; label: string; split: Array<[string, number]> }> = [
  { key: 'discovery', label: 'Descubrimiento', split: [['Consultor/a CX', 0.5], ['Arquitecto/a de soluciones', 0.5]] },
  { key: 'build', label: 'Integración', split: [['Ingeniero/a de integración', 0.45], ['Ingeniero/a IA', 0.4], ['Arquitecto/a de soluciones', 0.15]] },
  { key: 'securityQA', label: 'Seguridad / QA', split: [['Especialista ciberseguridad / GRC', 0.55], ['QA', 0.45]] },
  { key: 'rollout', label: 'Puesta en marcha', split: [['Jefe/a de proyecto', 0.5], ['Consultor/a CX (formación)', 0.5]] },
];

const GAP_DAYS: Record<RiskLevel, number> = { Bajo: 3, Medio: 8, Alto: 15 };

/** Jornadas para cerrar brechas: cada cláusula no cubierta añade trabajo. */
export function estimateEffort(s: TenderScenario, caps: Capabilities, overrides: ClauseOverrides = {}): EffortPhase[] {
  const gap = { discovery: 0, build: 0, securityQA: 0, rollout: 0 };
  for (const c of s.clauses) {
    if (isMet(c, caps, overrides) || c.category === 'excluyente') continue;
    if (c.category === 'cumplimiento') gap.securityQA += GAP_DAYS[c.riskLevel];
    else if (c.category === 'tecnico') gap.build += GAP_DAYS[c.riskLevel] + 5;
    else if (c.category === 'dependencia') gap.discovery += Math.ceil(GAP_DAYS[c.riskLevel] / 2);
    else if (c.category === 'plazo') gap.rollout += Math.ceil(GAP_DAYS[c.riskLevel] / 2);
  }
  return PHASES.map((p) => {
    const baseDays = s.estimatedEffortDays[p.key];
    const totalDays = baseDays + gap[p.key];
    return {
      key: p.key,
      label: p.label,
      baseDays,
      gapDays: gap[p.key],
      totalDays,
      profiles: p.split.map(([role, share]) => ({ role, days: Math.round(totalDays * share * 10) / 10 })),
    };
  });
}

/* ───────────────────────── Evaluación ───────────────────────── */

export function evaluateTender(
  s: TenderScenario,
  caps: Capabilities,
  weights: TenderWeights,
  teamFte: number,
  overrides: ClauseOverrides = {},
): TenderEvaluation {
  const met = (c: TenderClause) => isMet(c, caps, overrides);
  const drivers: ScoreDriver[] = [];

  // 1 · Encaje técnico
  const techClauses = s.clauses.filter((c) => c.category === 'tecnico' || c.category === 'excluyente');
  const technicalFit = weightedMet(techClauses, met);
  for (const c of techClauses.filter((c) => !met(c))) {
    drivers.push({ dimension: 'technicalFit', delta: -RISK_WEIGHT[c.riskLevel], reason: `No cubierto: ${c.summary}` });
  }

  // 2 · Carga de cumplimiento (100 = preparados)
  const compClauses = s.clauses.filter((c) => c.category === 'cumplimiento');
  const compliance = weightedMet(compClauses, met);
  for (const c of compClauses.filter((c) => !met(c))) {
    drivers.push({ dimension: 'compliance', delta: -RISK_WEIGHT[c.riskLevel], reason: `Brecha ${c.framework ?? ''}: ${c.summary}`.replace('  ', ' ') });
  }

  // 3 · Plazo: jornadas necesarias vs capacidad del equipo en el plazo
  const effort = estimateEffort(s, caps, overrides).reduce((a, p) => a + p.totalDays, 0);
  const capacity = Math.max(1, teamFte * s.deadlineDays * (5 / 7) * 0.85); // 85 % productivo
  const load = effort / capacity;
  const deadline = clamp(((1.2 - load) / (1.2 - 0.7)) * 100, 0, 100);
  drivers.push({
    dimension: 'deadline',
    delta: 0,
    reason: `Carga ${Math.round(load * 100)} %: ${effort} jornadas para ${Math.round(capacity)} disponibles (${teamFte} FTE × ${s.deadlineDays} días)`,
  });

  // 4 · Riesgo contractual (100 = sin exposición)
  let contractual = 100;
  for (const c of s.clauses) {
    if (c.category === 'plazo') {
      const hit = Math.round((c.penaltyPct ?? 0) * 1.5 + (c.riskLevel === 'Alto' ? 10 : c.riskLevel === 'Medio' ? 4 : 1));
      contractual -= hit;
      drivers.push({ dimension: 'contractual', delta: -hit, reason: `Penalización/plazo: ${c.summary}` });
    }
    if (c.category === 'dependencia' && !met(c)) {
      const hit = RISK_WEIGHT[c.riskLevel] * 6;
      contractual -= hit;
      drivers.push({ dimension: 'contractual', delta: -hit, reason: `Dependencia no gestionada: ${c.summary}` });
    }
  }
  if (load > 1) {
    contractual -= 15;
    drivers.push({ dimension: 'contractual', delta: -15, reason: 'Sobrecarga de equipo: alta probabilidad de activar penalizaciones' });
  }
  contractual = clamp(contractual, 0, 100);

  const dimensions = { technicalFit, compliance, deadline, contractual };
  const wSum = weights.technicalFit + weights.compliance + weights.deadline + weights.contractual || 1;
  const total =
    (technicalFit * weights.technicalFit +
      compliance * weights.compliance +
      deadline * weights.deadline +
      contractual * weights.contractual) /
    wSum;

// #region guia:veto
  const vetoes = s.clauses.filter((c) => c.category === 'excluyente' && !met(c));
  let verdict: Verdict;
  if (vetoes.length) verdict = 'No-Go';
  else if (total >= GO_THRESHOLD) verdict = 'Go';
  else if (total >= REVIEW_THRESHOLD) verdict = 'Revisar';
  else verdict = 'No-Go';
// #endregion guia:veto

  return { verdict, total: Math.round(total), dimensions: roundAll(dimensions), vetoes, drivers, explanation: explain(verdict, total, vetoes, dimensions) };
}

function roundAll<T extends Record<string, number>>(o: T): T {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)])) as T;
}

const DIM_LABEL: Record<keyof TenderWeights, string> = {
  technicalFit: 'encaje técnico',
  compliance: 'preparación normativa',
  deadline: 'holgura de plazo',
  contractual: 'riesgo contractual',
};

function explain(v: Verdict, total: number, vetoes: TenderClause[], d: Record<keyof TenderWeights, number>): string {
  if (vetoes.length) {
    return `No-Go por veto: ${vetoes.length} requisito(s) excluyente(s) sin cubrir (${vetoes.map((c) => c.id).join(', ')}). Ninguna puntuación compensa un excluyente: la oferta sería inadmitida.`;
  }
  const weakest = (Object.keys(d) as (keyof TenderWeights)[]).sort((a, b) => d[a] - d[b])[0]!;
  const t = Math.round(total);
  if (v === 'Go') return `Go con ${t}/100. Punto a vigilar en la oferta: ${DIM_LABEL[weakest]} (${Math.round(d[weakest])}/100).`;
  if (v === 'Revisar') return `Revisar con ${t}/100: viable solo si se resuelve ${DIM_LABEL[weakest]} (${Math.round(d[weakest])}/100) antes de comprometer horas de preventa.`;
  return `No-Go con ${t}/100: el coste de preparar la oferta supera la probabilidad realista de adjudicación. Debilidad principal: ${DIM_LABEL[weakest]}.`;
}

/** Índice de memoria técnica: el del pliego + apartados para cerrar brechas. */
export function buildProposalOutline(s: TenderScenario, caps: Capabilities, overrides: ClauseOverrides = {}): string[] {
  const extra: string[] = [];
  for (const c of s.clauses) {
    if (c.category !== 'excluyente' && !isMet(c, caps, overrides) && c.riskLevel !== 'Bajo') {
      extra.push(`Plan de cierre de brecha: ${c.summary}`);
    }
  }
  return [...s.proposalOutline, ...extra];
}
