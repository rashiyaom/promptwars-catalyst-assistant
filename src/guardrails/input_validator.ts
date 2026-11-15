/**
 * Result returned by the input sanitization boundary.
 */
export interface InputValidation {
  readonly accepted: boolean;
  readonly sanitized: string;
  readonly reason?: string;
}

const INJECTION_PATTERN =
  /\b(ignore (all |any )?(previous|prior) instructions|reveal (the )?system prompt|jailbreak|developer message)\b/i;

/**
 * Validates and sanitizes raw user input by stripping ASCII control characters
 * and checking for prompt injection or system override vectors.
 *
 * @param input - Raw input string from the user or external payload
 * @returns InputValidation object indicating whether input was accepted
 */
export function validateInput(input: string): InputValidation {
  const sanitized = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

  if (!sanitized) {
    return {
      accepted: false,
      sanitized,
      reason: 'Message is empty after sanitization.',
    };
  }

  if (INJECTION_PATTERN.test(sanitized)) {
    return {
      accepted: false,
      sanitized: '',
      reason: 'Message contains an instruction override attempt.',
    };
  }

  return { accepted: true, sanitized };
}
