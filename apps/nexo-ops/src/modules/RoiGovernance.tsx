import { CircleDot } from 'lucide-react';
import { Card, Segmented, SliderField, Switch, tierTone } from '../components/ui';
import { HITL_ASSUMPTIONS } from '../services/roi';
import { baseCellScore, tierFromScore, USE_CASES } from '../services/riskIndex';
import type { AutonomyLevel, DataSensitivity, GovernanceControls, RiskAssessment, RoiInputs, RoiResult, UseCase } from '../types/domain';
import { fmtEur, fmtNum, fmtPct } from '../utils/format';

export interface RoiState {
  inputs: RoiInputs;
  gov: GovernanceControls;
}

const AUTONOMY: { value: AutonomyLevel; label: string }[] = [
  { value: 'asistido', label: 'Asistido' },
  { value: 'semiautonomo', label: 'Semiautónomo' },
  { value: 'autonomo', label: 'Autónomo' },
];
const SENSITIVITY: { value: DataSensitivity; label: string }[] = [
  { value: 'publico', label: 'Público' },
  { value: 'interno', label: 'Interno' },
  { value: 'pii_financiero', label: 'PII + financiero' },
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
  const i = state.inputs;
  const g = state.gov;
  const setIn = (k: keyof RoiInputs) => (v: number) => setState((s) => ({ ...s, inputs: { ...s.inputs, [k]: v } }));
  const setGov = <K extends keyof GovernanceControls>(k: K, v: GovernanceControls[K]) => setState((s) => ({ ...s, gov: { ...s.gov, [k]: v } }));
  const blocking = risk.controls.filter((c) => c.blocking).length;

  return (
    <div className="module roi">
      <div className="roi-grid">
        <div className="roi-left">
          <Card title="ROI operativo" actions={<span className="muted small">neto de supervisión humana</span>}>
            <div className="kpis">
              <Kpi label="Horas liberadas / mes" value={fmtNum(result.hoursFreed)} sub={result.hitlReviewHours ? `−${fmtNum(result.hitlReviewHours)} h de revisión HITL` : 'sin revisión humana'} />
              <Kpi label="Ahorro mensual" value={fmtEur(result.monthlySavingsEur)} sub={`neto de costes: ${fmtEur(result.netMonthlyEur)}`} tone={result.netMonthlyEur > 0 ? 'good' : 'bad'} />
              <Kpi label="Ahorro anual" value={fmtEur(result.annualSavingsEur)} />
              <Kpi label="Beneficio neto año 1" value={fmtEur(result.firstYearNetEur)} tone={result.firstYearNetEur >= 0 ? 'good' : 'bad'} />
              <Kpi label="ROI año 1" value={fmtPct(result.roiPct)} tone={result.roiPct >= 0 ? 'good' : 'bad'} />
              <Kpi
                label="Payback"
                value={result.paybackMonths === null ? 'No se recupera' : `${fmtNum(Math.ceil(result.paybackMonths))} meses`}
                tone={result.paybackMonths !== null && result.paybackMonths <= 12 ? 'good' : result.paybackMonths === null ? 'bad' : 'warn'}
              />
            </div>
            <CashflowChart inputs={i} result={result} />
          </Card>

          <Card title="Variables">
            <div className="sliders-2">
              <SliderField id="vol" label="Volumen mensual (tickets o expedientes)" value={i.monthlyVolume} min={100} max={100_000} step={100} onChange={setIn('monthlyVolume')} format={fmtNum} />
              <SliderField id="min" label="Minutos manuales por unidad" value={i.manualMinutesPerItem} min={1} max={240} onChange={setIn('manualMinutesPerItem')} suffix="min" />
              <SliderField id="hour" label="Coste/hora del equipo" value={i.hourlyCostEur} min={10} max={150} onChange={setIn('hourlyCostEur')} suffix="€" />
              <SliderField id="rate" label="Tasa de automatización segura" value={i.automationRatePct} min={0} max={90} onChange={setIn('automationRatePct')} suffix="%" />
              <SliderField id="setup" label="Inversión inicial" value={i.setupCostEur} min={0} max={1_000_000} step={1000} onChange={setIn('setupCostEur')} suffix="€" format={fmtEur} />
              <SliderField id="run" label="Coste recurrente mensual" value={i.monthlyRunCostEur} min={0} max={100_000} step={100} onChange={setIn('monthlyRunCostEur')} suffix="€" format={fmtEur} />
            </div>
            <details className="formula">
              <summary>Cómo se calcula (supuestos visibles)</summary>
              <ul className="small">
                <li>Horas automatizadas = volumen × minutos ÷ 60 × tasa (máx. 90 %).</li>
                <li>
                  Revisión HITL ({g.autonomyLevel}): {HITL_ASSUMPTIONS[g.autonomyLevel].label}. {g.hitlEnabled ? 'Se descuenta.' : 'Desactivada: no se descuenta, pero sube el riesgo.'}
                </li>
                <li>ROI año 1 = (ahorro anual − coste recurrente anual − inversión) ÷ (inversión + coste recurrente anual).</li>
                <li>Payback = inversión ÷ ahorro neto mensual.</li>
                <li>
                  Punto de equilibrio: {breakEven === null ? 'no se alcanza con ≤ 90 % de automatización' : `${fmtNum(Math.ceil(breakEven))} % de automatización para cubrir el coste recurrente`}.
                </li>
              </ul>
            </details>
          </Card>
        </div>

        <div className="roi-right">
          <Card
            className={`risk-card tone-border-${tierTone(risk.tier)}`}
            title="Índice de exposición de riesgo IA"
            actions={<span className="muted small">ISO/IEC 42001 · EU AI Act</span>}
          >
            <div className="risk-head">
              <div className={`tier tone-${tierTone(risk.tier)}`} aria-live="polite">
                <span className="tier-label">Riesgo</span>
                <span className="tier-value">{risk.tier}</span>
                <span className="tier-score">{risk.score} pts</span>
              </div>
              <div className="risk-aiact">
                <span className="muted small">Categoría orientativa EU AI Act</span>
                <strong>{risk.aiActCategory}</strong>
                {risk.floorReason && <p className="small note">{risk.floorReason}</p>}
              </div>
            </div>

            <RiskMatrix autonomy={g.autonomyLevel} sensitivity={g.dataSensitivity} onPick={(a, d) => setState((s) => ({ ...s, gov: { ...s.gov, autonomyLevel: a, dataSensitivity: d } }))} />

            <div className="gov-controls">
              <label className="field">
                <span>Caso de uso</span>
                <select value={g.useCase} onChange={(e) => setGov('useCase', e.target.value as UseCase)}>
                  {(Object.keys(USE_CASES) as UseCase[]).map((k) => (
                    <option key={k} value={k}>{USE_CASES[k].label}</option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span>Autonomía del agente</span>
                <Segmented size="sm" label="Autonomía del agente" value={g.autonomyLevel} onChange={(v) => setGov('autonomyLevel', v)} options={AUTONOMY} />
              </div>
              <div className="field">
                <span>Sensibilidad de los datos</span>
                <Segmented size="sm" label="Sensibilidad de los datos" value={g.dataSensitivity} onChange={(v) => setGov('dataSensitivity', v)} options={SENSITIVITY} />
              </div>
              <div className="switches">
                <Switch label="Supervisión humana (HITL)" checked={g.hitlEnabled} onChange={(v) => setGov('hitlEnabled', v)} />
                <Switch label="Registro de auditoría" checked={g.auditLoggingEnabled} onChange={(v) => setGov('auditLoggingEnabled', v)} />
                <Switch label="Redacción de PII" checked={g.piiRedactionEnabled} onChange={(v) => setGov('piiRedactionEnabled', v)} />
              </div>
            </div>

            <details className="drivers">
              <summary className="small">Por qué este nivel ({risk.drivers.length} factores)</summary>
              <ul className="small">
                {risk.drivers.map((d) => (
                  <li key={d.label}>
                    <span>{d.label}</span> <strong>+{d.points}</strong>
                  </li>
                ))}
              </ul>
            </details>
          </Card>

          <Card title={`Controles obligatorios antes de producción`} actions={<span className={`badge ${blocking ? 'tone-bad' : 'tone-good'}`}>{blocking} bloqueante(s)</span>}>
            <ul className="controls">
              {risk.controls.map((c) => (
                <li key={c.id} className={c.blocking ? 'blocking' : ''}>
                  <div className="control-title">
                    {c.blocking ? <span className="badge tone-bad">Bloqueante</span> : <span className="badge tone-neutral">Recomendado</span>} {c.title}
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

function RiskMatrix({ autonomy, sensitivity, onPick }: { autonomy: AutonomyLevel; sensitivity: DataSensitivity; onPick: (a: AutonomyLevel, d: DataSensitivity) => void }) {
  return (
    <div className="matrix" role="grid" aria-label="Matriz de riesgo base: autonomía × sensibilidad de datos">
      <div className="matrix-y">Sensibilidad ↑</div>
      <div className="matrix-cells">
        {D_ORDER.map((d) => (
          <div className="matrix-row" role="row" key={d}>
            <span className="matrix-rowhead">{SENSITIVITY.find((x) => x.value === d)!.label}</span>
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
                  aria-label={`${AUTONOMY.find((x) => x.value === a)!.label} con datos ${SENSITIVITY.find((x) => x.value === d)!.label}: riesgo base ${t}`}
                  onClick={() => onPick(a, d)}
                >
                  {here && <CircleDot size={13} aria-hidden="true" />}
                  {t}
                </button>
              );
            })}
          </div>
        ))}
        <div className="matrix-row matrix-foot">
          <span className="matrix-rowhead" />
          {A_ORDER.map((a) => (
            <span key={a} className="matrix-colhead">{AUTONOMY.find((x) => x.value === a)!.label}</span>
          ))}
        </div>
      </div>
      <div className="matrix-x">Autonomía del agente → · riesgo base sin controles</div>
    </div>
  );
}

/** Flujo de caja acumulado a 24 meses: SVG nativo, sin librerías de gráficos (regla 07). */
function CashflowChart({ inputs, result }: { inputs: RoiInputs; result: RoiResult }) {
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
  return (
    <figure className="cashflow">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Flujo de caja acumulado a 24 meses: de ${fmtEur(pts[0]!)} a ${fmtEur(pts[months]!)}${be !== null ? `, equilibrio en el mes ${Math.ceil(be)}` : ', sin punto de equilibrio'}`}>
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
        Caja acumulada (24 meses): {fmtEur(pts[0]!)} → <strong>{fmtEur(pts[months]!)}</strong>
        {be !== null ? ` · equilibrio en el mes ${Math.ceil(be)}` : ' · sin equilibrio en 24 meses'}
      </figcaption>
    </figure>
  );
}
