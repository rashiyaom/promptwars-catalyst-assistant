import { z } from 'zod';
export const escalationSettingsSchema = z
  .object({
    enabled: z.boolean(),
    email: z.union([z.literal(''), z.email().max(254)]),
    smsNumber: z.union([
      z.literal(''),
      z
        .string()
        .regex(/^\+[1-9]\d{7,14}$/, 'Use an international number, for example +919876543210.'),
    ]),
    consentConfirmed: z.boolean(),
  })
  .strict()
  .refine(
    (value) =>
      !value.enabled || (value.consentConfirmed && Boolean(value.email || value.smsNumber)),
    'Confirm recipient consent and provide at least one contact.',
  );
