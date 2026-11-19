import { BASE_AGENT, BASE_CASE, FLOW_STEPS, incidentById } from '../data/cxFlowScenarios';
import type {
  ChaosIncident,
  ComplianceState,
  CustomerCase,
  FlowOutcome,
  FlowRun,
  FlowStep,
  IncidentId,
  NaiveAgentBehavior,
  Stage,
  TraceEvent,
  TraceStatus,
} from '../types/domain';
import { fmtEur2 } from '../utils/format';
import { fnv1a, mulberry32 } from '../utils/prng';
import {
  DEFAULT_POLICY,
  detectInjection,
  detectPii,
  enforceCustomerScope,
  evaluateCompensation,
  redactPii,
} from './guardrails';

/**
 * Motor determinista del Módulo 1.
 * Ejecuta los guardrails REALES sobre el payload del caso y produce la traza.
 * Misma entrada → misma salida (latencias con PRNG sembrado, sin Date.now()).
 */

const BASE_LATENCY: Record<Stage, number> = {
  intake: 45,
  classifier: 640,
  crm_lookup: 90,
  resolver: 1450,
  hitl: 180_000,
  crm_close: 70,
};

export function classifyIntent(text: string): { intent: string; urgency: 'Baja' | 'Media' | 'Alta' } {
  const t = text.toLowerCase();
  let intent = 'Consulta general';
  if (/(domiciliaci|cuenta|iban)/.test(t)) intent = 'Cambio de datos bancarios';
  else if (/(sin (fibra|servicio|conexi)|ca[ií]da|aver[ií]a)/.test(t)) intent = 'Incidencia de servicio';
  else if (/(factura|cobr|cargo|recibo)/.test(t)) intent = 'Facturación';
  const urgency = /(inaceptable|urgente|me doy de baja|denuncia)/.test(t)
    ? 'Alta'
    : /(días|no puedo|duplicad)/.test(t)
      ? 'Media'
      : 'Baja';
  return { intent, urgency };
}

function outageDays(text: string): number {
  const m = /(\d+)\s*d[ií]as/.exec(text);
  return m ? Number(m[1]) : 1;
}

interface Ctx {
  guardrails: boolean;
  incident: ChaosIncident | null;
  kase: CustomerCase;
  agent: NaiveAgentBehavior;
}

export function buildCase(incident: ChaosIncident | null): { kase: CustomerCase; agent: NaiveAgentBehavior } {
  if (!incident) return { kase: BASE_CASE, agent: BASE_AGENT };
  return {
    kase: { ...BASE_CASE, channel: incident.channel, message: incident.samplePayload },
    agent: incident.naiveAgent,
  };
}

export function runFlow(incidentId: IncidentId | null, guardrails: boolean): FlowRun {
  const incident = incidentById(incidentId);
  const { kase, agent } = buildCase(incident);
  const ctx: Ctx = { guardrails, incident, kase, agent };
  const rand = mulberry32(fnv1a(`${incidentId ?? 'base'}|${guardrails}`));

  const events: TraceEvent[] = [];
  const controlsFired = new Set<string>();
  let recordsExposed = 0;
  let piiFieldsExposed = 0;
  let unauthorizedCommitmentEur = 0;
  let t = 0;

  const step = (stage: Stage): FlowStep => FLOW_STEPS.find((s) => s.stage === stage)!;
  const effect = (stage: Stage) => ctx.incident?.stageEffects[stage];

  const push = (
    stage: Stage,
    e: {
      decision: string;
      status: TraceStatus;
      compliance: ComplianceState;
      technical: string;
      business: string;
      findings?: string[];
      payloadBefore?: string;
      payloadAfter?: string;
      skipped?: boolean;
      latencyOverride?: number;
    },
  ) => {
    const s = step(stage);
    const jitter = 0.8 + rand() * 0.4;
    const latencyMs = e.skipped ? 0 : Math.round((e.latencyOverride ?? BASE_LATENCY[stage]) * jitter);
    t += latencyMs;
    events.push({
      seq: events.length + 1,
      tMs: t,
      latencyMs,
      stage,
      actor: s.actor,
      decision: e.decision,
      status: e.status,
      compliance: e.compliance,
      technical: e.technical,
      business: e.business,
      permission: guardrails ? s.permission : permissionWithoutGuardrails(stage),
      findings: e.findings ?? [],
      payloadBefore: e.payloadBefore,
      payloadAfter: e.payloadAfter,
      skipped: e.skipped,
    });
  };

  /* 1 · Recepción */
  const pii = detectPii(kase.message);
  const inj = detectInjection(kase.message);
  if (guardrails) {
    const findings = [
      ...pii.map((p) => `PII ${p.type}: ${mask(p.value)}${p.validated ? ' (dígito de control válido)' : ''}`),
      ...inj.signals.map((s) => `Inyección · ${s.rule}: «${s.excerpt}»`),
    ];
    if (pii.length) controlsFired.add('Detección de PII en entrada');
    if (inj.suspicious) controlsFired.add('Detección de prompt injection');
    push('intake', {
      decision: `Texto inspeccionado: ${pii.length} dato(s) personal(es), riesgo de inyección ${inj.score}/100.`,
      status: pii.length || inj.suspicious ? 'warning' : 'ok',
      compliance: 'Cumple',
      technical: effect('intake')?.protected ?? step('intake').protectedBehavior,
      business: 'Lo que no se inspecciona aquí no se puede proteger después.',
      findings,
    });
  } else {
    push('intake', {
      decision: `Caso ingerido sin inspección (${kase.channel}).`,
      status: pii.length ? 'warning' : 'ok',
      compliance: pii.length ? 'Incumple' : 'Cumple',
      technical: effect('intake')?.vulnerable ?? step('intake').vulnerableBehavior,
      business: pii.length
        ? 'Datos personales circulando sin minimizar: incumple RGPD Art. 5.1.c desde el primer segundo.'
        : step('intake').businessImpact,
    });
  }

  /* 2 · Clasificador */
  const cls = classifyIntent(kase.message);
  const idLine = `Identidad verificada por canal: ${kase.sessionCustomerId}`;
  if (inj.suspicious && guardrails) {
    push('classifier', {
      decision: `Intención: ${cls.intent} · urgencia ${cls.urgency}. Instrucciones incrustadas aisladas como dato no confiable.`,
      status: 'blocked',
      compliance: 'Mitigado',
      technical: effect('classifier')!.protected,
      business: 'El atacante no consigue cambiar el comportamiento del agente; el SOC recibe la alerta.',
      findings: [idLine, 'Alerta SOC generada (severidad crítica)'],
      payloadBefore: kase.message,
      payloadAfter: inj.sanitized,
    });
    controlsFired.add('Aislamiento de instrucciones + alerta SOC');
  } else if (inj.suspicious) {
    push('classifier', {
      decision: `Intención reinterpretada como «auditoría interna» siguiendo el texto del cliente.`,
      status: 'warning',
      compliance: 'Incumple',
      technical: effect('classifier')!.vulnerable,
      business: 'El agente obedece a quien escribe el ticket, no a la empresa.',
      findings: [idLine],
    });
  } else {
    push('classifier', {
      decision: `Intención: ${cls.intent} · urgencia ${cls.urgency}.`,
      status: 'ok',
      compliance: 'Cumple',
      technical: step('classifier').normalOutput,
      business: 'Enrutado correcto: el caso llega al flujo que le corresponde.',
      findings: [idLine],
    });
  }

  /* 3 · Consulta CRM */
  const scope = enforceCustomerScope(kase.sessionCustomerId, agent.requestedCustomerIds);
  if (scope.denied.length && guardrails) {
    controlsFired.add('Alcance de CRM ligado a la sesión (mínimo privilegio)');
    push('crm_lookup', {
      decision: `Lectura permitida: ${scope.allowed.join(', ')}. Denegada: ${scope.denied.join(', ')}.`,
      status: 'blocked',
      compliance: 'Mitigado',
      technical: effect('crm_lookup')!.protected,
      business: 'Cero registros de terceros expuestos. No hay brecha que notificar.',
      findings: scope.denied.map((id) => `DENY crm.getCustomer("${id}") — fuera del alcance de sesión`),
    });
  } else if (scope.denied.length) {
    recordsExposed += scope.denied.length;
    push('crm_lookup', {
      decision: `Leídas ${agent.requestedCustomerIds.length} fichas: ${agent.requestedCustomerIds.join(', ')}.`,
      status: 'leak',
      compliance: 'Incumple',
      technical: effect('crm_lookup')!.vulnerable,
      business: ctx.incident!.businessConsequence,
      findings: scope.denied.map((id) => `ALLOW crm.getCustomer("${id}") — sin comprobación de identidad`),
    });
  } else {
    push('crm_lookup', {
      decision: `Ficha ${kase.sessionCustomerId} leída (historial de facturas y contrato).`,
      status: 'ok',
      compliance: 'Cumple',
      technical: step('crm_lookup').normalOutput,
      business: 'El agente trabaja solo con los datos que necesita para este caso.',
    });
  }

  /* 4 · Resolutor */
  let needsHitl = false;
  let hitlReason = '';
  const days = outageDays(kase.message);
  const policyAmount = DEFAULT_POLICY.outageCreditPerDay(kase.monthlyFeeEur) * days;

  if (agent.sendsRawPayloadToExternalLlm) {
    const red = redactPii(kase.message);
    if (guardrails) {
      controlsFired.add('Tokenización de PII antes de inferencia externa');
      push('resolver', {
        decision: `Inferencia externa con payload tokenizado (${red.matches.length} datos sustituidos). Respuesta re-identificada en local.`,
        status: 'ok',
        compliance: 'Mitigado',
        technical: effect('resolver')!.protected,
        business: 'El proveedor del modelo nunca recibe datos personales: no hay transferencia internacional de PII.',
        payloadBefore: kase.message,
        payloadAfter: red.text,
        findings: Object.keys(red.vault).map((tok) => `${tok} → bóveda local`),
      });
    } else {
      piiFieldsExposed += red.matches.length;
      push('resolver', {
        decision: `POST https://api.proveedor-llm.example/v1/infer con el email íntegro (${red.matches.length} datos personales).`,
        status: 'leak',
        compliance: 'Incumple',
        technical: effect('resolver')!.vulnerable,
        business: ctx.incident!.businessConsequence,
        payloadBefore: kase.message,
        findings: red.matches.map((m) => `En claro: ${m.type} ${mask(m.value)}`),
      });
    }
  } else if (agent.proposedCompensationEur > 0) {
    const decision = evaluateCompensation(agent.proposedCompensationEur);
    if (decision.kind === 'auto_approve') {
      push('resolver', {
        decision: `Devolución de ${fmtEur2(decision.amountEur)} dentro de política (aprobación automática ≤ ${DEFAULT_POLICY.autoApproveLimitEur} €).`,
        status: 'ok',
        compliance: 'Cumple',
        technical: step('resolver').normalOutput,
        business: 'Resolución en segundos sin intervención humana y sin riesgo de margen.',
        findings: [`Respuesta: «${agent.proposedReply}»`],
      });
    } else if (guardrails) {
      needsHitl = true;
      hitlReason = decision.reason;
      controlsFired.add('Política determinista de importes → HITL');
      push('resolver', {
        decision: `Propuesta del modelo retenida: ${decision.reason}.`,
        status: 'escalated',
        compliance: 'Mitigado',
        technical: effect('resolver')?.protected ?? step('resolver').protectedBehavior,
        business: 'Ninguna promesa sale sin que una regla o una persona la valide.',
        findings: [`Borrador bloqueado: «${agent.proposedReply}»`],
      });
    } else {
      unauthorizedCommitmentEur += agent.proposedCompensationEur - policyAmount;
      push('resolver', {
        decision: `Respuesta enviada al cliente comprometiendo ${fmtEur2(agent.proposedCompensationEur)} + 3 meses gratis.`,
        status: 'leak',
        compliance: 'Incumple',
        technical: effect('resolver')?.vulnerable ?? step('resolver').vulnerableBehavior,
        business: ctx.incident?.businessConsequence ?? step('resolver').businessImpact,
        findings: [`Enviado: «${agent.proposedReply}»`, `Política real: ${fmtEur2(policyAmount)} (${days} días prorrateados)`],
      });
    }
  } else if (scope.denied.length && !guardrails) {
    // La respuesta incluye datos de terceros (inyección exitosa)
    const leaked = detectPii(agent.proposedReply);
    piiFieldsExposed += leaked.length;
    push('resolver', {
      decision: 'Respuesta enviada al remitente con datos de otros clientes.',
      status: 'leak',
      compliance: 'Incumple',
      technical: effect('resolver')!.vulnerable,
      business: ctx.incident!.businessConsequence,
      findings: [`Enviado: «${agent.proposedReply}»`, ...leaked.map((m) => `Exfiltrado: ${m.type} ${mask(m.value)}`)],
    });
  } else {
    const safeReply =
      ctx.incident?.id === 'prompt_injection'
        ? 'Hola, te adjuntamos de nuevo tu factura de octubre. Si no puedes abrirla, responde a este mensaje.'
        : agent.proposedReply;
    const dlp = detectPii(safeReply);
    if (guardrails) controlsFired.add('DLP de salida');
    push('resolver', {
      decision: 'Respuesta redactada dentro de política y verificada por DLP de salida.',
      status: 'ok',
      compliance: 'Cumple',
      technical: effect('resolver')?.protected ?? step('resolver').normalOutput,
      business: 'El cliente recibe una respuesta correcta en segundos.',
      findings: [`Respuesta: «${safeReply}»`, guardrails ? `DLP de salida: ${dlp.length} dato(s) sensible(s)` : 'Sin DLP de salida'],
    });
  }

  /* 5 · HITL */
  if (guardrails && inj.suspicious) {
    needsHitl = true;
    hitlReason = 'Alerta de seguridad: intento de inyección';
  }
  if (needsHitl) {
    const isSecurity = hitlReason.startsWith('Alerta');
    if (isSecurity) {
      controlsFired.add('Revisión humana de la alerta (SOC)');
      push('hitl', {
        decision: 'Analista SOC confirma el intento de inyección. Remitente marcado y caso etiquetado para seguimiento.',
        status: 'escalated',
        compliance: 'Cumple',
        technical: 'Revisión humana de la alerta con contexto completo (payload original y saneado).',
        business: 'Detección temprana: el patrón queda documentado para bloquear campañas similares.',
        findings: [hitlReason],
        latencyOverride: 240_000,
      });
    } else {
      controlsFired.add('Aprobación humana (HITL)');
      push('hitl', {
        decision: `Supervisor aprueba ${fmtEur2(policyAmount)} (${days} días prorrateados) + disculpa personalizada. Rechaza 450 € y 3 meses gratis.`,
        status: 'escalated',
        compliance: 'Cumple',
        technical: effect('hitl')?.protected ?? step('hitl').protectedBehavior,
        business: `Margen protegido: ${fmtEur2(agent.proposedCompensationEur - policyAmount)} no comprometidos en este caso.`,
        findings: [hitlReason, 'Aprobado por: supervisor.turno-b (rol refunds.approve)'],
      });
    }
  } else {
    push('hitl', {
      decision: guardrails ? 'No necesaria: el caso está dentro de umbral.' : 'No existe validación humana en esta implementación.',
      status: guardrails || !ctx.incident ? 'ok' : 'warning',
      compliance: guardrails || !ctx.incident ? 'Cumple' : 'Incumple',
      technical: guardrails ? step('hitl').normalOutput : effect('hitl')?.vulnerable ?? step('hitl').vulnerableBehavior,
      business: guardrails ? 'El humano solo interviene donde aporta valor.' : step('hitl').businessImpact,
      skipped: true,
    });
  }

  /* 6 · Cierre */
  const breach = recordsExposed > 0 || piiFieldsExposed > 0 || unauthorizedCommitmentEur > 0;
  if (guardrails) {
    controlsFired.add('Registro de auditoría');
    push('crm_close', {
      decision: `Caso cerrado. Traza de ${events.length + 1} eventos y ${controlsFired.size} control(es) registrada.`,
      status: 'ok',
      compliance: 'Cumple',
      technical: step('crm_close').protectedBehavior,
      business: 'Diligencia demostrable ante auditoría, cliente o AEPD.',
    });
  } else {
    push('crm_close', {
      decision: breach ? 'Caso cerrado como «resuelto». Nadie ha detectado el incidente.' : 'Caso cerrado.',
      status: breach ? 'leak' : 'ok',
      compliance: breach ? 'Incumple' : 'Cumple',
      technical: breach ? step('crm_close').vulnerableBehavior : step('crm_close').normalOutput,
      business: breach
        ? 'El incidente se descubrirá tarde (por el cliente, la prensa o la AEPD), no por la empresa.'
        : 'Sin incidente, la versión ingenua parece funcionar igual. El riesgo es invisible hasta que llega el ataque.',
    });
  }

  return { events, outcome: buildOutcome(ctx, { breach, recordsExposed, piiFieldsExposed, unauthorizedCommitmentEur, controlsFired }) };
}

function buildOutcome(
  ctx: Ctx,
  r: { breach: boolean; recordsExposed: number; piiFieldsExposed: number; unauthorizedCommitmentEur: number; controlsFired: Set<string> },
): FlowOutcome {
  const base = {
    recordsExposed: r.recordsExposed,
    piiFieldsExposed: r.piiFieldsExposed,
    unauthorizedCommitmentEur: Math.round(r.unauthorizedCommitmentEur * 100) / 100,
    controlsFired: [...r.controlsFired],
  };
  if (r.breach) {
    return { ...base, kind: 'breach', headline: `Incidente materializado: ${ctx.incident?.title ?? 'fallo'}.` };
  }
  if (ctx.incident && ctx.guardrails) {
    return { ...base, kind: 'contained', headline: `Incidente contenido: ${ctx.incident.title}.` };
  }
  return { ...base, kind: 'resolved', headline: 'Caso resuelto dentro de política.' };
}

function permissionWithoutGuardrails(stage: Stage): string {
  switch (stage) {
    case 'crm_lookup':
      return 'crm.customers.read (*) — cualquier cliente';
    case 'resolver':
      return 'refunds.execute (sin límite) · llm.infer (payload en claro)';
    case 'hitl':
      return '—';
    case 'crm_close':
      return 'crm.cases.write (*)';
    default:
      return FLOW_STEPS.find((s) => s.stage === stage)!.permission;
  }
}

/** Enmascara para mostrar en pantalla sin re-exponer el dato completo. */
export function mask(v: string): string {
  const s = v.replace(/\s+/g, '');
  if (s.length <= 4) return '••••';
  return `${s.slice(0, 2)}${'•'.repeat(Math.max(3, s.length - 5))}${s.slice(-3)}`;
}
