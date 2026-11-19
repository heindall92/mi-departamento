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
  const m = /^(\d{8})([A-Z])$/.exec(dni.toUpperCase().replace(/[\s-]/g, ''));
  if (!m) return false;
  return DNI_LETTERS[Number(m[1]) % 23] === m[2];
}

export function isValidNie(nie: string): boolean {
  const m = /^([XYZ])(\d{7})([A-Z])$/.exec(nie.toUpperCase().replace(/[\s-]/g, ''));
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
  // Mayúsculas o minúsculas, con o sin espacios: el checksum mod-97 descarta falsos positivos.
  { type: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){4,7}(?:[ ]?[A-Z0-9]{1,3})?\b/gi, validate: isValidIban },
  // Tarjetas: IIN real empieza por 2-6 (Mastercard, Visa, Amex, Discover…).
  { type: 'TARJETA', re: /\b[2-6](?:[ -]?\d){12,18}\b/g, validate: isValidLuhn },
  { type: 'NIE', re: /\b[XYZ][ -]?\d{7}[ -]?[A-Z]\b/gi, validate: isValidNie },
  { type: 'DNI', re: /\b\d{8}[ -]?[A-Z]\b/gi, validate: isValidDni },
  { type: 'EMAIL', re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g },
  // 612 345 678 · 612-345-678 · 612 34 56 78 · +34 612345678
  { type: 'TELEFONO', re: /(?:\+34[ -]?)?\b[6789]\d{2}(?:[ -]?\d{3}[ -]?\d{3}|[ -]?\d{2}[ -]?\d{2}[ -]?\d{2})\b/g },
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

/**
 * Normalización antes de buscar patrones: sin ella, una «о» cirílica en «ignоre»
 * o un carácter invisible entre letras basta para esquivar las reglas.
 * Sigue siendo heurístico: es defensa en profundidad, no la barrera principal.
 */
const INVISIBLE = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]|\uDB40[\uDC00-\uDC7F]/g;
const HOMOGLYPHS: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ɡ: 'g', һ: 'h', ӏ: 'l', ԛ: 'q', ԝ: 'w',
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X', У: 'Y', І: 'I',
  α: 'a', ο: 'o', ν: 'v', ρ: 'p', τ: 't', ι: 'i', κ: 'k', Α: 'A', Β: 'B', Ε: 'E', Ι: 'I', Κ: 'K', Μ: 'M', Ν: 'N', Ο: 'O', Ρ: 'P', Τ: 'T', Χ: 'X',
};
const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPHS).join('')}]`, 'g');

export function normalizeForDetection(text: string): { text: string; invisible: number; homoglyphs: number } {
  const invisible = (text.match(INVISIBLE) ?? []).length;
  const nfkc = text.normalize('NFKC').replace(INVISIBLE, '');
  let homoglyphs = 0;
  // Solo se sustituyen dentro de palabras que mezclan alfabetos (no se toca el texto cirílico legítimo).
  const out = nfkc.replace(/\S+/g, (w) => {
    if (!/[A-Za-z]/.test(w) || !HOMOGLYPH_RE.test(w)) {
      HOMOGLYPH_RE.lastIndex = 0;
      return w;
    }
    HOMOGLYPH_RE.lastIndex = 0;
    return w.replace(HOMOGLYPH_RE, (c) => {
      homoglyphs++;
      return HOMOGLYPHS[c]!;
    });
  });
  return { text: out, invisible, homoglyphs };
}

const INJECTION_RULES: Array<{ es: string; en: string; re: RegExp; weight: number }> = [
  { es: 'Orden de anular instrucciones', en: 'Instruction override', re: /(ignora|olvida|omite)\s+(todas\s+)?(las\s+)?(instrucciones|indicaciones|reglas)(\s+anteriores)?|ignore\s+(all\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions|rules)|disregard\s+(all\s+)?(previous|prior|above)/i, weight: 45 },
  { es: 'Suplantación de rol del sistema', en: 'System role impersonation', re: /(^|\n|<!--)\s*(system|sistema)\s*:/i, weight: 30 },
  { es: 'Cambio de identidad del agente', en: 'Agent identity change', re: /\b(ahora\s+eres|eres\s+ahora|act[uú]a\s+como|you\s+are\s+now|act\s+as|pretend\s+to\s+be)\b/i, weight: 25 },
  { es: 'Contenido oculto (comentario HTML)', en: 'Hidden content (HTML comment)', re: /<!--[\s\S]*?-->/, weight: 20 },
  { es: 'Invocación de herramienta desde el texto del cliente', en: 'Tool invocation from customer text', re: /\b(crm|db|api|tool)\.[a-z_]+\s*\(/i, weight: 30 },
  { es: 'Petición de datos de terceros', en: 'Request for third-party data', re: /\b(otros?\s+clientes?|todos\s+los\s+clientes|cliente\s+C-\d+|other\s+customers?|all\s+customers|customer\s+C-\d+)/i, weight: 20 },
  { es: 'Exfiltración de prompt', en: 'Prompt exfiltration', re: /(revela|muestra|imprime)\s+(tu|el)\s+(prompt|instrucciones\s+de\s+sistema)|(reveal|show|print|repeat)\s+(your|the)\s+(system\s+)?(prompt|instructions)/i, weight: 35 },
];

export function detectInjection(text: string, lang: 'es' | 'en' = 'es'): InjectionReport {
  const norm = normalizeForDetection(text);
  const signals: InjectionSignal[] = [];
  const label = (r: { es: string; en: string }) => (lang === 'en' ? r.en : r.es);
  for (const r of INJECTION_RULES) {
    const m = r.re.exec(norm.text);
    if (m) signals.push({ rule: label(r), excerpt: m[0].trim().slice(0, 80), weight: r.weight });
  }
  if (norm.invisible) {
    signals.push({ rule: label({ es: 'Caracteres invisibles o de control (bidi, etiquetas)', en: 'Invisible or control characters (bidi, tags)' }), excerpt: `×${norm.invisible}`, weight: 15 });
  }
  if (norm.homoglyphs) {
    signals.push({ rule: label({ es: 'Homóglifos: alfabetos mezclados en una palabra', en: 'Homoglyphs: mixed scripts in one word' }), excerpt: `×${norm.homoglyphs}`, weight: 20 });
  }
  const score = Math.min(100, signals.reduce((s, x) => s + x.weight, 0));
  const sanitized = text
    .replace(/<!--[\s\S]*?-->/g, lang === 'en' ? '[hidden content removed]' : '[contenido oculto eliminado]')
    .replace(INVISIBLE, '')
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
export function evaluateCompensation(amountEur: number, policy: CompensationPolicy = DEFAULT_POLICY, lang: 'es' | 'en' = 'es'): PolicyDecision {
  const en = lang === 'en';
  // Importes no positivos o no numéricos nunca se aprueban solos.
  if (!Number.isFinite(amountEur) || amountEur <= 0) {
    return { kind: 'escalate_hitl', amountEur, reason: en ? 'Invalid amount: requires human review' : 'Importe no válido: requiere revisión humana' };
  }
  if (amountEur <= policy.autoApproveLimitEur) return { kind: 'auto_approve', amountEur };
  return {
    kind: 'escalate_hitl',
    amountEur,
    reason: en
      ? `Amount €${amountEur.toFixed(2)} > automatic approval limit (€${policy.autoApproveLimitEur})`
      : `Importe ${amountEur.toFixed(2)} € > límite de aprobación automática (${policy.autoApproveLimitEur} €)`,
  };
}
// #endregion guia:policy
