import { defineSecret } from 'firebase-functions/params';
export const brevoCredentials = defineSecret('BREVO_CREDENTIALS');
let cached: { token: string; until: number } | undefined;
export async function sendBrevoEmail(to: string, sender: string, key: string): Promise<string> {
  if (!cached || cached.until <= Date.now()) {
    const credentials = JSON.parse(brevoCredentials.value()) as { client_id: string; client_secret: string };
    const response = await fetch('https://api.brevo.com/realms/partner/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'transactional.email:write', client_id: credentials.client_id, client_secret: credentials.client_secret }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('MAIL_AUTH_FAILED');
    const data = await response.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('MAIL_AUTH_FAILED');
    cached = { token: data.access_token, until: Date.now() + Math.max(0, (data.expires_in ?? 60) - 30) * 1000 };
  }
  const response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { Authorization: `Bearer ${cached.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: { email: sender, name: 'Sanjeevani' }, to: [{ email: to }], subject: 'Taus care check-in', textContent: 'A scheduled medicine has not been confirmed. Please sign in to Sanjeevani and check with your care circle.', headers: { idempotencyKey: key } }), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('MAIL_SEND_FAILED');
  const result = await response.json() as { messageId?: string };
  if (!result.messageId) throw new Error('MAIL_RESPONSE_UNKNOWN');
  return result.messageId;
}
