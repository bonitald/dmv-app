import type { Flashcard } from '../api/types';
import { cacheDeck, clearDeckCache, getCachedDeck } from './flashcardCache';

const card = { id: 'q1', text: 'Q', choices: ['a', 'b'], correctAnswer: 'a', type: 'fact', chunkId: 'row', conceptId: 'k' } as Flashcard;

beforeEach(() => clearDeckCache());

test('a cached deck comes back by chunkId; other topics are not cached', () => {
  expect(getCachedDeck('row')).toBeUndefined();
  cacheDeck('row', [card]);
  expect(getCachedDeck('row')).toEqual([card]);
  expect(getCachedDeck('signs')).toBeUndefined();
});

test('clearDeckCache empties it', () => {
  cacheDeck('row', [card]);
  clearDeckCache();
  expect(getCachedDeck('row')).toBeUndefined();
});
