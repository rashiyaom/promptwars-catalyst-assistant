/** Application configuration with safe offline defaults. */
export interface AppConfig {
  /** Whether deterministic local tools should be used instead of integrations. */
  readonly mockMode: boolean;
  /** Maximum number of recent messages retained per in-memory session. */
  readonly maxSessionMessages: number;
}

/** Read and validate runtime settings from the process environment. */
export function loadConfig(
  environment: Readonly<Record<string, string | undefined>> = typeof process === 'undefined' ? {} : process.env,
): AppConfig {
  return {
    mockMode: environment.MOCK_MODE?.toLowerCase() !== 'false',
    maxSessionMessages: 20,
  };
}
