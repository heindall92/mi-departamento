import { useEffect, useRef, useState } from 'react';
import type { AiSettings } from '../types/domain';

export type Tab = 'flow' | 'tender' | 'roi';

export const TABS: { id: Tab; num: string; label: string; sub: string }[] = [
  { id: 'flow', num: '1', label: 'Flujos CX/CRM', sub: 'Modo Caos + guardrails' },
  { id: 'tender', num: '2', label: 'Licitaciones', sub: 'Motor Go / No-Go' },
  { id: 'roi', num: '3', label: 'ROI + Gobernanza', sub: 'ISO 42001 · AI Act' },
];

export function modeInfo(ai: AiSettings): { label: string; detail: string; tone: string } {
  if (ai.mode === 'anthropic') return { label: 'BYOK', detail: 'api.anthropic.com', tone: 'warn' };
  if (ai.mode === 'ollama') return { label: 'Local', detail: ai.ollamaUrl.replace(/^https?:\/\//, ''), tone: 'info' };
  return { label: 'Zero-Egress', detail: '0 conexiones externas', tone: 'good' };
}

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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden="true">N</span>
        <div>
          <div className="brand-name">NEXO-OPS</div>
          <div className="brand-sub">Mesa de consultoría IA · CX/CRM · Licitaciones</div>
        </div>
      </div>

      <nav className="tabs" role="tablist" aria-label="Módulos">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={`tab ${tab === t.id ? 'on' : ''}`}
            onClick={() => onTab(t.id)}
            title={`Atajo: tecla ${t.num}`}
          >
            <span className="tab-num">{t.num}</span>
            <span className="tab-text">
              <span className="tab-label">{t.label}</span>
              <span className="tab-sub">{t.sub}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="top-actions">
        <button type="button" className={`mode mode-${m.tone}`} onClick={onSettings} title="Modo de IA y privacidad (clic para cambiar)">
          <span className="mode-dot" aria-hidden="true" />
          <span className="mode-label">{m.label}</span>
          <span className="mode-detail">{m.detail}</span>
        </button>
        <div className="menu" ref={menuRef}>
          <button type="button" className="btn btn-primary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            Exportar One-Pager ▾
          </button>
          {open && (
            <div className="menu-list" role="menu">
              <button role="menuitem" type="button" onClick={() => { setOpen(false); onExportPdf(); }}>
                PDF (impresión limpia)
              </button>
              <button role="menuitem" type="button" onClick={() => { setOpen(false); onExportMd(); }}>
                Markdown (.md)
              </button>
            </div>
          )}
        </div>
        <button type="button" className="btn btn-ghost" onClick={onReset} title="Vuelve al estado inicial de la demo">
          ↺ Reiniciar
        </button>
      </div>
    </header>
  );
}
