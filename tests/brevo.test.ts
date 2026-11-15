import { afterEach, expect, it, vi } from 'vitest';
vi.mock('firebase-functions/params', () => ({
  defineSecret: () => ({
    value: () => JSON.stringify({ client_id: 'test', client_secret: 'test' }),
  }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('exchanges scoped credentials, caches the token and requires provider acceptance', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'test-token', expires_in: 3600 }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ messageId: 'accepted-id' }) })
    .mockResolvedValueOnce({ ok: false });
  vi.stubGlobal('fetch', request);
  const { sendBrevoEmail } = await import('../functions/src/reminders/brevo.js');
  expect(await sendBrevoEmail('care@example.test', 'sender@example.test', 'dose-1')).toBe(
    'accepted-id',
  );
  expect(request.mock.calls[0][1].body.get('scope')).toBe('transactional.email:write');
  expect(JSON.parse(request.mock.calls[1][1].body).headers.idempotencyKey).toBe('dose-1');
  await expect(
    sendBrevoEmail('care@example.test', 'sender@example.test', 'dose-2'),
  ).rejects.toThrow('MAIL_SEND_FAILED');
  expect(request).toHaveBeenCalledTimes(3);
});
it('does not send when token authentication fails', async () => {
  const request = vi.fn().mockResolvedValue({ ok: false });
  vi.stubGlobal('fetch', request);
  const { sendBrevoEmail } = await import('../functions/src/reminders/brevo.js');
  await expect(sendBrevoEmail('care@example.test', 'sender@example.test', 'dose')).rejects.toThrow(
    'MAIL_AUTH_FAILED',
  );
  expect(request).toHaveBeenCalledTimes(1);
});
