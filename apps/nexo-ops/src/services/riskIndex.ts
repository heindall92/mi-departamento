import type {
  AutonomyLevel,
  DataSensitivity,
  GovernanceControls,
  RequiredControl,
  RiskAssessment,
  RiskTier,
  UseCase,
} from '../types/domain';

/**
 * Índice de Exposición de Riesgo IA (indicador interno de gobernanza).
 *
 * IMPORTANTE: no es una clasificación jurídica. El EU AI Act clasifica por
 * CASO DE USO (Art. 6 + Anexo III), no por controles: un sistema de alto
 * riesgo sigue siéndolo aunque tenga HITL. Por eso el caso de uso fija un
 * suelo (floor) que los controles no pueden bajar.
 * Los niveles (`RiskTier`) son claves internas; la UI los traduce.
 */

type Lang = 'es' | 'en';
type T = { es: string; en: string };
const tr = (t: T, lang: Lang) => (lang === 'en' ? t.en : t.es);

export const AUTONOMY_POINTS: Record<AutonomyLevel, number> = { asistido: 0, semiautonomo: 2, autonomo: 4 };
export const SENSITIVITY_POINTS: Record<DataSensitivity, number> = { publico: 0, interno: 1, pii_financiero: 3 };

const USE_CASES_I18N: Record<UseCase, { label: T; aiAct: T; highRisk: boolean }> = {
  atencion_cliente: {
    label: { es: 'Atención al cliente (B2C)', en: 'Customer service (B2C)' },
    aiAct: { es: 'Riesgo limitado — obligaciones de transparencia (Art. 50)', en: 'Limited risk — transparency obligations (Art. 50)' },
    highRisk: false,
  },
  licitaciones_interno: {
    label: { es: 'Análisis interno de pliegos', en: 'Internal tender analysis' },
    aiAct: { es: 'Riesgo mínimo — sin obligaciones específicas (alfabetización IA, Art. 4)', en: 'Minimal risk — no specific obligations (AI literacy, Art. 4)' },
    highRisk: false,
  },
  elegibilidad_servicios: {
    label: { es: 'Elegibilidad para prestaciones públicas', en: 'Eligibility for public benefits' },
    aiAct: { es: 'ALTO RIESGO — Anexo III, punto 5.a', en: 'HIGH RISK — Annex III, point 5(a)' },
    highRisk: true,
  },
  scoring_credito: {
    label: { es: 'Solvencia / scoring de crédito', en: 'Creditworthiness / credit scoring' },
    aiAct: { es: 'ALTO RIESGO — Anexo III, punto 5.b', en: 'HIGH RISK — Annex III, point 5(b)' },
    highRisk: true,
  },
};

export function useCases(lang: Lang): Record<UseCase, { label: string; aiAct: string; highRisk: boolean }> {
  return Object.fromEntries(
    Object.entries(USE_CASES_I18N).map(([k, v]) => [k, { label: tr(v.label, lang), aiAct: tr(v.aiAct, lang), highRisk: v.highRisk }]),
  ) as Record<UseCase, { label: string; aiAct: string; highRisk: boolean }>;
}

/** Compatibilidad: catálogo en español. */
export const USE_CASES = useCases('es');

const TIERS: RiskTier[] = ['Bajo', 'Moderado', 'Alto', 'Crítico'];

export function tierFromScore(score: number): RiskTier {
  if (score >= 10) return 'Crítico';
  if (score >= 7) return 'Alto';
  if (score >= 4) return 'Moderado';
  return 'Bajo';
}

export const TIER_LABEL: Record<Lang, Record<RiskTier, string>> = {
  es: { Bajo: 'Bajo', Moderado: 'Moderado', Alto: 'Alto', Crítico: 'Crítico' },
  en: { Bajo: 'Low', Moderado: 'Moderate', Alto: 'High', Crítico: 'Critical' },
};

/** Riesgo base de la matriz autonomía × sensibilidad (sin controles). */
export function baseCellScore(a: AutonomyLevel, d: DataSensitivity): number {
  return AUTONOMY_POINTS[a] + SENSITIVITY_POINTS[d] + (a === 'autonomo' && d === 'pii_financiero' ? 2 : 0);
}

const AUTONOMY_LABEL: Record<AutonomyLevel, T> = {
  asistido: { es: 'asistido', en: 'assisted' },
  semiautonomo: { es: 'semiautónomo', en: 'semi-autonomous' },
  autonomo: { es: 'autónomo', en: 'autonomous' },
};
const DATA_LABEL: Record<DataSensitivity, T> = {
  publico: { es: 'público', en: 'public' },
  interno: { es: 'interno', en: 'internal' },
  pii_financiero: { es: 'PII + financiero', en: 'PII + financial' },
};

export function assessRisk(g: GovernanceControls, lang: Lang = 'es'): RiskAssessment {
  const drivers: { label: string; points: number }[] = [];
  const add = (label: T, points: number) => points !== 0 && drivers.push({ label: tr(label, lang), points });

  add({ es: `Autonomía: ${AUTONOMY_LABEL[g.autonomyLevel].es}`, en: `Autonomy: ${AUTONOMY_LABEL[g.autonomyLevel].en}` }, AUTONOMY_POINTS[g.autonomyLevel]);
  add({ es: `Datos: ${DATA_LABEL[g.dataSensitivity].es}`, en: `Data: ${DATA_LABEL[g.dataSensitivity].en}` }, SENSITIVITY_POINTS[g.dataSensitivity]);
  if (g.autonomyLevel === 'autonomo' && g.dataSensitivity === 'pii_financiero') {
    add({ es: 'Autonomía total sobre datos financieros', en: 'Full autonomy over financial data' }, 2);
  }
  if (!g.hitlEnabled) add({ es: 'Sin supervisión humana (HITL)', en: 'No human oversight (HITL)' }, g.autonomyLevel === 'asistido' ? 1 : 3);
  if (!g.auditLoggingEnabled) add({ es: 'Sin registro de auditoría', en: 'No audit logging' }, 2);
  if (!g.piiRedactionEnabled) {
    add({ es: 'Sin redacción de PII', en: 'No PII redaction' }, g.dataSensitivity === 'pii_financiero' ? 3 : g.dataSensitivity === 'interno' ? 1 : 0);
  }
  const uc = USE_CASES_I18N[g.useCase];
  if (uc.highRisk) add({ es: 'Caso de uso de alto riesgo (Anexo III)', en: 'High-risk use case (Annex III)' }, 3);

  const score = drivers.reduce((s, d) => s + d.points, 0);
  let tier = tierFromScore(score);
  let floorReason: string | undefined;
  if (uc.highRisk && TIERS.indexOf(tier) < TIERS.indexOf('Alto')) {
    tier = 'Alto';
    floorReason = tr(
      {
        es: 'El caso de uso es de alto riesgo por ley (Anexo III): los controles reducen la exposición, no la categoría.',
        en: 'The use case is high risk by law (Annex III): controls reduce exposure, not the category.',
      },
      lang,
    );
  }

  return { tier, score, drivers, aiActCategory: tr(uc.aiAct, lang), floorReason, controls: requiredControls(g, lang) };
}

export function requiredControls(g: GovernanceControls, lang: Lang = 'es'): RequiredControl[] {
  const c: RequiredControl[] = [];
  const uc = USE_CASES_I18N[g.useCase];
  const pii = g.dataSensitivity === 'pii_financiero';
  const add = (id: string, title: T, refs: string[], why: T, blocking: boolean) =>
    c.push({ id, title: tr(title, lang), refs, why: tr(why, lang), blocking });

  if (!g.hitlEnabled && g.autonomyLevel !== 'asistido') {
    add('hitl',
      { es: 'Activar supervisión humana con umbrales de riesgo/importe', en: 'Enable human oversight with risk/amount thresholds' },
      ['EU AI Act Art. 14', lang === 'en' ? 'GDPR Art. 22' : 'RGPD Art. 22', 'ISO/IEC 42001'],
      { es: 'Un agente que actúa solo convierte cada error del modelo en un hecho consumado.', en: 'An agent acting alone turns every model error into a done deal.' },
      true);
  }
  if (!g.auditLoggingEnabled) {
    add('audit',
      { es: 'Registro de auditoría inmutable de entradas, decisiones y aprobaciones', en: 'Immutable audit log of inputs, decisions and approvals' },
      ['ISO 27001 A.8.15', 'EU AI Act Art. 12', 'ENS op.exp.8'],
      { es: 'Sin traza no se puede investigar un incidente ni demostrar diligencia.', en: 'Without a trace you cannot investigate an incident or prove due diligence.' },
      true);
  }
  if (!g.piiRedactionEnabled && g.dataSensitivity !== 'publico') {
    add('pii',
      { es: 'Redacción/tokenización de PII antes de cualquier inferencia externa', en: 'PII redaction/tokenisation before any external inference' },
      [lang === 'en' ? 'GDPR Art. 5(1)(c)' : 'RGPD Art. 5.1.c', lang === 'en' ? 'GDPR Art. 32' : 'RGPD Art. 32', 'ISO 27001 A.8.11', 'OWASP LLM02:2025'],
      { es: 'Lo que llega al proveedor del modelo ya no está bajo tu control.', en: 'Whatever reaches the model provider is no longer under your control.' },
      pii);
  }
  if (g.autonomyLevel !== 'asistido') {
    add('scope',
      { es: 'Mínimo privilegio en herramientas: alcance ligado a la identidad de sesión', en: 'Least-privilege tools: scope bound to session identity' },
      ['OWASP LLM06:2025', 'ISO 27001 A.5.15', 'ENS op.acc.4'],
      { es: 'El control que de verdad para una inyección es que el agente no pueda pedir lo que no le corresponde.', en: 'What really stops an injection is that the agent cannot request what it is not entitled to.' },
      true);
    add('redteam',
      { es: 'Pruebas adversariales (prompt injection, jailbreak, fuga de datos) antes de producción', en: 'Adversarial testing (prompt injection, jailbreak, data leakage) before production' },
      ['OWASP LLM01:2025', 'ISO/IEC 42001', 'EU AI Act Art. 15'],
      { es: 'Si no lo ataca tu equipo, lo atacará un cliente.', en: 'If your team does not attack it, a customer will.' },
      pii || uc.highRisk);
  }
  if (pii) {
    add('dpia',
      { es: 'Evaluación de impacto de protección de datos (EIPD)', en: 'Data protection impact assessment (DPIA)' },
      [lang === 'en' ? 'GDPR Art. 35' : 'RGPD Art. 35'],
      { es: 'Tratamiento a gran escala de datos financieros con tecnología nueva.', en: 'Large-scale processing of financial data with new technology.' },
      true);
  }
  if (g.useCase === 'atencion_cliente') {
    add('transparency',
      { es: 'Informar al usuario de que interactúa con un sistema de IA', en: 'Inform users that they are interacting with an AI system' },
      ['EU AI Act Art. 50'],
      { es: 'Obligación directa y barata de cumplir; su ausencia es fácil de detectar.', en: 'A direct, cheap obligation; its absence is easy to spot.' },
      true);
  }
  if (uc.highRisk) {
    add('rms',
      { es: 'Sistema de gestión de riesgos y documentación técnica del sistema de IA', en: 'Risk management system and technical documentation of the AI system' },
      ['EU AI Act Art. 9', 'EU AI Act Art. 11', 'ISO/IEC 42001'],
      { es: 'Requisito de alto riesgo: sin él no se puede poner en servicio.', en: 'A high-risk requirement: without it the system cannot be put into service.' },
      true);
    add('data_gov',
      { es: 'Gobernanza de datos: calidad, sesgos y representatividad', en: 'Data governance: quality, bias and representativeness' },
      ['EU AI Act Art. 10'],
      { es: 'Decidir sobre prestaciones con datos sesgados es discriminación automatizada.', en: 'Deciding on benefits with biased data is automated discrimination.' },
      true);
    add('fria',
      { es: 'Evaluación de impacto en derechos fundamentales (si el desplegador es organismo público o presta servicios públicos)', en: 'Fundamental rights impact assessment (if the deployer is a public body or provides public services)' },
      ['EU AI Act Art. 27'],
      { es: 'Obligación del desplegador antes del primer uso.', en: 'A deployer obligation before first use.' },
      true);
  }
  add('literacy',
    { es: 'Formación en IA del personal que opera y supervisa el sistema', en: 'AI literacy training for staff who operate and oversee the system' },
    ['EU AI Act Art. 4'],
    { es: 'Aplicable desde febrero de 2025 a proveedores y desplegadores.', en: 'Applies to providers and deployers since February 2025.' },
    false);
  return c.sort((a, b) => Number(b.blocking) - Number(a.blocking));
}
