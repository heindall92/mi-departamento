import { useEffect, useRef } from 'react';
import { Card, ComplianceBadge, Segmented, StatusBadge, Switch } from '../components/ui';
import { CHAOS_INCIDENTS, FLOW_STEPS, incidentById } from '../data/cxFlowScenarios';
import { buildCase } from '../services/flowEngine';
import type { Actor, FlowRun, IncidentId, TraceEvent } from '../types/domain';
import { fmtEur2, fmtMs, fmtT } from '../utils/format';

export interface FlowState {
  incident: IncidentId | null;
  guardrails: boolean;
  step: number; // nº de etapas reveladas (0..6)
  playing: boolean;
  selected: number | null; // índice de evento seleccionado
}

const LANES: Actor[] = ['Canal', 'Agente IA', 'CRM', 'Humano'];
const STEP_MS = 1100;

export function FlowSimulator({
  state,
  setState,
  run,
  counterfactual,
}: {
  state: FlowState;
  setState: (u: (s: FlowState) => FlowState) => void;
  run: FlowRun;
  counterfactual: FlowRun;
}) {
  const incident = incidentById(state.incident);
  const { kase } = buildCase(incident);
  const total = run.events.length;
  const done = state.step >= total;
  const visible = run.events.slice(0, state.step);
  const selectedEvent = state.selected !== null && state.selected < state.step ? run.events[state.selected] : visible[visible.length - 1];

  // Reproducción automática (determinista: un paso por tick).
  useEffect(() => {
    if (!state.playing) return;
    if (state.step >= total) {
      setState((s) => ({ ...s, playing: false }));
      return;
    }
    const id = window.setTimeout(() => setState((s) => ({ ...s, step: s.step + 1, selected: null })), state.step === 0 ? 250 : STEP_MS);
    return () => window.clearTimeout(id);
  }, [state.playing, state.step, total, setState]);

  const set = (patch: Partial<FlowState>) => setState((s) => ({ ...s, ...patch }));
  const restartWith = (patch: Partial<FlowState>) => setState((s) => ({ ...s, ...patch, step: 0, playing: true, selected: null }));

  const consoleRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.step]);

  return (
    <div className="module flow">
      <div className="toolbar" role="toolbar" aria-label="Controles del simulador">
        <Segmented<string>
          label="Escenario"
          value={state.incident ?? 'none'}
          onChange={(v) => restartWith({ incident: v === 'none' ? null : (v as IncidentId) })}
          options={[
            { value: 'none', label: 'Caso estándar' },
            ...CHAOS_INCIDENTS.map((i) => ({ value: i.id, label: <><span aria-hidden="true">⚡</span> {shortTitle(i.id)}</>, hint: i.title })),
          ]}
        />
        <Switch
          label="Guardrails de seguridad"
          checked={state.guardrails}
          onChange={(v) => restartWith({ guardrails: v })}
        />
        <div className="playback">
          <button type="button" className="btn" onClick={() => set({ step: 0, playing: false, selected: null })} disabled={state.step === 0}>
            ⏮ Reiniciar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => (done ? restartWith({}) : set({ playing: !state.playing }))}>
            {state.playing ? '⏸ Pausa' : done ? '↻ Repetir' : '▶ Reproducir'}
          </button>
          <button type="button" className="btn" onClick={() => set({ step: Math.min(total, state.step + 1), playing: false, selected: null })} disabled={done}>
            Paso ▸
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => set({ step: total, playing: false, selected: null })} disabled={done}>
            Ver todo
          </button>
        </div>
      </div>

      <div className="flow-grid">
        <div className="flow-main">
          <Card
            className="case-card"
            title={
              <>
                {incident ? <span className="badge tone-bad">Modo Caos · {incident.severity}</span> : <span className="badge tone-neutral">Caso real</span>}{' '}
                {incident?.title ?? 'Cargo duplicado en factura'}
              </>
            }
            actions={<span className="muted small">{kase.channel} · sesión verificada {kase.sessionCustomerId}</span>}
          >
            <pre className="payload" aria-label="Mensaje entrante">{kase.message}</pre>
            {incident && (
              <div className="refs" aria-label="Referencias normativas">
                {incident.complianceRefs.map((r) => (
                  <span key={r} className="chip">{r}</span>
                ))}
              </div>
            )}
          </Card>

          <div className="board" role="group" aria-label="Tablero de carriles: 6 etapas del flujo">
            <div className="board-corner" />
            {FLOW_STEPS.map((s, i) => (
              <div key={s.id} className={`board-col-head ${i < state.step ? 'reached' : ''}`}>
                <span className="col-num">{i + 1}</span> {s.label}
              </div>
            ))}
            {LANES.map((lane) => (
              <LaneRow
                key={lane}
                lane={lane}
                events={run.events}
                step={state.step}
                selectedSeq={selectedEvent?.seq}
                onSelect={(idx) => set({ selected: idx, playing: false })}
              />
            ))}
            <div className="board-progress" aria-hidden="true">
              <div style={{ width: `${(state.step / total) * 100}%` }} />
            </div>
          </div>

          {selectedEvent ? <Inspector e={selectedEvent} guardrails={state.guardrails} /> : <EmptyInspector />}
        </div>

        <aside className="flow-side">
          <Card title="Trazabilidad en vivo" actions={<span className="muted small">{state.step}/{total} eventos</span>} className="trace-card">
            <ol className="trace" ref={consoleRef} aria-live="polite">
              {visible.length === 0 && <li className="trace-empty">Pulsa ▶ Reproducir o «Paso ▸» para ejecutar el caso.</li>}
              {visible.map((e, i) => (
                <li key={e.seq}>
                  <button type="button" className={`trace-row st-${e.status} ${selectedEvent?.seq === e.seq ? 'sel' : ''}`} onClick={() => set({ selected: i, playing: false })}>
                    <span className="mono t">{fmtT(e.tMs)}</span>
                    <span className="trace-stage">#{e.seq} {FLOW_STEPS[i]!.label}</span>
                    <StatusBadge status={e.status} compact />
                    <span className="trace-decision">{e.decision}</span>
                    <span className="trace-meta">
                      <ComplianceBadge value={e.compliance} /> <span className="muted small">{e.skipped ? 'omitido' : fmtMs(e.latencyMs)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </Card>
          {done && <Outcome run={run} counterfactual={counterfactual} guardrails={state.guardrails} hasIncident={!!incident} />}
        </aside>
      </div>
    </div>
  );
}

function shortTitle(id: IncidentId): string {
  return { prompt_injection: 'Prompt injection', policy_hallucination: 'Alucinación comercial', pii_webhook_leak: 'Fuga de PII' }[id];
}

function LaneRow({
  lane,
  events,
  step,
  selectedSeq,
  onSelect,
}: {
  lane: Actor;
  events: TraceEvent[];
  step: number;
  selectedSeq?: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <>
      <div className="lane-head">{lane}</div>
      {FLOW_STEPS.map((s, i) => {
        if (s.actor !== lane) return <div key={s.id} className="lane-cell" />;
        const e = events[i]!;
        const reached = i < step;
        const current = i === step - 1;
        return (
          <div key={s.id} className="lane-cell">
            <button
              type="button"
              className={`node ${reached ? `st-${e.status}` : 'pending'} ${current ? 'current' : ''} ${selectedSeq === e.seq && reached ? 'sel' : ''} ${e.skipped && reached ? 'skipped' : ''}`}
              disabled={!reached}
              onClick={() => onSelect(i)}
              aria-label={`Etapa ${i + 1}: ${s.label}${reached ? ` — ${e.status}` : ' — pendiente'}`}
            >
              <span className="node-title">{s.label}</span>
              {reached ? <StatusBadge status={e.status} compact /> : <span className="badge tone-neutral">Pendiente</span>}
              {reached && <span className="node-lat">{e.skipped ? '—' : fmtMs(e.latencyMs)}</span>}
            </button>
          </div>
        );
      })}
    </>
  );
}

function EmptyInspector() {
  return (
    <Card title="Inspector de nodo" className="inspector">
      <p className="muted">Ejecuta el flujo y selecciona un nodo para ver entrada, decisión, permisos y registro de auditoría.</p>
    </Card>
  );
}

function Inspector({ e, guardrails }: { e: TraceEvent; guardrails: boolean }) {
  const step = FLOW_STEPS.find((s) => s.stage === e.stage)!;
  return (
    <Card
      className="inspector"
      title={<>Inspector · {e.seq}. {step.label}</>}
      actions={<><StatusBadge status={e.status} /> <ComplianceBadge value={e.compliance} /></>}
    >
      <dl className="kv">
        <dt>Decisión</dt>
        <dd>{e.decision}</dd>
        <dt>Permiso usado</dt>
        <dd className="mono">{e.permission}</dd>
        <dt>Control</dt>
        <dd>{guardrails ? step.guardrailControl : <span className="tone-text-bad">Sin control activo</span>}</dd>
      </dl>
      <div className="dual">
        <div>
          <h3>Qué pasa técnicamente</h3>
          <p>{e.technical}</p>
        </div>
        <div>
          <h3>Qué significa para el negocio</h3>
          <p>{e.business}</p>
        </div>
      </div>
      {e.findings.length > 0 && (
        <ul className="findings">
          {e.findings.map((f) => (
            <li key={f} className="mono">{f}</li>
          ))}
        </ul>
      )}
      {e.payloadBefore && (
        <div className={`diff ${e.payloadAfter ? '' : 'diff-single'}`}>
          <div>
            <h3>{e.payloadAfter ? 'Antes del control' : 'Payload enviado (en claro)'}</h3>
            <pre className="payload">{e.payloadBefore}</pre>
          </div>
          {e.payloadAfter && (
            <div>
              <h3>Después del control</h3>
              <pre className="payload payload-safe">{e.payloadAfter}</pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <div className={`metric ${bad ? 'is-bad' : 'is-good'}`}>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

function OutcomeCard({ run, title }: { run: FlowRun; title: string }) {
  const o = run.outcome;
  const icon = o.kind === 'breach' ? '✕' : o.kind === 'contained' ? '⛔' : '✓';
  const verdict = o.kind === 'breach' ? 'Incidente materializado' : o.kind === 'contained' ? 'Incidente contenido' : 'Resuelto en política';
  return (
    <div className={`outcome outcome-${o.kind}`}>
      <h3>{title}</h3>
      <p className="outcome-head">
        <span aria-hidden="true">{icon}</span> {verdict}
      </p>
      <div className="metrics">
        <Metric label="fichas de terceros" value={String(o.recordsExposed)} bad={o.recordsExposed > 0} />
        <Metric label="datos personales en claro" value={String(o.piiFieldsExposed)} bad={o.piiFieldsExposed > 0} />
        <Metric label="fuera de política" value={fmtEur2(o.unauthorizedCommitmentEur)} bad={o.unauthorizedCommitmentEur > 0} />
      </div>
      <p className="small muted outcome-controls">{o.controlsFired.length} control(es) activado(s)</p>
    </div>
  );
}

function Outcome({ run, counterfactual, guardrails, hasIncident }: { run: FlowRun; counterfactual: FlowRun; guardrails: boolean; hasIncident: boolean }) {
  const [off, on] = guardrails ? [counterfactual, run] : [run, counterfactual];
  return (
    <Card title="Antes / después de los guardrails" className="compare">
      <div className="compare-grid">
        <OutcomeCard run={off} title="Implementación ingenua" />
        <OutcomeCard run={on} title="Arquitectura auditada" />
      </div>
      {!hasIncident && (
        <p className="small note">
          Sin incidente, ambas versiones dan el mismo resultado. Por eso el riesgo pasa desapercibido hasta producción: activa el Modo Caos.
        </p>
      )}
    </Card>
  );
}
