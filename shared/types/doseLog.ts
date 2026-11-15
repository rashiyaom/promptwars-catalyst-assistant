/** Status for one scheduled dose record. */
export type DoseStatus = 'pending' | 'taken' | 'missed' | 'skipped';

/** An auditable status record associated with a medication schedule. */
export interface DoseLog {
  readonly id: string;
  readonly medicationId: string;
  readonly scheduledFor: string;
  readonly status: DoseStatus;
  readonly loggedBy: string | null;
  readonly loggedAt: string | null;
  readonly reminderSentAt: string | null;
  readonly nextReminderAt?: string | null;
  readonly snoozeCount?: number;
  readonly missedAlertSentAt: string | null;
}
