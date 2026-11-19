import { useCallback, useSyncExternalStore } from 'react';

/**
 * Esquema de color: «system» (por defecto, sin valor guardado), «light» o «dark».
 * Patrón de modern-web-guidance (dark-mode-toggle): la <meta name="color-scheme">
 * es la fuente de verdad y el CSS la refleja con :has(); el CSS no depende de JS.
 * Solo se guarda la preferencia visual. Nunca datos ni claves.
 */
export type SchemePref = 'system' | 'light' | 'dark';
const KEY = 'nexo-color-scheme';

function meta(): HTMLMetaElement | null {
  return document.querySelector('meta[name="color-scheme"]');
}

export function readPref(): SchemePref {
  const c = meta()?.content;
  return c === 'light' || c === 'dark' ? c : 'system';
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function setPref(p: SchemePref) {
  const m = meta();
  if (m) m.content = p === 'system' ? 'light dark' : p;
  try {
    if (p === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, p);
  } catch {
    /* almacenamiento bloqueado: el tema se aplica igualmente en esta pestaña */
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    const v = e.newValue;
    const m = meta();
    if (m) m.content = v === 'light' || v === 'dark' ? v : 'light dark';
    cb();
  };
  mq.addEventListener('change', cb);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener('change', cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useColorScheme(): { pref: SchemePref; systemDark: boolean; set: (p: SchemePref) => void } {
  const pref = useSyncExternalStore(subscribe, readPref, () => 'system' as SchemePref);
  const systemDark = useSyncExternalStore(subscribe, () => window.matchMedia('(prefers-color-scheme: dark)').matches, () => false);
  const set = useCallback((p: SchemePref) => setPref(p), []);
  return { pref, systemDark, set };
}

/** Media query reactiva (para cambiar de composición, no de estilos sueltos). */
export function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(q);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(q).matches,
    () => false,
  );
}

export const MOBILE_QUERY = '(max-width: 760px)';

/** Esquema que se está viendo ahora (preferencia guardada o, si no hay, la del sistema). */
export function renderedScheme(): 'light' | 'dark' {
  const p = readPref();
  if (p !== 'system') return p;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Interruptor de dos estados (modern-web-guidance · dark-mode-toggle):
 * el destino es lo contrario de lo que se VE; si coincide con el sistema,
 * se borra la preferencia en lugar de fijarla, para no anclar el tema sin querer.
 */
export function toggleScheme() {
  const target = renderedScheme() === 'dark' ? 'light' : 'dark';
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setPref(target === (systemDark ? 'dark' : 'light') ? 'system' : target);
}
