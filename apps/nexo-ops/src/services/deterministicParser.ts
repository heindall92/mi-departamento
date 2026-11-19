import type { CapabilityId, ClauseCategory, Framework, RiskLevel, TenderClause, TenderScenario } from '../types/domain';

/**
 * Motor offline de reglas para pliegos pegados.
 * No "entiende" el pliego: lo segmenta y aplica reglas de palabras clave
 * auditables. Su valor es ser instantáneo, privado y reproducible; para
 * matices, el modo BYOK/Ollama lo enriquece (siempre con PII redactada).
 */

const FRAMEWORK_RULES: Array<[Framework, RegExp]> = [
  ['EU AI Act', /(AI Act|Reglamento de (Inteligencia Artificial|IA)|Reglamento \(UE\) 2024\/1689|Regulation \(EU\) 2024\/1689|alto riesgo|high risk|Anexo III|Annex III)/i],
  ['ISO 42001', /42001/],
  ['ENS', /(\bENS\b|Esquema Nacional de Seguridad|National Security Framework|RD 311\/2022)/i],
  ['ISO 27001', /27001/],
  ['RGPD', /(RGPD|GDPR|LOPDGDD|protecci[oó]n de datos|data protection|2016\/679|encargad[oa] del tratamiento|data processor|EIPD|DPIA|transferencias? internacional|international transfers?)/i],
];

const CAPABILITY_RULES: Array<[CapabilityId, RegExp]> = [
  ['ens_alta', /(ENS|Esquema Nacional de Seguridad|National Security Framework)[^.]*\b(ALTA|HIGH)\b/i],
  ['ens_media', /(ENS|Esquema Nacional de Seguridad|National Security Framework)[^.]*\b(MEDIA|MEDIUM)\b/i],
  ['iso42001', /42001/],
  ['iso27001', /27001/],
  ['ai_act_conformity', /(alto riesgo|high risk|Anexo III|Annex III|evaluaci[oó]n de (la )?conformidad|conformity assessment|art\.? 27 del Reglamento de IA|Art\.? 27 of the AI Act|derechos fundamentales|fundamental rights)/i],
  ['eu_hosting', /(Uni[oó]n Europea|European Union|Espacio Econ[oó]mico Europeo|European Economic Area|\bEEE\b|\bEEA\b|residencia de (los )?datos|data (and inference )?residency|transferencias? internacional|international transfers?)/i],
  ['soc24x7', /(24x7|24\/7|\bSOC\b)/i],
  ['accessibility', /(accesibilidad|accessibility|WCAG|301\s?549)/i],
  ['dpo', /(EIPD|DPIA|delegad[oa] de protecci[oó]n|\bDPO\b|encargad[oa] del tratamiento|data processor|art\.? 22)/i],
  ['crm_integration', /(\bCRM\b|Dynamics|Salesforce|omnicanal)/i],
];

const CATEGORY_RULES: Array<[ClauseCategory, RegExp]> = [
  ['excluyente', /(excluyente|requisito (m[ií]nimo|obligatorio)|ser[áa]n? excluid|se exigir[áa]|deber[áa] acreditar|solvencia|exclusionary|mandatory requirement|shall be required|must prove|solvency|will be excluded)/i],
  ['plazo', /(penalizaci[oó]n|demora|retraso|\bhitos?\b|\bSLA\b|disponibilidad m[ií]nima|resoluci[oó]n del contrato|plazo de (entrega|resoluci)|penalty|delay|milestones?|minimum availability|termination of the contract)/i],
  ['dependencia', /(subcontrataci[oó]n|aportad[oa]s? por|depende de|proveedor (actual|del modelo)|continuidad del proveedor|licencias|subcontracting|provided by|depends on|current (telephony )?provider|continuity of the|licen[cs]es)/i],
  ['cumplimiento', /(seguridad de la informaci[oó]n|confidencialidad|auditor[ií]a|transparencia|informar[áa] al usuario|information security|confidentiality|audit|transparency|inform the user)/i],
  ['tecnico', /(integraci[oó]n|integrar[áa]|implantar[áa]|desarroll|plataforma|asistente|chatbot|\bAPI\b|migraci[oó]n|formaci[oó]n|monitorizaci[oó]n|interfaces?|integrat|deploy|develop|platform|assistant|migration|training|monitoring)/i],
];

const BUSINESS_BY_CATEGORY_EN: Record<ClauseCategory, string> = {
  excluyente: 'If not met, the bid is out before it is scored.',
  plazo: 'Sets the project pace and what each deviation costs.',
  tecnico: 'Drives build effort and the profiles needed.',
  cumplimiento: 'A regulatory obligation: breaching it means fines or rejection.',
  dependencia: 'A risk outside our control that must be bounded in the bid.',
};

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
  if (/(resoluci[oó]n del contrato|termination of the contract|\bALTA\b|\bHIGH\b|alto riesgo|high risk|24x7|24\/7|99[.,]9|m[aá]ximo del (1\d|[2-9]\d) ?%|maximum of (1\d|[2-9]\d) ?%|excluyente|exclusionary)/i.test(s)) return 'Alto';
  if (cat === 'plazo' || cat === 'cumplimiento' || cat === 'dependencia' || /(obligatori|deber[áa]|mandatory|\bmust\b|\bshall\b)/i.test(s)) return 'Medio';
  return /(penalizaci|incumplimiento|penalty|non-compliance)/i.test(s) ? 'Medio' : 'Bajo';
}

export function parseDeadlineDays(text: string): number | null {
  const m = /(?:plazo de ejecuci[oó]n|execution period)[^.\n]*?(\d+)\s*(mes(?:es)?|months?|semanas?|weeks?|d[ií]as|days)/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  if (unit.startsWith('mes') || unit.startsWith('month')) return n * 30;
  if (unit.startsWith('semana') || unit.startsWith('week')) return n * 7;
  return n;
}

export function parseBudgetEur(text: string): number | null {
  const m = /(?:presupuesto|budget)[^\n]*?(\d{1,3}(?:[.,]\d{3})+|\d+)(?:,\d{1,2})?\s*(€|euros)/i.exec(text);
  return m ? Number(m[1]!.replace(/[.,]/g, '')) : null;
}

function parsePenaltyPct(s: string): number | undefined {
  if (!/(penalizaci|m[aá]ximo|penalty|maximum)/i.test(s)) return undefined;
  // Excluye porcentajes que no son penalización (p. ej. «disponibilidad del 99,9 %»).
  const all = [...s.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
    .filter((m) => !/(disponibilidad|subcontrataci|availability|subcontracting)[^%]{0,30}$/i.test(s.slice(0, m.index)))
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

export function parseTender(text: string, title?: string, lang: 'es' | 'en' = 'es'): ParseResult {
  const en = lang === 'en';
  const L = (es: string, e: string) => (en ? e : es);
  const notes: string[] = [];
  const sentences = splitSentences(text);
  const clauses: TenderClause[] = [];
  const seen = new Set<string>();
  let ignored = 0;

  for (const s of sentences) {
    if (/^(PLIEGO|PRESUPUESTO BASE|EXPEDIENTE|TECHNICAL SPECIFICATIONS|Tender budget)/i.test(s)) {
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
      business: (en ? BUSINESS_BY_CATEGORY_EN : BUSINESS_BY_CATEGORY)[category],
      source: 'reglas',
    });
    if (clauses.length >= 30) {
      notes.push(L('Se han analizado las primeras 30 cláusulas relevantes.', 'The first 30 relevant clauses have been analysed.'));
      break;
    }
  }

  const deadline = parseDeadlineDays(text);
  if (deadline === null) notes.push(L('No se encontró «plazo de ejecución»: se asumen 180 días.', 'No “execution period” found: 180 days assumed.'));
  const budget = parseBudgetEur(text);

  const count = (c: ClauseCategory) => clauses.filter((x) => x.category === c).length;
  const scenario: TenderScenario = {
    id: 'pasted',
    title: title ?? L('Pliego pegado (análisis por reglas)', 'Pasted tender (rule-based analysis)'),
    sector: L('Detectado por reglas', 'Detected by rules'),
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
      L('Resumen ejecutivo y comprensión del pliego', 'Executive summary and understanding of the tender'),
      L('Solución técnica propuesta', 'Proposed technical solution'),
      ...(clauses.some((c) => c.framework === 'ENS') ? [L('Plan de seguridad conforme al ENS', 'ENS-compliant security plan')] : []),
      ...(clauses.some((c) => c.framework === 'RGPD') ? [L('Protección de datos (RGPD/LOPDGDD)', 'Data protection (GDPR)')] : []),
      ...(clauses.some((c) => c.framework === 'EU AI Act') ? [L('Plan de conformidad con el Reglamento de IA', 'AI Act conformity plan')] : []),
      L('Metodología, plan de trabajo e hitos', 'Methodology, work plan and milestones'),
      L('Equipo y dedicación', 'Team and allocation'),
      L('Gestión de riesgos y dependencias', 'Risk and dependency management'),
    ],
    sourceText: text,
  };
  if (clauses.length === 0) notes.push(L('No se detectaron cláusulas: ¿es el texto de un pliego técnico/administrativo?', 'No clauses detected: is this the text of a tender specification?'));
  return { scenario, ignored, notes };
}
