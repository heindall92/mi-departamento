#!/usr/bin/env node
/**
 * Prueba E2E de la demo completa en navegador real (Chromium + Playwright).
 * Recorre el guion de 3 minutos a 1280×720 y verifica los criterios de
 * aceptación del roadmap. Uso:  npm run build && npm run smoke
 *
 * Requiere el paquete `playwright` resoluble (global o local) con Chromium.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = process.env.SMOKE_OUT ?? path.join(root, 'smoke-output');
mkdirSync(outDir, { recursive: true });
const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  try {
    up = (await fetch(BASE)).ok;
  } catch {
    await sleep(250);
  }
}
if (!up) {
  console.error('No arrancó vite preview');
  server.kill();
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await context.newPage();

const consoleErrors = [];
const external = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(String(e)));
page.on('request', (r) => {
  const u = new URL(r.url());
  if (u.hostname !== 'localhost') external.push(r.url());
});

try {
  await page.goto(BASE);
  await page.waitForSelector('text=NEXO-OPS');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  check('CSP presente en build', !!csp && csp.includes("connect-src 'self' https://api.anthropic.com"));
  check('Título correcto', (await page.title()).includes('NEXO-OPS'));

  /* ── Módulo 1 ── */
  const verTodo = page.getByRole('button', { name: 'Ver todo' });
  const scenarios = [
    ['Prompt injection', /Incidente materializado/, /Incidente contenido/],
    ['Alucinación comercial', /Incidente materializado/, /Incidente contenido/],
    ['Fuga de PII', /Incidente materializado/, /Incidente contenido/],
  ];
  for (const [label, offRe, onRe] of scenarios) {
    await page.getByRole('radio', { name: new RegExp(label) }).click();
    const sw = page.getByRole('switch', { name: /Guardrails/ });
    if ((await sw.getAttribute('aria-checked')) === 'true') await sw.click();
    await verTodo.click();
    const offText = await page.locator('.compare').innerText();
    const offTrace = await page.locator('.trace-row.st-leak').count();
    await sw.click();
    await verTodo.click();
    const onTrace = await page.locator('.trace-row.st-leak').count();
    const flowSide = await page.locator('.flow-side').innerText();
    check(`M1 ${label}: OFF → fuga, ON → contenido`, offRe.test(offText) && onRe.test(flowSide) && offTrace > 0 && onTrace === 0, `fugas OFF=${offTrace} ON=${onTrace}`);
    if (label === 'Prompt injection') {
      await page.locator('.node').nth(3).click(); // Consulta CRM (orden DOM por carriles)
      await sleep(400);
      await page.screenshot({ path: path.join(outDir, '1-flow-injection-on.png') });
    }
  }
  // Reproducción automática paso a paso
  await page.getByRole('radio', { name: 'Caso estándar' }).click();
  await sleep(250 + 1100 * 2 + 300);
  const partial = await page.locator('.trace-row').count();
  check('M1 reproducción automática avanza por pasos', partial >= 2 && partial < 6, `${partial} eventos tras ~2,5 s`);
  await verTodo.click().catch(() => {});
  await page.waitForSelector('.compare');
  check('M1 caso estándar: 6 nodos en la traza', (await page.locator('.trace-row').count()) === 6);

  // Atajo G
  const before = await page.getByRole('switch', { name: /Guardrails/ }).getAttribute('aria-checked');
  await page.locator('body').press('g');
  const after = await page.getByRole('switch', { name: /Guardrails/ }).getAttribute('aria-checked');
  check('Atajo G alterna guardrails', before !== after);

  /* ── Módulo 2 ── */
  await page.keyboard.press('2');
  await page.waitForSelector('.verdict');
  const vA = await page.locator('.verdict-label').innerText();
  check('M2 pliego A → GO', vA === 'GO', vA);
  await page.getByRole('checkbox', { name: 'Certificación ENS categoría MEDIA', exact: true }).uncheck();
  const vA2 = await page.locator('.verdict-label').innerText();
  check('M2 quitar ENS MEDIA → NO-GO en vivo (veto)', vA2 === 'NO-GO' && (await page.locator('.vetoes').innerText()).includes('ENS'), vA2);
  await page.getByRole('checkbox', { name: 'Certificación ENS categoría MEDIA', exact: true }).check();
  await page.screenshot({ path: path.join(outDir, '2-tender-a.png') });

  await page.getByRole('radio', { name: /B · IA regulada/ }).click();
  const vB = await page.locator('.verdict-label').innerText();
  await page.getByRole('checkbox', { name: 'Certificación ENS categoría ALTA', exact: true }).check();
  const vB2 = await page.locator('.verdict-label').innerText();
  check('M2 pliego B: NO-GO → REVISAR al marcar ENS ALTA', vB === 'NO-GO' && vB2 === 'REVISAR', `${vB} → ${vB2}`);
  await page.screenshot({ path: path.join(outDir, '2-tender-b.png') });
  // Pesos
  const s1 = await page.locator('.verdict-score').innerText();
  await page.getByLabel('Preparación normativa (valor exacto)').fill('60');
  const s2 = await page.locator('.verdict-score').innerText();
  check('M2 pesos recalculan la puntuación', s1 !== s2, `${s1} → ${s2}`);

  await page.getByRole('radio', { name: /Pegar pliego/ }).click();
  await page.getByRole('button', { name: 'Cargar texto de ejemplo' }).click();
  await page.getByRole('button', { name: /Analizar \(reglas/ }).click();
  const parsed = await page.locator('.clause').count();
  check('M2 parser determinista sobre texto pegado', parsed >= 10, `${parsed} cláusulas`);

  /* ── BYOK: clave solo en memoria + fallo controlado ── */
  let anthropicBody = '';
  await page.route('https://api.anthropic.com/**', async (route) => {
    anthropicBody = route.request().postData() ?? '';
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
  });
  await page.locator('.mode').click();
  await page.getByLabel(/BYOK · Anthropic/).check();
  await page.getByLabel(/Clave de API/).fill('sk-ant-PRUEBA-NO-REAL-123');
  await page.getByRole('button', { name: 'Guardar en memoria' }).click();
  const storage = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage }, c: document.cookie }));
  check('BYOK: la clave NO está en localStorage/sessionStorage/cookies', !storage.includes('sk-ant'), storage);
  check('Indicador de modo cambia a BYOK', (await page.locator('.mode').innerText()).includes('BYOK'));
  await page.locator('textarea.paste').fill((await page.locator('textarea.paste').inputValue()) + '\nContacto: DNI 12345678Z, IBAN ES91 2100 0418 4502 0005 1332.');
  const clausesBefore = await page.locator('.clause').count();
  await page.getByRole('button', { name: 'Enriquecer con IA' }).click();
  await page.waitForSelector('.alert-warn', { timeout: 15000 });
  const alertText = await page.locator('.alert-warn').innerText();
  check('BYOK con clave inválida → aviso claro', /Clave rechazada/.test(alertText), alertText.split('\n')[0]);
  check('BYOK: PII redactada antes de salir', anthropicBody.length > 0 && !anthropicBody.includes('12345678Z') && anthropicBody.includes('[DNI_1]'));
  check('Fallo IA no pierde datos cargados', (await page.locator('.clause').count()) === clausesBefore);
  await page.screenshot({ path: path.join(outDir, '2-tender-byok-error.png') });
  await page.getByRole('button', { name: 'Volver a Zero-Egress' }).click();
  check('Retorno inmediato a Zero-Egress', (await page.locator('.mode').innerText()).includes('Zero-Egress'));

  // Ollama caído
  await page.route('http://localhost:11434/**', (route) => route.abort('connectionrefused'));
  await page.locator('.mode').click();
  await page.getByLabel(/Ollama local/).check();
  await page.getByRole('button', { name: 'Guardar en memoria' }).click();
  await page.getByRole('button', { name: 'Enriquecer con IA' }).click();
  await page.waitForSelector('.alert-warn');
  check('Ollama sin servicio → aviso + fallback', /Ollama/.test(await page.locator('.alert-warn').innerText()));
  await page.getByRole('button', { name: 'Volver a Zero-Egress' }).click();

  /* ── Módulo 3 ── */
  await page.keyboard.press('3');
  await page.waitForSelector('.kpis');
  const kpi = await page.locator('.kpis').innerText();
  check('M3 KPIs calculados', /ROI año 1/.test(kpi) && /meses/.test(kpi));
  await page.screenshot({ path: path.join(outDir, '3-roi.png') });
  const roi1 = await page.locator('.kpi').nth(4).innerText();
  await page.getByLabel('Tasa de automatización segura (valor exacto)').fill('20');
  const roi2 = await page.locator('.kpi').nth(4).innerText();
  check('M3 sliders recalculan al instante', roi1 !== roi2, `${roi1.replace(/\n/g, ' ')} → ${roi2.replace(/\n/g, ' ')}`);
  await page.getByRole('radio', { name: 'Autónomo', exact: true }).click();
  for (const n of ['Supervisión humana (HITL)', 'Registro de auditoría', 'Redacción de PII']) await page.getByRole('switch', { name: n }).click();
  const tier = await page.locator('.tier-value').innerText();
  check('M3 autónomo + PII sin controles → Crítico', tier === 'Crítico', tier);
  await page.getByLabel('Caso de uso').selectOption('elegibilidad_servicios');
  for (const n of ['Supervisión humana (HITL)', 'Registro de auditoría', 'Redacción de PII']) await page.getByRole('switch', { name: n }).click();
  await page.getByRole('radio', { name: 'Asistido', exact: true }).click();
  await page.getByRole('radio', { name: 'Público', exact: true }).click();
  const floor = await page.locator('.tier-value').innerText();
  check('M3 alto riesgo legal no baja de «Alto»', floor === 'Alto', floor);
  await page.screenshot({ path: path.join(outDir, '3-roi-highrisk.png') });

  /* ── Layout 1280×720 ── */
  for (const k of ['1', '2', '3']) {
    await page.keyboard.press(k);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`Sin desbordamiento horizontal en módulo ${k}`, sw <= 1280, `scrollWidth=${sw}`);
  }

  /* ── Exportación ── */
  await page.keyboard.press('1');
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.getByRole('button', { name: /Exportar One-Pager/ }).click();
      await page.getByRole('menuitem', { name: /Markdown/ }).click();
    })(),
  ]);
  const mdPath = path.join(outDir, 'one-pager.md');
  await dl.saveAs(mdPath);
  const md = readFileSync(mdPath, 'utf8');
  check('Markdown incluye flujo, ROI y checklist', ['```mermaid', '## 3. ROI', '## 5. Checklist', 'Go / No-Go'].every((s) => md.includes(s)));

  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: path.join(outDir, '4-print.png'), fullPage: true });
  const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  check('One-Pager PDF cabe en 1 página A4', pages === 1, `${pages} página(s)`);
  await import('node:fs').then((fs) => fs.writeFileSync(path.join(outDir, 'one-pager.pdf'), pdf));
  await page.emulateMedia({ media: 'screen' });

  // Los únicos errores admitidos son los fallos de red provocados a propósito (401 simulado y Ollama caído).
  const expected = /Failed to load resource: (the server responded with a status of 401|net::ERR_CONNECTION_REFUSED|net::ERR_FAILED)/;
  const unexpected = consoleErrors.filter((e) => !expected.test(e));
  check('Cero errores inesperados en consola', unexpected.length === 0, unexpected.slice(0, 3).join(' | ') || `${consoleErrors.length} esperados (red provocada)`);
  const realExternal = external.filter((u) => !u.startsWith('https://api.anthropic.com') && !u.startsWith('http://localhost:11434'));
  check('Zero-Egress: ninguna petición a terceros (salvo las provocadas en BYOK/Ollama)', realExternal.length === 0, realExternal.join(', '));
} catch (err) {
  check('Ejecución sin excepciones', false, String(err));
  await page.screenshot({ path: path.join(outDir, 'error.png') }).catch(() => {});
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones superadas.`);
process.exit(failed.length ? 1 : 0);
