/** Only a profile's caretaker may choose these escalation destinations. */
export interface EscalationSettings {
  readonly enabled: boolean;
  readonly email: string;
  readonly smsNumber: string;
  readonly consentConfirmed: boolean;
}
export interface AlertDelivery {
  readonly id: string;
  readonly channel: 'email';
  readonly status: 'pending' | 'sending' | 'accepted' | 'failed' | 'unknown' | 'mocked';
  readonly doseId: string;
  readonly updatedAt: string;
}
