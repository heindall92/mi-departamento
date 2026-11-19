import type { Capability, CapabilityId, TenderScenario, TenderWeights } from '../types/domain';

/**
 * Pliegos FICTICIOS redactados con el estilo y la estructura habituales de los
 * PCAP/PPT españoles (LCSP 9/2017). Ninguna entidad ni expediente es real.
 */

export const CAPABILITIES: Capability[] = [
  { id: 'crm_integration', label: 'Experiencia acreditada en integración CRM (Dynamics / Salesforce)' },
  { id: 'iso27001', label: 'Certificación ISO/IEC 27001 vigente' },
  { id: 'ens_media', label: 'Certificación ENS categoría MEDIA' },
  { id: 'ens_alta', label: 'Certificación ENS categoría ALTA' },
  { id: 'eu_hosting', label: 'Alojamiento e inferencia con residencia de datos en la UE' },
  { id: 'dpo', label: 'DPO / equipo de privacidad (EIPD Art. 35 · encargo Art. 28)' },
  { id: 'accessibility', label: 'Equipo de accesibilidad (WCAG 2.1 AA / UNE-EN 301549)' },
  { id: 'iso42001', label: 'Sistema de gestión de IA ISO/IEC 42001' },
  { id: 'ai_act_conformity', label: 'Metodología de conformidad EU AI Act (alto riesgo)' },
  { id: 'soc24x7', label: 'SOC 24x7 propio o contratado' },
];

/** Capacidades de partida de una consultora media (editable en vivo). */
export const DEFAULT_CAPABILITIES: Record<CapabilityId, boolean> = {
  crm_integration: true,
  iso27001: true,
  ens_media: true,
  ens_alta: false,
  eu_hosting: true,
  dpo: true,
  accessibility: true,
  iso42001: false,
  ai_act_conformity: false,
  soc24x7: false,
};

export const DEFAULT_WEIGHTS: TenderWeights = { technicalFit: 35, compliance: 30, deadline: 20, contractual: 15 };
export const DEFAULT_TEAM_FTE = 3;

const TEXT_A = `PLIEGO DE PRESCRIPCIONES TÉCNICAS — Expediente CX-2026/014 (ficticio)
Servicio de transformación de la atención al cliente omnicanal con automatización para Aguas del Litoral, E.P.E. (entidad ficticia).
Presupuesto base de licitación: 480.000 euros (IVA excluido). Plazo de ejecución: 6 meses desde la formalización.
1. Solvencia técnica: se exigirá haber ejecutado al menos dos proyectos de implantación de CRM omnicanal en los últimos tres años, requisito excluyente.
2. El licitador deberá acreditar la certificación de conformidad con el Esquema Nacional de Seguridad (RD 311/2022) en categoría MEDIA, requisito obligatorio.
3. Se integrará el CRM existente (Microsoft Dynamics 365) con los canales correo electrónico, WhatsApp Business y chat web.
4. Se implantará un asistente de autoservicio con traspaso a agente humano cuando el ciudadano lo solicite.
5. Los interfaces cumplirán los requisitos de accesibilidad WCAG 2.1 AA conforme a UNE-EN 301549.
6. El adjudicatario actuará como encargado del tratamiento (art. 28 RGPD) y colaborará en la evaluación de impacto (EIPD).
7. Los datos se alojarán en centros de proceso ubicados en el Espacio Económico Europeo; no se permiten transferencias internacionales.
8. El sistema informará al usuario de que interactúa con un sistema de inteligencia artificial.
9. Penalización por demora: 0,5 % del precio por semana de retraso en la puesta en producción, hasta un máximo del 10 %.
10. SLA de resolución de incidencias críticas en 4 horas; su incumplimiento conllevará una penalización del 2 % de la facturación mensual.
11. Las licencias de Dynamics 365 serán aportadas por la entidad; la integración con el proveedor de telefonía actual depende de su API.
12. La subcontratación no podrá superar el 30 % del importe de adjudicación.`;

const TEXT_B = `PLIEGO DE PRESCRIPCIONES TÉCNICAS — Expediente IA-2026/007 (ficticio)
Integración de agentes de IA en la atención al ciudadano y la tramitación de ayudas sociales de la Agencia Autonómica de Servicios Sociales (entidad ficticia).
Presupuesto base de licitación: 1.200.000 euros (IVA excluido). Plazo de ejecución: 9 meses, con piloto operativo a los 3 meses.
1. Se exigirá certificación del Esquema Nacional de Seguridad en categoría ALTA, requisito excluyente.
2. El licitador deberá acreditar certificación ISO/IEC 27001 vigente, requisito obligatorio.
3. Residencia de datos e inferencia: todos los datos y el procesamiento de los modelos se realizarán en territorio de la Unión Europea, requisito excluyente.
4. El sistema evalúa la elegibilidad para prestaciones públicas y se considera de alto riesgo (Reglamento (UE) 2024/1689, Anexo III.5.a): el adjudicatario aportará documentación técnica, gestión de riesgos (art. 9), registros automáticos (art. 12) y supervisión humana (art. 14).
5. El adjudicatario dispondrá de un sistema de gestión de IA conforme a ISO/IEC 42001 o un plan de certificación en 12 meses.
6. Se realizará una EIPD y no se adoptarán decisiones basadas únicamente en el tratamiento automatizado (art. 22 RGPD) sin intervención humana.
7. Disponibilidad mínima del 99,9 %; penalización del 1 % de la facturación por día de incumplimiento, hasta un máximo del 20 %.
8. Hitos: piloto en 3 meses y producción en 9 meses; el retraso en el piloto podrá ser causa de resolución del contrato.
9. Integración con la plataforma de tramitación electrónica y con Cl@ve para la identificación del ciudadano.
10. Monitorización de seguridad 24x7 (SOC) con respuesta a incidentes en menos de 1 hora.
11. Accesibilidad WCAG 2.1 AA, lenguaje claro y soporte de lenguas cooficiales.
12. El licitador garantizará la continuidad del proveedor del modelo de IA de propósito general y la portabilidad a un modelo alternativo.
13. Colaboración en la evaluación de impacto en los derechos fundamentales (art. 27 del Reglamento de IA).`;

export const TENDER_SCENARIOS: TenderScenario[] = [
  {
    id: 'cx_omnicanal',
    title: 'A · Transformación CX/CRM omnicanal con automatización',
    sector: 'Utilities / servicio público empresarial',
    deadlineDays: 180,
    budgetEur: 480_000,
    estimatedEffortDays: { discovery: 20, build: 85, securityQA: 25, rollout: 20 },
    sourceText: TEXT_A,
    clauses: [
      { id: 'A1', category: 'excluyente', summary: 'Solvencia: 2 proyectos de CRM omnicanal en los últimos 3 años', riskLevel: 'Alto', metByTeam: true, requires: 'crm_integration', evidence: 'al menos dos proyectos de implantación de CRM omnicanal en los últimos tres años, requisito excluyente', business: 'Sin acreditarlo, la oferta se excluye en la apertura del sobre.' },
      { id: 'A2', category: 'excluyente', framework: 'ENS', summary: 'Certificación ENS categoría MEDIA del licitador', riskLevel: 'Alto', metByTeam: true, requires: 'ens_media', evidence: 'certificación de conformidad con el Esquema Nacional de Seguridad (RD 311/2022) en categoría MEDIA', business: 'Sin certificado, la oferta no es admisible: no hay forma de compensarlo con precio.' },
      { id: 'A3', category: 'plazo', summary: 'Puesta en producción en 6 meses; 0,5 %/semana de retraso (máx. 10 %)', riskLevel: 'Medio', metByTeam: true, penaltyPct: 10, evidence: '0,5 % del precio por semana de retraso en la puesta en producción, hasta un máximo del 10 %', business: 'Cada semana de retraso cuesta 2.400 €; el máximo son 48.000 € de margen.' },
      { id: 'A4', category: 'plazo', summary: 'SLA incidencias críticas 4 h; 2 % de la factura mensual si se incumple', riskLevel: 'Medio', metByTeam: true, penaltyPct: 2, evidence: 'SLA de resolución de incidencias críticas en 4 horas', business: 'Exige guardia operativa; si no existe, la penalización es recurrente.' },
      { id: 'A5', category: 'tecnico', summary: 'Integración Dynamics 365 + email, WhatsApp Business y chat web', riskLevel: 'Medio', metByTeam: true, requires: 'crm_integration', evidence: 'Se integrará el CRM existente (Microsoft Dynamics 365)', business: 'Es el núcleo del proyecto: el 55 % del esfuerzo.' },
      { id: 'A6', category: 'tecnico', summary: 'Asistente de autoservicio con traspaso a agente humano', riskLevel: 'Medio', metByTeam: true, evidence: 'asistente de autoservicio con traspaso a agente humano', business: 'Diferencial de la oferta si se demuestra con guardrails (Módulo 1).' },
      { id: 'A7', category: 'tecnico', summary: 'Accesibilidad WCAG 2.1 AA (UNE-EN 301549)', riskLevel: 'Medio', metByTeam: true, requires: 'accessibility', evidence: 'accesibilidad WCAG 2.1 AA conforme a UNE-EN 301549', business: 'Requisito legal en sector público (RD 1112/2018).' },
      { id: 'A8', category: 'cumplimiento', framework: 'RGPD', summary: 'Encargado del tratamiento (Art. 28) + colaboración en EIPD', riskLevel: 'Medio', metByTeam: true, requires: 'dpo', evidence: 'actuará como encargado del tratamiento (art. 28 RGPD)', business: 'Responsabilidad solidaria ante una brecha si el contrato de encargo es débil.' },
      { id: 'A9', category: 'cumplimiento', framework: 'RGPD', summary: 'Datos en el EEE; prohibidas transferencias internacionales', riskLevel: 'Alto', metByTeam: true, requires: 'eu_hosting', evidence: 'no se permiten transferencias internacionales', business: 'Descarta APIs de LLM sin región UE garantizada. Cláusula oculta clave.' },
      { id: 'A10', category: 'cumplimiento', framework: 'EU AI Act', summary: 'Transparencia: informar de que se interactúa con IA (Art. 50)', riskLevel: 'Bajo', metByTeam: true, evidence: 'informará al usuario de que interactúa con un sistema de inteligencia artificial', business: 'Bajo coste, pero su ausencia es incumplimiento directo del Reglamento de IA.' },
      { id: 'A11', category: 'dependencia', summary: 'Licencias Dynamics del cliente; telefonía depende de la API del proveedor actual', riskLevel: 'Medio', metByTeam: false, evidence: 'la integración con el proveedor de telefonía actual depende de su API', business: 'Riesgo de plazo fuera de nuestro control: hay que acotarlo en la oferta.' },
      { id: 'A12', category: 'dependencia', summary: 'Subcontratación máxima del 30 %', riskLevel: 'Bajo', metByTeam: true, evidence: 'La subcontratación no podrá superar el 30 %', business: 'Limita apoyarse en partners para perfiles que no tengamos.' },
    ],
    proposalOutline: [
      'Resumen ejecutivo y comprensión del reto',
      'Arquitectura objetivo omnicanal (Dynamics 365 + canales)',
      'Plan de automatización con guardrails y HITL',
      'Plan de seguridad ENS MEDIA y protección de datos',
      'Metodología, plan de trabajo e hitos (6 meses)',
      'Modelo de servicio y SLA (incidencias críticas 4 h)',
      'Equipo, perfiles y dedicación',
      'Gestión de riesgos y dependencias',
    ],
  },
  {
    id: 'ia_regulada',
    title: 'B · IA agéntica en atención al ciudadano regulado',
    sector: 'Administración autonómica / servicios sociales',
    deadlineDays: 270,
    budgetEur: 1_200_000,
    estimatedEffortDays: { discovery: 35, build: 160, securityQA: 70, rollout: 35 },
    sourceText: TEXT_B,
    clauses: [
      { id: 'B1', category: 'excluyente', framework: 'ENS', summary: 'Certificación ENS categoría ALTA', riskLevel: 'Alto', metByTeam: false, requires: 'ens_alta', evidence: 'certificación del Esquema Nacional de Seguridad en categoría ALTA, requisito excluyente', business: 'Obtenerla lleva meses: si no se tiene hoy, la licitación está perdida.' },
      { id: 'B2', category: 'excluyente', framework: 'ISO 27001', summary: 'ISO/IEC 27001 vigente del licitador', riskLevel: 'Alto', metByTeam: true, requires: 'iso27001', evidence: 'certificación ISO/IEC 27001 vigente, requisito obligatorio', business: 'Filtro de admisión.' },
      { id: 'B3', category: 'excluyente', framework: 'RGPD', summary: 'Residencia de datos e inferencia en la UE', riskLevel: 'Alto', metByTeam: true, requires: 'eu_hosting', evidence: 'todos los datos y el procesamiento de los modelos se realizarán en territorio de la Unión Europea', business: 'Condiciona qué modelos y proveedores se pueden ofertar.' },
      { id: 'B4', category: 'cumplimiento', framework: 'EU AI Act', summary: 'Sistema de alto riesgo (Anexo III.5.a): Arts. 9, 12 y 14', riskLevel: 'Alto', metByTeam: false, requires: 'ai_act_conformity', evidence: 'se considera de alto riesgo (Reglamento (UE) 2024/1689, Anexo III.5.a)', business: 'Documentación, gestión de riesgos y supervisión humana auditables: es medio proyecto en sí mismo.' },
      { id: 'B5', category: 'cumplimiento', framework: 'ISO 42001', summary: 'SGIA ISO/IEC 42001 o plan de certificación en 12 meses', riskLevel: 'Medio', metByTeam: false, requires: 'iso42001', evidence: 'sistema de gestión de IA conforme a ISO/IEC 42001 o un plan de certificación en 12 meses', business: 'Admite plan: se puede ofertar con hoja de ruta creíble.' },
      { id: 'B6', category: 'cumplimiento', framework: 'RGPD', summary: 'EIPD + sin decisiones únicamente automatizadas (Art. 22)', riskLevel: 'Alto', metByTeam: true, requires: 'dpo', evidence: 'no se adoptarán decisiones basadas únicamente en el tratamiento automatizado (art. 22 RGPD)', business: 'Obliga a diseñar HITL real, no decorativo.' },
      { id: 'B7', category: 'plazo', summary: 'Disponibilidad 99,9 %; 1 %/día de incumplimiento (máx. 20 %)', riskLevel: 'Alto', metByTeam: true, penaltyPct: 20, evidence: 'penalización del 1 % de la facturación por día de incumplimiento, hasta un máximo del 20 %', business: 'Hasta 240.000 € en riesgo: exige arquitectura de alta disponibilidad.' },
      { id: 'B8', category: 'plazo', summary: 'Piloto a 3 meses (causa de resolución) y producción a 9', riskLevel: 'Alto', metByTeam: true, evidence: 'el retraso en el piloto podrá ser causa de resolución del contrato', business: 'Un retraso no se paga con penalización: se pierde el contrato.' },
      { id: 'B9', category: 'tecnico', summary: 'Integración con tramitación electrónica y Cl@ve', riskLevel: 'Medio', metByTeam: true, requires: 'crm_integration', evidence: 'Integración con la plataforma de tramitación electrónica y con Cl@ve', business: 'Integración conocida, pero con calendario de la administración.' },
      { id: 'B10', category: 'tecnico', summary: 'SOC 24x7 con respuesta a incidentes < 1 h', riskLevel: 'Alto', metByTeam: false, requires: 'soc24x7', evidence: 'Monitorización de seguridad 24x7 (SOC) con respuesta a incidentes en menos de 1 hora', business: 'Si no hay SOC propio, hay que subcontratarlo dentro del 30 % permitido.' },
      { id: 'B11', category: 'tecnico', summary: 'Accesibilidad, lenguaje claro y lenguas cooficiales', riskLevel: 'Medio', metByTeam: true, requires: 'accessibility', evidence: 'Accesibilidad WCAG 2.1 AA, lenguaje claro y soporte de lenguas cooficiales', business: 'Impacta en el diseño de prompts y en las pruebas.' },
      { id: 'B12', category: 'dependencia', summary: 'Continuidad del proveedor GPAI y portabilidad de modelo', riskLevel: 'Medio', metByTeam: false, evidence: 'garantizará la continuidad del proveedor del modelo de IA de propósito general y la portabilidad', business: 'Exige arquitectura agnóstica de modelo; sin ella, dependencia crítica de un tercero.' },
      { id: 'B13', category: 'cumplimiento', framework: 'EU AI Act', summary: 'Colaboración en la FRIA (Art. 27 Reglamento de IA)', riskLevel: 'Medio', metByTeam: false, requires: 'ai_act_conformity', evidence: 'evaluación de impacto en los derechos fundamentales (art. 27 del Reglamento de IA)', business: 'Trabajo jurídico-técnico que debe presupuestarse explícitamente.' },
    ],
    proposalOutline: [
      'Resumen ejecutivo y enfoque de IA responsable',
      'Arquitectura agnóstica de modelo con residencia UE',
      'Plan de conformidad EU AI Act (alto riesgo): Arts. 9-15 y 27',
      'Diseño de supervisión humana (Art. 14 AI Act · Art. 22 RGPD)',
      'Seguridad ENS ALTA, ISO 27001 y operación SOC 24x7',
      'Plan de piloto a 3 meses con criterios de salida',
      'Alta disponibilidad 99,9 % y continuidad',
      'Equipo, perfiles y dedicación',
      'Hoja de ruta ISO/IEC 42001',
    ],
  },
];

/* ───────────────────────── Inglés ─────────────────────────
   Capa de textos: ids, riesgos, penalizaciones y capacidades salen del objeto español. */

const CAPS_EN: Record<CapabilityId, string> = {
  crm_integration: 'Proven CRM integration experience (Dynamics / Salesforce)',
  iso27001: 'Current ISO/IEC 27001 certification',
  ens_media: 'ENS (Spanish National Security Framework) certification, MEDIUM category',
  ens_alta: 'ENS certification, HIGH category',
  eu_hosting: 'Hosting and inference with EU data residency',
  dpo: 'DPO / privacy team (DPIA Art. 35 · processor Art. 28)',
  accessibility: 'Accessibility team (WCAG 2.1 AA / EN 301 549)',
  iso42001: 'ISO/IEC 42001 AI management system',
  ai_act_conformity: 'EU AI Act conformity methodology (high risk)',
  soc24x7: '24/7 SOC, in-house or contracted',
};

export function capabilities(lang: 'es' | 'en'): Capability[] {
  return lang === 'en' ? CAPABILITIES.map((c) => ({ ...c, label: CAPS_EN[c.id] })) : CAPABILITIES;
}

const TEXT_A_EN = `TECHNICAL SPECIFICATIONS — File CX-2026/014 (fictitious)
Omnichannel customer service transformation with automation for Aguas del Litoral, a public business entity (fictitious).
Tender budget: 480,000 euros (VAT excluded). Execution period: 6 months from contract signature.
1. Technical solvency: at least two omnichannel CRM implementation projects in the last three years shall be required, an exclusionary requirement.
2. The bidder must prove certification of conformity with the National Security Framework (ENS, RD 311/2022) in the MEDIUM category, a mandatory requirement.
3. The existing CRM (Microsoft Dynamics 365) will be integrated with the email, WhatsApp Business and web chat channels.
4. A self-service assistant will be deployed with hand-over to a human agent when the citizen requests it.
5. Interfaces will meet WCAG 2.1 AA accessibility requirements in accordance with EN 301 549.
6. The contractor will act as data processor (GDPR Art. 28) and will collaborate on the data protection impact assessment (DPIA).
7. Data will be hosted in data centres located in the European Economic Area; international transfers are not permitted.
8. The system will inform the user that they are interacting with an artificial intelligence system.
9. Delay penalty: 0.5% of the price per week of delay in going live, up to a maximum of 10%.
10. Critical incident resolution SLA of 4 hours; failure to meet it carries a penalty of 2% of monthly billing.
11. Dynamics 365 licences will be provided by the entity; integration with the current telephony provider depends on its API.
12. Subcontracting may not exceed 30% of the award amount.`;

const TEXT_B_EN = `TECHNICAL SPECIFICATIONS — File IA-2026/007 (fictitious)
Integration of AI agents into citizen services and social benefit processing for the Regional Social Services Agency (fictitious).
Tender budget: 1,200,000 euros (VAT excluded). Execution period: 9 months, with an operational pilot at 3 months.
1. Certification under the National Security Framework (ENS) in the HIGH category shall be required, an exclusionary requirement.
2. The bidder must prove a current ISO/IEC 27001 certification, a mandatory requirement.
3. Data and inference residency: all data and model processing will take place within the European Union, an exclusionary requirement.
4. The system assesses eligibility for public benefits and is considered high risk (Regulation (EU) 2024/1689, Annex III.5.a): the contractor will provide technical documentation, risk management (Art. 9), automatic logging (Art. 12) and human oversight (Art. 14).
5. The contractor will have an AI management system compliant with ISO/IEC 42001 or a certification plan within 12 months.
6. A DPIA will be carried out and no decisions based solely on automated processing (GDPR Art. 22) will be taken without human intervention.
7. Minimum availability of 99.9%; penalty of 1% of billing per day of non-compliance, up to a maximum of 20%.
8. Milestones: pilot at 3 months and production at 9 months; delay of the pilot may be grounds for termination of the contract.
9. Integration with the electronic processing platform and with Cl@ve for citizen identification.
10. 24/7 security monitoring (SOC) with incident response in under 1 hour.
11. WCAG 2.1 AA accessibility, plain language and support for co-official languages.
12. The bidder will guarantee the continuity of the general-purpose AI model provider and portability to an alternative model.
13. Collaboration on the fundamental rights impact assessment (Art. 27 of the AI Act).`;

type ClauseText = { summary: string; business: string; evidence: string };
const CLAUSES_EN: Record<string, ClauseText> = {
  A1: { summary: 'Solvency: 2 omnichannel CRM projects in the last 3 years', business: 'Without proof, the bid is excluded when the envelope is opened.', evidence: 'at least two omnichannel CRM implementation projects in the last three years shall be required, an exclusionary requirement' },
  A2: { summary: 'Bidder’s ENS certification, MEDIUM category', business: 'Without the certificate the bid is inadmissible: price cannot make up for it.', evidence: 'certification of conformity with the National Security Framework (ENS, RD 311/2022) in the MEDIUM category' },
  A3: { summary: 'Go-live in 6 months; 0.5%/week of delay (max. 10%)', business: 'Each week of delay costs €2,400; the maximum is €48,000 of margin.', evidence: '0.5% of the price per week of delay in going live, up to a maximum of 10%' },
  A4: { summary: '4 h critical incident SLA; 2% of monthly invoice if missed', business: 'Requires an on-call rota; without one, the penalty recurs.', evidence: 'Critical incident resolution SLA of 4 hours' },
  A5: { summary: 'Dynamics 365 integration + email, WhatsApp Business and web chat', business: 'This is the core of the project: 55% of the effort.', evidence: 'The existing CRM (Microsoft Dynamics 365) will be integrated' },
  A6: { summary: 'Self-service assistant with hand-over to a human agent', business: 'A differentiator if demonstrated with guardrails (Module 1).', evidence: 'self-service assistant will be deployed with hand-over to a human agent' },
  A7: { summary: 'WCAG 2.1 AA accessibility (EN 301 549)', business: 'A legal requirement in the Spanish public sector (RD 1112/2018).', evidence: 'WCAG 2.1 AA accessibility requirements in accordance with EN 301 549' },
  A8: { summary: 'Data processor (Art. 28) + DPIA collaboration', business: 'Joint liability in a breach if the processing agreement is weak.', evidence: 'will act as data processor (GDPR Art. 28)' },
  A9: { summary: 'Data in the EEA; international transfers prohibited', business: 'Rules out LLM APIs without a guaranteed EU region. A key hidden clause.', evidence: 'international transfers are not permitted' },
  A10: { summary: 'Transparency: disclose that users interact with AI (Art. 50)', business: 'Cheap to meet, but its absence is a direct breach of the AI Act.', evidence: 'will inform the user that they are interacting with an artificial intelligence system' },
  A11: { summary: 'Client’s Dynamics licences; telephony depends on current provider’s API', business: 'Schedule risk outside our control: it must be bounded in the bid.', evidence: 'integration with the current telephony provider depends on its API' },
  A12: { summary: 'Maximum 30% subcontracting', business: 'Limits relying on partners for profiles we do not have.', evidence: 'Subcontracting may not exceed 30%' },
  B1: { summary: 'ENS certification, HIGH category', business: 'Getting it takes months: if you do not have it today, the tender is lost.', evidence: 'National Security Framework (ENS) in the HIGH category shall be required, an exclusionary requirement' },
  B2: { summary: 'Bidder’s current ISO/IEC 27001', business: 'Admission filter.', evidence: 'current ISO/IEC 27001 certification, a mandatory requirement' },
  B3: { summary: 'Data and inference residency in the EU', business: 'Determines which models and providers can be offered.', evidence: 'all data and model processing will take place within the European Union' },
  B4: { summary: 'High-risk system (Annex III.5.a): Arts. 9, 12 and 14', business: 'Auditable documentation, risk management and human oversight: half a project in itself.', evidence: 'is considered high risk (Regulation (EU) 2024/1689, Annex III.5.a)' },
  B5: { summary: 'ISO/IEC 42001 AIMS or certification plan within 12 months', business: 'A plan is accepted: it can be bid with a credible roadmap.', evidence: 'AI management system compliant with ISO/IEC 42001 or a certification plan within 12 months' },
  B6: { summary: 'DPIA + no solely automated decisions (Art. 22)', business: 'Forces real HITL design, not decorative.', evidence: 'no decisions based solely on automated processing (GDPR Art. 22)' },
  B7: { summary: '99.9% availability; 1%/day of non-compliance (max. 20%)', business: 'Up to €240,000 at risk: requires a high-availability architecture.', evidence: 'penalty of 1% of billing per day of non-compliance, up to a maximum of 20%' },
  B8: { summary: 'Pilot at 3 months (termination ground) and production at 9', business: 'A delay is not paid with a penalty: you lose the contract.', evidence: 'delay of the pilot may be grounds for termination of the contract' },
  B9: { summary: 'Integration with e-processing platform and Cl@ve', business: 'A known integration, but on the administration’s timetable.', evidence: 'Integration with the electronic processing platform and with Cl@ve' },
  B10: { summary: '24/7 SOC with incident response < 1 h', business: 'Without an in-house SOC it must be subcontracted within the 30% allowed.', evidence: '24/7 security monitoring (SOC) with incident response in under 1 hour' },
  B11: { summary: 'Accessibility, plain language and co-official languages', business: 'Affects prompt design and testing.', evidence: 'WCAG 2.1 AA accessibility, plain language and support for co-official languages' },
  B12: { summary: 'GPAI provider continuity and model portability', business: 'Requires a model-agnostic architecture; otherwise, critical dependency on a third party.', evidence: 'continuity of the general-purpose AI model provider and portability' },
  B13: { summary: 'Collaboration on the FRIA (AI Act Art. 27)', business: 'Legal-technical work that must be budgeted explicitly.', evidence: 'fundamental rights impact assessment (Art. 27 of the AI Act)' },
};

const SCENARIO_EN: Record<string, { title: string; sector: string; proposalOutline: string[]; sourceText: string }> = {
  cx_omnicanal: {
    title: 'A · Omnichannel CX/CRM transformation with automation',
    sector: 'Utilities / public business entity',
    sourceText: TEXT_A_EN,
    proposalOutline: [
      'Executive summary and understanding of the challenge',
      'Target omnichannel architecture (Dynamics 365 + channels)',
      'Automation plan with guardrails and HITL',
      'ENS MEDIUM security plan and data protection',
      'Methodology, work plan and milestones (6 months)',
      'Service model and SLA (4 h critical incidents)',
      'Team, profiles and allocation',
      'Risk and dependency management',
    ],
  },
  ia_regulada: {
    title: 'B · Agentic AI in regulated citizen services',
    sector: 'Regional administration / social services',
    sourceText: TEXT_B_EN,
    proposalOutline: [
      'Executive summary and responsible AI approach',
      'Model-agnostic architecture with EU residency',
      'EU AI Act conformity plan (high risk): Arts. 9-15 and 27',
      'Human oversight design (AI Act Art. 14 · GDPR Art. 22)',
      'ENS HIGH security, ISO 27001 and 24/7 SOC operations',
      '3-month pilot plan with exit criteria',
      '99.9% high availability and continuity',
      'Team, profiles and allocation',
      'ISO/IEC 42001 roadmap',
    ],
  },
};

export function tenderScenarios(lang: 'es' | 'en'): TenderScenario[] {
  if (lang === 'es') return TENDER_SCENARIOS;
  return TENDER_SCENARIOS.map((s) => ({
    ...s,
    ...SCENARIO_EN[s.id]!,
    clauses: s.clauses.map((c) => ({ ...c, ...CLAUSES_EN[c.id]! })),
  }));
}
