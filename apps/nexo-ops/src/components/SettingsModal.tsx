import { CircleCheck, Cpu, KeyRound, Monitor, Moon, ShieldCheck, Sun, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n/lang';
import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_URL, LlmError, testConnection } from '../services/llmAdapter';
import type { AiMode, AiSettings } from '../types/domain';
import { useColorScheme, type SchemePref } from '../utils/theme';

/**
 * Configuración Zero-Egress vs. API/Ollama + apariencia + idioma. Lo de IA, en memoria:
 * - la clave no se escribe en localStorage/sessionStorage/IndexedDB/cookies;
 * - al recargar la pestaña desaparece;
 * - no hay <form>: un campo de contraseña dentro de un formulario invita al gestor de
 *   contraseñas del navegador a ofrecer guardar la clave (revisión goldfish);
 * - la CSP de la página solo permite conectar con api.anthropic.com y localhost:11434.
 * En móvil el <dialog> se presenta como hoja inferior (CSS), con cierre ligero.
 */
export function SettingsModal({
  open,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  value: AiSettings;
  onClose: () => void;
  onSave: (s: AiSettings) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<AiSettings>(value);
  const [test, setTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'err'; msg?: string }>({ state: 'idle' });
  const scheme = useColorScheme();
  const [lang, setLang] = useLang();
  const L = (es: string, en: string) => (lang === 'en' ? en : es);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setDraft(value);
      setTest({ state: 'idle' });
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, value]);

  // Cierre ligero: nativo con closedby="any"; respaldo para navegadores sin soporte (Safari).
  useEffect(() => {
    const d = ref.current;
    if (!d || 'closedBy' in HTMLDialogElement.prototype) return;
    const onClick = (e: MouseEvent) => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      const inside = r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right;
      if (!inside) d.close();
    };
    d.addEventListener('click', onClick);
    return () => d.removeEventListener('click', onClick);
  }, []);

  const set = (p: Partial<AiSettings>) => {
    setDraft((d) => ({ ...d, ...p }));
    setTest({ state: 'idle' });
  };

  const runTest = async () => {
    setTest({ state: 'busy', msg: L('Probando…', 'Testing…') });
    try {
      setTest({ state: 'ok', msg: await testConnection(draft, lang) });
    } catch (e) {
      setTest({ state: 'err', msg: e instanceof LlmError ? e.message : L('Error inesperado.', 'Unexpected error.') });
    }
  };

  const modes: { id: AiMode; title: string; desc: string; Icon: typeof ShieldCheck }[] = [
    { id: 'zero_egress', title: 'Zero-Egress', desc: L('Motor determinista local. Nada sale del navegador. Nunca falla en vivo.', 'Local deterministic engine. Nothing leaves the browser. Never fails live.'), Icon: ShieldCheck },
    { id: 'anthropic', title: 'BYOK · Anthropic', desc: L('Tu clave, solo en memoria. El pliego sale con la PII habitual ya redactada.', 'Your key, in memory only. The tender leaves with common PII already redacted.'), Icon: KeyRound },
    { id: 'ollama', title: L('Ollama local', 'Local Ollama'), desc: L('Modelo en tu máquina (localhost:11434). Los datos no salen del equipo.', 'Model on your machine (localhost:11434). Data never leaves the computer.'), Icon: Cpu },
  ];

  const schemes: { id: SchemePref; label: string; Icon: typeof Sun }[] = [
    { id: 'system', label: `${L('Sistema', 'System')} (${scheme.systemDark ? L('oscuro', 'dark') : L('claro', 'light')})`, Icon: Monitor },
    { id: 'light', label: L('Claro', 'Light'), Icon: Sun },
    { id: 'dark', label: L('Oscuro', 'Dark'), Icon: Moon },
  ];

  return (
    <dialog ref={ref} className="modal" aria-labelledby="settings-title" onClose={onClose} {...({ closedby: 'any' } as Record<string, string>)}>
      <div className="modal-body">
        <span className="sheet-grabber" aria-hidden="true" />
        <header className="modal-head">
          <h2 id="settings-title">{L('Modo de IA, privacidad y apariencia', 'AI mode, privacy and appearance')}</h2>
          <button type="button" className="btn btn-ghost icon-btn" onClick={onClose} aria-label={L('Cerrar', 'Close')}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <fieldset className="modes">
          <legend className="sr-only">{L('Modo de IA', 'AI mode')}</legend>
          {modes.map((m) => (
            <label key={m.id} className={`mode-opt ${draft.mode === m.id ? 'on' : ''}`}>
              <input type="radio" name="mode" value={m.id} checked={draft.mode === m.id} onChange={() => set({ mode: m.id })} />
              <m.Icon size={18} aria-hidden="true" className="mode-opt-icon" />
              <span>
                <strong>{m.title}</strong>
                <span className="small muted">{m.desc}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {draft.mode === 'anthropic' && (
          <div className="fields">
            <label className="field">
              <span>{L('Clave de API (solo en memoria)', 'API key (memory only)')}</span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                placeholder="sk-ant-…"
                value={draft.anthropicKey}
                onChange={(e) => set({ anthropicKey: e.target.value })}
              />
            </label>
            <label className="field">
              <span>{L('Modelo', 'Model')}</span>
              <input value={draft.anthropicModel} onChange={(e) => set({ anthropicModel: e.target.value })} placeholder={DEFAULT_ANTHROPIC_MODEL} />
            </label>
            <p className="small note">
              {L('La llamada va directa del navegador a', 'The call goes straight from the browser to')} <code>api.anthropic.com</code>
              {L(
                ', sin servidor intermedio. Usa una clave de un workspace con límite de gasto y revócala tras la demo. Al recargar la pestaña, la clave se borra.',
                ', with no intermediate server. Use a key from a workspace with a spending limit and revoke it after the demo. Reloading the tab erases the key.',
              )}
            </p>
          </div>
        )}

        {draft.mode === 'ollama' && (
          <div className="fields">
            <label className="field">
              <span>{L('URL de Ollama', 'Ollama URL')}</span>
              <input value={draft.ollamaUrl} onChange={(e) => set({ ollamaUrl: e.target.value })} placeholder={DEFAULT_OLLAMA_URL} />
            </label>
            <label className="field">
              <span>{L('Modelo', 'Model')}</span>
              <input value={draft.ollamaModel} onChange={(e) => set({ ollamaModel: e.target.value })} placeholder={DEFAULT_OLLAMA_MODEL} />
            </label>
            <p className="small note">
              {L('Ollama debe aceptar este origen:', 'Ollama must allow this origin:')}{' '}
              <code>OLLAMA_ORIGINS="{typeof location !== 'undefined' ? location.origin : '*'}" ollama serve</code>.{' '}
              {L('Algunos navegadores piden permiso para acceder a la red local.', 'Some browsers ask for permission to access the local network.')}
            </p>
          </div>
        )}

        {draft.mode !== 'zero_egress' && (
          <div className="row gap">
            <button type="button" className="btn" onClick={runTest} disabled={test.state === 'busy'}>
              {L('Probar conexión', 'Test connection')}
            </button>
            {test.msg && (
              <span role="status" className={`small status-line ${test.state === 'ok' ? 'tone-text-good' : test.state === 'err' ? 'tone-text-bad' : ''}`}>
                {test.state === 'ok' && <CircleCheck size={15} aria-hidden="true" />}
                {test.state === 'err' && <TriangleAlert size={15} aria-hidden="true" />}
                {test.msg}
              </span>
            )}
          </div>
        )}

        <div className="prefs">
          <fieldset className="appearance">
            <legend>{L('Apariencia', 'Appearance')}</legend>
            <div className="segmented seg-sm" role="radiogroup" aria-label={L('Apariencia', 'Appearance')}>
              {schemes.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={scheme.pref === s.id} className={scheme.pref === s.id ? 'on' : ''} onClick={() => scheme.set(s.id)}>
                  <s.Icon size={15} aria-hidden="true" /> {s.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="appearance">
            <legend>{L('Idioma', 'Language')}</legend>
            <div className="segmented seg-sm" role="radiogroup" aria-label={L('Idioma', 'Language')}>
              {(['es', 'en'] as const).map((l) => (
                <button key={l} type="button" role="radio" lang={l} aria-checked={lang === l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>
                  {l === 'es' ? 'Español' : 'English'}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="small muted">
            {L('Tema e idioma se aplican al momento. Es lo único que esta página recuerda en tu navegador.', 'Theme and language apply instantly. They are the only things this page remembers in your browser.')}
          </p>
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{L('Cancelar', 'Cancel')}</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(draft)}>{L('Guardar en memoria', 'Save in memory')}</button>
        </footer>
      </div>
    </dialog>
  );
}
