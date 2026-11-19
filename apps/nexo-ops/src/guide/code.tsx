import { Check, Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/** Extrae una región `// #region guia:<name>` del código fuente real (importado con ?raw). */
export function excerpt(src: string, name: string): string {
  const start = src.indexOf(`// #region guia:${name}`);
  const end = src.indexOf(`// #endregion guia:${name}`);
  if (start < 0 || end < 0) return `// región «${name}» no encontrada`;
  const body = src.slice(src.indexOf('\n', start) + 1, end).replace(/\s+$/, '');
  const lines = body.split('\n');
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length));
  return lines.map((l) => l.slice(indent)).join('\n');
}

const KW = new Set(
  'export function const let return if else for of in new type interface import from as await async throw true false null undefined typeof class extends'.split(' '),
);
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(\b\d[\d_.]*\b)|(\b[A-Za-z_$][\w$]*\b)/g;

/** Resaltado mínimo y seguro: genera elementos React, nunca innerHTML. */
function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of code.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(code.slice(last, i));
    const [t, com, str, num, word] = m;
    if (com) out.push(<span key={k++} className="tk-com">{t}</span>);
    else if (str) out.push(<span key={k++} className="tk-str">{t}</span>);
    else if (num) out.push(<span key={k++} className="tk-num">{t}</span>);
    else if (word && KW.has(word)) out.push(<span key={k++} className="tk-kw">{t}</span>);
    else if (word && /^[A-Z]/.test(word)) out.push(<span key={k++} className="tk-type">{t}</span>);
    else out.push(t);
    last = i + t.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CodeBlock({ code, file, lang = 'ts' }: { code: string; file?: string; lang?: 'ts' | 'sh' | 'txt' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* portapapeles no disponible: el texto sigue seleccionable */
    }
  };
  return (
    <figure className="code">
      <figcaption>
        <span className="code-file">{file ?? (lang === 'sh' ? 'terminal' : lang === 'txt' ? 'prompt' : 'TypeScript')}</span>
        <button type="button" className="copy" onClick={copy} aria-label={copied ? 'Copiado' : 'Copiar código'}>
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          <span>{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </figcaption>
      <pre tabIndex={0}>
        <code>{lang === 'ts' ? highlight(code) : code}</code>
      </pre>
    </figure>
  );
}
