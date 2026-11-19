import { useEffect, useRef, useState } from 'react';
import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_URL, LlmError, testConnection } from '../services/llmAdapter';
import type { AiMode, AiSettings } from '../types/domain';

/**
 * Configuración Zero-Egress vs. API/Ollama. Todo en memoria:
 * - la clave no se escribe en localStorage/sessionStorage/IndexedDB/cookies;
 * - al recargar la pestaña desaparece;
 * - la CSP de la página solo permite conectar con api.anthropic.com y localhost:11434.
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

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setDraft(value);
      setTest({ state: 'idle' });
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open, value]);

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

  const modes: { id: AiMode; title: string; desc: string }[] = [
    { id: 'zero_egress', title: 'Zero-Egress (recomendado en demo)', desc: 'Motor determinista local. Nada sale del navegador. Nunca falla en vivo.' },
    { id: 'anthropic', title: 'BYOK · Anthropic', desc: 'Tu clave, en memoria. El pliego se envía con la PII ya redactada.' },
    { id: 'ollama', title: 'Ollama local', desc: 'Modelo en tu máquina (localhost:11434). Los datos no salen del equipo.' },
  ];

  return (
    <dialog ref={ref} className="modal" aria-labelledby="settings-title" onClose={onClose} onCancel={onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <header className="modal-head">
          <h2 id="settings-title">Modo de IA y privacidad</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>

        <fieldset className="modes">
          <legend className="sr-only">Modo</legend>
          {modes.map((m) => (
            <label key={m.id} className={`mode-opt ${draft.mode === m.id ? 'on' : ''}`}>
              <input type="radio" name="mode" value={m.id} checked={draft.mode === m.id} onChange={() => set({ mode: m.id })} />
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
              La llamada va directa del navegador a <code>api.anthropic.com</code> (sin servidor intermedio). Usa una clave de un workspace con límite de gasto. Al recargar la pestaña la clave se borra.
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
              <span role="status" className={`small ${test.state === 'ok' ? 'tone-text-good' : test.state === 'err' ? 'tone-text-bad' : ''}`}>
                {test.state === 'ok' ? '✓ ' : test.state === 'err' ? '✕ ' : ''}
                {test.msg}
              </span>
            )}
          </div>
        )}

        <footer className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Guardar en memoria</button>
        </footer>
      </form>
    </dialog>
  );
}
