import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import type { RootStackScreenProps } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme/tokens';

// ph-9-us-3 step 1. The "Already have an account? Sign in" link for a new phone arrives with
// account linking (ph-9-us-10, Slice 6).
export function WelcomeScreen({ navigation }: RootStackScreenProps<'Welcome'>) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.badge}>
          <Ionicons name="car-sport" size={40} color={colors.primary} />
        </View>
        <Text style={[typography.caption, styles.center]}>COLORADO PERMIT TEST PREP</Text>
        <Text style={[typography.display, styles.center, styles.title]}>
          Get ready for your permit test
        </Text>
        <Text style={[typography.body, styles.center, styles.subtitle]}>
          Practice with questions based on the Colorado Driver Handbook, learn it concept by
          concept, and see what to work on next.
        </Text>
      </View>
      <Button label="Get started" onPress={() => navigation.navigate('Choice')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.space5,
    paddingBottom: spacing.space5,
  },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.space3 },
  badge: {
    width: 80,
    height: 80,
    borderRadius: radius.hero,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.space2,
  },
  center: { textAlign: 'center' },
  title: { fontSize: 34, lineHeight: 40 },
  subtitle: { color: colors.inkSoft, maxWidth: 340 },
});
