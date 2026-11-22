import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { openConcept } from '../navigation/openConcept';
import type { RootStackParamList } from '../navigation/types';
import { STRENGTH_LABEL } from '../progress/conceptStrength';
import { useConceptEvidence } from '../progress/useConceptEvidence';
import { colors, spacing, typography } from '../theme/tokens';

// ph-9-us-7 (Slice 5b-2): up to 3 "likely gap" / "Missed it" topics from the concept report, in
// handbook order, each opening its flashcards. Hidden until there's such evidence.
export const WEAK_SPOTS_LIMIT = 3;

export function WeakSpotsCard() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const evidence = useConceptEvidence();
  if (evidence.status !== 'ready') return null;
  const weak = evidence.rows
    .filter((r) => !r.comingSoon && (r.result.strength === 'likely-gap' || r.result.strength === 'missed-it'))
    .slice(0, WEAK_SPOTS_LIMIT);
  if (weak.length === 0) return null;

  return (
    <Card>
      <Text style={typography.caption}>WORK ON THESE</Text>
      <View style={styles.rows}>
        {weak.map((row) => (
          <Pressable
            key={row.chunkId}
            onPress={() => openConcept(navigation, row.chunkId)}
            accessibilityRole="button"
            accessibilityLabel={`${row.title}, ${STRENGTH_LABEL[row.result.strength]}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowText}>
              <Text style={typography.bodySemibold}>{row.title}</Text>
              <Text style={[typography.small, styles.muted]}>{STRENGTH_LABEL[row.result.strength]}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing.space1 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: spacing.space2 },
  rowText: { flex: 1 },
  pressed: { opacity: 0.6 },
  muted: { color: colors.inkSoft },
});
