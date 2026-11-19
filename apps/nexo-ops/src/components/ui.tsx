import type { LucideIcon } from 'lucide-react';
import { CircleCheck, ShieldCheck, ShieldX, TriangleAlert, UserRoundCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ComplianceState, RiskTier, TraceStatus, Verdict } from '../types/domain';

/** Estados siempre con icono + texto: nunca solo color (regla 07 de accesibilidad). */
const STATUS: Record<TraceStatus, { label: string; short: string; Icon: LucideIcon; tone: string }> = {
  ok: { label: 'OK', short: 'OK', Icon: CircleCheck, tone: 'good' },
  warning: { label: 'Aviso', short: 'Aviso', Icon: TriangleAlert, tone: 'warn' },
  blocked: { label: 'Bloqueado', short: 'Bloqueado', Icon: ShieldCheck, tone: 'good' },
  escalated: { label: 'Escalado a humano', short: 'HITL', Icon: UserRoundCheck, tone: 'info' },
  leak: { label: 'Fuga / daño', short: 'Fuga', Icon: ShieldX, tone: 'bad' },
};

export function statusTone(s: TraceStatus) {
  return STATUS[s].tone;
}

export function StatusBadge({ status, compact = false }: { status: TraceStatus; compact?: boolean }) {
  const s = STATUS[status];
  return (
    <span className={`badge tone-${s.tone}`} title={s.label}>
      <s.Icon size={13} strokeWidth={2.25} aria-hidden="true" />
      {compact ? s.short : s.label}
    </span>
  );
}

const COMPLIANCE_TONE: Record<ComplianceState, string> = { Cumple: 'good', Mitigado: 'info', Incumple: 'bad' };
export function ComplianceBadge({ value }: { value: ComplianceState }) {
  return <span className={`badge badge-outline tone-${COMPLIANCE_TONE[value]}`}>{value}</span>;
}

const VERDICT_TONE: Record<Verdict, string> = { Go: 'good', Revisar: 'warn', 'No-Go': 'bad' };
export function verdictTone(v: Verdict) {
  return VERDICT_TONE[v];
}

const TIER_TONE: Record<RiskTier, string> = { Bajo: 'good', Moderado: 'warn', Alto: 'bad', Crítico: 'crit' };
export function tierTone(t: RiskTier) {
  return TIER_TONE[t];
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = 'md',
  className = '',
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; hint?: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={`segmented seg-${size} ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.hint}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  onLabel = 'ON',
  offLabel = 'OFF',
  className = '',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  onLabel?: string;
  offLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch ${checked ? 'is-on' : 'is-off'} ${className}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span className="switch-label">{label}</span>
      <span className="switch-state" aria-hidden="true">{checked ? onLabel : offLabel}</span>
    </button>
  );
}

export function SliderField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  format,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="slider-field">
      <div className="slider-head">
        <label htmlFor={id}>{label}</label>
        <span className="slider-input">
          <input
            type="number"
            inputMode="decimal"
            aria-label={`${label} (valor exacto)`}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
            }}
          />
          {suffix && <span className="suffix">{suffix}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format ? format(value) : `${value}${suffix ?? ''}`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Card({ title, actions, children, className = '', id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Barra 0–100. Anima con transform (compositor), no con width. */
export function Meter({ value, label, tone }: { value: number; label: string; tone?: string }) {
  const t = tone ?? (value >= 70 ? 'good' : value >= 50 ? 'warn' : 'bad');
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <strong className="num-tab">{value}</strong>
      </div>
      <div className="meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className={`meter-fill fill-${t}`} style={{ transform: `scaleX(${Math.max(0.02, value / 100)})` }} />
      </div>
    </div>
  );
}
