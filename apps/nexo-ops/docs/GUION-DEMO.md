# Guion comercial de NEXO-OPS

## Vídeo de 60–90 s (narración)

| Tiempo | Pantalla | Narración |
|---|---|---|
| 0:00–0:08 | Módulo 1, incidente «Prompt injection», guardrails OFF | «Este es un agente de IA atendiendo tickets de clientes. Alguien ha escondido una orden dentro de un ticket.» |
| 0:08–0:25 | ▶ Reproducir. Nodos 2–4 en rojo | «El agente obedece, consulta el CRM y le envía al atacante los datos bancarios de dos clientes. Nadie se entera: el caso se cierra como resuelto.» |
| 0:25–0:40 | Tecla G. Nodos en verde/azul | «Misma IA, arquitectura auditada. El conector solo deja leer al cliente de la sesión. Cero datos expuestos, alerta al SOC y todo queda trazado.» |
| 0:40–0:55 | Tecla 2. Pliego A: GO. Desmarcar ENS → NO-GO | «Antes de dedicar horas a una licitación: requisitos excluyentes, penalizaciones y cláusulas de seguridad en segundos. Sin ENS, ningún precio te salva.» |
| 0:55–1:10 | Tecla 3. ROI y matriz de riesgo | «Y la pregunta del director financiero: retorno neto de la supervisión humana, y el nivel de riesgo según ISO 42001 y el Reglamento de IA.» |
| 1:10–1:20 | Exportar One-Pager → PDF | «Todo en una página para el comité. Y nada de esto ha salido de tu navegador.» |

## Preguntas difíciles (y respuesta corta)

**«¿Un filtro de palabras clave para la inyección? Eso se salta.»**
Sí, y la propia demo lo dice. El filtro es una capa más. Lo que bloquea la fuga es que el agente no tiene permiso para leer a otros clientes: la autorización sale de la sesión autenticada, no de lo que pida el modelo (OWASP LLM06, Excessive Agency).

**«¿Por qué el ROI baja al activar la supervisión humana?»**
Porque revisar cuesta horas. Una calculadora que no lo descuenta te vende un ROI que no vas a ver. Aquí puedes ver el punto exacto en el que la supervisión deja de ser rentable, y el riesgo que asumes si la quitas.

**«¿Mi caso de uso es de alto riesgo según el AI Act?»**
Depende del uso, no de la tecnología: atención al cliente es riesgo limitado (transparencia, Art. 50); decidir la elegibilidad para una ayuda pública es Anexo III. La herramienta da una orientación y la lista de controles; la calificación definitiva es jurídica.

**«¿Dónde van mis datos si pego un pliego real?»**
A ningún sitio en modo Zero-Egress: lo garantiza la política de seguridad del navegador (CSP), no una promesa. Si activas IA, la PII se redacta antes de enviar y la clave solo vive en la memoria de la pestaña.

**«¿Funciona sin internet?»**
Sí. Todo el motor es local; la IA es opcional.
