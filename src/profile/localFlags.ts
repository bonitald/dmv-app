import AsyncStorage from '@react-native-async-storage/async-storage';

// Small per-user flags kept on the device (ph-9-us-3, ph-9-us-5). Keyed by uid so a different
// user on the same phone (after sign-out, ph-9-us-10) starts fresh. These are conveniences, not
// the record: the profile doc is the source of truth for onboarding and the test date.
export const PREFIX = 'dmv-app:';

export const ONBOARDING_DONE = 'onboarding-done';
export const ADD_DATE_DISMISSED = 'home:add-date-dismissed';

export type LocalFlag = typeof ONBOARDING_DONE | typeof ADD_DATE_DISMISSED;

function key(flag: LocalFlag, uid: string): string {
  return `${PREFIX}${flag}:${uid}`;
}

/** Reads a flag. A storage failure reads as "not set", which only costs showing a step again. */
export async function getLocalFlag(flag: LocalFlag, uid: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(flag, uid))) === '1';
  } catch (error) {
    console.warn('[localFlags] read failed', flag, error);
    return false;
  }
}

export async function setLocalFlag(flag: LocalFlag, uid: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(flag, uid), '1');
  } catch (error) {
    console.warn('[localFlags] write failed', flag, error);
  }
}

// Slice 4a (ph-9-us-7): the topic whose flashcards last loaded on this device, for Home's
// "Continue learning". A string rather than a flag, under the same per-uid key scheme. Lost on
// reinstall, which is fine for a shortcut.
const LAST_OPENED_TOPIC = 'study:last-opened';

function lastOpenedKey(uid: string): string {
  return `${PREFIX}${LAST_OPENED_TOPIC}:${uid}`;
}

/** A storage failure reads as "none", which only costs the Home shortcut. */
export async function getLastOpenedTopic(uid: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(lastOpenedKey(uid));
  } catch (error) {
    console.warn('[localFlags] last-opened read failed', error);
    return null;
  }
}

export async function setLastOpenedTopic(uid: string, chunkId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(lastOpenedKey(uid), chunkId);
  } catch (error) {
    console.warn('[localFlags] last-opened write failed', error);
  }
}

// The card a topic's flashcards were left on, so reopening the topic picks up there. Stored as
// the card id, not an index, so it still finds the card if the deck's order changes. Cleared at
// the end of the deck, so a finished topic opens from the first card.
const DECK_POSITION = 'study:deck-position';

function deckPositionKey(uid: string, chunkId: string): string {
  return `${PREFIX}${DECK_POSITION}:${uid}:${chunkId}`;
}

/** A storage failure reads as "none", which only costs starting at the first card. */
export async function getDeckPosition(uid: string, chunkId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(deckPositionKey(uid, chunkId));
  } catch (error) {
    console.warn('[localFlags] deck-position read failed', error);
    return null;
  }
}

/** `null` clears it. */
export async function setDeckPosition(uid: string, chunkId: string, cardId: string | null): Promise<void> {
  try {
    if (cardId) await AsyncStorage.setItem(deckPositionKey(uid, chunkId), cardId);
    else await AsyncStorage.removeItem(deckPositionKey(uid, chunkId));
  } catch (error) {
    console.warn('[localFlags] deck-position write failed', error);
  }
}
