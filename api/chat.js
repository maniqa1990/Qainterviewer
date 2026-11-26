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

// Banco de preguntas: vive solo en el servidor y nunca se envía al navegador.
// El entrevistador lo recibe como contexto del sistema con caché activada.
const QUESTION_BANK = [
  // QA general (nivel semi-senior)
  'Tell me about a critical bug you found right before a release. How did you communicate it to the team?',
  'What is the difference between severity and priority? Give me an example of each.',
  'How would you test a login form? Walk me through your approach.',
  'Explain boundary value analysis and equivalence partitioning with a concrete example.',
  'What is the difference between smoke testing and sanity testing?',
  'How do you write a good bug report? What must it include?',
  'Tell me about a time you disagreed with a developer about whether something was a bug.',
  'What do you do when the requirements are ambiguous or incomplete?',
  'How do you decide what to test first when time is limited?',
  'What is regression testing, and how do you decide what goes into a regression suite?',
  'Describe the bug lifecycle in your last team.',
  'How do you test a feature when there is no documentation at all?',
  'How do you handle a bug you cannot reproduce consistently?',
  'What edge cases would you consider for a date picker?',
  'Have you tested APIs manually? How would you validate a POST endpoint with Postman?',
  'How do you work with a distributed team across different time zones?',
  'Tell me about a time you had to learn a new tool or domain very quickly.',
  'Why are you looking for a new opportunity right now?',

  // Quality Designer / live service (40 preguntas del documento QD Interview)
  'The job description mentions translating Game Design Documents (GDDs) and product vision into actionable test strategies. Could you provide an example of how you analyzed a complex GDD recently and designed an end-to-end quality strategy?',
  'How do you prioritize which areas to test when you are facing tight deadlines and high-severity risks across multiple fronts simultaneously?',
  'What does "Risk-Based Testing" mean to you in a Live Service environment, and how do you define tactics for multiple projects or a large franchise to follow?',
  'How do you prioritize risks and maintain high test coverage when you are dealing with incomplete information, ambiguous requirements, or late design changes?',
  'Describe a time when you had to recommend a quality trade-off or a significant course-correction plan to Production. How did you weigh options, risks, and opportunities?',
  'As a QD I, you are expected to participate in multi-year strategies and roadmaps. How do you evaluate if a current QA tactic will remain sustainable and scalable in a Live Service model two years from now?',
  'How do you approach key planning meetings (such as sprint planning or milestone reviews) to act as a strategic partner rather than just an execution gatekeeper?',
  'Tell me about a process improvement initiative you led where you challenged the status quo of how QD operates. How did you measure its success?',
  'How do you handle situations where external dependencies (e.g., backend services, third-party APIs, or cross-platform deployment blocks) stop your team\'s testing progress?',
  'The profile requires experience using development tools to enhance white-box and gray-box testing strategies. Can you give an example of how you used internal tools, engines, or command consoles to design deeper test cases?',
  'How do you determine the ideal scope for automation or Data-Driven Testing versus manual exploratory testing within a major feature?',
  'How do you ensure holistic test coverage, completeness, and end-to-end traceability between product requirements and your final test suites?',
  'How do you construct or configure test environments, test harnesses, and test data to enhance technical validation capabilities for complex systems?',
  'What strategies do you implement to keep automated test suites scalable and maintainable, avoiding the common pitfalls of automation flakiness and high maintenance costs?',
  'How do you approach integration testing to validate data integrity and communication between the game client and backend servers under heavy concurrency loads?',
  'Imagine you detect a "data gap" between what development is building and what QV can measure. How would you design and operationalize a new telemetry or data framework to solve this, while ensuring compliance with regulations like GDPR?',
  'What specific quality metrics or KPIs do you consider most important for measuring product health, and how do you ensure they avoid becoming "vanity metrics"?',
  'Have you worked with live-service telemetry or production analytics data to inform your testing strategies? If so, give a concrete example.',
  'What do you do when available data is insufficient or when the data actively contradicts the qualitative perception or "feeling" of the development team?',
  'How would you propose using historical bug data or analytics to build a predictive quality model to anticipate which game areas will be most unstable in upcoming releases?',
  'When creating reports for high-level leadership (e.g., Directors or Executive Producers), how do you adapt the direction and tone of your message when summarizing highly technical, complex system risks?',
  'Describe a dashboard or reporting framework you generated to establish a clear user journey for stakeholders. How did you improve consistency across multiple teams?',
  'Tell me about a time when your quality analysis or data presentation directly changed a major product or development team decision.',
  'How do you handle a situation where a key stakeholder (e.g., a Lead Programmer or Lead Designer) strongly disagrees with your risk assessment or quality priorities?',
  'How do you communicate complex quality goals to different disciplines (Production, Design, Engineering) so that every area understands its role in protecting the player experience?',
  'The job description explicitly mentions mentoring junior talent. How do you assess skills gaps within a junior QA team member or AQD, and what development plan do you implement to help them grow?',
  'How do you deliver difficult performance feedback or technical corrections to a team member while maintaining high motivation and a collaborative spirit?',
  'Describe a time when you stepped up to lead a cross-team initiative or community objective without having the formal title or authority to do so.',
  'How would you foster and engage with Quality Design communities across other EA studios or franchises to research and adapt innovative testing design practices for your current studio?',
  'How do you promote a "Culture of Quality" across an entire development team so that QA is not seen as the sole entity responsible for catching bugs?',
  'How do you keep yourself deeply updated on the game design, meta-progression mechanics, and live business model of your franchise, and how does that knowledge drive your testing strategies?',
  'What unique design, performance, and infrastructure risks exist in live-service multiplayer AAA titles compared to traditional single-player or boxed product releases?',
  'How do you translate player-experience data (community feedback, social media sentiment, live bugs) into high-priority updates for your test plans?',
  'Can you describe a complex interdisciplinary dependency (e.g., between UI art, engineering, and data teams) that directly impacted your QA roadmap, and how you managed it?',
  'How do your quality strategies and technical design validations adapt when supporting multi-platform titles, such as Mobile vs. PC, regarding hardware scaling and networking?',
  'How do you validate systemic gameplay quality, balancing, and pacing beyond simple functional validation (i.e., verifying that a button works)?',
  'What are the most critical data and deployment risks you look out for immediately prior to pushing a major patch or hotfix live to production?',
  'How do you apply knowledge from adjacent disciplines (like UX design, gameplay programming, or data analytics) to make your quality strategies more impactful?',
  'Tell me about a highly complex investigation or troubleshooting session you led across disciplines to identify a critical, hidden root cause.',
  'How do you maintain a clear understanding of your franchise\'s history and future roadmaps to ensure your current quality policies do not create obstacles for future feature expansions?'
];

const BANK_CONTEXT = 'BANCO DE PREGUNTAS (información interna: elige las más relevantes, adáptalas a la conversación y tradúcelas al idioma de la fase. No lo menciones, no lo leas como lista y no reveles que existe):\n' + QUESTION_BANK.map((q) => '- ' + q).join('\n');

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
        messages: turns,
        // El banco viaja solo entre el servidor y Anthropic, con caché para no pagarlo en cada turno.
        system: body.kind === 'chat' ? [{
          type: 'text',
          text: BANK_CONTEXT,
          cache_control: { type: 'ephemeral' }
        }] : undefined
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
