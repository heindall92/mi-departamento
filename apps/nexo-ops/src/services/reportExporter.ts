import { FLOW_STEPS } from '../data/cxFlowScenarios';
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
import type { EffortPhase } from './tenderScoring';

/**
 * Generador del One-Pager Ejecutivo. Una sola fuente (ReportData) alimenta
 * el Markdown descargable y la vista de impresión a PDF: lo que se ve en
 * pantalla y lo que se entrega al cliente nunca divergen.
 */

export interface ReportData {
  generatedAt: string; // fecha legible (la pone la UI; el motor no usa el reloj)
  flow: { incidentTitle: string | null; guardrails: boolean; run: FlowRun; counterfactual: FlowRun | null };
  tender: { scenario: TenderScenario; evaluation: TenderEvaluation; effort: EffortPhase[]; outline: string[] };
  roi: { inputs: RoiInputs; result: RoiResult; governance: GovernanceControls; risk: RiskAssessment };
}

export function checklist(d: ReportData): { item: string; refs: string; blocking: boolean }[] {
  return d.roi.risk.controls.map((c) => ({ item: c.title, refs: c.refs.join(' · '), blocking: c.blocking }));
}

export function paybackLabel(r: RoiResult): string {
  return r.paybackMonths === null ? 'No se recupera' : `${fmtNum(Math.ceil(r.paybackMonths))} meses`;
}

export function mermaidFlow(d: ReportData): string {
  const status = new Map(d.flow.run.events.map((e) => [e.stage, e.status]));
  const lines = ['flowchart LR'];
  FLOW_STEPS.forEach((s, i) => {
    const st = status.get(s.stage) ?? 'ok';
    const tag = st === 'leak' ? ' ⚠ FUGA' : st === 'blocked' ? ' ✋ BLOQUEO' : st === 'escalated' ? ' 👤 HITL' : '';
    lines.push(`  S${i + 1}["${i + 1}. ${s.label}${tag}"]`);
  });
  lines.push(`  ${FLOW_STEPS.map((_, i) => `S${i + 1}`).join(' --> ')}`);
  return lines.join('\n');
}

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function toMarkdown(d: ReportData): string {
  const { run } = d.flow;
  const o = run.outcome;
  const ev = d.tender.evaluation;
  const r = d.roi.result;
  const i = d.roi.inputs;
  const totalEffort = d.tender.effort.reduce((s, p) => s + p.totalDays, 0);

  const md: string[] = [];
  md.push(`# NEXO-OPS · One-Pager Ejecutivo`);
  md.push(`_Generado el ${d.generatedAt} · Procesado 100 % en el navegador (Zero-Egress)._`);
  md.push('');
  md.push('## Resumen para dirección');
  md.push(`- **Automatización segura:** ${o.headline} ${d.flow.guardrails ? 'Guardrails activos.' : 'Guardrails desactivados.'}`);
  md.push(`- **Licitación:** ${d.tender.scenario.title} → **${ev.verdict}** (${ev.total}/100).`);
  md.push(`- **ROI año 1:** ${fmtPct(r.roiPct)} · beneficio neto ${fmtEur(r.firstYearNetEur)} · payback ${paybackLabel(r)}.`);
  md.push(`- **Riesgo IA:** ${d.roi.risk.tier} — ${d.roi.risk.aiActCategory}.`);
  md.push('');

  md.push('## 1. Flujo CX/CRM simulado');
  md.push(`Escenario: **${d.flow.incidentTitle ?? 'Caso estándar (sin incidente)'}** · Guardrails: **${d.flow.guardrails ? 'ON' : 'OFF'}**`);
  md.push('');
  md.push('```mermaid');
  md.push(mermaidFlow(d));
  md.push('```');
  md.push('');
  md.push('| # | Etapa | Decisión | Estado | Cumplimiento |');
  md.push('|---|---|---|---|---|');
  for (const e of run.events) {
    md.push(`| ${e.seq} | ${FLOW_STEPS.find((s) => s.stage === e.stage)!.label} | ${esc(e.decision)} | ${e.status} | ${e.compliance} |`);
  }
  md.push('');
  if (d.flow.counterfactual) {
    const c = d.flow.counterfactual.outcome;
    md.push(`**Comparativa ${d.flow.guardrails ? 'sin' : 'con'} guardrails:** ${c.headline} Registros de terceros expuestos: ${c.recordsExposed} · datos personales en claro: ${c.piiFieldsExposed} · compromiso no autorizado: ${fmtEur(c.unauthorizedCommitmentEur)}.`);
    md.push('');
  }
  if (o.controlsFired.length) md.push(`Controles activados: ${o.controlsFired.join(' · ')}.`);
  md.push('');

  md.push('## 2. Licitación: Go / No-Go');
  md.push(`**${ev.verdict}** · ${ev.total}/100 · ${ev.explanation}`);
  md.push('');
  md.push('| Dimensión | Puntuación |');
  md.push('|---|---|');
  md.push(`| Encaje técnico | ${ev.dimensions.technicalFit} |`);
  md.push(`| Preparación normativa | ${ev.dimensions.compliance} |`);
  md.push(`| Holgura de plazo | ${ev.dimensions.deadline} |`);
  md.push(`| Riesgo contractual (100 = sin exposición) | ${ev.dimensions.contractual} |`);
  md.push('');
  md.push(`Esfuerzo estimado: **${fmtNum(totalEffort)} jornadas** (${d.tender.effort.map((p) => `${p.label} ${fmtNum(p.totalDays)}`).join(' · ')}).`);
  md.push('');
  md.push('Índice de memoria técnica:');
  d.tender.outline.forEach((l, n) => md.push(`${n + 1}. ${l}`));
  md.push('');

  md.push('## 3. ROI operativo (neto de supervisión humana)');
  md.push('| Entrada | Valor | Resultado | Valor |');
  md.push('|---|---|---|---|');
  md.push(`| Volumen mensual | ${fmtNum(i.monthlyVolume)} | Horas liberadas/mes | ${fmtNum(r.hoursFreed)} |`);
  md.push(`| Minutos por unidad | ${fmtNum(i.manualMinutesPerItem)} | Ahorro mensual | ${fmtEur(r.monthlySavingsEur)} |`);
  md.push(`| Coste/hora | ${fmtEur(i.hourlyCostEur)} | Ahorro anual | ${fmtEur(r.annualSavingsEur)} |`);
  md.push(`| Automatización segura | ${fmtPct(i.automationRatePct)} | Beneficio neto año 1 | ${fmtEur(r.firstYearNetEur)} |`);
  md.push(`| Inversión inicial | ${fmtEur(i.setupCostEur)} | ROI año 1 | ${fmtPct(r.roiPct)} |`);
  md.push(`| Coste recurrente/mes | ${fmtEur(i.monthlyRunCostEur)} | Payback | ${paybackLabel(r)} |`);
  md.push('');
  md.push(`Horas de supervisión HITL descontadas: ${fmtNum(r.hitlReviewHours)} h/mes.`);
  md.push('');

  md.push(`## 4. Riesgo IA: ${d.roi.risk.tier} (ISO/IEC 42001 · EU AI Act)`);
  md.push(`Clasificación orientativa EU AI Act: ${d.roi.risk.aiActCategory}.`);
  if (d.roi.risk.floorReason) md.push(`> ${d.roi.risk.floorReason}`);
  md.push('');
  md.push('## 5. Checklist de auditoría previa al despliegue');
  for (const c of checklist(d)) md.push(`- [ ] ${c.blocking ? '**[Bloqueante]** ' : ''}${c.item} _(${c.refs})_`);
  md.push('');
  md.push('---');
  md.push('_Indicadores orientativos para conversación de preventa; no constituyen asesoramiento jurídico. Datos de los escenarios ficticios._');
  return md.join('\n');
}

export function downloadMarkdown(d: ReportData, filename = 'nexo-ops-one-pager.md'): void {
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
