#!/usr/bin/env node
/**
 * Regenera las capturas que muestra la guía «Cómo se hace» (public/img).
 * Uso: npm run build && npm run shots   (luego vuelve a construir para incluirlas)
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'img');
mkdirSync(out, { recursive: true });
const PORT = 4187;
const BASE = `http://localhost:${PORT}/`;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* aún no */ }
  await sleep(250);
}
const browser = await chromium.launch();
try {
  // Escritorio: prompt injection sin guardrails, flujo completo, nodo CRM seleccionado.
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, colorScheme: 'light', locale: 'es-ES' });
  let p = await ctx.newPage();
  await p.goto(BASE);
  await p.getByRole('button', { name: 'Ver todo' }).click();
  await p.locator('.node').nth(3).click();
  await sleep(500);
  await p.screenshot({ path: path.join(out, 'escritorio.jpg'), type: 'jpeg', quality: 82 });
  await ctx.close();

  // Móvil claro: línea de tiempo con la consulta CRM desplegada.
  ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'light', locale: 'es-ES' });
  p = await ctx.newPage();
  await p.goto(BASE);
  await p.getByRole('button', { name: 'Ver todo' }).click();
  await p.locator('.tl-head').nth(2).click();
  await p.locator('.tl-item').nth(2).scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, -140));
  await sleep(500);
  await p.screenshot({ path: path.join(out, 'movil.jpg'), type: 'jpeg', quality: 80 });
  await ctx.close();

  // Móvil oscuro: licitaciones con el veredicto fijo arriba.
  ctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark', locale: 'es-ES' });
  p = await ctx.newPage();
  await p.goto(BASE);
  await p.locator('.bottom-nav .tab').nth(1).click();
  await p.mouse.wheel(0, 700);
  await sleep(600);
  await p.screenshot({ path: path.join(out, 'movil-oscuro.jpg'), type: 'jpeg', quality: 80 });
  await ctx.close();
  console.log('Capturas en', out);
} finally {
  await browser.close();
  server.kill();
}
