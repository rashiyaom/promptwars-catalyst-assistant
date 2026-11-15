/** Minimal structured logger interface for server-side code. */
export interface LogContext {
  readonly event: string;
  readonly profileId?: string;
  readonly eventId?: string;
  readonly detail?: string;
}

/** Emit one structured log record without including secrets or message bodies. */
export function logInfo(context: LogContext): void {
  console.info(JSON.stringify({ service: 'sanjeevani', ...context }));
}
