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

  if (/\b(missed|forgot|late)\b.{0,40}\b(dose|medicine|medication|pill)\b/i.test(message)) {
    return {
      intent: 'missed_dose',
      urgency: 'routine',
      needsHumanSupport: true,
      reason: 'The user may need help with a missed dose.',
    };
  }

  if (/\b(appointment|doctor|clinic|visit)\b/i.test(message)) {
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
