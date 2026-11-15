/**
 * Canonical Application Result and Error abstraction.
 * Enforces typed, deterministic outcomes across all external service integrations
 * (Firestore, Groq, Tavus, Sarvam) without unhandled promise rejections or raw throws.
 */

export enum AppErrorCode {
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PROVIDER_MALFORMED_RESPONSE = 'PROVIDER_MALFORMED_RESPONSE',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  FIRESTORE_ERROR = 'FIRESTORE_ERROR',
  GROQ_ERROR = 'GROQ_ERROR',
  TAVUS_ERROR = 'TAVUS_ERROR',
  SARVAM_ERROR = 'SARVAM_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface AppError {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly cause?: unknown;
  readonly recoverable: boolean;
}

export type Result<T, E = AppError> =
  | { readonly success: true; readonly data: T; readonly error?: never }
  | { readonly success: false; readonly error: E; readonly data?: never };

/** Wrap successful value in Result. */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/** Wrap failure in Result. */
export function err<E = AppError>(error: E): Result<never, E> {
  return { success: false, error };
}

/** Construct a typed AppError with recovery semantics. */
export function makeAppError(
  code: AppErrorCode,
  message: string,
  options?: { cause?: unknown; recoverable?: boolean },
): AppError {
  return {
    code,
    message,
    cause: options?.cause,
    recoverable: options?.recoverable ?? true,
  };
}
