# NEXO-OPS · Mesa interactiva de consultoría en IA agéntica, CX/CRM y licitaciones

**▶ [Probar demo en vivo](https://heindall92.github.io/mi-departamento/nexo-ops/)** — un clic, sin instalar nada, sin cuenta, sin enviar datos.
Simulador de agentes con «Modo Caos» y guardrails · Motor Go/No-Go de pliegos · ROI operativo + riesgo IA (ISO 42001 / EU AI Act).

> Autor: Yoandy Ramírez Delgado · v1.0 · Escenarios y datos 100 % ficticios · Indicadores orientativos, no asesoramiento jurídico.

---

## Qué resuelve en 3 minutos

| Pregunta del cliente | Módulo | Qué ve en pantalla |
|---|---|---|
| ¿Cómo orquesto agentes de IA sobre mis flujos de CX/CRM sin abrir una brecha? | **1 · Flujos CX/CRM** | Un caso real atraviesa 6 etapas por carriles. Se inyecta un ataque y se ve la fuga (OFF) o el bloqueo (ON), con traza y permisos de cada nodo. |
| ¿Me presento a esta licitación? | **2 · Licitaciones** | Semáforo Go / Revisar / No-Go explicable, 5 bloques de cláusulas, vetos por excluyentes, esfuerzo en jornadas e índice de memoria técnica. |
| ¿Es rentable y qué riesgo regulatorio asumo? | **3 · ROI + Gobernanza** | ROI neto **de la supervisión humana**, payback, curva de caja y nivel de riesgo IA con los controles bloqueantes antes de producción. |

Cierra con **Exportar One-Pager** (PDF A4 de una página o Markdown con diagrama Mermaid).

## Guion de demo (3 min)

1. **Módulo 1** (precargado: *Prompt injection*, guardrails OFF) → **▶ Reproducir**. El agente obedece al comentario oculto del ticket, lee 2 fichas de otros clientes y se las envía al atacante. Panel «Antes/después»: 2 fichas y 4 datos personales expuestos.
2. Pulsa **G** (o el interruptor). Mismo caso: el filtro aísla la instrucción, el conector CRM **deniega** `C-1002` y `C-1003` porque no son el cliente de la sesión, y el SOC recibe la alerta. 0 exposición.
3. **Fuga de PII** con ON: abre el nodo 4 y enseña el payload antes/después: `12345678Z` pasa a `[DNI_1]` antes de llegar al modelo externo.
4. **Tecla 2** → Pliego A sale **GO**. Desmarca «ENS categoría MEDIA»: **NO-GO por veto**. «Ningún precio compensa un excluyente.»
5. **Tecla 3** → ROI 95 %, payback 5 meses. Sube autonomía a «Autónomo» y apaga HITL: el riesgo pasa a Crítico y aparecen los controles bloqueantes.
6. **Exportar One-Pager → PDF.** Se lo queda el cliente.

Guion del vídeo de 60–90 s y preguntas difíciles frecuentes: [`docs/GUION-DEMO.md`](docs/GUION-DEMO.md).

Atajos: `1` `2` `3` cambian de módulo · `G` alterna guardrails.

---

## Arquitectura

```
apps/nexo-ops/                 ← código fuente (este directorio)
├── index.html                 ← la CSP se inyecta en build (vite.config.ts)
├── src/
│   ├── App.tsx                ← shell, estado global y One-Pager
│   ├── types/domain.ts        ← contratos de la sección 04 del roadmap (+ extensiones marcadas)
│   ├── data/                  ← escenarios deterministas (CX/CRM + 3 incidentes, 2 pliegos)
│   ├── services/              ← lógica pura y testeada, sin React
│   │   ├── guardrails.ts        PII (DNI/NIE/IBAN/tarjeta con dígito de control), inyección, alcance, política
│   │   ├── flowEngine.ts        ejecuta los guardrails reales sobre cada caso → traza
│   │   ├── tenderScoring.ts     Go/No-Go explicable, esfuerzo, índice
│   │   ├── deterministicParser.ts  pliegos pegados → cláusulas (offline)
│   │   ├── roi.ts · riskIndex.ts   ROI neto de HITL · índice de riesgo IA
│   │   ├── llmAdapter.ts        BYOK Anthropic / Ollama, con redacción previa y errores tipados
│   │   └── reportExporter.ts    One-Pager Markdown (+ PDF vía impresión)
│   ├── modules/               ← Módulo 1, 2 y 3 (UI)
│   └── components/            ← TopBar, SettingsModal, OnePager, primitivas UI
└── scripts/smoke.mjs          ← E2E del guion completo en Chromium
../../nexo-ops/                ← build estático publicado en GitHub Pages
```

Stack: React 19 + TypeScript estricto + Vite 7. **Sin librerías de UI ni de gráficos** (regla 07): la curva de caja es SVG nativo y el tablero es CSS Grid. Fuentes del sistema: ni Google Fonts.

### Decisiones que conviene conocer

- **Los guardrails son código real, no texto.** El simulador no reproduce un guion: `flowEngine` ejecuta `detectPii`, `detectInjection`, `enforceCustomerScope` y `evaluateCompensation` sobre el payload de cada caso. Si cambias el texto de un incidente, la traza cambia.
- **El control que para la inyección es la autorización, no el filtro.** El detector de inyección es heurístico (defensa en profundidad, y lo dice la UI). Lo que impide la exfiltración es que el conector CRM autoriza por la identidad de la sesión autenticada, nunca por el ID que pida el modelo. Es el mensaje que un CISO quiere oír, y es correcto.
- **El EU AI Act clasifica por caso de uso.** Un sistema del Anexo III (p. ej. elegibilidad para prestaciones) es de alto riesgo aunque tenga todos los controles: el índice tiene un «suelo» legal que los interruptores no pueden bajar.
- **El ROI descuenta la supervisión.** Activar HITL tiene un coste en horas visible; desactivarlo mejora el ROI y dispara el riesgo. Esa tensión es la conversación de venta.
- **Determinismo.** Latencias con PRNG sembrado, tiempos relativos `T+mm:ss`, sin `Date.now()` en los motores: la demo es idéntica en cada ejecución. El build también es determinista (CI lo verifica).

## Modelo de privacidad y seguridad (verificable)

| Garantía | Cómo se cumple | Cómo verificarlo |
|---|---|---|
| Zero-Egress por defecto | Todo el análisis es local. El SDK de IA se carga con `import()` dinámico: en Zero-Egress ni se descarga. | DevTools → Network: ninguna petición a terceros. El E2E lo comprueba. |
| Destinos acotados | CSP en el HTML: `connect-src 'self' https://api.anthropic.com http://localhost:11434 http://127.0.0.1:11434`, `script-src 'self'`. | Ver `<meta http-equiv="Content-Security-Policy">` en el código fuente de la página. |
| Clave BYOK solo en memoria | Vive en estado de React. No se usa `localStorage`, `sessionStorage`, IndexedDB ni cookies. Al recargar, desaparece. | El E2E introduce una clave y comprueba los tres almacenes. |
| PII nunca sale | Antes de enviar un pliego a Anthropic u Ollama se aplica el mismo `redactPii` del Módulo 1. | El E2E intercepta la petición y verifica que `12345678Z` llega como `[DNI_1]`. |
| Resiliencia en vivo | Errores tipados (`auth`, `network`, `model`, `rate_limit`, `refusal`, `bad_output`) → aviso claro + botón «Volver a Zero-Egress» sin perder datos. | E2E: clave inválida (401) y Ollama caído. |
| Salida del modelo no confiable | `normalizeAiClauses` valida categorías, recorta campos y marca las cláusulas como «IA · revisar» y no cubiertas. | Tests unitarios. |

**Riesgo residual (dicho claro):** en BYOK la clave está en la memoria de una página web; un XSS la expondría. Mitigaciones: CSP sin scripts de terceros, React escapa todo el contenido, cero `dangerouslySetInnerHTML`. Recomendación operativa: usar una clave de un workspace con **límite de gasto** y revocarla tras la demo.

Detalles BYOK: llamada directa del navegador a la API de Anthropic con el SDK oficial (`dangerouslyAllowBrowser`, deliberado y documentado), modelo por defecto `claude-opus-5-5`, salida estructurada con JSON Schema y *fallback* de servidor ante rechazos. Ollama: `OLLAMA_ORIGINS=<origen de la demo> ollama serve`; algunos navegadores piden permiso de acceso a red local.

## Extensiones respecto al roadmap (y por qué)

| Extensión | Motivo |
|---|---|
| `category: 'dependencia'` en `TenderClause` | El roadmap pide 5 bloques de extracción pero el tipo tenía 4 categorías. |
| `framework: 'ISO 42001'` | El pliego B lo exige; sin él la cláusula quedaría sin marco. |
| `requires` (capacidad interna) | «Marcar capacidades internas» cambia varias cláusulas a la vez; más rápido en demo que ir cláusula a cláusula. |
| `useCase` en `GovernanceControls` | Sin caso de uso no se puede clasificar según el EU AI Act (Art. 6 + Anexo III). |
| Coste HITL en el ROI | Una calculadora que ignora la supervisión es exactamente la «calculadora optimista» que el roadmap critica. |
| Solo Anthropic + Ollama en BYOK | Cada destino extra amplía la CSP. Añadir otro proveedor es una línea en `vite.config.ts` y un adaptador. |

## Calidad: cómo se ha probado

```bash
cd apps/nexo-ops
npm ci
npm run check        # typecheck + 68 tests unitarios + build
npm run smoke        # E2E: 31 comprobaciones en Chromium a 1280×720 (necesita playwright)
```

El E2E (`scripts/smoke.mjs`) recorre el guion completo y valida cada criterio de aceptación:

| Criterio del roadmap | Comprobación |
|---|---|
| F1: se abre en 1 clic sin errores, 6 nodos, trazabilidad | carga + 0 errores inesperados en consola + 6 eventos + inspector |
| F2: alternar guardrails cambia los 3 ataques | OFF → fuga y ON → contenido en los 3 incidentes |
| F2: capacidades recalculan el semáforo | A: GO → NO-GO al quitar ENS · B: NO-GO → REVISAR al añadir ENS ALTA |
| F3: 100 % sin API; con API/Ollama enriquece sin romper | BYOK 401 y Ollama caído → aviso + retorno, datos intactos |
| F3: el informe incluye flujo, ROI y checklist | Markdown descargado + PDF = **1 página A4** |
| Revisión final 1280×720 sin desbordamientos | `scrollWidth ≤ 1280` en los 3 módulos |

CI (`.github/workflows/nexo-ops-ci.yml`): typecheck, tests, E2E, y comprueba que la demo publicada en `/nexo-ops` corresponde exactamente al código fuente.

## Desarrollo y despliegue

```bash
npm run dev          # http://localhost:5173 (sin CSP, para HMR)
npm run build:pages  # regenera ../../nexo-ops (lo que sirve GitHub Pages)
```

GitHub Pages publica la rama por defecto: la URL de la demo funciona en cuanto esta rama se fusiona. El directorio `nexo-ops/` es estático y usa rutas relativas, así que también sirve tal cual en Vercel, Netlify o cualquier servidor.

## Limitaciones conocidas

- El parser offline usa reglas de palabras clave: detecta bien estructura y marcos, pero no interpreta matices jurídicos. Por eso marca todo como «no cubierto» hasta revisión y ofrece el enriquecimiento con IA.
- Los supuestos de esfuerzo (jornadas por brecha, reparto por perfil) y de revisión HITL son heurísticas de preventa, visibles en la UI. Ajústalos a la realidad de tu equipo en `tenderScoring.ts` y `roi.ts`.
- Las referencias normativas son correctas a la fecha de redacción. Los plazos de aplicación del EU AI Act para alto riesgo están sujetos a cambios (propuesta *Digital Omnibus*): no se muestran fechas para no inducir a error.
