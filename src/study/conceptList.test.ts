import type { Topic } from '../topics/topicsData';
import { quizLine, STATUS_LABEL, toConceptRows } from './conceptList';

const topic = (chunkId: string, order: number, approvedQuestionCount = 3): Topic => ({
  chunkId,
  title: chunkId.toUpperCase(),
  description: `About ${chunkId}`,
  order,
  approvedQuestionCount,
});

test('keeps the topics order and merges status and score; no record is not started', () => {
  const rows = toConceptRows([topic('a', 1), topic('b', 2), topic('c', 3)], {
    a: { status: 'reviewed', latestMiniQuizScore: 0.8 },
    c: { status: 'needs-revisit' },
  });
  expect(rows).toEqual([
    { chunkId: 'a', title: 'A', description: 'About a', status: 'reviewed', lastQuizNotPassed: false, quizLine: 'Latest quiz: 80%', comingSoon: false },
    { chunkId: 'b', title: 'B', description: 'About b', status: 'not-started', lastQuizNotPassed: false, quizLine: null, comingSoon: false },
    { chunkId: 'c', title: 'C', description: 'About c', status: 'needs-revisit', lastQuizNotPassed: false, quizLine: null, comingSoon: false },
  ]);
});

test('a topic with no approved questions is coming soon', () => {
  expect(toConceptRows([topic('a', 1, 0)], {})[0].comingSoon).toBe(true);
});

test('scores round to whole percents in the older-record line', () => {
  expect(toConceptRows([topic('a', 1)], { a: { status: 'in-progress', latestMiniQuizScore: 2 / 3 } })[0].quizLine).toBe('Latest quiz: 67%');
});

test('a row flags a latest quiz below the pass mark, whatever its status', () => {
  const [row] = toConceptRows([topic('a', 1)], { a: { status: 'reviewed', latestMiniQuizScore: 0.5 } });
  expect(row.lastQuizNotPassed).toBe(true);
});

describe('quizLine', () => {
  test('passed, not passed and latest', () => {
    expect(
      quizLine({ status: 'reviewed', miniQuizPassCount: 2, miniQuizFailCount: 1, latestMiniQuizCorrect: 4, latestMiniQuizTotal: 10, latestMiniQuizScore: 0.4 })
    ).toBe('Quizzes: 2 passed · 1 not passed · latest 4 of 10');
  });
  test('leaves out parts with no data', () => {
    expect(quizLine({ status: 'reviewed', miniQuizPassCount: 1, miniQuizFailCount: 0, latestMiniQuizCorrect: 9, latestMiniQuizTotal: 10 })).toBe(
      'Quizzes: 1 passed · latest 9 of 10'
    );
    expect(quizLine({ status: 'reviewed', latestMiniQuizCorrect: 9, latestMiniQuizTotal: 10, latestMiniQuizScore: 0.9 })).toBe('Quizzes: latest 9 of 10');
    expect(quizLine({ status: 'reviewed', miniQuizFailCount: 3 })).toBe('Quizzes: 3 not passed');
  });
  test('older records fall back to the percent', () => {
    expect(quizLine({ status: 'reviewed', latestMiniQuizScore: 0.8 })).toBe('Latest quiz: 80%');
  });
  test('nothing taken is null', () => {
    expect(quizLine({ status: 'in-progress' })).toBeNull();
  });
});

test('every status has a label', () => {
  expect(STATUS_LABEL).toEqual({
    'not-started': 'Not started',
    'in-progress': 'In progress',
    reviewed: 'Reviewed',
    'needs-revisit': 'Needs revisit',
  });
});
