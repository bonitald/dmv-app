import { useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Flashcard } from '../api/types';
import { ScenarioBadge } from '../components/ScenarioBadge';
import { colors, radius, spacing, typography } from '../theme/tokens';

// ph-2-us-3 / ph-2-us-5: a classic flip card for memorizing. Front: the question only, never
// the choices. Back: only the correct answer, labelled "Answer", with no right/wrong marking.
// Tap anywhere to turn it. The turn is interruptible, so a tap mid-turn just turns it back from
// where it is. Both faces stay mounted so the turn shows real content on each side; the card is
// one accessible button whose label says which side is up. The hidden face takes no touches
// (pointerEvents, scrollEnabled), so on Android the face that is up is the one that scrolls.
// Long text scrolls inside the card.
// The parent gives each card a `key`, so moving to another card always starts on its front.
const FLIP_MS = 300;

export function FlipCard({ card }: { card: Pick<Flashcard, 'text' | 'correctAnswer' | 'type'> }) {
  const [flipped, setFlipped] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const next = !flipped;
    setFlipped(next);
    Animated.timing(turn, {
      toValue: next ? 180 : 0,
      duration: FLIP_MS,
      useNativeDriver: true,
    }).start();
  };

  // Each face is visible only on its own half of the turn, as well as backface-hidden, so the
  // turn looks right on Android too.
  const frontStyle = {
    opacity: turn.interpolate({ inputRange: [0, 90, 90.01, 180], outputRange: [1, 1, 0, 0] }),
    transform: [
      { perspective: 1000 },
      { rotateY: turn.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] }) },
    ],
  };
  const backStyle = {
    opacity: turn.interpolate({ inputRange: [0, 90, 90.01, 180], outputRange: [0, 0, 1, 1] }),
    transform: [
      { perspective: 1000 },
      { rotateY: turn.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] }) },
    ],
  };
  const scenario = card.type === 'scenario';

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={
        flipped
          ? `Answer: ${card.correctAnswer}`
          : `${scenario ? 'Scenario question' : 'Question'}: ${card.text}`
      }
      accessibilityHint={flipped ? 'Shows the question again' : 'Shows the answer'}
      style={styles.container}
    >
      <Animated.View
        testID="flipcard-front"
        pointerEvents={flipped ? 'none' : 'auto'}
        style={[styles.face, frontStyle]}
      >
        <ScrollView scrollEnabled={!flipped} contentContainerStyle={styles.faceContent}>
          <ScenarioBadge type={card.type} />
          <Text style={[typography.h1, styles.text]}>{card.text}</Text>
          <Text style={typography.small}>Tap to see the answer</Text>
        </ScrollView>
      </Animated.View>
      <Animated.View
        testID="flipcard-back"
        pointerEvents={flipped ? 'auto' : 'none'}
        style={[styles.face, styles.back, backStyle]}
      >
        <ScrollView scrollEnabled={flipped} contentContainerStyle={styles.faceContent}>
          <Text style={[typography.caption, styles.answerLabel]}>ANSWER</Text>
          <Text style={[typography.h1, styles.text]}>{card.correctAnswer}</Text>
        </ScrollView>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 280 },
  face: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  back: { borderColor: colors.primary, borderWidth: 2 },
  faceContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.space5,
    gap: spacing.space3,
  },
  // Line height only, as QuizCard's question does; the size stays the token's.
  text: { lineHeight: 28 },
  answerLabel: { color: colors.primary },
});
