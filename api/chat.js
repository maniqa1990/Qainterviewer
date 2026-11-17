'use strict';
/**
 * Proxy hacia la API de Anthropic para el Simulador de Entrevistas QA.
 * La clave vive solo en variables de entorno del servidor, nunca en la página.
 *
 * Variables de entorno:
 *   ANTHROPIC_API_KEY     (obligatoria) tu clave de console.anthropic.com
 *   ACCESS_CODE           (recomendada) código que deben escribir tus compañeros
 *   MODEL_CHAT            (opcional) modelo del entrevistador, por defecto claude-haiku-5-5
 *   MODEL_EVAL            (opcional) modelo de la calificación, por defecto claude-sonnet-5-5
 *   RATE_LIMIT_PER_HOUR   (opcional) llamadas por IP por hora, por defecto 120
 *   DAILY_CALL_CAP        (opcional) llamadas totales por día y por instancia, por defecto 1500
 */
const crypto = require('crypto');

const MODEL_CHAT = process.env.MODEL_CHAT || 'claude-haiku-5-5';
const MODEL_EVAL = process.env.MODEL_EVAL || 'claude-sonnet-5-5';
const ACCESS_CODE = process.env.ACCESS_CODE || '';
const RATE_PER_HOUR = parseInt(process.env.RATE_LIMIT_PER_HOUR || '120', 10);
const DAILY_CAP = parseInt(process.env.DAILY_CALL_CAP || '1500', 10);

const MAX_CHARS = 60000;
const MAX_TURNS = 80;
const MAX_TOKENS = { chat: 500, eval: 4000 };

// Límites en memoria: son un freno razonable, no una garantía (cada instancia del servidor tiene su propia cuenta).
const perIp = new Map();
let day = { key: '', count: 0 };

function send(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function limited(req) {
  const now = Date.now();
  const key = new Date(now).toISOString().slice(0, 10);
  if (day.key !== key) day = { key, count: 0 };
  if (day.count >= DAILY_CAP) return true;
  const ip = clientIp(req);
  let e = perIp.get(ip);
  if (!e || e.reset < now) e = { count: 0, reset: now + 3600 * 1000 };
  if (e.count >= RATE_PER_HOUR) { perIp.set(ip, e); return true; }
  e.count += 1; day.count += 1;
  perIp.set(ip, e);
  if (perIp.size > 5000) for (const [k, v] of perIp) if (v.reset < now) perIp.delete(k);
  return false;
}

function codeOk(req) {
  if (!ACCESS_CODE) return true;
  const given = String(req.headers['x-access-code'] || '');
  const a = Buffer.from(given), b = Buffer.from(ACCESS_CODE);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normalize(messages) {
  let turns;
  if (typeof messages === 'string') turns = [{ role: 'user', content: messages }];
  else if (Array.isArray(messages)) turns = messages;
  else return null;
  if (!turns.length || turns.length > MAX_TURNS) return null;
  let total = 0;
  for (const t of turns) {
    if (!t || (t.role !== 'user' && t.role !== 'assistant') || typeof t.content !== 'string' || !t.content.trim()) return null;
    total += t.content.length;
  }
  if (turns[0].role !== 'user' || turns[turns.length - 1].role !== 'user') return null;
  if (total > MAX_CHARS) return 'too_large';
  return turns.map((t) => ({ role: t.role, content: t.content }));
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return send(res, 200, { ok: true, needsCode: !!ACCESS_CODE });
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  if (!process.env.ANTHROPIC_API_KEY) return send(res, 500, { error: 'server_misconfigured' });
  if (!codeOk(req)) return send(res, 401, { error: 'unauthorized' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || (body.kind !== 'chat' && body.kind !== 'eval')) return send(res, 400, { error: 'invalid_request' });

  const turns = normalize(body.messages);
  if (turns === 'too_large') return send(res, 413, { error: 'too_large' });
  if (!turns) return send(res, 400, { error: 'invalid_request' });

  if (limited(req)) return send(res, 429, { error: 'rate_limited' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: body.kind === 'eval' ? MODEL_EVAL : MODEL_CHAT,
        max_tokens: MAX_TOKENS[body.kind],
        messages: turns
      })
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      console.error('Anthropic API error', r.status, data && data.error && data.error.type);
      if (r.status === 429) return send(res, 429, { error: 'rate_limited' });
      if (r.status === 401 || r.status === 403 || r.status === 404) return send(res, 500, { error: 'server_misconfigured' });
      return send(res, 502, { error: 'upstream_error' });
    }
    if (data.stop_reason === 'refusal') return send(res, 422, { error: 'refused' });
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
    if (!text) return send(res, 502, { error: 'empty_completion' });
    return send(res, 200, { text, truncated: data.stop_reason === 'max_tokens' });
  } catch (e) {
    console.error('Proxy error', e && e.message);
    return send(res, 502, { error: 'upstream_error' });
  }
};
