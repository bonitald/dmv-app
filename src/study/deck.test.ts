import { deckReducer, isHorizontalDrag, shuffled, swipeDirection, toDeckError } from './deck';

const deck = (index: number) => ({ cards: ['a', 'b', 'c'], index });

describe('deckReducer', () => {
  test('next moves forward and stops at the end-of-deck position', () => {
    expect(deckReducer(deck(0), { type: 'next' }).index).toBe(1);
    expect(deckReducer(deck(2), { type: 'next' }).index).toBe(3);
    expect(deckReducer(deck(3), { type: 'next' }).index).toBe(3);
  });

  test('previous moves back and stops at the first card', () => {
    expect(deckReducer(deck(3), { type: 'previous' }).index).toBe(2);
    expect(deckReducer(deck(0), { type: 'previous' }).index).toBe(0);
  });

  test('restart takes the new order and goes to the first card', () => {
    expect(deckReducer(deck(3), { type: 'restart', cards: ['c', 'a', 'b'] })).toEqual({
      cards: ['c', 'a', 'b'],
      index: 0,
    });
  });
});

test('shuffled returns a new array with the same items, leaving the input alone', () => {
  const input = [1, 2, 3, 4];
  const out = shuffled(input, () => 0);
  expect(out).not.toBe(input);
  expect([...out].sort()).toEqual([1, 2, 3, 4]);
  expect(input).toEqual([1, 2, 3, 4]);
  // random() = 0 always swaps with index 0: a deterministic, non-identity order.
  expect(out).toEqual([2, 3, 4, 1]);
});

test('a drag is horizontal only when clearly sideways', () => {
  expect(isHorizontalDrag(30, 5)).toBe(true);
  expect(isHorizontalDrag(30, 20)).toBe(false);
  expect(isHorizontalDrag(5, 0)).toBe(false);
});

test('swipe: left is next, right is previous, short or diagonal is nothing', () => {
  expect(swipeDirection(-80, 10)).toBe('next');
  expect(swipeDirection(80, 10)).toBe('previous');
  expect(swipeDirection(-30, 0)).toBeNull();
  expect(swipeDirection(-80, 60)).toBeNull();
});

test.each([
  ['not-found', 'empty'],
  ['resource-exhausted', 'rate-limited'],
  ['offline', 'offline'],
  ['unauthenticated', 'error'],
  ['unknown', 'error'],
] as const)('callable error %s shows as %s', (kind, expected) => {
  expect(toDeckError(kind)).toBe(expected);
});
