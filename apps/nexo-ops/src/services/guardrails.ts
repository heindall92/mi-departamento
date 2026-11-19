/**
 * Guardrails deterministas de NEXO-OPS.
 *
 * Son controles reales (no texto decorativo): el simulador del Módulo 1 los
 * ejecuta sobre el payload de cada caso y la traza muestra lo que detectan.
 * Lo mismo protege el modo BYOK: antes de enviar un pliego a un LLM externo,
 * se redacta con `redactPii`.
 *
 * Aviso honesto: el detector de inyección es heurístico (defensa en profundidad).
 * El control que de verdad bloquea la exfiltración es `enforceCustomerScope`,
 * porque no depende de "entender" el texto: autoriza por identidad de sesión.
 */

/* ─────────────────────────── PII ─────────────────────────── */

export type PiiType = 'DNI' | 'NIE' | 'IBAN' | 'TARJETA' | 'TELEFONO' | 'EMAIL';

export interface PiiMatch {
  type: PiiType;
  value: string;
  start: number;
  end: number;
  /** true si superó la validación de dígito de control (DNI/NIE/IBAN/Luhn). */
  validated: boolean;
}

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

export function isValidDni(dni: string): boolean {
  const m = /^(\d{8})([A-Z])$/.exec(dni.toUpperCase());
  if (!m) return false;
  return DNI_LETTERS[Number(m[1]) % 23] === m[2];
}

export function isValidNie(nie: string): boolean {
  const m = /^([XYZ])(\d{7})([A-Z])$/.exec(nie.toUpperCase());
  if (!m) return false;
  const prefix = { X: '0', Y: '1', Z: '2' }[m[1] as 'X' | 'Y' | 'Z'];
  return DNI_LETTERS[Number(prefix + m[2]) % 23] === m[3];
}

/** ISO 13616: mueve 4 primeros al final, letras → números, mod 97 == 1. */
// #region guia:iban
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of code) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}
// #endregion guia:iban

export function isValidLuhn(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

interface Detector {
  type: PiiType;
  re: RegExp;
  validate?: (v: string) => boolean;
}

// Orden importante: IBAN y tarjeta antes que teléfono (evita solapes).
const DETECTORS: Detector[] = [
  { type: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){4,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g, validate: isValidIban },
  // Tarjetas: IIN real empieza por 2-6 (Mastercard, Visa, Amex, Discover…).
  { type: 'TARJETA', re: /\b[2-6](?:[ -]?\d){12,18}\b/g, validate: isValidLuhn },
  { type: 'NIE', re: /\b[XYZ]\d{7}[A-Z]\b/gi, validate: isValidNie },
  { type: 'DNI', re: /\b\d{8}[A-Z]\b/gi, validate: isValidDni },
  { type: 'EMAIL', re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g },
  { type: 'TELEFONO', re: /(?:\+34[ ]?)?\b[6789]\d{2}[ ]?\d{3}[ ]?\d{3}\b/g },
];

export function detectPii(text: string): PiiMatch[] {
  const found: PiiMatch[] = [];
  const taken: Array<[number, number]> = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);

  for (const det of DETECTORS) {
    det.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = det.re.exec(text)) !== null) {
      const value = m[0];
      const start = m.index;
      const end = start + value.length;
      if (overlaps(start, end)) continue;
      const validated = det.validate ? det.validate(value) : true;
      // Tarjeta/IBAN sin checksum válido = falso positivo probable → se ignora.
      if (!validated && (det.type === 'TARJETA' || det.type === 'IBAN')) continue;
      found.push({ type: det.type, value, start, end, validated });
      taken.push([start, end]);
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

export interface RedactionResult {
  text: string;
  /** Bóveda local token → valor real. Nunca sale del navegador. */
  vault: Record<string, string>;
  matches: PiiMatch[];
}

/** Tokeniza la PII (`[DNI_1]`, `[IBAN_1]`…) de forma determinista y reversible en local. */
export function redactPii(text: string): RedactionResult {
  const matches = detectPii(text);
  const counters: Partial<Record<PiiType, number>> = {};
  const byValue = new Map<string, string>();
  const vault: Record<string, string> = {};
  let out = '';
  let cursor = 0;
  for (const m of matches) {
    let token = byValue.get(m.value);
    if (!token) {
      counters[m.type] = (counters[m.type] ?? 0) + 1;
      token = `[${m.type}_${counters[m.type]}]`;
      byValue.set(m.value, token);
      vault[token] = m.value;
    }
    out += text.slice(cursor, m.start) + token;
    cursor = m.end;
  }
  out += text.slice(cursor);
  return { text: out, vault, matches };
}

export function restorePii(text: string, vault: Record<string, string>): string {
  return text.replace(/\[[A-Z]+_\d+\]/g, (tok) => vault[tok] ?? tok);
}

/* ───────────────────── Inyección de prompt ───────────────────── */

export interface InjectionSignal {
  rule: string;
  excerpt: string;
  weight: number;
}

export interface InjectionReport {
  score: number; // 0..100
  suspicious: boolean;
  signals: InjectionSignal[];
  sanitized: string;
}

const INJECTION_RULES: Array<{ rule: string; re: RegExp; weight: number }> = [
  { rule: 'Orden de anular instrucciones', re: /(ignora|olvida|omite)\s+(todas\s+)?(las\s+)?(instrucciones|indicaciones|reglas)(\s+anteriores)?/i, weight: 45 },
  { rule: 'Orden de anular instrucciones (EN)', re: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i, weight: 45 },
  { rule: 'Suplantación de rol del sistema', re: /(^|\n|<!--)\s*(system|sistema)\s*:/i, weight: 30 },
  { rule: 'Cambio de identidad del agente', re: /\b(ahora\s+eres|eres\s+ahora|act[uú]a\s+como|you\s+are\s+now)\b/i, weight: 25 },
  { rule: 'Contenido oculto (comentario HTML)', re: /<!--[\s\S]*?-->/, weight: 20 },
  { rule: 'Invocación de herramienta desde el texto del cliente', re: /\b(crm|db|api|tool)\.[a-z_]+\s*\(/i, weight: 30 },
  { rule: 'Petición de datos de terceros', re: /\b(otros?\s+clientes?|todos\s+los\s+clientes|cliente\s+C-\d+)/i, weight: 20 },
  { rule: 'Exfiltración de prompt', re: /(revela|muestra|imprime)\s+(tu|el)\s+(prompt|instrucciones\s+de\s+sistema)/i, weight: 35 },
  { rule: 'Caracteres invisibles', re: /[​-‏⁠﻿]/, weight: 15 },
];

export function detectInjection(text: string): InjectionReport {
  const signals: InjectionSignal[] = [];
  for (const r of INJECTION_RULES) {
    const m = r.re.exec(text);
    if (m) signals.push({ rule: r.rule, excerpt: m[0].trim().slice(0, 80), weight: r.weight });
  }
  const score = Math.min(100, signals.reduce((s, x) => s + x.weight, 0));
  const sanitized = text
    .replace(/<!--[\s\S]*?-->/g, '[contenido oculto eliminado]')
    .replace(/[​-‏⁠﻿]/g, '')
    .trim();
  return { score, suspicious: score >= 40, signals, sanitized };
}

/* ───────────────── Autorización por sesión (mínimo privilegio) ───────────────── */

export interface ScopeDecision {
  allowed: string[];
  denied: string[];
}

// #region guia:scope
/**
 * El agente nunca decide a qué cliente accede: la identidad sale del canal
 * autenticado, no del texto del mensaje ni de la salida del modelo.
 */
export function enforceCustomerScope(sessionCustomerId: string, requestedIds: string[]): ScopeDecision {
  const allowed: string[] = [];
  const denied: string[] = [];
  for (const id of requestedIds) (id === sessionCustomerId ? allowed : denied).push(id);
  return { allowed, denied };
}
// #endregion guia:scope

/* ───────────────── Política comercial determinista ───────────────── */

export interface CompensationPolicy {
  autoApproveLimitEur: number;
  /** Abono máximo por días sin servicio = cuota prorrateada × días. */
  outageCreditPerDay: (monthlyFeeEur: number) => number;
}

export const DEFAULT_POLICY: CompensationPolicy = {
  autoApproveLimitEur: 50,
  outageCreditPerDay: (fee) => Math.round((fee / 30) * 100) / 100,
};

export type PolicyDecision =
  | { kind: 'auto_approve'; amountEur: number }
  | { kind: 'escalate_hitl'; amountEur: number; reason: string };

// #region guia:policy
export function evaluateCompensation(amountEur: number, policy: CompensationPolicy = DEFAULT_POLICY): PolicyDecision {
  if (amountEur <= policy.autoApproveLimitEur) return { kind: 'auto_approve', amountEur };
  return {
    kind: 'escalate_hitl',
    amountEur,
    reason: `Importe ${amountEur.toFixed(2)} € > límite de aprobación automática (${policy.autoApproveLimitEur} €)`,
  };
}
// #endregion guia:policy
