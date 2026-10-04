import type { Topic } from '../topics/topicsData';
import { STATUS_LABEL, toConceptRows } from './conceptList';

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
    { chunkId: 'a', title: 'A', description: 'About a', status: 'reviewed', scorePercent: 80, comingSoon: false },
    { chunkId: 'b', title: 'B', description: 'About b', status: 'not-started', scorePercent: null, comingSoon: false },
    { chunkId: 'c', title: 'C', description: 'About c', status: 'needs-revisit', scorePercent: null, comingSoon: false },
  ]);
});

test('a topic with no approved questions is coming soon', () => {
  expect(toConceptRows([topic('a', 1, 0)], {})[0].comingSoon).toBe(true);
});

test('scores round to whole percents', () => {
  expect(toConceptRows([topic('a', 1)], { a: { status: 'in-progress', latestMiniQuizScore: 2 / 3 } })[0].scorePercent).toBe(67);
});

test('every status has a label', () => {
  expect(STATUS_LABEL).toEqual({
    'not-started': 'Not started',
    'in-progress': 'In progress',
    reviewed: 'Reviewed',
    'needs-revisit': 'Needs revisit',
  });
});
