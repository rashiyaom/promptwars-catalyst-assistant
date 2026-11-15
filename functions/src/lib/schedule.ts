/** Convert a local HH:mm schedule value to validated numeric parts. */
export function parseLocalTime(value: string): { hours: number; minutes: number } | null {
  const match = /^(?:([01]\d|2[0-3])):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}
