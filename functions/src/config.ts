/** Validated server-side environment settings used by Cloud Functions. */
export interface FunctionConfig {
  readonly mockMode: boolean;
  readonly graceMinutes: number;
  readonly emailFrom: string | null;
}

/** Load safe defaults and validate reminder settings at the service boundary. */
export function loadFunctionConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): FunctionConfig {
  const graceMinutes = Number(environment.GRACE_MINUTES ?? '30');
  if (!Number.isInteger(graceMinutes) || graceMinutes < 5 || graceMinutes > 240) {
    throw new Error('GRACE_MINUTES must be an integer between 5 and 240.');
  }
  return {
    mockMode: environment.MOCK_MODE?.toLowerCase() !== 'false',
    graceMinutes,
    emailFrom:
      environment.EMAIL_FROM && environment.EMAIL_FROM.trim().length > 0
        ? environment.EMAIL_FROM.trim()
        : null,
  };
}
