import { nextStatus, progressFor, statusForChoice, toProgress } from './conceptProgressData';

describe('toProgress', () => {
  test('no doc is not started', () => {
    expect(toProgress(undefined)).toEqual({ status: 'not-started' });
  });

  test('a stored status is kept, with the score and its date', () => {
    const at = new Date('2026-10-01T10:00:00Z');
    expect(
      toProgress({ status: 'reviewed', latestMiniQuizScore: 0.8, latestMiniQuizAt: { toDate: () => at } })
    ).toEqual({ status: 'reviewed', latestMiniQuizScore: 0.8, latestMiniQuizAt: at });
  });

  test('reads correct and total when present', () => {
    expect(
      toProgress({ status: 'reviewed', latestMiniQuizScore: 0.7, latestMiniQuizCorrect: 7, latestMiniQuizTotal: 10 })
    ).toEqual({ status: 'reviewed', latestMiniQuizScore: 0.7, latestMiniQuizCorrect: 7, latestMiniQuizTotal: 10 });
  });

  test('ignores non-numeric correct and total', () => {
    expect(toProgress({ latestMiniQuizScore: 0.5, latestMiniQuizCorrect: '5' })).toEqual({
      status: 'in-progress',
      latestMiniQuizScore: 0.5,
    });
  });

  test('reads the passed and not-passed quiz counts when present', () => {
    expect(toProgress({ status: 'reviewed', miniQuizPassCount: 2, miniQuizFailCount: 1 })).toEqual({
      status: 'reviewed',
      miniQuizPassCount: 2,
      miniQuizFailCount: 1,
    });
  });

  test('ignores non-numeric quiz counts', () => {
    expect(toProgress({ status: 'reviewed', miniQuizPassCount: '2', miniQuizFailCount: null })).toEqual({
      status: 'reviewed',
    });
  });

  test('a score but no status is in progress', () => {
    expect(toProgress({ latestMiniQuizScore: 0.4 })).toEqual({
      status: 'in-progress',
      latestMiniQuizScore: 0.4,
    });
  });

  test('an unknown status is ignored (not started, or in progress with a score)', () => {
    expect(toProgress({ status: 'done' })).toEqual({ status: 'not-started' });
    expect(toProgress({ status: 'done', latestMiniQuizScore: 1 }).status).toBe('in-progress');
  });

  test('a pending server timestamp (null) leaves the date out', () => {
    expect(toProgress({ latestMiniQuizScore: 1, latestMiniQuizAt: null })).toEqual({
      status: 'in-progress',
      latestMiniQuizScore: 1,
    });
  });
});

test('progressFor: a topic missing from the map is not started', () => {
  expect(progressFor({ a: { status: 'reviewed' } }, 'b')).toEqual({ status: 'not-started' });
  expect(progressFor({ a: { status: 'reviewed' } }, 'a').status).toBe('reviewed');
});

describe('nextStatus (ph-2-us-10 transitions)', () => {
  test('opening a not-started topic makes it in progress', () => {
    expect(nextStatus('not-started', 'opened')).toBe('in-progress');
  });

  test.each(['in-progress', 'reviewed', 'needs-revisit'] as const)(
    'opening a %s topic writes nothing (opening never downgrades)',
    (current) => {
      expect(nextStatus(current, 'opened')).toBeNull();
    }
  );

  test.each([
    ['review-again', 'in-progress'],
    ['come-back-later', 'needs-revisit'],
    ['mark-reviewed', 'reviewed'],
  ] as const)('%s sets %s, whatever the current status', (choice, expected) => {
    expect(statusForChoice(choice)).toBe(expected);
    expect(nextStatus('reviewed', choice)).toBe(expected);
    expect(nextStatus('not-started', choice)).toBe(expected);
  });
});
