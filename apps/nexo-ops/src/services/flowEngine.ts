import { baseCase, flowSteps, incidentFor } from '../data/cxFlowScenarios';
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
import type { Lang } from '../i18n/lang';
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
 * El idioma solo cambia los textos: decisiones, estados y cifras son idénticos.
 */

const BASE_LATENCY: Record<Stage, number> = {
  intake: 45,
  classifier: 640,
  crm_lookup: 90,
  resolver: 1450,
  hitl: 180_000,
  crm_close: 70,
};

export function classifyIntent(text: string, lang: Lang = 'es'): { intent: string; urgency: string } {
  const t = text.toLowerCase();
  let key: 'bank' | 'outage' | 'billing' | 'general' = 'general';
  if (/(domiciliaci|cuenta|iban|direct debit|account)/.test(t)) key = 'bank';
  else if (/(sin (fibra|servicio|conexi)|ca[ií]da|aver[ií]a|no (fibre|fiber|service|connection)|outage)/.test(t)) key = 'outage';
  else if (/(factura|cobr|cargo|recibo|invoice|charge|bill)/.test(t)) key = 'billing';
  const level = /(inaceptable|urgente|me doy de baja|denuncia|unacceptable|urgent|cancel)/.test(t)
    ? 2
    : /(días|no puedo|duplicad|days|can’t|can't|twice|duplicate)/.test(t)
      ? 1
      : 0;
  const INTENT = {
    bank: ['Cambio de datos bancarios', 'Bank details change'],
    outage: ['Incidencia de servicio', 'Service outage'],
    billing: ['Facturación', 'Billing'],
    general: ['Consulta general', 'General enquiry'],
  } as const;
  const URG = [['Baja', 'Low'], ['Media', 'Medium'], ['Alta', 'High']] as const;
  const i = lang === 'en' ? 1 : 0;
  return { intent: INTENT[key][i], urgency: URG[level]![i] };
}

function outageDays(text: string): number {
  const m = /(\d+)\s*(d[ií]as|days)/i.exec(text);
  return m ? Number(m[1]) : 1;
}

interface Ctx {
  guardrails: boolean;
  incident: ChaosIncident | null;
  kase: CustomerCase;
  agent: NaiveAgentBehavior;
  lang: Lang;
}

export function buildCase(incident: ChaosIncident | null, lang: Lang = 'es'): { kase: CustomerCase; agent: NaiveAgentBehavior } {
  const base = baseCase(lang);
  if (!incident) return base;
  return {
    kase: { ...base.kase, channel: incident.channel, message: incident.samplePayload },
    agent: incident.naiveAgent,
  };
}

export function runFlow(incidentId: IncidentId | null, guardrails: boolean, lang: Lang = 'es'): FlowRun {
  const incident = incidentFor(incidentId, lang);
  const { kase, agent } = buildCase(incident, lang);
  const ctx: Ctx = { guardrails, incident, kase, agent, lang };
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const steps = flowSteps(lang);
  // La semilla no depende del idioma: las latencias son idénticas en ES y EN.
  const rand = mulberry32(fnv1a(`${incidentId ?? 'base'}|${guardrails}`));

  const events: TraceEvent[] = [];
  const controlsFired = new Set<string>();
  let recordsExposed = 0;
  let piiFieldsExposed = 0;
  let unauthorizedCommitmentEur = 0;
  let t = 0;

  const step = (stage: Stage): FlowStep => steps.find((s) => s.stage === stage)!;
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
      permission: guardrails ? s.permission : permissionWithoutGuardrails(stage, lang),
      findings: e.findings ?? [],
      payloadBefore: e.payloadBefore,
      payloadAfter: e.payloadAfter,
      skipped: e.skipped,
    });
  };

  /* 1 · Recepción */
  const pii = detectPii(kase.message);
  const inj = detectInjection(kase.message, lang);
  if (guardrails) {
    const findings = [
      ...pii.map((p) => `PII ${p.type}: ${mask(p.value)}${p.validated ? L(' (dígito de control válido)', ' (valid check digit)') : ''}`),
      ...inj.signals.map((s) => `${L('Inyección', 'Injection')} · ${s.rule}: «${s.excerpt}»`),
    ];
    if (pii.length) controlsFired.add(L('Detección de PII en entrada', 'Input PII detection'));
    if (inj.suspicious) controlsFired.add(L('Detección de prompt injection', 'Prompt injection detection'));
    push('intake', {
      decision: L(
        `Texto inspeccionado: ${pii.length} dato(s) personal(es), riesgo de inyección ${inj.score}/100.`,
        `Text inspected: ${pii.length} personal data item(s), injection risk ${inj.score}/100.`,
      ),
      status: pii.length || inj.suspicious ? 'warning' : 'ok',
      compliance: 'Cumple',
      technical: effect('intake')?.protected ?? step('intake').protectedBehavior,
      business: L('Lo que no se inspecciona aquí no se puede proteger después.', 'What is not inspected here cannot be protected later.'),
      findings,
    });
  } else {
    push('intake', {
      decision: L(`Caso ingerido sin inspección (${kase.channel}).`, `Case ingested without inspection (${kase.channel}).`),
      status: pii.length ? 'warning' : 'ok',
      compliance: pii.length ? 'Incumple' : 'Cumple',
      technical: effect('intake')?.vulnerable ?? step('intake').vulnerableBehavior,
      business: pii.length
        ? L(
            'Datos personales circulando sin minimizar: incumple RGPD Art. 5.1.c desde el primer segundo.',
            'Personal data flowing unminimised: breaches GDPR Art. 5(1)(c) from the first second.',
          )
        : step('intake').businessImpact,
    });
  }

  /* 2 · Clasificador */
  const cls = classifyIntent(kase.message, lang);
  const idLine = L(`Identidad verificada por canal: ${kase.sessionCustomerId}`, `Identity verified by channel: ${kase.sessionCustomerId}`);
  const intentLine = L(`Intención: ${cls.intent} · urgencia ${cls.urgency}.`, `Intent: ${cls.intent} · urgency ${cls.urgency}.`);
  if (inj.suspicious && guardrails) {
    push('classifier', {
      decision: `${intentLine} ${L('Instrucciones incrustadas aisladas como dato no confiable.', 'Embedded instructions isolated as untrusted data.')}`,
      status: 'blocked',
      compliance: 'Mitigado',
      technical: effect('classifier')!.protected,
      business: L(
        'El atacante no consigue cambiar el comportamiento del agente; el SOC recibe la alerta.',
        'The attacker cannot change the agent’s behaviour; the SOC receives the alert.',
      ),
      findings: [idLine, L('Alerta SOC generada (severidad crítica)', 'SOC alert raised (critical severity)')],
      payloadBefore: kase.message,
      payloadAfter: inj.sanitized,
    });
    controlsFired.add(L('Aislamiento de instrucciones + alerta SOC', 'Instruction isolation + SOC alert'));
  } else if (inj.suspicious) {
    push('classifier', {
      decision: L(
        'Intención reinterpretada como «auditoría interna» siguiendo el texto del cliente.',
        'Intent reinterpreted as “internal audit” by following the customer’s text.',
      ),
      status: 'warning',
      compliance: 'Incumple',
      technical: effect('classifier')!.vulnerable,
      business: L('El agente obedece a quien escribe el ticket, no a la empresa.', 'The agent obeys whoever writes the ticket, not the company.'),
      findings: [idLine],
    });
  } else {
    push('classifier', {
      decision: intentLine,
      status: 'ok',
      compliance: 'Cumple',
      technical: step('classifier').normalOutput,
      business: L('Enrutado correcto: el caso llega al flujo que le corresponde.', 'Correct routing: the case reaches the right flow.'),
      findings: [idLine],
    });
  }

  /* 3 · Consulta CRM */
  const scope = enforceCustomerScope(kase.sessionCustomerId, agent.requestedCustomerIds);
  if (scope.denied.length && guardrails) {
    controlsFired.add(L('Alcance de CRM ligado a la sesión (mínimo privilegio)', 'CRM scope bound to session (least privilege)'));
    push('crm_lookup', {
      decision: L(
        `Lectura permitida: ${scope.allowed.join(', ')}. Denegada: ${scope.denied.join(', ')}.`,
        `Read allowed: ${scope.allowed.join(', ')}. Denied: ${scope.denied.join(', ')}.`,
      ),
      status: 'blocked',
      compliance: 'Mitigado',
      technical: effect('crm_lookup')!.protected,
      business: L('Cero registros de terceros expuestos. No hay brecha que notificar.', 'Zero third-party records exposed. No breach to notify.'),
      findings: scope.denied.map((id) => `DENY crm.getCustomer("${id}") — ${L('fuera del alcance de sesión', 'outside session scope')}`),
    });
  } else if (scope.denied.length) {
    recordsExposed += scope.denied.length;
    push('crm_lookup', {
      decision: L(
        `Leídas ${agent.requestedCustomerIds.length} fichas: ${agent.requestedCustomerIds.join(', ')}.`,
        `Read ${agent.requestedCustomerIds.length} records: ${agent.requestedCustomerIds.join(', ')}.`,
      ),
      status: 'leak',
      compliance: 'Incumple',
      technical: effect('crm_lookup')!.vulnerable,
      business: ctx.incident!.businessConsequence,
      findings: scope.denied.map((id) => `ALLOW crm.getCustomer("${id}") — ${L('sin comprobación de identidad', 'no identity check')}`),
    });
  } else {
    push('crm_lookup', {
      decision: L(
        `Ficha ${kase.sessionCustomerId} leída (historial de facturas y contrato).`,
        `Record ${kase.sessionCustomerId} read (invoice history and contract).`,
      ),
      status: 'ok',
      compliance: 'Cumple',
      technical: step('crm_lookup').normalOutput,
      business: L('El agente trabaja solo con los datos que necesita para este caso.', 'The agent only works with the data it needs for this case.'),
    });
  }

  /* 4 · Resolutor */
  let needsHitl = false;
  let hitlReason = '';
  let hitlIsSecurity = false;
  const days = outageDays(kase.message);
  const policyAmount = DEFAULT_POLICY.outageCreditPerDay(kase.monthlyFeeEur) * days;
  const reply = (s: string) => L(`Respuesta: «${s}»`, `Reply: “${s}”`);

  if (agent.sendsRawPayloadToExternalLlm) {
    const red = redactPii(kase.message);
    if (guardrails) {
      controlsFired.add(L('Tokenización de PII antes de inferencia externa', 'PII tokenisation before external inference'));
      push('resolver', {
        decision: L(
          `Inferencia externa con payload tokenizado (${red.matches.length} datos sustituidos). Respuesta re-identificada en local.`,
          `External inference with tokenised payload (${red.matches.length} items replaced). Reply re-identified locally.`,
        ),
        status: 'ok',
        compliance: 'Mitigado',
        technical: effect('resolver')!.protected,
        business: L(
          'El proveedor del modelo nunca recibe datos personales: no hay transferencia internacional de PII.',
          'The model provider never receives personal data: no international transfer of PII.',
        ),
        payloadBefore: kase.message,
        payloadAfter: red.text,
        findings: Object.keys(red.vault).map((tok) => `${tok} → ${L('bóveda local', 'local vault')}`),
      });
    } else {
      piiFieldsExposed += red.matches.length;
      push('resolver', {
        decision: L(
          `POST https://api.proveedor-llm.example/v1/infer con el email íntegro (${red.matches.length} datos personales).`,
          `POST https://api.proveedor-llm.example/v1/infer with the full email (${red.matches.length} personal data items).`,
        ),
        status: 'leak',
        compliance: 'Incumple',
        technical: effect('resolver')!.vulnerable,
        business: ctx.incident!.businessConsequence,
        payloadBefore: kase.message,
        findings: red.matches.map((m) => `${L('En claro', 'In clear text')}: ${m.type} ${mask(m.value)}`),
      });
    }
  } else if (agent.proposedCompensationEur > 0) {
    const decision = evaluateCompensation(agent.proposedCompensationEur, DEFAULT_POLICY, lang);
    if (decision.kind === 'auto_approve') {
      push('resolver', {
        decision: L(
          `Devolución de ${fmtEur2(decision.amountEur)} dentro de política (aprobación automática ≤ ${DEFAULT_POLICY.autoApproveLimitEur} €).`,
          `Refund of ${fmtEur2(decision.amountEur)} within policy (automatic approval ≤ €${DEFAULT_POLICY.autoApproveLimitEur}).`,
        ),
        status: 'ok',
        compliance: 'Cumple',
        technical: step('resolver').normalOutput,
        business: L('Resolución en segundos sin intervención humana y sin riesgo de margen.', 'Resolved in seconds with no human intervention and no margin risk.'),
        findings: [reply(agent.proposedReply)],
      });
    } else if (guardrails) {
      needsHitl = true;
      hitlReason = decision.reason;
      controlsFired.add(L('Política determinista de importes → HITL', 'Deterministic amount policy → HITL'));
      push('resolver', {
        decision: L(`Propuesta del modelo retenida: ${decision.reason}.`, `Model proposal held: ${decision.reason}.`),
        status: 'escalated',
        compliance: 'Mitigado',
        technical: effect('resolver')?.protected ?? step('resolver').protectedBehavior,
        business: L('Ninguna promesa sale sin que una regla o una persona la valide.', 'No promise goes out unless a rule or a person validates it.'),
        findings: [L(`Borrador bloqueado: «${agent.proposedReply}»`, `Draft blocked: “${agent.proposedReply}”`)],
      });
    } else {
      unauthorizedCommitmentEur += agent.proposedCompensationEur - policyAmount;
      push('resolver', {
        decision: L(
          `Respuesta enviada al cliente comprometiendo ${fmtEur2(agent.proposedCompensationEur)} + 3 meses gratis.`,
          `Reply sent to the customer committing ${fmtEur2(agent.proposedCompensationEur)} + 3 free months.`,
        ),
        status: 'leak',
        compliance: 'Incumple',
        technical: effect('resolver')?.vulnerable ?? step('resolver').vulnerableBehavior,
        business: ctx.incident?.businessConsequence ?? step('resolver').businessImpact,
        findings: [
          L(`Enviado: «${agent.proposedReply}»`, `Sent: “${agent.proposedReply}”`),
          L(`Política real: ${fmtEur2(policyAmount)} (${days} días prorrateados)`, `Actual policy: ${fmtEur2(policyAmount)} (${days} pro-rated days)`),
        ],
      });
    }
  } else if (scope.denied.length && !guardrails) {
    // La respuesta incluye datos de terceros (inyección exitosa)
    const leaked = detectPii(agent.proposedReply);
    piiFieldsExposed += leaked.length;
    push('resolver', {
      decision: L('Respuesta enviada al remitente con datos de otros clientes.', 'Reply sent to the sender with other customers’ data.'),
      status: 'leak',
      compliance: 'Incumple',
      technical: effect('resolver')!.vulnerable,
      business: ctx.incident!.businessConsequence,
      findings: [
        L(`Enviado: «${agent.proposedReply}»`, `Sent: “${agent.proposedReply}”`),
        ...leaked.map((m) => `${L('Exfiltrado', 'Exfiltrated')}: ${m.type} ${mask(m.value)}`),
      ],
    });
  } else {
    const safeReply =
      ctx.incident?.id === 'prompt_injection'
        ? L(
            'Hola, te adjuntamos de nuevo tu factura de octubre. Si no puedes abrirla, responde a este mensaje.',
            'Hi, please find your October invoice attached again. If you cannot open it, reply to this message.',
          )
        : agent.proposedReply;
    const dlp = detectPii(safeReply);
    if (guardrails) controlsFired.add(L('DLP de salida', 'Output DLP'));
    push('resolver', {
      decision: L('Respuesta redactada dentro de política y verificada por DLP de salida.', 'Reply drafted within policy and checked by output DLP.'),
      status: 'ok',
      compliance: 'Cumple',
      technical: effect('resolver')?.protected ?? step('resolver').normalOutput,
      business: L('El cliente recibe una respuesta correcta en segundos.', 'The customer gets a correct reply in seconds.'),
      findings: [
        reply(safeReply),
        guardrails ? L(`DLP de salida: ${dlp.length} dato(s) sensible(s)`, `Output DLP: ${dlp.length} sensitive item(s)`) : L('Sin DLP de salida', 'No output DLP'),
      ],
    });
  }

  /* 5 · HITL */
  if (guardrails && inj.suspicious) {
    needsHitl = true;
    hitlIsSecurity = true;
    hitlReason = L('Alerta de seguridad: intento de inyección', 'Security alert: injection attempt');
  }
  if (needsHitl) {
    if (hitlIsSecurity) {
      controlsFired.add(L('Revisión humana de la alerta (SOC)', 'Human review of the alert (SOC)'));
      push('hitl', {
        decision: L(
          'Analista SOC confirma el intento de inyección. Remitente marcado y caso etiquetado para seguimiento.',
          'SOC analyst confirms the injection attempt. Sender flagged and case tagged for follow-up.',
        ),
        status: 'escalated',
        compliance: 'Cumple',
        technical: L(
          'Revisión humana de la alerta con contexto completo (payload original y saneado).',
          'Human review of the alert with full context (original and sanitised payload).',
        ),
        business: L(
          'Detección temprana: el patrón queda documentado para bloquear campañas similares.',
          'Early detection: the pattern is documented to block similar campaigns.',
        ),
        findings: [hitlReason],
        latencyOverride: 240_000,
      });
    } else {
      controlsFired.add(L('Aprobación humana (HITL)', 'Human approval (HITL)'));
      push('hitl', {
        decision: L(
          `Supervisor aprueba ${fmtEur2(policyAmount)} (${days} días prorrateados) + disculpa personalizada. Rechaza 450 € y 3 meses gratis.`,
          `Supervisor approves ${fmtEur2(policyAmount)} (${days} pro-rated days) + a personal apology. Rejects €450 and 3 free months.`,
        ),
        status: 'escalated',
        compliance: 'Cumple',
        technical: effect('hitl')?.protected ?? step('hitl').protectedBehavior,
        business: L(
          `Margen protegido: ${fmtEur2(agent.proposedCompensationEur - policyAmount)} no comprometidos en este caso.`,
          `Margin protected: ${fmtEur2(agent.proposedCompensationEur - policyAmount)} not committed in this case.`,
        ),
        findings: [hitlReason, L('Aprobado por: supervisor.turno-b (rol refunds.approve)', 'Approved by: supervisor.shift-b (role refunds.approve)')],
      });
    }
  } else {
    push('hitl', {
      decision: guardrails
        ? L('No necesaria: el caso está dentro de umbral.', 'Not needed: the case is within threshold.')
        : L('No existe validación humana en esta implementación.', 'There is no human review in this implementation.'),
      status: guardrails || !ctx.incident ? 'ok' : 'warning',
      compliance: guardrails || !ctx.incident ? 'Cumple' : 'Incumple',
      technical: guardrails ? step('hitl').normalOutput : effect('hitl')?.vulnerable ?? step('hitl').vulnerableBehavior,
      business: guardrails ? L('El humano solo interviene donde aporta valor.', 'Humans only step in where they add value.') : step('hitl').businessImpact,
      skipped: true,
    });
  }

  /* 6 · Cierre */
  const breach = recordsExposed > 0 || piiFieldsExposed > 0 || unauthorizedCommitmentEur > 0;
  if (guardrails) {
    controlsFired.add(L('Registro de auditoría', 'Audit logging'));
    push('crm_close', {
      decision: L(
        `Caso cerrado. Traza de ${events.length + 1} eventos y ${controlsFired.size} control(es) registrada.`,
        `Case closed. Trace of ${events.length + 1} events and ${controlsFired.size} control(s) recorded.`,
      ),
      status: 'ok',
      compliance: 'Cumple',
      technical: step('crm_close').protectedBehavior,
      business: L('Diligencia demostrable ante auditoría, cliente o AEPD.', 'Demonstrable due diligence for auditors, customers or regulators.'),
    });
  } else {
    push('crm_close', {
      decision: breach
        ? L('Caso cerrado como «resuelto». Nadie ha detectado el incidente.', 'Case closed as “resolved”. Nobody has detected the incident.')
        : L('Caso cerrado.', 'Case closed.'),
      status: breach ? 'leak' : 'ok',
      compliance: breach ? 'Incumple' : 'Cumple',
      technical: breach ? step('crm_close').vulnerableBehavior : step('crm_close').normalOutput,
      business: breach
        ? L(
            'El incidente se descubrirá tarde (por el cliente, la prensa o la AEPD), no por la empresa.',
            'The incident will be discovered late (by the customer, the press or the regulator), not by the company.',
          )
        : L(
            'Sin incidente, la versión ingenua parece funcionar igual. El riesgo es invisible hasta que llega el ataque.',
            'With no incident, the naive version seems to work just as well. The risk is invisible until the attack arrives.',
          ),
    });
  }

  return { events, outcome: buildOutcome(ctx, { breach, recordsExposed, piiFieldsExposed, unauthorizedCommitmentEur, controlsFired }) };
}

function buildOutcome(
  ctx: Ctx,
  r: { breach: boolean; recordsExposed: number; piiFieldsExposed: number; unauthorizedCommitmentEur: number; controlsFired: Set<string> },
): FlowOutcome {
  const en = ctx.lang === 'en';
  const base = {
    recordsExposed: r.recordsExposed,
    piiFieldsExposed: r.piiFieldsExposed,
    unauthorizedCommitmentEur: Math.round(r.unauthorizedCommitmentEur * 100) / 100,
    controlsFired: [...r.controlsFired],
  };
  const title = ctx.incident?.title ?? (en ? 'failure' : 'fallo');
  if (r.breach) return { ...base, kind: 'breach', headline: en ? `Incident materialised: ${title}.` : `Incidente materializado: ${title}.` };
  if (ctx.incident && ctx.guardrails) return { ...base, kind: 'contained', headline: en ? `Incident contained: ${title}.` : `Incidente contenido: ${title}.` };
  return { ...base, kind: 'resolved', headline: en ? 'Case resolved within policy.' : 'Caso resuelto dentro de política.' };
}

function permissionWithoutGuardrails(stage: Stage, lang: Lang): string {
  const en = lang === 'en';
  switch (stage) {
    case 'crm_lookup':
      return en ? 'crm.customers.read (*) — any customer' : 'crm.customers.read (*) — cualquier cliente';
    case 'resolver':
      return en ? 'refunds.execute (no limit) · llm.infer (clear-text payload)' : 'refunds.execute (sin límite) · llm.infer (payload en claro)';
    case 'hitl':
      return '—';
    case 'crm_close':
      return 'crm.cases.write (*)';
    default:
      return flowSteps(lang).find((s) => s.stage === stage)!.permission;
  }
}

/** Enmascara para mostrar en pantalla sin re-exponer el dato completo. */
export function mask(v: string): string {
  const s = v.replace(/\s+/g, '');
  if (s.length <= 4) return '••••';
  return `${s.slice(0, 2)}${'•'.repeat(Math.max(3, s.length - 5))}${s.slice(-3)}`;
}
