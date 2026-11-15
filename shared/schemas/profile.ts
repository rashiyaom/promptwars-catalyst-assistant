import { z } from 'zod';

export const elderProfileInputSchema = z
  .object({
    elderName: z.string().trim().min(1).max(100),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Enter a valid IANA timezone.'),
    relationship: z.enum(['self', 'parent', 'relative', 'other']),
  })
  .strict();
export type ElderProfileInput = z.infer<typeof elderProfileInputSchema>;

export const invitationInputSchema = z
  .object({
    profileId: z.string().uuid(),
    email: z.email().trim().toLowerCase().max(254),
    role: z.enum(['elder', 'caretaker', 'family', 'doctor']),
  })
  .strict();
export type InvitationInput = z.infer<typeof invitationInputSchema>;

export const acceptInvitationSchema = z
  .object({
    profileId: z.string().uuid(),
    invitationId: z.string().uuid(),
    token: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
