import { z } from 'zod';
import type { MemberRole } from '@sanjeevani/shared/types/profile';

export const profileSchema = z.object({
  elderName: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(100),
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
    }, 'Enter a valid IANA timezone, such as Asia/Kolkata.'),
});
export const joinSchema = z.object({
  profileId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(100),
  passcode: z.string().regex(/^\d{6,12}$/, 'Enter a 6–12 digit passcode.'),
});
export type RoleCodes = Record<Exclude<MemberRole, 'doctor'>, string>;

/** Generate three distinct role passcodes without hardcoded secrets. */
export function generateRoleCodes(): RoleCodes {
  const unique = new Set<string>();
  while (unique.size < 3) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const code = Array.from(bytes)
      .filter((value) => value < 250)
      .slice(0, 10)
      .map((value) => value % 10)
      .join('');
    if (code.length === 10) unique.add(code);
  }
  const [elder = '', caretaker = '', family = ''] = [...unique];
  return { elder, caretaker, family };
}
