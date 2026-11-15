/** A care appointment recorded by an authorized profile member. */
export interface Appointment {
  readonly id: string;
  readonly doctorName: string;
  /** Null means an external clinician without account access. */
  readonly doctorUid?: string | null;
  readonly specialty: string;
  readonly dateTime: string;
  readonly location: string;
  readonly notes: string;
}
