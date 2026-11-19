/**
 * Animaciones de entrada con Web Animations API, ejecutadas UNA vez al montar.
 * Con @starting-style se repetían al volver a una pestaña oculta (display:none → visible),
 * es decir, se animaba una acción de teclado (1/2/3): justo lo que Emil Kowalski desaconseja.
 */
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

function reduced(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function once(el: HTMLElement | null, frames: Keyframe[], duration: number) {
  if (!el || el.dataset.appeared) return;
  el.dataset.appeared = '1';
  if (reduced() || typeof el.animate !== 'function') return;
  el.animate(frames, { duration, easing: EASE_OUT });
}

/** Entrada de un elemento nuevo (eventos de la traza, comparativa). */
export const enterRef = (el: HTMLElement | null) =>
  once(el, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], 240);

/** Cambio de valor (veredicto): breve desenfoque que funde el estado anterior con el nuevo. */
export const swapRef = (el: HTMLElement | null) =>
  once(el, [{ opacity: 0.2, filter: 'blur(3px)', transform: 'scale(0.97)' }, { opacity: 1, filter: 'none', transform: 'none' }], 220);
