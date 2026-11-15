import { z } from 'zod';

/** Validated medication schedule fields accepted from a care-circle member. */
export const medicationInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dosage: z.string().trim().min(1).max(80),
  times: z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)).min(1).max(12),
  frequency: z.discriminatedUnion('type', [
    z.object({ type: z.literal('daily') }),
    z.object({
      type: z.literal('weekdays'),
      days: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    }),
    z.object({
      type: z.literal('interval'),
      everyNDays: z.number().int().min(1).max(365),
    }),
  ]),
  startDate: z.iso.date(),
  endDate: z.iso.date().nullable(),
  notes: z.string().max(500),
  active: z.boolean(),
  imageUrl: z.union([z.literal(''), z.url({ protocol: /^https$/ }).max(2048)]).optional(),
});

/** Type inferred from the validated medication input schema. */
export type MedicationInput = z.infer<typeof medicationInputSchema>;
