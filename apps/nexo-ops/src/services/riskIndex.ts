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
 */

export const AUTONOMY_POINTS: Record<AutonomyLevel, number> = { asistido: 0, semiautonomo: 2, autonomo: 4 };
export const SENSITIVITY_POINTS: Record<DataSensitivity, number> = { publico: 0, interno: 1, pii_financiero: 3 };

export const USE_CASES: Record<UseCase, { label: string; aiAct: string; highRisk: boolean }> = {
  atencion_cliente: {
    label: 'Atención al cliente (B2C)',
    aiAct: 'Riesgo limitado — obligaciones de transparencia (Art. 50)',
    highRisk: false,
  },
  licitaciones_interno: {
    label: 'Análisis interno de pliegos',
    aiAct: 'Riesgo mínimo — sin obligaciones específicas (alfabetización IA, Art. 4)',
    highRisk: false,
  },
  elegibilidad_servicios: {
    label: 'Elegibilidad para prestaciones públicas',
    aiAct: 'ALTO RIESGO — Anexo III, punto 5.a',
    highRisk: true,
  },
  scoring_credito: {
    label: 'Solvencia / scoring de crédito',
    aiAct: 'ALTO RIESGO — Anexo III, punto 5.b',
    highRisk: true,
  },
};

const TIERS: RiskTier[] = ['Bajo', 'Moderado', 'Alto', 'Crítico'];

export function tierFromScore(score: number): RiskTier {
  if (score >= 10) return 'Crítico';
  if (score >= 7) return 'Alto';
  if (score >= 4) return 'Moderado';
  return 'Bajo';
}

/** Riesgo base de la matriz autonomía × sensibilidad (sin controles). */
export function baseCellScore(a: AutonomyLevel, d: DataSensitivity): number {
  return AUTONOMY_POINTS[a] + SENSITIVITY_POINTS[d] + (a === 'autonomo' && d === 'pii_financiero' ? 2 : 0);
}

export function assessRisk(g: GovernanceControls): RiskAssessment {
  const drivers: { label: string; points: number }[] = [];
  const add = (label: string, points: number) => points !== 0 && drivers.push({ label, points });

  add(`Autonomía: ${g.autonomyLevel}`, AUTONOMY_POINTS[g.autonomyLevel]);
  add(`Datos: ${g.dataSensitivity.replace('_', ' + ')}`, SENSITIVITY_POINTS[g.dataSensitivity]);
  if (g.autonomyLevel === 'autonomo' && g.dataSensitivity === 'pii_financiero') add('Autonomía total sobre datos financieros', 2);
  if (!g.hitlEnabled) add('Sin supervisión humana (HITL)', g.autonomyLevel === 'asistido' ? 1 : 3);
  if (!g.auditLoggingEnabled) add('Sin registro de auditoría', 2);
  if (!g.piiRedactionEnabled) {
    add('Sin redacción de PII', g.dataSensitivity === 'pii_financiero' ? 3 : g.dataSensitivity === 'interno' ? 1 : 0);
  }
  const uc = USE_CASES[g.useCase];
  if (uc.highRisk) add('Caso de uso de alto riesgo (Anexo III)', 3);

  const score = drivers.reduce((s, d) => s + d.points, 0);
  let tier = tierFromScore(score);
  let floorReason: string | undefined;
  if (uc.highRisk && TIERS.indexOf(tier) < TIERS.indexOf('Alto')) {
    tier = 'Alto';
    floorReason = 'El caso de uso es de alto riesgo por ley (Anexo III): los controles reducen la exposición, no la categoría.';
  }

  return { tier, score, drivers, aiActCategory: uc.aiAct, floorReason, controls: requiredControls(g) };
}

export function requiredControls(g: GovernanceControls): RequiredControl[] {
  const c: RequiredControl[] = [];
  const uc = USE_CASES[g.useCase];
  const pii = g.dataSensitivity === 'pii_financiero';

  if (!g.hitlEnabled && g.autonomyLevel !== 'asistido') {
    c.push({
      id: 'hitl',
      title: 'Activar supervisión humana con umbrales de riesgo/importe',
      refs: ['EU AI Act Art. 14', 'RGPD Art. 22', 'ISO/IEC 42001'],
      why: 'Un agente que actúa solo convierte cada error del modelo en un hecho consumado.',
      blocking: true,
    });
  }
  if (!g.auditLoggingEnabled) {
    c.push({
      id: 'audit',
      title: 'Registro de auditoría inmutable de entradas, decisiones y aprobaciones',
      refs: ['ISO 27001 A.8.15', 'EU AI Act Art. 12', 'ENS op.exp.8'],
      why: 'Sin traza no se puede investigar un incidente ni demostrar diligencia.',
      blocking: true,
    });
  }
  if (!g.piiRedactionEnabled && g.dataSensitivity !== 'publico') {
    c.push({
      id: 'pii',
      title: 'Redacción/tokenización de PII antes de cualquier inferencia externa',
      refs: ['RGPD Art. 5.1.c', 'RGPD Art. 32', 'ISO 27001 A.8.11', 'OWASP LLM02:2025'],
      why: 'Lo que llega al proveedor del modelo ya no está bajo tu control.',
      blocking: pii,
    });
  }
  if (g.autonomyLevel !== 'asistido') {
    c.push({
      id: 'scope',
      title: 'Mínimo privilegio en herramientas: alcance ligado a la identidad de sesión',
      refs: ['OWASP LLM06:2025', 'ISO 27001 A.5.15', 'ENS op.acc.4'],
      why: 'El control que de verdad para una inyección es que el agente no pueda pedir lo que no le corresponde.',
      blocking: true,
    });
    c.push({
      id: 'redteam',
      title: 'Pruebas adversariales (prompt injection, jailbreak, fuga de datos) antes de producción',
      refs: ['OWASP LLM01:2025', 'ISO/IEC 42001', 'EU AI Act Art. 15'],
      why: 'Si no lo ataca tu equipo, lo atacará un cliente.',
      blocking: pii || uc.highRisk,
    });
  }
  if (pii) {
    c.push({
      id: 'dpia',
      title: 'Evaluación de impacto de protección de datos (EIPD)',
      refs: ['RGPD Art. 35'],
      why: 'Tratamiento a gran escala de datos financieros con tecnología nueva.',
      blocking: true,
    });
  }
  if (g.useCase === 'atencion_cliente') {
    c.push({
      id: 'transparency',
      title: 'Informar al usuario de que interactúa con un sistema de IA',
      refs: ['EU AI Act Art. 50'],
      why: 'Obligación directa y barata de cumplir; su ausencia es fácil de detectar.',
      blocking: true,
    });
  }
  if (uc.highRisk) {
    c.push(
      {
        id: 'rms',
        title: 'Sistema de gestión de riesgos y documentación técnica del sistema de IA',
        refs: ['EU AI Act Art. 9', 'EU AI Act Art. 11', 'ISO/IEC 42001'],
        why: 'Requisito de alto riesgo: sin él no se puede poner en servicio.',
        blocking: true,
      },
      {
        id: 'data_gov',
        title: 'Gobernanza de datos: calidad, sesgos y representatividad',
        refs: ['EU AI Act Art. 10'],
        why: 'Decidir sobre prestaciones con datos sesgados es discriminación automatizada.',
        blocking: true,
      },
      {
        id: 'fria',
        title: 'Evaluación de impacto en derechos fundamentales (si el desplegador es organismo público o presta servicios públicos)',
        refs: ['EU AI Act Art. 27'],
        why: 'Obligación del desplegador antes del primer uso.',
        blocking: true,
      },
    );
  }
  c.push({
    id: 'literacy',
    title: 'Formación en IA del personal que opera y supervisa el sistema',
    refs: ['EU AI Act Art. 4'],
    why: 'Aplicable desde febrero de 2025 a proveedores y desplegadores.',
    blocking: false,
  });
  return c.sort((a, b) => Number(b.blocking) - Number(a.blocking));
}
