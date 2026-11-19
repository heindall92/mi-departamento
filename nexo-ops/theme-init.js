/* Aplica tema e idioma guardados ANTES del primer pintado (evita destellos).
   Fichero externo y no inline: la CSP (script-src 'self') bloquea scripts inline. */
try {
  var s = localStorage.getItem('nexo-color-scheme');
  if (s === 'light' || s === 'dark') document.querySelector('meta[name="color-scheme"]').content = s;
  var l = localStorage.getItem('nexo-lang');
  if (l !== 'es' && l !== 'en') l = (navigator.language || 'es').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
  document.documentElement.lang = l;
} catch (e) {}
