/** Days between scheduled doses for a medication schedule. */
export type MedicationFrequency =
  | { readonly type: 'daily' }
  | { readonly type: 'weekdays'; readonly days?: readonly number[] }
  | { readonly type: 'interval'; readonly everyNDays: number };

/** A medication schedule; this app records information and does not prescribe. */
export interface Medication {
  readonly id: string;
  readonly name: string;
  readonly dosage: string;
  readonly times: readonly string[];
  readonly frequency: MedicationFrequency;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly notes: string;
  /** Caregiver-provided package photo, never an AI medicine identification. */
  readonly imageUrl?: string;
  readonly active: boolean;
}
