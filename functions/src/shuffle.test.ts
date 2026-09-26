import { seededRandom, shuffle } from './shuffle';

describe('seededRandom', () => {
  test('the same seed always produces the same sequence', () => {
    const a = seededRandom('q1');
    const b = seededRandom('q1');
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  test('different seeds produce different sequences', () => {
    const a = seededRandom('q1');
    const b = seededRandom('q2');
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  test('returns numbers in [0, 1)', () => {
    const random = seededRandom('range-check');
    for (let i = 0; i < 1000; i++) {
      const n = random();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  test('spreads a 4-choice correct answer across all positions over many seeds', () => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 400; i++) {
      const order = shuffle(['right', 'w1', 'w2', 'w3'], seededRandom(`question-${i}`));
      counts[order.indexOf('right')] += 1;
    }
    // Roughly 100 each; a loose bound catches a broken generator without being flaky.
    for (const count of counts) expect(count).toBeGreaterThan(60);
  });
});
