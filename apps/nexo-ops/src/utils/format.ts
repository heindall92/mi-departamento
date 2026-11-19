const eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

export const fmtEur = (n: number) => eur0.format(Math.round(n));
export const fmtEur2 = (n: number) => eur2.format(n);
export const fmtNum = (n: number) => num0.format(n);
export const fmtNum1 = (n: number) => num1.format(n);
export const fmtPct = (n: number) => `${num0.format(n)} %`;

export function fmtMs(ms: number): string {
  if (ms >= 60_000) return `${num1.format(ms / 60_000)} min`;
  if (ms >= 1000) return `${num1.format(ms / 1000)} s`;
  return `${Math.round(ms)} ms`;
}

/** T+mm:ss.mmm relativo al inicio del caso (determinista, sin reloj real). */
export function fmtT(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = Math.floor(ms % 1000);
  return `T+${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
