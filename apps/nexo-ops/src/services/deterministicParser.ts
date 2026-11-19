import type { CapabilityId, ClauseCategory, Framework, RiskLevel, TenderClause, TenderScenario } from '../types/domain';

/**
 * Motor offline de reglas para pliegos pegados.
 * No "entiende" el pliego: lo segmenta y aplica reglas de palabras clave
 * auditables. Su valor es ser instantáneo, privado y reproducible; para
 * matices, el modo BYOK/Ollama lo enriquece (siempre con PII redactada).
 */

const FRAMEWORK_RULES: Array<[Framework, RegExp]> = [
  ['EU AI Act', /(AI Act|Reglamento de (Inteligencia Artificial|IA)|Reglamento \(UE\) 2024\/1689|alto riesgo|Anexo III)/i],
  ['ISO 42001', /42001/],
  ['ENS', /(\bENS\b|Esquema Nacional de Seguridad|RD 311\/2022)/i],
  ['ISO 27001', /27001/],
  ['RGPD', /(RGPD|GDPR|LOPDGDD|protecci[oó]n de datos|2016\/679|encargad[oa] del tratamiento|EIPD|transferencias? internacional)/i],
];

const CAPABILITY_RULES: Array<[CapabilityId, RegExp]> = [
  ['ens_alta', /(ENS|Esquema Nacional de Seguridad)[^.]*\bALTA\b/i],
  ['ens_media', /(ENS|Esquema Nacional de Seguridad)[^.]*\bMEDIA\b/i],
  ['iso42001', /42001/],
  ['iso27001', /27001/],
  ['ai_act_conformity', /(alto riesgo|Anexo III|evaluaci[oó]n de (la )?conformidad|art\.? 27 del Reglamento de IA|derechos fundamentales)/i],
  ['eu_hosting', /(Uni[oó]n Europea|Espacio Econ[oó]mico Europeo|\bEEE\b|residencia de (los )?datos|transferencias? internacional)/i],
  ['soc24x7', /(24x7|24\/7|\bSOC\b)/i],
  ['accessibility', /(accesibilidad|WCAG|301\s?549)/i],
  ['dpo', /(EIPD|delegad[oa] de protecci[oó]n|\bDPO\b|encargad[oa] del tratamiento|art\.? 22)/i],
  ['crm_integration', /(\bCRM\b|Dynamics|Salesforce|omnicanal)/i],
];

const CATEGORY_RULES: Array<[ClauseCategory, RegExp]> = [
  ['excluyente', /(excluyente|requisito (m[ií]nimo|obligatorio)|ser[áa]n? excluid|se exigir[áa]|deber[áa] acreditar|solvencia)/i],
  ['plazo', /(penalizaci[oó]n|demora|retraso|\bhitos?\b|\bSLA\b|disponibilidad m[ií]nima|resoluci[oó]n del contrato|plazo de (entrega|resoluci))/i],
  ['dependencia', /(subcontrataci[oó]n|aportad[oa]s? por|depende de|proveedor (actual|del modelo)|continuidad del proveedor|licencias)/i],
  ['cumplimiento', /(seguridad de la informaci[oó]n|confidencialidad|auditor[ií]a|transparencia|informar[áa] al usuario)/i],
  ['tecnico', /(integraci[oó]n|integrar[áa]|implantar[áa]|desarroll|plataforma|asistente|chatbot|\bAPI\b|migraci[oó]n|formaci[oó]n|monitorizaci[oó]n|interfaces?)/i],
];

const BUSINESS_BY_CATEGORY: Record<ClauseCategory, string> = {
  excluyente: 'Si no se cumple, la oferta queda fuera antes de valorarse.',
  plazo: 'Fija el ritmo del proyecto y lo que cuesta cada desviación.',
  tecnico: 'Determina el esfuerzo de construcción y los perfiles necesarios.',
  cumplimiento: 'Obligación normativa: su incumplimiento es sanción o inadmisión.',
  dependencia: 'Riesgo fuera de nuestro control que hay que acotar en la oferta.',
};

export function detectFramework(s: string): Framework | undefined {
  return FRAMEWORK_RULES.find(([, re]) => re.test(s))?.[0];
}

export function detectCapability(s: string): CapabilityId | undefined {
  return CAPABILITY_RULES.find(([, re]) => re.test(s))?.[0];
}

export function classifySentence(s: string): ClauseCategory | null {
  const framework = detectFramework(s);
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(s)) {
      // Una obligación normativa que no es excluyente se trata como cumplimiento.
      if (framework && cat !== 'excluyente' && cat !== 'plazo') return 'cumplimiento';
      return cat;
    }
  }
  return framework ? 'cumplimiento' : null;
}

export function riskOf(s: string, cat: ClauseCategory): RiskLevel {
  if (cat === 'excluyente') return 'Alto';
  if (/(resoluci[oó]n del contrato|\bALTA\b|alto riesgo|24x7|99[.,]9|m[aá]ximo del (1\d|[2-9]\d) ?%|excluyente)/i.test(s)) return 'Alto';
  if (cat === 'plazo' || cat === 'cumplimiento' || cat === 'dependencia' || /(obligatori|deber[áa])/i.test(s)) return 'Medio';
  return /(penalizaci|incumplimiento)/i.test(s) ? 'Medio' : 'Bajo';
}

export function parseDeadlineDays(text: string): number | null {
  const m = /plazo de ejecuci[oó]n[^.\n]*?(\d+)\s*(mes(?:es)?|semanas?|d[ií]as)/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  if (unit.startsWith('mes')) return n * 30;
  if (unit.startsWith('semana')) return n * 7;
  return n;
}

export function parseBudgetEur(text: string): number | null {
  const m = /presupuesto[^.\n]*?(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?\s*(€|euros)/i.exec(text);
  return m ? Number(m[1]!.replace(/\./g, '')) : null;
}

function parsePenaltyPct(s: string): number | undefined {
  if (!/(penalizaci|m[aá]ximo)/i.test(s)) return undefined;
  // Excluye porcentajes que no son penalización (p. ej. «disponibilidad del 99,9 %»).
  const all = [...s.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
    .filter((m) => !/(disponibilidad|subcontrataci)[^%]{0,30}$/i.test(s.slice(0, m.index)))
    .map((m) => Number(m[1]!.replace(',', '.')))
    .filter((n) => n < 50);
  return all.length ? Math.max(...all) : undefined;
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split(/\n+|(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/)
    .map((s) => s.replace(/^\s*(\d+[.)]|[-•·*])\s*/, '').trim())
    .filter((s) => s.length >= 25);
}

function summarize(s: string): string {
  const clean = s.replace(/\s+/g, ' ').replace(/[.;]$/, '');
  return clean.length > 120 ? `${clean.slice(0, 117)}…` : clean;
}

export interface ParseResult {
  scenario: TenderScenario;
  ignored: number;
  notes: string[];
}

export function parseTender(text: string, title = 'Pliego pegado (análisis por reglas)'): ParseResult {
  const notes: string[] = [];
  const sentences = splitSentences(text);
  const clauses: TenderClause[] = [];
  const seen = new Set<string>();
  let ignored = 0;

  for (const s of sentences) {
    if (/^(PLIEGO|PRESUPUESTO BASE|EXPEDIENTE)/i.test(s) || /^Presupuesto base/i.test(s)) {
      ignored++;
      continue;
    }
    const category = classifySentence(s);
    if (!category) {
      ignored++;
      continue;
    }
    const key = s.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    const framework = detectFramework(s);
    const requires = detectCapability(s);
    clauses.push({
      id: `P${clauses.length + 1}`,
      category,
      summary: summarize(s),
      framework,
      riskLevel: riskOf(s, category),
      metByTeam: false, // conservador: nada se da por cumplido sin revisión
      requires,
      evidence: s.length > 220 ? `${s.slice(0, 217)}…` : s,
      penaltyPct: category === 'plazo' ? parsePenaltyPct(s) : undefined,
      business: BUSINESS_BY_CATEGORY[category],
      source: 'reglas',
    });
    if (clauses.length >= 30) {
      notes.push('Se han analizado las primeras 30 cláusulas relevantes.');
      break;
    }
  }

  const deadline = parseDeadlineDays(text);
  if (deadline === null) notes.push('No se encontró «plazo de ejecución»: se asumen 180 días.');
  const budget = parseBudgetEur(text);

  const count = (c: ClauseCategory) => clauses.filter((x) => x.category === c).length;
  const scenario: TenderScenario = {
    id: 'pasted',
    title,
    sector: 'Detectado por reglas',
    deadlineDays: deadline ?? 180,
    budgetEur: budget ?? undefined,
    estimatedEffortDays: {
      discovery: 10 + 2 * count('dependencia') + Math.ceil(clauses.length / 2),
      build: 30 + 12 * count('tecnico'),
      securityQA: 10 + 6 * count('cumplimiento'),
      rollout: 10 + 3 * count('plazo'),
    },
    clauses,
    proposalOutline: [
      'Resumen ejecutivo y comprensión del pliego',
      'Solución técnica propuesta',
      ...(clauses.some((c) => c.framework === 'ENS') ? ['Plan de seguridad conforme al ENS'] : []),
      ...(clauses.some((c) => c.framework === 'RGPD') ? ['Protección de datos (RGPD/LOPDGDD)'] : []),
      ...(clauses.some((c) => c.framework === 'EU AI Act') ? ['Plan de conformidad con el Reglamento de IA'] : []),
      'Metodología, plan de trabajo e hitos',
      'Equipo y dedicación',
      'Gestión de riesgos y dependencias',
    ],
    sourceText: text,
  };
  if (clauses.length === 0) notes.push('No se detectaron cláusulas: ¿es el texto de un pliego técnico/administrativo?');
  return { scenario, ignored, notes };
}
