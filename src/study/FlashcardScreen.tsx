import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, StyleSheet, Text, View } from 'react-native';
import type { Flashcard } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { NoConnection } from '../components/NoConnection';
import type { RootStackScreenProps } from '../navigation/types';
import { getDeckPosition, setDeckPosition, setLastOpenedTopic } from '../profile/localFlags';
import { colors, spacing, typography } from '../theme/tokens';
import { useTopics } from '../topics/useTopics';
import { markOpened } from './conceptProgress';
import { progressFor } from './conceptProgressData';
import {
  deckReducer,
  isHorizontalDrag,
  shuffled,
  swipeDirection,
  type DeckAction,
  type DeckError,
  type DeckState,
} from './deck';
import { FlipCard } from './FlipCard';
import { useConceptProgress } from './useConceptProgress';
import { useFlashcardDeck } from './useFlashcardDeck';

// ph-2-us-3: one topic's flashcards, one at a time, then an end-of-deck choice: the mini-quiz
// (a placeholder until Slice 4b) or start over in a fresh order from this session's copy.
// Nothing is recorded per card, but the card the deck was left on is kept on the device so
// reopening the topic resumes there (the end of the deck clears it). Opening counts only once the deck has cards, so an empty or
// failed topic never turns "in progress" or becomes Home's "Continue learning".
export function FlashcardScreen({ navigation, route }: RootStackScreenProps<'Flashcards'>) {
  const { chunkId } = route.params;
  const { uid } = useAuth();
  const deck = useFlashcardDeck(chunkId);
  const startCardId = useSavedPosition(uid, chunkId);
  const progress = useConceptProgress();
  const topics = useTopics();

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

  if (deck.status === 'loading' || (deck.status === 'ready' && startCardId === undefined)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading cards" />
      </View>
    );
  }
  if (deck.status === 'error') {
    return <DeckErrorView error={deck.error} onRetry={deck.retry} onBack={() => navigation.goBack()} />;
  }
  return (
    <Deck
      cards={deck.cards}
      startCardId={startCardId ?? null}
      onMove={(cardId) => {
        if (uid) void setDeckPosition(uid, chunkId, cardId);
      }}
      onQuiz={() => navigation.navigate('MiniQuiz', { chunkId })}
    />
  );
}

/** The saved card id for this topic: `undefined` while reading, `null` when there is none. */
function useSavedPosition(uid: string | null, chunkId: string): string | null | undefined {
  const [cardId, setCardId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getDeckPosition(uid, chunkId).then((saved) => {
      if (!cancelled) setCardId(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, chunkId]);
  return cardId;
}

interface DeckProps {
  cards: Flashcard[];
  /** The card to open on; a missing or unknown id opens the first card. */
  startCardId: string | null;
  /** The card now showing, or `null` at the end of the deck. */
  onMove: (cardId: string | null) => void;
  onQuiz: () => void;
}

function Deck({ cards, startCardId, onMove, onQuiz }: DeckProps) {
  const [state, dispatch] = useReducer(
    (s: DeckState<Flashcard>, a: DeckAction<Flashcard>) => deckReducer(s, a),
    { cards, index: Math.max(0, cards.findIndex((c) => c.id === startCardId)) }
  );

  const currentId = state.cards[state.index]?.id ?? null;
  const lastSaved = useRef(currentId);
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
          {total === 1
            ? "You've been through the only card in this concept."
            : `You've been through all ${total} cards.`}{' '}
          Check what stuck with a quick quiz, or go through them again.
        </Text>
        <Button label="Take the mini-quiz" onPress={onQuiz} />
        <Button
          label="Start this concept over"
          variant="secondary"
          onPress={() => dispatch({ type: 'restart', cards: shuffled(state.cards) })}
        />
        <Button label="Back to the last card" variant="text" onPress={() => dispatch({ type: 'previous' })} />
      </View>
    );
  }

  const card = state.cards[state.index];
  return (
    <View style={styles.screen} {...pan.panHandlers}>
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
  centerText: { textAlign: 'center' },
  progress: { textAlign: 'center' },
  nav: { flexDirection: 'row', gap: spacing.space3 },
  navButton: { flex: 1 },
  end: { justifyContent: 'center' },
  muted: { color: colors.inkSoft },
  wideButton: { marginTop: spacing.space5, paddingHorizontal: spacing.space6 },
});
