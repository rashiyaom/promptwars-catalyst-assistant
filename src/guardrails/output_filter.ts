/** Replace common personally identifying values before returning text. */
export function redactPersonalInformation(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[card number redacted]')
    .replace(/\b\d{12}\b/g, '[identification number redacted]')
    .replace(/\b(?:\+?\d[\d .()-]{8,}\d)\b/g, '[phone number redacted]');
}
