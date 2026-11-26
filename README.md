# Simulador de entrevistas QA

Práctica de entrevistas de QA de 10 minutos: los primeros 2 en español y el resto en inglés. Al terminar da una calificación de aprobado o no aprobado, con feedback y la transcripción de tus respuestas.

## Cómo está armado

- `public/index.html`: la página (sin dependencias).
- `api/chat.js`: función de servidor que recibe los mensajes de la página, los envía a la API de Gemini y devuelve la respuesta. Tu clave de API y el banco de preguntas viven solo aquí; las preguntas se inyectan como instrucción del sistema y no se muestran en la interfaz.
- `vercel.json`: permite que la calificación tarde hasta 60 segundos.

## Publicarlo en Vercel (con GitHub)

1. **Crea la clave de API (gratis).** Entra a https://aistudio.google.com/api-keys, crea un proyecto y genera una clave. El plan *Free* incluye tokens gratis. Si te pide verificación del proyecto, hazla desde el enlace que indica la propia consola.
2. **Revisa tus cuotas.** En https://aistudio.google.com/rate-limit puedes ver tus límites reales (RPM y RPD) por modelo. Ajusta `RATE_LIMIT_PER_HOUR` y `DAILY_CALL_CAP` si hace falta.
3. **Sube esta carpeta a GitHub.** Crea un repositorio nuevo (puede ser privado) y sube estos archivos tal cual, con `public/` y `api/` en la raíz.
4. **Importa el proyecto.** En https://vercel.com, *Add New → Project*, elige el repositorio. No cambies nada del *Framework Preset* (déjalo en "Other").
5. **Agrega las variables de entorno** antes de desplegar (*Environment Variables*):
   - `GEMINI_API_KEY`: tu clave de Google AI Studio. Guárdala como *Secret*.
   - `ACCESS_CODE`: una palabra o frase que les darás a tus compañeros. Sin ella, cualquiera con el enlace consume tu cuota.
6. Pulsa **Deploy**. Vercel te da una dirección tipo `https://tu-proyecto.vercel.app`.
7. Comparte esa dirección y el código de acceso.

Si cambias una variable de entorno después, hay que volver a desplegar (*Deployments → Redeploy*) para que tome efecto.

## Publicarlo con la línea de comandos (alternativa)

```
npm i -g vercel
cd simulador-qa
vercel            # primer despliegue, responde las preguntas
vercel env add GEMINI_API_KEY
vercel env add ACCESS_CODE
vercel --prod
```

Para probar en local, crea un `.env.local` con `GEMINI_API_KEY=...` y `ACCESS_CODE=...`, y ejecuta `vercel dev`. El archivo `.env.local` está ignorado por Git; nunca subas la clave al repositorio.

## Variables opcionales

| Variable | Para qué | Por defecto |
| --- | --- | --- |
| `MODEL_CHAT` | Modelo del entrevistador (rápido y económico) | `gemini-3.5-flash-lite` |
| `MODEL_EVAL` | Modelo de la calificación (más capaz) | `gemini-3.8-flash` |
| `RATE_LIMIT_PER_HOUR` | Llamadas por persona por hora | `60` |
| `DAILY_CALL_CAP` | Llamadas totales por día | `200` |

Ambos modelos por defecto tienen **plan Free** en la API de Gemini. Si `gemini-3.8-flash` está saturado (error 503), el proxy califica automáticamente con `gemini-3.5-flash-lite`. Si un modelo deja de estar disponible, cambia los nombres en `MODEL_CHAT` y `MODEL_EVAL` y vuelve a desplegar. Los nombres vigentes están en https://aistudio.google.com/docs/models.

## Control de cuota

- Una entrevista completa son unas 15 a 25 llamadas cortas más una de calificación.
- Los límites por hora y por día de `api/chat.js` se cuentan en memoria y por instancia del servidor, así que frenan el abuso pero no son una garantía exacta. El límite real es el de tu proyecto de Google AI Studio.
- Revisa el consumo en https://aistudio.google.com/rate-limit después de las primeras pruebas. Si recibes "Demasiadas solicitudes", baja `DAILY_CALL_CAP` o espera a que se reinicie la cuota diaria (medianoche, hora del Pacífico).

## Privacidad

El servidor no guarda nada: reenvía cada mensaje a Gemini y devuelve la respuesta. Lo que cada persona escribe (perfil y respuestas) viaja a través de tu proyecto de Vercel hasta la API de Google. El banco de preguntas vive en `api/chat.js` y solo viaja entre el servidor y Gemini; no aparece en la interfaz. Las transcripciones y los intentos anteriores se guardan solo en el navegador de cada persona.

**Importante:** en el plan Free de Gemini, Google puede usar los prompts y las respuestas para mejorar sus productos. No compartas datos sensibles en las entrevistas. El plan de pago desactiva ese uso.

## Notas de uso

- El dictado por voz usa el reconocimiento de voz del navegador: funciona en Chrome y Edge, no en Firefox ni en Safari.
- Funciona en el celular, pero el dictado y la lectura en voz alta dependen del navegador.
