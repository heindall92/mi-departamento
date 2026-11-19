import { CircleCheck, Cpu, KeyRound, Monitor, Moon, ShieldCheck, Sun, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_URL, LlmError, testConnection } from '../services/llmAdapter';
import type { AiMode, AiSettings } from '../types/domain';
import { useColorScheme, type SchemePref } from '../utils/theme';

/**
 * Configuración Zero-Egress vs. API/Ollama + apariencia. Todo lo de IA en memoria:
 * - la clave no se escribe en localStorage/sessionStorage/IndexedDB/cookies;
 * - al recargar la pestaña desaparece;
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
    setTest({ state: 'busy', msg: 'Probando…' });
    try {
      setTest({ state: 'ok', msg: await testConnection(draft) });
    } catch (e) {
      setTest({ state: 'err', msg: e instanceof LlmError ? e.message : 'Error inesperado.' });
    }
  };

  const modes: { id: AiMode; title: string; desc: string; Icon: typeof ShieldCheck }[] = [
    { id: 'zero_egress', title: 'Zero-Egress', desc: 'Motor determinista local. Nada sale del navegador. Nunca falla en vivo.', Icon: ShieldCheck },
    { id: 'anthropic', title: 'BYOK · Anthropic', desc: 'Tu clave, solo en memoria. El pliego sale con la PII ya redactada.', Icon: KeyRound },
    { id: 'ollama', title: 'Ollama local', desc: 'Modelo en tu máquina (localhost:11434). Los datos no salen del equipo.', Icon: Cpu },
  ];

  const schemes: { id: SchemePref; label: string; Icon: typeof Sun }[] = [
    { id: 'system', label: `Sistema (${scheme.systemDark ? 'oscuro' : 'claro'})`, Icon: Monitor },
    { id: 'light', label: 'Claro', Icon: Sun },
    { id: 'dark', label: 'Oscuro', Icon: Moon },
  ];

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="settings-title"
      onClose={onClose}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <span className="sheet-grabber" aria-hidden="true" />
        <header className="modal-head">
          <h2 id="settings-title">Modo de IA y privacidad</h2>
          <button type="button" className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <fieldset className="modes">
          <legend className="sr-only">Modo de IA</legend>
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
              <span>Clave de API (solo en memoria)</span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                placeholder="sk-ant-…"
                value={draft.anthropicKey}
                onChange={(e) => set({ anthropicKey: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Modelo</span>
              <input value={draft.anthropicModel} onChange={(e) => set({ anthropicModel: e.target.value })} placeholder={DEFAULT_ANTHROPIC_MODEL} />
            </label>
            <p className="small note">
              La llamada va directa del navegador a <code>api.anthropic.com</code>, sin servidor intermedio. Usa una clave de un workspace con límite de gasto. Al recargar la pestaña, la clave se borra.
            </p>
          </div>
        )}

        {draft.mode === 'ollama' && (
          <div className="fields">
            <label className="field">
              <span>URL de Ollama</span>
              <input value={draft.ollamaUrl} onChange={(e) => set({ ollamaUrl: e.target.value })} placeholder={DEFAULT_OLLAMA_URL} />
            </label>
            <label className="field">
              <span>Modelo</span>
              <input value={draft.ollamaModel} onChange={(e) => set({ ollamaModel: e.target.value })} placeholder={DEFAULT_OLLAMA_MODEL} />
            </label>
            <p className="small note">
              Ollama debe aceptar este origen: <code>OLLAMA_ORIGINS="{typeof location !== 'undefined' ? location.origin : '*'}" ollama serve</code>. Algunos navegadores piden permiso para acceder a la red local.
            </p>
          </div>
        )}

        {draft.mode !== 'zero_egress' && (
          <div className="row gap">
            <button type="button" className="btn" onClick={runTest} disabled={test.state === 'busy'}>
              Probar conexión
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

        <fieldset className="appearance">
          <legend>Apariencia</legend>
          <div className="segmented seg-sm" role="radiogroup" aria-label="Apariencia">
            {schemes.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={scheme.pref === s.id} className={scheme.pref === s.id ? 'on' : ''} onClick={() => scheme.set(s.id)}>
                <s.Icon size={15} aria-hidden="true" /> {s.label}
              </button>
            ))}
          </div>
          <p className="small muted">Se aplica al momento. Es lo único que esta página recuerda en tu navegador.</p>
        </fieldset>

        <footer className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Guardar en memoria</button>
        </footer>
      </form>
    </dialog>
  );
}
