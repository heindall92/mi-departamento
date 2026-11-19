import type { LucideIcon } from 'lucide-react';
import { BookOpen, Calculator, ChevronDown, Cpu, Download, Ellipsis, FileDown, KeyRound, Printer, RotateCcw, Scale, ShieldCheck, Workflow } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AiSettings } from '../types/domain';
import { MOBILE_QUERY, useMediaQuery } from '../utils/theme';

export type Tab = 'flow' | 'tender' | 'roi';

export const TABS: { id: Tab; num: string; label: string; short: string; sub: string; Icon: LucideIcon }[] = [
  { id: 'flow', num: '1', label: 'Flujos CX/CRM', short: 'Flujos', sub: 'Modo Caos + guardrails', Icon: Workflow },
  { id: 'tender', num: '2', label: 'Licitaciones', short: 'Licitaciones', sub: 'Motor Go / No-Go', Icon: Scale },
  { id: 'roi', num: '3', label: 'ROI + Gobernanza', short: 'ROI y riesgo', sub: 'ISO 42001 · AI Act', Icon: Calculator },
];

export function modeInfo(ai: AiSettings): { label: string; detail: string; tone: string; Icon: LucideIcon } {
  if (ai.mode === 'anthropic') return { label: 'BYOK', detail: 'api.anthropic.com', tone: 'warn', Icon: KeyRound };
  if (ai.mode === 'ollama') return { label: 'Local', detail: ai.ollamaUrl.replace(/^https?:\/\//, ''), tone: 'info', Icon: Cpu };
  return { label: 'Zero-Egress', detail: '0 conexiones externas', tone: 'good', Icon: ShieldCheck };
}

export const GUIDE_HREF = './como-se-hace.html';

export function TopBar({
  tab,
  onTab,
  ai,
  onSettings,
  onReset,
  onExportMd,
  onExportPdf,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  ai: AiSettings;
  onSettings: () => void;
  onReset: () => void;
  onExportMd: () => void;
  onExportPdf: () => void;
}) {
  const m = modeInfo(ai);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const tabs = (variant: 'top' | 'bottom') => (
    <nav className={variant === 'top' ? 'tabs' : 'bottom-nav'} role="tablist" aria-label="Módulos">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          id={variant === 'top' ? `tab-${t.id}` : `btab-${t.id}`}
          aria-selected={tab === t.id}
          aria-controls={`panel-${t.id}`}
          className={`tab ${tab === t.id ? 'on' : ''}`}
          onClick={() => onTab(t.id)}
          title={variant === 'top' ? `Atajo: tecla ${t.num}` : undefined}
        >
          <t.Icon size={variant === 'top' ? 17 : 22} strokeWidth={tab === t.id ? 2.2 : 1.8} aria-hidden="true" className="tab-icon" />
          <span className="tab-text">
            <span className="tab-label">{variant === 'top' ? t.label : t.short}</span>
            {variant === 'top' && <span className="tab-sub">{t.sub}</span>}
          </span>
        </button>
      ))}
    </nav>
  );

  return (
    <>
      <header className="topbar">
        <a className="brand" href="./" aria-label="NEXO-OPS, inicio">
          <span className="logo" aria-hidden="true">N</span>
          <span className="brand-text">
            <span className="brand-name">NEXO-OPS</span>
            <span className="brand-sub">Mesa de consultoría IA · CX/CRM · Licitaciones</span>
          </span>
        </a>

        <div className="top-tabs">{tabs('top')}</div>

        <div className="top-actions">
          <button type="button" className={`mode mode-${m.tone}`} onClick={onSettings} title="Modo de IA, privacidad y apariencia">
            <m.Icon size={16} aria-hidden="true" className="mode-icon" />
            <span className="mode-text">
              <span className="mode-label">{m.label}</span>
              <span className="mode-detail">{m.detail}</span>
            </span>
          </button>
          {!mobile && (
            <a className="btn btn-ghost guide-link" href={GUIDE_HREF} aria-label="Cómo se hace: guía del proyecto">
              <BookOpen size={16} aria-hidden="true" /> <span className="btn-text">Cómo se hace</span>
            </a>
          )}
          <div className="menu" ref={menuRef}>
            {mobile ? (
              <button type="button" className="btn icon-btn more-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Más acciones" onClick={() => setOpen((o) => !o)}>
                <Ellipsis size={20} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="btn btn-primary export-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Exportar One-Pager" onClick={() => setOpen((o) => !o)}>
                <Download size={16} aria-hidden="true" /> <span className="btn-text">Exportar One-Pager</span>
                <ChevronDown size={15} aria-hidden="true" className="chev" />
              </button>
            )}
            {open && (
              <div className="menu-list" role="menu">
                <button role="menuitem" type="button" onClick={() => { setOpen(false); onExportPdf(); }}>
                  <Printer size={16} aria-hidden="true" /> PDF (impresión limpia)
                </button>
                <button role="menuitem" type="button" onClick={() => { setOpen(false); onExportMd(); }}>
                  <FileDown size={16} aria-hidden="true" /> Markdown (.md)
                </button>
                {mobile && (
                  <>
                    <span className="menu-sep" role="separator" />
                    <a role="menuitem" href={GUIDE_HREF}>
                      <BookOpen size={16} aria-hidden="true" /> Cómo se hace
                    </a>
                    <button role="menuitem" type="button" onClick={() => { setOpen(false); onReset(); }}>
                      <RotateCcw size={16} aria-hidden="true" /> Reiniciar demo
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {!mobile && (
            <button type="button" className="btn btn-ghost icon-btn reset-btn" onClick={onReset} title="Vuelve al estado inicial de la demo" aria-label="Reiniciar demo">
              <RotateCcw size={16} aria-hidden="true" /> <span className="btn-text">Reiniciar</span>
            </button>
          )}
        </div>
      </header>
      {tabs('bottom')}
    </>
  );
}
