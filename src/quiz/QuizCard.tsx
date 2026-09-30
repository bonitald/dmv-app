import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { QuizQuestion } from '../api/types';
import { Card } from '../components/Card';
import { colors, radius, spacing, typography } from '../theme/tokens';

// ph-3-us-4: one question and its choices, with no answer reveal while taking a test. Shared by
// the baseline, practice tests and mini-quizzes. Scenario questions get the badge from the
// Scenario question card mockup (ph-2-us-5). ph-4-us-4 adds a read-only review state that marks
// the user's choice and the correct one, always with a text tag as well as color.
export function QuizCard({
  question,
  selected,
  onSelect,
  review,
}: {
  question: Pick<QuizQuestion, 'text' | 'choices' | 'type'>;
  selected: string | undefined;
  onSelect?: (choice: string) => void;
  /** Present in review: choices aren't pressable, and right/wrong are marked. */
  review?: { choice: string | null; correctAnswer: string | null };
}) {
  return (
    <Card>
      {question.type === 'scenario' && (
        <View style={styles.badge}>
          <Text style={[typography.caption, styles.badgeText]}>SCENARIO</Text>
        </View>
      )}
      <Text style={[typography.h2, styles.question]}>{question.text}</Text>
      {review ? (
        <View style={styles.choices}>
          {question.choices.map((choice) => {
            const isCorrect = choice === review.correctAnswer;
            const isMine = choice === review.choice;
            const tag =
              isMine && isCorrect
                ? 'Your answer · Correct'
                : isCorrect
                  ? 'Correct answer'
                  : isMine
                    ? 'Your answer'
                    : null;
            const label = [choice, isMine && 'your answer', isCorrect && (isMine ? 'correct' : 'correct answer')]
              .filter(Boolean)
              .join(', ');
            return (
              <View
                key={choice}
                accessible
                accessibilityLabel={label}
                style={[
                  styles.choice,
                  isCorrect && styles.choiceCorrect,
                  isMine && !isCorrect && styles.choiceWrong,
                ]}
              >
                <Text style={[typography.body, styles.choiceText]}>{choice}</Text>
                {tag && (
                  <Text style={[typography.small, isCorrect ? styles.tagCorrect : styles.tagWrong]}>
                    {tag}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {question.choices.map((choice) => {
            const isSelected = choice === selected;
            return (
              <Pressable
                key={choice}
                onPress={() => onSelect?.(choice)}
                accessibilityRole="radio"
                accessibilityLabel={choice}
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.choice,
                  isSelected && styles.choiceSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.dot, isSelected && styles.dotSelected]} />
                <Text style={[typography.body, styles.choiceText]}>{choice}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondarySoft,
    borderRadius: radius.chip,
    paddingHorizontal: spacing.space2,
    paddingVertical: 2,
  },
  badgeText: { color: colors.secondary },
  question: { lineHeight: 22 },
  choices: { gap: spacing.space2, marginTop: spacing.space2 },
  choice: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space3,
    padding: spacing.space3,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceCorrect: { borderColor: colors.success, backgroundColor: colors.successSoft, borderWidth: 2 },
  choiceWrong: { borderColor: colors.alert, borderWidth: 2 },
  tagCorrect: { color: colors.success },
  tagWrong: { color: colors.alert },
  pressed: { opacity: 0.85 },
  dot: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
  },
  dotSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  choiceText: { flex: 1 },
});
