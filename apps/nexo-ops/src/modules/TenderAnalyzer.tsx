import { useRef } from 'react';
import { Card, Meter, Segmented, SliderField } from '../components/ui';
import { CAPABILITIES, TENDER_SCENARIOS } from '../data/tenderScenarios';
import { parseTender } from '../services/deterministicParser';
import { analyzeTenderWithAi, LlmError } from '../services/llmAdapter';
import { isMet, RISK_WEIGHT, type Capabilities, type ClauseOverrides, type EffortPhase } from '../services/tenderScoring';
import type { AiSettings, CapabilityId, ClauseCategory, TenderClause, TenderEvaluation, TenderScenario, TenderWeights, Verdict } from '../types/domain';
import { fmtEur, fmtNum } from '../utils/format';

export interface TenderState {
  scenarioId: string; // 'cx_omnicanal' | 'ia_regulada' | 'pasted'
  caps: Capabilities;
  weights: TenderWeights;
  fte: number;
  overrides: ClauseOverrides;
  pastedText: string;
  pasted: TenderScenario | null;
  parseNotes: string[];
  ai: { state: 'idle' | 'loading' | 'done' | 'error'; message?: string };
  aiClauses: TenderClause[];
}

const BLOCKS: { cat: ClauseCategory; title: string; hint: string }[] = [
  { cat: 'excluyente', title: 'Requisitos excluyentes', hint: 'Si uno falla, la oferta no se valora.' },
  { cat: 'plazo', title: 'Plazos críticos y penalizaciones', hint: 'Ritmo del proyecto y coste de cada desviación.' },
  { cat: 'tecnico', title: 'Entregables técnicos', hint: 'Lo que hay que construir.' },
  { cat: 'cumplimiento', title: 'Cláusulas de seguridad y cumplimiento', hint: 'RGPD · ENS · ISO 27001 · ISO 42001 · EU AI Act.' },
  { cat: 'dependencia', title: 'Dependencias con terceros', hint: 'Riesgo fuera de nuestro control.' },
];

const WEIGHT_LABELS: Record<keyof TenderWeights, string> = {
  technicalFit: 'Encaje técnico',
  compliance: 'Preparación normativa',
  deadline: 'Holgura de plazo',
  contractual: 'Riesgo contractual',
};

export function TenderAnalyzer({
  state,
  setState,
  scenario,
  evaluation,
  effort,
  outline,
  ai,
  onOpenSettings,
  onFallbackToLocal,
}: {
  state: TenderState;
  setState: (u: (s: TenderState) => TenderState) => void;
  scenario: TenderScenario | null;
  evaluation: TenderEvaluation | null;
  effort: EffortPhase[];
  outline: string[];
  ai: AiSettings;
  onOpenSettings: () => void;
  onFallbackToLocal: () => void;
}) {
  const set = (patch: Partial<TenderState>) => setState((s) => ({ ...s, ...patch }));
  const abortRef = useRef<AbortController | null>(null);

  const analyzeLocal = () => {
    const r = parseTender(state.pastedText);
    set({ pasted: r.scenario, parseNotes: r.notes, overrides: {}, aiClauses: [], ai: { state: 'idle' } });
  };

  const enrich = async () => {
    if (!state.pasted) analyzeLocal();
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    set({ ai: { state: 'loading', message: 'Redactando PII y consultando el modelo…' } });
    try {
      const r = await analyzeTenderWithAi(state.pastedText, ai, ctrl.signal);
      setState((s) => ({
        ...s,
        aiClauses: r.clauses,
        ai: { state: 'done', message: `${r.clauses.length} cláusula(s) añadidas por ${r.provider}. PII redactada antes de enviar: ${r.redactedCount}.` },
      }));
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const msg = err instanceof LlmError ? err.message : 'Error inesperado.';
      setState((s) => ({ ...s, ai: { state: 'error', message: msg } }));
    }
  };

  const toggleClause = (c: TenderClause) => {
    if (c.requires) {
      const id = c.requires;
      setState((s) => ({ ...s, caps: { ...s.caps, [id]: !s.caps[id] } }));
    } else {
      setState((s) => ({ ...s, overrides: { ...s.overrides, [c.id]: !isMet(c, s.caps, s.overrides) } }));
    }
  };

  const totalEffort = effort.reduce((s, p) => s + p.totalDays, 0);

  return (
    <div className="module tender">
      <div className="toolbar" role="toolbar" aria-label="Controles del analizador">
        <Segmented<string>
          label="Pliego"
          value={state.scenarioId}
          onChange={(v) => set({ scenarioId: v })}
          options={[
            ...TENDER_SCENARIOS.map((s) => ({ value: s.id, label: s.title.split(' · ')[0] + ' · ' + shortTender(s.id), hint: s.title })),
            { value: 'pasted', label: '✎ Pegar pliego real' },
          ]}
        />
        {scenario && (
          <span className="muted small toolbar-meta">
            {scenario.sector} · plazo {fmtNum(scenario.deadlineDays)} días{scenario.budgetEur ? ` · ${fmtEur(scenario.budgetEur)} sin IVA` : ''}
          </span>
        )}
      </div>

      <div className="tender-grid">
        <div className="tender-side">
          {evaluation && scenario ? (
            <VerdictCard evaluation={evaluation} />
          ) : (
            <Card title="Veredicto">
              <p className="muted">Pega el texto de un pliego y pulsa «Analizar».</p>
            </Card>
          )}

          {evaluation && (
            <Card title="Dimensiones (0–100)">
              {(Object.keys(WEIGHT_LABELS) as (keyof TenderWeights)[]).map((k) => (
                <Meter key={k} label={WEIGHT_LABELS[k]} value={evaluation.dimensions[k]} />
              ))}
            </Card>
          )}

          <Card title="Capacidades internas" actions={<span className="muted small">marca lo que tu equipo acredita hoy</span>}>
            <ul className="caps">
              {CAPABILITIES.map((c) => (
                <li key={c.id}>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={state.caps[c.id]}
                      onChange={() => setState((s) => ({ ...s, caps: { ...s.caps, [c.id]: !s.caps[c.id as CapabilityId] } }))}
                    />
                    <span>{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Pesos y equipo">
            {(Object.keys(WEIGHT_LABELS) as (keyof TenderWeights)[]).map((k) => (
              <SliderField
                key={k}
                id={`w-${k}`}
                label={WEIGHT_LABELS[k]}
                value={state.weights[k]}
                min={0}
                max={60}
                onChange={(v) => setState((s) => ({ ...s, weights: { ...s.weights, [k]: v } }))}
              />
            ))}
            <SliderField id="fte" label="Equipo disponible (FTE)" value={state.fte} min={1} max={10} onChange={(v) => set({ fte: v })} />
          </Card>
        </div>

        <div className="tender-main">
          {state.scenarioId === 'pasted' && (
            <Card
              title="Pegar pliego"
              actions={
                <span className="muted small">
                  {ai.mode === 'zero_egress' ? 'Análisis 100 % local' : ai.mode === 'anthropic' ? 'IA: Anthropic (BYOK)' : 'IA: Ollama local'}
                </span>
              }
            >
              <textarea
                className="paste"
                aria-label="Texto del pliego"
                placeholder="Pega aquí el PPT/PCAP (texto). Nada sale del navegador en modo Zero-Egress."
                value={state.pastedText}
                onChange={(e) => set({ pastedText: e.target.value })}
                rows={8}
              />
              <div className="row gap">
                <button type="button" className="btn btn-primary" onClick={analyzeLocal} disabled={state.pastedText.trim().length < 40}>
                  Analizar (reglas, offline)
                </button>
                {ai.mode === 'zero_egress' ? (
                  <button type="button" className="btn" onClick={onOpenSettings}>
                    Activar IA (BYOK / Ollama)…
                  </button>
                ) : (
                  <button type="button" className="btn" onClick={enrich} disabled={state.pastedText.trim().length < 40 || state.ai.state === 'loading'}>
                    {state.ai.state === 'loading' ? 'Analizando con IA…' : 'Enriquecer con IA'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => set({ pastedText: TENDER_SCENARIOS[1]!.sourceText!, pasted: null, aiClauses: [] })}
                >
                  Cargar texto de ejemplo
                </button>
              </div>
              {state.parseNotes.map((n) => (
                <p key={n} className="small note">{n}</p>
              ))}
              {state.ai.state === 'error' && (
                <div className="alert alert-warn" role="alert">
                  <strong>No se pudo usar la IA:</strong> {state.ai.message} Se mantiene el análisis por reglas; tus datos siguen cargados.
                  <div className="row gap">
                    <button type="button" className="btn" onClick={onFallbackToLocal}>Volver a Zero-Egress</button>
                    <button type="button" className="btn btn-ghost" onClick={onOpenSettings}>Revisar ajustes</button>
                  </div>
                </div>
              )}
              {(state.ai.state === 'done' || state.ai.state === 'loading') && (
                <p className="small note" role="status">{state.ai.message}</p>
              )}
            </Card>
          )}

          {scenario && evaluation && (
            <>
              <Card title="Extracción estructurada en 5 bloques" actions={<span className="muted small">pulsa ✓/✕ para cambiar lo que cubre el equipo</span>}>
                {BLOCKS.map((b) => {
                  const items = scenario.clauses.filter((c) => c.category === b.cat);
                  return (
                    <div key={b.cat} className="block">
                      <h3>
                        {b.title} <span className="muted small">· {items.length} · {b.hint}</span>
                      </h3>
                      {items.length === 0 ? (
                        <p className="muted small">Sin cláusulas detectadas.</p>
                      ) : (
                        <ul className="clauses">
                          {items.map((c) => (
                            <ClauseRow key={c.id} c={c} met={isMet(c, state.caps, state.overrides)} onToggle={() => toggleClause(c)} veto={evaluation.vetoes.some((v) => v.id === c.id)} />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </Card>

              <div className="two-col">
                <Card title={`Esfuerzo orientativo · ${fmtNum(totalEffort)} jornadas`}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Fase</th>
                        <th scope="col" className="num">Base</th>
                        <th scope="col" className="num">Brechas</th>
                        <th scope="col" className="num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {effort.map((p) => (
                        <tr key={p.key}>
                          <th scope="row">
                            {p.label}
                            <div className="muted small">{p.profiles.map((x) => `${x.role} ${fmtNum(x.days)}`).join(' · ')}</div>
                          </th>
                          <td className="num">{fmtNum(p.baseDays)}</td>
                          <td className={`num ${p.gapDays ? 'tone-text-warn' : ''}`}>{p.gapDays ? `+${fmtNum(p.gapDays)}` : '—'}</td>
                          <td className="num"><strong>{fmtNum(p.totalDays)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
                <Card title="Índice de memoria técnica">
                  <ol className="outline">
                    {outline.map((l) => (
                      <li key={l} className={l.startsWith('Plan de cierre') ? 'gap' : ''}>{l}</li>
                    ))}
                  </ol>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function shortTender(id: string) {
  return id === 'cx_omnicanal' ? 'CX omnicanal' : 'IA regulada';
}

function ClauseRow({ c, met, onToggle, veto }: { c: TenderClause; met: boolean; onToggle: () => void; veto: boolean }) {
  return (
    <li className={`clause ${met ? 'is-met' : 'is-gap'} ${veto ? 'is-veto' : ''}`}>
      <button type="button" className="clause-toggle" onClick={onToggle} aria-pressed={met} aria-label={`${met ? 'Cubierto' : 'No cubierto'}: ${c.summary}. Pulsar para cambiar.`}>
        <span aria-hidden="true">{met ? '✓' : '✕'}</span>
        <span className="sr-label">{met ? 'Cubierto' : 'No cubierto'}</span>
      </button>
      <div className="clause-body">
        <div className="clause-line">
          <span className="clause-summary">{c.summary}</span>
          {c.framework && <span className="chip">{c.framework}</span>}
          <span className={`chip risk risk-${c.riskLevel}`} title={`Peso ${RISK_WEIGHT[c.riskLevel]}`}>Riesgo {c.riskLevel}</span>
          {c.penaltyPct ? <span className="chip">Penal. máx. {fmtNum(c.penaltyPct)} %</span> : null}
          {c.source === 'ia' && <span className="chip chip-ai">IA · revisar</span>}
          {veto && <span className="badge tone-bad">⛔ Veto</span>}
        </div>
        {c.business && <p className="small clause-business">{c.business}</p>}
        {c.evidence && (
          <details>
            <summary className="small">Evidencia en el pliego</summary>
            <blockquote className="small">«{c.evidence}»</blockquote>
          </details>
        )}
      </div>
    </li>
  );
}

const VERDICT_TEXT: Record<Verdict, string> = { Go: 'GO', Revisar: 'REVISAR', 'No-Go': 'NO-GO' };

function VerdictCard({ evaluation }: { evaluation: TenderEvaluation }) {
  const v = evaluation.verdict;
  return (
    <Card className={`verdict verdict-${v === 'Go' ? 'go' : v === 'Revisar' ? 'review' : 'nogo'}`} title="Semáforo de decisión">
      <div className="verdict-body">
        <div className="lights" aria-hidden="true">
          <span className={`light l-go ${v === 'Go' ? 'on' : ''}`} />
          <span className={`light l-review ${v === 'Revisar' ? 'on' : ''}`} />
          <span className={`light l-nogo ${v === 'No-Go' ? 'on' : ''}`} />
        </div>
        <div>
          <div className="verdict-label" aria-live="polite">{VERDICT_TEXT[v]}</div>
          <div className="verdict-score">{evaluation.total}<span>/100</span></div>
        </div>
      </div>
      <p className="verdict-why">{evaluation.explanation}</p>
      {evaluation.vetoes.length > 0 && (
        <ul className="vetoes">
          {evaluation.vetoes.map((c) => (
            <li key={c.id}>⛔ {c.summary}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
