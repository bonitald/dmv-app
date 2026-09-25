import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import type { RootStackScreenProps } from '../navigation/types';
import type { OnboardingChoice } from '../profile/profileData';
import { colors, radius, spacing, typography } from '../theme/tokens';

// ph-9-us-3 step 2: two equal routes, neither marked "recommended". The choice isn't binding;
// Home always offers both (ph-9-us-7).
const OPTIONS: {
  choice: OnboardingChoice;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}[] = [
  {
    choice: 'baseline',
    icon: 'clipboard-outline',
    title: 'Test what I know',
    body: '3 short sections of about 15 minutes each. Pause any time, then see which topics you’ve got and which need work.',
  },
  {
    choice: 'learn',
    icon: 'book-outline',
    title: 'Learn first',
    body: 'Go through the handbook concept by concept, with flashcards and a quick quiz for each one.',
  },
];

export function ChoiceScreen({ navigation }: RootStackScreenProps<'Choice'>) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={typography.h1} accessibilityRole="header">
        How do you want to start?
      </Text>
      <Text style={[typography.body, styles.muted]}>
        You can always do the other one later.
      </Text>
      <View style={styles.options}>
        {OPTIONS.map((option) => (
          <Card
            key={option.choice}
            onPress={() => navigation.navigate('OnboardingTestDate', { choice: option.choice })}
            accessibilityLabel={`${option.title}. ${option.body}`}
          >
            <View style={styles.optionHeader}>
              <View style={styles.icon}>
                <Ionicons name={option.icon} size={22} color={colors.primary} />
              </View>
              <Text style={typography.h2}>{option.title}</Text>
            </View>
            <Text style={[typography.body, styles.muted]}>{option.body}</Text>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.space5, gap: spacing.space2 },
  muted: { color: colors.inkSoft },
  options: { gap: spacing.space3, marginTop: spacing.space4 },
  optionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
