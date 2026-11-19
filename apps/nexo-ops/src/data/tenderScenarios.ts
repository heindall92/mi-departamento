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
  { id: 'dpo', label: 'DPO / equipo de privacidad (EIPD, Art. 28)' },
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
