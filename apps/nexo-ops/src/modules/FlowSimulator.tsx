import { Bug, ChevronDown, ChevronsRight, FileText, MessageSquareWarning, Pause, Play, RotateCcw, StepForward, Webhook } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Card, ComplianceBadge, Segmented, StatusBadge, Switch } from '../components/ui';
import { chaosIncidents, flowSteps, incidentFor } from '../data/cxFlowScenarios';
import { useLang } from '../i18n/lang';
import { buildCase } from '../services/flowEngine';
import type { Lang } from '../i18n/lang';
import type { Actor, Channel, FlowRun, FlowStep, IncidentId, TraceEvent } from '../types/domain';
import { fmtEur2, fmtMs, fmtT } from '../utils/format';
import { enterRef } from '../utils/motion';
import { MOBILE_QUERY, useMediaQuery } from '../utils/theme';

export interface FlowState {
  incident: IncidentId | null;
  guardrails: boolean;
  step: number; // nº de etapas reveladas (0..6)
  playing: boolean;
  selected: number | null; // índice de evento seleccionado
}

const LANES: Actor[] = ['Canal', 'Agente IA', 'CRM', 'Humano'];
const ACTOR_EN: Record<Actor, string> = { Canal: 'Channel', 'Agente IA': 'AI agent', CRM: 'CRM', Humano: 'Human' };
const STEP_MS = 1100;

const INCIDENT_META: Record<IncidentId, { short: [string, string]; Icon: typeof Bug }> = {
  prompt_injection: { short: ['Prompt injection', 'Prompt injection'], Icon: Bug },
  policy_hallucination: { short: ['Alucinación comercial', 'Commercial hallucination'], Icon: MessageSquareWarning },
  pii_webhook_leak: { short: ['Fuga de PII', 'PII leak'], Icon: Webhook },
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
  const [lang] = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const steps = flowSteps(lang);
  const incident = incidentFor(state.incident, lang);
  const { kase } = buildCase(incident, lang);
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
      label={L('Escenario', 'Scenario')}
      className="scenario-picker"
      value={state.incident ?? 'none'}
      onChange={(v) => restartWith({ incident: v === 'none' ? null : (v as IncidentId) })}
      options={[
        { value: 'none', label: <><FileText size={15} aria-hidden="true" /> {L('Caso estándar', 'Standard case')}</> },
        ...chaosIncidents(lang).map((i) => {
          const M = INCIDENT_META[i.id];
          return { value: i.id, label: <><M.Icon size={15} aria-hidden="true" /> {M.short[lang === 'en' ? 1 : 0]}</>, hint: i.title };
        }),
      ]}
    />
  );

  const guardSwitch = <Switch label={L('Guardrails de seguridad', 'Security guardrails')} checked={state.guardrails} onChange={(v) => restartWith({ guardrails: v })} className="guard-switch" />;

  const playback = (
    <div className={`playback ${mobile ? 'dock' : ''}`} role="group" aria-label={L('Reproducción', 'Playback')}>
      <button type="button" className="btn" onClick={() => set({ step: 0, playing: false, selected: null })} disabled={state.step === 0}>
        <RotateCcw size={16} aria-hidden="true" /> <span className="btn-text">{L('Reiniciar', 'Reset')}</span>
      </button>
      <button type="button" className="btn btn-primary btn-play" onClick={() => (done ? restartWith({}) : set({ playing: !state.playing }))}>
        {state.playing ? <Pause size={16} aria-hidden="true" /> : done ? <RotateCcw size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        {state.playing ? L('Pausa', 'Pause') : done ? L('Repetir', 'Replay') : L('Reproducir', 'Play')}
      </button>
      <button type="button" className="btn" onClick={() => set({ step: Math.min(total, state.step + 1), playing: false, selected: null })} disabled={done}>
        <StepForward size={16} aria-hidden="true" /> <span className="btn-text">{L('Paso', 'Step')}</span>
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => set({ step: total, playing: false, selected: null })} disabled={done}>
        <ChevronsRight size={16} aria-hidden="true" /> <span className="btn-text">{L('Ver todo', 'Show all')}</span>
      </button>
    </div>
  );

  const caseCard = (
    <Card
      className="case-card"
      title={
        <>
          {incident ? <span className="badge tone-bad">{L('Modo Caos', 'Chaos Mode')} · {lang === 'en' ? (incident.severity === 'Crítica' ? 'Critical' : 'High') : incident.severity}</span> : <span className="badge tone-neutral">{L('Caso real', 'Real case')}</span>}
          <span className="case-title">{incident?.title ?? L('Cargo duplicado en factura', 'Duplicate charge on invoice')}</span>
        </>
      }
      actions={<span className="muted small">{channelLabel(kase.channel, lang)} · {L('sesión verificada', 'verified session')} {kase.sessionCustomerId}</span>}
    >
      <pre className="payload" tabIndex={0} aria-label={L('Mensaje entrante', 'Incoming message')}>{kase.message}</pre>
      {incident && (
        <div className="refs" aria-label={L('Referencias normativas', 'Regulatory references')}>
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
        <Timeline steps={steps} events={run.events} step={state.step} selected={state.selected} onSelect={(i) => set({ selected: state.selected === i ? null : i, playing: false })} guardrails={state.guardrails} />
        {done && <Outcome run={run} counterfactual={counterfactual} guardrails={state.guardrails} hasIncident={!!incident} />}
        {playback}
      </div>
    );
  }

  return (
    <div className="module flow">
      <div className="toolbar" role="toolbar" aria-label={L('Controles del simulador', 'Simulator controls')}>
        {scenarioPicker}
        {guardSwitch}
        {playback}
      </div>

      <div className="flow-grid">
        <div className="flow-main">
          {caseCard}

          <div className="board" role="group" aria-label={L('Tablero de carriles: 6 etapas del flujo', 'Swimlane board: 6 flow stages')}>
            <div className="board-corner" />
            {steps.map((s, i) => (
              <div key={s.id} className={`board-col-head ${i < state.step ? 'reached' : ''}`}>
                <span className="col-num num-tab">{i + 1}</span> {s.label}
              </div>
            ))}
            {LANES.map((lane) => (
              <LaneRow
                key={lane}
                lane={lane}
                steps={steps}
                laneLabel={lang === 'en' ? ACTOR_EN[lane] : lane}
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
            <Card className="inspector" title={<>{L('Inspector', 'Inspector')} · {selectedEvent.seq}. {steps[selectedEvent.seq - 1]!.label}</>} actions={<><StatusBadge status={selectedEvent.status} /> <ComplianceBadge value={selectedEvent.compliance} /></>}>
              <EventDetail e={selectedEvent} guardrails={state.guardrails} steps={steps} />
            </Card>
          ) : (
            <Card title={L('Inspector de nodo', 'Node inspector')} className="inspector">
              <p className="muted">{L('Ejecuta el flujo y selecciona un nodo para ver su entrada, la decisión, los permisos y el registro de auditoría.', 'Run the flow and select a node to see its input, decision, permissions and audit record.')}</p>
            </Card>
          )}
        </div>

        <aside className="flow-side" aria-label={L('Trazabilidad y resultado', 'Traceability and outcome')}>
          <Card title={L('Trazabilidad en vivo', 'Live traceability')} actions={<span className="muted small num-tab">{state.step}/{total} {L('eventos', 'events')}</span>} className="trace-card">
            <ol className="trace" ref={consoleRef} aria-live="polite">
              {visible.length === 0 && <li className="trace-empty">{L('Pulsa Reproducir o Paso para ejecutar el caso.', 'Press Play or Step to run the case.')}</li>}
              {visible.map((e, i) => (
                <li key={`${state.incident}-${state.guardrails}-${e.seq}`} ref={enterRef}>
                  <button type="button" className={`trace-row st-${e.status} ${selectedEvent?.seq === e.seq ? 'sel' : ''}`} onClick={() => set({ selected: i, playing: false })}>
                    <span className="mono t">{fmtT(e.tMs)}</span>
                    <span className="trace-stage">#{e.seq} {steps[i]!.label}</span>
                    <StatusBadge status={e.status} compact />
                    <span className="trace-decision">{e.decision}</span>
                    <span className="trace-meta">
                      <ComplianceBadge value={e.compliance} /> <span className="muted small num-tab">{e.skipped ? L('omitido', 'skipped') : fmtMs(e.latencyMs)}</span>
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

function LaneRow({ lane, laneLabel, steps, events, step, selectedSeq, onSelect }: { lane: Actor; laneLabel: string; steps: FlowStep[]; events: TraceEvent[]; step: number; selectedSeq?: number; onSelect: (idx: number) => void }) {
  const [lang] = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  return (
    <>
      <div className="lane-head">{laneLabel}</div>
      {steps.map((s, i) => {
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
              aria-label={`${L('Etapa', 'Stage')} ${i + 1}: ${s.label}${reached ? ` — ${e.status}` : L(' — pendiente', ' — pending')}`}
            >
              <span className="node-title">{s.label}</span>
              {reached ? <StatusBadge status={e.status} compact /> : <span className="badge tone-neutral">{L('Pendiente', 'Pending')}</span>}
              {reached && <span className="node-lat num-tab">{e.skipped ? '—' : fmtMs(e.latencyMs)}</span>}
            </button>
          </div>
        );
      })}
    </>
  );
}

/** Móvil: los 6 carriles se convierten en una línea de tiempo vertical con detalle desplegable. */
function Timeline({ steps, events, step, selected, onSelect, guardrails }: { steps: FlowStep[]; events: TraceEvent[]; step: number; selected: number | null; onSelect: (i: number) => void; guardrails: boolean }) {
  const [lang] = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  return (
    <ol className="timeline" aria-label={L('Etapas del flujo', 'Flow stages')} aria-live="polite">
      {steps.map((s, i) => {
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
                  <span className="tl-actor">{lang === 'en' ? ACTOR_EN[s.actor] : s.actor}</span>
                </span>
                {reached ? <StatusBadge status={e.status} compact /> : <span className="badge tone-neutral">{L('Pendiente', 'Pending')}</span>}
                {reached && <ChevronDown size={16} className="tl-chev" aria-hidden="true" />}
              </button>
              {reached && <p className="tl-decision">{e.decision}</p>}
              {open && (
                <div className="tl-detail">
                  <EventDetail e={e} guardrails={guardrails} steps={steps} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function EventDetail({ e, guardrails, steps }: { e: TraceEvent; guardrails: boolean; steps: FlowStep[] }) {
  const [lang] = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const step = steps.find((s) => s.stage === e.stage)!;
  return (
    <>
      <dl className="kv">
        <dt>{L('Decisión', 'Decision')}</dt>
        <dd>{e.decision}</dd>
        <dt>{L('Permiso usado', 'Permission used')}</dt>
        <dd className="mono">{e.permission}</dd>
        <dt>{L('Control', 'Control')}</dt>
        <dd>{guardrails ? step.guardrailControl : <span className="tone-text-bad">{L('Sin control activo', 'No active control')}</span>}</dd>
        <dt>{L('Marca temporal', 'Timestamp')}</dt>
        <dd className="mono">{fmtT(e.tMs)} · {e.skipped ? L('omitido', 'skipped') : fmtMs(e.latencyMs)}</dd>
      </dl>
      <div className="dual">
        <div>
          <h3>{L('Qué pasa técnicamente', 'What happens technically')}</h3>
          <p>{e.technical}</p>
        </div>
        <div className="dual-biz">
          <h3>{L('Qué significa para el negocio', 'What it means for the business')}</h3>
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
            <h3>{e.payloadAfter ? L('Antes del control', 'Before the control') : L('Payload enviado (en claro)', 'Payload sent (clear text)')}</h3>
            <pre className="payload" tabIndex={0}>{e.payloadBefore}</pre>
          </div>
          {e.payloadAfter && (
            <div>
              <h3>{L('Después del control', 'After the control')}</h3>
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
  const [lang] = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const o = run.outcome;
  const verdict = o.kind === 'breach' ? L('Incidente materializado', 'Incident materialised') : o.kind === 'contained' ? L('Incidente contenido', 'Incident contained') : L('Resuelto en política', 'Resolved within policy');
  return (
    <div className={`outcome outcome-${o.kind}`}>
      <h3>{title}</h3>
      <p className="outcome-head">{verdict}</p>
      <div className="metrics">
        <Metric label={L('fichas de terceros', 'third-party records')} value={String(o.recordsExposed)} bad={o.recordsExposed > 0} />
        <Metric label={L('datos personales en claro', 'personal data in clear text')} value={String(o.piiFieldsExposed)} bad={o.piiFieldsExposed > 0} />
        <Metric label={L('fuera de política', 'out of policy')} value={fmtEur2(o.unauthorizedCommitmentEur)} bad={o.unauthorizedCommitmentEur > 0} />
      </div>
      <p className="small muted outcome-controls">{o.controlsFired.length} {L('control(es) activado(s)', 'control(s) triggered')}</p>
    </div>
  );
}

function Outcome({ run, counterfactual, guardrails, hasIncident }: { run: FlowRun; counterfactual: FlowRun; guardrails: boolean; hasIncident: boolean }) {
  const [lang] = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const [off, on] = guardrails ? [counterfactual, run] : [run, counterfactual];
  return (
    <div ref={enterRef} className="compare">
      <Card title={L('Antes / después de los guardrails', 'Before / after guardrails')}>
        <div className="compare-grid">
          <OutcomeCard run={off} title={L('Implementación ingenua', 'Naive implementation')} />
          <OutcomeCard run={on} title={L('Arquitectura auditada', 'Audited architecture')} />
        </div>
        {!hasIncident && (
          <p className="small note">
            {L(
              'Sin incidente, ambas versiones dan el mismo resultado. Por eso el riesgo pasa desapercibido hasta producción: activa el Modo Caos.',
              'With no incident, both versions give the same result. That is why the risk goes unnoticed until production: turn on Chaos Mode.',
            )}
          </p>
        )}
      </Card>
    </div>
  );
}

function channelLabel(c: Channel, lang: Lang): string {
  if (lang === 'es') return c;
  return { Email: 'Email', WhatsApp: 'WhatsApp', Ticket: 'Ticket' }[c];
}
