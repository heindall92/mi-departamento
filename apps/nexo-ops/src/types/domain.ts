/**
 * Contratos de dominio de NEXO-OPS.
 * Base: sección 04 del roadmap. Las ampliaciones respecto al documento
 * están marcadas con «Extensión» y justificadas en el README.
 */

/* ───────────────────────────── Módulo 1 ───────────────────────────── */

export type Stage = 'intake' | 'classifier' | 'crm_lookup' | 'resolver' | 'hitl' | 'crm_close';
export type Actor = 'Canal' | 'Agente IA' | 'CRM' | 'Humano';

export interface FlowStep {
  id: string;
  stage: Stage;
  label: string;
  actor: Actor;
  normalOutput: string;
  vulnerableBehavior: string; // Resultado si guardrails = false y hay incidente activo
  protectedBehavior: string; // Resultado si guardrails = true
  guardrailControl: string; // Ej.: "Sanitización + Principio de mínimo privilegio"
  businessImpact: string; // Impacto directo si falla (fuga, sanción, pérdida)
  /** Extensión: permiso que usa el nodo (mínimo privilegio, visible en el inspector). */
  permission: string;
}

export type IncidentId = 'prompt_injection' | 'policy_hallucination' | 'pii_webhook_leak';

export interface ChaosIncident {
  id: IncidentId;
  title: string;
  triggerStage: Stage;
  samplePayload: string;
  severity: 'Alta' | 'Crítica';
  complianceRefs: string[]; // Ej.: ["RGPD Art. 32", "OWASP LLM01", "ISO 42001"]
  /** Extensión: canal de entrada del caso. */
  channel: Channel;
  /** Extensión: comportamiento por etapa cuando el incidente está activo. */
  stageEffects: Partial<Record<Stage, { vulnerable: string; protected: string }>>;
  /** Extensión: regla 07 «lenguaje dual» — una frase técnica y una de negocio. */
  technicalFailure: string;
  businessConsequence: string;
  /** Extensión: qué hace el agente ingenuo (entrada al motor determinista). */
  naiveAgent: NaiveAgentBehavior;
}

export type Channel = 'Email' | 'WhatsApp' | 'Ticket';

/** Lo que el agente "ingenuo" intentaría hacer. El motor de guardrails decide si se permite. */
export interface NaiveAgentBehavior {
  /** IDs de cliente que el agente pide al CRM (el verificado + los que le inyecten). */
  requestedCustomerIds: string[];
  /** Compensación que el agente propone en €. */
  proposedCompensationEur: number;
  /** Texto de la promesa que enviaría al cliente. */
  proposedReply: string;
  /** Si el agente envía el texto íntegro a un modelo externo vía webhook. */
  sendsRawPayloadToExternalLlm: boolean;
}

export interface CustomerCase {
  sessionCustomerId: string; // identidad verificada por el canal (OTP / login)
  customerName: string;
  channel: Channel;
  message: string;
  monthlyFeeEur: number;
}

export type TraceStatus = 'ok' | 'blocked' | 'leak' | 'escalated' | 'warning';
export type ComplianceState = 'Cumple' | 'Incumple' | 'Mitigado';

export interface TraceEvent {
  seq: number;
  tMs: number; // marca temporal simulada desde el inicio del caso
  latencyMs: number;
  stage: Stage;
  actor: Actor;
  decision: string;
  status: TraceStatus;
  compliance: ComplianceState;
  technical: string;
  business: string;
  permission: string;
  findings: string[];
  payloadBefore?: string;
  payloadAfter?: string;
  skipped?: boolean;
}

export interface FlowOutcome {
  kind: 'resolved' | 'breach' | 'contained';
  headline: string;
  recordsExposed: number;
  piiFieldsExposed: number;
  unauthorizedCommitmentEur: number;
  controlsFired: string[];
}

export interface FlowRun {
  events: TraceEvent[];
  outcome: FlowOutcome;
}

/* ───────────────────────────── Módulo 2 ───────────────────────────── */

export type ClauseCategory = 'excluyente' | 'plazo' | 'tecnico' | 'cumplimiento' | 'dependencia';
export type Framework = 'RGPD' | 'ENS' | 'ISO 27001' | 'EU AI Act' | 'ISO 42001';
export type RiskLevel = 'Bajo' | 'Medio' | 'Alto';

export interface TenderClause {
  id: string;
  category: ClauseCategory; // Extensión: 'dependencia' (5.º bloque del roadmap)
  summary: string;
  framework?: Framework; // Extensión: 'ISO 42001'
  riskLevel: RiskLevel;
  metByTeam: boolean;
  /** Extensión: capacidad interna que, si se marca, cubre la cláusula. */
  requires?: CapabilityId;
  /** Extensión: cita literal del pliego (evidencia). */
  evidence?: string;
  /** Extensión: penalización económica asociada (% del contrato). */
  penaltyPct?: number;
  /** Extensión: regla 07 «lenguaje dual». */
  business?: string;
  source?: 'pliego' | 'reglas' | 'ia';
}

export interface TenderScenario {
  id: string;
  title: string;
  sector: string;
  deadlineDays: number;
  estimatedEffortDays: { discovery: number; build: number; securityQA: number; rollout: number };
  clauses: TenderClause[];
  proposalOutline: string[];
  /** Extensión: presupuesto base de licitación (sin IVA). */
  budgetEur?: number;
  /** Extensión: texto completo del pliego (para demostrar el parser). */
  sourceText?: string;
}

export type CapabilityId =
  | 'ens_media'
  | 'ens_alta'
  | 'iso27001'
  | 'iso42001'
  | 'eu_hosting'
  | 'crm_integration'
  | 'dpo'
  | 'ai_act_conformity'
  | 'accessibility'
  | 'soc24x7';

export interface Capability {
  id: CapabilityId;
  label: string;
}

export interface TenderWeights {
  technicalFit: number;
  compliance: number;
  deadline: number;
  contractual: number;
}

export type Verdict = 'Go' | 'Revisar' | 'No-Go';

export interface ScoreDriver {
  dimension: keyof TenderWeights;
  delta: number;
  reason: string;
}

export interface TenderEvaluation {
  verdict: Verdict;
  total: number;
  dimensions: Record<keyof TenderWeights, number>;
  vetoes: TenderClause[];
  drivers: ScoreDriver[];
  explanation: string;
}

/* ───────────────────────────── Módulo 3 ───────────────────────────── */

export interface RoiInputs {
  monthlyVolume: number; // Tickets o pliegos al mes
  manualMinutesPerItem: number; // Tiempo manual actual
  hourlyCostEur: number; // Coste/hora operativo
  automationRatePct: number; // 0 a 90 %
  setupCostEur: number; // Implantación única
  monthlyRunCostEur: number; // APIs, infraestructura, mantenimiento
}

export type AutonomyLevel = 'asistido' | 'semiautonomo' | 'autonomo';
export type DataSensitivity = 'publico' | 'interno' | 'pii_financiero';
/** Extensión: el EU AI Act clasifica por caso de uso, no por controles. */
export type UseCase = 'atencion_cliente' | 'licitaciones_interno' | 'elegibilidad_servicios' | 'scoring_credito';

export interface GovernanceControls {
  autonomyLevel: AutonomyLevel;
  dataSensitivity: DataSensitivity;
  hitlEnabled: boolean;
  auditLoggingEnabled: boolean;
  piiRedactionEnabled: boolean;
  useCase: UseCase; // Extensión
}

export interface RoiResult {
  grossHoursAutomated: number;
  hitlReviewHours: number;
  hoursFreed: number;
  monthlySavingsEur: number;
  netMonthlyEur: number;
  annualSavingsEur: number;
  firstYearNetEur: number;
  roiPct: number;
  paybackMonths: number | null; // null = no se recupera
}

export type RiskTier = 'Bajo' | 'Moderado' | 'Alto' | 'Crítico';

export interface RequiredControl {
  id: string;
  title: string;
  refs: string[];
  why: string;
  blocking: boolean; // bloqueante para producción
}

export interface RiskAssessment {
  tier: RiskTier;
  score: number;
  drivers: { label: string; points: number }[];
  aiActCategory: string;
  floorReason?: string;
  controls: RequiredControl[];
}

/* ───────────────────────────── Ajustes IA ───────────────────────────── */

export type AiMode = 'zero_egress' | 'anthropic' | 'ollama';

export interface AiSettings {
  mode: AiMode;
  anthropicKey: string; // SOLO en memoria (React state). Nunca persistido.
  anthropicModel: string;
  ollamaUrl: string;
  ollamaModel: string;
}
