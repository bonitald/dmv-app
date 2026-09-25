import { CallableError, toCallableError } from './callableErrors';

describe('toCallableError', () => {
  test.each([
    ['unavailable', 'offline'],
    ['functions/unavailable', 'offline'],
    ['deadline-exceeded', 'offline'],
    ['already-exists', 'already-exists'],
    ['functions/already-exists', 'already-exists'],
    ['failed-precondition', 'failed-precondition'],
    ['not-found', 'not-found'],
    ['unauthenticated', 'unauthenticated'],
    ['invalid-argument', 'invalid-argument'],
    ['resource-exhausted', 'resource-exhausted'],
    ['internal', 'unknown'],
  ])('code %s maps to %s', (code, kind) => {
    const mapped = toCallableError(Object.assign(new Error('boom'), { code }));
    expect(mapped).toBeInstanceOf(CallableError);
    expect(mapped.kind).toBe(kind);
    expect(mapped.message).toBe('boom');
  });

  test('a network failure with no code is offline', () => {
    expect(toCallableError(new Error('Network request failed')).kind).toBe('offline');
  });

  test('a non-Error value is unknown', () => {
    expect(toCallableError('nope').kind).toBe('unknown');
  });

  test('an existing CallableError is returned as is', () => {
    const original = new CallableError('offline', 'unavailable', 'x');
    expect(toCallableError(original)).toBe(original);
  });
});
