import type { ScoreTestResult } from '../api/types';
import type { Topic } from '../topics/topicsData';
import {
  attemptDateLabel,
  fromPracticeAttempt,
  fromPracticeScore,
  leftOutLine,
  neededToPass,
  passed,
  passLine,
  percentLine,
  scoreLine,
  sumPracticeEvidence,
  topicsToWorkOn,
  type PracticeOutcome,
} from './practiceData';

const outcome = (c: number, t: number, extra: Partial<PracticeOutcome> = {}): PracticeOutcome => ({
  testId: 'x',
  createdAt: null,
  correctCount: c,
  totalCount: t,
  perTopic: [],
  unavailableCount: 0,
  ...extra,
});

const topic = (chunkId: string, order: number): Topic => ({ chunkId, title: `T ${chunkId}`, order }) as Topic;

describe('neededToPass / passed', () => {
  it('rounds up the pass mark', () => {
    expect(neededToPass(25)).toBe(20);
    expect(neededToPass(24)).toBe(20);
    expect(neededToPass(20)).toBe(16);
    expect(neededToPass(0)).toBe(0);
  });
  it('passes at the mark', () => {
    expect(passed({ correctCount: 20, totalCount: 25 })).toBe(true);
    expect(passed({ correctCount: 19, totalCount: 25 })).toBe(false);
    expect(passed({ correctCount: 20, totalCount: 24 })).toBe(true);
    expect(passed({ correctCount: 19, totalCount: 24 })).toBe(false);
  });
});

describe('lines', () => {
  it('passLine', () => {
    expect(passLine(outcome(22, 25))).toBe("You'd pass the real test. It needs 20 of 25.");
    expect(passLine(outcome(17, 25))).toBe('3 more right answers to pass (20 of 25 needed). Every test helps.');
    expect(passLine(outcome(19, 25))).toBe('1 more right answer to pass (20 of 25 needed). Every test helps.');
  });
  it('score and percent', () => {
    expect(scoreLine(outcome(17, 25))).toBe('17 of 25 correct');
    expect(percentLine(outcome(17, 25))).toBe('68%');
    expect(percentLine(outcome(0, 0))).toBe('0%');
  });
  it('leftOutLine', () => {
    expect(leftOutLine(outcome(1, 25))).toBeNull();
    expect(leftOutLine(outcome(1, 24, { unavailableCount: 1 }))).toBe(
      '1 question was removed from the bank, so this test is scored out of 24.',
    );
    expect(leftOutLine(outcome(1, 23, { unavailableCount: 2 }))).toBe(
      '2 questions were removed from the bank, so this test is scored out of 23.',
    );
  });
});

describe('topicsToWorkOn', () => {
  it('sorts by misses then order, drops zero-miss and unknown topics', () => {
    const topics = [topic('a', 1), topic('b', 2), topic('c', 3), topic('d', 4)];
    const res = topicsToWorkOn(
      [
        { chunkId: 'c', correct: 0, total: 2 },
        { chunkId: 'b', correct: 1, total: 2 },
        { chunkId: 'a', correct: 1, total: 2 },
        { chunkId: 'd', correct: 2, total: 2 },
        { chunkId: 'zzz', correct: 0, total: 3 },
      ],
      topics,
    );
    expect(res.shown.map((s) => [s.chunkId, s.missed])).toEqual([
      ['c', 2],
      ['a', 1],
      ['b', 1],
    ]);
    expect(res.moreCount).toBe(0);
  });
  it('caps at the limit', () => {
    const topics = Array.from({ length: 7 }, (_, i) => topic(`t${i}`, i));
    const per = topics.map((t) => ({ chunkId: t.chunkId, correct: 0, total: 1 }));
    const res = topicsToWorkOn(per, topics, 5);
    expect(res.shown).toHaveLength(5);
    expect(res.moreCount).toBe(2);
  });
});

describe('fromPracticeAttempt / fromPracticeScore', () => {
  it('rejects non-practice or malformed data', () => {
    expect(fromPracticeAttempt('a', undefined)).toBeNull();
    expect(fromPracticeAttempt('a', { type: 'mini-quiz', correctCount: 1, totalCount: 2, perTopic: [] })).toBeNull();
    expect(fromPracticeAttempt('a', { type: 'practice', correctCount: 1, totalCount: 2 })).toBeNull();
  });
  it('maps a valid attempt', () => {
    const date = new Date(2026, 10, 20);
    const perTopic = [{ chunkId: 'a', correct: 1, total: 2 }];
    expect(
      fromPracticeAttempt('t1', {
        type: 'practice',
        correctCount: 1,
        totalCount: 2,
        perTopic,
        createdAt: { toDate: () => date },
        perQuestion: [{ unavailable: true }, { correct: true }],
      }),
    ).toEqual({ testId: 't1', createdAt: date, correctCount: 1, totalCount: 2, perTopic, unavailableCount: 1 });
  });
  it('maps a score result with null createdAt', () => {
    const r = {
      testId: 't2',
      type: 'practice',
      score: 0.5,
      correctCount: 1,
      totalCount: 2,
      perTopic: [{ chunkId: 'a', correct: 1, total: 2 }],
      perQuestion: [{ questionId: 'q', unavailable: true }],
      recommendation: null,
    } as unknown as ScoreTestResult;
    const o = fromPracticeScore(r);
    expect(o.createdAt).toBeNull();
    expect(o.unavailableCount).toBe(1);
    expect(o.testId).toBe('t2');
  });
});

describe('sumPracticeEvidence / attemptDateLabel', () => {
  it('sums per topic across outcomes', () => {
    const pt = [{ chunkId: 'row', correct: 1, total: 2 }];
    const m = sumPracticeEvidence([outcome(1, 2, { perTopic: pt }), outcome(1, 2, { perTopic: pt })]);
    expect(m.get('row')).toEqual({ correct: 2, total: 4 });
  });
  it('labels dates', () => {
    expect(attemptDateLabel(new Date(2026, 10, 20))).toBe('Nov 20');
    expect(attemptDateLabel(null)).toBe('Just now');
  });
});
