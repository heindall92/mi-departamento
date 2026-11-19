import { describe, expect, it, vi, afterEach } from 'vitest';
import type { AiSettings } from '../types/domain';
import { analyzeTenderWithAi, extractJson, LlmError, normalizeAiClauses, testConnection } from './llmAdapter';

const ollama: AiSettings = { mode: 'ollama', anthropicKey: '', anthropicModel: 'claude-opus-5-5', ollamaUrl: 'http://localhost:11434', ollamaModel: 'llama3.1' };

afterEach(() => vi.unstubAllGlobals());

describe('normalización de salida del modelo', () => {
  it('filtra categorías inválidas y acota campos', () => {
    const out = normalizeAiClauses({ clauses: [
      { category: 'plazo', summary: 'Hito a 3 meses', framework: null, riskLevel: 'Alto', evidence: 'x', business: 'y' },
      { category: 'inventada', summary: 'no vale' },
      { category: 'cumplimiento', summary: 'EIPD', framework: 'RGPD', riskLevel: 'raro' },
    ] });
    expect(out.map((c) => c.category)).toEqual(['plazo', 'cumplimiento']);
    expect(out[1]!.riskLevel).toBe('Medio');
    expect(out.every((c) => c.source === 'ia' && c.metByTeam === false)).toBe(true);
  });
  it('rechaza formatos inesperados', () => {
    expect(() => normalizeAiClauses({ foo: 1 })).toThrow(LlmError);
    expect(() => extractJson('sin json')).toThrow(LlmError);
    expect(extractJson('texto {"clauses": []} fin')).toEqual({ clauses: [] });
  });
});

describe('Ollama', () => {
  it('redacta PII antes de enviar (dogfooding del guardrail)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: '{"clauses":[{"category":"tecnico","summary":"Integración CRM","framework":null,"riskLevel":"Medio","evidence":"e","business":"b"}]}' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await analyzeTenderWithAi('Contacto del órgano: DNI 12345678Z, IBAN ES91 2100 0418 4502 0005 1332.', ollama);
    const body = String(fetchMock.mock.calls[0]![1].body);
    expect(body).not.toContain('12345678Z');
    expect(body).toContain('[DNI_1]');
    expect(r.redactedCount).toBe(2);
    expect(r.clauses).toHaveLength(1);
  });
  it('fallo de red/CORS → LlmError network (la UI vuelve al motor local)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(analyzeTenderWithAi('texto', ollama)).rejects.toMatchObject({ kind: 'network' });
  });
  it('modelo no instalado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [{ name: 'mistral:latest' }] }), { status: 200 })));
    await expect(testConnection(ollama)).rejects.toMatchObject({ kind: 'model' });
  });
  it('Zero-Egress nunca llama a fetch', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(analyzeTenderWithAi('x', { ...ollama, mode: 'zero_egress' })).rejects.toBeInstanceOf(LlmError);
    expect(f).not.toHaveBeenCalled();
  });
  it('Anthropic sin clave no hace ninguna llamada', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(analyzeTenderWithAi('x', { ...ollama, mode: 'anthropic' })).rejects.toMatchObject({ kind: 'auth' });
    expect(f).not.toHaveBeenCalled();
  });
});
