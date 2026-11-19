import { Ban, Check, ClipboardPaste, ShieldAlert, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useRef } from 'react';
import { Card, Meter, Segmented, SliderField } from '../components/ui';
import { capabilities, tenderScenarios } from '../data/tenderScenarios';
import { useLang, type Lang } from '../i18n/lang';
import { parseTender } from '../services/deterministicParser';
import { analyzeTenderWithAi, LlmError } from '../services/llmAdapter';
import { isMet, RISK_WEIGHT, type Capabilities, type ClauseOverrides, type EffortPhase } from '../services/tenderScoring';
import type { AiSettings, CapabilityId, ClauseCategory, RiskLevel, TenderClause, TenderEvaluation, TenderScenario, TenderWeights, Verdict } from '../types/domain';
import { fmtEur, fmtNum, fmtPct } from '../utils/format';
import { swapRef } from '../utils/motion';
import { MOBILE_QUERY, useMediaQuery } from '../utils/theme';

export interface TenderState {
  scenarioId: string; // 'cx_omnicanal' | 'ia_regulada' | 'pasted'
  caps: Capabilities;
  weights: TenderWeights;
  fte: number;
  overrides: ClauseOverrides;
  pastedText: string;
  pasted: TenderScenario | null;
  parseNotes: string[];
  ai: { state: 'idle' | 'loading' | 'done' | 'error'; message?: string; injection?: string[] };
  aiClauses: TenderClause[];
}

type Bi = [string, string];
const BLOCKS: { cat: ClauseCategory; title: Bi; hint: Bi }[] = [
  { cat: 'excluyente', title: ['Requisitos excluyentes', 'Exclusionary requirements'], hint: ['Si uno falla, la oferta no se valora.', 'If one fails, the bid is not scored.'] },
  { cat: 'plazo', title: ['Plazos críticos y penalizaciones', 'Critical deadlines and penalties'], hint: ['Ritmo del proyecto y coste de cada desviación.', 'Project pace and the cost of each deviation.'] },
  { cat: 'tecnico', title: ['Entregables técnicos', 'Technical deliverables'], hint: ['Lo que hay que construir.', 'What has to be built.'] },
  { cat: 'cumplimiento', title: ['Cláusulas de seguridad y cumplimiento', 'Security and compliance clauses'], hint: ['RGPD · ENS · ISO 27001 · ISO 42001 · EU AI Act.', 'GDPR · ENS · ISO 27001 · ISO 42001 · EU AI Act.'] },
  { cat: 'dependencia', title: ['Dependencias con terceros', 'Third-party dependencies'], hint: ['Riesgo fuera de nuestro control.', 'Risk outside our control.'] },
];

const WEIGHT_LABELS: Record<keyof TenderWeights, Bi> = {
  technicalFit: ['Encaje técnico', 'Technical fit'],
  compliance: ['Preparación normativa', 'Regulatory readiness'],
  deadline: ['Holgura de plazo', 'Schedule slack'],
  contractual: ['Riesgo contractual', 'Contractual risk'],
};

export const VERDICT_TEXT: Record<Lang, Record<Verdict, string>> = {
  es: { Go: 'GO', Revisar: 'REVISAR', 'No-Go': 'NO-GO' },
  en: { Go: 'GO', Revisar: 'REVIEW', 'No-Go': 'NO-GO' },
};
const RISK_EN: Record<RiskLevel, string> = { Bajo: 'Low', Medio: 'Medium', Alto: 'High' };

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
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [lang] = useLang();
  const i = lang === 'en' ? 1 : 0;
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const set = (patch: Partial<TenderState>) => setState((s) => ({ ...s, ...patch }));
  const abortRef = useRef<AbortController | null>(null);
  const scenarios = tenderScenarios(lang);

  const analyzeLocal = () => {
    const r = parseTender(state.pastedText, undefined, lang);
    set({ pasted: r.scenario, parseNotes: r.notes, overrides: {}, aiClauses: [], ai: { state: 'idle' } });
  };

  const enrich = async () => {
    if (!state.pasted) analyzeLocal();
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    set({ ai: { state: 'loading', message: L('Redactando PII y consultando el modelo…', 'Redacting PII and querying the model…') } });
    try {
      const r = await analyzeTenderWithAi(state.pastedText, ai, ctrl.signal, lang);
      setState((s) => ({
        ...s,
        aiClauses: r.clauses,
        ai: {
          state: 'done',
          message: L(
            `${r.clauses.length} cláusula(s) añadidas por ${r.provider}. PII redactada antes de enviar: ${r.redactedCount}.`,
            `${r.clauses.length} clause(s) added by ${r.provider}. PII redacted before sending: ${r.redactedCount}.`,
          ),
          injection: r.injectionSignals,
        },
      }));
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const msg = err instanceof LlmError ? err.message : L('Error inesperado.', 'Unexpected error.');
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
  const shortTender = (id: string) => (id === 'cx_omnicanal' ? L('CX omnicanal', 'Omnichannel CX') : L('IA regulada', 'Regulated AI'));

  return (
    <div className="module tender">
      <div className="toolbar" role="toolbar" aria-label={L('Controles del analizador', 'Analyser controls')}>
        <Segmented<string>
          label={L('Pliego', 'Tender')}
          value={state.scenarioId}
          onChange={(v) => set({ scenarioId: v })}
          options={[
            ...scenarios.map((s) => ({
              value: s.id,
              label: mobile ? `${L('Pliego', 'Tender')} ${s.title.split(' · ')[0]}` : s.title.split(' · ')[0] + ' · ' + shortTender(s.id),
              hint: s.title,
            })),
            { value: 'pasted', label: <><ClipboardPaste size={15} aria-hidden="true" /> {mobile ? L('Pegar', 'Paste') : L('Pegar pliego real', 'Paste a real tender')}</> },
          ]}
        />
        {scenario && (
          <span className="muted small toolbar-meta">
            {scenario.sector} · {L('plazo', 'term')} {fmtNum(scenario.deadlineDays)} {L('días', 'days')}
            {scenario.budgetEur ? ` · ${fmtEur(scenario.budgetEur)} ${L('sin IVA', 'excl. VAT')}` : ''}
          </span>
        )}
      </div>

      {mobile && evaluation && (
        <div className={`verdict-sticky tone-${evaluation.verdict === 'Go' ? 'good' : evaluation.verdict === 'Revisar' ? 'warn' : 'bad'}`} aria-hidden="true">
          <strong key={evaluation.verdict} ref={swapRef} className="swap">{VERDICT_TEXT[lang][evaluation.verdict]}</strong>
          <span className="num-tab">{evaluation.total}/100</span>
          {evaluation.vetoes.length > 0 && <span className="small">· veto</span>}
        </div>
      )}
      <div className="tender-grid">
        <div className="tender-side">
          {evaluation && scenario ? (
            <VerdictCard evaluation={evaluation} />
          ) : (
            <Card title={L('Veredicto', 'Verdict')}>
              <p className="muted">{L('Pega el texto de un pliego y pulsa «Analizar».', 'Paste a tender’s text and press “Analyse”.')}</p>
            </Card>
          )}

          {evaluation && (
            <Card title={L('Dimensiones (0–100)', 'Dimensions (0–100)')}>
              {(Object.keys(WEIGHT_LABELS) as (keyof TenderWeights)[]).map((k) => (
                <Meter key={k} label={WEIGHT_LABELS[k][i]} value={evaluation.dimensions[k]} />
              ))}
            </Card>
          )}

          <Card className="caps-card" title={L('Capacidades internas', 'In-house capabilities')} actions={<span className="muted small">{L('marca lo que tu equipo acredita hoy', 'tick what your team can prove today')}</span>}>
            <ul className="caps">
              {capabilities(lang).map((c) => (
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

          <Card className="weights-card" title={<><SlidersHorizontal size={16} aria-hidden="true" /> {L('Pesos y equipo', 'Weights and team')}</>}>
            {(Object.keys(WEIGHT_LABELS) as (keyof TenderWeights)[]).map((k) => (
              <SliderField
                key={k}
                id={`w-${k}`}
                label={WEIGHT_LABELS[k][i]}
                value={state.weights[k]}
                min={0}
                max={60}
                onChange={(v) => setState((s) => ({ ...s, weights: { ...s.weights, [k]: v } }))}
              />
            ))}
            <SliderField id="fte" label={L('Equipo disponible (FTE)', 'Available team (FTE)')} value={state.fte} min={1} max={10} onChange={(v) => set({ fte: v })} />
          </Card>
        </div>

        <div className="tender-main">
          {state.scenarioId === 'pasted' && (
            <Card
              title={L('Pegar pliego', 'Paste a tender')}
              actions={
                <span className="muted small">
                  {ai.mode === 'zero_egress' ? L('Análisis 100 % local', '100% local analysis') : ai.mode === 'anthropic' ? L('IA: Anthropic (BYOK)', 'AI: Anthropic (BYOK)') : L('IA: Ollama local', 'AI: local Ollama')}
                </span>
              }
            >
              <textarea
                className="paste"
                aria-label={L('Texto del pliego', 'Tender text')}
                placeholder={L('Pega aquí el pliego (texto). Nada sale del navegador en modo Zero-Egress.', 'Paste the tender here (text). Nothing leaves the browser in Zero-Egress mode.')}
                value={state.pastedText}
                onChange={(e) => set({ pastedText: e.target.value })}
                rows={8}
              />
              <div className="row gap">
                <button type="button" className="btn btn-primary" onClick={analyzeLocal} disabled={state.pastedText.trim().length < 40}>
                  {L('Analizar (reglas, offline)', 'Analyse (rules, offline)')}
                </button>
                {ai.mode === 'zero_egress' ? (
                  <button type="button" className="btn" onClick={onOpenSettings}>
                    {L('Activar IA (BYOK / Ollama)…', 'Enable AI (BYOK / Ollama)…')}
                  </button>
                ) : (
                  <button type="button" className="btn" onClick={enrich} disabled={state.pastedText.trim().length < 40 || state.ai.state === 'loading'}>
                    {state.ai.state === 'loading' ? L('Analizando con IA…', 'Analysing with AI…') : L('Enriquecer con IA', 'Enrich with AI')}
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => set({ pastedText: scenarios[1]!.sourceText!, pasted: null, aiClauses: [] })}>
                  {L('Cargar texto de ejemplo', 'Load sample text')}
                </button>
              </div>
              {state.parseNotes.map((n) => (
                <p key={n} className="small note">{n}</p>
              ))}
              {state.ai.state === 'error' && (
                <div className="alert alert-warn" role="alert">
                  <strong>{L('No se pudo usar la IA:', 'The AI could not be used:')}</strong> {state.ai.message}{' '}
                  {L('Se mantiene el análisis por reglas; tus datos siguen cargados.', 'The rule-based analysis is kept; your data is still loaded.')}
                  <div className="row gap">
                    <button type="button" className="btn" onClick={onFallbackToLocal}>{L('Volver a Zero-Egress', 'Back to Zero-Egress')}</button>
                    <button type="button" className="btn btn-ghost" onClick={onOpenSettings}>{L('Revisar ajustes', 'Check settings')}</button>
                  </div>
                </div>
              )}
              {(state.ai.state === 'done' || state.ai.state === 'loading') && (
                <p className="small note" role="status">{state.ai.message}</p>
              )}
              {state.ai.state === 'done' && state.ai.injection && state.ai.injection.length > 0 && (
                <div className="alert alert-warn" role="alert">
                  <ShieldAlert size={16} aria-hidden="true" />{' '}
                  <strong>{L('El pliego contiene posibles instrucciones para la IA', 'The tender may contain instructions aimed at the AI')}</strong>{' '}
                  ({state.ai.injection.join(' · ')}).{' '}
                  {L(
                    'Se envió marcado como documento no confiable; revisa a mano las cláusulas «IA · revisar».',
                    'It was sent marked as an untrusted document; review the “AI · review” clauses by hand.',
                  )}
                </div>
              )}
            </Card>
          )}

          {scenario && evaluation && (
            <>
              <Card title={L('Extracción estructurada en 5 bloques', 'Structured extraction in 5 blocks')} actions={<span className="muted small">{L('toca el estado de cada cláusula para cambiarlo', 'tap a clause’s status to change it')}</span>}>
                {BLOCKS.map((b) => {
                  const items = scenario.clauses.filter((c) => c.category === b.cat);
                  return (
                    <div key={b.cat} className="block">
                      <h3>
                        {b.title[i]} <span className="muted small num-tab">· {items.length}</span> <span className="muted small block-hint">· {b.hint[i]}</span>
                      </h3>
                      {items.length === 0 ? (
                        <p className="muted small">{L('Sin cláusulas detectadas.', 'No clauses detected.')}</p>
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
                <Card title={`${L('Esfuerzo orientativo', 'Indicative effort')} · ${fmtNum(totalEffort)} ${L('jornadas', 'person-days')}`}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">{L('Fase', 'Phase')}</th>
                        <th scope="col" className="num">{L('Base', 'Base')}</th>
                        <th scope="col" className="num">{L('Brechas', 'Gaps')}</th>
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
                <Card title={L('Índice de memoria técnica', 'Technical proposal outline')}>
                  <ol className="outline">
                    {outline.map((l) => (
                      <li key={l} className={/^(Plan de cierre|Gap closure)/.test(l) ? 'gap' : ''}>{l}</li>
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

function ClauseRow({ c, met, onToggle, veto }: { c: TenderClause; met: boolean; onToggle: () => void; veto: boolean }) {
  const [lang] = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const status = met ? L('Cubierto', 'Covered') : L('No cubierto', 'Not covered');
  return (
    <li className={`clause ${met ? 'is-met' : 'is-gap'} ${veto ? 'is-veto' : ''}`}>
      <button type="button" className="clause-toggle" onClick={onToggle} aria-pressed={met} aria-label={`${status}: ${c.summary}. ${L('Pulsar para cambiar.', 'Press to change.')}`}>
        {met ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : <X size={16} strokeWidth={2.5} aria-hidden="true" />}
        <span className="sr-label">{status}</span>
      </button>
      <div className="clause-body">
        <div className="clause-line">
          <span className="clause-summary">{c.summary}</span>
          {c.framework && <span className="chip">{lang === 'en' && c.framework === 'RGPD' ? 'GDPR' : c.framework}</span>}
          <span className={`chip risk risk-${c.riskLevel}`} title={`${L('Peso', 'Weight')} ${RISK_WEIGHT[c.riskLevel]}`}>
            {L('Riesgo', 'Risk')} {lang === 'en' ? RISK_EN[c.riskLevel] : c.riskLevel}
          </span>
          {c.penaltyPct ? <span className="chip">{L('Penal. máx.', 'Max. penalty')} {fmtPct(c.penaltyPct)}</span> : null}
          {c.source === 'ia' && <span className="chip chip-ai"><Sparkles size={11} aria-hidden="true" /> {L('IA · revisar', 'AI · review')}</span>}
          {veto && <span className="badge tone-bad"><Ban size={13} aria-hidden="true" /> Veto</span>}
        </div>
        {c.business && <p className="small clause-business">{c.business}</p>}
        {c.evidence && (
          <details>
            <summary className="small">{L('Evidencia en el pliego', 'Evidence in the tender')}</summary>
            <blockquote className="small">«{c.evidence}»</blockquote>
          </details>
        )}
      </div>
    </li>
  );
}

function VerdictCard({ evaluation }: { evaluation: TenderEvaluation }) {
  const [lang] = useLang();
  const v = evaluation.verdict;
  return (
    <Card className={`verdict verdict-${v === 'Go' ? 'go' : v === 'Revisar' ? 'review' : 'nogo'}`} title={lang === 'en' ? 'Decision traffic light' : 'Semáforo de decisión'}>
      <div className="verdict-body">
        <div className="lights" aria-hidden="true">
          <span className={`light l-go ${v === 'Go' ? 'on' : ''}`} />
          <span className={`light l-review ${v === 'Revisar' ? 'on' : ''}`} />
          <span className={`light l-nogo ${v === 'No-Go' ? 'on' : ''}`} />
        </div>
        <div>
          <div className="verdict-label swap" key={v} ref={swapRef} aria-live="polite">{VERDICT_TEXT[lang][v]}</div>
          <div className="verdict-score">{evaluation.total}<span>/100</span></div>
        </div>
      </div>
      <p className="verdict-why">{evaluation.explanation}</p>
      {evaluation.vetoes.length > 0 && (
        <ul className="vetoes">
          {evaluation.vetoes.map((c) => (
            <li key={c.id}><Ban size={14} aria-hidden="true" /> {c.summary}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
