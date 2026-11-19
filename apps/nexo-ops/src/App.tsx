import { useCallback, useEffect, useMemo, useState } from 'react';
import { OnePager } from './components/OnePager';
import { SettingsModal } from './components/SettingsModal';
import { TABS, TopBar, type Tab } from './components/TopBar';
import { DEMO_PRESET, incidentById } from './data/cxFlowScenarios';
import { DEFAULT_CAPABILITIES, DEFAULT_TEAM_FTE, DEFAULT_WEIGHTS, TENDER_SCENARIOS } from './data/tenderScenarios';
import { FlowSimulator, type FlowState } from './modules/FlowSimulator';
import { RoiGovernance, type RoiState } from './modules/RoiGovernance';
import { TenderAnalyzer, type TenderState } from './modules/TenderAnalyzer';
import { runFlow } from './services/flowEngine';
import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_URL } from './services/llmAdapter';
import { downloadMarkdown, type ReportData } from './services/reportExporter';
import { assessRisk } from './services/riskIndex';
import { breakEvenAutomationPct, computeRoi, DEFAULT_ROI } from './services/roi';
import { buildProposalOutline, estimateEffort, evaluateTender } from './services/tenderScoring';
import type { AiSettings, TenderScenario } from './types/domain';

const initialFlow = (): FlowState => ({ incident: DEMO_PRESET.incident, guardrails: DEMO_PRESET.guardrails, step: 0, playing: false, selected: null });
const initialTender = (): TenderState => ({
  scenarioId: TENDER_SCENARIOS[0]!.id,
  caps: { ...DEFAULT_CAPABILITIES },
  weights: { ...DEFAULT_WEIGHTS },
  fte: DEFAULT_TEAM_FTE,
  overrides: {},
  pastedText: '',
  pasted: null,
  parseNotes: [],
  ai: { state: 'idle' },
  aiClauses: [],
});
const initialRoi = (): RoiState => ({
  inputs: { ...DEFAULT_ROI },
  gov: { autonomyLevel: 'semiautonomo', dataSensitivity: 'pii_financiero', hitlEnabled: true, auditLoggingEnabled: true, piiRedactionEnabled: true, useCase: 'atencion_cliente' },
});

/** Ajustes de IA: SOLO en estado de React. Ni localStorage, ni sessionStorage, ni cookies. */
const initialAi = (): AiSettings => ({
  mode: 'zero_egress',
  anthropicKey: '',
  anthropicModel: DEFAULT_ANTHROPIC_MODEL,
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
});

export default function App() {
  const [tab, setTab] = useState<Tab>('flow');
  const [flow, setFlow] = useState<FlowState>(initialFlow);
  const [tender, setTender] = useState<TenderState>(initialTender);
  const [roi, setRoi] = useState<RoiState>(initialRoi);
  const [ai, setAi] = useState<AiSettings>(initialAi);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /* Módulo 1 */
  const flowRun = useMemo(() => runFlow(flow.incident, flow.guardrails), [flow.incident, flow.guardrails]);
  const flowCounter = useMemo(() => runFlow(flow.incident, !flow.guardrails), [flow.incident, flow.guardrails]);

  /* Módulo 2 */
  const tenderScenario: TenderScenario | null = useMemo(() => {
    if (tender.scenarioId !== 'pasted') return TENDER_SCENARIOS.find((s) => s.id === tender.scenarioId)!;
    if (!tender.pasted) return null;
    return { ...tender.pasted, clauses: [...tender.pasted.clauses, ...tender.aiClauses] };
  }, [tender.scenarioId, tender.pasted, tender.aiClauses]);
  const tenderEval = useMemo(
    () => (tenderScenario ? evaluateTender(tenderScenario, tender.caps, tender.weights, tender.fte, tender.overrides) : null),
    [tenderScenario, tender.caps, tender.weights, tender.fte, tender.overrides],
  );
  const effort = useMemo(() => (tenderScenario ? estimateEffort(tenderScenario, tender.caps, tender.overrides) : []), [tenderScenario, tender.caps, tender.overrides]);
  const outline = useMemo(() => (tenderScenario ? buildProposalOutline(tenderScenario, tender.caps, tender.overrides) : []), [tenderScenario, tender.caps, tender.overrides]);

  /* Módulo 3 */
  const roiResult = useMemo(() => computeRoi(roi.inputs, roi.gov), [roi.inputs, roi.gov]);
  const risk = useMemo(() => assessRisk(roi.gov), [roi.gov]);
  const breakEven = useMemo(() => breakEvenAutomationPct(roi.inputs, roi.gov), [roi.inputs, roi.gov]);

  /* One-Pager: si no hay pliego pegado, usa el escenario A para no dejar el informe vacío. */
  const report: ReportData = useMemo(() => {
    const sc = tenderScenario ?? TENDER_SCENARIOS[0]!;
    const ev = tenderEval ?? evaluateTender(sc, tender.caps, tender.weights, tender.fte);
    return {
      generatedAt: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      flow: { incidentTitle: incidentById(flow.incident)?.title ?? null, guardrails: flow.guardrails, run: flowRun, counterfactual: flowCounter },
      tender: { scenario: sc, evaluation: ev, effort: tenderScenario ? effort : estimateEffort(sc, tender.caps), outline: tenderScenario ? outline : buildProposalOutline(sc, tender.caps) },
      roi: { inputs: roi.inputs, result: roiResult, governance: roi.gov, risk },
    };
  }, [tenderScenario, tenderEval, tender.caps, tender.weights, tender.fte, flow.incident, flow.guardrails, flowRun, flowCounter, effort, outline, roi, roiResult, risk]);

  const reset = useCallback(() => {
    setFlow(initialFlow());
    setTender(initialTender());
    setRoi(initialRoi());
    setTab('flow');
  }, []);

  // Atajos para la demo en vivo: 1/2/3 cambian de módulo; G alterna guardrails.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select, dialog[open]')) return;
      const hit = TABS.find((x) => x.num === e.key);
      if (hit) setTab(hit.id);
      if (e.key.toLowerCase() === 'g' && tab === 'flow') setFlow((s) => ({ ...s, guardrails: !s.guardrails, step: 0, playing: true, selected: null }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  return (
    <>
      <div className="app">
        <a className="skip" href="#main">Saltar al contenido</a>
        <TopBar
          tab={tab}
          onTab={setTab}
          ai={ai}
          onSettings={() => setSettingsOpen(true)}
          onReset={reset}
          onExportMd={() => downloadMarkdown(report)}
          onExportPdf={() => window.print()}
        />
        <main id="main" className="main">
          <div role="tabpanel" id="panel-flow" aria-labelledby="tab-flow" hidden={tab !== 'flow'}>
            <FlowSimulator state={flow} setState={setFlow} run={flowRun} counterfactual={flowCounter} />
          </div>
          <div role="tabpanel" id="panel-tender" aria-labelledby="tab-tender" hidden={tab !== 'tender'}>
            <TenderAnalyzer
              state={tender}
              setState={setTender}
              scenario={tenderScenario}
              evaluation={tenderEval}
              effort={effort}
              outline={outline}
              ai={ai}
              onOpenSettings={() => setSettingsOpen(true)}
              onFallbackToLocal={() => {
                setAi((a) => ({ ...a, mode: 'zero_egress' }));
                setTender((s) => ({ ...s, ai: { state: 'idle' } }));
              }}
            />
          </div>
          <div role="tabpanel" id="panel-roi" aria-labelledby="tab-roi" hidden={tab !== 'roi'}>
            <RoiGovernance state={roi} setState={setRoi} result={roiResult} risk={risk} breakEven={breakEven} />
          </div>
        </main>
        <footer className="foot">
          <span>NEXO-OPS v1.0 · Yoandy Ramírez Delgado</span>
          <span>Escenarios y datos ficticios · indicadores orientativos, no asesoramiento jurídico</span>
          <span className="muted">Atajos: 1 · 2 · 3 módulos · G guardrails</span>
        </footer>
      </div>
      <SettingsModal
        open={settingsOpen}
        value={ai}
        onClose={() => setSettingsOpen(false)}
        onSave={(s) => {
          setAi(s);
          setSettingsOpen(false);
        }}
      />
      <OnePager d={report} />
    </>
  );
}
