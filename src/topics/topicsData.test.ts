import { toTopics } from './topicsData';

test('sorts by handbook order and keeps title', () => {
  expect(
    toTopics([
      { id: 'signs', data: { title: 'Signs', order: 20 } },
      { id: 'row', data: { title: 'Right of way', order: 5 } },
    ])
  ).toEqual([
    { chunkId: 'row', title: 'Right of way', order: 5 },
    { chunkId: 'signs', title: 'Signs', order: 20 },
  ]);
});

test('falls back to the id for a missing title and sorts a missing order last', () => {
  expect(toTopics([{ id: 'x', data: {} }, { id: 'a', data: { title: 'A', order: 1 } }])).toEqual([
    { chunkId: 'a', title: 'A', order: 1 },
    { chunkId: 'x', title: 'x', order: Number.MAX_SAFE_INTEGER },
  ]);
});
