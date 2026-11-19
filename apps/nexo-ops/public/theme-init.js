/* Aplica el esquema de color guardado ANTES del primer pintado (evita el destello).
   Fichero externo y no inline: la CSP (script-src 'self') bloquea scripts inline. */
try {
  var s = localStorage.getItem('nexo-color-scheme');
  if (s === 'light' || s === 'dark') document.querySelector('meta[name="color-scheme"]').content = s;
} catch (e) {}
