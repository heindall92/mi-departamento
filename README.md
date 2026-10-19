# Mi Departamento

**Mis agentes de IA, trabajando.** Una oficina pixel-art (turno de noche, con vistas a la ría de Huelva) donde se ve al equipo de agentes de IA de Yoandy Ramírez en sus salas, con su estado y una actividad de ejemplo entre ellos.

🔗 En vivo (GitHub Pages, hasta el primer despliegue): https://heindall92.github.io/mi-departamento/

El alojamiento de destino es **Cloudflare Workers** (activos estáticos). Tras el primer `wrangler deploy` la oficina queda en `https://mi-departamento.<subdominio>.workers.dev`. El dominio propio se engancha en el panel de Cloudflare, en el Worker `mi-departamento`.

> Las conversaciones del panel de actividad son el registro real del bot de Grok. Los estados de las mesas, los encargos, las rutinas y la bandeja son **datos simulados (v1)** en `data/activity.json`, y la página lo indica. No hay contadores de tokens ni de coste.

> **Acceso:** cualquier publicación de esta oficina debe ir detrás de **Cloudflare Access** con una política que permita solo `yoandyramirezdelgado@gmail.com`. No se publica sin esa política activa.

## Qué hay en la página

- **Salas** (Dirección, Estrategia, Finanzas, Ventas, Marketing, Ciberseguridad y cumplimiento, Laboratorio ofensivo, Herramientas) con cada agente en su mesa, su nombre y un chip de estado.
- **Actividad**: panel que reproduce en bucle los mensajes entre agentes y «Tú». Al sonar un mensaje aparece un bocadillo sobre quien habla y un sobre viaja hasta la sala del destinatario. Se puede pausar.
- **Luz de estado en cada mesa**: lámpara en el lienzo + placa con icono + texto bajo el nombre (nunca solo color). Verde ▸ *Trabajando*, rojo ! *Te necesita* (aprobación de algo irreversible), amarillo ✓ *Para revisar* (terminado). Leyenda visible encima de las salas.
- **Encargos a mano**: cuando un bot pasa trabajo a otro, su personaje cruza hasta la otra sala con un sobre en las manos.
- **Rutinas programadas**: panel con cada rutina, su horario y la última ejecución. Al sonar, la sala muestra su animación propia (amanecer, monedas, campana, corazones, radar, barrido, engranaje).
- **Pendiente de tu revisión**: bandeja con lo que espera a Yoandy; primero las aprobaciones, luego lo más antiguo. El contador aparece también en «Tú» y en la barra inferior del móvil.
- **Pizarra por sala**: muestra la tarea actual de cada bot, leída de `data/activity.json`.
- **Monitores**: corren código mientras el bot está en verde y destellan al pasar a amarillo.
- **Papeles al entregar**: el paseo del sobre termina con papeles volando en la mesa de destino.
- **Panel de detalle**: al pulsar un bot se abre un panel lateral (hoja inferior en móvil) con su estado, la tarea actual, la última tarea y lo que tiene pendiente de ti. Atrapa el foco, se cierra con Esc y devuelve el foco al origen.
- **Móvil**: barra inferior con iconos (Oficina, Bandeja, Rutinas, Actividad, Equipo).
- **Ficha de agente**: al pulsar un agente se abre una tarjeta con su rol, qué hace y su último mensaje.
- **El equipo**: la misma información en texto (accesible y legible sin canvas).
- **ES | EN**: selector de idioma; la elección se guarda en `localStorage`.

## Cómo funciona

- HTML + CSS + JavaScript sin dependencias. En local se abre tal cual. Para Cloudflare, `scripts/stage-dist.sh` copia el sitio a `dist/` y `wrangler deploy` publica esa carpeta.
- Todo el arte se dibuja con rectángulos en `<canvas>` (`js/app.js`) y se escala con `image-rendering: pixelated`. No hay imágenes externas.
- Animaciones simples (respirar / teclear a 2 fotogramas, LEDs, estrellas). Con `prefers-reduced-motion` se desactivan: el sobre no viaja, nadie camina (el encargo aparece solo en el registro) y las rutinas muestran un fotograma fijo con su etiqueta.

```
index.html          estructura y textos base
404.html            página cuando la ruta no existe
css/styles.css      estilos (oficina nocturna, acento #0F766E)
js/app.js           dibujo, i18n, feed, fichas
data/office.json    salas y agentes
data/feed.json      guion de la actividad
data/activity.json  estados, bandeja, encargos y rutinas (esquema versionado)
data/activity.schema.json   JSON Schema (draft 2020-12) de activity.json
wrangler.jsonc      Cloudflare Workers, activos en dist/
_headers            caché y cabeceras de seguridad
scripts/stage-dist.sh   prepara dist/ y comprueba los JSON
scripts/check-activity.py   coherencia de activity.json con office.json (sin dependencias)
scripts/validate-activity.mjs   validación completa contra el esquema (ajv)
```

Para probar en local (hace falta un servidor por el `fetch` de los JSON):

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

La misma copia que se publica:

```bash
bash scripts/stage-dist.sh
python3 -m http.server 8000 --directory dist
```

## Publicar en Cloudflare

Cada push a `main` ejecuta `.github/workflows/cloudflare.yml`. El job de comprobación arma `dist/` y pide el HTML, el CSS, el JS y los dos JSON. El job de publicación solo corre en `main` y solo si el repositorio tiene estos secretos:

| Secreto | Dónde sale |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Panel de Cloudflare → cuenta → ID de cuenta |
| `CLOUDFLARE_API_TOKEN` | Token con permiso **Account → Workers Scripts → Edit** |

Sin esos secretos el workflow avisa y no falla el despliegue: GitHub Pages sigue sirviendo el repositorio. Con ellos, `npx wrangler deploy` sube el Worker `mi-departamento`.

A mano, con Wrangler ya autenticado:

```bash
bash scripts/stage-dist.sh
npx wrangler deploy
```

`_headers` deja HTML y `404.html` sin caché larga, CSS, JS y el favicon un día, y `data/*.json` un minuto. Las rutas desconocidas responden con `404.html`.

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

### `data/activity.json` (esquema 1.1.0)

Contrato estable entre la oficina y quien la alimente. v1 usa datos simulados; v2 lo generará la actividad real sin tocar el código. Esquema completo: [`data/activity.schema.json`](data/activity.schema.json).

```json
{
  "schemaVersion": "1.1.0",
  "source": "simulated",
  "generatedAt": "2026-10-19T09:00:00+02:00",
  "agents": { "finanzas": { "state": "needs_you", "task": "Pago de la cuota anual del dominio" } },
  "reviewQueue": [
    { "id": "rq-001", "agent": "finanzas", "kind": "approval", "title": "Aprobar el pago del dominio",
      "detail": "Es un cargo en la tarjeta: no se hace sin ti.", "since": "2026-10-19T08:42:00+02:00" }
  ],
  "handoffs": [ { "id": "h-001", "from": "grok", "to": "tool", "task": "Configurar Cloudflare Access" } ],
  "routines": [
    { "id": "r-caja", "agent": "finanzas", "name": "Cierre de caja",
      "schedule": { "cron": "0 19 * * 1-5", "label": "Laborables · 19:00" }, "animation": "coins" }
  ],
  "simulation": { "handoffEverySec": 9, "routineEverySec": 7 }
}
```

| Campo | Qué es |
| --- | --- |
| `schemaVersion` | SemVer. La web acepta `1.x.y`; un cambio incompatible sube a `2.0.0`. Añadir campos opcionales sube la menor. |
| `source` | `simulated` (ejemplo) o `live` (real). |
| `agents.<id>.state` | `working` (verde, Trabajando) · `needs_you` (rojo, Te necesita: aprobación de algo irreversible) · `review` (amarillo, Para revisar). Sin entrada = `working`. |
| `agents.<id>.task` | Qué está haciendo ahora (≤160 caracteres). |
| `agents.<id>.lastTask` | *Desde 1.1.0, opcional.* Última tarea terminada (panel de detalle). |
| `agents.<id>.since` | *Desde 1.1.0, opcional.* Desde cuándo está en ese estado. |
| `reviewQueue[]` | Bandeja. `kind`: `approval` o `review`; `since` en ISO 8601 con zona. |
| `handoffs[]` | Encargos de `from` a `to` (ids de `office.json`). En `live`, añade `at`. |
| `routines[]` | `schedule.cron` (5 campos, hora de Madrid) + `label` legible; `animation`: `sunrise`, `coins`, `bell`, `hearts`, `radar`, `scan`, `gear`; `lastRun` opcional. |
| `simulation` | Solo para `simulated`: cada cuánto se reproduce un encargo y una rutina. |

Los `id` de agente válidos: `grok` (Grok Bot), `tool` (Tool), `remotion` (Remotion), `finanzas` (Finanzas), `ventas` (Ventas), `linkedin` (LinkedIn), `instagram` (Instagram), `iso` (ISO 27001), `grc` (GRC), `engranaje` (Engranaje), `emprendedor` (Emprendedor), `binarios` (Binarios Linux Vulnerables).

Validar: `python3 scripts/check-activity.py` (sin dependencias, lo ejecuta `stage-dist.sh`) o `node scripts/validate-activity.mjs` con `ajv` y `ajv-formats` instalados.

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

El push a `main` dispara el workflow de Cloudflare (y GitHub Pages, mientras siga activo). Recomendaciones:

- Validar el JSON antes de hacer commit (`python3 -m json.tool data/feed.json`).
- Publicar solo detrás de Cloudflare Access (solo `yoandyramirezdelgado@gmail.com`). Aun así, resume la actividad («propuesta lista para revisar»), sin nombres de clientes ni importes privados.
- Mantener las traducciones `es`/`en` en cada texto.

## Créditos

Concepto: agentes de IA en una oficina pixel-art. Algunas ideas visuales de la v3 (pizarra, monitores, papeles al entregar) se inspiran en [pixel-office](https://github.com/gonzalonicolasr/pixel-office) (MIT); no se ha copiado ni código ni recursos. Diseño, textos, arte y código originales de este repositorio.
