import { flowSteps } from '../data/cxFlowScenarios';
import type {
  FlowRun,
  GovernanceControls,
  RiskAssessment,
  RoiInputs,
  RoiResult,
  TenderEvaluation,
  TenderScenario,
} from '../types/domain';
import { fmtEur, fmtNum, fmtPct } from '../utils/format';
import { TIER_LABEL } from './riskIndex';
import type { EffortPhase } from './tenderScoring';

/**
 * Generador del One-Pager Ejecutivo. Una sola fuente (ReportData) alimenta
 * el Markdown descargable y la vista de impresión a PDF: lo que se ve en
 * pantalla y lo que se entrega al cliente nunca divergen. Sale en el idioma activo.
 */

export interface ReportData {
  lang: 'es' | 'en';
  generatedAt: string; // fecha legible (la pone la UI; el motor no usa el reloj)
  flow: { incidentTitle: string | null; guardrails: boolean; run: FlowRun; counterfactual: FlowRun | null };
  tender: { scenario: TenderScenario; evaluation: TenderEvaluation; effort: EffortPhase[]; outline: string[] };
  roi: { inputs: RoiInputs; result: RoiResult; governance: GovernanceControls; risk: RiskAssessment };
}

export const VERDICT_LABEL = {
  es: { Go: 'Go', Revisar: 'Revisar', 'No-Go': 'No-Go' },
  en: { Go: 'Go', Revisar: 'Review', 'No-Go': 'No-Go' },
} as const;

export function checklist(d: ReportData): { item: string; refs: string; blocking: boolean }[] {
  return d.roi.risk.controls.map((c) => ({ item: c.title, refs: c.refs.join(' · '), blocking: c.blocking }));
}

export function paybackLabel(r: RoiResult, lang: 'es' | 'en' = 'es'): string {
  if (r.paybackMonths === null) return lang === 'en' ? 'Not recovered' : 'No se recupera';
  return `${fmtNum(Math.ceil(r.paybackMonths))} ${lang === 'en' ? 'months' : 'meses'}`;
}

export function mermaidFlow(d: ReportData): string {
  const en = d.lang === 'en';
  const status = new Map(d.flow.run.events.map((e) => [e.stage, e.status]));
  const lines = ['flowchart LR'];
  flowSteps(d.lang).forEach((s, i) => {
    const st = status.get(s.stage) ?? 'ok';
    const tag = st === 'leak' ? (en ? ' ⚠ LEAK' : ' ⚠ FUGA') : st === 'blocked' ? (en ? ' ✋ BLOCKED' : ' ✋ BLOQUEO') : st === 'escalated' ? ' 👤 HITL' : '';
    lines.push(`  S${i + 1}["${i + 1}. ${s.label}${tag}"]`);
  });
  lines.push(`  ${flowSteps(d.lang).map((_, i) => `S${i + 1}`).join(' --> ')}`);
  return lines.join('\n');
}

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function toMarkdown(d: ReportData): string {
  const en = d.lang === 'en';
  const L = (es: string, e: string) => (en ? e : es);
  const { run } = d.flow;
  const o = run.outcome;
  const ev = d.tender.evaluation;
  const verdict = VERDICT_LABEL[d.lang][ev.verdict];
  const r = d.roi.result;
  const i = d.roi.inputs;
  const steps = flowSteps(d.lang);
  const totalEffort = d.tender.effort.reduce((s, p) => s + p.totalDays, 0);
  const tier = TIER_LABEL[d.lang][d.roi.risk.tier];

  const md: string[] = [];
  md.push(L('# NEXO-OPS · One-Pager Ejecutivo', '# NEXO-OPS · Executive One-Pager'));
  md.push(L(`_Generado el ${d.generatedAt} · Procesado 100 % en el navegador (Zero-Egress)._`, `_Generated on ${d.generatedAt} · Processed 100% in the browser (Zero-Egress)._`));
  md.push('');
  md.push(L('## Resumen para dirección', '## Summary for leadership'));
  md.push(`- **${L('Automatización segura', 'Safe automation')}:** ${o.headline} ${d.flow.guardrails ? L('Guardrails activos.', 'Guardrails on.') : L('Guardrails desactivados.', 'Guardrails off.')}`);
  md.push(`- **${L('Licitación', 'Tender')}:** ${d.tender.scenario.title} → **${verdict}** (${ev.total}/100).`);
  md.push(`- **${L('ROI año 1', 'Year-1 ROI')}:** ${fmtPct(r.roiPct)} · ${L('beneficio neto', 'net benefit')} ${fmtEur(r.firstYearNetEur)} · payback ${paybackLabel(r, d.lang)}.`);
  md.push(`- **${L('Riesgo IA', 'AI risk')}:** ${tier} — ${d.roi.risk.aiActCategory}.`);
  md.push('');

  md.push(L('## 1. Flujo CX/CRM simulado', '## 1. Simulated CX/CRM flow'));
  md.push(`${L('Escenario', 'Scenario')}: **${d.flow.incidentTitle ?? L('Caso estándar (sin incidente)', 'Standard case (no incident)')}** · Guardrails: **${d.flow.guardrails ? 'ON' : 'OFF'}**`);
  md.push('');
  md.push('```mermaid');
  md.push(mermaidFlow(d));
  md.push('```');
  md.push('');
  md.push(L('| # | Etapa | Decisión | Estado | Cumplimiento |', '| # | Stage | Decision | Status | Compliance |'));
  md.push('|---|---|---|---|---|');
  const COMP = { Cumple: L('Cumple', 'Compliant'), Mitigado: L('Mitigado', 'Mitigated'), Incumple: L('Incumple', 'Non-compliant') };
  for (const e of run.events) {
    md.push(`| ${e.seq} | ${steps.find((s) => s.stage === e.stage)!.label} | ${esc(e.decision)} | ${e.status} | ${COMP[e.compliance]} |`);
  }
  md.push('');
  if (d.flow.counterfactual) {
    const c = d.flow.counterfactual.outcome;
    md.push(
      en
        ? `**Comparison ${d.flow.guardrails ? 'without' : 'with'} guardrails:** ${c.headline} Third-party records exposed: ${c.recordsExposed} · personal data in clear text: ${c.piiFieldsExposed} · unauthorised commitment: ${fmtEur(c.unauthorizedCommitmentEur)}.`
        : `**Comparativa ${d.flow.guardrails ? 'sin' : 'con'} guardrails:** ${c.headline} Registros de terceros expuestos: ${c.recordsExposed} · datos personales en claro: ${c.piiFieldsExposed} · compromiso no autorizado: ${fmtEur(c.unauthorizedCommitmentEur)}.`,
    );
    md.push('');
  }
  if (o.controlsFired.length) md.push(`${L('Controles activados', 'Controls triggered')}: ${o.controlsFired.join(' · ')}.`);
  md.push('');

  md.push(L('## 2. Licitación: Go / No-Go', '## 2. Tender: Go / No-Go'));
  md.push(`**${verdict}** · ${ev.total}/100 · ${ev.explanation}`);
  md.push('');
  md.push(L('| Dimensión | Puntuación |', '| Dimension | Score |'));
  md.push('|---|---|');
  md.push(`| ${L('Encaje técnico', 'Technical fit')} | ${ev.dimensions.technicalFit} |`);
  md.push(`| ${L('Preparación normativa', 'Regulatory readiness')} | ${ev.dimensions.compliance} |`);
  md.push(`| ${L('Holgura de plazo', 'Schedule slack')} | ${ev.dimensions.deadline} |`);
  md.push(`| ${L('Riesgo contractual (100 = sin exposición)', 'Contractual risk (100 = no exposure)')} | ${ev.dimensions.contractual} |`);
  md.push('');
  md.push(
    `${L('Esfuerzo estimado', 'Estimated effort')}: **${fmtNum(totalEffort)} ${L('jornadas', 'person-days')}** (${d.tender.effort.map((p) => `${p.label} ${fmtNum(p.totalDays)}`).join(' · ')}).`,
  );
  md.push('');
  md.push(L('Índice de memoria técnica:', 'Technical proposal outline:'));
  d.tender.outline.forEach((l, n) => md.push(`${n + 1}. ${l}`));
  md.push('');

  md.push(L('## 3. ROI operativo (neto de supervisión humana)', '## 3. Operational ROI (net of human oversight)'));
  md.push(L('| Entrada | Valor | Resultado | Valor |', '| Input | Value | Result | Value |'));
  md.push('|---|---|---|---|');
  md.push(`| ${L('Volumen mensual', 'Monthly volume')} | ${fmtNum(i.monthlyVolume)} | ${L('Horas liberadas/mes', 'Hours freed/month')} | ${fmtNum(r.hoursFreed)} |`);
  md.push(`| ${L('Minutos por unidad', 'Minutes per item')} | ${fmtNum(i.manualMinutesPerItem)} | ${L('Ahorro mensual', 'Monthly savings')} | ${fmtEur(r.monthlySavingsEur)} |`);
  md.push(`| ${L('Coste/hora', 'Cost/hour')} | ${fmtEur(i.hourlyCostEur)} | ${L('Ahorro anual', 'Annual savings')} | ${fmtEur(r.annualSavingsEur)} |`);
  md.push(`| ${L('Automatización segura', 'Safe automation')} | ${fmtPct(i.automationRatePct)} | ${L('Beneficio neto año 1', 'Year-1 net benefit')} | ${fmtEur(r.firstYearNetEur)} |`);
  md.push(`| ${L('Inversión inicial', 'Upfront investment')} | ${fmtEur(i.setupCostEur)} | ${L('ROI año 1', 'Year-1 ROI')} | ${fmtPct(r.roiPct)} |`);
  md.push(`| ${L('Coste recurrente/mes', 'Recurring cost/month')} | ${fmtEur(i.monthlyRunCostEur)} | Payback | ${paybackLabel(r, d.lang)} |`);
  md.push('');
  md.push(`${L('Horas de supervisión HITL descontadas', 'HITL oversight hours deducted')}: ${fmtNum(r.hitlReviewHours)} ${L('h/mes', 'h/month')}.`);
  md.push('');

  md.push(L(`## 4. Riesgo IA: ${tier} (ISO/IEC 42001 · EU AI Act)`, `## 4. AI risk: ${tier} (ISO/IEC 42001 · EU AI Act)`));
  md.push(`${L('Clasificación orientativa EU AI Act', 'Indicative EU AI Act classification')}: ${d.roi.risk.aiActCategory}.`);
  if (d.roi.risk.floorReason) md.push(`> ${d.roi.risk.floorReason}`);
  md.push('');
  md.push(L('## 5. Checklist de auditoría previa al despliegue', '## 5. Pre-deployment audit checklist'));
  for (const c of checklist(d)) md.push(`- [ ] ${c.blocking ? L('**[Bloqueante]** ', '**[Blocking]** ') : ''}${c.item} _(${c.refs})_`);
  md.push('');
  md.push('---');
  md.push(
    L(
      '_Indicadores orientativos para conversación de preventa; no constituyen asesoramiento jurídico. Datos de los escenarios ficticios._',
      '_Indicative figures for pre-sales conversations; not legal advice. Scenario data is fictitious._',
    ),
  );
  return md.join('\n');
}

export function downloadMarkdown(d: ReportData, filename = d.lang === 'en' ? 'nexo-ops-one-pager-en.md' : 'nexo-ops-one-pager.md'): void {
  const blob = new Blob([toMarkdown(d)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
