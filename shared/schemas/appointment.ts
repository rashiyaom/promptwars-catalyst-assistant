import { z } from 'zod';

/** Validated appointment fields accepted from a care-circle member. */
export const appointmentInputSchema = z.object({
  doctorUid: z.string().min(1).max(128).nullable().optional(),
  doctorName: z.string().trim().min(1).max(120),
  specialty: z.string().trim().max(120),
  dateTime: z.iso.datetime({ offset: true }),
  location: z.string().trim().max(300),
  notes: z.string().max(1000),
});

/** Type inferred from the validated appointment schema. */
export type AppointmentInput = z.infer<typeof appointmentInputSchema>;
