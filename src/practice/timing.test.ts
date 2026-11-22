import {
  elapsedSeconds,
  formatClock,
  isExpired,
  isTimedOut,
  remainingSeconds,
  parseLimitOverride,
  timedLimitSec,
  timingPayload,
  warningFor,
  type SessionTiming,
} from './timing';
import type { AttemptTiming } from '../api/types';

const start = 1_000_000;

describe('remainingSeconds', () => {
  it('counts down and rounds up, clamped to [0, limit]', () => {
    expect(remainingSeconds(start, 3600, start)).toBe(3600);
    expect(remainingSeconds(start, 3600, start + 1000)).toBe(3599);
    expect(remainingSeconds(start, 3600, start + 3599_400)).toBe(1);
    expect(remainingSeconds(start, 3600, start + 3600_000)).toBe(0);
    expect(remainingSeconds(start, 3600, start + 9_999_999)).toBe(0);
  });

  it('is clamped to the limit when the clock moved back', () => {
    expect(remainingSeconds(start, 3600, start - 60_000)).toBe(3600);
  });
});

describe('elapsedSeconds', () => {
  it('rounds down and is never negative', () => {
    expect(elapsedSeconds(start, start + 3599_600)).toBe(3599);
    expect(elapsedSeconds(start, start - 5000)).toBe(0);
  });
});

describe('isExpired', () => {
  it('is false with no session or an untimed session', () => {
    expect(isExpired(undefined, start + 9_999_999)).toBe(false);
    const untimed: SessionTiming = { mode: 'untimed', startedAt: start };
    expect(isExpired(untimed, start + 9_999_999)).toBe(false);
  });

  it('is true for a timed session once the countdown reaches zero', () => {
    const timed: SessionTiming = { mode: 'timed', timeLimitSec: 3600, startedAt: start };
    expect(isExpired(timed, start + 3600_000)).toBe(true);
    expect(isExpired(timed, start + 3599_000)).toBe(false);
  });
});

describe('timingPayload', () => {
  it('is undefined with no session', () => {
    expect(timingPayload(undefined, start + 90_500, false)).toBeUndefined();
  });

  it('reports an untimed session elapsed time, rounded down', () => {
    const untimed: SessionTiming = { mode: 'untimed', startedAt: start };
    expect(timingPayload(untimed, start + 90_500, false)).toEqual({ mode: 'untimed', elapsedSec: 90 });
  });

  it('reports a timed session with its limit and elapsed time', () => {
    const timed: SessionTiming = { mode: 'timed', timeLimitSec: 3600, startedAt: start };
    expect(timingPayload(timed, start + 1_234_000, false)).toEqual({
      mode: 'timed',
      timeLimitSec: 3600,
      elapsedSec: 1234,
    });
  });

  it('reports the full limit when timed out', () => {
    const timed: SessionTiming = { mode: 'timed', timeLimitSec: 3600, startedAt: start };
    expect(timingPayload(timed, start + 1_234_000, true)).toEqual({
      mode: 'timed',
      timeLimitSec: 3600,
      elapsedSec: 3600,
    });
  });

  it('clamps elapsed time to the limit for a timed session', () => {
    const timed: SessionTiming = { mode: 'timed', timeLimitSec: 3600, startedAt: start };
    expect(timingPayload(timed, start + 5_000_000, false)).toEqual({
      mode: 'timed',
      timeLimitSec: 3600,
      elapsedSec: 3600,
    });
  });
});

describe('isTimedOut', () => {
  it('is false for null, untimed, under-limit, and unknown elapsed time', () => {
    expect(isTimedOut(null)).toBe(false);
    expect(isTimedOut(undefined)).toBe(false);
    expect(isTimedOut({ mode: 'untimed', elapsedSec: 3600 })).toBe(false);
    expect(isTimedOut({ mode: 'timed', timeLimitSec: 3600, elapsedSec: 3599 })).toBe(false);
    expect(isTimedOut({ mode: 'timed', timeLimitSec: 3600, elapsedSec: null })).toBe(false);
  });

  it('is true for a timed attempt that used the full limit', () => {
    const timed: AttemptTiming = { mode: 'timed', timeLimitSec: 3600, elapsedSec: 3600 };
    expect(isTimedOut(timed)).toBe(true);
  });
});

describe('formatClock', () => {
  it('formats as m:ss with two-digit seconds', () => {
    expect(formatClock(3600)).toBe('60:00');
    expect(formatClock(3599)).toBe('59:59');
    expect(formatClock(42)).toBe('0:42');
    expect(formatClock(0)).toBe('0:00');
  });
});

describe('warningFor', () => {
  it('warns at 5 minutes and 1 minute', () => {
    expect(warningFor(301)).toBeNull();
    expect(warningFor(300)).toBe('5min');
    expect(warningFor(61)).toBe('5min');
    expect(warningFor(60)).toBe('1min');
    expect(warningFor(0)).toBe('1min');
  });
});

describe('timedLimitSec', () => {
  it('is 3600 under Jest (no dev override)', () => {
    expect(timedLimitSec()).toBe(3600);
  });
});

describe('parseLimitOverride', () => {
  it.each([['30', 30], ['86400', 86400], ['1', 1]])('accepts %s', (raw, expected) => {
    expect(parseLimitOverride(raw)).toBe(expected);
  });
  it.each([undefined, '', '0', '-5', '1.5', '0.5', 'abc', '86401', 'Infinity', 'NaN'])('rejects %p', (raw) => {
    expect(parseLimitOverride(raw)).toBeNull();
  });
});
