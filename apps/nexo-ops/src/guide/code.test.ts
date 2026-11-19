import { describe, expect, it } from 'vitest';
import guardrails from '../services/guardrails.ts?raw';
import roi from '../services/roi.ts?raw';
import scoring from '../services/tenderScoring.ts?raw';
import { excerpt } from './code';

// Mismo mecanismo que usa la guía en producción (?raw de Vite).
const SOURCES: Record<string, string> = { 'guardrails.ts': guardrails, 'tenderScoring.ts': scoring, 'roi.ts': roi };
const src = (f: string) => SOURCES[f]!;

describe('la guía cita código real', () => {
  it.each([
    ['guardrails.ts', 'scope', 'function enforceCustomerScope'],
    ['guardrails.ts', 'policy', 'function evaluateCompensation'],
    ['guardrails.ts', 'iban', 'function isValidIban'],
    ['tenderScoring.ts', 'veto', "verdict = 'No-Go'"],
    ['roi.ts', 'roi', 'function computeRoi'],
  ])('%s · región «%s» existe y contiene %s', (file, region, needle) => {
    const code = excerpt(src(file), region);
    expect(code).toContain(needle);
    expect(code).not.toMatch(/#(end)?region/);
  });

  it('quita la sangría común y avisa si falta la región', () => {
    expect(excerpt('// #region guia:x\n    a\n      b\n// #endregion guia:x', 'x')).toBe('a\n  b');
    expect(excerpt('nada', 'y')).toContain('no encontrada');
  });
});
