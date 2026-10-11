import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import type { NextStepChoice } from '../study/conceptProgressData';
import { colors, spacing, typography } from '../theme/tokens';
import { recommendationLine, recommendedChoice, scoreLine, type MiniQuizOutcome } from './miniQuizData';

// ph-2-us-9: after a mini-quiz, the score, a recommendation (never a gate) and what was missed,
// then the two next steps. The recommended one comes first in the primary style; the other
// stays enabled. Encouraging, not graded-feeling.

const CHOICES: { choice: NextStepChoice; label: string }[] = [
  { choice: 'review-again', label: 'Review Again' },
  { choice: 'mark-reviewed', label: 'Mark Reviewed' },
];

export function MiniQuizResults({
  outcome,
  onChoice,
  onReview,
}: {
  outcome: MiniQuizOutcome;
  onChoice: (choice: NextStepChoice) => void;
  onReview: () => void;
}) {
  const recommended = recommendedChoice(outcome.recommendation);
  const ordered = [...CHOICES].sort((a, b) => Number(b.choice === recommended) - Number(a.choice === recommended));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={typography.stat} accessibilityRole="header">
        {scoreLine(outcome)}
      </Text>
      <Text style={typography.body}>{recommendationLine(outcome.recommendation)}</Text>

      <Text style={typography.h2}>What you missed</Text>
      {outcome.missed.length === 0 ? (
        <Text style={[typography.body, styles.muted]}>You got every one right.</Text>
      ) : (
        outcome.missed.map((item) => (
          <Card key={item.questionId}>
            <View style={styles.missed}>
              <Text style={typography.bodySemibold}>{item.text ?? 'This question was removed.'}</Text>
              <Text style={typography.small}>{`Your answer: ${item.choice ?? 'Skipped'}`}</Text>
              {item.correctAnswer ? (
                <Text style={[typography.small, styles.right]}>{`Right answer: ${item.correctAnswer}`}</Text>
              ) : null}
            </View>
          </Card>
        ))
      )}
      <Button label="Review answers" variant="text" onPress={onReview} />

      <View style={styles.choices}>
        {ordered.map(({ choice, label }) => (
          <Button
            key={choice}
            label={label}
            variant={choice === recommended ? 'primary' : 'secondary'}
            accessibilityHint={choice === recommended ? 'Recommended' : undefined}
            onPress={() => onChoice(choice)}
          />
        ))}
      </View>
      <Text style={[typography.small, styles.muted]}>You can restart any concept from the concept list.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space3 },
  missed: { gap: spacing.space1 },
  right: { color: colors.success },
  muted: { color: colors.inkSoft },
  choices: { gap: spacing.space2, marginTop: spacing.space3 },
});
