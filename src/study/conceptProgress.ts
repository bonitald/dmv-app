import { getApp } from '@react-native-firebase/app';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from '@react-native-firebase/firestore';
import {
  nextStatus,
  statusForChoice,
  toProgress,
  type ConceptStatus,
  type NextStepChoice,
  type ProgressMap,
  type StoredStatus,
} from './conceptProgressData';

// ph-2-us-12: reads and writes users/{uid}/conceptProgress. Screens never write `status`
// themselves; they call markOpened / setStatusFromChoice, which apply ph-2-us-10's table.
// Writes aren't awaited: Firestore's offline cache updates the live subscription at once and
// syncs later (offline, the promise only settles once it syncs). A write the rules reject is
// logged, never thrown to the screen.

function progressCollection(uid: string) {
  return collection(getFirestore(getApp()), 'users', uid, 'conceptProgress');
}

export function subscribeConceptProgress(
  uid: string,
  onChange: (map: ProgressMap, cachedEmpty: boolean) => void,
  onError: (error: unknown) => void
): () => void {
  // Metadata changes too, so a cache-only empty first snapshot is followed by the server's
  // answer even when the data is the same (Slice 4a carry-forward).
  return onSnapshot(
    progressCollection(uid),
    { includeMetadataChanges: true },
    (snapshot) => {
      const map: ProgressMap = {};
      snapshot.docs.forEach((d) => {
        map[d.id] = toProgress(d.data() as Record<string, unknown>);
      });
      onChange(map, snapshot.empty && snapshot.metadata.fromCache);
    },
    onError
  );
}

function writeStatus(uid: string, chunkId: string, status: StoredStatus): void {
  setDoc(
    doc(progressCollection(uid), chunkId),
    { status, statusUpdatedAt: serverTimestamp() },
    { merge: true }
  ).catch((error) => console.warn('[conceptProgress] status write failed', chunkId, status, error));
}

/** A topic's flashcards or quiz opened: not started → in progress; anything else stays. */
export function markOpened(uid: string, chunkId: string, current: ConceptStatus): void {
  const status = nextStatus(current, 'opened');
  if (status) writeStatus(uid, chunkId, status);
}

/** A next-step choice on the recommendation screen (ph-2-us-9, Slice 4b). */
export function setStatusFromChoice(uid: string, chunkId: string, choice: NextStepChoice): void {
  writeStatus(uid, chunkId, statusForChoice(choice));
}
