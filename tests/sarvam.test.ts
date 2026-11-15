import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sarvamMiddleware } from '../web/server/sarvam';

function invoke(
  handler: ReturnType<typeof sarvamMiddleware>,
  body: object,
  origin = 'http://localhost:5173',
) {
  const req = Readable.from([JSON.stringify(body)]) as IncomingMessage;
  req.url = '/api/tts';
  req.method = 'POST';
  req.headers = { origin, host: 'localhost:5173' };
  Object.defineProperty(req, 'socket', { value: { remoteAddress: '127.0.0.1' } });
  let status = 0;
  let result = '';
  const res = {
    writeHead: (code: number) => {
      status = code;
    },
    end: (value: string) => {
      result = value;
    },
  } as ServerResponse;
  return handler(req, res, () => undefined).then(() => ({ status, result }));
}

describe('Sarvam secret proxy (mock API only)', () => {
  it('selects Hindi/English, caches repeat speech and rejects other origins', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tts-'));
    try {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ audios: ['wave'] })));
      const handler = sarvamMiddleware('secret', join(dir, 'budget'), request);
      expect((await invoke(handler, { text: 'नमस्ते', language: 'hi-IN' })).status).toBe(200);
      expect((await invoke(handler, { text: 'नमस्ते', language: 'hi-IN' })).status).toBe(200);
      expect(request).toHaveBeenCalledTimes(1);
      const firstBody = request.mock.calls[0]?.[1]?.body;
      const firstPayload =
        typeof firstBody === 'string' ? (JSON.parse(firstBody) as { language_code?: string }) : {};
      expect(firstPayload.language_code).toBe('hi-IN');
      request.mockResolvedValueOnce(new Response(JSON.stringify({ audios: ['english'] })));
      expect((await invoke(handler, { text: 'Hello', language: 'en-IN' })).status).toBe(200);
      const secondBody = request.mock.calls[1]?.[1]?.body;
      const secondPayload =
        typeof secondBody === 'string'
          ? (JSON.parse(secondBody) as { language_code?: string })
          : {};
      expect(secondPayload.language_code).toBe('en-IN');
      expect(
        (await invoke(handler, { text: 'Hello', language: 'en-IN' }, 'https://evil.example'))
          .status,
      ).toBe(403);
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
  it('counts failed calls, persists the cap across restarts, and never retries', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tts-'));
    try {
      const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }));
      const file = join(dir, 'budget');
      const handler = sarvamMiddleware('secret', file, request);
      for (let i = 0; i < 5; i++)
        expect((await invoke(handler, { text: 'a'.repeat(600), language: 'en-IN' })).status).toBe(
          502,
        );
      const restarted = sarvamMiddleware('secret', file, request);
      expect((await invoke(restarted, { text: 'Hello', language: 'en-IN' })).status).toBe(429);
      expect(request).toHaveBeenCalledTimes(5);
      expect((await invoke(handler, { text: 'Hello', language: 'xx' })).status).toBe(400);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
