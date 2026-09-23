/**
 * Returns a new array with the items in random order (Fisher–Yates shuffle).
 *
 * Fisher–Yates gives every ordering equal probability, unlike naive sort-by-random tricks.
 * The input array is copied first, so the caller's array is never mutated. `random` is
 * injected so tests can supply a predictable sequence.
 */
export function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
