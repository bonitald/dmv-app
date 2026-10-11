import { applyQuizResults, NO_HISTORY } from './cardPerformanceData';
import { buildPass, cardWeight, parseSavedPass, restorePass, weightedShuffle } from './deckOrder';

const cards = ['q1', 'q2', 'q3', 'q4'].map((id) => ({ id }));
const miss = (id: string) => ({ questionId: id, chunkId: 'row', choice: 'x', correctAnswer: 'y', correct: false });
const hit = (id: string) => ({ ...miss(id), correct: true });
const keepOrder = () => 0.999;

test('cardWeight: never graded and learned cards are neutral; weak cards are boosted', () => {
  expect(cardWeight(null)).toBe(1);
  expect(cardWeight({ graded: 1, missed: 1, correctStreak: 0, lastCorrect: false })).toBe(3);
  expect(cardWeight({ graded: 3, missed: 1, correctStreak: 1, lastCorrect: true })).toBe(3);
  expect(cardWeight({ graded: 3, missed: 1, correctStreak: 2, lastCorrect: true })).toBe(1);
  expect(cardWeight({ graded: 2, missed: 0, correctStreak: 2, lastCorrect: true })).toBe(1);
});

test('full pass: every card exactly once', () => {
  const h = applyQuizResults(NO_HISTORY, [miss('q3')]);
  for (let i = 0; i < 50; i++) {
    const pass = buildPass(cards, h, 'full');
    expect(pass.mode).toBe('full');
    expect(pass.cards.map((c) => c.id).sort()).toEqual(['q1', 'q2', 'q3', 'q4']);
  }
});

test('full pass: a missed card lands in the first half much more often', () => {
  const h = applyQuizResults(NO_HISTORY, [miss('q4'), hit('q1')]);
  let early = 0;
  for (let i = 0; i < 2000; i++) {
    const ids = buildPass(cards, h, 'full').cards.map((c) => c.id);
    if (ids.indexOf('q4') < 2) early++;
  }
  expect(early / 2000).toBeGreaterThan(0.65);
});

test('with a fixed random source, order is deterministic and weak cards come first', () => {
  const h = applyQuizResults(NO_HISTORY, [miss('q3')]);
  expect(buildPass(cards, h, 'full', keepOrder).cards.map((c) => c.id)).toEqual(['q3', 'q1', 'q2', 'q4']);
  expect(buildPass(cards, NO_HISTORY, 'full', keepOrder).cards.map((c) => c.id)).toEqual(['q1', 'q2', 'q3', 'q4']);
});

test('missed-only pass: only the last quiz misses that are in the deck', () => {
  const h = applyQuizResults(NO_HISTORY, [miss('q2'), miss('gone'), hit('q1')]);
  const pass = buildPass(cards, h, 'missed-only', keepOrder);
  expect(pass).toEqual({ mode: 'missed-only', cards: [{ id: 'q2' }] });
});

test.each([
  ['no history', NO_HISTORY],
  ['a perfect score', applyQuizResults(NO_HISTORY, [hit('q1'), hit('q2')])],
  ['misses no longer in the deck', applyQuizResults(NO_HISTORY, [miss('gone')])],
])('missed-only falls back to full with %s', (_label, h) => {
  const pass = buildPass(cards, h, 'missed-only', keepOrder);
  expect(pass.mode).toBe('full');
  expect(pass.cards).toHaveLength(4);
});

test('weightedShuffle on one item and on none', () => {
  expect(weightedShuffle([{ id: 'a' }], () => 1)).toEqual([{ id: 'a' }]);
  expect(weightedShuffle([], () => 1)).toEqual([]);
});

test('restorePass keeps order and position, dropping cards no longer in the deck', () => {
  const restored = restorePass(cards, { mode: 'full', cardIds: ['q3', 'gone', 'q1', 'q2', 'q4'], cardId: 'q1' });
  expect(restored).toEqual({ mode: 'full', cards: [{ id: 'q3' }, { id: 'q1' }, { id: 'q2' }, { id: 'q4' }], index: 1 });
});

test('restorePass: a current card that is gone starts the pass from the top', () => {
  expect(restorePass(cards, { mode: 'missed-only', cardIds: ['q2', 'q4'], cardId: 'gone' })).toEqual({
    mode: 'missed-only', cards: [{ id: 'q2' }, { id: 'q4' }], index: 0,
  });
});

test('restorePass: nothing left means no saved pass', () => {
  expect(restorePass(cards, { mode: 'full', cardIds: ['gone'], cardId: 'gone' })).toBeNull();
});

test('a full pass restored after new cards were added appends them at the end', () => {
  const restored = restorePass(cards, { mode: 'full', cardIds: ['q2', 'q1'], cardId: 'q1' });
  expect(restored!.cards.map((c) => c.id)).toEqual(['q2', 'q1', 'q3', 'q4']);
});

test.each([null, 'q7', '{', '{"mode":"x","cardIds":[],"cardId":"q1"}', '{"mode":"full","cardIds":"q1","cardId":"q1"}'])(
  'parseSavedPass(%p) is null (old plain card id, corrupt, or malformed)',
  (raw) => {
    expect(parseSavedPass(raw)).toBeNull();
  }
);

test('parseSavedPass reads a stored pass', () => {
  const pass = { mode: 'missed-only', cardIds: ['q2'], cardId: 'q2' };
  expect(parseSavedPass(JSON.stringify(pass))).toEqual(pass);
});
