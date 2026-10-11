import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, StyleSheet, Text, View } from 'react-native';
import type { Flashcard } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { NoConnection } from '../components/NoConnection';
import type { RootStackScreenProps } from '../navigation/types';
import { getDeckPass, setDeckPass, setLastOpenedTopic } from '../profile/localFlags';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { markOpened } from './conceptProgress';
import { progressFor } from './conceptProgressData';
import {
  deckReducer,
  isHorizontalDrag,
  swipeDirection,
  type DeckAction,
  type DeckError,
  type DeckState,
} from './deck';
import { readTopicHistory } from './cardPerformance';
import { buildPass, restorePass, type PassMode } from './deckOrder';
import { FlipCard } from './FlipCard';
import { useConceptProgress } from './useConceptProgress';
import { useFlashcardDeck } from './useFlashcardDeck';

// ph-2-us-3 / ph-2-us-4: one topic's flashcards, one at a time, as a "pass": a full pass
// (weak cards first) or a missed-only pass (the cards missed in the last mini-quiz). A saved
// pass resumes where it was left; a needs-revisit topic opens missed-only; a new `pass` route
// param (Review Again) restarts the open viewer. The end of a pass offers the mini-quiz or all
// cards. The card the pass was left on is kept on the device (the end of the pass clears it).
// Opening counts only once the deck has cards, so an empty or failed topic never turns
// "in progress" or becomes Home's "Continue learning".
interface Pass {
  /** Bumped for every new pass, so the Deck remounts at its start. */
  id: number;
  mode: PassMode;
  cards: Flashcard[];
  index: number;
}

export function FlashcardScreen({ navigation, route }: RootStackScreenProps<'Flashcards'>) {
  const { chunkId, pass: passParam } = route.params;
  const { uid } = useAuth();
  const deck = useFlashcardDeck(chunkId);
  const progress = useConceptProgress();
  const topics = useTopics();
  const [pass, setPass] = useState<Pass | null>(null);
  const passCount = useRef(0);
  const handledNonce = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  const latestRequest = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const title =
    topics.status === 'ready' ? topics.topics.find((t) => t.chunkId === chunkId)?.title : undefined;
  useEffect(() => {
    if (title) navigation.setOptions({ title });
  }, [navigation, title]);

  const remembered = useRef(false);
  useEffect(() => {
    if (remembered.current || !uid || deck.status !== 'ready') return;
    remembered.current = true;
    void setLastOpenedTopic(uid, chunkId);
  }, [uid, chunkId, deck.status]);

  // Status is written only from a known current status, so a reviewed topic is never
  // downgraded by a read that's still loading or failed (ph-2-us-10: opening never downgrades).
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || !uid || deck.status !== 'ready' || progress.status !== 'ready' || progress.cachedEmpty) return;
    marked.current = true;
    markOpened(uid, chunkId, progressFor(progress.byChunk, chunkId).status);
  }, [uid, chunkId, deck.status, progress]);

  const startPass = useCallback(
    async (mode: PassMode) => {
      if (deck.status !== 'ready' || !uid) return;
      latestRequest.current += 1;
      const request = latestRequest.current;
      const history = await readTopicHistory(uid, chunkId);
      // Unmounted, or a newer request started while this one read: the latest request wins.
      if (!mounted.current || request !== latestRequest.current) return;
      const built = buildPass(deck.cards, history, mode);
      passCount.current += 1;
      setPass({ id: passCount.current, mode: built.mode, cards: built.cards, index: 0 });
    },
    [deck, uid, chunkId]
  );

  // First pass, once the deck and status are known: a saved pass resumes; otherwise a
  // needs-revisit topic gets its missed cards and anything else a full pass. A status read
  // that failed counts as "not needs-revisit" (full deck), which is always safe.
  const progressKnown = progress.status !== 'loading';
  useEffect(() => {
    if (pass || deck.status !== 'ready' || !uid || !progressKnown) return;
    if (passParam) return; // the param effect below starts it
    let cancelled = false;
    (async () => {
      const saved = await getDeckPass(uid, chunkId);
      const restored = saved ? restorePass(deck.cards, saved) : null;
      if (cancelled) return;
      if (restored) {
        passCount.current += 1;
        setPass({ id: passCount.current, ...restored });
        return;
      }
      const status = progress.status === 'ready' ? progressFor(progress.byChunk, chunkId).status : 'not-started';
      const history = await readTopicHistory(uid, chunkId);
      if (cancelled) return;
      const built = buildPass(deck.cards, history, status === 'needs-revisit' ? 'missed-only' : 'full');
      passCount.current += 1;
      setPass({ id: passCount.current, mode: built.mode, cards: built.cards, index: 0 });
    })();
    return () => {
      cancelled = true;
    };
  }, [pass, deck, uid, chunkId, progressKnown, progress, passParam]);

  // Review Again (Slice 4b): a new `pass` param restarts the open viewer with that pass,
  // reading fresh history (the quiz just recorded it). No new getFlashcards call.
  useEffect(() => {
    if (!passParam || passParam.nonce === handledNonce.current || deck.status !== 'ready' || !uid) return;
    handledNonce.current = passParam.nonce;
    void startPass(passParam.mode);
  }, [passParam, deck.status, uid, startPass]);

  const savePosition = useCallback(
    (p: Pass, cardId: string | null) => {
      if (!uid) return;
      void setDeckPass(uid, chunkId, cardId ? { mode: p.mode, cardIds: p.cards.map((c) => c.id), cardId } : null);
    },
    [uid, chunkId]
  );

  if (deck.status === 'error') {
    return <DeckErrorView error={deck.error} onRetry={deck.retry} onBack={() => navigation.goBack()} />;
  }
  if (deck.status === 'loading' || !pass) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading cards" />
      </View>
    );
  }
  return (
    <Deck
      key={pass.id}
      pass={pass}
      onMove={(cardId) => savePosition(pass, cardId)}
      onQuiz={() => navigation.navigate('MiniQuiz', { chunkId })}
      onAllCards={() => void startPass('full')}
    />
  );
}

interface DeckProps {
  pass: Pass;
  /** The card now showing, or `null` at the end of the deck. */
  onMove: (cardId: string | null) => void;
  onQuiz: () => void;
  /** "Show all cards", "See all cards" and "Start this concept over": a new full pass. */
  onAllCards: () => void;
}

function Deck({ pass, onMove, onQuiz, onAllCards }: DeckProps) {
  const [state, dispatch] = useReducer(
    (s: DeckState<Flashcard>, a: DeckAction<Flashcard>) => deckReducer(s, a),
    { cards: pass.cards, index: pass.index }
  );
  const missedOnly = pass.mode === 'missed-only';

  const currentId = state.cards[state.index]?.id ?? null;
  // Starts unset so the pass is saved as soon as it mounts, not only after the first move.
  const lastSaved = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (currentId === lastSaved.current) return;
    lastSaved.current = currentId;
    onMove(currentId);
  }, [currentId, onMove]);

  // Swipe left for next, right for previous. It only claims clearly sideways drags, so a long
  // card can still scroll vertically. Buttons do the same for anyone who doesn't swipe.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, g) => isHorizontalDrag(g.dx, g.dy),
        onPanResponderRelease: (_event, g) => {
          const direction = swipeDirection(g.dx, g.dy);
          if (direction) dispatch({ type: direction });
        },
      }),
    []
  );

  const total = state.cards.length;
  if (state.index >= total) {
    return (
      <View style={[styles.screen, styles.end]} {...pan.panHandlers}>
        <Text style={typography.h1} accessibilityRole="header">
          End of this concept
        </Text>
        <Text style={[typography.body, styles.muted]}>
          {missedOnly
            ? `You've been through the ${total} you missed.`
            : total === 1
              ? "You've been through the only card in this concept."
              : `You've been through all ${total} cards.`}{' '}
          Check what stuck with a quick quiz, or go through them again.
        </Text>
        <Button label="Take the mini-quiz" onPress={onQuiz} />
        <Button
          label={missedOnly ? 'See all cards' : 'Start this concept over'}
          variant="secondary"
          onPress={onAllCards}
        />
        <Button label="Back to the last card" variant="text" onPress={() => dispatch({ type: 'previous' })} />
      </View>
    );
  }

  const card = state.cards[state.index];
  return (
    <View style={styles.screen} {...pan.panHandlers}>
      {missedOnly && (
        <View style={styles.banner}>
          <Text style={typography.bodySemibold}>{`Reviewing the ${total} you missed`}</Text>
          <Button label="Show all cards" variant="text" onPress={onAllCards} />
        </View>
      )}
      <Text style={[typography.small, styles.progress]}>
        {state.index + 1} of {total}
      </Text>
      <FlipCard key={`${state.index}-${card.id}`} card={card} />
      <View style={styles.nav}>
        <Button
          label="Previous"
          variant="secondary"
          disabled={state.index === 0}
          onPress={() => dispatch({ type: 'previous' })}
          style={styles.navButton}
        />
        <Button label="Next" onPress={() => dispatch({ type: 'next' })} style={styles.navButton} />
      </View>
      {state.index === 0 && <Button label="Skip to quiz" variant="text" onPress={onQuiz} />}
    </View>
  );
}

function DeckErrorView({
  error,
  onRetry,
  onBack,
}: {
  error: DeckError;
  onRetry: () => void;
  onBack: () => void;
}) {
  if (error === 'empty') {
    return (
      <View style={styles.center}>
        <Text style={typography.h1}>Nothing here yet</Text>
        <Text style={[typography.body, styles.muted, styles.centerText]}>
          Cards for this concept are still being written. Try another concept for now.
        </Text>
        <Button label="Back" onPress={onBack} style={styles.wideButton} />
      </View>
    );
  }
  if (error === 'rate-limited') {
    return (
      <NoConnection
        title="Take a short break"
        message="You've opened a lot of cards in a short time. Try again in a few minutes."
        onRetry={onRetry}
      />
    );
  }
  if (error === 'offline') {
    return (
      <NoConnection
        message="Couldn't load these cards. Check your connection and try again."
        onRetry={onRetry}
      />
    );
  }
  return (
    <NoConnection
      title="Something went wrong"
      message="Couldn't load these cards. Please try again."
      onRetry={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.space5,
    gap: spacing.space3,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.space5,
    gap: spacing.space2,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.row,
    paddingHorizontal: spacing.space3,
  },
  centerText: { textAlign: 'center' },
  progress: { textAlign: 'center' },
  nav: { flexDirection: 'row', gap: spacing.space3 },
  navButton: { flex: 1 },
  end: { justifyContent: 'center' },
  muted: { color: colors.inkSoft },
  wideButton: { marginTop: spacing.space5, paddingHorizontal: spacing.space6 },
});
