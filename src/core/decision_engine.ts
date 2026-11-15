/** Intent labels understood by the initial deterministic decision engine. */
export type CareIntent = 'urgent_safety' | 'missed_dose' | 'appointment' | 'general';

/** Structured result of evaluating a user's message. */
export interface Decision {
  readonly intent: CareIntent;
  readonly urgency: 'urgent' | 'routine';
  readonly needsHumanSupport: boolean;
  readonly reason: string;
}

const URGENT_PATTERNS = [
  /(?:सीने|छाती).{0,20}दर्द|सां?ँ?स.{0,20}(?:नहीं|दिक्कत|तकलीफ|तकलीफ़)|बेहोश|ओवरडोज|seene.{0,15}dard|saans.{0,15}(?:nahi|dikkat)/i,
  /\b(chest pain|can't breathe|cannot breathe|difficulty breathing|unconscious|overdose|severe allergic reaction)\b/i,
];

/** Classify intent and urgency using predictable offline rules. */
export function decide(message: string): Decision {
  if (URGENT_PATTERNS.some((pattern) => pattern.test(message))) {
    return {
      intent: 'urgent_safety',
      urgency: 'urgent',
      needsHumanSupport: true,
      reason: 'Potential emergency language detected.',
    };
  }

  if (/\b(missed|forgot|late)\b.{0,40}\b(dose|medicine|medication|pill)\b|(?:दवा|दवाई|गोली|खुराक).{0,40}(?:भूल|छूट|छोड़|देर)|(?:भूल|छूट|देर).{0,40}(?:दवा|दवाई|गोली|खुराक)|dawai?.{0,20}bhool/i.test(message)) {
    return {
      intent: 'missed_dose',
      urgency: 'routine',
      needsHumanSupport: true,
      reason: 'The user may need help with a missed dose.',
    };
  }

  if (/\b(appointment|doctor|clinic|visit)\b|डॉक्टर|डाक्टर|मुलाकात|क्लिनिक|अपॉइंटमेंट/i.test(message)) {
    return {
      intent: 'appointment',
      urgency: 'routine',
      needsHumanSupport: false,
      reason: 'The user is asking about care coordination.',
    };
  }

  return {
    intent: 'general',
    urgency: 'routine',
    needsHumanSupport: false,
    reason: 'No specialized intent was identified.',
  };
}
