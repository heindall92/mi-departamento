import { CircleDot } from 'lucide-react';
import { Card, Segmented, SliderField, Switch, tierTone } from '../components/ui';
import { useLang, type Lang } from '../i18n/lang';
import { HITL_ASSUMPTIONS, HITL_LABEL_EN } from '../services/roi';
import { baseCellScore, tierFromScore, TIER_LABEL, useCases } from '../services/riskIndex';
import type { AutonomyLevel, DataSensitivity, GovernanceControls, RiskAssessment, RoiInputs, RoiResult, UseCase } from '../types/domain';
import { fmtEur, fmtNum, fmtPct } from '../utils/format';

export interface RoiState {
  inputs: RoiInputs;
  gov: GovernanceControls;
}

const AUTONOMY: { value: AutonomyLevel; label: [string, string] }[] = [
  { value: 'asistido', label: ['Asistido', 'Assisted'] },
  { value: 'semiautonomo', label: ['Semiautónomo', 'Semi-autonomous'] },
  { value: 'autonomo', label: ['Autónomo', 'Autonomous'] },
];
const SENSITIVITY: { value: DataSensitivity; label: [string, string] }[] = [
  { value: 'publico', label: ['Público', 'Public'] },
  { value: 'interno', label: ['Interno', 'Internal'] },
  { value: 'pii_financiero', label: ['PII + financiero', 'PII + financial'] },
];

export function RoiGovernance({
  state,
  setState,
  result,
  risk,
  breakEven,
}: {
  state: RoiState;
  setState: (u: (s: RoiState) => RoiState) => void;
  result: RoiResult;
  risk: RiskAssessment;
  breakEven: number | null;
}) {
  const [lang] = useLang();
  const ix = lang === 'en' ? 1 : 0;
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const i = state.inputs;
  const g = state.gov;
  const setIn = (k: keyof RoiInputs) => (v: number) => setState((s) => ({ ...s, inputs: { ...s.inputs, [k]: v } }));
  const setGov = <K extends keyof GovernanceControls>(k: K, v: GovernanceControls[K]) => setState((s) => ({ ...s, gov: { ...s.gov, [k]: v } }));
  const blocking = risk.controls.filter((c) => c.blocking).length;
  const UC = useCases(lang);
  const months = (n: number) => `${fmtNum(Math.ceil(n))} ${L('meses', 'months')}`;

  return (
    <div className="module roi">
      <div className="roi-grid">
        <div className="roi-left">
          <Card title={L('ROI operativo', 'Operational ROI')} actions={<span className="muted small">{L('neto de supervisión humana', 'net of human oversight')}</span>}>
            <div className="kpis">
              <Kpi
                label={L('Horas liberadas / mes', 'Hours freed / month')}
                value={fmtNum(result.hoursFreed)}
                sub={result.hitlReviewHours ? L(`−${fmtNum(result.hitlReviewHours)} h de revisión HITL`, `−${fmtNum(result.hitlReviewHours)} h of HITL review`) : L('sin revisión humana', 'no human review')}
              />
              <Kpi label={L('Ahorro mensual', 'Monthly savings')} value={fmtEur(result.monthlySavingsEur)} sub={`${L('neto de costes', 'net of costs')}: ${fmtEur(result.netMonthlyEur)}`} tone={result.netMonthlyEur > 0 ? 'good' : 'bad'} />
              <Kpi label={L('Ahorro anual', 'Annual savings')} value={fmtEur(result.annualSavingsEur)} />
              <Kpi label={L('Beneficio neto año 1', 'Year-1 net benefit')} value={fmtEur(result.firstYearNetEur)} tone={result.firstYearNetEur >= 0 ? 'good' : 'bad'} />
              <Kpi label={L('ROI año 1', 'Year-1 ROI')} value={fmtPct(result.roiPct)} tone={result.roiPct >= 0 ? 'good' : 'bad'} />
              <Kpi
                label="Payback"
                value={result.paybackMonths === null ? L('No se recupera', 'Not recovered') : months(result.paybackMonths)}
                tone={result.paybackMonths !== null && result.paybackMonths <= 12 ? 'good' : result.paybackMonths === null ? 'bad' : 'warn'}
              />
            </div>
            <CashflowChart inputs={i} result={result} lang={lang} />
          </Card>

          <Card title={L('Variables', 'Inputs')}>
            <div className="sliders-2">
              <SliderField id="vol" label={L('Volumen mensual (tickets o expedientes)', 'Monthly volume (tickets or files)')} value={i.monthlyVolume} min={100} max={100_000} step={100} onChange={setIn('monthlyVolume')} format={fmtNum} />
              <SliderField id="min" label={L('Minutos manuales por unidad', 'Manual minutes per item')} value={i.manualMinutesPerItem} min={1} max={240} onChange={setIn('manualMinutesPerItem')} suffix="min" />
              <SliderField id="hour" label={L('Coste/hora del equipo', 'Team cost per hour')} value={i.hourlyCostEur} min={10} max={150} onChange={setIn('hourlyCostEur')} suffix="€" />
              <SliderField id="rate" label={L('Tasa de automatización segura', 'Safe automation rate')} value={i.automationRatePct} min={0} max={90} onChange={setIn('automationRatePct')} suffix="%" />
              <SliderField id="setup" label={L('Inversión inicial', 'Upfront investment')} value={i.setupCostEur} min={0} max={1_000_000} step={1000} onChange={setIn('setupCostEur')} suffix="€" format={fmtEur} />
              <SliderField id="run" label={L('Coste recurrente mensual', 'Monthly recurring cost')} value={i.monthlyRunCostEur} min={0} max={100_000} step={100} onChange={setIn('monthlyRunCostEur')} suffix="€" format={fmtEur} />
            </div>
            <details className="formula">
              <summary>{L('Cómo se calcula (supuestos visibles)', 'How it is calculated (visible assumptions)')}</summary>
              <ul className="small">
                <li>{L('Horas automatizadas = volumen × minutos ÷ 60 × tasa (máx. 90 %).', 'Automated hours = volume × minutes ÷ 60 × rate (max. 90%).')}</li>
                <li>
                  {L('Revisión HITL', 'HITL review')} ({AUTONOMY.find((a) => a.value === g.autonomyLevel)!.label[ix]}):{' '}
                  {lang === 'en' ? HITL_LABEL_EN[g.autonomyLevel] : HITL_ASSUMPTIONS[g.autonomyLevel].label}.{' '}
                  {g.hitlEnabled ? L('Se descuenta.', 'It is deducted.') : L('Desactivada: no se descuenta, pero sube el riesgo.', 'Off: not deducted, but risk goes up.')}
                </li>
                <li>{L('ROI año 1 = (ahorro anual − coste recurrente anual − inversión) ÷ (inversión + coste recurrente anual).', 'Year-1 ROI = (annual savings − annual recurring cost − investment) ÷ (investment + annual recurring cost).')}</li>
                <li>{L('Payback = inversión ÷ ahorro neto mensual.', 'Payback = investment ÷ net monthly savings.')}</li>
                <li>
                  {L('Punto de equilibrio', 'Break-even')}:{' '}
                  {breakEven === null
                    ? L('no se alcanza con ≤ 90 % de automatización', 'not reached with ≤ 90% automation')
                    : L(`${fmtNum(Math.ceil(breakEven))} % de automatización para cubrir el coste recurrente`, `${fmtNum(Math.ceil(breakEven))}% automation to cover the recurring cost`)}
                  .
                </li>
              </ul>
            </details>
          </Card>
        </div>

        <div className="roi-right">
          <Card className={`risk-card tone-border-${tierTone(risk.tier)}`} title={L('Índice de exposición de riesgo IA', 'AI risk exposure index')} actions={<span className="muted small">ISO/IEC 42001 · EU AI Act</span>}>
            <div className="risk-head">
              <div className={`tier tone-${tierTone(risk.tier)}`} aria-live="polite">
                <span className="tier-label">{L('Riesgo', 'Risk')}</span>
                <span className="tier-value">{TIER_LABEL[lang][risk.tier]}</span>
                <span className="tier-score">{risk.score} pts</span>
              </div>
              <div className="risk-aiact">
                <span className="muted small">{L('Categoría orientativa EU AI Act', 'Indicative EU AI Act category')}</span>
                <strong>{risk.aiActCategory}</strong>
                {risk.floorReason && <p className="small note">{risk.floorReason}</p>}
              </div>
            </div>

            <RiskMatrix lang={lang} autonomy={g.autonomyLevel} sensitivity={g.dataSensitivity} onPick={(a, d) => setState((s) => ({ ...s, gov: { ...s.gov, autonomyLevel: a, dataSensitivity: d } }))} />

            <div className="gov-controls">
              <label className="field">
                <span>{L('Caso de uso', 'Use case')}</span>
                <select value={g.useCase} onChange={(e) => setGov('useCase', e.target.value as UseCase)}>
                  {(Object.keys(UC) as UseCase[]).map((k) => (
                    <option key={k} value={k}>{UC[k].label}</option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span>{L('Autonomía del agente', 'Agent autonomy')}</span>
                <Segmented size="sm" label={L('Autonomía del agente', 'Agent autonomy')} value={g.autonomyLevel} onChange={(v) => setGov('autonomyLevel', v)} options={AUTONOMY.map((a) => ({ value: a.value, label: a.label[ix] }))} />
              </div>
              <div className="field">
                <span>{L('Sensibilidad de los datos', 'Data sensitivity')}</span>
                <Segmented size="sm" label={L('Sensibilidad de los datos', 'Data sensitivity')} value={g.dataSensitivity} onChange={(v) => setGov('dataSensitivity', v)} options={SENSITIVITY.map((a) => ({ value: a.value, label: a.label[ix] }))} />
              </div>
              <div className="switches">
                <Switch label={L('Supervisión humana (HITL)', 'Human oversight (HITL)')} checked={g.hitlEnabled} onChange={(v) => setGov('hitlEnabled', v)} />
                <Switch label={L('Registro de auditoría', 'Audit logging')} checked={g.auditLoggingEnabled} onChange={(v) => setGov('auditLoggingEnabled', v)} />
                <Switch label={L('Redacción de PII', 'PII redaction')} checked={g.piiRedactionEnabled} onChange={(v) => setGov('piiRedactionEnabled', v)} />
              </div>
            </div>

            <details className="drivers">
              <summary className="small">{L(`Por qué este nivel (${risk.drivers.length} factores)`, `Why this level (${risk.drivers.length} factors)`)}</summary>
              <ul className="small">
                {risk.drivers.map((d) => (
                  <li key={d.label}>
                    <span>{d.label}</span> <strong>+{d.points}</strong>
                  </li>
                ))}
              </ul>
            </details>
          </Card>

          <Card
            title={L('Controles obligatorios antes de producción', 'Mandatory controls before production')}
            actions={<span className={`badge ${blocking ? 'tone-bad' : 'tone-good'}`}>{blocking} {L('bloqueante(s)', 'blocking')}</span>}
          >
            <ul className="controls">
              {risk.controls.map((c) => (
                <li key={c.id} className={c.blocking ? 'blocking' : ''}>
                  <div className="control-title">
                    {c.blocking ? <span className="badge tone-bad">{L('Bloqueante', 'Blocking')}</span> : <span className="badge tone-neutral">{L('Recomendado', 'Recommended')}</span>} {c.title}
                  </div>
                  <div className="small muted">{c.why}</div>
                  <div className="refs">
                    {c.refs.map((r) => (
                      <span key={r} className="chip">{r}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className={`kpi ${tone ? `kpi-${tone}` : ''}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

const A_ORDER: AutonomyLevel[] = ['asistido', 'semiautonomo', 'autonomo'];
const D_ORDER: DataSensitivity[] = ['pii_financiero', 'interno', 'publico'];

function RiskMatrix({ lang, autonomy, sensitivity, onPick }: { lang: Lang; autonomy: AutonomyLevel; sensitivity: DataSensitivity; onPick: (a: AutonomyLevel, d: DataSensitivity) => void }) {
  const ix = lang === 'en' ? 1 : 0;
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const aLabel = (a: AutonomyLevel) => AUTONOMY.find((x) => x.value === a)!.label[ix];
  const dLabel = (d: DataSensitivity) => SENSITIVITY.find((x) => x.value === d)!.label[ix];
  return (
    <div className="matrix" role="grid" aria-label={L('Matriz de riesgo base: autonomía × sensibilidad de datos', 'Base risk matrix: autonomy × data sensitivity')}>
      <div className="matrix-y">{L('Sensibilidad ↑', 'Sensitivity ↑')}</div>
      <div className="matrix-cells">
        {D_ORDER.map((d) => (
          <div className="matrix-row" role="row" key={d}>
            <span className="matrix-rowhead">{dLabel(d)}</span>
            {A_ORDER.map((a) => {
              const t = tierFromScore(baseCellScore(a, d));
              const here = a === autonomy && d === sensitivity;
              return (
                <button
                  type="button"
                  role="gridcell"
                  key={a}
                  className={`cell tone-${tierTone(t)} ${here ? 'here' : ''}`}
                  aria-selected={here}
                  aria-label={L(`${aLabel(a)} con datos ${dLabel(d)}: riesgo base ${TIER_LABEL.es[t]}`, `${aLabel(a)} with ${dLabel(d)} data: base risk ${TIER_LABEL.en[t]}`)}
                  onClick={() => onPick(a, d)}
                >
                  {here && <CircleDot size={13} aria-hidden="true" />}
                  {TIER_LABEL[lang][t]}
                </button>
              );
            })}
          </div>
        ))}
        <div className="matrix-row matrix-foot">
          <span className="matrix-rowhead" />
          {A_ORDER.map((a) => (
            <span key={a} className="matrix-colhead">{aLabel(a)}</span>
          ))}
        </div>
      </div>
      <div className="matrix-x">{L('Autonomía del agente → · riesgo base sin controles', 'Agent autonomy → · base risk without controls')}</div>
    </div>
  );
}

/** Flujo de caja acumulado a 24 meses: SVG nativo, sin librerías de gráficos. */
function CashflowChart({ inputs, result, lang }: { inputs: RoiInputs; result: RoiResult; lang: Lang }) {
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const months = 24;
  const pts = Array.from({ length: months + 1 }, (_, m) => -inputs.setupCostEur + result.netMonthlyEur * m);
  const min = Math.min(0, ...pts);
  const max = Math.max(0, ...pts);
  const W = 560;
  const H = 120;
  const pad = 6;
  const x = (m: number) => pad + (m / months) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (H - pad * 2);
  const path = pts.map((v, m) => `${m ? 'L' : 'M'}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const be = result.paybackMonths !== null && result.paybackMonths <= months ? result.paybackMonths : null;
  const beText = be !== null ? L(`equilibrio en el mes ${Math.ceil(be)}`, `break-even in month ${Math.ceil(be)}`) : L('sin equilibrio en 24 meses', 'no break-even within 24 months');
  return (
    <figure className="cashflow">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L(`Flujo de caja acumulado a 24 meses: de ${fmtEur(pts[0]!)} a ${fmtEur(pts[months]!)}, ${beText}`, `Cumulative 24-month cash flow: from ${fmtEur(pts[0]!)} to ${fmtEur(pts[months]!)}, ${beText}`)}>
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} className="axis" />
        {be !== null && <line x1={x(be)} x2={x(be)} y1={pad} y2={H - pad} className="be" />}
        <defs>
          <clipPath id="cf-pos"><rect x={0} y={0} width={W} height={y(0)} /></clipPath>
          <clipPath id="cf-neg"><rect x={0} y={y(0)} width={W} height={H - y(0)} /></clipPath>
        </defs>
        <path d={path} className="line pos" clipPath="url(#cf-pos)" />
        <path d={path} className="line neg" clipPath="url(#cf-neg)" />
        <circle cx={x(months)} cy={y(pts[months]!)} r={3.5} className={`dot ${pts[months]! >= 0 ? 'pos' : 'neg'}`} />
      </svg>
      <figcaption className="small muted">
        {L('Caja acumulada (24 meses)', 'Cumulative cash (24 months)')}: {fmtEur(pts[0]!)} → <strong>{fmtEur(pts[months]!)}</strong> · {beText}
      </figcaption>
    </figure>
  );
}
