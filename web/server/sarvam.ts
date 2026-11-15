import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';

/** Local-only secret proxy. Never deployed to Firebase Hosting or exposed on a LAN. */
export function sarvamMiddleware(key: string, budgetFile: string, request = fetch) {
  const cache = new Map<string, string>();
  let pending = false;
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url !== '/api/tts') return next();
    const reply = (status: number, value: object) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    const address = req.socket.remoteAddress;
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '');
    let originOK = false;
    try {
      const origin = new URL(req.headers.origin ?? '');
      originOK = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && origin.host === req.headers.host;
    } catch { /* Missing or invalid origin is rejected. */ }
    if (!local || !originOK) return reply(403, { error: 'Local access only.' });
    if (req.method !== 'POST') return reply(405, { error: 'POST required.' });
    if (!key) return reply(503, { error: 'Speech service is not configured.' });
    let body = '';
    try {
      for await (const chunk of req) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 4096) return reply(413, { error: 'Text too long.' });
      }
      const { text, language } = JSON.parse(body);
      if (typeof text !== 'string' || !text.trim() || text.length > 600 || !['hi-IN', 'en-IN'].includes(language)) return reply(400, { error: 'Invalid speech request.' });
      const id = JSON.stringify([language, text]);
      const cached = cache.get(id);
      if (cached) return reply(200, { audio: cached });
      if (pending) return reply(429, { error: 'Speech request in progress.' });
      const day = new Date().toISOString().slice(0, 10);
      let budget = { day, characters: 0, calls: 0 };
      try {
        const stored = JSON.parse(readFileSync(budgetFile, 'utf8'));
        if (stored.day === day) budget = stored;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return reply(503, { error: 'Cannot verify speech budget.' });
      }
      if (budget.characters + text.length > 3000 || budget.calls >= 30) return reply(429, { error: 'Daily speech limit reached. Using device voice.' });
      // Reserve before sending: failures count too. Restarts cannot reset today's limit.
      writeFileSync(budgetFile, JSON.stringify({ day, characters: budget.characters + text.length, calls: budget.calls + 1 }), { mode: 0o600 });
      pending = true;
      try {
        const response = await request('https://api.sarvam.ai/text-to-speech', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'api-subscription-key': key },
          body: JSON.stringify({ text, language_code: language, model: 'bulbul:v3', speaker: 'shubh', pace: 0.9, output_audio_codec: 'wav' }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) return reply(502, { error: 'Speech provider unavailable.' });
        const data = await response.json() as { audios?: string[] };
        const audio = data.audios?.[0];
        if (!audio) return reply(502, { error: 'No speech returned.' });
        if (cache.size >= 20) cache.delete(cache.keys().next().value!);
        cache.set(id, audio);
        reply(200, { audio });
      } finally { pending = false; }
    } catch { reply(503, { error: 'Speech unavailable. Using device voice.' }); }
  };
}
