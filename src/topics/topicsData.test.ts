import { toTopics } from './topicsData';

test('sorts by handbook order and keeps title, description and approved count', () => {
  expect(
    toTopics([
      { id: 'signs', data: { title: 'Signs', description: 'Shapes and colors', order: 20, approvedQuestionCount: 4 } },
      { id: 'row', data: { title: 'Right of way', description: 'Who goes first', order: 5, approvedQuestionCount: 9 } },
    ])
  ).toEqual([
    { chunkId: 'row', title: 'Right of way', description: 'Who goes first', order: 5, approvedQuestionCount: 9 },
    { chunkId: 'signs', title: 'Signs', description: 'Shapes and colors', order: 20, approvedQuestionCount: 4 },
  ]);
});

test('missing fields fall back: id for title, empty description, order last, 0 approved', () => {
  expect(toTopics([{ id: 'x', data: {} }, { id: 'a', data: { title: 'A', order: 1, approvedQuestionCount: 2 } }])).toEqual([
    { chunkId: 'a', title: 'A', description: '', order: 1, approvedQuestionCount: 2 },
    { chunkId: 'x', title: 'x', description: '', order: Number.MAX_SAFE_INTEGER, approvedQuestionCount: 0 },
  ]);
});
