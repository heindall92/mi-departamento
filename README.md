# Mi Departamento

**Mis agentes de IA, trabajando.** Una oficina pixel-art (turno de noche, con vistas a la ría de Huelva) donde se ve al equipo de agentes de IA de Yoandy Ramírez en sus salas, con su estado y una actividad de ejemplo entre ellos.

🔗 En vivo: https://heindall92.github.io/mi-departamento/

> **Demo:** la actividad es simulada. Los mensajes salen de un guion (`data/feed.json`), no de los agentes reales.

### Proyecto: NEXO-OPS

🔗 **[Probar NEXO-OPS en vivo](https://heindall92.github.io/mi-departamento/nexo-ops/)** — mesa de consultoría en IA agéntica: simulador de flujos CX/CRM con «Modo Caos» y guardrails, motor Go/No-Go de licitaciones y ROI operativo con gobernanza IA (ISO 42001 / EU AI Act). 100 % en el navegador. Código y documentación en [`apps/nexo-ops/`](apps/nexo-ops/README.md); el build publicado está en [`nexo-ops/`](nexo-ops/).

## Qué hay en la página

- **Salas** (Dirección, Estrategia, Finanzas, Ventas, Marketing, Ciberseguridad y cumplimiento, Laboratorio ofensivo, Herramientas) con cada agente en su mesa, su nombre y un chip de estado.
- **Actividad**: panel que reproduce en bucle los mensajes entre agentes y «Tú». Al sonar un mensaje aparece un bocadillo sobre quien habla y un sobre viaja hasta la sala del destinatario. Se puede pausar.
- **Ficha de agente**: al pulsar un agente se abre una tarjeta con su rol, qué hace y su último mensaje.
- **El equipo**: la misma información en texto (accesible y legible sin canvas).
- **ES | EN**: selector de idioma; la elección se guarda en `localStorage`.

## Cómo funciona

- HTML + CSS + JavaScript sin dependencias ni paso de build. Se sirve tal cual desde GitHub Pages.
- Todo el arte se dibuja con rectángulos en `<canvas>` (`js/app.js`) y se escala con `image-rendering: pixelated`. No hay imágenes externas.
- Animaciones simples (respirar / teclear a 2 fotogramas, LEDs, estrellas). Con `prefers-reduced-motion` se desactivan y el sobre no viaja.

```
index.html          estructura y textos base
css/styles.css      estilos (oficina nocturna, acento #0F766E)
js/app.js           dibujo, i18n, feed, fichas
data/office.json    salas y agentes
data/feed.json      guion de la actividad
```

Para probar en local (hace falta un servidor por el `fetch` de los JSON):

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Los datos

### `data/office.json`

```json
{
  "rooms": [
    {
      "id": "finanzas",
      "name": { "es": "Finanzas", "en": "Finance" },
      "agents": [
        {
          "id": "finanzas",
          "name": "Finanzas",
          "role":   { "es": "Caja, gastos, precios, ayudas", "en": "..." },
          "does":   { "es": ["..."], "en": ["..."] },
          "status": { "es": "Cuadrando caja", "en": "Balancing the books" },
          "anim": "type",
          "look": { "kind": "person", "hair": "bun", "hairColor": "#1f1a17", "skin": "#d9a477", "shirt": "#2f7a52", "glasses": true }
        }
      ]
    }
  ]
}
```

- `anim`: `bob` (respira) o `type` (teclea).
- `look.kind`: `person` o `robot`. Para personas: `hair` = `short | long | bun | cap | hood`, y opcionales `glasses`, `headset`, `capColor`. Para robots: `metal`, `visor`.
- Las salas con 3 agentes ocupan dos columnas en pantallas anchas.

### `data/feed.json`

```json
{
  "loopPauseMs": 6000,
  "defaultDelayMs": 3800,
  "messages": [
    { "from": "ventas", "to": "finanzas",
      "text": { "es": "¿El piloto a 390 € es rentable?", "en": "Is the 390 € pilot profitable?" } }
  ]
}
```

- `from` / `to`: `id` de un agente o `"tu"` (el usuario).
- Opcionales: `status` (texto del chip del remitente), `typing: true` (anima el tecleo), `delayMs`.

## Actualizarlo automáticamente (idea)

Como la web solo lee dos JSON estáticos, cualquier proceso que los reescriba y haga commit actualiza la oficina sin tocar código. Por ejemplo, un workflow programado de GitHub Actions:

```yaml
# .github/workflows/actualizar-oficina.yml
name: Actualizar oficina
on:
  schedule: [{ cron: "0 7 * * 1-5" }]   # días laborables, 07:00 UTC
  workflow_dispatch:
permissions:
  contents: write
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generar JSON
        run: python3 scripts/generar_feed.py > data/feed.json   # tu script: lee tareas, CRM, calendario...
      - name: Commit si hay cambios
        run: |
          git config user.name "oficina-bot"
          git config user.email "oficina-bot@users.noreply.github.com"
          git add data/*.json
          git diff --cached --quiet || git commit -m "chore: actualizar actividad de la oficina"
          git push
```

GitHub Pages republica solo tras el push. Recomendaciones:

- Validar el JSON antes de hacer commit (`python3 -m json.tool data/feed.json`).
- No publicar datos sensibles: la web es pública. Resume la actividad («propuesta lista para revisar»), sin nombres de clientes ni importes privados.
- Mantener las traducciones `es`/`en` en cada texto.

## Créditos

Concepto: agentes de IA en una oficina pixel-art. Diseño, textos, arte y código originales de este repositorio.
