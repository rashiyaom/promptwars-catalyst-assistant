/** Result returned by the input sanitization boundary. */
export interface InputValidation {
  readonly accepted: boolean;
  readonly sanitized: string;
  readonly reason?: string;
}

const INJECTION_PATTERN = /\b(ignore (all |any )?(previous|prior) instructions|reveal (the )?system prompt|jailbreak|developer message)\b/i;

/** Reject common prompt-injection attempts and remove unsafe control characters. */
export function validateInput(input: string): InputValidation {
  const sanitized = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!sanitized) {
    return { accepted: false, sanitized, reason: 'Message is empty after sanitization.' };
  }
  if (INJECTION_PATTERN.test(sanitized)) {
    return { accepted: false, sanitized: '', reason: 'Message contains an instruction override attempt.' };
  }
  return { accepted: true, sanitized };
}
