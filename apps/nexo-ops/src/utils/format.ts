/** Formatos numéricos según idioma. El motor no conoce React: el idioma se fija aquí. */
let locale = 'es-ES';
let cache: Record<string, Intl.NumberFormat> = {};
export function setFormatLocale(lang: 'es' | 'en') {
  const next = lang === 'en' ? 'en-IE' : 'es-ES'; // en-IE: inglés con euro y formato europeo
  if (next !== locale) {
    locale = next;
    cache = {};
  }
}
const nf = (key: string, opts: Intl.NumberFormatOptions) => (cache[key] ??= new Intl.NumberFormat(locale, opts));

export const fmtEur = (n: number) => nf('e0', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n));
export const fmtEur2 = (n: number) => nf('e2', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
export const fmtNum = (n: number) => nf('n0', { maximumFractionDigits: 0 }).format(n);
export const fmtNum1 = (n: number) => nf('n1', { maximumFractionDigits: 1 }).format(n);
export const fmtPct = (n: number) => (locale === 'es-ES' ? `${fmtNum(n)} %` : `${fmtNum(n)}%`);

export function fmtMs(ms: number): string {
  if (ms >= 60_000) return `${fmtNum1(ms / 60_000)} min`;
  if (ms >= 1000) return `${fmtNum1(ms / 1000)} s`;
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
