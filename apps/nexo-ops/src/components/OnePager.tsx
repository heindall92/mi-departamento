import { FLOW_STEPS } from '../data/cxFlowScenarios';
import { checklist, paybackLabel, type ReportData } from '../services/reportExporter';
import { fmtEur, fmtNum, fmtPct } from '../utils/format';

const ST_LABEL = { ok: 'OK', warning: 'Aviso', blocked: 'Bloqueado', escalated: 'HITL', leak: 'FUGA' } as const;

/** Vista de impresión A4 (una página). Solo visible con @media print. */
export function OnePager({ d }: { d: ReportData }) {
  const o = d.flow.run.outcome;
  const ev = d.tender.evaluation;
  const r = d.roi.result;
  const effort = d.tender.effort.reduce((s, p) => s + p.totalDays, 0);
  const cf = d.flow.counterfactual?.outcome;
  return (
    <article className="onepager" aria-hidden="true">
      <header className="op-head">
        <div>
          <h1>NEXO-OPS · One-Pager Ejecutivo</h1>
          <p>Automatización con IA agéntica: seguridad, licitación y retorno en una página.</p>
        </div>
        <div className="op-meta">
          {d.generatedAt}
          <br />Procesado en el navegador (Zero-Egress)
        </div>
      </header>

      <section className="op-kpis">
        <div className={`op-kpi op-${o.kind}`}>
          <span>Seguridad del flujo</span>
          <strong>{o.kind === 'breach' ? 'Incidente' : o.kind === 'contained' ? 'Contenido' : 'Resuelto'}</strong>
          <em>Guardrails {d.flow.guardrails ? 'ON' : 'OFF'}</em>
        </div>
        <div className={`op-kpi op-v-${ev.verdict}`}>
          <span>Licitación</span>
          <strong>{ev.verdict}</strong>
          <em>{ev.total}/100</em>
        </div>
        <div className="op-kpi">
          <span>ROI año 1</span>
          <strong>{fmtPct(r.roiPct)}</strong>
          <em>payback {paybackLabel(r)}</em>
        </div>
        <div className="op-kpi">
          <span>Riesgo IA</span>
          <strong>{d.roi.risk.tier}</strong>
          <em>{d.roi.risk.aiActCategory.split(' — ')[0]}</em>
        </div>
      </section>

      <section>
        <h2>1 · Flujo CX/CRM — {d.flow.incidentTitle ?? 'caso estándar'}</h2>
        <ol className="op-flow">
          {d.flow.run.events.map((e, i) => (
            <li key={e.seq} className={`op-st-${e.status}`}>
              <b>{i + 1}. {FLOW_STEPS[i]!.label}</b>
              <span>{ST_LABEL[e.status]}</span>
            </li>
          ))}
        </ol>
        <p>
          {o.headline} {o.controlsFired.length ? `Controles: ${o.controlsFired.join(', ')}.` : ''}
          {cf && d.flow.incidentTitle
            ? ` Sin guardrails: ${cf.recordsExposed} fichas de terceros, ${cf.piiFieldsExposed} datos personales en claro, ${fmtEur(cf.unauthorizedCommitmentEur)} comprometidos fuera de política.`
            : ''}
        </p>
      </section>

      <section className="op-two">
        <div>
          <h2>2 · {d.tender.scenario.title}</h2>
          <p><strong>{ev.verdict} ({ev.total}/100).</strong> {ev.explanation}</p>
          <table>
            <tbody>
              <tr><td>Encaje técnico</td><td>{ev.dimensions.technicalFit}</td></tr>
              <tr><td>Preparación normativa</td><td>{ev.dimensions.compliance}</td></tr>
              <tr><td>Holgura de plazo</td><td>{ev.dimensions.deadline}</td></tr>
              <tr><td>Riesgo contractual</td><td>{ev.dimensions.contractual}</td></tr>
              <tr><td>Esfuerzo estimado</td><td>{fmtNum(effort)} jornadas</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h2>3 · ROI operativo (neto de HITL)</h2>
          <table>
            <tbody>
              <tr><td>Horas liberadas/mes</td><td>{fmtNum(r.hoursFreed)}</td></tr>
              <tr><td>Ahorro mensual</td><td>{fmtEur(r.monthlySavingsEur)}</td></tr>
              <tr><td>Ahorro anual</td><td>{fmtEur(r.annualSavingsEur)}</td></tr>
              <tr><td>Beneficio neto año 1</td><td>{fmtEur(r.firstYearNetEur)}</td></tr>
              <tr><td>ROI año 1 · payback</td><td>{fmtPct(r.roiPct)} · {paybackLabel(r)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>4 · Checklist de auditoría previa al despliegue · riesgo {d.roi.risk.tier}</h2>
        <ul className="op-check">
          {checklist(d).map((c) => (
            <li key={c.item}>
              <span className="box" /> {c.blocking && <b>[Bloqueante] </b>}
              {c.item} <i>({c.refs})</i>
            </li>
          ))}
        </ul>
      </section>
      <footer className="op-foot">Indicadores orientativos para preventa; no constituyen asesoramiento jurídico. Escenarios y datos ficticios.</footer>
    </article>
  );
}
