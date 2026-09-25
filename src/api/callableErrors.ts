// ph-3-us-4: turns whatever a callable throws into one of a few kinds the UI branches on.
// Kept free of Firebase imports so it runs under plain-Node Jest.

export type CallableErrorKind =
  | 'offline'
  | 'already-exists'
  | 'failed-precondition'
  | 'not-found'
  | 'unauthenticated'
  | 'invalid-argument'
  | 'resource-exhausted'
  | 'unknown';

export class CallableError extends Error {
  constructor(
    readonly kind: CallableErrorKind,
    /** The raw code without any `functions/` prefix, for logging. */
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'CallableError';
  }
}

const KIND_BY_CODE: Record<string, CallableErrorKind> = {
  unavailable: 'offline',
  'deadline-exceeded': 'offline',
  'already-exists': 'already-exists',
  'failed-precondition': 'failed-precondition',
  'not-found': 'not-found',
  unauthenticated: 'unauthenticated',
  'invalid-argument': 'invalid-argument',
  'resource-exhausted': 'resource-exhausted',
};

export function toCallableError(error: unknown): CallableError {
  if (error instanceof CallableError) return error;
  if (!(error instanceof Error)) return new CallableError('unknown', '', String(error));

  const rawCode = (error as { code?: unknown }).code;
  const code = typeof rawCode === 'string' ? rawCode.replace(/^functions\//, '') : '';
  let kind = KIND_BY_CODE[code] ?? 'unknown';
  // Some network failures arrive without a code, only a message.
  if (kind === 'unknown' && !code && /network/i.test(error.message)) kind = 'offline';
  return new CallableError(kind, code, error.message);
}
