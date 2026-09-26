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

/**
 * Returns a repeatable random-number source for a given seed string: the same seed always
 * yields the same sequence of numbers in [0, 1).
 *
 * Used where a shuffle must look random but come out identical on every call — the baseline
 * seeds with each question's ID, so a user who pauses and resumes a section (or a different
 * user) sees the choices in exactly the same order, without storing that order anywhere.
 * Not for security: it's a small, fast generator (FNV-1a hash of the seed feeding mulberry32).
 */
export function seededRandom(seed: string): () => number {
  // FNV-1a: turn the seed string into a 32-bit starting state. Similar seeds (e.g. "q1", "q2")
  // still land far apart.
  let state = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 0x01000193);
  }

  // mulberry32: each call advances the state and scrambles it into a well-mixed 32-bit value,
  // then divides by 2^32 so the result is in [0, 1) like Math.random.
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
