import { useCallback, useSyncExternalStore } from 'react';
import { setFormatLocale } from '../utils/format';

/**
 * Idioma de la interfaz (es | en). Mismo patrón que el tema: una fuente de verdad
 * (<html lang>), aplicada antes del primer pintado por theme-init.js y guardada solo
 * si el usuario la elige. Los motores son puros: reciben el idioma como parámetro.
 */
export type Lang = 'es' | 'en';
const KEY = 'nexo-lang';

export function pick<T>(lang: Lang, es: T, en: T): T {
  return lang === 'en' ? en : es;
}

export function readLang(): Lang {
  if (typeof document === 'undefined') return 'es';
  return document.documentElement.lang === 'en' ? 'en' : 'es';
}

const listeners = new Set<() => void>();

export function setLang(l: Lang) {
  document.documentElement.lang = l;
  setFormatLocale(l);
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* almacenamiento bloqueado: el idioma se aplica igualmente en esta pestaña */
  }
  listeners.forEach((f) => f());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && (e.newValue === 'es' || e.newValue === 'en')) {
      document.documentElement.lang = e.newValue;
      setFormatLocale(e.newValue);
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useLang(): [Lang, (l: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, readLang, () => 'es' as Lang);
  setFormatLocale(lang);
  return [lang, useCallback((l: Lang) => setLang(l), [])];
}

/** Traductor en línea: tx('Reiniciar', 'Restart'). Mantiene cada texto junto a su uso. */
export function useT(): (es: string, en: string) => string {
  const [lang] = useLang();
  return useCallback((es: string, en: string) => (lang === 'en' ? en : es), [lang]);
}
