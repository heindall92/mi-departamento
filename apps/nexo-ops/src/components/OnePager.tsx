import { flowSteps } from '../data/cxFlowScenarios';
import { checklist, paybackLabel, VERDICT_LABEL, type ReportData } from '../services/reportExporter';
import { TIER_LABEL } from '../services/riskIndex';
import { fmtEur, fmtNum, fmtPct } from '../utils/format';

const ST_LABEL = {
  es: { ok: 'OK', warning: 'Aviso', blocked: 'Bloqueado', escalated: 'HITL', leak: 'FUGA' },
  en: { ok: 'OK', warning: 'Warning', blocked: 'Blocked', escalated: 'HITL', leak: 'LEAK' },
} as const;

/** Vista de impresión A4 (una página) en el idioma activo. Solo visible con @media print. */
export function OnePager({ d }: { d: ReportData }) {
  const L = (es: string, en: string) => (d.lang === 'en' ? en : es);
  const o = d.flow.run.outcome;
  const ev = d.tender.evaluation;
  const verdict = VERDICT_LABEL[d.lang][ev.verdict];
  const r = d.roi.result;
  const effort = d.tender.effort.reduce((s, p) => s + p.totalDays, 0);
  const cf = d.flow.counterfactual?.outcome;
  const steps = flowSteps(d.lang);
  const tier = TIER_LABEL[d.lang][d.roi.risk.tier];
  return (
    <article className="onepager" aria-hidden="true" lang={d.lang}>
      <header className="op-head">
        <div>
          <h1>{L('NEXO-OPS · One-Pager Ejecutivo', 'NEXO-OPS · Executive One-Pager')}</h1>
          <p>{L('Automatización con IA agéntica: seguridad, licitación y retorno en una página.', 'Agentic AI automation: security, tendering and return on one page.')}</p>
        </div>
        <div className="op-meta">
          {d.generatedAt}
          <br />
          {L('Procesado en el navegador (Zero-Egress)', 'Processed in the browser (Zero-Egress)')}
        </div>
      </header>

      <section className="op-kpis">
        <div className={`op-kpi op-${o.kind}`}>
          <span>{L('Seguridad del flujo', 'Flow security')}</span>
          <strong>{o.kind === 'breach' ? L('Incidente', 'Incident') : o.kind === 'contained' ? L('Contenido', 'Contained') : L('Resuelto', 'Resolved')}</strong>
          <em>Guardrails {d.flow.guardrails ? 'ON' : 'OFF'}</em>
        </div>
        <div className={`op-kpi op-v-${ev.verdict}`}>
          <span>{L('Licitación', 'Tender')}</span>
          <strong>{verdict}</strong>
          <em>{ev.total}/100</em>
        </div>
        <div className="op-kpi">
          <span>{L('ROI año 1', 'Year-1 ROI')}</span>
          <strong>{fmtPct(r.roiPct)}</strong>
          <em>payback {paybackLabel(r, d.lang)}</em>
        </div>
        <div className="op-kpi">
          <span>{L('Riesgo IA', 'AI risk')}</span>
          <strong>{tier}</strong>
          <em>{d.roi.risk.aiActCategory.split(' — ')[0]}</em>
        </div>
      </section>

      <section>
        <h2>1 · {L('Flujo CX/CRM', 'CX/CRM flow')} — {d.flow.incidentTitle ?? L('caso estándar', 'standard case')}</h2>
        <ol className="op-flow">
          {d.flow.run.events.map((e, i) => (
            <li key={e.seq} className={`op-st-${e.status}`}>
              <b>{i + 1}. {steps[i]!.label}</b>
              <span>{ST_LABEL[d.lang][e.status]}</span>
            </li>
          ))}
        </ol>
        <p>
          {o.headline} {o.controlsFired.length ? `${L('Controles', 'Controls')}: ${o.controlsFired.join(', ')}.` : ''}
          {cf && d.flow.incidentTitle
            ? L(
                ` Sin guardrails: ${cf.recordsExposed} fichas de terceros, ${cf.piiFieldsExposed} datos personales en claro, ${fmtEur(cf.unauthorizedCommitmentEur)} comprometidos fuera de política.`,
                ` Without guardrails: ${cf.recordsExposed} third-party records, ${cf.piiFieldsExposed} personal data items in clear text, ${fmtEur(cf.unauthorizedCommitmentEur)} committed out of policy.`,
              )
            : ''}
        </p>
      </section>

      <section className="op-two">
        <div>
          <h2>2 · {d.tender.scenario.title}</h2>
          <p><strong>{verdict} ({ev.total}/100).</strong> {ev.explanation}</p>
          <table>
            <tbody>
              <tr><td>{L('Encaje técnico', 'Technical fit')}</td><td>{ev.dimensions.technicalFit}</td></tr>
              <tr><td>{L('Preparación normativa', 'Regulatory readiness')}</td><td>{ev.dimensions.compliance}</td></tr>
              <tr><td>{L('Holgura de plazo', 'Schedule slack')}</td><td>{ev.dimensions.deadline}</td></tr>
              <tr><td>{L('Riesgo contractual', 'Contractual risk')}</td><td>{ev.dimensions.contractual}</td></tr>
              <tr><td>{L('Esfuerzo estimado', 'Estimated effort')}</td><td>{fmtNum(effort)} {L('jornadas', 'person-days')}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h2>3 · {L('ROI operativo (neto de HITL)', 'Operational ROI (net of HITL)')}</h2>
          <table>
            <tbody>
              <tr><td>{L('Horas liberadas/mes', 'Hours freed/month')}</td><td>{fmtNum(r.hoursFreed)}</td></tr>
              <tr><td>{L('Ahorro mensual', 'Monthly savings')}</td><td>{fmtEur(r.monthlySavingsEur)}</td></tr>
              <tr><td>{L('Ahorro anual', 'Annual savings')}</td><td>{fmtEur(r.annualSavingsEur)}</td></tr>
              <tr><td>{L('Beneficio neto año 1', 'Year-1 net benefit')}</td><td>{fmtEur(r.firstYearNetEur)}</td></tr>
              <tr><td>{L('ROI año 1 · payback', 'Year-1 ROI · payback')}</td><td>{fmtPct(r.roiPct)} · {paybackLabel(r, d.lang)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>4 · {L('Checklist de auditoría previa al despliegue', 'Pre-deployment audit checklist')} · {L('riesgo', 'risk')} {tier}</h2>
        <ul className="op-check">
          {checklist(d).map((c) => (
            <li key={c.item}>
              <span className="box" /> {c.blocking && <b>{L('[Bloqueante] ', '[Blocking] ')}</b>}
              {c.item} <i>({c.refs})</i>
            </li>
          ))}
        </ul>
      </section>
      <footer className="op-foot">
        {L('Indicadores orientativos para preventa; no constituyen asesoramiento jurídico. Escenarios y datos ficticios.', 'Indicative figures for pre-sales; not legal advice. Fictitious scenarios and data.')}
      </footer>
    </article>
  );
}
