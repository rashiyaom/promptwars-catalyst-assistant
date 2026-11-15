/**
 * Scans generated model or assistant text and redacts sensitive Personally
 * Identifiable Information (PII) including emails, phone numbers, payment card
 * numbers, and government identification numbers prior to presentation.
 *
 * @param text - Raw response text to be scrubbed
 * @returns Redacted text safe for client display and logging
 */
export function redactPersonalInformation(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[card number redacted]')
    .replace(/\b\d{12}\b/g, '[identification number redacted]')
    .replace(/\b(?:\+?\d[\d .()-]{8,}\d)\b/g, '[phone number redacted]');
}
