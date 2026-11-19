import { Bug, ChevronDown, ChevronsRight, FileText, MessageSquareWarning, Pause, Play, RotateCcw, StepForward, Webhook } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Card, ComplianceBadge, Segmented, StatusBadge, Switch } from '../components/ui';
import { CHAOS_INCIDENTS, FLOW_STEPS, incidentById } from '../data/cxFlowScenarios';
import { buildCase } from '../services/flowEngine';
import type { Actor, FlowRun, IncidentId, TraceEvent } from '../types/domain';
import { fmtEur2, fmtMs, fmtT } from '../utils/format';
import { MOBILE_QUERY, useMediaQuery } from '../utils/theme';

export interface FlowState {
  incident: IncidentId | null;
  guardrails: boolean;
  step: number; // nº de etapas reveladas (0..6)
  playing: boolean;
  selected: number | null; // índice de evento seleccionado
}

const LANES: Actor[] = ['Canal', 'Agente IA', 'CRM', 'Humano'];
const STEP_MS = 1100;

const INCIDENT_META: Record<IncidentId, { short: string; Icon: typeof Bug }> = {
  prompt_injection: { short: 'Prompt injection', Icon: Bug },
  policy_hallucination: { short: 'Alucinación comercial', Icon: MessageSquareWarning },
  pii_webhook_leak: { short: 'Fuga de PII', Icon: Webhook },
};

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
  const mobile = useMediaQuery(MOBILE_QUERY);
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

  const scenarioPicker = (
    <Segmented<string>
      label="Escenario"
      className="scenario-picker"
      value={state.incident ?? 'none'}
      onChange={(v) => restartWith({ incident: v === 'none' ? null : (v as IncidentId) })}
      options={[
        { value: 'none', label: <><FileText size={15} aria-hidden="true" /> Caso estándar</> },
        ...CHAOS_INCIDENTS.map((i) => {
          const M = INCIDENT_META[i.id];
          return { value: i.id, label: <><M.Icon size={15} aria-hidden="true" /> {M.short}</>, hint: i.title };
        }),
      ]}
    />
  );

  const guardSwitch = <Switch label="Guardrails de seguridad" checked={state.guardrails} onChange={(v) => restartWith({ guardrails: v })} className="guard-switch" />;

  const playback = (
    <div className={`playback ${mobile ? 'dock' : ''}`} role="group" aria-label="Reproducción">
      <button type="button" className="btn" onClick={() => set({ step: 0, playing: false, selected: null })} disabled={state.step === 0}>
        <RotateCcw size={16} aria-hidden="true" /> <span className="btn-text">Reiniciar</span>
      </button>
      <button type="button" className="btn btn-primary btn-play" onClick={() => (done ? restartWith({}) : set({ playing: !state.playing }))}>
        {state.playing ? <Pause size={16} aria-hidden="true" /> : done ? <RotateCcw size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        {state.playing ? 'Pausa' : done ? 'Repetir' : 'Reproducir'}
      </button>
      <button type="button" className="btn" onClick={() => set({ step: Math.min(total, state.step + 1), playing: false, selected: null })} disabled={done}>
        <StepForward size={16} aria-hidden="true" /> <span className="btn-text">Paso</span>
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => set({ step: total, playing: false, selected: null })} disabled={done}>
        <ChevronsRight size={16} aria-hidden="true" /> <span className="btn-text">Ver todo</span>
      </button>
    </div>
  );

  const caseCard = (
    <Card
      className="case-card"
      title={
        <>
          {incident ? <span className="badge tone-bad">Modo Caos · {incident.severity}</span> : <span className="badge tone-neutral">Caso real</span>}
          <span className="case-title">{incident?.title ?? 'Cargo duplicado en factura'}</span>
        </>
      }
      actions={<span className="muted small">{kase.channel} · sesión verificada {kase.sessionCustomerId}</span>}
    >
      <pre className="payload" tabIndex={0} aria-label="Mensaje entrante">{kase.message}</pre>
      {incident && (
        <div className="refs" aria-label="Referencias normativas">
          {incident.complianceRefs.map((r) => (
            <span key={r} className="chip">{r}</span>
          ))}
        </div>
      )}
    </Card>
  );

  if (mobile) {
    return (
      <div className="module flow flow-mobile">
        <div className="mobile-controls">
          {scenarioPicker}
          {guardSwitch}
        </div>
        {caseCard}
        <Timeline events={run.events} step={state.step} selected={state.selected} onSelect={(i) => set({ selected: state.selected === i ? null : i, playing: false })} guardrails={state.guardrails} />
        {done && <Outcome run={run} counterfactual={counterfactual} guardrails={state.guardrails} hasIncident={!!incident} />}
        {playback}
      </div>
    );
  }

  return (
    <div className="module flow">
      <div className="toolbar" role="toolbar" aria-label="Controles del simulador">
        {scenarioPicker}
        {guardSwitch}
        {playback}
      </div>

      <div className="flow-grid">
        <div className="flow-main">
          {caseCard}

          <div className="board" role="group" aria-label="Tablero de carriles: 6 etapas del flujo">
            <div className="board-corner" />
            {FLOW_STEPS.map((s, i) => (
              <div key={s.id} className={`board-col-head ${i < state.step ? 'reached' : ''}`}>
                <span className="col-num num-tab">{i + 1}</span> {s.label}
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
              <div style={{ transform: `scaleX(${state.step / total})` }} />
            </div>
          </div>

          {selectedEvent ? (
            <Card className="inspector" title={<>Inspector · {selectedEvent.seq}. {FLOW_STEPS[selectedEvent.seq - 1]!.label}</>} actions={<><StatusBadge status={selectedEvent.status} /> <ComplianceBadge value={selectedEvent.compliance} /></>}>
              <EventDetail e={selectedEvent} guardrails={state.guardrails} />
            </Card>
          ) : (
            <Card title="Inspector de nodo" className="inspector">
              <p className="muted">Ejecuta el flujo y selecciona un nodo para ver su entrada, la decisión, los permisos y el registro de auditoría.</p>
            </Card>
          )}
        </div>

        <aside className="flow-side" aria-label="Trazabilidad y resultado">
          <Card title="Trazabilidad en vivo" actions={<span className="muted small num-tab">{state.step}/{total} eventos</span>} className="trace-card">
            <ol className="trace" ref={consoleRef} aria-live="polite">
              {visible.length === 0 && <li className="trace-empty">Pulsa Reproducir o Paso para ejecutar el caso.</li>}
              {visible.map((e, i) => (
                <li key={`${state.incident}-${state.guardrails}-${e.seq}`} className="enter">
                  <button type="button" className={`trace-row st-${e.status} ${selectedEvent?.seq === e.seq ? 'sel' : ''}`} onClick={() => set({ selected: i, playing: false })}>
                    <span className="mono t">{fmtT(e.tMs)}</span>
                    <span className="trace-stage">#{e.seq} {FLOW_STEPS[i]!.label}</span>
                    <StatusBadge status={e.status} compact />
                    <span className="trace-decision">{e.decision}</span>
                    <span className="trace-meta">
                      <ComplianceBadge value={e.compliance} /> <span className="muted small num-tab">{e.skipped ? 'omitido' : fmtMs(e.latencyMs)}</span>
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

function LaneRow({ lane, events, step, selectedSeq, onSelect }: { lane: Actor; events: TraceEvent[]; step: number; selectedSeq?: number; onSelect: (idx: number) => void }) {
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
              {reached && <span className="node-lat num-tab">{e.skipped ? '—' : fmtMs(e.latencyMs)}</span>}
            </button>
          </div>
        );
      })}
    </>
  );
}

/** Móvil: los 6 carriles se convierten en una línea de tiempo vertical con detalle desplegable. */
function Timeline({ events, step, selected, onSelect, guardrails }: { events: TraceEvent[]; step: number; selected: number | null; onSelect: (i: number) => void; guardrails: boolean }) {
  return (
    <ol className="timeline" aria-label="Etapas del flujo" aria-live="polite">
      {FLOW_STEPS.map((s, i) => {
        const e = events[i]!;
        const reached = i < step;
        const open = reached && selected === i;
        return (
          <li key={s.id} className={`tl-item ${reached ? `st-${e.status} reached` : 'pending'} ${i === step - 1 ? 'current' : ''}`}>
            <span className="tl-dot num-tab" aria-hidden="true">{i + 1}</span>
            <div className="tl-body">
              <button type="button" className="tl-head" disabled={!reached} aria-expanded={open} onClick={() => onSelect(i)}>
                <span className="tl-title">
                  {s.label}
                  <span className="tl-actor">{s.actor}</span>
                </span>
                {reached ? <StatusBadge status={e.status} compact /> : <span className="badge tone-neutral">Pendiente</span>}
                {reached && <ChevronDown size={16} className="tl-chev" aria-hidden="true" />}
              </button>
              {reached && <p className="tl-decision">{e.decision}</p>}
              {open && (
                <div className="tl-detail">
                  <EventDetail e={e} guardrails={guardrails} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function EventDetail({ e, guardrails }: { e: TraceEvent; guardrails: boolean }) {
  const step = FLOW_STEPS.find((s) => s.stage === e.stage)!;
  return (
    <>
      <dl className="kv">
        <dt>Decisión</dt>
        <dd>{e.decision}</dd>
        <dt>Permiso usado</dt>
        <dd className="mono">{e.permission}</dd>
        <dt>Control</dt>
        <dd>{guardrails ? step.guardrailControl : <span className="tone-text-bad">Sin control activo</span>}</dd>
        <dt>Marca temporal</dt>
        <dd className="mono">{fmtT(e.tMs)} · {e.skipped ? 'omitido' : fmtMs(e.latencyMs)}</dd>
      </dl>
      <div className="dual">
        <div>
          <h3>Qué pasa técnicamente</h3>
          <p>{e.technical}</p>
        </div>
        <div className="dual-biz">
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
            <pre className="payload" tabIndex={0}>{e.payloadBefore}</pre>
          </div>
          {e.payloadAfter && (
            <div>
              <h3>Después del control</h3>
              <pre className="payload payload-safe" tabIndex={0}>{e.payloadAfter}</pre>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Metric({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <div className={`metric ${bad ? 'is-bad' : 'is-good'}`}>
      <span className="metric-value num-tab">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

function OutcomeCard({ run, title }: { run: FlowRun; title: string }) {
  const o = run.outcome;
  const verdict = o.kind === 'breach' ? 'Incidente materializado' : o.kind === 'contained' ? 'Incidente contenido' : 'Resuelto en política';
  return (
    <div className={`outcome outcome-${o.kind}`}>
      <h3>{title}</h3>
      <p className="outcome-head">{verdict}</p>
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
    <Card title="Antes / después de los guardrails" className="compare enter">
      <div className="compare-grid">
        <OutcomeCard run={off} title="Implementación ingenua" />
        <OutcomeCard run={on} title="Arquitectura auditada" />
      </div>
      {!hasIncident && (
        <p className="small note">Sin incidente, ambas versiones dan el mismo resultado. Por eso el riesgo pasa desapercibido hasta producción: activa el Modo Caos.</p>
      )}
    </Card>
  );
}
