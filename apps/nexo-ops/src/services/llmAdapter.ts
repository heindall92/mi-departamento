import type { AiSettings, ClauseCategory, Framework, RiskLevel, TenderClause } from '../types/domain';
import { redactPii } from './guardrails';

/**
 * Conector opcional BYOK (Anthropic) / Ollama local.
 *
 * Reglas no negociables (sección 07 del roadmap):
 *  - La clave vive solo en memoria (estado React). Este módulo no la guarda.
 *  - Antes de salir del navegador, el texto pasa por `redactPii` (dogfooding
 *    del guardrail del Módulo 1): el proveedor nunca recibe DNI/IBAN/teléfonos.
 *  - Cualquier fallo devuelve un error tipado; la UI vuelve al motor
 *    determinista sin perder los datos cargados.
 *  - El SDK se carga con import() dinámico: en modo Zero-Egress ni siquiera
 *    se descarga su código.
 */

export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'llama3.1';

export type LlmErrorKind = 'auth' | 'network' | 'rate_limit' | 'refusal' | 'bad_output' | 'model' | 'unknown';

export class LlmError extends Error {
  constructor(
    public kind: LlmErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export interface AiClauseResult {
  clauses: TenderClause[];
  provider: string;
  redactedCount: number;
}

const CATEGORIES: ClauseCategory[] = ['excluyente', 'plazo', 'tecnico', 'cumplimiento', 'dependencia'];
const FRAMEWORKS: Framework[] = ['RGPD', 'ENS', 'ISO 27001', 'EU AI Act', 'ISO 42001'];
const RISKS: RiskLevel[] = ['Bajo', 'Medio', 'Alto'];

export const CLAUSE_SCHEMA = {
  type: 'object',
  properties: {
    clauses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: CATEGORIES },
          summary: { type: 'string' },
          framework: { type: ['string', 'null'], enum: [...FRAMEWORKS, null] },
          riskLevel: { type: 'string', enum: RISKS },
          evidence: { type: 'string' },
          business: { type: 'string' },
        },
        required: ['category', 'summary', 'framework', 'riskLevel', 'evidence', 'business'],
        additionalProperties: false,
      },
    },
  },
  required: ['clauses'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Eres analista senior de licitaciones públicas en España (LCSP 9/2017) especializado en CX/CRM, IA y ciberseguridad.
Extrae del pliego las cláusulas que afectan a la decisión Go/No-Go, con foco en las que un lector rápido pasaría por alto: requisitos de seguridad (ENS, ISO 27001), protección de datos (RGPD), Reglamento de IA (UE) 2024/1689, ISO/IEC 42001, penalizaciones y dependencias de terceros.
- category: excluyente (inadmisión si no se cumple), plazo (plazos, hitos, SLA, penalizaciones), tecnico (entregables), cumplimiento (obligación normativa), dependencia (terceros).
- summary: una línea en español, concreta, sin adornos.
- evidence: cita literal breve del pliego.
- business: una frase con la consecuencia de negocio si se incumple.
Los marcadores como [DNI_1] o [IBAN_1] son datos personales redactados: no intentes reconstruirlos.
Responde únicamente con el JSON pedido.`;

/** Valida y normaliza la salida del modelo. Nada del modelo entra en la UI sin pasar por aquí. */
export function normalizeAiClauses(raw: unknown): TenderClause[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { clauses?: unknown }).clauses)) {
    throw new LlmError('bad_output', 'La respuesta del modelo no tiene el formato esperado.');
  }
  const out: TenderClause[] = [];
  for (const [i, c] of ((raw as { clauses: unknown[] }).clauses).entries()) {
    if (!c || typeof c !== 'object') continue;
    const r = c as Record<string, unknown>;
    const category = CATEGORIES.includes(r.category as ClauseCategory) ? (r.category as ClauseCategory) : null;
    const riskLevel = RISKS.includes(r.riskLevel as RiskLevel) ? (r.riskLevel as RiskLevel) : 'Medio';
    const summary = typeof r.summary === 'string' ? r.summary.trim().slice(0, 160) : '';
    if (!category || !summary) continue;
    out.push({
      id: `IA${i + 1}`,
      category,
      summary,
      framework: FRAMEWORKS.includes(r.framework as Framework) ? (r.framework as Framework) : undefined,
      riskLevel,
      metByTeam: false,
      evidence: typeof r.evidence === 'string' ? r.evidence.slice(0, 240) : undefined,
      business: typeof r.business === 'string' ? r.business.slice(0, 200) : undefined,
      source: 'ia',
    });
    if (out.length >= 25) break;
  }
  return out;
}

export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new LlmError('bad_output', 'El modelo no devolvió JSON.');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new LlmError('bad_output', 'El JSON devuelto por el modelo no es válido.');
  }
}

/* ───────────────────────── Anthropic (BYOK) ───────────────────────── */

async function anthropicClient(key: string) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // dangerouslyAllowBrowser: es BYOK deliberado. La clave es del usuario, vive
  // solo en memoria de esta pestaña y viaja únicamente a api.anthropic.com
  // (la CSP de la página bloquea cualquier otro destino).
  return { Anthropic, client: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 }) };
}

async function mapAnthropicError(err: unknown): Promise<LlmError> {
  if (err instanceof LlmError) return err;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new LlmError('auth', 'Clave rechazada por Anthropic. Revisa que sea válida y tenga saldo.');
  }
  if (err instanceof Anthropic.NotFoundError) return new LlmError('model', 'Modelo no encontrado. Revisa el identificador.');
  if (err instanceof Anthropic.RateLimitError) return new LlmError('rate_limit', 'Límite de uso alcanzado. Reintenta en unos segundos.');
  if (err instanceof Anthropic.APIConnectionError) return new LlmError('network', 'Sin conexión con api.anthropic.com (red, proxy o CSP).');
  if (err instanceof Anthropic.APIError) return new LlmError('unknown', `Error de la API (${err.status ?? '—'}).`);
  return new LlmError('unknown', err instanceof Error ? err.message : 'Error desconocido.');
}

async function anthropicAnalyze(text: string, s: AiSettings, signal?: AbortSignal): Promise<unknown> {
  try {
    const { client } = await anthropicClient(s.anthropicKey);
    // Fallback de servidor por categoría de rechazo: si el modelo principal
    // declina, la API reintenta con otro modelo dentro de la misma llamada.
    const response = await client.beta.messages.create(
      {
        model: s.anthropicModel || DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM_PROMPT,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: CLAUSE_SCHEMA as unknown as Record<string, unknown> } },
        messages: [{ role: 'user', content: `PLIEGO (PII redactada):\n\n${text}` }],
      },
      { signal },
    );
    if (response.stop_reason === 'refusal') {
      throw new LlmError('refusal', 'El modelo declinó analizar este texto. Se mantiene el análisis por reglas.');
    }
    const body = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return extractJson(body);
  } catch (err) {
    throw await mapAnthropicError(err);
  }
}

/* ───────────────────────── Ollama (local) ───────────────────────── */

async function ollamaFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new LlmError(
      'network',
      'No se pudo contactar con Ollama. ¿Está en marcha y permite este origen? (OLLAMA_ORIGINS)',
    );
  }
}

async function ollamaAnalyze(text: string, s: AiSettings, signal?: AbortSignal): Promise<unknown> {
  const base = (s.ollamaUrl || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
  const res = await ollamaFetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: s.ollamaModel || DEFAULT_OLLAMA_MODEL,
      stream: false,
      format: CLAUSE_SCHEMA,
      options: { temperature: 0 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `PLIEGO (PII redactada):\n\n${text}` },
      ],
    }),
  });
  if (res.status === 404) throw new LlmError('model', `Modelo «${s.ollamaModel}» no instalado en Ollama (ollama pull ${s.ollamaModel}).`);
  if (!res.ok) throw new LlmError('unknown', `Ollama respondió ${res.status}.`);
  const data = (await res.json()) as { message?: { content?: string } };
  return extractJson(data.message?.content ?? '');
}

/* ───────────────────────── API pública ───────────────────────── */

export async function analyzeTenderWithAi(rawText: string, s: AiSettings, signal?: AbortSignal): Promise<AiClauseResult> {
  if (s.mode === 'zero_egress') throw new LlmError('unknown', 'Modo Zero-Egress activo: no se envía nada fuera del navegador.');
  const red = redactPii(rawText);
  const text = red.text.slice(0, 60_000);
  if (s.mode === 'anthropic' && !s.anthropicKey.trim()) throw new LlmError('auth', 'Falta la clave de API.');
  const raw = s.mode === 'anthropic' ? await anthropicAnalyze(text, s, signal) : await ollamaAnalyze(text, s, signal);
  return {
    clauses: normalizeAiClauses(raw),
    provider: s.mode === 'anthropic' ? `Anthropic · ${s.anthropicModel}` : `Ollama · ${s.ollamaModel}`,
    redactedCount: red.matches.length,
  };
}

export async function testConnection(s: AiSettings): Promise<string> {
  if (s.mode === 'anthropic') {
    if (!s.anthropicKey.trim()) throw new LlmError('auth', 'Introduce una clave de API.');
    try {
      const { client } = await anthropicClient(s.anthropicKey);
      const m = await client.models.retrieve(s.anthropicModel || DEFAULT_ANTHROPIC_MODEL);
      return `Conectado · ${m.display_name ?? m.id}`;
    } catch (err) {
      throw await mapAnthropicError(err);
    }
  }
  if (s.mode === 'ollama') {
    const base = (s.ollamaUrl || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
    const res = await ollamaFetch(`${base}/api/tags`, { method: 'GET' });
    if (!res.ok) throw new LlmError('unknown', `Ollama respondió ${res.status}.`);
    const data = (await res.json()) as { models?: { name: string }[] };
    const names = (data.models ?? []).map((m) => m.name);
    const wanted = s.ollamaModel || DEFAULT_OLLAMA_MODEL;
    if (!names.some((n) => n === wanted || n.startsWith(`${wanted}:`))) {
      throw new LlmError('model', `Ollama responde, pero no tiene «${wanted}». Disponibles: ${names.join(', ') || 'ninguno'}.`);
    }
    return `Conectado · Ollama (${names.length} modelo(s))`;
  }
  return 'Zero-Egress: sin conexiones externas.';
}
