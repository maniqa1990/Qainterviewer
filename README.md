# Simulador de entrevistas QA

Práctica de entrevistas de QA de 10 minutos: los primeros 2 en español y el resto en inglés. Al terminar da una calificación de aprobado o no aprobado, con feedback y la transcripción de tus respuestas.

## Cómo está armado

- `public/index.html`: la página (sin dependencias).
- `api/chat.js`: función de servidor que recibe los mensajes de la página, los envía a la API de Anthropic y devuelve la respuesta. Tu clave de API y el banco de preguntas viven solo aquí; las preguntas se inyectan como contexto del sistema y no se muestran en la interfaz.
- `vercel.json`: permite que la calificación tarde hasta 60 segundos.

## Publicarlo en Vercel (con GitHub)

1. **Crea la clave de API.** Entra a https://console.anthropic.com, ve a *API keys* y crea una. En *Billing* carga un saldo pequeño y pon un límite de gasto mensual.
2. **Sube esta carpeta a GitHub.** Crea un repositorio nuevo (puede ser privado) y sube estos archivos tal cual, con `public/` y `api/` en la raíz.
3. **Importa el proyecto.** En https://vercel.com, *Add New → Project*, elige el repositorio. No cambies nada del *Framework Preset* (déjalo en "Other").
4. **Agrega las variables de entorno** antes de desplegar (*Environment Variables*):
   - `ANTHROPIC_API_KEY`: tu clave.
   - `ACCESS_CODE`: una palabra o frase que les darás a tus compañeros. Sin ella, cualquiera con el enlace gasta tu saldo.
5. Pulsa **Deploy**. Vercel te da una dirección tipo `https://tu-proyecto.vercel.app`.
6. Comparte esa dirección y el código de acceso.

Si cambias una variable de entorno después, hay que volver a desplegar (*Deployments → Redeploy*) para que tome efecto.

## Publicarlo con la línea de comandos (alternativa)

```
npm i -g vercel
cd simulador-qa
vercel            # primer despliegue, responde las preguntas
vercel env add ANTHROPIC_API_KEY
vercel env add ACCESS_CODE
vercel --prod
```

## Variables opcionales

| Variable | Para qué | Por defecto |
| --- | --- | --- |
| `MODEL_CHAT` | Modelo del entrevistador (rápido y económico) | `claude-haiku-5-5` |
| `MODEL_EVAL` | Modelo de la calificación (más capaz) | `claude-sonnet-5-5` |
| `RATE_LIMIT_PER_HOUR` | Llamadas por persona por hora | `120` |
| `DAILY_CALL_CAP` | Llamadas totales por día | `1500` |

Si un nombre de modelo deja de existir, el simulador muestra "El servidor todavía no está configurado". Revisa los nombres vigentes en la documentación de Anthropic y cámbialos en `MODEL_CHAT` y `MODEL_EVAL`.

## Control de gasto

- Una entrevista completa son unas 15 a 25 llamadas cortas más una de calificación.
- Los límites por hora y por día de `api/chat.js` se cuentan en memoria y por instancia del servidor, así que frenan el abuso pero no son una garantía exacta. El freno real es el límite de gasto que pongas en console.anthropic.com.
- Revisa el consumo en *Usage* de la consola de Anthropic después de las primeras pruebas.

## Privacidad

El servidor no guarda nada: reenvía cada mensaje a Anthropic y devuelve la respuesta. Lo que cada persona escribe (perfil y respuestas) viaja a través de tu proyecto de Vercel hasta la API de Anthropic. El banco de preguntas vive en `api/chat.js` y solo viaja entre el servidor y Anthropic; no aparece en la interfaz. Las transcripciones y los intentos anteriores se guardan solo en el navegador de cada persona.

## Notas de uso

- El dictado por voz usa el reconocimiento de voz del navegador: funciona en Chrome y Edge, no en Firefox ni en Safari.
- Funciona en el celular, pero el dictado y la lectura en voz alta dependen del navegador.
