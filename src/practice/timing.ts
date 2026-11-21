import type { AttemptTiming, TestMode, TimingSubmission } from '../api/types';

// ph-3-us-9: timed practice tests. Pure helpers for the countdown and the timing sent with
// scoreTest. No React or Firebase imports, so it runs under plain-Node Jest.
//
// Times are epoch milliseconds. Remaining time rounds UP (so the clock never shows 0 early) and
// elapsed time rounds DOWN (so it never overstates the time used).

/** The real DMV timed-test limit: one hour. */
export const TIMED_TEST_LIMIT_SEC = 3600;

// `__DEV__` is a React Native global. Declared here so this file type-checks under the plain
// Node Jest config, which does not load React Native types.
declare const __DEV__: boolean | undefined;

/** The longest limit the server accepts (scoreTest): 24 hours. */
const MAX_LIMIT_SEC = 86400;

/** A dev limit override as whole seconds in 1..86400, or null when missing or not valid. */
export function parseLimitOverride(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 && value <= MAX_LIMIT_SEC ? value : null;
}

/**
 * The countdown length for a timed test. Only a development build may override it, via
 * EXPO_PUBLIC_TIMED_LIMIT_SEC, so developers can try the timeout without waiting an hour.
 * Release builds always get TIMED_TEST_LIMIT_SEC.
 */
export function timedLimitSec(): number {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const override = parseLimitOverride(process.env.EXPO_PUBLIC_TIMED_LIMIT_SEC);
    if (override !== null) return override;
  }
  return TIMED_TEST_LIMIT_SEC;
}

/** The timing of a test in progress: started at `startedAt` (epoch ms) in `mode`. */
export interface SessionTiming {
  mode: TestMode;
  timeLimitSec?: number;
  startedAt: number;
}

/** Seconds left on the countdown, rounded up and clamped to [0, limitSec]. */
export function remainingSeconds(startedAt: number, limitSec: number, now: number): number {
  const remainingMs = limitSec * 1000 - (now - startedAt);
  return Math.min(limitSec, Math.max(0, Math.ceil(remainingMs / 1000)));
}

/** Whole seconds since `startedAt`, rounded down and never negative. */
export function elapsedSeconds(startedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** True once a timed session's countdown has run out. Untimed sessions never expire. */
export function isExpired(timing: SessionTiming | undefined, now: number): boolean {
  if (!timing || timing.mode !== 'timed') return false;
  const limitSec = timing.timeLimitSec ?? TIMED_TEST_LIMIT_SEC;
  return remainingSeconds(timing.startedAt, limitSec, now) === 0;
}

/**
 * The timing to send with scoreTest. `timedOut` forces a timed test to report the full limit,
 * which is how a test that ran out of time is recorded. Elapsed time is never more than the
 * limit for a timed test.
 */
export function timingPayload(
  timing: SessionTiming | undefined,
  now: number,
  timedOut: boolean
): TimingSubmission | undefined {
  if (!timing) return undefined;
  if (timing.mode === 'untimed') {
    return { mode: 'untimed', elapsedSec: elapsedSeconds(timing.startedAt, now) };
  }
  const limitSec = timing.timeLimitSec ?? TIMED_TEST_LIMIT_SEC;
  const elapsed = timedOut
    ? limitSec
    : Math.min(limitSec, elapsedSeconds(timing.startedAt, now));
  return { mode: 'timed', timeLimitSec: limitSec, elapsedSec: elapsed };
}

/** True when a saved timed attempt used its whole limit. Unknown elapsed time is not timed out. */
export function isTimedOut(timing: AttemptTiming | null | undefined): boolean {
  if (!timing || timing.mode !== 'timed' || timing.timeLimitSec === undefined) return false;
  return timing.elapsedSec !== null && timing.elapsedSec >= timing.timeLimitSec;
}

/** Clock text as m:ss (seconds always two digits), e.g. 3600 gives "60:00", 42 gives "0:42". */
export function formatClock(sec: number): string {
  const whole = Math.max(0, Math.floor(sec));
  const minutes = Math.floor(whole / 60);
  const seconds = String(whole % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** A countdown warning: '5min' at 5 minutes left, '1min' at 1 minute left, otherwise none. */
export type TimeWarning = '5min' | '1min';

export function warningFor(sec: number): TimeWarning | null {
  if (sec <= 60) return '1min';
  if (sec <= 300) return '5min';
  return null;
}
