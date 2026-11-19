import type { LucideIcon } from 'lucide-react';
import { BookOpen, Calculator, ChevronDown, Cpu, Download, Ellipsis, FileDown, KeyRound, Languages, Moon, Printer, RotateCcw, Scale, ShieldCheck, Sun, Workflow } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLang, type Lang } from '../i18n/lang';
import type { AiSettings } from '../types/domain';
import { MOBILE_QUERY, toggleScheme, useColorScheme, useMediaQuery } from '../utils/theme';

export type Tab = 'flow' | 'tender' | 'roi';

type Bi = { es: string; en: string };
export const TABS: { id: Tab; num: string; label: Bi; short: Bi; sub: Bi; Icon: LucideIcon }[] = [
  { id: 'flow', num: '1', label: { es: 'Flujos CX/CRM', en: 'CX/CRM flows' }, short: { es: 'Flujos', en: 'Flows' }, sub: { es: 'Modo Caos + guardrails', en: 'Chaos Mode + guardrails' }, Icon: Workflow },
  { id: 'tender', num: '2', label: { es: 'Licitaciones', en: 'Tenders' }, short: { es: 'Licitaciones', en: 'Tenders' }, sub: { es: 'Motor Go / No-Go', en: 'Go / No-Go engine' }, Icon: Scale },
  { id: 'roi', num: '3', label: { es: 'ROI + Gobernanza', en: 'ROI + Governance' }, short: { es: 'ROI y riesgo', en: 'ROI & risk' }, sub: { es: 'ISO 42001 · AI Act', en: 'ISO 42001 · AI Act' }, Icon: Calculator },
];

export function modeInfo(ai: AiSettings, lang: Lang): { label: string; detail: string; tone: string; Icon: LucideIcon } {
  if (ai.mode === 'anthropic') return { label: 'BYOK', detail: 'api.anthropic.com', tone: 'warn', Icon: KeyRound };
  if (ai.mode === 'ollama') return { label: 'Local', detail: ai.ollamaUrl.replace(/^https?:\/\//, ''), tone: 'info', Icon: Cpu };
  return { label: 'Zero-Egress', detail: lang === 'en' ? '0 external connections' : '0 conexiones externas', tone: 'good', Icon: ShieldCheck };
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
  const [lang, setLang] = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);
  const m = modeInfo(ai, lang);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const scheme = useColorScheme();
  const isDark = scheme.pref === 'dark' || (scheme.pref === 'system' && scheme.systemDark);
  const themeLabel = isDark ? L('Cambiar a modo claro', 'Switch to light mode') : L('Cambiar a modo oscuro', 'Switch to dark mode');
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
    <nav className={variant === 'top' ? 'tabs' : 'bottom-nav'} role="tablist" aria-label={L('Módulos', 'Modules')}>
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          id={variant === 'top' ? `tab-${t.id}` : `btab-${t.id}`}
          aria-selected={tab === t.id}
          aria-controls={`panel-${t.id}`}
          className={`tab ${tab === t.id ? 'on' : ''}`}
          onClick={() => onTab(t.id)}
          title={variant === 'top' ? L(`Atajo: tecla ${t.num}`, `Shortcut: key ${t.num}`) : undefined}
        >
          <t.Icon size={variant === 'top' ? 17 : 22} strokeWidth={tab === t.id ? 2.2 : 1.8} aria-hidden="true" className="tab-icon" />
          <span className="tab-text">
            <span className="tab-label">{variant === 'top' ? t.label[lang] : t.short[lang]}</span>
            {variant === 'top' && <span className="tab-sub">{t.sub[lang]}</span>}
          </span>
        </button>
      ))}
    </nav>
  );

  return (
    <>
      <header className="topbar">
        <a className="brand" href="./" aria-label={L('NEXO-OPS, inicio', 'NEXO-OPS, home')}>
          <span className="logo" aria-hidden="true">N</span>
          <span className="brand-text">
            <span className="brand-name">NEXO-OPS</span>
            <span className="brand-sub">{L('Mesa de consultoría IA · CX/CRM · Licitaciones', 'AI consulting desk · CX/CRM · Tenders')}</span>
          </span>
        </a>

        <div className="top-tabs">{tabs('top')}</div>

        <div className="top-actions">
          <button type="button" className={`mode mode-${m.tone}`} onClick={onSettings} title={L('Modo de IA, privacidad y apariencia', 'AI mode, privacy and appearance')}>
            <m.Icon size={16} aria-hidden="true" className="mode-icon" />
            <span className="mode-text">
              <span className="mode-label">{m.label}</span>
              <span className="mode-detail">{m.detail}</span>
            </span>
          </button>
          {!mobile && (
            <>
              <div className="segmented seg-sm lang-switch" role="radiogroup" aria-label={L('Idioma', 'Language')}>
                {(['es', 'en'] as const).map((l) => (
                  <button key={l} type="button" role="radio" lang={l} aria-checked={lang === l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)} title={L('Atajo: tecla L', 'Shortcut: key L')}>
                    <span aria-hidden="true">{l.toUpperCase()}</span>
                    <span className="sr-only">{l === 'es' ? 'Español' : 'English'}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-ghost icon-btn theme-btn" onClick={toggleScheme} aria-label={themeLabel} title={`${themeLabel} (T)`}>
                {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
              </button>
              <a className="btn btn-ghost guide-link" href={GUIDE_HREF} aria-label={L('Cómo se hace: guía del proyecto', 'How it’s made: project guide')}>
                <BookOpen size={16} aria-hidden="true" /> <span className="btn-text">{L('Cómo se hace', 'How it’s made')}</span>
              </a>
            </>
          )}
          <div className="menu" ref={menuRef}>
            {mobile ? (
              <button type="button" className="btn icon-btn more-btn" aria-haspopup="menu" aria-expanded={open} aria-label={L('Más acciones', 'More actions')} onClick={() => setOpen((o) => !o)}>
                <Ellipsis size={20} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="btn btn-primary export-btn" aria-haspopup="menu" aria-expanded={open} aria-label={L('Exportar One-Pager', 'Export One-Pager')} onClick={() => setOpen((o) => !o)}>
                <Download size={16} aria-hidden="true" /> <span className="btn-text">{L('Exportar One-Pager', 'Export One-Pager')}</span>
                <ChevronDown size={15} aria-hidden="true" className="chev" />
              </button>
            )}
            {open && (
              <div className="menu-list" role="menu">
                <button role="menuitem" type="button" onClick={() => { setOpen(false); onExportPdf(); }}>
                  <Printer size={16} aria-hidden="true" /> {L('PDF (impresión limpia)', 'PDF (clean print)')}
                </button>
                <button role="menuitem" type="button" onClick={() => { setOpen(false); onExportMd(); }}>
                  <FileDown size={16} aria-hidden="true" /> Markdown (.md)
                </button>
                {mobile && (
                  <>
                    <span className="menu-sep" role="separator" />
                    <button role="menuitem" type="button" lang={lang === 'es' ? 'en' : 'es'} onClick={() => { setOpen(false); setLang(lang === 'es' ? 'en' : 'es'); }}>
                      <Languages size={16} aria-hidden="true" /> {lang === 'es' ? 'English' : 'Español'}
                    </button>
                    <button role="menuitem" type="button" onClick={() => { setOpen(false); toggleScheme(); }}>
                      {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />} {isDark ? L('Modo claro', 'Light mode') : L('Modo oscuro', 'Dark mode')}
                    </button>
                    <a role="menuitem" href={GUIDE_HREF}>
                      <BookOpen size={16} aria-hidden="true" /> {L('Cómo se hace', 'How it’s made')}
                    </a>
                    <button role="menuitem" type="button" onClick={() => { setOpen(false); onReset(); }}>
                      <RotateCcw size={16} aria-hidden="true" /> {L('Reiniciar demo', 'Reset demo')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {!mobile && (
            <button type="button" className="btn btn-ghost icon-btn reset-btn" onClick={onReset} title={L('Vuelve al estado inicial de la demo', 'Back to the demo’s initial state')} aria-label={L('Reiniciar demo', 'Reset demo')}>
              <RotateCcw size={16} aria-hidden="true" /> <span className="btn-text">{L('Reiniciar', 'Reset')}</span>
            </button>
          )}
        </div>
      </header>
      {tabs('bottom')}
    </>
  );
}
